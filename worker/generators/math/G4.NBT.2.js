// G4.NBT.2 — Add and subtract multi-digit numbers with regrouping (4.NBT.B.4)
import { ri, pick, fmt, numeric, NAMES, CONTEXTS } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    let a, b; do { a = ri(rng, 120, 899); b = ri(rng, 120, 899); } while ((a % 10) + (b % 10) < 10);   // force a carry in the ones
    return numeric(`Work out ${fmt(a)} + ${fmt(b)}.`, a + b, `${a}+${b}`, { working: 'Line up the ones, tens and hundreds. Add the ones first; carry the ten.', explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}.` });
  }
  if (tier === 2) {
    // subtraction with a zero in the minuend so a borrow crosses it (e.g. 60,304 − 27,856)
    const ones = ri(rng, 1, 8);
    const a = ri(rng, 5, 9) * 10000 + pick(rng, [0, 0, 1]) * 1000 + ri(rng, 0, 9) * 100 + ones;            // tens digit 0
    const b = ri(rng, 1, 4) * 10000 + ri(rng, 0, 9) * 1000 + ri(rng, 0, 9) * 100 + ri(rng, 1, 9) * 10 + ri(rng, ones + 1, 9);   // b < a, ones borrow
    return numeric(`Work out ${fmt(a)} − ${fmt(b)}. Show your working.`, a - b, `${a}-${b}`, { working: 'Ones column: you cannot take away, so borrow from the next non-zero place and move the borrow across the zero.', explanation: `${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}. Check: ${fmt(a - b)} + ${fmt(b)} = ${fmt(a)}.` });
  }
  const name = pick(rng, NAMES), c = pick(rng, CONTEXTS);
  const start = ri(rng, 2000, 9000), sold = ri(rng, 500, start - 500), more = ri(rng, 300, 2500), dist = ri(rng, 3, 9);
  const ans = start - sold + more;
  return numeric(`${name}'s ${c.place} had ${fmt(start)} ${c.thing}. It gave away ${fmt(sold)} to ${dist} other places, then received ${fmt(more)} more. How many ${c.thing} does it have now?`, ans, `${start}-${sold}+${more}`, { working: `First ${fmt(start)} − ${fmt(sold)} = ${fmt(start - sold)}, then add ${fmt(more)}. The number ${dist} is not needed.`, explanation: `${fmt(start)} − ${fmt(sold)} + ${fmt(more)} = ${fmt(ans)}.` });
}
