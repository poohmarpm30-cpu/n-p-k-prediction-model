/**
 * api/analyze.js — Vercel Function: sends the simulation results to Gemini and returns the analysis.
 *
 * The browser never sees the API key. It is read from the GEMINI_API_KEY environment variable,
 * which you set in Vercel → Project → Settings → Environment Variables.
 *
 * Request  (POST, JSON):  { "lang": "th" | "en" | "zh", "context": "<simulation summary text>" }
 * Response (JSON):        { "text": "<analysis>" }  or  { "error": "<message>" }
 */

// Models are tried in order until one works for your key. Set GEMINI_MODEL on Vercel to force one.
const MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [])
  .concat(['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'])
  .filter((m, i, a) => a.indexOf(m) === i);
const endpoint = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const MAX_CONTEXT_CHARS = 6000;   // the app sends ~1,500 characters; anything far larger is not from the app

// The instructions live on the server, so the endpoint cannot be used as a general-purpose chatbot.
const INSTRUCTIONS = {
  th: 'คุณเป็นผู้เชี่ยวชาญด้านปฐพีวิทยาและการจัดการปุ๋ยนาข้าวในประเทศไทย วิเคราะห์ผลจำลองสมดุลธาตุอาหาร N-P-K ที่ได้รับ เขียนเป็นภาษาไทยราว 200–250 คำ ครอบคลุม 1) ภาพรวมว่าธาตุใดพอ/ขาด/เกิน 2) จุดอ่อนของแผนปุ๋ยนี้ (ปริมาณ ช่วงเวลา ชนิดปุ๋ย) 3) คำแนะนำเชิงปฏิบัติ ระบุปริมาณเป็น กก./ไร่ 4) ข้อจำกัดของผลจำลองที่ควรตรวจในแปลงจริง เขียนข้อความธรรมดา ไม่ใช้หัวข้อ markdown วิเคราะห์เฉพาะข้อมูลที่ได้รับ',
  en: 'You are a soil scientist and rice fertilizer expert for Thailand. Analyze the N-P-K soil balance simulation you are given, in English, about 200–250 words, covering: 1) which nutrients are sufficient, short or in excess 2) weaknesses of this plan (rates, timing, products) 3) practical recommendations with rates in kg/rai and kg/ha 4) limits of the simulation to verify in the field. Plain text, no markdown headers. Analyze only the data provided.',
  zh: '你是泰国水稻土壤与施肥专家。请用中文分析所提供的氮磷钾土壤平衡模拟结果，约 200–250 字，涵盖：1）哪些养分充足、不足或过量 2）该方案的不足（用量、时期、肥料种类）3）实用建议，用量以 kg/莱 和 kg/ha 表示 4）需要在田间核实的模拟局限。纯文本，不用 markdown 标题。只分析所提供的数据。',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }

  // Only accept calls from pages served by this same site (blocks other websites from using your key).
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });

  let body;
  try { body = req.body; } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const lang = INSTRUCTIONS[body?.lang] ? body.lang : 'en';
  const context = typeof body?.context === 'string' ? body.context.trim() : '';
  if (!context) return res.status(400).json({ error: 'Missing context' });
  if (context.length > MAX_CONTEXT_CHARS) return res.status(413).json({ error: 'Context too long' });

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: INSTRUCTIONS[lang] }] },
    contents: [{ role: 'user', parts: [{ text: 'Simulation results:\n' + context }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });

  let lastError = 'AI service error';
  for (const model of MODELS) {
    try {
      const r = await fetch(endpoint(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal: AbortSignal.timeout(25000),
      });
      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
        if (text) return res.status(200).json({ text, model });
        lastError = `${model}: empty response (${data.candidates?.[0]?.finishReason || 'no candidates'})`;
        continue;
      }

      const msg = data?.error?.message || r.statusText;
      console.error(`Gemini error ${r.status} [${model}]: ${msg}`);
      if (r.status === 429) return res.status(429).json({ error: `Rate limited (${model}): ${msg}` });
      lastError = `Gemini ${r.status} (${model}): ${msg}`;
      // 404 = model not available for this key; 500/503 = model overloaded → try the next model.
      // Anything else (bad key, API disabled) → stop, another model will not help.
      if (![404, 500, 503].includes(r.status)) break;
    } catch (e) {
      console.error(`analyze failed [${model}]`, e);
      lastError = `${model}: ${e.name === 'TimeoutError' ? 'request timed out' : e.message}`;
    }
  }
  return res.status(502).json({ error: lastError });
};
