/**
 * app.js — NPK Soil Balance: user interface, i18n, charts, recommendations, AI analysis
 * Requires engine.js and Chart.js 4.4.1 loaded first.
 */
const RAI=0.16;               // 1 rai = 0.16 ha → kg/rai = kg/ha × 0.16
const P2O5_TO_P=0.436, K2O_TO_K=0.830;
const TARGET=0.98;            // uptake ratio regarded as fully supplied
const NUTRIENTS=['N','P','K'];
const FERT_PRODUCTS={
  '46-0-0':{n:46,p:0,k:0,name:'Urea'},'21-0-0':{n:21,p:0,k:0,name:'Amm. sulfate'},'25-0-0':{n:25,p:0,k:0,name:'Amm. chloride'},
  '0-46-0':{n:0,p:46,k:0,name:'TSP'},'0-20-0':{n:0,p:20,k:0,name:'SSP'},'0-3-0':{n:0,p:3,k:0,name:'Rock phosphate',slow:true},
  '0-0-60':{n:0,p:0,k:60,name:'KCl (MOP)'},'0-0-50':{n:0,p:0,k:50,name:'K₂SO₄ (SOP)'},
  '16-20-0':{n:16,p:20,k:0},'20-20-0':{n:20,p:20,k:0},'18-46-0':{n:18,p:46,k:0,name:'DAP'},'11-52-0':{n:11,p:52,k:0,name:'MAP'},
  '16-16-8':{n:16,p:16,k:8},'16-8-8':{n:16,p:8,k:8},'16-12-8':{n:16,p:12,k:8},'12-16-8':{n:12,p:16,k:8},'18-12-6':{n:18,p:12,k:6},
  '15-15-15':{n:15,p:15,k:15},'15-5-20':{n:15,p:5,k:20},'25-7-4':{n:25,p:7,k:4},'20-8-20':{n:20,p:8,k:20},'13-13-21':{n:13,p:13,k:21},
  'custom':{n:null,p:null,k:null}
};
// Per-nutrient defaults. req = kg nutrient taken up per tonne grain (QUEFTS, China rice); t0/k shape the uptake curve.
const DEFAULTS={ N:{req:20,t0:45,k:0.08,supply:40,imm:0.11},
                 P:{req:3.5,t0:45,k:0.08,supply:4},
                 K:{req:20,t0:55,k:0.07,supply:30} };
// Daily loss (N, K) and P fixation by soil texture — calibrated so the Rice Dept rate on clay is just sufficient and N losses are ~25–35% of applied.
const SOIL={ sandy:{N:0.05,P:0.004,K:0.012}, loam:{N:0.032,P:0.008,K:0.006}, clay:{N:0.022,P:0.012,K:0.002} };
// Rice Department presets, kg product per rai
const PRESETS={
  npsClay:[{d:0,p:'16-20-0',a:30},{d:30,p:'46-0-0',a:10},{d:50,p:'46-0-0',a:10}],
  npsLoam:[{d:0,p:'16-16-8',a:30},{d:30,p:'46-0-0',a:10},{d:50,p:'46-0-0',a:10}],
  psClay:[{d:0,p:'16-20-0',a:25},{d:35,p:'46-0-0',a:5},{d:60,p:'46-0-0',a:5}],
  psLoam:[{d:0,p:'16-16-8',a:25},{d:35,p:'46-0-0',a:5},{d:60,p:'46-0-0',a:5}]
};

