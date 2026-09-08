// G4.NBT.3 — Multiply up to 4-digit by 1-digit and 2-digit by 2-digit (4.NBT.B.5)
import { ri, pick, fmt, numeric, chance, NAMES, CONTEXTS } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const a = ri(rng, 12, 89), b = ri(rng, 3, 9);
    return numeric(`Work out ${a} × ${b}.`, a * b, `${a}*${b}`, { working: `Split ${a} into tens and ones: ${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b}.`, explanation: `${a} × ${b} = ${fmt(a * b)}.` });
  }
  if (tier === 2) {
    if (chance(rng, 0.5)) {
      const a = ri(rng, 1002, 9899), b = ri(rng, 3, 9);
      return numeric(`Work out ${fmt(a)} × ${b}.`, a * b, `${a}*${b}`, { working: 'Multiply ones, tens, hundreds, thousands; carry each time.', explanation: `${fmt(a)} × ${b} = ${fmt(a * b)}.` });
    }
    const a = ri(rng, 23, 89), b = ri(rng, 12, 79);
    return numeric(`Work out ${a} × ${b}.`, a * b, `${a}*${b}`, { working: `${a} × ${b % 10} and ${a} × ${Math.floor(b / 10) * 10}, then add.`, explanation: `${a} × ${b} = ${fmt(a * b)}.` });
  }
  const name = pick(rng, NAMES), c = pick(rng, CONTEXTS);
  const per = ri(rng, 12, 48), packs = ri(rng, 13, 39), noise = ri(rng, 20, 60);
  return numeric(`A ${c.pack} holds ${per} ${c.thing}. ${name}'s ${c.place} buys ${packs} ${c.pack}s for its ${noise} students. How many ${c.thing} is that altogether?`, per * packs, `${per}*${packs}`, { working: `Total = ${per} × ${packs}. The number of students (${noise}) is not needed for this question.`, explanation: `${per} × ${packs} = ${fmt(per * packs)} ${c.thing}.` });
}
