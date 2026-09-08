// 5.MD.1 — Convert measurement units within a system; multi-step problems (5.MD.A.1)
import { ri, pick, numeric, chance, NAMES } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const kind = pick(rng, ['m>cm', 'cm>m', 'km>m', 'kg>g', 'l>ml', 'h>min']);
    const n = ri(rng, 2, 9);
    switch (kind) {
      case 'm>cm': { const v = n + ri(rng, 1, 9) / 10; return numeric(`${v} m = ? cm`, v * 100, `${v}*100`, { working: '1 m = 100 cm.', explanation: `${v} × 100 = ${v * 100} cm.` }); }
      case 'cm>m': { const cm = n * 100 + ri(rng, 1, 9) * 10; return numeric(`${cm} cm = ? m`, cm / 100, `${cm}/100`, { working: '100 cm = 1 m, so divide by 100.', explanation: `${cm} ÷ 100 = ${cm / 100} m.` }); }
      case 'km>m': { const km = n + ri(rng, 1, 9) / 10; return numeric(`${km} km = ? m`, km * 1000, `${km}*1000`, { working: '1 km = 1000 m.', explanation: `${km} × 1000 = ${km * 1000} m.` }); }
      case 'kg>g': { const kg = n + ri(rng, 1, 9) / 10; return numeric(`${kg} kg = ? g`, kg * 1000, `${kg}*1000`, { working: '1 kg = 1000 g.', explanation: `${kg} × 1000 = ${kg * 1000} g.` }); }
      case 'l>ml': { const l = n + pick(rng, [0.25, 0.5, 0.75]); return numeric(`${l} litres = ? ml`, l * 1000, `${l}*1000`, { working: '1 litre = 1000 ml.', explanation: `${l} × 1000 = ${l * 1000} ml.` }); }
      default: { const mn = pick(rng, [15, 30, 45]); return numeric(`${n} hours ${mn} minutes = ? minutes`, n * 60 + mn, `${n}*60+${mn}`, { working: '1 hour = 60 minutes.', explanation: `${n} × 60 + ${mn} = ${n * 60 + mn} minutes.` }); }
    }
  }
  if (tier === 2) {
    const km = ri(rng, 1, 9), m = ri(rng, 50, 950);
    return chance(rng, 0.5)
      ? numeric(`${km} km ${m} m = ? m`, km * 1000 + m, `${km}*1000+${m}`, { working: 'Change the km to m, then add.', explanation: `${km * 1000} + ${m} = ${km * 1000 + m} m.` })
      : numeric(`${km * 1000 + m} m = ? km (write as a decimal)`, (km * 1000 + m) / 1000, `${km * 1000 + m}/1000`, { working: 'Divide by 1000: the metres become thousandths of a km.', explanation: `${km * 1000 + m} ÷ 1000 = ${(km * 1000 + m) / 1000} km.` });
  }
  const name = pick(rng, NAMES), litres = pick(rng, [1.5, 2, 2.5, 3]), cup = pick(rng, [250, 500]);
  return numeric(`${name} has a ${litres}-litre bottle of juice and pours it into ${cup} ml cups. How many full cups can ${name} pour?`, (litres * 1000) / cup, `${litres}*1000/${cup}`, { working: `${litres} litres = ${litres * 1000} ml. Then divide by ${cup}.`, explanation: `${litres * 1000} ÷ ${cup} = ${(litres * 1000) / cup} cups.` });
}