const TR={
th:{heroTitle:'🌾 เครื่องจำลองสมดุล N-P-K ในนาข้าว',heroSub:'จำลองรายวันว่าธาตุอาหารจากดินและปุ๋ยพอให้ข้าวดูดใช้หรือไม่ หายไปเท่าไร และควรปรับแผนปุ๋ยอย่างไร',
 cardField:'ข้อมูลแปลงและดิน',lblUnit:'หน่วยปุ๋ยและผลผลิต',lblDur:'อายุข้าว (วันหลังปักดำ/หว่าน)',lblYmax:'ผลผลิตเป้าหมาย',hintYmax:'ผลผลิตที่ได้เมื่อธาตุอาหารไม่จำกัด ใช้กำหนดปริมาณที่ข้าวต้องดูด',
 lblSoilType:'ชนิดดิน',soilClay:'ดินเหนียว',soilLoam:'ดินร่วน',soilSandy:'ดินทราย / ร่วนปนทราย',soilCustom:'กำหนดเอง',hintSoilType:'กำหนดอัตราสูญเสีย N, K และการตรึง P ของทั้ง 3 ธาตุ',
 soilTestTitle:'ผลวิเคราะห์ดินก่อนปลูก',lblInitN:'N อนินทรีย์ในดิน (kg N/ha)',hintInitN:'ไนโตรเจนที่ใช้ได้ทันทีตอนเริ่มปลูก มักอยู่ราว 5–20 kg/ha',lblPpmP:'ฟอสฟอรัสที่เป็นประโยชน์ (ppm)',lblPpmK:'โพแทสเซียมที่แลกเปลี่ยนได้ (ppm)',lblPpmF:'ตัวแปลง ppm → kg/ha',hintPpmF:'ดินลึก 15 ซม. ความหนาแน่น 1.5 g/cm³ → 1 ppm ≈ 2.25 kg/ha',
 cardFert:'แผนการใส่ปุ๋ย',presetHint:'เลือกคำแนะนำของกรมการข้าวเป็นจุดตั้งต้น แล้วแก้ไขได้',pNpsClay:'ไม่ไวแสง · ดินเหนียว',pNpsLoam:'ไม่ไวแสง · ดินร่วน/ทราย',pPsClay:'ไวแสง · ดินเหนียว',pPsLoam:'ไวแสง · ดินร่วน/ทราย',
 colDay:'วันที่ใส่',addFertBtn:'➕ เพิ่มรายการใส่ปุ๋ย',dose:n=>`ครั้งที่ ${n}`,rmBtn:'✕ ลบ',contrib:(n,p,k,u)=>`→ ให้ N ${n} · P ${p} · K ${k} ${u} (ธาตุบริสุทธิ์)`,
 nutName:{N:'ไนโตรเจน (N)',P:'ฟอสฟอรัส (P)',K:'โพแทสเซียม (K)'},
 cardUptake:'ความต้องการของข้าว',lblReq:'ปริมาณที่ดูดต่อผลผลิต 1 ตัน (kg/t)',hintReq:'N ≈ 19–21, P ≈ 3.5–4.1, K ≈ 20–22 kg ต่อเมล็ด 1 ตัน',lblUmax:'ปริมาณที่ต้องดูดทั้งฤดู (kg/ha)',lblT0:'t0 — วันที่ดูดเร็วที่สุด',hintT0:'มักใกล้ระยะกำเนิดช่อดอก',lblK:'k — ความชันของเส้นโค้ง',
 cardSoil:'ดิน การปลดปล่อย และการสูญเสีย',lblInit:'ปริมาณที่ใช้ได้ในดินตอนเริ่ม (kg/ha)',hintInitFromTest:'คำนวณจากผลวิเคราะห์ดินด้านบน',lblSupply:'ดินปลดปล่อยตลอดฤดู (kg/ha)',hintSupply:'จากการย่อยสลายอินทรียวัตถุ น้ำชลประทาน ฯลฯ ประเมินได้จากแปลงที่ไม่ใส่ธาตุนั้น',
 lblImm:'สัดส่วน N ระเหยทันทีเมื่อใส่',hintImm:'หว่านยูเรียบนผิวน้ำ: แอมโมเนียระเหยราว 11% ของ N ที่ใส่ (สุพรรณบุรี)',lblLossN:'อัตราสูญเสียต่อวัน (denitrification/ชะล้าง)',lblFix:'อัตราการตรึง P ต่อวัน',hintFix:'P แทบไม่ถูกชะล้าง แต่ถูกดินตรึงจนพืชใช้ไม่ได้',lblLossK:'อัตราชะล้างต่อวัน',hintLoss:'สัดส่วนของปริมาณในดินที่หายไปต่อวัน',
 calcBtn:'คำนวณ',warnRow:(i,why)=>`รายการที่ ${i}: ${why}`,whyDay:d=>`วันที่ไม่ถูกต้อง ต้องเป็นจำนวนเต็ม 0–${d}`,whyRounded:(a,b)=>`ปัดวันที่ ${a} เป็น ${b}`,whyAmt:'ปริมาณปุ๋ยต้องเป็นตัวเลข ≥ 0',warnSkipped:'รายการที่มีปัญหาไม่ถูกนำมาคำนวณ',warnNums:'กรุณากรอกค่าตัวเลขให้ครบ',
 resTitle:'สรุปผลทั้งแปลง',seeDetail:'ดูรายละเอียด ↓',uptakeOf:'ข้าวได้รับ',ofNeed:'ของที่ต้องการ',stressD:d=>`ขาด ${d} วัน`,yieldTitle:'ผลผลิตโดยประมาณ',
 yieldNote:(lim,pct)=>`ธาตุที่จำกัดผลผลิต: ${lim} (ได้รับ ${pct}% ของที่ต้องการ) · คิดตามหลักปัจจัยจำกัด ผลผลิต = เป้าหมาย × สัดส่วนที่ได้รับของธาตุที่ขาดมากที่สุด · เป็นค่าประมาณเพื่อเปรียบเทียบแผนปุ๋ย`,
 recTitle:'คำแนะนำการปรับแผนปุ๋ย',recAdd:(nut,el,prod,amt,u,days)=>`⚠️ ${nut}: ยังไม่พอ ต้องเพิ่มธาตุ ${el} ${u} → ${prod} ประมาณ <b>${amt} ${u}</b> ${days}`,recAddDaysN:(a,b,c)=>`แบ่งใส่วันที่ ${a}, ${b} และ ${c}`,recAddDaysP:'ใส่รองพื้นวันที่ 0',recAddDaysK:(a)=>`แบ่งใส่วันที่ 0 และ ${a}`,
 recNone:nut=>`✅ ${nut}: ดินให้พอแล้ว ไม่จำเป็นต้องใส่ปุ๋ยธาตุนี้`,recOk:nut=>`✅ ${nut}: แผนปัจจุบันพอดี`,recCut:(nut,pct,el,u)=>`💧 ${nut}: ใส่เกินความต้องการ ลดได้ราว ${pct}% (≈ ${el} ${u} ของธาตุ) โดยข้าวยังได้รับครบ`,recNoneCut:nut=>`💧 ${nut}: ดินให้พออยู่แล้ว ปุ๋ยส่วนนี้ไม่ช่วยเพิ่มผลผลิต งดได้`,
 recImpossible:nut=>`❌ ${nut}: เพิ่มปุ๋ยแล้วยังไม่พอ ตรวจค่าการสูญเสียหรือความต้องการอีกครั้ง`,recPriority:nut=>`ควรแก้ ${nut} ก่อน เพราะเป็นธาตุที่จำกัดผลผลิต`,recAllGood:'ทุกธาตุเพียงพอ ไม่มีธาตุใดจำกัดผลผลิต',
 recResidual:(nut,v,u)=>`ℹ️ ${nut} เหลือในดินหลังเก็บเกี่ยว ${v} ${u} ส่วนนี้อาจสูญเสียก่อนฤดูถัดไป`,
 aiBtn:'🤖 ให้ AI วิเคราะห์ผลแบบเจาะลึก',aiLoading:'🤖 กำลังวิเคราะห์...',aiUnavailable:'ใช้ AI วิเคราะห์ไม่ได้ในขณะนี้ ลองใหม่อีกครั้ง',aiBusy:'มีการเรียกใช้ถี่เกินไป ลองใหม่ภายหลัง',
 aiPrompt:ctx=>`คุณเป็นผู้เชี่ยวชาญด้านปฐพีวิทยาและการจัดการปุ๋ยนาข้าวในประเทศไทย วิเคราะห์ผลจำลองสมดุลธาตุอาหาร N-P-K ต่อไปนี้ เขียนเป็นภาษาไทยราว 200–250 คำ ครอบคลุม 1) ภาพรวมว่าธาตุใดพอ/ขาด/เกิน 2) จุดอ่อนของแผนปุ๋ยนี้ (ปริมาณ ช่วงเวลา ชนิดปุ๋ย) 3) คำแนะนำเชิงปฏิบัติ ระบุปริมาณเป็น กก./ไร่ 4) ข้อจำกัดของผลจำลองที่ควรตรวจในแปลงจริง เขียนข้อความธรรมดา ไม่ใช้หัวข้อ markdown\n\nข้อมูล:\n${ctx}`,
 detailHeader:n=>`รายละเอียด — ${n}`,sFert:'ปุ๋ยที่ใส่',sUp:'ข้าวดูดได้',sNeed:'ต้องการ',sLoss:'สูญเสีย',sFix:'ถูกตรึง',sResid:'เหลือหลังเก็บเกี่ยว',sRE:'ประสิทธิภาพปุ๋ย (RE)',sStress:'วันที่ขาด (ช่วงวิกฤต)',
 tabLine:'📈 ตามเวลา',tabBar:'📊 สมดุล',tabPie:'🥧 ปลายทาง',axisX:'วันหลังปักดำ/หว่าน',legSoil:'คงเหลือในดิน',legUp:'ข้าวดูดสะสม',legDem:'ความต้องการสะสม',
 barIn:'ขาเข้า',barOut:'ขาออก',barLabels:['ในดินตอนเริ่ม','ดินปลดปล่อย','ปุ๋ย','ข้าวดูด','สูญเสีย','ถูกตรึง','เหลือในดิน'],pieLabels:['ข้าวดูดไป','สูญเสียสู่สิ่งแวดล้อม','ถูกดินตรึง','เหลือในดิน'],
 fieldTitle:'🌾 จำลองแปลงนา',fieldPctLabel:'ข้าวได้รับเทียบกับที่ต้องการ',fieldMsg:(st,cr)=>`ขาดธาตุนี้ ${st} วัน (${cr} วันในช่วงวิกฤต t0 ± 15 วัน)`,
 vGood:'✅ เพียงพอ',vMid:'⚠️ ขาดเล็กน้อย ผลผลิตลดลงบางส่วน',vLow:'❌ ขาดมาก ผลผลิตลดลงชัดเจน',vExcess:'💧 ได้รับครบ แต่ใส่เกิน เสี่ยงสูญเสีย',
 tblDay:'วัน',tblFert:'ปุ๋ย',tblDem:'ต้องการสะสม',tblUp:'ดูดสะสม',tblSoil:'ในดิน',
 srcTitle:'ที่มาของค่าตั้งต้นและข้อจำกัด',
 srcBody:`<p>• ปริมาณที่ข้าวดูดต่อผลผลิต 1 ตัน: N 19–21, P 3.5–4.1, K 20–22 kg (QUEFTS, <a href="https://www.chinaagrisci.com/Jwk_zgnykxen/EN/abstract/abstract10458.shtml" target="_blank" rel="noopener">Journal of Integrative Agriculture</a>)</p><p>• แอมโมเนียระเหย 11% และ N หายไปรวม ~25% ของยูเรียที่หว่านในนาดำ ชุดดินพิมาย สุพรรณบุรี (<a href="https://li01.tci-thaijo.org/index.php/thaiagriculturalresearch/article/view/219374" target="_blank" rel="noopener">วารสารวิชาการเกษตร</a>)</p><p>• แผนปุ๋ยสำเร็จรูปตามคำแนะนำกรมการข้าว (<a href="https://newwebs2.ricethailand.go.th/webmain/rkb3/w.pdf" target="_blank" rel="noopener">ricethailand.go.th</a>)</p><p>• อัตราสูญเสีย/ตรึงตามชนิดดินและการปลดปล่อยจากดินเป็นค่าที่ปรับเทียบให้ผลสมเหตุสมผล ไม่ได้วัดจากแปลงจริง ควรแทนด้วยค่าจากแปลงทดลอง (เช่น แปลงไม่ใส่ N/P/K)</p><p>• หินฟอสเฟตปลดปล่อย P ช้า ราว 3% ต่อวันของส่วนที่เหลือ · ไม่รวมผลของน้ำท่วมขัง/ระบายน้ำ ฟางข้าว และปุ๋ยอินทรีย์</p>`},
en:{heroTitle:'🌾 Rice N-P-K Soil Balance Simulator',heroSub:'Simulates day by day whether soil and fertilizer supply meet rice uptake, how much is lost, and how to adjust the plan',
 cardField:'Field and soil',lblUnit:'Fertilizer and yield unit',lblDur:'Crop duration (days after transplanting/sowing)',lblYmax:'Target yield',hintYmax:'Yield when no nutrient limits growth; sets how much the crop must take up',
 lblSoilType:'Soil type',soilClay:'Clay',soilLoam:'Loam',soilSandy:'Sandy / sandy loam',soilCustom:'Custom',hintSoilType:'Sets N and K loss and P fixation for all three nutrients',
 soilTestTitle:'Pre-planting soil test',lblInitN:'Soil mineral N (kg N/ha)',hintInitN:'N available at planting, usually 5–20 kg/ha',lblPpmP:'Available P (ppm)',lblPpmK:'Exchangeable K (ppm)',lblPpmF:'ppm → kg/ha factor',hintPpmF:'15 cm depth, bulk density 1.5 g/cm³ → 1 ppm ≈ 2.25 kg/ha',
 cardFert:'Fertilizer plan',presetHint:'Start from a Rice Department recommendation, then edit',pNpsClay:'Non-photoperiod · clay',pNpsLoam:'Non-photoperiod · loam/sand',pPsClay:'Photoperiod · clay',pPsLoam:'Photoperiod · loam/sand',
 colDay:'Day',addFertBtn:'➕ Add application',dose:n=>`Application ${n}`,rmBtn:'✕ Remove',contrib:(n,p,k,u)=>`→ supplies N ${n} · P ${p} · K ${k} ${u} (elemental)`,
 nutName:{N:'Nitrogen (N)',P:'Phosphorus (P)',K:'Potassium (K)'},
 cardUptake:'Crop requirement',lblReq:'Uptake per tonne grain (kg/t)',hintReq:'N ≈ 19–21, P ≈ 3.5–4.1, K ≈ 20–22 kg per tonne grain',lblUmax:'Season uptake requirement (kg/ha)',lblT0:'t0 — day of fastest uptake',hintT0:'Usually near panicle initiation',lblK:'k — curve steepness',
 cardSoil:'Soil supply and losses',lblInit:'Available in soil at start (kg/ha)',hintInitFromTest:'Calculated from the soil test above',lblSupply:'Soil supply over the season (kg/ha)',hintSupply:'From organic matter, irrigation water, etc.; estimate from an omission plot',
 lblImm:'Share of N volatilized on application',hintImm:'Urea broadcast on floodwater: ~11% of applied N lost as ammonia (Suphan Buri)',lblLossN:'Daily loss rate (denitrification/leaching)',lblFix:'Daily P fixation rate',hintFix:'P barely leaches but is fixed by the soil',lblLossK:'Daily leaching rate',hintLoss:'Share of the soil pool lost per day',
 calcBtn:'Calculate',warnRow:(i,why)=>`Row ${i}: ${why}`,whyDay:d=>`invalid day, must be a whole number 0–${d}`,whyRounded:(a,b)=>`day ${a} rounded to ${b}`,whyAmt:'amount must be a number ≥ 0',warnSkipped:'Rows with problems were left out of the calculation',warnNums:'Please fill in all numeric fields',
 resTitle:'Field summary',seeDetail:'See details ↓',uptakeOf:'Crop received',ofNeed:'of requirement',stressD:d=>`${d} days short`,yieldTitle:'Estimated yield',
 yieldNote:(lim,pct)=>`Limiting nutrient: ${lim} (${pct}% of requirement) · Law of the minimum: yield = target × supply ratio of the most limiting nutrient · An estimate for comparing plans`,
 recTitle:'How to adjust the fertilizer plan',recAdd:(nut,el,prod,amt,u,days)=>`⚠️ ${nut}: short — add ${el} ${u} elemental → about <b>${amt} ${u}</b> of ${prod} ${days}`,recAddDaysN:(a,b,c)=>`split on days ${a}, ${b} and ${c}`,recAddDaysP:'as basal on day 0',recAddDaysK:a=>`split on days 0 and ${a}`,
 recNone:nut=>`✅ ${nut}: the soil supplies enough; no fertilizer needed for this nutrient`,recOk:nut=>`✅ ${nut}: the current plan fits`,recCut:(nut,pct,el,u)=>`💧 ${nut}: more than needed — cut about ${pct}% (≈ ${el} ${u} elemental) with no loss of uptake`,recNoneCut:nut=>`💧 ${nut}: the soil already supplies enough; this fertilizer adds no yield and can be dropped`,
 recImpossible:nut=>`❌ ${nut}: still short even with more fertilizer; check the loss and requirement values`,recPriority:nut=>`Fix ${nut} first — it limits yield`,recAllGood:'All nutrients are sufficient; none limits yield',
 recResidual:(nut,v,u)=>`ℹ️ ${nut} left in soil after harvest: ${v} ${u}, which may be lost before next season`,
 aiBtn:'🤖 Get in-depth AI analysis',aiLoading:'🤖 Analyzing...',aiUnavailable:'AI analysis is unavailable right now. Please try again.',aiBusy:'Too many requests; try again later',
 aiPrompt:ctx=>`You are a soil scientist and rice fertilizer expert for Thailand. Analyze this N-P-K soil balance simulation in English, about 200–250 words, covering: 1) which nutrients are sufficient, short or in excess 2) weaknesses of this plan (rates, timing, products) 3) practical recommendations with rates in kg/rai and kg/ha 4) limits of the simulation to verify in the field. Plain text, no markdown headers.\n\nData:\n${ctx}`,
 detailHeader:n=>`Details — ${n}`,sFert:'Fertilizer applied',sUp:'Crop uptake',sNeed:'Requirement',sLoss:'Lost',sFix:'Fixed',sResid:'Left after harvest',sRE:'Fertilizer recovery (RE)',sStress:'Days short (critical)',
 tabLine:'📈 Over time',tabBar:'📊 Balance',tabPie:'🥧 Fate',axisX:'Days after transplanting/sowing',legSoil:'Available in soil',legUp:'Cumulative uptake',legDem:'Cumulative requirement',
 barIn:'Inputs',barOut:'Outputs',barLabels:['Initial soil','Soil supply','Fertilizer','Crop uptake','Lost','Fixed','Left in soil'],pieLabels:['Crop uptake','Lost to environment','Fixed by soil','Left in soil'],
 fieldTitle:'🌾 Field view',fieldPctLabel:'Crop received vs requirement',fieldMsg:(st,cr)=>`Short of this nutrient on ${st} days (${cr} in the critical window t0 ± 15 days)`,
 vGood:'✅ Sufficient',vMid:'⚠️ Slightly short — some yield loss',vLow:'❌ Seriously short — clear yield loss',vExcess:'💧 Fully supplied but over-applied — loss risk',
 tblDay:'Day',tblFert:'Fert.',tblDem:'Need (cum)',tblUp:'Uptake (cum)',tblSoil:'In soil',
 srcTitle:'Sources of defaults and limitations',
 srcBody:`<p>• Uptake per tonne grain: N 19–21, P 3.5–4.1, K 20–22 kg (QUEFTS, <a href="https://www.chinaagrisci.com/Jwk_zgnykxen/EN/abstract/abstract10458.shtml" target="_blank" rel="noopener">Journal of Integrative Agriculture</a>)</p><p>• 11% ammonia loss and ~25% total loss of broadcast urea in transplanted rice, Phimai soil, Suphan Buri (<a href="https://li01.tci-thaijo.org/index.php/thaiagriculturalresearch/article/view/219374" target="_blank" rel="noopener">Thai Agricultural Research Journal</a>)</p><p>• Preset plans from the Thai Rice Department (<a href="https://newwebs2.ricethailand.go.th/webmain/rkb3/w.pdf" target="_blank" rel="noopener">ricethailand.go.th</a>)</p><p>• Soil-type loss/fixation rates and soil supply are calibrated to give plausible results, not field measurements; replace them with omission-plot data where possible</p><p>• Rock phosphate releases ~3% of the remaining amount per day · Flooding/drainage, straw and organic inputs are not modeled</p>`},
zh:{heroTitle:'🌾 水稻氮磷钾土壤平衡模拟器',heroSub:'逐日模拟土壤和肥料供应能否满足水稻吸收、损失多少，以及如何调整施肥方案',
 cardField:'田块与土壤',lblUnit:'肥料与产量单位',lblDur:'生育期（移栽/播种后天数）',lblYmax:'目标产量',hintYmax:'养分不受限时的产量，用于确定作物需吸收量',
 lblSoilType:'土壤类型',soilClay:'黏土',soilLoam:'壤土',soilSandy:'砂土 / 砂壤土',soilCustom:'自定义',hintSoilType:'设定三种养分的氮钾损失率和磷固定率',
 soilTestTitle:'播前土壤测试',lblInitN:'土壤矿质氮 (kg N/ha)',hintInitN:'种植时可立即利用的氮，通常 5–20 kg/ha',lblPpmP:'有效磷 (ppm)',lblPpmK:'交换性钾 (ppm)',lblPpmF:'ppm → kg/ha 换算系数',hintPpmF:'土层 15 cm，容重 1.5 g/cm³ → 1 ppm ≈ 2.25 kg/ha',
 cardFert:'施肥方案',presetHint:'以泰国水稻厅推荐为起点，可再修改',pNpsClay:'非感光 · 黏土',pNpsLoam:'非感光 · 壤土/砂土',pPsClay:'感光 · 黏土',pPsLoam:'感光 · 壤土/砂土',
 colDay:'天数',addFertBtn:'➕ 添加施肥',dose:n=>`第 ${n} 次`,rmBtn:'✕ 删除',contrib:(n,p,k,u)=>`→ 提供 N ${n} · P ${p} · K ${k} ${u}（纯养分）`,
 nutName:{N:'氮 (N)',P:'磷 (P)',K:'钾 (K)'},
 cardUptake:'作物需求',lblReq:'每吨籽粒吸收量 (kg/t)',hintReq:'N ≈ 19–21，P ≈ 3.5–4.1，K ≈ 20–22 kg/吨',lblUmax:'全季需吸收量 (kg/ha)',lblT0:'t0 — 吸收最快日',hintT0:'通常接近幼穗分化期',lblK:'k — 曲线陡度',
 cardSoil:'土壤供应与损失',lblInit:'初始土壤有效量 (kg/ha)',hintInitFromTest:'由上方土壤测试计算',lblSupply:'全季土壤供应量 (kg/ha)',hintSupply:'来自有机质矿化、灌溉水等；可用缺素小区估算',
 lblImm:'施用时氮挥发比例',hintImm:'尿素撒施于田面水：约 11% 以氨挥发损失（素攀武里）',lblLossN:'日损失率（反硝化/淋溶）',lblFix:'日磷固定率',hintFix:'磷几乎不淋溶，但会被土壤固定',lblLossK:'日淋溶率',hintLoss:'土壤库每日损失比例',
 calcBtn:'计算',warnRow:(i,why)=>`第 ${i} 行：${why}`,whyDay:d=>`天数无效，须为 0–${d} 的整数`,whyRounded:(a,b)=>`天数 ${a} 已取整为 ${b}`,whyAmt:'用量须为 ≥ 0 的数字',warnSkipped:'有问题的行未参与计算',warnNums:'请填写所有数值字段',
 resTitle:'田块汇总',seeDetail:'查看详情 ↓',uptakeOf:'作物获得',ofNeed:'占需求',stressD:d=>`缺 ${d} 天`,yieldTitle:'预估产量',
 yieldNote:(lim,pct)=>`限制性养分：${lim}（获得需求的 ${pct}%）· 最小因子定律：产量 = 目标 × 最缺养分的供应比例 · 用于比较方案的估算值`,
 recTitle:'施肥方案调整建议',recAdd:(nut,el,prod,amt,u,days)=>`⚠️ ${nut}：不足——需补充纯养分 ${el} ${u} → ${prod} 约 <b>${amt} ${u}</b>，${days}`,recAddDaysN:(a,b,c)=>`分别于第 ${a}、${b}、${c} 天施用`,recAddDaysP:'第 0 天作基肥',recAddDaysK:a=>`于第 0 天和第 ${a} 天分施`,
 recNone:nut=>`✅ ${nut}：土壤供应已足够，无需施用该养分`,recOk:nut=>`✅ ${nut}：当前方案合适`,recCut:(nut,pct,el,u)=>`💧 ${nut}：超过需求——可减少约 ${pct}%（≈ 纯养分 ${el} ${u}），吸收不受影响`,recNoneCut:nut=>`💧 ${nut}：土壤已足够，这部分肥料不增产，可省去`,
 recImpossible:nut=>`❌ ${nut}：增加肥料后仍不足，请检查损失和需求参数`,recPriority:nut=>`应优先解决 ${nut}——它限制产量`,recAllGood:'所有养分充足，无限制产量的养分',
 recResidual:(nut,v,u)=>`ℹ️ 收获后土壤残留 ${nut} ${v} ${u}，下季前可能损失`,
 aiBtn:'🤖 获取 AI 深度分析',aiLoading:'🤖 分析中...',aiUnavailable:'AI 分析暂时不可用，请稍后再试',aiBusy:'请求过于频繁，请稍后再试',
 aiPrompt:ctx=>`你是泰国水稻土壤与施肥专家。请用中文分析以下氮磷钾土壤平衡模拟结果，约 200–250 字，涵盖：1）哪些养分充足、不足或过量 2）该方案的不足（用量、时期、肥料种类）3）实用建议，用量以 kg/莱 和 kg/ha 表示 4）需要在田间核实的模拟局限。纯文本，不用 markdown 标题。\n\n数据：\n${ctx}`,
 detailHeader:n=>`详情 — ${n}`,sFert:'施肥量',sUp:'作物吸收',sNeed:'需求',sLoss:'损失',sFix:'固定',sResid:'收获后残留',sRE:'肥料回收率 (RE)',sStress:'缺乏天数（关键期）',
 tabLine:'📈 随时间',tabBar:'📊 平衡',tabPie:'🥧 去向',axisX:'移栽/播种后天数',legSoil:'土壤有效量',legUp:'累积吸收',legDem:'累积需求',
 barIn:'输入',barOut:'输出',barLabels:['初始土壤','土壤供应','肥料','作物吸收','损失','固定','土壤残留'],pieLabels:['作物吸收','损失至环境','被土壤固定','土壤残留'],
 fieldTitle:'🌾 田块模拟',fieldPctLabel:'作物获得 / 需求',fieldMsg:(st,cr)=>`该养分不足 ${st} 天（关键期 t0 ± 15 天内 ${cr} 天）`,
 vGood:'✅ 充足',vMid:'⚠️ 略缺——部分减产',vLow:'❌ 严重缺乏——明显减产',vExcess:'💧 供应充足但施用过量——有损失风险',
 tblDay:'天',tblFert:'施肥',tblDem:'累积需求',tblUp:'累积吸收',tblSoil:'土壤',
 srcTitle:'默认值来源与局限',
 srcBody:`<p>• 每吨籽粒吸收量：N 19–21、P 3.5–4.1、K 20–22 kg（QUEFTS，<a href="https://www.chinaagrisci.com/Jwk_zgnykxen/EN/abstract/abstract10458.shtml" target="_blank" rel="noopener">Journal of Integrative Agriculture</a>）</p><p>• 移栽稻撒施尿素氨挥发 11%、总损失约 25%，素攀武里 Phimai 土系（<a href="https://li01.tci-thaijo.org/index.php/thaiagriculturalresearch/article/view/219374" target="_blank" rel="noopener">泰国农业研究期刊</a>）</p><p>• 预设方案来自泰国水稻厅（<a href="https://newwebs2.ricethailand.go.th/webmain/rkb3/w.pdf" target="_blank" rel="noopener">ricethailand.go.th</a>）</p><p>• 各土壤类型的损失/固定率与土壤供应量为校准值，非田间实测，建议用缺素小区数据替换</p><p>• 磷矿粉每日释放剩余量的约 3% · 未模拟淹水/排水、秸秆和有机肥</p>`}
};

