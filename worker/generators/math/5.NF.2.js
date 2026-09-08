// 5.NF.2 — Word problems with fractions; estimate with benchmark fractions (5.NF.A.2)
import { ri, pick, lcm, frac, mixed, mc4, NAMES } from '../lib.js';
const fracItem = (stem, n, d, expr, extra) => ({ format: 'numeric', stem, answer: frac(n, d), accept: [`${n}/${d}`, mixed(n, d)], params: { check: { type: 'expr', expr } }, ...extra });
const NEAR = { 0: ['1/8', '1/10', '1/12'], 0.5: ['3/8', '4/9', '5/12', '1/2', '5/9'], 1: ['7/8', '9/10', '5/6', '11/12'] };
const BENCH = [['about 0', 0], ['about 1/2', 0.5], ['about 1', 1], ['about 1 1/2', 1.5], ['about 2', 2]];

export function generate(tier, rng) {
  const name = pick(rng, NAMES);
  if (tier === 1) {
    const k1 = pick(rng, [0, 0.5, 1]), k2 = pick(rng, [0, 0.5, 1]);
    const f1 = pick(rng, NEAR[k1]), f2 = pick(rng, NEAR[k2]);
    const val = f1.split('/').reduce((a, b) => a / b) + f2.split('/').reduce((a, b) => a / b);
    const best = BENCH.reduce((b, x) => (Math.abs(x[1] - val) < Math.abs(b[1] - val) ? x : b));
    const m = mc4(rng, best[0], BENCH.filter((x) => x !== best).slice(0, 3).map((x) => ({ v: x[0], why: 'compare each fraction with 0, 1/2 and 1 first' })));
    return { ...m, stem: `Estimate: ${f1} + ${f2} is…`, working: `${f1} is close to ${k1 === 0.5 ? '1/2' : k1}; ${f2} is close to ${k2 === 0.5 ? '1/2' : k2}.`, explanation: `${f1} + ${f2} ≈ ${best[0].replace('about ', '')}.`, params: { check: { type: 'choice', correct: best[0] } } };
  }
  if (tier === 2) {
    const [a, b] = [ri(rng, 1, 2), pick(rng, [3, 4])], [c, d] = [ri(rng, 1, 3), pick(rng, [4, 6, 8].filter((x) => x !== b))];
    const L = lcm(b, d), n = a * (L / b) + c * (L / d);
    return fracItem(`${name} used ${a}/${b} of a cup of flour and ${c}/${d} of a cup of sugar. How many cups altogether?`, n, L, `${a}/${b}+${c}/${d}`, { working: `Same denominator ${L}, then add.`, explanation: `${a}/${b} + ${c}/${d} = ${frac(n, L)} cups.` });
  }
  const total = ri(rng, 4, 8); const [w1, a, b] = [ri(rng, 1, 2), 1, 2], [w2, c, d] = [1, ri(rng, 1, 3), 4];
  const L = 4, used = (w1 * 2 + a) * 2 + (w2 * 4 + c), left = total * L - used;
  if (left <= 0) return generate(tier, rng);
  return fracItem(`A ribbon is ${total} m long. ${name} cuts off ${w1} ${a}/${b} m, then another ${w2} ${c}/${d} m. How much ribbon is left?`, left, L, `${total}-(${w1}+${a}/${b})-(${w2}+${c}/${d})`, { working: `Total used: ${mixed(used, L)} m. Then ${total} − that.`, explanation: `${total} − ${mixed(used, L)} = ${mixed(left, L)} m.` });
}
