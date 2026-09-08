// G4.NF.2 — Add/subtract fractions with like denominators; multiply a fraction by a whole number (4.NF.B.3-4)
import { ri, pick, frac, mixed, NAMES } from '../lib.js';

const fracItem = (stem, n, d, expr, extra) => ({ format: 'numeric', stem, answer: frac(n, d), accept: [`${n}/${d}`, mixed(n, d)], params: { check: { type: 'expr', expr } }, ...extra });

export function generate(tier, rng) {
  if (tier === 1) {
    const d = pick(rng, [4, 5, 6, 8, 10, 12]); const a = ri(rng, 1, d - 2), b = ri(rng, 1, d - 1 - a);
    return fracItem(`Work out ${a}/${d} + ${b}/${d}. Give your answer in its simplest form.`, a + b, d, `(${a}+${b})/${d}`, { working: 'Same denominator: add the numerators, keep the denominator, then simplify.', explanation: `${a}/${d} + ${b}/${d} = ${a + b}/${d} = ${frac(a + b, d)}.` });
  }
  if (tier === 2) {
    const d = pick(rng, [3, 4, 5, 6, 8]); const w = ri(rng, 1, 4), a = ri(rng, 1, d - 2), b = ri(rng, a + 1, d - 1);   // a < b → needs a borrow
    const num = w * d + a - b;                                  // w a/d − b/d, needs a borrow when a < b
    return fracItem(`Work out ${w} ${a}/${d} − ${b}/${d}.`, num, d, `(${w}*${d}+${a}-${b})/${d}`, { working: `Change ${w} ${a}/${d} into ${w * d + a}/${d}, then subtract ${b}/${d}.`, explanation: `${w * d + a}/${d} − ${b}/${d} = ${num}/${d} = ${mixed(num, d)}.` });
  }
  const name = pick(rng, NAMES); const d = pick(rng, [3, 4, 5, 6, 8]), a = ri(rng, 1, d - 1), k = ri(rng, 3, 8);
  return fracItem(`Each of ${k} friends runs ${a}/${d} km. How far do they run altogether? Give your answer as a mixed number or a fraction.`, k * a, d, `${k}*${a}/${d}`, { working: `${k} × ${a}/${d} = ${k * a}/${d}; then write as a mixed number.`, explanation: `${k * a}/${d} = ${mixed(k * a, d)} km.` });
}