let lang='th', unit='rai', active='N', chartType='line', chart=null, fertCounter=0, last=null, autoTimer=null;
const T=()=>TR[lang];
const U=()=>unit==='rai'?RAI:1;               // multiply kg/ha by this to display
const uLabel=()=>unit==='rai'?(lang==='zh'?'kg/莱':(lang==='en'?'kg/rai':'กก./ไร่')):'kg/ha';
const fmt=(v,d=1)=>(Math.abs(v)<0.05?0:v).toFixed(d);
const $=id=>document.getElementById(id);
const num=id=>parseFloat($(id).value);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function buildPanels(){
  const c=$('nutrientPanels'); c.innerHTML='';
  NUTRIENTS.forEach(n=>{
    const d=DEFAULTS[n];
    const lossField = n==='N'
      ? `<div><label for="imm_N" data-i18n="lblImm"></label><input id="imm_N" type="number" step="0.01" value="${d.imm}"><div class="hint" data-i18n="hintImm"></div></div>
         <div><label for="loss_N" data-i18n="lblLossN"></label><input id="loss_N" type="number" step="0.001"><div class="hint" data-i18n="hintLoss"></div></div>`
      : n==='P'
      ? `<div><label for="loss_P" data-i18n="lblFix"></label><input id="loss_P" type="number" step="0.001"><div class="hint" data-i18n="hintFix"></div></div>`
      : `<div><label for="loss_K" data-i18n="lblLossK"></label><input id="loss_K" type="number" step="0.001"><div class="hint" data-i18n="hintLoss"></div></div>`;
    const initField = n==='N'
      ? `<div><label for="init_N" data-i18n="lblInit"></label><input id="init_N" type="number" readonly><div class="hint" data-i18n="hintInitFromTest"></div></div>`
      : `<div><label for="init_${n}" data-i18n="lblInit"></label><input id="init_${n}" type="number" readonly><div class="hint" data-i18n="hintInitFromTest"></div></div>`;
    const el=document.createElement('div'); el.id='panel_'+n; el.hidden=n!=='N';
    el.innerHTML=`<div class="card"><h3><span data-i18n="cardUptake"></span> · ${n}</h3><div class="grid">
        <div><label for="req_${n}" data-i18n="lblReq"></label><input id="req_${n}" type="number" step="0.1" value="${d.req}"><div class="hint" data-i18n="hintReq"></div></div>
        <div><label for="umax_${n}" data-i18n="lblUmax"></label><input id="umax_${n}" type="number" readonly></div>
        <div><label for="t0_${n}" data-i18n="lblT0"></label><input id="t0_${n}" type="number" value="${d.t0}"><div class="hint" data-i18n="hintT0"></div></div>
        <div><label for="k_${n}" data-i18n="lblK"></label><input id="k_${n}" type="number" step="0.01" value="${d.k}"></div></div></div>
      <div class="card"><h3><span data-i18n="cardSoil"></span> · ${n}</h3><div class="grid">
        ${initField}
        <div><label for="supply_${n}" data-i18n="lblSupply"></label><input id="supply_${n}" type="number" value="${d.supply}"><div class="hint" data-i18n="hintSupply"></div></div>
        ${lossField}</div></div>`;
    c.appendChild(el);
  });
}
function applySoilType(){
  const v=$('soilType').value; if(!SOIL[v]) return;
  NUTRIENTS.forEach(n=>{ $('loss_'+n).value=SOIL[v][n]; });
  scheduleCalc();
}
function syncDerived(){
  const ymaxHa=num('ymax')/U();
  NUTRIENTS.forEach(n=>{ const r=parseFloat($('req_'+n).value); $('umax_'+n).value=isFinite(r*ymaxHa)?(r*ymaxHa/1000).toFixed(1):''; });
  const f=num('ppmF');
  $('init_N').value=$('initN').value;
  $('init_P').value=isFinite(num('ppmP')*f)?(num('ppmP')*f).toFixed(1):'';
  $('init_K').value=isFinite(num('ppmK')*f)?(num('ppmK')*f).toFixed(1):'';
}

