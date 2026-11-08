/**
 * dashboard.js — AI Dashboard for NPK Soil Balance
 * Asks Gemini (through /api/analyze) for a structured assessment, renders it as a dashboard,
 * re-runs the AI's proposed fertilizer plan through the model (engine.js) to check it,
 * and lets the user ask follow-up questions.
 * Load after engine.js and app.js; uses their globals (last, lang, T, U, RAI, FERT_PRODUCTS, ...).
 */

const DTR = {
th: { btn: '🤖 สร้าง AI Dashboard', title: 'AI Dashboard', sub: 'วิเคราะห์โดย Gemini จากผลจำลองด้านบน',
  loading: 'กำลังให้ AI วิเคราะห์ผล อาจใช้เวลา 10–40 วินาที…', regen: '↻ วิเคราะห์ใหม่', stale: 'ผลจำลองเปลี่ยนไปหลังการวิเคราะห์ กด "วิเคราะห์ใหม่" เพื่ออัปเดต',
  score: 'คะแนนแผนปุ๋ยปัจจุบัน', of100: 'จาก 100', status: { sufficient: 'เพียงพอ', short: 'ขาด', excess: 'เกิน' },
  risks: 'ความเสี่ยงที่ AI พบ', level: { high: 'สูง', medium: 'กลาง', low: 'ต่ำ' }, plan: 'แผนปุ๋ยที่ AI เสนอ',
  colDay: 'วันที่', colProd: 'ปุ๋ย', colAmt: 'กก./ไร่', colWhy: 'เพื่อ', verify: 'ตรวจแผนของ AI ด้วยโมเดล',
  verifyNote: 'รันแผนของ AI ผ่านโมเดลจำลองเดียวกัน เพื่อดูว่าได้ผลจริงตามที่ AI บอกหรือไม่',
  cur: 'แผนปัจจุบัน', ai: 'แผนของ AI', rowN: 'N ที่ข้าวได้รับ', rowP: 'P ที่ข้าวได้รับ', rowK: 'K ที่ข้าวได้รับ', rowY: 'ผลผลิตโดยประมาณ (กก./ไร่)', rowF: 'ปุ๋ยรวม (กก./ไร่)',
  better: 'แผนของ AI ให้ผลผลิตเท่ากันหรือดีกว่า', worse: 'โมเดลพบว่าแผนของ AI ให้ผลผลิตต่ำกว่าแผนปัจจุบัน ควรพิจารณาก่อนใช้', noPlan: 'AI ไม่ได้เสนอแผนปุ๋ยที่ใช้ได้',
  apply: 'ใช้แผนนี้ในตารางปุ๋ย', applied: 'นำแผนของ AI ไปใส่ในตารางปุ๋ยแล้ว', tips: 'คำแนะนำเพิ่มเติม',
  ask: 'ถาม AI เกี่ยวกับแปลงนี้', askPh: 'เช่น ถ้าใช้ 16-16-8 แทน 16-20-0 จะเป็นอย่างไร', askBtn: 'ถาม', you: 'คุณ', aiName: 'AI',
  thinking: 'กำลังคิด…', limited: (s, daily) => daily ? 'โควตารายวันของคีย์ Gemini หมดแล้ว จะรีเซ็ตประมาณ 14:00–15:00 น. เวลาไทย หรือเปิดใช้ billing ใน Google AI Studio เพื่อเพิ่มโควตา' : `Gemini จำกัดจำนวนครั้งต่อนาทีของคีย์นี้ รออีก ${s} วินาทีแล้วลองใหม่`, wait: s => `⏳ รอ ${s} วินาที`, fail: 'AI ใช้ไม่ได้ในขณะนี้', model: m => `โมเดล: ${m}`, disclaimer: 'ผลจาก AI เป็นความเห็นประกอบ ควรตรวจกับข้อมูลแปลงจริงก่อนตัดสินใจ' },
en: { btn: '🤖 Build AI Dashboard', title: 'AI Dashboard', sub: 'Analysis by Gemini of the simulation above',
  loading: 'Asking the AI to analyze the results. This can take 10–40 seconds…', regen: '↻ Analyze again', stale: 'The simulation changed after this analysis. Press "Analyze again" to update.',
  score: 'Current plan score', of100: 'out of 100', status: { sufficient: 'Sufficient', short: 'Short', excess: 'Excess' },
  risks: 'Risks found by the AI', level: { high: 'High', medium: 'Medium', low: 'Low' }, plan: 'Fertilizer plan proposed by the AI',
  colDay: 'Day', colProd: 'Fertilizer', colAmt: 'kg/rai', colWhy: 'Purpose', verify: 'AI plan checked by the model',
  verifyNote: 'The AI plan is run through the same simulation to see whether it delivers what the AI claims',
  cur: 'Current plan', ai: 'AI plan', rowN: 'N received', rowP: 'P received', rowK: 'K received', rowY: 'Estimated yield (kg/rai)', rowF: 'Total fertilizer (kg/rai)',
  better: 'The AI plan gives the same or higher yield', worse: 'The model finds the AI plan gives lower yield than the current plan; review before using it', noPlan: 'The AI did not propose a usable fertilizer plan',
  apply: 'Use this plan in the fertilizer table', applied: 'The AI plan is now in the fertilizer table', tips: 'More tips',
  ask: 'Ask the AI about this field', askPh: 'e.g. What if I use 16-16-8 instead of 16-20-0?', askBtn: 'Ask', you: 'You', aiName: 'AI',
  thinking: 'Thinking…', limited: (s, daily) => daily ? 'The Gemini key\'s daily quota is used up. It resets at midnight Pacific time, or enable billing in Google AI Studio for a higher quota.' : `Gemini limits requests per minute for this key. Try again in ${s} seconds.`, wait: s => `⏳ Wait ${s} s`, fail: 'AI is unavailable right now', model: m => `Model: ${m}`, disclaimer: 'AI output is advisory; check it against field data before deciding' },
zh: { btn: '🤖 生成 AI 仪表板', title: 'AI 仪表板', sub: '由 Gemini 根据上方模拟结果分析',
  loading: '正在请 AI 分析结果，可能需要 10–40 秒…', regen: '↻ 重新分析', stale: '分析后模拟结果已改变，请点击"重新分析"更新',
  score: '当前方案评分', of100: '满分 100', status: { sufficient: '充足', short: '不足', excess: '过量' },
  risks: 'AI 发现的风险', level: { high: '高', medium: '中', low: '低' }, plan: 'AI 建议的施肥方案',
  colDay: '天数', colProd: '肥料', colAmt: 'kg/莱', colWhy: '目的', verify: '用模型检验 AI 方案',
  verifyNote: '将 AI 方案放入同一模拟中运行，检验其效果是否如 AI 所述',
  cur: '当前方案', ai: 'AI 方案', rowN: 'N 获得率', rowP: 'P 获得率', rowK: 'K 获得率', rowY: '预估产量 (kg/莱)', rowF: '肥料总量 (kg/莱)',
  better: 'AI 方案产量相同或更高', worse: '模型显示 AI 方案产量低于当前方案，使用前请斟酌', noPlan: 'AI 未提出可用的施肥方案',
  apply: '将此方案填入施肥表', applied: 'AI 方案已填入施肥表', tips: '更多建议',
  ask: '向 AI 提问这块田', askPh: '例如：用 16-16-8 代替 16-20-0 会怎样？', askBtn: '提问', you: '你', aiName: 'AI',
  thinking: '思考中…', limited: (s, daily) => daily ? 'Gemini 密钥的每日配额已用完，将在太平洋时间午夜重置，或在 Google AI Studio 启用结算以提高配额。' : `Gemini 限制了此密钥每分钟的请求数，请 ${s} 秒后再试。`, wait: s => `⏳ 等待 ${s} 秒`, fail: 'AI 暂时不可用', model: m => `模型：${m}`, disclaimer: 'AI 结果仅供参考，决策前请以田间数据核实' },
};
const D = () => DTR[lang] || DTR.en;
let dash = null, dashContext = '', dashModel = '', chat = [];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One request at a time; after a rate-limit reply, all AI buttons wait out the cooldown.
let aiBusy = false, coolUntil = 0, coolTimer = null;
const dashCache = new Map();   // lang+context → last good dashboard, so repeat clicks cost no quota

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
function aiButtons() { return [$('aiBtn'), $('dashRegen'), document.getElementById('askBtn')].filter(Boolean); }
function setAIDisabled(on) { aiButtons().forEach(b => { b.disabled = on; }); }
function startCooldown(secs) {
  coolUntil = Date.now() + secs * 1000; clearInterval(coolTimer);
  const tick = () => {
    const left = Math.ceil((coolUntil - Date.now()) / 1000);
    if (left <= 0) { clearInterval(coolTimer); coolTimer = null; paintDashLabels(); if (!aiBusy) setAIDisabled(false); return; }
    setAIDisabled(true); $('aiBtn').textContent = D().wait(left);
  };
  tick(); coolTimer = setInterval(tick, 1000);
}
const coolingDown = () => Date.now() < coolUntil;
function limitMessage(e) { return `<div class="verdict v-mid">${esc(D().limited(e.retryAfter, e.daily))}</div>`; }

