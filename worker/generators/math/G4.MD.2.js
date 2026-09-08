// G4.MD.2 — Angles: measure with a protractor, add angle parts (4.MD.C.5-7)
import { ri, pick, mc4, numeric, chance } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const deg = pick(rng, [ri(rng, 15, 85), 90, ri(rng, 95, 175), 180]);
    const kind = deg < 90 ? 'acute' : deg === 90 ? 'right' : deg < 180 ? 'obtuse' : 'straight';
    const others = ['acute', 'right', 'obtuse', 'straight'].filter((k) => k !== kind);
    const m = mc4(rng, kind, others.map((k) => ({ v: k, why: `${k} angles are ${k === 'acute' ? 'less than 90°' : k === 'right' ? 'exactly 90°' : k === 'obtuse' ? 'between 90° and 180°' : 'exactly 180°'}` })));
    return { ...m, stem: `An angle measures ${deg}°. What kind of angle is it?`, working: 'Compare with 90° and 180°.', explanation: `${deg}° is ${kind}.` };
  }
  if (tier === 2) {
    const a = ri(rng, 15, 75);
    return numeric(`Two angles fit together to make a right angle. One of them is ${a}°. What is the other?`, 90 - a, `90-${a}`, { working: 'A right angle is 90°. Subtract.', explanation: `90 − ${a} = ${90 - a}°.` });
  }
  const a = ri(rng, 20, 80), b = ri(rng, 20, 80);
  return chance(rng, 0.5)
    ? numeric(`Three angles lie together on a straight line. Two of them are ${a}° and ${b}°. What is the third angle?`, 180 - a - b, `180-${a}-${b}`, { working: 'Angles on a straight line add to 180°.', explanation: `180 − ${a} − ${b} = ${180 - a - b}°.` })
    : numeric(`An angle is made of two parts: ${a}° and ${b}°. A third part makes the whole thing a full turn. What is the third part?`, 360 - a - b, `360-${a}-${b}`, { working: 'A full turn is 360°.', explanation: `360 − ${a} − ${b} = ${360 - a - b}°.` });
}
