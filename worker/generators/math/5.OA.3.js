// 5.OA.3 — Numerical patterns from two rules; ordered pairs; relationships (5.OA.B.3)
import { ri, pick, numeric, mc4 } from '../lib.js';

export function generate(tier, rng) {
  const start = ri(rng, 0, 5), step = ri(rng, 2, 9), k = ri(rng, 2, 4);
  if (tier === 1) {
    const n = ri(rng, 4, 8);
    return numeric(`A pattern starts at ${start} and adds ${step} each time. What is the ${n}th number?`, start + step * (n - 1), `${start}+${step}*(${n}-1)`, { working: `Write the first few: ${[0, 1, 2].map((i) => start + step * i).join(', ')}…`, explanation: `${n}th term = ${start} + ${step} × ${n - 1} = ${start + step * (n - 1)}.` });
  }
  if (tier === 2) {
    const n = ri(rng, 3, 6); const A = step * (n - 1), B = step * k * (n - 1);
    return numeric(`Pattern A starts at 0 and adds ${step}. Pattern B starts at 0 and adds ${step * k}. When A is ${A}, what is B?`, B, `${A}*${k}`, { working: `Both are at the same position in the pattern: term ${n}.`, explanation: `B = ${step * k} × ${n - 1} = ${B} (always ${k} times A).` });
  }
  const seqA = [0, 1, 2, 3].map((i) => step * i), seqB = seqA.map((x) => x * k);
  const m = mc4(rng, `Each number in B is ${k} times the matching number in A.`, [{ v: `Each number in B is ${step * k - step} more than the matching number in A.`, why: 'true only for the second term' }, { v: `Each number in A is ${k} times the matching number in B.`, why: 'backwards' }, { v: `B adds ${step} each time, like A.`, why: 'B adds ' + step * k }]);
  return { ...m, stem: `Pattern A: ${seqA.join(', ')}, …   Pattern B: ${seqB.join(', ')}, …   How are the matching numbers related?`, working: 'Compare pairs: (0, 0), (' + seqA[1] + ', ' + seqB[1] + '), (' + seqA[2] + ', ' + seqB[2] + ').', explanation: `B = ${k} × A for every pair.` };
}
