// 5.FLU — Speed: facts and single-step procedures under 3 s each (MAP timing). Timed client-side.
import { ri, pick, numeric, fmt } from '../lib.js';

export function generate(tier, rng) {
  const t = { time_limit_s: 3 };
  if (tier === 1) {
    const kind = pick(rng, ['add', 'sub', 'x10']);
    if (kind === 'add') { const a = ri(rng, 11, 89), b = ri(rng, 2, 9); return numeric(`${a} + ${b} = ?`, a + b, `${a}+${b}`, { ...t, working: 'Count on from the bigger number.', explanation: `${a} + ${b} = ${a + b}.` }); }
    if (kind === 'sub') { const a = ri(rng, 20, 99), b = ri(rng, 2, 9); return numeric(`${a} − ${b} = ?`, a - b, `${a}-${b}`, { ...t, working: 'Count back.', explanation: `${a} − ${b} = ${a - b}.` }); }
    const a = ri(rng, 3, 99); return numeric(`${a} × 10 = ?`, a * 10, `${a}*10`, { ...t, working: 'Add a zero.', explanation: `${a} × 10 = ${a * 10}.` });
  }
  if (tier === 2) {
    const kind = pick(rng, ['double', 'half', 'to100', 'x100']);
    if (kind === 'double') { const a = ri(rng, 12, 60); return numeric(`Double ${a}`, a * 2, `${a}*2`, { ...t, working: 'Double the tens, double the ones, add.', explanation: `${a} × 2 = ${a * 2}.` }); }
    if (kind === 'half') { const a = ri(rng, 6, 49) * 2; return numeric(`Half of ${a}`, a / 2, `${a}/2`, { ...t, working: 'Halve the tens, halve the ones.', explanation: `${a} ÷ 2 = ${a / 2}.` }); }
    if (kind === 'to100') { const a = ri(rng, 11, 89); return numeric(`${a} + ? = 100`, 100 - a, `100-${a}`, { ...t, working: 'Up to the next ten, then to 100.', explanation: `100 − ${a} = ${100 - a}.` }); }
    const a = ri(rng, 3, 99); return numeric(`${a} × 100 = ?`, a * 100, `${a}*100`, { ...t, working: 'Add two zeros.', explanation: `${a} × 100 = ${fmt(a * 100)}.` });
  }
  const kind = pick(rng, ['x2digit', 'div', 'mixed']);
  if (kind === 'x2digit') { const a = ri(rng, 12, 25), b = ri(rng, 3, 9); return numeric(`${a} × ${b} = ?`, a * b, `${a}*${b}`, { ...t, time_limit_s: 5, working: `${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b}.`, explanation: `${a} × ${b} = ${a * b}.` }); }
  if (kind === 'div') { const b = ri(rng, 3, 9), q = ri(rng, 11, 19); return numeric(`${b * q} ÷ ${b} = ?`, q, `${b * q}/${b}`, { ...t, time_limit_s: 5, working: 'Think of the times-table fact just above 10.', explanation: `${b} × ${q} = ${b * q}.` }); }
  const a = ri(rng, 100, 900), b = ri(rng, 10, 90); return numeric(`${a} − ${b} = ?`, a - b, `${a}-${b}`, { ...t, time_limit_s: 5, working: 'Subtract the tens, then adjust.', explanation: `${a} − ${b} = ${a - b}.` });
}
