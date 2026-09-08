// 5.NBT.5 — Multiply multi-digit whole numbers with the standard algorithm (5.NBT.B.5)
import { ri, pick, fmt, numeric, chance, NAMES, CONTEXTS, MONEY } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const a = ri(rng, 102, 998), b = ri(rng, 3, 9);
    return numeric(`Work out ${fmt(a)} × ${b}.`, a * b, `${a}*${b}`, { working: 'Ones, then tens, then hundreds; carry as you go.', explanation: `${fmt(a)} × ${b} = ${fmt(a * b)}.` });
  }
  if (tier === 2) {
    const a = ri(rng, 123, 987), b = ri(rng, 12, 89);
    return numeric(`Work out ${fmt(a)} × ${b}.`, a * b, `${a}*${b}`, { working: `${fmt(a)} × ${b % 10} then ${fmt(a)} × ${Math.floor(b / 10) * 10}; add the two rows.`, explanation: `${fmt(a)} × ${b} = ${fmt(a * b)}.` });
  }
  if (chance(rng, 0.5)) {
    const a = ri(rng, 1023, 9876), b = ri(rng, 12, 68);
    return numeric(`Work out ${fmt(a)} × ${b}.`, a * b, `${a}*${b}`, { working: 'Two partial products (ones and tens), then add. Estimate first: about ' + fmt(Math.round(a / 1000) * 1000 * Math.round(b / 10) * 10) + '.', explanation: `${fmt(a)} × ${b} = ${fmt(a * b)}.` });
  }
  const name = pick(rng, NAMES), c = pick(rng, CONTEXTS);
  const price = ri(rng, 112, 489), qty = ri(rng, 24, 96), noise = ri(rng, 5, 30);
  return numeric(`Each ${c.pack} of ${c.thing} costs ${fmt(price)} ${MONEY}. ${name}'s ${c.place} orders ${qty} of them for ${noise} classrooms. What is the total cost in ${MONEY}?`, price * qty, `${price}*${qty}`, { working: `${fmt(price)} × ${qty}; the ${noise} classrooms do not change the cost.`, explanation: `${fmt(price)} × ${qty} = ${fmt(price * qty)} ${MONEY}.` });
}
