// 5.OA.PROP — Properties of operations: commutative, associative, distributive, identity (Go Math 1.3)
import { ri, pick, mc4, numeric, chance } from '../lib.js';

const PROPS = ['commutative', 'associative', 'distributive', 'identity'];
const WHY = { commutative: 'commutative = swap the order (a × b = b × a)', associative: 'associative = change the grouping ((a × b) × c = a × (b × c))', distributive: 'distributive = split one factor (a × (b + c) = a × b + a × c)', identity: 'identity = × 1 or + 0 leaves the number unchanged' };

export function generate(tier, rng) {
  const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
  if (tier === 1) {
    const which = pick(rng, PROPS);
    const eq = { commutative: `${a} × ${b} = ${b} × ${a}`, associative: `(${a} × ${b}) × ${c} = ${a} × (${b} × ${c})`, distributive: `${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ${c}`, identity: `${a * b} × 1 = ${a * b}` }[which];
    const m = mc4(rng, which, PROPS.filter((p) => p !== which).map((p) => ({ v: p, why: WHY[p] })));
    return { ...m, stem: `Which property is shown here?  ${eq}`, working: 'Order changed → commutative. Grouping changed → associative. A factor split into two → distributive. × 1 → identity.', explanation: `${eq} shows the ${which} property.` };
  }
  if (tier === 2) {
    return chance(rng, 0.5)
      ? numeric(`Fill in the blank using the associative property: (${a} × ${b}) × ${c} = ${a} × (___ × ${c})`, b, String(b), { working: 'The grouping moves; the numbers stay in the same order.', explanation: `${a} × (${b} × ${c}) — the blank is ${b}.` })
      : numeric(`Fill in the blank using the distributive property: ${a} × ${b * 10 + c} = ${a} × ${b * 10} + ${a} × ___`, c, String(c), { working: `${b * 10 + c} = ${b * 10} + ${c}.`, explanation: `${a} × ${b * 10} + ${a} × ${c} = ${a * (b * 10 + c)}. The blank is ${c}.` });
  }
  const n = b * 10 + c;
  const correct = `${a} × ${b * 10} + ${a} × ${c}`;
  const m = mc4(rng, correct, [{ v: `${a} × ${b * 10} + ${c}`, why: 'forgot to multiply the second part' }, { v: `${a} × ${b} + ${a} × ${c}`, why: `${n} is ${b * 10} + ${c}, not ${b} + ${c}` }, { v: `${a} + ${b * 10} × ${c}`, why: 'not the distributive property' }]);
  return { ...m, stem: `Which expression uses the distributive property to work out ${a} × ${n}?`, working: `Split ${n} into ${b * 10} + ${c} and multiply each part by ${a}.`, explanation: `${correct} = ${a * b * 10} + ${a * c} = ${a * n}.` };
}
