// G4.OA.2 — Multi-step word problems, four operations, interpret remainders (4.OA.A.3)
import { ri, pick, fmt, numeric, NAMES, CONTEXTS, MONEY } from '../lib.js';

export function generate(tier, rng) {
  const name = pick(rng, NAMES), c = pick(rng, CONTEXTS);
  if (tier === 1) {
    const packs = ri(rng, 3, 9), per = ri(rng, 6, 12), extra = ri(rng, 2, 9);
    return numeric(`${name} buys ${packs} ${c.pack}s of ${per} ${c.thing} and ${extra} more loose ${c.thing}. How many ${c.thing} does ${name} have?`, packs * per + extra, `${packs}*${per}+${extra}`, { working: `${packs} × ${per} first, then add ${extra}.`, explanation: `${packs} × ${per} = ${packs * per}; ${packs * per} + ${extra} = ${packs * per + extra}.` });
  }
  if (tier === 2) {
    const packs = ri(rng, 8, 15), per = ri(rng, 12, 30), bag = pick(rng, [4, 5, 6, 8]);
    let sold; do { sold = ri(rng, 40, packs * per - 40); } while ((packs * per - sold) % bag !== 0);
    const ans = (packs * per - sold) / bag;
    return numeric(`A ${c.place} has ${packs} ${c.pack}s of ${per} ${c.thing}. It gives out ${sold} ${c.thing}, then packs the rest into bags of ${bag}. How many bags are there?`, ans, `(${packs}*${per}-${sold})/${bag}`, { working: `Total ${packs} × ${per} = ${packs * per}; left ${packs * per} − ${sold} = ${packs * per - sold}; bags = ${packs * per - sold} ÷ ${bag}.`, explanation: `${fmt(ans)} bags.` });
  }
  const per = ri(rng, 18, 30), packs = ri(rng, 12, 20), each = ri(rng, 5, 9), students = ri(rng, 20, 34), price = ri(rng, 2, 6);
  const total = per * packs, given = each * students; const left = total - given;
  if (left < 0) return generate(tier, rng);
  return numeric(`A ${c.pack} holds ${per} ${c.thing} and costs ${price} ${MONEY}. ${name}'s ${c.place} buys ${packs} ${c.pack}s and gives ${each} ${c.thing} to each of ${students} students. How many ${c.thing} are left over?`, left, `${per}*${packs}-${each}*${students}`, { working: `Bought: ${per} × ${packs} = ${fmt(total)}. Given out: ${each} × ${students} = ${fmt(given)}. Left: ${fmt(total)} − ${fmt(given)}. The price is not needed.`, explanation: `${fmt(total)} − ${fmt(given)} = ${fmt(left)} ${c.thing} left.` });
}