async function runAIDashboard(force = false) {
  if (!last || aiBusy || coolingDown()) return;
  const card = $('aiDash'), body = $('dashBody');
  card.hidden = false; $('dashStale').hidden = true;
  card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  dashContext = buildAIContext();
  const key = lang + '\u0000' + dashContext;
  if (!force && dashCache.has(key)) { ({ dash, model: dashModel } = dashCache.get(key)); chat = []; renderDashboard(); return; }
  aiBusy = true; setAIDisabled(true);
  body.innerHTML = `<div class="dashLoading"><span class="spin"></span>${esc(D().loading)}</div>`;
  try {
    const data = await callAI({ mode: 'dashboard', lang, context: dashContext, force });
    dash = data.dashboard; dashModel = data.model || ''; chat = [];
    dashCache.set(key, { dash, model: dashModel });
    renderDashboard();
  } catch (e) {
    dash = null;
    body.innerHTML = e.status === 429 ? limitMessage(e) : `<div class="verdict v-low">${esc(D().fail)} (${esc(e.message)})</div>`;
    if (e.status === 429) startCooldown(e.daily ? 300 : e.retryAfter);
  }
  aiBusy = false; if (!coolingDown()) setAIDisabled(false);
}

// Run the AI's plan through the same engine with the current field parameters
function evalPlan(rows) {
  const { P, dur } = last, sched = { N: [], P: [], K: [] }; let totalRai = 0;
  rows.forEach(r => {
    const g = FERT_PRODUCTS[r.product]; if (!g || r.day > dur) return;
    const ha = r.kg_per_rai / RAI; totalRai += r.kg_per_rai;
    sched.N.push({ day: r.day, amt: ha * g.n / 100, slow: false });
    sched.P.push({ day: r.day, amt: ha * g.p / 100 * P2O5_TO_P, slow: !!g.slow });
    sched.K.push({ day: r.day, amt: ha * g.k / 100 * K2O_TO_K, slow: false });
  });
  const out = { total: totalRai }; let m = 1;
  NUTRIENTS.forEach(n => { out[n] = simulateNutrient(P[n], sched[n], dur).ratio; m = Math.min(m, out[n]); });
  out.yieldRai = num('ymax') / U() * m * RAI;
  return out;
}
function currentPlanStats() {
  const out = { total: last.raw.reduce((a, f) => a + f.amtHa * RAI, 0), yieldRai: last.yieldHa * RAI };
  NUTRIENTS.forEach(n => { out[n] = last.res[n].ratio; });
  return out;
}

