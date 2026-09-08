// 5.NBT.4 — Round decimals to any place (5.NBT.A.4)
import { ri, pick, numeric, MONEY } from '../lib.js';
const r = (x, p) => (Math.round(x * 10 ** p + 1e-9) / 10 ** p).toFixed(p);

export function generate(tier, rng) {
  if (tier === 1) {
    const whole = ri(rng, 2, 99), d = ri(rng, 1, 99);
    const x = Number(`${whole}.${String(d).padStart(2, '0')}`);
    return numeric(`Round ${x.toFixed(2)} to the nearest whole number.`, r(x, 0), `floor(${x} + 0.5)`, { working: 'Look at the tenths digit: 5 or more rounds up.', explanation: `${x.toFixed(2)} → ${r(x, 0)}.` });
  }
  if (tier === 2) {
    const whole = ri(rng, 0, 40), d = ri(rng, 1, 999), p = pick(rng, [1, 2]);
    const x = Number(`${whole}.${String(d).padStart(3, '0')}`);
    return numeric(`Round ${x.toFixed(3)} to the nearest ${p === 1 ? 'tenth' : 'hundredth'}.`, r(x, p), `floor(${x} * ${10 ** p} + 0.5) / ${10 ** p}`, { working: `Keep ${p} decimal place${p > 1 ? 's' : ''}; look at the next digit.`, explanation: `${x.toFixed(3)} → ${r(x, p)}.` });
  }
  const whole = ri(rng, 1, 9), d = ri(rng, 1, 999), m = ri(rng, 2, 6);
  const price = Number(`${whole}.${String(d).padStart(3, '0')}`);
  const total = price * m;
  return numeric(`Ribbon costs ${price.toFixed(3)} ${MONEY} per metre. ${m} metres cost ${total.toFixed(3)} ${MONEY}. Round that to the nearest hundredth (the nearest qəpik).`, r(total, 2), `floor(${total.toFixed(6)} * 100 + 0.5) / 100`, { working: 'Hundredths = two decimal places. Look at the thousandths digit.', explanation: `${total.toFixed(3)} → ${r(total, 2)} ${MONEY}.` });
}
