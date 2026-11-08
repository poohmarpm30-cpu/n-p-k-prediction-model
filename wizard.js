/**
 * wizard.js — step-by-step flow for NPK Soil Balance
 * Steps: project → field & soil → fertilizer plan → nutrient parameters → results → AI analysis.
 * A project name is required before any later step opens. Project details are saved in this browser
 * and sent to the AI with the simulation. Load after engine.js, app.js and dashboard.js.
 */

const STEPS = ['project', 'field', 'fert', 'params', 'results', 'ai'];
const WTR = {
th: { steps: ['โปรเจกต์', 'แปลงและดิน', 'แผนปุ๋ย', 'ค่าธาตุอาหาร', 'ผลลัพธ์', 'AI วิเคราะห์'],
  stepOf: (i, n) => `ขั้นตอนที่ ${i} จาก ${n}`,
  t_project: 'ตั้งชื่อโปรเจกต์', d_project: 'ใส่ชื่อโปรเจกต์ก่อนเริ่ม ชื่อนี้จะแสดงบนผลลัพธ์และส่งให้ AI ใช้ประกอบการวิเคราะห์',
  t_field: 'ข้อมูลแปลงและดิน', d_field: 'อายุข้าว ผลผลิตเป้าหมาย ชนิดดิน และผลวิเคราะห์ดินก่อนปลูก',
  t_fert: 'แผนการใส่ปุ๋ย', d_fert: 'เลือกแผนของกรมการข้าวเป็นจุดตั้งต้น แล้วแก้วันที่ สูตร และปริมาณได้',
  t_params: 'ค่าธาตุอาหาร (ไม่บังคับ)', d_params: 'ความต้องการของข้าว การปลดปล่อยจากดิน และการสูญเสียของแต่ละธาตุ',
  t_results: 'ผลลัพธ์', d_results: 'ข้าวได้รับธาตุอาหารพอหรือไม่ ผลผลิตโดยประมาณ และคำแนะนำการปรับแผนปุ๋ย',
  t_ai: 'AI วิเคราะห์', d_ai: 'ให้ Gemini สรุปผล ประเมินความเสี่ยง และเสนอแผนปุ๋ยใหม่ที่ตรวจด้วยโมเดลแล้ว',
  lblName: 'ชื่อโปรเจกต์', lblOwner: 'ผู้จัดทำ', lblPlace: 'พื้นที่ / จังหวัด', lblVariety: 'พันธุ์ข้าว', lblDate: 'วันที่', lblNote: 'หมายเหตุ', optional: '(ไม่บังคับ)',
  phName: 'เช่น แปลงนาสาธิต ต.ท่าโพธิ์ ฤดูนาปี 2569', errName: 'กรุณาใส่ชื่อโปรเจกต์ก่อนไปขั้นตอนถัดไป',
  paramsNote: 'ขั้นตอนนี้ข้ามได้ ถ้าไม่มีข้อมูลจากแปลงทดลอง ให้ใช้ค่าตั้งต้นที่อ้างอิงจากงานวิจัย กดแท็บ N, P, K เพื่อดูแต่ละธาตุ',
  aiIntro: 'AI จะอ่านผลจำลองของโปรเจกต์นี้ แล้วสรุปเป็นแดชบอร์ด พร้อมเสนอแผนปุ๋ยที่นำไปรันในโมเดลเพื่อตรวจผลให้ อาจใช้เวลา 10–40 วินาที',
  back: '← ย้อนกลับ', next: 'ถัดไป →', toResults: 'ดูผลลัพธ์ →', toAI: 'ให้ AI วิเคราะห์ →', start: 'เริ่ม →',
  mini: (y, lim, p) => `ผลผลิต ~${y} · ${lim} ${p}`, banner: 'โปรเจกต์', by: 'ผู้จัดทำ', at: 'พื้นที่', variety: 'พันธุ์', edit: 'แก้ไข' },
en: { steps: ['Project', 'Field & soil', 'Fertilizer plan', 'Nutrient settings', 'Results', 'AI analysis'],
  stepOf: (i, n) => `Step ${i} of ${n}`,
  t_project: 'Name your project', d_project: 'Enter a project name to begin. It appears on the results and is passed to the AI with the simulation.',
  t_field: 'Field and soil', d_field: 'Crop duration, target yield, soil type and the pre-planting soil test',
  t_fert: 'Fertilizer plan', d_fert: 'Start from a Rice Department plan, then edit the days, grades and amounts',
  t_params: 'Nutrient settings (optional)', d_params: 'Crop requirement, soil supply and losses for each nutrient',
  t_results: 'Results', d_results: 'Whether the crop gets enough of each nutrient, estimated yield, and how to adjust the plan',
  t_ai: 'AI analysis', d_ai: 'Gemini summarizes the results, flags risks and proposes a new plan that the model then checks',
  lblName: 'Project name', lblOwner: 'Prepared by', lblPlace: 'Location / province', lblVariety: 'Rice variety', lblDate: 'Date', lblNote: 'Notes', optional: '(optional)',
  phName: 'e.g. Tha Pho demonstration field, wet season 2026', errName: 'Enter a project name before going to the next step',
  paramsNote: 'You can skip this step. Without field trial data, keep the research-based defaults. Use the N, P, K tabs to view each nutrient.',
  aiIntro: 'The AI reads this project\'s simulation and builds a dashboard, including a fertilizer plan that is run through the model to check it. This can take 10–40 seconds.',
  back: '← Back', next: 'Next →', toResults: 'See results →', toAI: 'AI analysis →', start: 'Start →',
  mini: (y, lim, p) => `Yield ~${y} · ${lim} ${p}`, banner: 'Project', by: 'Prepared by', at: 'Location', variety: 'Variety', edit: 'Edit' },
zh: { steps: ['项目', '田块与土壤', '施肥方案', '养分参数', '结果', 'AI 分析'],
  stepOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
  t_project: '项目名称', d_project: '开始前请输入项目名称。名称会显示在结果中，并随模拟结果发送给 AI。',
  t_field: '田块与土壤', d_field: '生育期、目标产量、土壤类型和播前土壤测试',
  t_fert: '施肥方案', d_fert: '以泰国水稻厅方案为起点，再修改日期、肥料和用量',
  t_params: '养分参数（可选）', d_params: '各养分的作物需求、土壤供应和损失',
  t_results: '结果', d_results: '作物各养分是否充足、预估产量以及施肥方案调整建议',
  t_ai: 'AI 分析', d_ai: 'Gemini 总结结果、指出风险，并提出经模型检验的新方案',
  lblName: '项目名称', lblOwner: '编制人', lblPlace: '地点 / 府', lblVariety: '水稻品种', lblDate: '日期', lblNote: '备注', optional: '（可选）',
  phName: '例如：Tha Pho 示范田 2026 雨季', errName: '请先输入项目名称再进入下一步',
  paramsNote: '此步骤可跳过。若没有田间试验数据，请使用基于研究的默认值。点击 N、P、K 标签查看各养分。',
  aiIntro: 'AI 将读取本项目的模拟结果并生成仪表板，其中的施肥方案会放入模型中检验。可能需要 10–40 秒。',
  back: '← 上一步', next: '下一步 →', toResults: '查看结果 →', toAI: 'AI 分析 →', start: '开始 →',
  mini: (y, lim, p) => `产量 ~${y} · ${lim} ${p}`, banner: '项目', by: '编制人', at: '地点', variety: '品种', edit: '编辑' },
};
const W = () => WTR[lang] || WTR.en;
const PROJ_FIELDS = { name: 'projName', owner: 'projOwner', place: 'projPlace', variety: 'projVariety', date: 'projDate', note: 'projNote' };
let cur = 0, maxReached = 0;