function scoreRing(score) {
  const r = 34, c = 2 * Math.PI * r, col = score >= 80 ? 'var(--good-fg)' : score >= 60 ? 'var(--mid-fg)' : 'var(--low-fg)';
  return `<svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--border)" stroke-width="8"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c * score / 100} ${c}" transform="rotate(-90 42 42)"/>
    <text x="42" y="47" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)">${score}</text></svg>`;
}

function renderDashboard() {
  if (!dash) return;
  const d = D(), t = T(), cols = { N: '#3f7d4f', P: '#8e45a3', K: '#3a72b0' };
  const pct = v => (v * 100).toFixed(0) + '%';
  let h = `<div class="dashTop">${scoreRing(dash.overall_score)}<div class="dashSum"><div class="dashLabel">${esc(d.score)} · ${esc(d.of100)}</div><p>${esc(dash.summary)}</p></div></div>`;

  h += `<div class="dashNut">` + NUTRIENTS.map(n => { const x = dash.nutrients[n];
    return `<div class="dnCell"><div class="dnHead"><b style="color:${cols[n]}">${esc(t.nutName[n])}</b><span class="pill st-${x.status}">${esc(d.status[x.status])}</span></div>
      <div class="bar"><span style="width:${x.score}%;background:${cols[n]}"></span></div><div class="dnScore">${x.score}/100</div><div class="hint">${esc(x.note)}</div></div>`; }).join('') + `</div>`;

  if (dash.risks.length) h += `<h4>${esc(d.risks)}</h4><div class="riskList">` + dash.risks.map(r =>
    `<div class="risk lv-${r.level}"><span class="pill lvp-${r.level}">${esc(d.level[r.level])}</span><div><b>${esc(r.title)}</b><div class="hint">${esc(r.detail)}</div></div></div>`).join('') + `</div>`;

  h += `<h4>${esc(d.plan)}</h4>`;
  if (!dash.plan.length) h += `<div class="hint">${esc(d.noPlan)}</div>`;
  else {
    h += `<div class="tbl-wrap" style="max-height:none"><table><tr><th>${esc(d.colDay)}</th><th style="text-align:left">${esc(d.colProd)}</th><th>${esc(d.colAmt)}</th><th style="text-align:left">${esc(d.colWhy)}</th></tr>` +
      dash.plan.map(p => `<tr><td>${p.day}</td><td>${esc(p.product)}</td><td>${p.kg_per_rai}</td><td style="text-align:left">${esc(p.purpose)}</td></tr>`).join('') + `</table></div>`;
    const a = evalPlan(dash.plan), c = currentPlanStats(), ok = a.yieldRai >= c.yieldRai - 0.5;
    const row = (label, cv, av, f, good) => `<tr><td>${esc(label)}</td><td>${f(cv)}</td><td class="${good(av, cv) ? 'up' : (good(cv, av) ? 'down' : '')}">${f(av)}</td></tr>`;
    const hi = (x, y) => x > y + 0.005, lo = (x, y) => x < y - 0.05;
    h += `<div class="verifyBox"><div class="dashLabel">🔬 ${esc(d.verify)}</div><div class="hint" style="margin-bottom:6px">${esc(d.verifyNote)}</div>
      <table class="cmp"><tr><th></th><th>${esc(d.cur)}</th><th>${esc(d.ai)}</th></tr>
      ${row(d.rowN, c.N, a.N, pct, hi)}${row(d.rowP, c.P, a.P, pct, hi)}${row(d.rowK, c.K, a.K, pct, hi)}
      ${row(d.rowY, c.yieldRai, a.yieldRai, v => Math.round(v).toLocaleString(), (x, y) => x > y + 0.5)}
      ${row(d.rowF, c.total, a.total, v => v.toFixed(1), lo)}</table>
      <div class="verdict ${ok ? 'v-good' : 'v-mid'}" style="margin-top:8px">${esc(ok ? d.better : d.worse)}</div>
      <button type="button" class="preset applyBtn" onclick="applyAIPlan()">${esc(d.apply)}</button></div>`;
  }

  if (dash.tips.length) h += `<h4>${esc(d.tips)}</h4><ul class="tipList">` + dash.tips.map(x => `<li>${esc(x)}</li>`).join('') + `</ul>`;

  h += `<h4>${esc(d.ask)}</h4><div id="chatLog" class="chatLog">${chat.map(chatHTML).join('')}</div>
    <form class="askRow" onsubmit="event.preventDefault(); askAI();"><input id="askInput" maxlength="500" placeholder="${esc(d.askPh)}" autocomplete="off">
    <button type="submit" id="askBtn" class="askBtn">${esc(d.askBtn)}</button></form>
    <div class="hint" style="margin-top:10px">${esc(d.disclaimer)}${dashModel ? ' · ' + esc(d.model(dashModel)) : ''}</div>`;
  $('dashBody').innerHTML = h;
}
const chatHTML = m => `<div class="msg ${m.who}"><b>${esc(m.who === 'you' ? D().you : D().aiName)}</b><div>${esc(m.text)}</div></div>`;

