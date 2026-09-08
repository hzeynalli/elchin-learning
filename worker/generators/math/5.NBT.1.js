// 5.NBT.1 — Place-value relationships: a digit is 10× the place to its right and 1/10 of the place to its left (5.NBT.A.1)
import { ri, pick, fmt, placeName, numeric, chance } from '../lib.js';

// a number with the same digit d in places p and p+k
function twin(rng) {
  const d = ri(rng, 1, 9), p = ri(rng, 0, 4), k = pick(rng, [1, 1, 2]);
  let n = d * 10 ** p + d * 10 ** (p + k);
  for (let i = 0; i <= p + k + 1; i++) if (i !== p && i !== p + k) n += ri(rng, 0, 9) * 10 ** i * (i > p + k ? (chance(rng, 0.7) ? 1 : 0) : 1);
  n = n - (n % 10 ** 0);
  return { n, d, p, k };
}

export function generate(tier, rng) {
  if (tier === 1) {
    const { n, d, p } = twin(rng);
    return numeric(`In ${fmt(n)}, what is the ${placeName(p)} digit ${d} worth?`, d * 10 ** p, `${d}*${10 ** p}`, { working: `The ${placeName(p)} place is worth ${fmt(10 ** p)} each.`, explanation: `${d} × ${fmt(10 ** p)} = ${fmt(d * 10 ** p)}.` });
  }
  if (tier === 2) {
    const { n, d, p, k } = twin(rng);
    return chance(rng, 0.5)
      ? numeric(`In ${fmt(n)}, the ${d} in the ${placeName(p + k)} place is how many times the ${d} in the ${placeName(p)} place?`, 10 ** k, `${10 ** k}`, { working: 'Each place to the left is 10 times bigger.', explanation: `${k} place${k > 1 ? 's' : ''} to the left = ${fmt(10 ** k)} times.` })
      : { format: 'numeric', stem: `In ${fmt(n)}, the ${d} in the ${placeName(p)} place is what fraction of the ${d} in the ${placeName(p + k)} place?`, answer: `1/${10 ** k}`, accept: [String(1 / 10 ** k)], params: { check: { type: 'expr', expr: `1/${10 ** k}` } }, working: 'Each place to the right is one tenth of the place to its left.', explanation: `${k} place${k > 1 ? 's' : ''} to the right = 1/${fmt(10 ** k)}.` };
  }
  const { n, d, p, k } = twin(rng);
  return { format: 'numeric', stem: `In the number ${fmt(n)}, the ${d} in the ${placeName(p)} place is worth ___, the ${d} in the ${placeName(p + k)} place is worth ___, and the ${placeName(p + k)} ${d} is ___ times the ${placeName(p)} ${d}. Give the three answers separated by semicolons.`, answer: `${fmt(d * 10 ** p)}; ${fmt(d * 10 ** (p + k))}; ${10 ** k}`, params: { check: { type: 'multi', exprs: [`${d}*${10 ** p}`, `${d}*${10 ** (p + k)}`, `${10 ** k}`] } }, working: 'Value = digit × place. Then compare the two values.', explanation: `${fmt(d * 10 ** p)}; ${fmt(d * 10 ** (p + k))}; ${fmt(d * 10 ** (p + k))} ÷ ${fmt(d * 10 ** p)} = ${10 ** k}.` };
}