function productOptions(sel){
  return Object.keys(FERT_PRODUCTS).map(k=>{
    const p=FERT_PRODUCTS[k]; const lab=k==='custom'?(lang==='en'?'⚙️ Custom':lang==='zh'?'⚙️ 自定义':'⚙️ กำหนดเอง'):k+(p.name?' '+p.name:'');
    return `<option value="${k}" ${k===sel?'selected':''}>${lab}</option>`;}).join('');
}
function addFertRow(day,product,amtDisplay){
  const id=++fertCounter; const t=T();
  const div=document.createElement('div'); div.className='fert-item'; div.id='fert_'+id;
  div.innerHTML=`<div class="fert-top"><b class="doseLbl"></b><button type="button" class="rm-btn" onclick="removeFertRow(${id})">${t.rmBtn}</button></div>
    <div class="fert-row">
      <input id="fday_${id}" type="number" class="fday" value="${day}" aria-label="day">
      <select id="fprod_${id}" class="fproduct">${productOptions(product)}</select>
      <input id="famt_${id}" type="number" class="famt" step="0.5" value="${amtDisplay}" aria-label="amount">
    </div>
    <div class="grid3 customNPK" hidden style="margin-top:6px">
      <input id="cN_${id}" type="number" class="cN" placeholder="N%" value="0"><input id="cP_${id}" type="number" class="cP" placeholder="P₂O₅%" value="0"><input id="cK_${id}" type="number" class="cK" placeholder="K₂O%" value="0">
    </div>
    <div class="contrib"></div>`;
  div.querySelector('.fproduct').addEventListener('change',()=>{ div.querySelector('.customNPK').hidden=div.querySelector('.fproduct').value!=='custom'; refreshRows(); scheduleCalc(); });
  $('fertContainer').appendChild(div);
  refreshRows();
}
function removeFertRow(id){ const el=$('fert_'+id); if(el) el.remove(); refreshRows(); scheduleCalc(); }
function rowData(item){
  const prod=item.querySelector('.fproduct').value;
  let n,p,k,slow=false;
  if(prod==='custom'){ n=parseFloat(item.querySelector('.cN').value)||0; p=parseFloat(item.querySelector('.cP').value)||0; k=parseFloat(item.querySelector('.cK').value)||0; }
  else { const f=FERT_PRODUCTS[prod]; n=f.n; p=f.p; k=f.k; slow=!!f.slow; }
  const amtRaw=item.querySelector('.famt').value, dayRaw=item.querySelector('.fday').value;
  const amtHa=parseFloat(amtRaw)/U();
  return {prod,dayRaw,amtRaw,amtHa,slow,N:amtHa*n/100,P:amtHa*p/100*P2O5_TO_P,K:amtHa*k/100*K2O_TO_K};
}
function refreshRows(){
  const t=T(); const items=[...document.querySelectorAll('.fert-item')];
  items.forEach((it,i)=>{
    it.querySelector('.doseLbl').textContent=t.dose(i+1);
    it.querySelector('.rm-btn').textContent=t.rmBtn;
    const r=rowData(it), u=U();
    it.querySelector('.contrib').textContent=isFinite(r.amtHa)?t.contrib(fmt(r.N*u),fmt(r.P*u),fmt(r.K*u),uLabel()):'';
  });
}
function applyPreset(key){
  $('fertContainer').innerHTML=''; fertCounter=0;
  PRESETS[key].forEach(r=>addFertRow(r.d,r.p,+(r.a/RAI*U()).toFixed(1)));
  $('soilType').value=key.endsWith('Clay')?'clay':'loam'; applySoilType();
}
function setUnit(u){
  if(u===unit) { paintUnit(); return; }
  const factor=(u==='rai'?RAI:1)/(unit==='rai'?RAI:1);
  document.querySelectorAll('.famt').forEach(el=>{ const v=parseFloat(el.value); if(isFinite(v)) el.value=+(v*factor).toFixed(2); });
  const y=num('ymax'); if(isFinite(y)) $('ymax').value=Math.round(y*factor);
  unit=u; paintUnit(); refreshRows(); scheduleCalc();
}
function paintUnit(){ $('unitRai').classList.toggle('on',unit==='rai'); $('unitHa').classList.toggle('on',unit==='ha');
  $('unitRai').textContent=lang==='en'?'kg/rai':lang==='zh'?'kg/莱':'กก./ไร่';
  $('ymax').placeholder=uLabel(); }

