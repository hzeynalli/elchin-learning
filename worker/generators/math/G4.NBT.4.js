// G4.NBT.4 — Divide up to 4-digit by 1-digit with remainders (4.NBT.B.6)
import { ri, pick, fmt, numeric, NAMES } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const b = ri(rng, 3, 9), q = ri(rng, 4, 12);
    return numeric(`Work out ${b * q} ÷ ${b}.`, q, `${b * q}/${b}`, { working: `Which times-table fact gives ${b * q}?`, explanation: `${b} × ${q} = ${b * q}, so ${b * q} ÷ ${b} = ${q}.` });
  }
  if (tier === 2) {
    const b = ri(rng, 3, 9); let a; do { a = ri(rng, 400, 9999); } while (a % b === 0);
    const q = Math.floor(a / b), r = a % b;
    return { format: 'numeric', stem: `Work out ${fmt(a)} ÷ ${b}. Write the remainder.`, answer: `${q} r ${r}`, accept: [`${q} remainder ${r}`, `${q}r${r}`], params: { check: { type: 'divrem', a, b } }, working: 'Divide place by place from the left; the leftover at the end is the remainder.', explanation: `${b} × ${q} = ${fmt(b * q)}, and ${fmt(a)} − ${fmt(b * q)} = ${r}, so ${q} r ${r}.` };
  }
  const name = pick(rng, NAMES), cap = pick(rng, [4, 5, 6, 7, 8, 9]);
  let n; do { n = ri(rng, 60, 400); } while (n % cap === 0);
  const buses = Math.ceil(n / cap);
  return numeric(`${name} is packing ${n} cupcakes into boxes. Each box holds ${cap}. How many boxes are needed so that every cupcake is in a box?`, buses, `ceil(${n}/${cap})`, { working: `${n} ÷ ${cap} = ${Math.floor(n / cap)} r ${n % cap}. The remainder still needs a box, so round up.`, explanation: `${Math.floor(n / cap)} full boxes plus 1 for the ${n % cap} left over = ${buses} boxes.` });
}
