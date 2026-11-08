/**
 * api/analyze.js — Vercel Function: sends the simulation results to Gemini.
 *
 * The browser never sees the API key. It is read from the GEMINI_API_KEY environment variable,
 * which you set in Vercel → Project → Settings → Environment Variables.
 *
 * Request (POST, JSON):
 *   { "mode": "chat" | "dashboard" | "ask" | "analysis", "lang": "th" | "en" | "zh",
 *     "context": "<simulation summary text>", "question": "<only for mode=ask>",
 *     "messages": [ { "role": "user" | "model", "text": "..." }, ... ]  <only for mode=chat; last one is the user's> }
 * Response (JSON):
 *   dashboard → { "dashboard": { summary, overall_score, nutrients, risks, plan, tips }, "model" }
 *   chat / ask / analysis → { "text": "...", "model" }
 *   error → { "error": "<message>" }
 */

// Gemini Interactions API (Google's recommended API for gemini-3.x models).
// Models are tried in order until one answers. Set GEMINI_MODEL on Vercel to try a specific one first.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Fast "lite" models first: the whole call has to finish inside Vercel's function time limit.
const MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [])
  .concat(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'])
  .filter((m, i, a) => a.indexOf(m) === i);
const MAX_CONTEXT_CHARS = 6000;   // the app sends ~1,500 characters; anything far larger is not from the app
const MAX_QUESTION_CHARS = 500;
const MAX_CHAT_TURNS = 12, MAX_TURN_CHARS = 1500;   // conversation memory sent with each chat message
// Seconds Vercel lets this function run. Default 10 (the limit when vercel.json maxDuration is not applied).
// If your project really allows 60 s, set AI_TIME_LIMIT=60 in Vercel → Settings → Environment Variables.
const TIME_LIMIT_S = Math.min(300, Math.max(5, Number(process.env.AI_TIME_LIMIT) || 10));
const TOTAL_BUDGET_MS = TIME_LIMIT_S * 1000 - 1500;  // leave time to send the reply before Vercel cuts us off
const PER_MODEL_MS = Math.max(7000, Math.min(25000, TOTAL_BUDGET_MS));
let useThinkingCfg = true;  // low thinking = much faster answers; switched off if a model rejects the setting

// Identical requests within CACHE_MS reuse the last answer, so repeat clicks do not spend Gemini quota.
const CACHE_MS = 15 * 60 * 1000, CACHE_MAX = 100, cache = new Map();
const cacheGet = k => { const e = cache.get(k); if (e && Date.now() - e.t < CACHE_MS) return e.v; cache.delete(k); };
const cacheSet = (k, v) => { cache.set(k, { t: Date.now(), v }); if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); };

const LANG_NAME = { th: 'Thai', en: 'English', zh: 'Simplified Chinese' };
const GRADES = ['46-0-0', '21-0-0', '25-0-0', '0-46-0', '0-20-0', '0-3-0', '0-0-60', '0-0-50', '16-20-0', '20-20-0', '18-46-0',
  '11-52-0', '16-16-8', '16-8-8', '16-12-8', '12-16-8', '18-12-6', '15-15-15', '15-5-20', '25-7-4', '20-8-20', '13-13-21'];

const ROLE = 'You are a soil scientist and rice fertilizer expert for Thailand. Use only the simulation data provided; do not invent measurements.';