function project() {
  const p = {}; for (const k in PROJ_FIELDS) p[k] = $(PROJ_FIELDS[k]).value.trim(); return p;
}
const projectValid = () => project().name.length > 0;
function saveProject() { try { localStorage.setItem('npk.project', JSON.stringify(project())); } catch (e) {} }
function loadProject() {
  let p = {}; try { p = JSON.parse(localStorage.getItem('npk.project') || '{}') || {}; } catch (e) {}
  for (const k in PROJ_FIELDS) if (typeof p[k] === 'string') $(PROJ_FIELDS[k]).value = p[k];
  if (!$('projDate').value) $('projDate').value = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

function goStep(target) {
  let i = typeof target === 'string' ? STEPS.indexOf(target) : target;
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  if (i > 0 && !projectValid()) {
    i = 0; $('projErr').hidden = false; $('projName').setAttribute('aria-invalid', 'true');
    if (cur !== 0) showStep(0);
    $('projName').focus(); return;
  }
  showStep(i);
}
function showStep(i, quiet) {
  cur = i; maxReached = Math.max(maxReached, i);
  STEPS.forEach((s, k) => { $('step-' + s).hidden = k !== i; });
  paintStepper(); paintNav(); paintProjectBits();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (STEPS[i] === 'results' && last) { showDetail(); }   // redraw the chart now that its card is visible
  const h = $('step-' + STEPS[i]).querySelector('h2'); if (h && !quiet) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function paintStepper() {
  const w = W(), ok = projectValid();
  $('stepper').innerHTML = STEPS.map((s, k) => {
    const state = k === cur ? 'cur' : (k <= maxReached && ok ? 'done' : '');
    const locked = k > 0 && !ok;
    return `<button type="button" class="stepItem ${state}" ${locked ? 'disabled' : ''} onclick="goStep(${k})" ${k === cur ? 'aria-current="step"' : ''}>
      <span class="stepNum">${state === 'done' ? '✓' : k + 1}</span><span class="stepLbl">${esc(w.steps[k])}</span></button>`;
  }).join('');
}
function paintNav() {
  const w = W();
  $('navBack').hidden = cur === 0; $('navBack').textContent = w.back;
  const nxt = $('navNext'); nxt.hidden = cur === STEPS.length - 1;
  nxt.textContent = cur === 0 ? w.start : STEPS[cur + 1] === 'results' ? w.toResults : STEPS[cur + 1] === 'ai' ? w.toAI : w.next;
  paintMini();
}
function paintMini() {
  const el = $('liveMini');
  if (!last || cur === 0 || STEPS[cur] === 'results') { el.textContent = ''; return; }
  const r = last.res[last.lim];
  el.textContent = W().mini(Math.round(last.yieldHa * U()).toLocaleString() + ' ' + uLabel(), last.lim, (r.ratio * 100).toFixed(0) + '%');
}
function paintProjectBits() {
  const w = W(), p = project();
  document.title = p.name ? `${p.name} · NPK Soil Balance` : 'NPK Soil Balance';
  const chip = $('projChip'); chip.hidden = !p.name || cur === 0;
  chip.innerHTML = `📁 ${esc(p.name)} <span>· ${esc(w.edit)}</span>`;
  const meta = [p.owner && `${w.by}: ${p.owner}`, p.place && `${w.at}: ${p.place}`, p.variety && `${w.variety}: ${p.variety}`, p.date].filter(Boolean);
  $('projBanner').innerHTML = p.name ? `<div class="dashLabel">${esc(w.banner)}</div><div class="pbName">${esc(p.name)}</div>` +
    (meta.length ? `<div class="hint">${meta.map(esc).join(' · ')}</div>` : '') + (p.note ? `<div class="hint">${esc(p.note)}</div>` : '') : '';
}
function paintWizardLabels() {
  const w = W();
  document.querySelectorAll('[data-w]').forEach(el => {
    const k = el.getAttribute('data-w');
    if (k === 'stepOf') { const i = +el.closest('.step').dataset.step; el.textContent = w.stepOf(i + 1, STEPS.length); }
    else if (typeof w[k] === 'string') el.textContent = w[k];
  });
  $('projName').placeholder = w.phName;
  paintStepper(); paintNav(); paintProjectBits();
}

// The AI gets the project details along with the simulation
const _buildAIContext = buildAIContext;
buildAIContext = function () {
  const p = project();
  const line = [`Project: ${p.name}`, p.place && `location: ${p.place}`, p.variety && `rice variety: ${p.variety}`, p.note && `notes: ${p.note}`].filter(Boolean).join('; ');
  return line + '\n' + _buildAIContext();
};
// Repaint on language change; refresh the live summary after every calculation
const _setLangW = setLang;
setLang = function (l) { _setLangW(l); paintWizardLabels(); };
const _calcW = calc;
calc = function () { _calcW(); paintMini(); };

// ---------- boot ----------
loadProject();
Object.values(PROJ_FIELDS).forEach(id => $(id).addEventListener('input', () => {
  if (projectValid()) { $('projErr').hidden = true; $('projName').removeAttribute('aria-invalid'); }
  saveProject(); paintStepper(); paintProjectBits();
}));
$('projName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goStep(1); } });
paintWizardLabels();
showStep(0, true);
if (!projectValid()) $('projName').focus({ preventScroll: true });
