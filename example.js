/**
 * example.js — run the model from the command line:  node example.js
 * Rice Department plan for non-photoperiod-sensitive rice on three soils.
 */
const { simulateNutrient, extraNeeded } = require('./engine.js');

const RAI = 0.16, DUR = 120, YIELD_T_HA = 4.5;           // 720 kg/rai target
const GRADES = { '16-20-0': [16, 20, 0], '16-16-8': [16, 16, 8], '46-0-0': [46, 0, 0] };
const SOIL = { clay: { N: 0.022, P: 0.012, K: 0.002 }, loam: { N: 0.032, P: 0.008, K: 0.006 }, sandy: { N: 0.05, P: 0.004, K: 0.012 } };

function schedule(plan) {                                 // plan rows: [day, grade, kg product per rai]
  const s = { N: [], P: [], K: [] };
  for (const [day, g, kgRai] of plan) {
    const w = kgRai / RAI, [n, p, k] = GRADES[g];         // kg product per ha
    s.N.push({ day, amt: w * n / 100 });
    s.P.push({ day, amt: w * p / 100 * 0.436 });
    s.K.push({ day, amt: w * k / 100 * 0.830 });
  }
  return s;
}
function params(soil, ppmP = 7, ppmK = 55) {
  return {
    N: { umax: 20 * YIELD_T_HA, t0: 45, k: 0.08, init: 10, supply: 40, immLoss: 0.11, lossRate: SOIL[soil].N, fixRate: 0 },
    P: { umax: 3.5 * YIELD_T_HA, t0: 45, k: 0.08, init: ppmP * 2.25, supply: 4, immLoss: 0, lossRate: 0, fixRate: SOIL[soil].P },
    K: { umax: 20 * YIELD_T_HA, t0: 55, k: 0.07, init: ppmK * 2.25, supply: 30, immLoss: 0, lossRate: SOIL[soil].K, fixRate: 0 },
  };
}

for (const [soil, basal] of [['clay', '16-20-0'], ['loam', '16-16-8'], ['sandy', '16-16-8']]) {
  const P = params(soil), S = schedule([[0, basal, 30], [30, '46-0-0', 10], [50, '46-0-0', 10]]);
  const r = {}; let minRatio = 1;
  for (const n of ['N', 'P', 'K']) { r[n] = simulateNutrient(P[n], S[n], DUR); minRatio = Math.min(minRatio, r[n].ratio); }
  console.log(`\n${soil.toUpperCase()}  estimated yield ${(YIELD_T_HA * 1000 * minRatio * RAI).toFixed(0)} kg/rai`);
  for (const n of ['N', 'P', 'K']) {
    const x = r[n];
    console.log(`  ${n}: received ${(x.ratio * 100).toFixed(1)}%  uptake ${x.uptake.toFixed(1)}  lost ${(x.loss + x.immLoss).toFixed(1)}  fixed ${x.fixed.toFixed(1)}  left ${x.residual.toFixed(1)} kg/ha  (mass-balance error ${x.balanceErr.toExponential(1)})`);
  }
  if (r.N.ratio < 0.98) {
    const E = extraNeeded(P.N, S.N, DUR, [0, 27, 45], 0.98);
    console.log(`  → add about ${(E / 0.46 * RAI).toFixed(1)} kg/rai of 46-0-0 on days 0, 27 and 45`);
  }
}
