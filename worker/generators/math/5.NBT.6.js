// 5.NBT.6 — Divide up to 4-digit numbers by 2-digit divisors; interpret remainders (5.NBT.B.6)
import { ri, pick, fmt, numeric, NAMES } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const b = ri(rng, 11, 25), q = ri(rng, 3, 9);
    return numeric(`Work out ${b * q} ÷ ${b}.`, q, `${b * q}/${b}`, { working: `Think: ${b} × ? = ${b * q}.`, explanation: `${b} × ${q} = ${b * q}, so the answer is ${q}.` });
  }
  if (tier === 2) {
    const b = ri(rng, 12, 48); let a; do { a = ri(rng, 300, 9999); } while (a % b === 0);
    const q = Math.floor(a / b), r = a % b;
    return { format: 'numeric', stem: `Work out ${fmt(a)} ÷ ${b}. Write the remainder.`, answer: `${q} r ${r}`, accept: [`${q} remainder ${r}`, `${q}r${r}`], params: { check: { type: 'divrem', a, b } }, working: `Estimate first: ${fmt(a)} ÷ ${b} is about ${Math.round(a / b / 10) * 10}. Then long division.`, explanation: `${b} × ${q} = ${fmt(b * q)}; ${fmt(a)} − ${fmt(b * q)} = ${r}; so ${q} r ${r}.` };
  }
  const name = pick(rng, NAMES), cap = ri(rng, 12, 45); let n; do { n = ri(rng, 200, 2000); } while (n % cap === 0);
  const kind = pick(rng, ['up', 'down', 'rem']);
  if (kind === 'up') return numeric(`${fmt(n)} people are going on a trip. Each bus holds ${cap}. How many buses are needed?`, Math.ceil(n / cap), `ceil(${n}/${cap})`, { working: `${fmt(n)} ÷ ${cap} = ${Math.floor(n / cap)} r ${n % cap}. The leftover people still need a bus.`, explanation: `${Math.floor(n / cap)} full buses + 1 more = ${Math.ceil(n / cap)}.` });
  if (kind === 'down') return numeric(`${name} has ${fmt(n)} beads and makes bracelets of ${cap} beads each. How many complete bracelets can ${name} make?`, Math.floor(n / cap), `floor(${n}/${cap})`, { working: 'Only complete bracelets count — ignore the remainder.', explanation: `${fmt(n)} ÷ ${cap} = ${Math.floor(n / cap)} r ${n % cap} → ${Math.floor(n / cap)} bracelets.` });
  return numeric(`${name} shares ${fmt(n)} stickers equally among ${cap} friends. How many stickers are left over?`, n % cap, `${n}-floor(${n}/${cap})*${cap}`, { working: 'The remainder is what is left after equal sharing.', explanation: `${fmt(n)} ÷ ${cap} = ${Math.floor(n / cap)} r ${n % cap} → ${n % cap} left over.` });
}
