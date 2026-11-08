/**
 * dashboard.js — AI chat for NPK Soil Balance
 * A conversation with Gemini (through /api/analyze, mode "chat"). Every message sends the latest
 * simulation of this project plus the recent conversation, so the AI answers about the current plan
 * and remembers what was said. Nothing is stored: the chat clears when the page reloads.
 * Load after engine.js and app.js; uses their globals ($, last, lang, U, uLabel).
 */

const CTR = {
th: { welcome: name => `สวัสดีครับ ผมเห็นผลจำลองของโปรเจกต์ "${name}" แล้ว ถามได้เลย เช่น ปุ๋ยพอไหม ควรปรับแผนอย่างไร หรือถ้าเปลี่ยนสูตรปุ๋ยจะเป็นอย่างไร`,
  sugs: ['สรุปผลแปลงนี้ให้หน่อย', 'ธาตุไหนขาดหรือเกิน?', 'ควรปรับแผนปุ๋ยอย่างไร?', 'ลดปริมาณปุ๋ยได้ไหมโดยผลผลิตไม่ลด?'],
  ph: 'พิมพ์ข้อความถึง AI…', send: 'ส่ง', clear: '🗑 ล้างแชท', you: 'คุณ', ai: 'AI',
  thinking: 'กำลังพิมพ์…', fail: 'ตอบไม่ได้ในขณะนี้', retry: 'ส่งใหม่',
  ctx: (y, lim) => `AI เห็นผลจำลองล่าสุด: ผลผลิต ~${y} · ธาตุจำกัด ${lim}`,
  note: 'Enter = ส่ง · Shift+Enter = ขึ้นบรรทัดใหม่ · คำตอบจาก AI เป็นความเห็นประกอบ ควรตรวจกับข้อมูลแปลงจริงก่อนตัดสินใจ แชทจะหายเมื่อรีเฟรชหน้า',
  limited: (s, daily) => daily ? 'โควตารายวันของคีย์ Gemini หมดแล้ว จะรีเซ็ตประมาณ 14:00–15:00 น. เวลาไทย หรือเปิดใช้ billing ใน Google AI Studio เพื่อเพิ่มโควตา' : `Gemini จำกัดจำนวนครั้งต่อนาที รออีก ${s} วินาทีแล้วลองใหม่`,
  wait: s => `⏳ ${s} วิ` },
en: { welcome: name => `Hi! I can see the simulation for "${name}". Ask me anything, e.g. is the fertilizer enough, how should the plan change, or what if you switch grades.`,
  sugs: ['Summarize this field for me', 'Which nutrient is short or in excess?', 'How should I adjust the fertilizer plan?', 'Can I use less fertilizer without losing yield?'],
  ph: 'Message the AI…', send: 'Send', clear: '🗑 Clear chat', you: 'You', ai: 'AI',
  thinking: 'Typing…', fail: 'Could not answer right now', retry: 'Resend',
  ctx: (y, lim) => `The AI sees the latest simulation: yield ~${y} · limiting ${lim}`,
  note: 'Enter = send · Shift+Enter = new line · AI answers are advisory; check them against field data before deciding. The chat clears when the page reloads.',
  limited: (s, daily) => daily ? 'The Gemini key\'s daily quota is used up. It resets at midnight Pacific time, or enable billing in Google AI Studio.' : `Gemini limits requests per minute. Try again in ${s} seconds.`,
  wait: s => `⏳ ${s}s` },
zh: { welcome: name => `你好！我已看到项目"${name}"的模拟结果。随时提问，例如肥料够不够、方案该怎么调整、换肥料会怎样。`,
  sugs: ['帮我总结这块田', '哪种养分不足或过量？', '施肥方案应如何调整？', '能否少施肥而不减产？'],
  ph: '给 AI 发消息…', send: '发送', clear: '🗑 清空对话', you: '你', ai: 'AI',
  thinking: '正在输入…', fail: '暂时无法回答', retry: '重新发送',
  ctx: (y, lim) => `AI 可见最新模拟：产量 ~${y} · 限制养分 ${lim}`,
  note: 'Enter 发送 · Shift+Enter 换行 · AI 回答仅供参考，决策前请以田间数据核实。刷新页面后对话会清空。',
  limited: (s, daily) => daily ? 'Gemini 密钥的每日配额已用完，将在太平洋时间午夜重置，或在 Google AI Studio 启用结算。' : `Gemini 限制了每分钟请求数，请 ${s} 秒后再试。`,
  wait: s => `⏳ ${s} 秒` },
};
const C = () => CTR[lang] || CTR.en;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX_TURNS = 12;   // messages sent back to the server as conversation memory

let msgs = [];          // { role: 'user' | 'model', text, error?, pending? }
let aiBusy = false, coolUntil = 0, coolTimer = null;
const coolingDown = () => Date.now() < coolUntil;

