// G4.NF.1 — Equivalent fractions; compare fractions with different denominators (4.NF.A.1-2)
import { ri, pick, gcd, mc4, numeric } from '../lib.js';

const simpleFrac = (rng) => { let n, d; do { d = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]); n = ri(rng, 1, d - 1); } while (gcd(n, d) !== 1); return [n, d]; };

export function generate(tier, rng) {
  if (tier === 1) {
    const [n, d] = simpleFrac(rng); const k = ri(rng, 2, 6);
    return numeric(`Fill in the missing number: ${n}/${d} = ?/${d * k}`, n * k, `${n}*${k}`, { working: `The denominator was multiplied by ${k}, so multiply the numerator by ${k} too.`, explanation: `${n}/${d} = ${n * k}/${d * k}.` });
  }
  if (tier === 2) {
    let a, b; do { a = simpleFrac(rng); b = simpleFrac(rng); } while (a[0] * b[1] === b[0] * a[1]);
    const A = `${a[0]}/${a[1]}`, B = `${b[0]}/${b[1]}`;
    const larger = a[0] * b[1] > b[0] * a[1] ? A : B, smaller = larger === A ? B : A;
    const m = mc4(rng, larger, [{ v: smaller, why: 'compares numerators or denominators alone' }, { v: 'They are equal', why: 'not equivalent — cross-multiply to check' }, { v: 'Cannot tell', why: 'rewrite with a common denominator' }]);
    return { ...m, stem: `Which fraction is larger: ${A} or ${B}?`, working: `Common denominator ${a[1] * b[1] / gcd(a[1], b[1])}: compare the new numerators.`, explanation: `${larger} is larger because ${a[0] * b[1]} vs ${b[0] * a[1]} after cross-multiplying.` };
  }
  const set = new Map(); while (set.size < 3) { const [n, d] = simpleFrac(rng); set.set(`${n}/${d}`, n / d); }
  const labels = [...set.keys()], values = [...set.values()];
  const sorted = labels.map((l, i) => [l, values[i]]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
  return { format: 'ordering', stem: `Put these fractions in order from smallest to largest: ${labels.join('   ')}`, options: labels, answer: sorted, params: { check: { type: 'sort', values, labels } }, working: 'Rewrite all three with the same denominator, or compare each with 1/2.', explanation: `Smallest to largest: ${sorted.join(' < ')}.` };
}