function collectSchedule(dur){
  const t=T(), warns=[], sched={N:[],P:[],K:[]}, raw=[];
  [...document.querySelectorAll('.fert-item')].forEach((it,i)=>{
    const r=rowData(it); let bad=false;
    let day=parseFloat(r.dayRaw);
    if(r.dayRaw===''||!isFinite(day)||day<0||day>dur){ warns.push(t.warnRow(i+1,t.whyDay(dur))); bad=true; }
    else if(!Number.isInteger(day)){ const d2=Math.round(day); warns.push(t.warnRow(i+1,t.whyRounded(day,d2))); day=d2; }
    if(r.amtRaw===''||!isFinite(r.amtHa)||r.amtHa<0){ warns.push(t.warnRow(i+1,t.whyAmt)); bad=true; }
    it.classList.toggle('bad',bad);
    if(bad) return;
    raw.push({day,prod:r.prod,amtHa:r.amtHa});
    sched.N.push({day,amt:r.N,slow:false}); sched.P.push({day,amt:r.P,slow:r.slow}); sched.K.push({day,amt:r.K,slow:false});
  });
  return {sched,warns,raw};
}
function params(n,dur){
  const ymaxHa=num('ymax')/U();
  const p={umax:parseFloat($('req_'+n).value)*ymaxHa/1000, t0:num('t0_'+n), k:num('k_'+n),
    init:num('init_'+n), supply:num('supply_'+n), immLoss:n==='N'?num('imm_N'):0,
    lossRate:n==='P'?0:num('loss_'+n), fixRate:n==='P'?num('loss_P'):0};
  return Object.values(p).every(v=>isFinite(v))?p:null;
}

