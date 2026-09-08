// 5.NBT.7 — Add, subtract, multiply, divide decimals to hundredths (5.NBT.B.7)
import { ri, pick, numeric, chance, NAMES, MONEY } from '../lib.js';
const c2 = (cents) => (cents / 100).toFixed(2);

export function generate(tier, rng) {
  if (tier === 1) {
    const a = ri(rng, 105, 4999), b = ri(rng, 105, 4999);
    return chance(rng, 0.5)
      ? numeric(`Work out ${c2(a)} + ${c2(b)}.`, c2(a + b), `(${a}+${b})/100`, { working: 'Line up the decimal points, then add like whole numbers.', explanation: `${c2(a)} + ${c2(b)} = ${c2(a + b)}.` })
      : numeric(`Work out ${c2(Math.max(a, b))} − ${c2(Math.min(a, b))}.`, c2(Math.abs(a - b)), `(${Math.max(a, b)}-${Math.min(a, b)})/100`, { working: 'Line up the decimal points; regroup as with whole numbers.', explanation: `${c2(Math.max(a, b))} − ${c2(Math.min(a, b))} = ${c2(Math.abs(a - b))}.` });
  }
  if (tier === 2) {
    if (chance(rng, 0.5)) {
      const a = ri(rng, 105, 999), k = ri(rng, 3, 9);
      return numeric(`Work out ${c2(a)} × ${k}.`, c2(a * k), `${a}*${k}/100`, { working: `Multiply ${a} × ${k} as whole numbers, then put back the two decimal places.`, explanation: `${c2(a)} × ${k} = ${c2(a * k)}.` });
    }
    const k = ri(rng, 3, 9), q = ri(rng, 105, 999);
    return numeric(`Work out ${c2(q * k)} ÷ ${k}.`, c2(q), `${q * k}/${k}/100`, { working: 'Divide as whole numbers and keep the decimal point in the same column.', explanation: `${c2(q * k)} ÷ ${k} = ${c2(q)}.` });
  }
  const name = pick(rng, NAMES), price = ri(rng, 125, 495), n = ri(rng, 2, 4), pay = pick(rng, [1000, 2000, 2000, 5000]);
  const cost = price * n; if (cost >= pay) return generate(tier, rng);
  return numeric(`${name} buys ${n} notebooks at ${c2(price)} ${MONEY} each and pays with a ${pay / 100} ${MONEY} note. How much change does ${name} get?`, c2(pay - cost), `(${pay}-${price}*${n})/100`, { working: `Cost first: ${c2(price)} × ${n} = ${c2(cost)}. Then ${pay / 100} − ${c2(cost)}.`, explanation: `Change = ${c2(pay - cost)} ${MONEY}.` });
}
