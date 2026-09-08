// 5.NBT.6a — Relate multiplication and division; use the inverse to check (5.NBT.B.6 intro)
import { ri, pick, fmt, mc4, numeric, chance, NAMES } from '../lib.js';

export function generate(tier, rng) {
  const name = pick(rng, NAMES);
  if (tier === 1) {
    const b = ri(rng, 3, 9), q = ri(rng, 4, 12), a = b * q;
    const m = mc4(rng, `${b} × ${q} = ${a}`, [{ v: `${a} × ${b} = ${a * b}`, why: 'multiplies the dividend, does not undo the division' }, { v: `${q} ÷ ${b} = ${a}`, why: 'another division does not check a division' }, { v: `${b} + ${q} = ${b + q}`, why: 'addition does not undo division' }]);
    return { ...m, stem: `Which multiplication checks that ${a} ÷ ${b} = ${q}?`, working: 'Division and multiplication undo each other: divisor × quotient = dividend.', explanation: `${b} × ${q} = ${a}, so the division is correct.` };
  }
  if (tier === 2) {
    const b = ri(rng, 3, 9), q = ri(rng, 120, 980);
    const claim = chance(rng, 0.5) ? q : q + pick(rng, [-10, 10, 1, -1]);
    const a = b * q;
    return numeric(`${name} says ${fmt(a)} ÷ ${b} = ${claim}. Work out ${claim} × ${b} to check. What do you get?`, claim * b, `${claim}*${b}`, { working: 'Multiply the answer by the divisor; it should give the number you started with.', explanation: `${claim} × ${b} = ${fmt(claim * b)}${claim * b === a ? `, which equals ${fmt(a)} — ${name} is right.` : `, not ${fmt(a)} — ${name} is wrong; the answer is ${q}.`}` });
  }
  const b = ri(rng, 4, 9), q = ri(rng, 23, 99), r = ri(rng, 1, b - 1);
  return numeric(`A number divided by ${b} gives ${q} with remainder ${r}. What is the number?`, b * q + r, `${b}*${q}+${r}`, { working: 'Undo the division: divisor × quotient, then add the remainder.', explanation: `${b} × ${q} = ${b * q}; plus ${r} = ${b * q + r}.` });
}