function applyAIPlan() {
  if (!dash || !dash.plan.length) return;
  $('fertContainer').innerHTML = ''; fertCounter = 0;
  dash.plan.forEach(p => addFertRow(p.day, p.product, +(p.kg_per_rai / RAI * U()).toFixed(1)));
  calc();
  const n = document.createElement('div'); n.className = 'verdict v-good'; n.style.marginTop = '8px'; n.textContent = D().applied;
  document.querySelector('.applyBtn')?.after(n);
  if (typeof goStep === 'function') goStep(2); else $('fertContainer').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function askAI() {
  const q = $('askInput').value.trim(); if (!q || !last || aiBusy || coolingDown()) return;
  $('askInput').value = ''; aiBusy = true; setAIDisabled(true);
  chat.push({ who: 'you', text: q }, { who: 'ai', text: D().thinking });
  $('chatLog').innerHTML = chat.map(chatHTML).join('');
  try {
    const data = await callAI({ mode: 'ask', lang, context: buildAIContext(), question: q });
    chat[chat.length - 1].text = data.text;
  } catch (e) {
    chat[chat.length - 1].text = e.status === 429 ? D().limited(e.retryAfter, e.daily) : `${D().fail} (${e.message})`;
    if (e.status === 429) startCooldown(e.daily ? 300 : e.retryAfter);
  }
  $('chatLog').innerHTML = chat.map(chatHTML).join(''); aiBusy = false;
  if (!coolingDown()) setAIDisabled(false); $('askInput').focus();
}

function paintDashLabels() {
  const d = D();
  if (!coolingDown()) $('aiBtn').textContent = d.btn; $('dashTitle').textContent = d.title; $('dashSub').textContent = d.sub;
  $('dashRegen').textContent = d.regen; $('dashStale').textContent = d.stale;
}

// Hook into app.js: relabel on language change, flag the dashboard as stale when the simulation changes
const _setLang = setLang;
setLang = function (l) { _setLang(l); paintDashLabels(); renderDashboard(); };
const _calc = calc;
calc = function () { _calc(); if (dash && last) { $('dashStale').hidden = buildAIContext() === dashContext; renderDashboard(); } };
paintDashLabels();
