// G4.MD.1 — Unit conversions (km/m/cm, kg/g, l/ml, hours/min); perimeter and area of rectangles (4.MD.A.1-3)
import { ri, pick, fmt, numeric, chance, MONEY } from '../lib.js';

const CONV = [['km', 'm', 1000], ['m', 'cm', 100], ['kg', 'g', 1000], ['litres', 'ml', 1000], ['hours', 'minutes', 60], ['minutes', 'seconds', 60]];

export function generate(tier, rng) {
  if (tier === 1) {
    const [big, small, k] = pick(rng, CONV); const n = ri(rng, 2, 12);
    return numeric(`${n} ${big} = ? ${small}`, n * k, `${n}*${k}`, { working: `1 ${big} = ${fmt(k)} ${small}, so multiply by ${fmt(k)}.`, explanation: `${n} × ${fmt(k)} = ${fmt(n * k)} ${small}.` });
  }
  if (tier === 2) {
    const l = ri(rng, 4, 20), w = ri(rng, 3, l - 1);
    return chance(rng, 0.5)
      ? numeric(`A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter in cm?`, 2 * (l + w), `2*(${l}+${w})`, { working: 'Perimeter = 2 × (length + width).', explanation: `2 × (${l} + ${w}) = ${2 * (l + w)} cm.` })
      : numeric(`A rectangle is ${l} m long and ${w} m wide. What is its area in square metres?`, l * w, `${l}*${w}`, { working: 'Area = length × width.', explanation: `${l} × ${w} = ${l * w} m².` });
  }
  const l = ri(rng, 6, 25), w = ri(rng, 4, l - 1), price = ri(rng, 2, 9);
  return numeric(`A garden is ${l} m long and ${w} m wide. Fencing costs ${price} ${MONEY} per metre. How much does it cost to fence all the way round the garden?`, 2 * (l + w) * price, `2*(${l}+${w})*${price}`, { working: `Perimeter first: 2 × (${l} + ${w}) = ${2 * (l + w)} m. Then × ${price}.`, explanation: `${2 * (l + w)} × ${price} = ${fmt(2 * (l + w) * price)} ${MONEY}.` });
}