function scheduleCalc(){ clearTimeout(autoTimer); autoTimer=setTimeout(calc,250); }
function calc(){
  syncDerived(); refreshRows();
  const t=T(), dur=parseInt($('dur').value,10), warnEl=$('warn');
  if(!isFinite(dur)||dur<10){ warnEl.hidden=false; warnEl.textContent=t.warnNums; return; }
  const {sched,warns,raw}=collectSchedule(dur);
  const P={}; for(const n of NUTRIENTS){ P[n]=params(n,dur); if(!P[n]){ warnEl.hidden=false; warnEl.textContent=t.warnNums; return; } }
  const hasBad=document.querySelector('.fert-item.bad');
  warnEl.hidden=!warns.length; warnEl.innerHTML=warns.join('<br>')+(hasBad?'<br>'+t.warnSkipped:'');
  const res={};
  NUTRIENTS.forEach(n=>{
    const r=simulateNutrient(P[n],sched[n],dur);
    const r0=simulateNutrient(P[n],[],dur);
    r.RE=r.fertTot>0.01?(r.uptake-r0.uptake)/r.fertTot:null;
    res[n]=r;
  });
  last={res,P,sched,raw,dur};
  $('resultCard').hidden=false; $('detailCard').hidden=false;
  renderSummary(); renderRecommendation(); showDetail();
}

