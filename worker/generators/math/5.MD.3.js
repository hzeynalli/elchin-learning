// 5.MD.3 — Volume: unit cubes, V = l × w × h, composite figures (5.MD.C.3-5)
import { ri, numeric, chance } from '../lib.js';

export function generate(tier, rng) {
  const l = ri(rng, 2, 9), w = ri(rng, 2, 8), h = ri(rng, 2, 7);
  if (tier === 1) return numeric(`A box is built from unit cubes: ${l} cubes long, ${w} cubes wide and ${h} cubes high. How many cubes are there?`, l * w * h, `${l}*${w}*${h}`, { working: `One layer has ${l} × ${w} cubes; there are ${h} layers.`, explanation: `${l} × ${w} × ${h} = ${l * w * h} cubes.` });
  if (tier === 2) return numeric(`A box is ${l} cm long, ${w} cm wide and ${h} cm high. What is its volume in cm³?`, l * w * h, `${l}*${w}*${h}`, { working: 'Volume = length × width × height.', explanation: `${l} × ${w} × ${h} = ${l * w * h} cm³.` });
  if (chance(rng, 0.5)) {
    const l2 = ri(rng, 2, 6), w2 = ri(rng, 2, 6), h2 = ri(rng, 2, 6);
    return numeric(`A shape is made of two boxes joined together. Box 1 is ${l} × ${w} × ${h} cm. Box 2 is ${l2} × ${w2} × ${h2} cm. What is the total volume in cm³?`, l * w * h + l2 * w2 * h2, `${l}*${w}*${h}+${l2}*${w2}*${h2}`, { working: 'Find each volume, then add.', explanation: `${l * w * h} + ${l2 * w2 * h2} = ${l * w * h + l2 * w2 * h2} cm³.` });
  }
  return numeric(`A box has a volume of ${l * w * h} cm³. It is ${l} cm long and ${w} cm wide. How high is it?`, h, `${l * w * h}/(${l}*${w})`, { working: `Base area = ${l} × ${w} = ${l * w}. Volume ÷ base area = height.`, explanation: `${l * w * h} ÷ ${l * w} = ${h} cm.` });
}
