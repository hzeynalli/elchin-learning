// 5.NF.1 — Add and subtract fractions with unlike denominators, including mixed numbers (5.NF.A.1)
import { ri, pick, gcd, lcm, frac, mixed, chance, NAMES } from '../lib.js';
const fracItem = (stem, n, d, expr, extra) => ({ format: 'numeric', stem, answer: frac(n, d), accept: [`${n}/${d}`, mixed(n, d)], params: { check: { type: 'expr', expr } }, ...extra });
const unit = (rng, ds) => { const d = pick(rng, ds); let n; do { n = ri(rng, 1, d - 1); } while (gcd(n, d) !== 1); return [n, d]; };

export function generate(tier, rng) {
  if (tier === 1) {
    const [a, b] = unit(rng, [2, 3, 4, 5]); const k = pick(rng, [2, 3]); const [c, d] = [ri(rng, 1, b * k - 1), b * k];
    return fracItem(`Work out ${a}/${b} + ${c}/${d}.`, a * k + c, d, `${a}/${b}+${c}/${d}`, { working: `${b} goes into ${d}: change ${a}/${b} to ${a * k}/${d}, then add.`, explanation: `${a * k}/${d} + ${c}/${d} = ${a * k + c}/${d} = ${frac(a * k + c, d)}.` });
  }
  if (tier === 2) {
    let [a, b] = unit(rng, [2, 3, 4, 5, 6, 8]), [c, d] = unit(rng, [3, 4, 5, 6, 8, 10, 12]);
    if (b === d) d = d === 12 ? 5 : d + 1;
    const L = lcm(b, d);
    if (chance(rng, 0.5)) return fracItem(`Work out ${a}/${b} + ${c}/${d}. Give the answer in its simplest form.`, a * (L / b) + c * (L / d), L, `${a}/${b}+${c}/${d}`, { working: `Common denominator ${L}: ${a * (L / b)}/${L} + ${c * (L / d)}/${L}.`, explanation: `= ${a * (L / b) + c * (L / d)}/${L} = ${frac(a * (L / b) + c * (L / d), L)}.` });
    const big = a / b > c / d ? [a, b, c, d] : [c, d, a, b];
    const n = big[0] * (L / big[1]) - big[2] * (L / big[3]);
    return fracItem(`Work out ${big[0]}/${big[1]} − ${big[2]}/${big[3]}. Give the answer in its simplest form.`, n, L, `${big[0]}/${big[1]}-${big[2]}/${big[3]}`, { working: `Common denominator ${L}: ${big[0] * (L / big[1])}/${L} − ${big[2] * (L / big[3])}/${L}.`, explanation: `= ${n}/${L} = ${frac(n, L)}.` });
  }
  const name = pick(rng, NAMES); const w1 = ri(rng, 1, 3), [a, b] = unit(rng, [2, 3, 4]); const w2 = ri(rng, 1, 3), [c, d] = unit(rng, [3, 4, 6, 8].filter((x) => x !== b));
  const L = lcm(b, d), n = (w1 * b + a) * (L / b) + (w2 * d + c) * (L / d);
  return fracItem(`${name} ran ${w1} ${a}/${b} km on Monday and ${w2} ${c}/${d} km on Tuesday. How far did ${name} run altogether? Give a mixed number.`, n, L, `(${w1}+${a}/${b})+(${w2}+${c}/${d})`, { working: `Add the wholes (${w1} + ${w2}), then the fractions with denominator ${L}.`, explanation: `Total ${mixed(n, L)} km.` });
}