function verdictOf(r){
  if(r.ratio>=TARGET) return (r.fertTot>0.5 && r.residual+r.loss+r.immLoss>0.6*r.fertTot && r.RE!==null && r.RE<0.3)?'excess':'good';
  return r.ratio>=0.9?'mid':'low';
}
function renderSummary(){
  const t=T(), {res}=last;
  const cols={N:'#3f7d4f',P:'#8e45a3',K:'#3a72b0'};
  $('summary').innerHTML=NUTRIENTS.map(n=>{ const r=res[n];
    return `<button class="nutCell" aria-pressed="${n===active}" style="background:${cols[n]}; color:#fff" onclick="setNutrient('${n}', true)"><div class="h">${n} · ${t.uptakeOf}</div><div class="v">${(r.ratio*100).toFixed(0)}%</div><div class="s">${t.ofNeed}${r.stressDays?' · '+t.stressD(r.stressDays):''}</div><div class="go">${t.seeDetail}</div></button>`;}).join('');
  const lim=NUTRIENTS.reduce((a,b)=>res[b].ratio<res[a].ratio?b:a,'N');
  const yHa=num('ymax')/U()*Math.min(1,res[lim].ratio);
  $('yieldVal').textContent=Math.round(yHa*U()).toLocaleString()+' '+uLabel();
  $('yieldNote').textContent=t.yieldNote(t.nutName[lim],(res[lim].ratio*100).toFixed(0));
  last.yieldHa=yHa; last.lim=lim;
}
function renderRecommendation(){
  const t=T(), {res,P,sched,dur}=last, u=U(), ul=uLabel(), html=[], plain=[];
  const short=NUTRIENTS.filter(n=>res[n].ratio<TARGET).sort((a,b)=>res[a].ratio-res[b].ratio);
  html.push(short.length?`<div class="verdict v-mid">${t.recPriority(t.nutName[short[0]])}</div>`:`<div class="verdict v-good">${t.recAllGood}</div>`);
  NUTRIENTS.forEach(n=>{
    const r=res[n], nm=t.nutName[n];
    if(r.ratio<TARGET){
      const t0=Math.round(P[n].t0);
      const split=n==='N'?[0,Math.max(1,Math.round(t0*0.6)),Math.min(dur,t0)]:n==='P'?[0]:[0,Math.min(dur,t0)];
      const E=extraNeeded(P[n],sched[n],dur,split,TARGET);
      if(E===null){ html.push(`<div class="recItem add">${t.recImpossible(nm)}</div>`); plain.push(t.recImpossible(nm)); return; }
      const prod=n==='N'?'46-0-0':n==='P'?'0-46-0':'0-0-60';
      const prodKgHa=n==='N'?E/0.46:n==='P'?E/P2O5_TO_P/0.46:E/K2O_TO_K/0.60;
      const days=n==='N'?t.recAddDaysN(...split):n==='P'?t.recAddDaysP:t.recAddDaysK(split[1]);
      const s=t.recAdd(nm,fmt(E*u),prod,fmt(prodKgHa*u),ul,days);
      html.push(`<div class="recItem add">${s}</div>`); plain.push(s.replace(/<[^>]+>/g,''));
    } else if(r.fertTot>0.5){
      const cut=reducible(P[n],sched[n],dur,TARGET);
      if(cut>=0.999){ html.push(`<div class="recItem cut">${t.recNoneCut(nm)}</div>`); plain.push(t.recNoneCut(nm)); }
      else if(cut>=0.08){ const s=t.recCut(nm,(cut*100).toFixed(0),fmt(cut*r.fertTot*u),ul); html.push(`<div class="recItem cut">${s}</div>`); plain.push(s); }
      else { html.push(`<div class="recItem ok">${t.recOk(nm)}</div>`); plain.push(t.recOk(nm)); }
    } else { html.push(`<div class="recItem ok">${t.recNone(nm)}</div>`); plain.push(t.recNone(nm)); }
    if(r.residual>Math.max(5,0.1*r.umax) && n!=='P'){ const s=t.recResidual(nm,fmt(r.residual*u),ul); html.push(`<div class="recItem">${s}</div>`); plain.push(s); }
  });
  $('recBox').innerHTML=html.join(''); last.recPlain=plain;
}

function setNutrient(n, jump){
  active=n;
  NUTRIENTS.forEach(x=>{ $('panel_'+x).hidden=x!==n; $('nutBtn'+x).setAttribute('aria-pressed',x===n); $('detBtn'+x).setAttribute('aria-pressed',x===n); });
  document.querySelectorAll('.nutCell').forEach(c=>c.setAttribute('aria-pressed',c.textContent.trim().startsWith(n)));
  if(last){ showDetail(); if(jump){ const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches; $('detailCard').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); } }
}
function showDetail(){
  const t=T(), r=last.res[active], u=U(), ul=uLabel();
  $('detailHeader').textContent=t.detailHeader(t.nutName[active]);
  const items=[[t.sFert,fmt(r.fertTot*u)],[t.sNeed,fmt(r.demandTot*u)],[t.sUp,fmt(r.uptake*u)],
    [t.sLoss,fmt((r.loss+r.immLoss)*u)]].concat(active==='P'?[[t.sFix,fmt(r.fixed*u)]]:[]).concat([
    [t.sResid,fmt(r.residual*u)],[t.sRE,r.RE===null?'–':(r.RE*100).toFixed(0)+'%'],[t.sStress,`${r.stressDays} (${r.critStress})`]]);
  $('detailStats').innerHTML=items.map(([l,v],i)=>`<div class="stat"><div class="v">${v}</div><div class="l">${l}${i<items.length-2?'<br>'+ul:''}</div></div>`).join('');
  let html=`<tr><th>${t.tblDay}</th><th>${t.tblFert}</th><th>${t.tblDem}</th><th>${t.tblUp}</th><th>${t.tblSoil}</th></tr>`;
  r.days.forEach((d,i)=>{ if(d%10===0||i===r.days.length-1||r.fertByDay[i]>0)
    html+=`<tr class="${r.fertByDay[i]>0?'fertday':''}"><td>${d}</td><td>${r.fertByDay[i]>0?fmt(r.fertByDay[i]*u):''}</td><td>${fmt(r.demArr[i]*u)}</td><td>${fmt(r.upArr[i]*u)}</td><td>${fmt(r.soilArr[i]*u)}</td></tr>`; });
  $('tbl').innerHTML=html;
  const pct=r.ratio*100, v=verdictOf(r);
  drawField(pct); $('fieldPct').textContent=pct.toFixed(0)+'%';
  $('fieldMsg').textContent=t.fieldMsg(r.stressDays,r.critStress);
  const vm={good:['v-good',t.vGood],mid:['v-mid',t.vMid],low:['v-low',t.vLow],excess:['v-mid',t.vExcess]}[v];
  $('verdict').className='verdict '+vm[0]; $('verdict').textContent=vm[1];
  $('srcBody').innerHTML=t.srcBody;
  renderChart(chartType);
}
function drawPlants(pct,color){
  const g=$('plants'); g.innerHTML=''; const scale=0.6+(pct/100)*0.6, ns='http://www.w3.org/2000/svg';
  for(let r=0;r<4;r++) for(let c=0;c<8;c++){
    const x=26+c*29+(r%2?10:0), y=78+r*22, h=16*scale, gEl=document.createElementNS(ns,'g');
    gEl.setAttribute('transform',`translate(${x},${y})`);
    const mk=d=>{const p=document.createElementNS(ns,'path'); p.setAttribute('d',d); p.setAttribute('stroke',color); p.setAttribute('stroke-width','2.1'); p.setAttribute('fill','none'); p.setAttribute('stroke-linecap','round'); gEl.appendChild(p);};
    mk(`M0,${h} Q -2,${h*0.4} 0,0`); [-1,1].forEach(dr=>mk(`M0,${h*0.55} Q ${dr*9*scale},${h*0.35} ${dr*4*scale},${h*0.05}`));
    g.appendChild(gEl);
  }
}
function drawField(pct){
  const top=63,bottom=165,wt=bottom-(Math.min(100,pct)/100)*(bottom-top);
  $('waterPath').setAttribute('d',`M14,${bottom} L14,${wt} Q 130,${wt-6} 246,${wt} L246,${bottom} Z`);
  const ok=pct>=TARGET*100, mid=pct>=90;
  $('waterStop1').setAttribute('stop-color',ok?'#8fd08a':mid?'#d7d178':'#d19a78');
  $('waterStop2').setAttribute('stop-color',ok?'#4f8f6a':mid?'#a3944a':'#8a5a3f');
  drawPlants(pct,ok?'#2f6b2f':mid?'#8a8a2f':'#a15a2f');
}
function renderChart(type){
  chartType=type;
  ['Line','Bar','Pie'].forEach(x=>$('tab'+x).setAttribute('aria-pressed',('tab'+x)===('tab'+type.charAt(0).toUpperCase()+type.slice(1))));
  if(!last) return;
  const t=T(), r=last.res[active], u=U(), col=css('--n'+active)||'#3f7d4f';
  Chart.defaults.color=css('--muted'); Chart.defaults.borderColor=css('--border'); Chart.defaults.font.family=css('--font');
  if(chart) chart.destroy();
  const ctx=$('chart').getContext('2d'), ul=uLabel(), sc=a=>a.map(v=>+(v*u).toFixed(2));
  if(type==='line'){
    chart=new Chart(ctx,{type:'line',data:{labels:r.days,datasets:[
      {label:t.legSoil,data:sc(r.soilArr),borderColor:col,backgroundColor:'transparent',tension:0.2,pointRadius:0,borderWidth:2.5},
      {label:t.legUp,data:sc(r.upArr),borderColor:css('--accent2'),backgroundColor:'transparent',tension:0.2,pointRadius:0,borderWidth:2.5},
      {label:t.legDem,data:sc(r.demArr),borderColor:css('--muted'),borderDash:[6,4],backgroundColor:'transparent',tension:0.2,pointRadius:0,borderWidth:1.8}]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{title:{display:true,text:t.axisX},ticks:{maxTicksLimit:13}},y:{beginAtZero:true,title:{display:true,text:ul}}},plugins:{legend:{position:'bottom'}}}});
  } else if(type==='bar'){
    const L=t.barLabels, lossCol=css('--accent2');
    chart=new Chart(ctx,{type:'bar',data:{labels:[t.barIn,t.barOut],datasets:[
      {label:L[0],data:[r.init*u,0],backgroundColor:'#8a8a3f',stack:'s'},{label:L[1],data:[r.supTot*u,0],backgroundColor:'#a3944a',stack:'s'},{label:L[2],data:[r.fertTot*u,0],backgroundColor:col,stack:'s'},
      {label:L[3],data:[0,r.uptake*u],backgroundColor:'#2f6b2f',stack:'s'},{label:L[4],data:[0,(r.loss+r.immLoss)*u],backgroundColor:lossCol,stack:'s'},{label:L[5],data:[0,r.fixed*u],backgroundColor:'#7a6b5a',stack:'s'},{label:L[6],data:[0,r.residual*u],backgroundColor:'#9aa08c',stack:'s'}]},
      options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,title:{display:true,text:ul}}},plugins:{legend:{position:'bottom',labels:{filter:(it,d)=>d.datasets[it.datasetIndex].data.some(v=>v>0.05)}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.raw.toFixed(1)}`}}}}});
  } else {
    const data=[r.uptake,r.loss+r.immLoss,r.fixed,r.residual].map(v=>Math.max(0,v*u));
    chart=new Chart(ctx,{type:'doughnut',data:{labels:t.pieLabels,datasets:[{data,backgroundColor:['#2f6b2f',css('--accent2'),'#7a6b5a','#9aa08c'],borderColor:css('--card')}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw.toFixed(1)} ${ul} (${(c.raw/data.reduce((a,b)=>a+b,0)*100).toFixed(0)}%)`}}}}});
  }
}