// The instructions live on the server, so the endpoint cannot be used as a general-purpose chatbot.
function buildInput(mode, lang, context, question, messages) {
  const L = LANG_NAME[lang];
  if (mode === 'chat') {
    const transcript = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n\n');
    return `${ROLE}
You are chatting with a farmer, student or agronomist about the rice field simulation below. It is the CURRENT state of their plan
and may have changed during the conversation, so always use these numbers. Reply in ${L} unless the user clearly writes in another language.
Be conversational, friendly and concise: usually 2-6 sentences, or a short list with "- " when listing steps or rates. Give fertilizer rates in kg/rai.
Plain text only; you may use **bold** for key numbers. No headings, no tables. If something cannot be known from the simulation, say so.
If the user asks about something unrelated to this field, rice, soil or fertilizer, reply briefly that you can only help with this simulation.

Simulation results:
${context}

Conversation so far:
${transcript}

Assistant:`;
  }
  if (mode === 'dashboard') {
    return `${ROLE}
Analyze the N-P-K soil balance simulation below and return ONLY one JSON object (no markdown, no code fence) with exactly this shape:
{
  "summary": string,                      // 2-3 sentences in ${L}
  "overall_score": integer 0-100,         // overall quality of the current fertilizer plan (yield, efficiency, losses)
  "nutrients": {
    "N": { "status": "sufficient" | "short" | "excess", "score": integer 0-100, "note": string },
    "P": { ...same },
    "K": { ...same }
  },                                       // notes: one short sentence in ${L}
  "risks": [ { "level": "high" | "medium" | "low", "title": string, "detail": string } ],   // 2-4 items, in ${L}
  "plan": [ { "day": integer, "product": string, "kg_per_rai": number, "purpose": string } ],
  "tips": [ string ]                       // 2-4 short practical tips in ${L}
}
Rules for "plan": it is your COMPLETE improved fertilizer plan for the whole season (not only additions), 2-6 applications,
"day" between 0 and the crop duration, "product" exactly one of: ${GRADES.join(', ')}; "kg_per_rai" = kilograms of that product per rai;
"purpose" one short phrase in ${L}. Aim for at least 98% of each nutrient requirement with the least fertilizer and losses.

Simulation results:
${context}`;
  }
  if (mode === 'ask') {
    return `${ROLE}
Answer the user's question about this rice field simulation in ${L}, in at most 150 words, plain text, no markdown headers.
If the question is not about this field, rice nutrients or fertilizer, say briefly that you can only help with this simulation.

Simulation results:
${context}

Question: ${question}`;
  }
  return `${ROLE}
Analyze the N-P-K soil balance simulation below in ${L}, about 200-250 words, covering: 1) which nutrients are sufficient, short or in excess
2) weaknesses of this plan (rates, timing, products) 3) practical recommendations with rates in kg/rai 4) limits of the simulation to verify in the field.
Plain text, no markdown headers.

Simulation results:
${context}`;
}

// --- validate the model's dashboard JSON so the page never renders something malformed ---
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
function parseDashboard(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  const d = JSON.parse(text.slice(start, end + 1));
  const nut = {};
  for (const n of ['N', 'P', 'K']) {
    const x = d.nutrients?.[n] || {};
    nut[n] = { status: ['sufficient', 'short', 'excess'].includes(x.status) ? x.status : 'sufficient', score: Math.round(clamp(x.score, 0, 100)), note: str(x.note, 200) };
  }
  const risks = (Array.isArray(d.risks) ? d.risks : []).slice(0, 5).map(r => ({
    level: ['high', 'medium', 'low'].includes(r?.level) ? r.level : 'medium', title: str(r?.title, 80), detail: str(r?.detail, 250) })).filter(r => r.title);
  const plan = (Array.isArray(d.plan) ? d.plan : []).slice(0, 8).map(p => ({
    day: Math.round(clamp(p?.day, 0, 200)), product: str(p?.product, 12), kg_per_rai: Math.round(clamp(p?.kg_per_rai, 0, 200) * 10) / 10, purpose: str(p?.purpose, 80) }))
    .filter(p => GRADES.includes(p.product) && p.kg_per_rai > 0).sort((a, b) => a.day - b.day);
  const tips = (Array.isArray(d.tips) ? d.tips : []).slice(0, 5).map(t => str(t, 200)).filter(Boolean);
  return { summary: str(d.summary, 600), overall_score: Math.round(clamp(d.overall_score, 0, 100)), nutrients: nut, risks, plan, tips };
}

