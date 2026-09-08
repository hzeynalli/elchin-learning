// 5.NF.3 — Fractions as division; whole-number division answers as fractions or mixed numbers (5.NF.B.3)
import { ri, pick, frac, mixed, NAMES } from '../lib.js';
const fracItem = (stem, n, d, expr, extra) => ({ format: 'numeric', stem, answer: frac(n, d), accept: [`${n}/${d}`, mixed(n, d)], params: { check: { type: 'expr', expr } }, ...extra });

export function generate(tier, rng) {
  const name = pick(rng, NAMES);
  if (tier === 1) {
    const a = ri(rng, 1, 11), b = ri(rng, 2, 12); if (a % b === 0) return generate(tier, rng);
    return fracItem(`Write ${a} ÷ ${b} as a fraction.`, a, b, `${a}/${b}`, { working: 'The number being divided goes on top.', explanation: `${a} ÷ ${b} = ${a}/${b}.` });
  }
  if (tier === 2) {
    const p = ri(rng, 3, 9), k = ri(rng, 2, 8); if (p % k === 0) return generate(tier, rng);
    return fracItem(`${p} pizzas are shared equally among ${k} people. How much pizza does each person get? Give a mixed number if you can.`, p, k, `${p}/${k}`, { working: `Each person gets ${p} ÷ ${k} = ${p}/${k} of a pizza.`, explanation: `${p}/${k} = ${mixed(p, k)}.` });
  }
  const m = ri(rng, 11, 29), k = ri(rng, 3, 8); if (m % k === 0) return generate(tier, rng);
  return fracItem(`A rope ${m} m long is cut into ${k} equal pieces. How long is each piece, in metres? Give a mixed number.`, m, k, `${m}/${k}`, { working: `${m} ÷ ${k} = ${m}/${k}. How many whole metres, and what is left over?`, explanation: `${Math.floor(m / k)} r ${m % k} → ${mixed(m, k)} m each.` });
}