function applyI18n(){
  const t=T();
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const v=t[el.getAttribute('data-i18n')]; if(typeof v==='string') el.textContent=v; });
  $('nutBtnN').textContent='🟢 N'; $('nutBtnP').textContent='🟣 P'; $('nutBtnK').textContent='🔵 K';
  document.querySelectorAll('.fproduct').forEach(s=>{ const v=s.value; s.innerHTML=productOptions(v); s.value=v; });
  paintUnit(); refreshRows();
  ['th','en','zh'].forEach(l=>$('lang'+l[0].toUpperCase()+l.slice(1)).classList.toggle('active',l===lang));
}
function setLang(l){ lang=l; applyI18n(); if(last){ renderSummary(); renderRecommendation(); showDetail(); } }

// ---------- AI analysis ----------
function buildAIContext(){
  const {res,raw,dur}=last, lines=[];
  lines.push(`Crop duration ${dur} days; soil type ${$('soilType').value}; target yield ${num('ymax')/U()|0} kg/ha (${Math.round(num('ymax')/U()*RAI)} kg/rai)`);
  lines.push(`Soil test: mineral N ${num('initN')} kg/ha, available P ${num('ppmP')} ppm, exchangeable K ${num('ppmK')} ppm`);
  lines.push('Fertilizer plan (product, day, kg/ha, kg/rai): '+raw.map(f=>`${f.prod} day ${f.day} ${f.amtHa.toFixed(1)} kg/ha (${(f.amtHa*RAI).toFixed(1)} kg/rai)`).join('; '));
  NUTRIENTS.forEach(n=>{ const r=res[n];
    lines.push(`${n} (elemental kg/ha): requirement ${r.demandTot.toFixed(1)}, uptake ${r.uptake.toFixed(1)} (${(r.ratio*100).toFixed(0)}%), fertilizer ${r.fertTot.toFixed(1)}, initial soil ${r.init.toFixed(1)}, soil supply ${r.supTot.toFixed(1)}, lost ${(r.loss+r.immLoss).toFixed(1)}, fixed ${r.fixed.toFixed(1)}, left after harvest ${r.residual.toFixed(1)}, recovery efficiency ${r.RE===null?'n/a':(r.RE*100).toFixed(0)+'%'}, days short ${r.stressDays} (${r.critStress} in critical window)`); });
  lines.push(`Estimated yield ${Math.round(last.yieldHa)} kg/ha (${Math.round(last.yieldHa*RAI)} kg/rai), limiting nutrient ${last.lim}`);
  lines.push('Model recommendations: '+last.recPlain.join(' | '));
  return lines.join('\n');
}
async function runAIAnalysis(){
  // Calls our own Vercel function (/api/analyze). The Gemini key lives only on the server.
  const t=T(), btn=$('aiBtn'), box=$('aiBox');
  if(!last) return;
  box.hidden=false; btn.disabled=true; box.textContent=t.aiLoading;
  try{
    const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({lang, context:buildAIContext()})});
    const data=await res.json().catch(()=>({}));
    if(res.status===429) box.textContent=t.aiBusy;
    else if(!res.ok || !data.text) box.textContent=t.aiUnavailable+(data.error?` (${data.error})`:'');
    else box.textContent=data.text;
  }catch(e){ box.textContent=t.aiUnavailable; }
  btn.disabled=false;
}

// ---------- boot ----------
buildPanels();
$('ymax').value=720;
applyI18n();
['dur','ymax','initN','ppmP','ppmK','ppmF'].forEach(id=>$(id).addEventListener('input',scheduleCalc));
$('nutrientPanels').addEventListener('input',e=>{ if(e.target.id.startsWith('loss_')) $('soilType').value='custom'; scheduleCalc(); });
$('fertContainer').addEventListener('input',()=>{ refreshRows(); scheduleCalc(); });
applyPreset('npsClay');
setUnit('rai');
calc();