async function callGemini(apiKey, input) {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const attempts = [], limited = [];
  let timedOut = false;
  const models = MODELS.slice();
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const timeLeft = deadline - Date.now();
    if (timeLeft < 2500) { attempts.push('time limit reached'); timedOut = true; break; }
    try {
      const payload = { model, input, store: false };
      if (useThinkingCfg) payload.generation_config = { thinking_level: 'low' };
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(Math.min(PER_MODEL_MS, timeLeft - 500)),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = (data.output_text || (data.steps || [])
          .filter(s => s.type === 'model_output')
          .flatMap(s => s.content || []).filter(c => c.type === 'text').map(c => c.text).join('')).trim();
        if (text) return { text, model };
        attempts.push(`${model}: empty response (status ${data.status || 'unknown'})`);
        continue;
      }
      const msg = data?.error?.message || r.statusText;
      if (r.status === 400 && useThinkingCfg && /thinking|generation_config/i.test(msg)) {
        useThinkingCfg = false; models.splice(i + 1, 0, model);  // retry the same model without the setting
        continue;
      }
      console.error(`Gemini error ${r.status} [${model}]: ${msg}`);
      attempts.push(`${model}: ${r.status} ${msg}`);
      if (r.status === 429) {
        // Quota used up for this model. Free-tier limits are often per model, so try the next one.
        const det = data?.error?.details || [];
        const retry = det.find(d => String(d['@type'] || '').includes('RetryInfo'))?.retryDelay;
        limited.push({ secs: parseInt(retry, 10) || 0, daily: /PerDay/i.test(JSON.stringify(det)) || /per day/i.test(msg) });
        continue;
      }
      // 404 = model not available; 500/503/504 = overloaded → try next. Others (bad key, API disabled) → stop.
      if (![404, 500, 503, 504].includes(r.status)) break;
    } catch (e) {
      console.error(`analyze failed [${model}]`, e);
      const to = e.name === 'TimeoutError' || e.name === 'AbortError';
      if (to) timedOut = true;
      attempts.push(`${model}: ${to ? 'timed out' : e.message}`);
    }
  }
  if (limited.length) {
    const waits = limited.map(l => l.secs).filter(Boolean);
    return { status: 429, error: attempts.join(' | '), retryAfter: waits.length ? Math.min(...waits) : 60, daily: limited.every(l => l.daily) };
  }
  if (timedOut) return { status: 504, error: `Gemini did not answer within ${TIME_LIMIT_S} s (server time limit). Press regenerate to try again. Details: ${attempts.join(' | ')}` };
  return { status: 502, error: attempts.join(' | ') };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  // Only accept calls from pages served by this same site (blocks other websites from using your key).
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Forbidden origin' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });

  let body;
  try { body = req.body; } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const mode = ['chat', 'dashboard', 'ask', 'analysis'].includes(body?.mode) ? body.mode : 'analysis';
  const lang = LANG_NAME[body?.lang] ? body.lang : 'en';
  const context = typeof body?.context === 'string' ? body.context.trim() : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!context) return res.status(400).json({ error: 'Missing context' });
  if (context.length > MAX_CONTEXT_CHARS) return res.status(413).json({ error: 'Context too long' });
  if (mode === 'ask' && !question) return res.status(400).json({ error: 'Missing question' });
  if (question.length > MAX_QUESTION_CHARS) return res.status(413).json({ error: 'Question too long' });
  let messages = [];
  if (mode === 'chat') {
    messages = (Array.isArray(body?.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
      .slice(-MAX_CHAT_TURNS).map(m => ({ role: m.role, text: m.text.trim().slice(0, MAX_TURN_CHARS) }));
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return res.status(400).json({ error: 'Missing message' });
    if (lastMsg.text.length > MAX_QUESTION_CHARS) return res.status(413).json({ error: 'Message too long' });
  }

  const key = [mode, lang, context, question, JSON.stringify(messages)].join('\u0000');
  const hit = !body?.force && cacheGet(key);
  if (hit) return res.status(200).json({ ...hit, cached: true });

  const out = await callGemini(apiKey, buildInput(mode, lang, context, question, messages));
  if (out.status === 429) {
    res.setHeader('Retry-After', String(out.retryAfter));
    return res.status(429).json({ error: out.error, retryAfter: out.retryAfter, daily: out.daily });
  }
  if (out.error) return res.status(out.status).json({ error: out.error });

  if (mode !== 'dashboard') { const v = { text: out.text, model: out.model }; cacheSet(key, v); return res.status(200).json(v); }
  try {
    const v = { dashboard: parseDashboard(out.text), model: out.model }; cacheSet(key, v);
    return res.status(200).json(v);
  } catch (e) {
    console.error('dashboard parse failed', e.message, out.text.slice(0, 300));
    return res.status(502).json({ error: `AI reply was not valid dashboard data (${e.message})` });
  }
};