async function callAI(payload) {
  const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}${res.status === 504 ? ' — server time limit' : ''}`);
    err.status = res.status; err.retryAfter = data.retryAfter || Number(res.headers.get('Retry-After')) || 60; err.daily = !!data.daily;
    throw err;
  }
  return data;
}

// Plain text from the AI → safe HTML: **bold**, line breaks, "- " bullets kept as text
function fmtChat(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

function projectName() { const el = document.getElementById('projName'); return (el && el.value.trim()) || '—'; }

function renderChat() {
  const c = C(), log = $('chatLog');
  const welcome = `<div class="bubble model"><div class="who">${esc(c.ai)}</div><div>${esc(c.welcome(projectName()))}</div></div>`;
  log.innerHTML = welcome + msgs.map((m, i) => {
    const body = m.pending ? `<span class="typing">${esc(c.thinking)}</span>` : fmtChat(m.text);
    const retry = m.error && i === msgs.length - 1 ? ` <button type="button" class="linkBtn" onclick="retryChat()">${esc(c.retry)}</button>` : '';
    return `<div class="bubble ${m.role}${m.error ? ' err' : ''}"><div class="who">${esc(m.role === 'user' ? c.you : c.ai)}</div><div>${body}${retry}</div></div>`;
  }).join('');
  $('chatSugs').innerHTML = msgs.length ? '' : c.sugs.map(q => `<button type="button" class="preset" onclick="sendChat(this.textContent)">${esc(q)}</button>`).join('');
  log.scrollTop = log.scrollHeight;
}

function paintChatBits() {
  const c = C();
  $('chatInput').placeholder = c.ph; $('chatClear').textContent = c.clear; $('chatNote').textContent = c.note;
  if (!coolingDown()) $('chatSend').textContent = c.send;
  $('chatCtx').textContent = last ? c.ctx(Math.round(last.yieldHa * U()).toLocaleString() + ' ' + uLabel(), last.lim) : '';
  $('chatClear').hidden = !msgs.length;
}
function setSendDisabled(on) { $('chatSend').disabled = on; document.querySelectorAll('#chatSugs button').forEach(b => { b.disabled = on; }); }

function startCooldown(secs) {
  coolUntil = Date.now() + secs * 1000; clearInterval(coolTimer);
  const tick = () => {
    const left = Math.ceil((coolUntil - Date.now()) / 1000);
    if (left <= 0) { clearInterval(coolTimer); coolTimer = null; paintChatBits(); if (!aiBusy) setSendDisabled(false); return; }
    setSendDisabled(true); $('chatSend').textContent = C().wait(left);
  };
  tick(); coolTimer = setInterval(tick, 1000);
}

async function sendChat(text) {
  const box = $('chatInput');
  const q = (typeof text === 'string' ? text : box.value).trim();
  if (!q || !last || aiBusy || coolingDown()) return;
  if (typeof text !== 'string') { box.value = ''; autoGrow(); }
  msgs = msgs.filter(m => !m.error);               // drop an earlier failed reply before continuing
  msgs.push({ role: 'user', text: q });
  await ask();
}
async function retryChat() {
  if (aiBusy || coolingDown()) return;
  if (msgs.length && msgs[msgs.length - 1].error) msgs.pop();
  if (msgs.length && msgs[msgs.length - 1].role === 'user') await ask();
}
async function ask() {
  aiBusy = true; setSendDisabled(true);
  const history = msgs.slice(-MAX_TURNS).map(m => ({ role: m.role, text: m.text }));
  msgs.push({ role: 'model', text: '', pending: true }); renderChat(); paintChatBits();
  const slot = msgs[msgs.length - 1];
  try {
    const data = await callAI({ mode: 'chat', lang, context: buildAIContext(), messages: history });
    slot.text = data.text; slot.pending = false;
  } catch (e) {
    slot.pending = false; slot.error = true;
    slot.text = e.status === 429 ? C().limited(e.retryAfter, e.daily) : `${C().fail} (${e.message})`;
    if (e.status === 429) startCooldown(e.daily ? 300 : e.retryAfter);
  }
  aiBusy = false; renderChat(); paintChatBits();
  if (!coolingDown()) setSendDisabled(false);
  if (matchMedia('(hover: hover)').matches) $('chatInput').focus();
}
function clearChat() { if (aiBusy) return; msgs = []; renderChat(); paintChatBits(); $('chatInput').focus(); }

function autoGrow() { const t = $('chatInput'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }
$('chatInput').addEventListener('input', autoGrow);
$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); }
});

// Called by wizard.js when the chat step opens
function onChatShown() { renderChat(); paintChatBits(); if (matchMedia('(hover: hover)').matches) $('chatInput').focus({ preventScroll: true }); }

// Hook into app.js: relabel on language change, refresh the "AI sees" line after every calculation
const _setLang = setLang;
setLang = function (l) { _setLang(l); renderChat(); paintChatBits(); };
const _calc = calc;
calc = function () { _calc(); paintChatBits(); };
renderChat(); paintChatBits();
