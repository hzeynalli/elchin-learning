// 5.NBT.2 — Powers of 10 with exponents; multiply/divide whole numbers by powers of 10 (5.NBT.A.2)
import { ri, pick, fmt, numeric, chance } from '../lib.js';
const sup = (k) => ({ 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' }[k]);

export function generate(tier, rng) {
  if (tier === 1) {
    const k = ri(rng, 2, 6);
    return chance(rng, 0.5)
      ? numeric(`What is the value of 10${sup(k)}?`, 10 ** k, `${10 ** k}`, { working: `10${sup(k)} means ${Array(k).fill('10').join(' × ')}.`, explanation: `10${sup(k)} = ${fmt(10 ** k)} — a 1 followed by ${k} zeros.` })
      : { format: 'fill_blank', stem: `Write ${Array(k).fill('10').join(' × ')} using an exponent.`, answer: `10^${k}`, accept: [`10${sup(k)}`, `10 ^ ${k}`, `10**${k}`], params: { check: { type: 'text', value: 10 ** k } }, working: 'Count how many tens are multiplied; that is the exponent.', explanation: `${k} tens → 10^${k} = ${fmt(10 ** k)}.` };
  }
  if (tier === 2) {
    const a = ri(rng, 12, 98), k = ri(rng, 1, 4);
    const kind = pick(rng, ['mul', 'exp', 'div']);
    if (kind === 'mul') return numeric(`${a} × ${fmt(10 ** k)} = ?`, a * 10 ** k, `${a}*${10 ** k}`, { working: `Multiplying by ${fmt(10 ** k)} moves every digit ${k} place${k > 1 ? 's' : ''} to the left.`, explanation: `${a} × ${fmt(10 ** k)} = ${fmt(a * 10 ** k)}.` });
    if (kind === 'exp') return numeric(`${a} × 10${sup(k)} = ?`, a * 10 ** k, `${a}*${10 ** k}`, { working: `10${sup(k)} = ${fmt(10 ** k)}.`, explanation: `${a} × ${fmt(10 ** k)} = ${fmt(a * 10 ** k)}.` });
    return numeric(`${fmt(a * 10 ** k)} ÷ 10${sup(k)} = ?`, a, `${a * 10 ** k}/${10 ** k}`, { working: `Dividing by 10${sup(k)} moves every digit ${k} place${k > 1 ? 's' : ''} to the right.`, explanation: `${fmt(a * 10 ** k)} ÷ ${fmt(10 ** k)} = ${a}.` });
  }
  const a = ri(rng, 2, 9), b = ri(rng, 2, 9), ka = ri(rng, 1, 2), kb = ri(rng, 2, 3);
  const A = a * 10 ** ka, B = b * 10 ** kb;
  return numeric(`Use a pattern to work out ${fmt(A)} × ${fmt(B)}. (Think: ${a} × ${b}, then the zeros.)`, A * B, `${A}*${B}`, { working: `${a} × ${b} = ${a * b}; then add ${ka + kb} zeros${a * b % 10 === 0 ? ' (careful: the product already ends in 0)' : ''}.`, explanation: `${fmt(A)} × ${fmt(B)} = ${fmt(A * B)}.` });
}
