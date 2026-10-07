/**
 * engine.js — NPK Soil Balance: calculation core
 * Daily soil nutrient balance for rice, supply-limited uptake.
 * All amounts are elemental kg/ha. Works in the browser and in Node.js.
 */
// Daily soil nutrient balance with supply-limited uptake. All amounts are elemental kg/ha.
function simulateNutrient(p, sched, dur){
  const lg=t=>1/(1+Math.exp(-p.k*(t-p.t0)));
  const L0=lg(0), Ld=lg(dur), span=Math.max(Ld-L0,1e-9);
  const F=t=>(lg(t)-L0)/span;
  const supplyDay=dur>0?p.supply/dur:0;
  let soil=p.init, slowPool=0, cumUp=0, cumDemand=0;
  let fertTot=0, immTot=0, lossTot=0, fixTot=0, supTot=0, stressDays=0, critStress=0;
  const days=[],soilArr=[],upArr=[],demArr=[],fertByDay=[];
  for(let t=0;t<=dur;t++){
    let fertToday=0;
    sched.forEach(f=>{ if(f.day===t){
      fertToday+=f.amt; fertTot+=f.amt;
      if(f.slow){ slowPool+=f.amt; }
      else { const lost=f.amt*p.immLoss; immTot+=lost; soil+=f.amt-lost; }
    }});
    if(slowPool>0){ const r=slowPool*SLOW_RELEASE; slowPool-=r; soil+=r; }
    if(t>0){ soil+=supplyDay; supTot+=supplyDay; }
    const demand=t===0?0:p.umax*(F(t)-F(t-1));
    const up=Math.min(demand,soil); soil-=up; cumUp+=up; cumDemand+=demand;
    if(demand>0.01 && up<0.95*demand){ stressDays++; if(Math.abs(t-p.t0)<=15) critStress++; }
    const loss=p.lossRate*soil; soil-=loss; lossTot+=loss;
    const fix=p.fixRate*soil; soil-=fix; fixTot+=fix;
    days.push(t); soilArr.push(soil); upArr.push(cumUp); demArr.push(cumDemand); fertByDay.push(fertToday);
  }
  const inputs=p.init+supTot+fertTot, outputs=cumUp+immTot+lossTot+fixTot+soil+slowPool;
  return {days,soilArr,upArr,demArr,fertByDay,fertTot,supTot,init:p.init,
    uptake:cumUp,demandTot:cumDemand,ratio:cumDemand>0?cumUp/cumDemand:1,
    immLoss:immTot,loss:lossTot,fixed:fixTot,residual:soil+slowPool,
    stressDays,critStress,balanceErr:inputs-outputs,umax:p.umax};
}
function extraNeeded(p, sched, dur, splitDays, target){
  const run=E=>simulateNutrient(p, sched.concat(splitDays.map(d=>({day:d,amt:E/splitDays.length}))), dur).ratio;
  if(run(0)>=target) return 0;
  let lo=0, hi=50; while(run(hi)<target && hi<4000) hi*=2;
  if(run(hi)<target) return null;
  for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(run(m)>=target) hi=m; else lo=m; }
  return hi;
}
function reducible(p, sched, dur, target){
  const run=s=>simulateNutrient(p, sched.map(f=>({...f,amt:f.amt*s})), dur).ratio;
  if(run(1)<target) return 0;
  if(run(0)>=target) return 1;
  let lo=0, hi=1;
  for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(run(m)>=target) hi=m; else lo=m; }
  return 1-hi;
}
const SLOW_RELEASE=0.03;

if (typeof module !== 'undefined') module.exports = { simulateNutrient, extraNeeded, reducible, SLOW_RELEASE };
