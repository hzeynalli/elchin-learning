// 5.NF.4 — Multiply fractions and mixed numbers; area with fractional sides; scaling (5.NF.B.4-6)
import { ri, pick, gcd, frac, mixed, mc4, chance } from '../lib.js';
const fracItem = (stem, n, d, expr, extra) => ({ format: 'numeric', stem, answer: frac(n, d), accept: [`${n}/${d}`, mixed(n, d)], params: { check: { type: 'expr', expr } }, ...extra });
const unit = (rng, ds) => { const d = pick(rng, ds); let n; do { n = ri(rng, 1, d - 1); } while (gcd(n, d) !== 1); return [n, d]; };

export function generate(tier, rng) {
  if (tier === 1) {
    const [a, b] = unit(rng, [2, 3, 4, 5, 6, 8]), k = ri(rng, 2, 9);
    return fracItem(`Work out ${a}/${b} × ${k}.`, a * k, b, `${a}/${b}*${k}`, { working: 'Multiply the numerator by the whole number; keep the denominator.', explanation: `${a * k}/${b} = ${mixed(a * k, b)}.` });
  }
  if (tier === 2) {
    const [a, b] = unit(rng, [2, 3, 4, 5, 6]), [c, d] = unit(rng, [3, 4, 5, 7, 8]);
    return fracItem(`Work out ${a}/${b} × ${c}/${d}. Give the answer in its simplest form.`, a * c, b * d, `${a}/${b}*${c}/${d}`, { working: 'Multiply the tops, multiply the bottoms, then simplify.', explanation: `${a * c}/${b * d} = ${frac(a * c, b * d)}.` });
  }
  if (chance(rng, 0.5)) {
    const [a, b] = unit(rng, [2, 3, 4, 5]), [c, d] = unit(rng, [3, 4, 5, 6]);
    return fracItem(`A rectangle is ${a}/${b} m long and ${c}/${d} m wide. What is its area in square metres?`, a * c, b * d, `${a}/${b}*${c}/${d}`, { working: 'Area = length × width, even with fractions.', explanation: `${a}/${b} × ${c}/${d} = ${frac(a * c, b * d)} m².` });
  }
  const k = ri(rng, 3, 12), [a, b] = chance(rng, 0.5) ? unit(rng, [3, 4, 5, 6]) : [ri(rng, 5, 9), 4];
  const less = a < b;
  const correct = less ? `Less than ${k}, because ${a}/${b} is less than 1.` : `More than ${k}, because ${a}/${b} is more than 1.`;
  const m = mc4(rng, correct, [{ v: less ? `More than ${k}, because multiplying always makes numbers bigger.` : `Less than ${k}, because fractions make numbers smaller.`, why: 'depends on whether the fraction is more or less than 1' }, { v: `Exactly ${k}, because ${a}/${b} does not change it.`, why: 'only × 1 leaves it unchanged' }, { v: 'Cannot tell without calculating.', why: 'compare the fraction with 1' }]);
  return { ...m, stem: `Without calculating: is ${a}/${b} × ${k} more than, less than, or equal to ${k}?`, working: 'Compare the fraction with 1.', explanation: correct };
}
