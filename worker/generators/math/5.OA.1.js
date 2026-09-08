// 5.OA.1 — Evaluate expressions with parentheses, brackets, braces; order of operations (5.OA.A.1)
// Answers computed in code (numeric) or the mistake named in code (mc4). The LLM never touches them.
import { ri, pick, mc4, numeric, chance, NAMES } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const a = ri(rng, 2, 20), b = ri(rng, 2, 9), c = ri(rng, 2, 9), d = ri(rng, 1, 9);
    return chance(rng, 0.5)
      ? numeric(`Work out ${a} + ${b} × ${c}.`, a + b * c, `${a}+${b}*${c}`, { working: 'Multiply before you add.', explanation: `${b} × ${c} = ${b * c}; ${a} + ${b * c} = ${a + b * c}.` })
      : numeric(`Work out ${a} + ${b} × ${c} − ${d}.`, a + b * c - d, `${a}+${b}*${c}-${d}`, { working: 'Multiply first, then add and subtract from left to right.', explanation: `${a} + ${b * c} − ${d} = ${a + b * c - d}.` });
  }
  if (tier === 2) {
    if (chance(rng, 0.5)) {
      const a = ri(rng, 3, 30), b = ri(rng, 2, 20), c = ri(rng, 2, 6), d = ri(rng, 1, 15);
      return numeric(`Work out (${a} + ${b}) × ${c} − ${d}.`, (a + b) * c - d, `(${a}+${b})*${c}-${d}`, { working: 'Brackets first, then multiply, then subtract.', explanation: `(${a + b}) × ${c} = ${(a + b) * c}; minus ${d} = ${(a + b) * c - d}.` });
    }
    const b = ri(rng, 2, 6), c = ri(rng, 1, 6), k = ri(rng, 2, 9), d = ri(rng, 2, 6); const a = (b + c) * k;
    return numeric(`Work out ${a} ÷ (${b} + ${c}) × ${d}.`, k * d, `${a}/(${b}+${c})*${d}`, { working: 'Brackets first; then ÷ and × from left to right.', explanation: `${a} ÷ ${b + c} = ${k}; ${k} × ${d} = ${k * d}.` });
  }
  if (chance(rng, 0.6)) {
    const c = ri(rng, 2, 6), q = ri(rng, 2, 9), b = ri(rng, 1, 12), a = b + c * q, d = ri(rng, 2, 9), e = ri(rng, 2, 9);
    return numeric(`Work out [(${a} − ${b}) ÷ ${c}] + ${d} × ${e}.`, q + d * e, `((${a}-${b})/${c})+${d}*${e}`, { working: 'Inside the brackets first: subtract, then divide. Then the multiplication. Then add.', explanation: `(${a} − ${b}) ÷ ${c} = ${q}; ${d} × ${e} = ${d * e}; total ${q + d * e}.` });
  }
  // find the mistake
  const name = pick(rng, NAMES), a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
  const right = a + b * c, wrong = (a + b) * c;
  const m = mc4(rng, `${name} added first. The correct answer is ${right}.`, [
    { v: `${name} is right: ${wrong} is correct.`, why: 'adding before multiplying breaks the order of operations' },
    { v: `${name} multiplied first. The correct answer is ${wrong}.`, why: 'multiplying first gives ' + right },
    { v: `${name} added first. The correct answer is ${a * b + c}.`, why: 'multiplied the wrong pair' }]);
  return { ...m, stem: `${name} worked out ${a} + ${b} × ${c} and got ${wrong}. What went wrong, and what is the correct answer?`, working: 'Order of operations: × before +.', explanation: `${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${right}. ${name} added ${a} + ${b} first.` };
}
