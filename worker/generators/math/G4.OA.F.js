// G4.OA.F — Multiplication and division facts to 12 × 12, fluent (3.OA.C.7). Timed: 3 s per item (docs/03 §3).
import { ri, pick, numeric, chance } from '../lib.js';

export function generate(tier, rng) {
  const a = ri(rng, 2, 12), b = ri(rng, 2, 12);
  const base = { time_limit_s: 3 };
  if (tier === 1) return numeric(`${a} × ${b} = ?`, a * b, `${a}*${b}`, { ...base, working: 'Say the fact. No working needed.', explanation: `${a} × ${b} = ${a * b}.` });
  if (tier === 2) {
    return chance(rng, 0.5)
      ? numeric(`${a} × ? = ${a * b}`, b, `${a * b}/${a}`, { ...base, working: 'Think: what times the first number gives the total?', explanation: `${a} × ${b} = ${a * b}, so the missing number is ${b}.` })
      : numeric(`${a * b} ÷ ${a} = ?`, b, `${a * b}/${a}`, { ...base, working: 'Use the multiplication fact backwards.', explanation: `${a} × ${b} = ${a * b}, so ${a * b} ÷ ${a} = ${b}.` });
  }
  // tier 3: a related-fact pair, still one answer
  const c = pick(rng, [10, 11, 12]);
  return numeric(`${a} × ${b} = ${a * b}. So ${a} × ${b * c} = ?`, a * b * c, `${a}*${b}*${c}`, { ...base, time_limit_s: 5, working: `Multiply the known product by ${c}.`, explanation: `${a} × ${b * c} = ${a * b} × ${c} = ${a * b * c}.` });
}
