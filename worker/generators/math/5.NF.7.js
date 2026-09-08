// 5.NF.7 — Divide unit fractions by whole numbers and whole numbers by unit fractions (5.NF.B.7)
import { ri, pick, numeric, NAMES } from '../lib.js';

export function generate(tier, rng) {
  const a = ri(rng, 2, 8), b = ri(rng, 2, 9);
  if (tier === 1) {
    return { format: 'numeric', stem: `Work out 1/${a} ÷ ${b}.`, answer: `1/${a * b}`, params: { check: { type: 'expr', expr: `1/${a}/${b}` } }, working: `Sharing 1/${a} into ${b} equal parts makes pieces ${b} times smaller.`, explanation: `1/${a} ÷ ${b} = 1/${a * b}.` };
  }
  if (tier === 2) {
    return numeric(`Work out ${b} ÷ 1/${a}.`, a * b, `${b}/(1/${a})`, { working: `How many ${'1/' + a}s fit into ${b}? Each whole has ${a} of them.`, explanation: `${b} ÷ 1/${a} = ${b} × ${a} = ${a * b}.` });
  }
  const name = pick(rng, NAMES), cups = ri(rng, 2, 6), d = pick(rng, [3, 4, 5, 8]);
  return numeric(`${name} has ${cups} cups of rice. Each serving is 1/${d} of a cup. How many servings can ${name} make?`, cups * d, `${cups}/(1/${d})`, { working: `Each cup gives ${d} servings of 1/${d}.`, explanation: `${cups} × ${d} = ${cups * d} servings.` });
}
