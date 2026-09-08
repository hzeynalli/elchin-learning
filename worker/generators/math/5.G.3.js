// 5.G.3 — Classify two-dimensional figures in a hierarchy based on properties (5.G.B.3-4)
import { pick, shuffle, mc4 } from '../lib.js';

const ALWAYS = [['square', 'rectangle'], ['square', 'rhombus'], ['square', 'parallelogram'], ['rectangle', 'parallelogram'], ['rhombus', 'parallelogram'], ['parallelogram', 'quadrilateral'], ['rectangle', 'quadrilateral'], ['equilateral triangle', 'isosceles triangle']];
const NEVER_ALWAYS = [['rectangle', 'square'], ['parallelogram', 'rectangle'], ['rhombus', 'square'], ['quadrilateral', 'parallelogram'], ['trapezium', 'parallelogram'], ['isosceles triangle', 'equilateral triangle']];
const DESC = [
  { d: '4 equal sides and 4 right angles', name: 'square', others: ['rectangle', 'rhombus', 'parallelogram'] },
  { d: '4 equal sides and no right angles', name: 'rhombus', others: ['square', 'rectangle', 'kite'] },
  { d: '4 right angles, and the sides are not all equal', name: 'rectangle', others: ['square', 'rhombus', 'trapezium'] },
  { d: 'two pairs of parallel sides and no right angles or equal sides', name: 'parallelogram', others: ['rectangle', 'rhombus', 'trapezium'] },
  { d: 'exactly one pair of parallel sides', name: 'trapezium', others: ['parallelogram', 'rhombus', 'rectangle'] },
];

export function generate(tier, rng) {
  if (tier === 1) {
    const [sub, sup] = pick(rng, ALWAYS);
    const m = mc4(rng, sub, shuffle(rng, ['trapezium', 'kite', 'triangle', 'pentagon']).slice(0, 3).map((o) => ({ v: o, why: `a ${o} is not always a ${sup}` })));
    return { ...m, stem: `Which shape is ALWAYS a ${sup}?`, working: `Ask: does every ${sub} have all the properties of a ${sup}?`, explanation: `Every ${sub} is a ${sup}.` };
  }
  if (tier === 2) {
    const t = pick(rng, ALWAYS), fs = shuffle(rng, NEVER_ALWAYS).slice(0, 3);
    const m = mc4(rng, `Every ${t[0]} is a ${t[1]}.`, fs.map(([a, b]) => ({ v: `Every ${a} is a ${b}.`, why: `a ${a} does not have to have the extra properties of a ${b}` })));
    return { ...m, stem: 'Which statement is TRUE?', working: 'Move down the hierarchy: the more special shape has all the properties of the general one, not the other way round.', explanation: `Every ${t[0]} is a ${t[1]}.` };
  }
  const q = pick(rng, DESC);
  const m = mc4(rng, q.name, q.others.map((o) => ({ v: o, why: `a ${o} does not match every property listed` })));
  return { ...m, stem: `A quadrilateral has ${q.d}. What is the most specific name for it?`, working: 'Check sides, angles and parallel pairs, then choose the most specific name.', explanation: `${q.d} → ${q.name}.` };
}
