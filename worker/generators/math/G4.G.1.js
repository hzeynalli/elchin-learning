// G4.G.1 — Lines, angles, classify 2-D shapes, symmetry (4.G.A.1-3)
import { pick, mc4, numeric } from '../lib.js';

const SHAPES = [
  { name: 'square', sym: 4, fact: '4 equal sides and 4 right angles' }, { name: 'rectangle', sym: 2, fact: '4 right angles, opposite sides equal' },
  { name: 'equilateral triangle', sym: 3, fact: '3 equal sides' }, { name: 'isosceles triangle', sym: 1, fact: '2 equal sides' },
  { name: 'regular pentagon', sym: 5, fact: '5 equal sides' }, { name: 'regular hexagon', sym: 6, fact: '6 equal sides' },
  { name: 'rhombus', sym: 2, fact: '4 equal sides, opposite angles equal' }, { name: 'trapezium', sym: 0, fact: 'exactly one pair of parallel sides' },
  { name: 'parallelogram', sym: 0, fact: 'two pairs of parallel sides, no right angles' }, { name: 'kite', sym: 1, fact: 'two pairs of adjacent equal sides' },
];
const TRUE = ['Every square is a rectangle.', 'Every square is a rhombus.', 'A rectangle has two pairs of parallel sides.', 'An equilateral triangle has three lines of symmetry.', 'Perpendicular lines meet at a right angle.', 'Parallel lines never meet.'];
const FALSE = [['Every rectangle is a square.', 'a rectangle need not have equal sides'], ['A trapezium has two pairs of parallel sides.', 'a trapezium has exactly one pair'], ['A right angle is 180°.', 'a right angle is 90°'], ['Parallel lines meet at one point.', 'parallel lines never meet'], ['A rhombus must have right angles.', 'a rhombus has equal sides, not necessarily right angles'], ['An isosceles triangle has three equal sides.', 'that is equilateral']];

export function generate(tier, rng) {
  if (tier === 1) {
    const s = pick(rng, SHAPES.filter((x) => x.sym > 0));
    return numeric(`How many lines of symmetry does a ${s.name} have?`, s.sym, String(s.sym), { working: 'Imagine folding the shape so both halves match exactly.', explanation: `A ${s.name} has ${s.sym} line${s.sym === 1 ? '' : 's'} of symmetry.` });
  }
  if (tier === 2) {
    const s = pick(rng, SHAPES);
    const others = SHAPES.filter((x) => x !== s);
    const m = mc4(rng, s.name, [others[0], others[3], others[6]].map((o) => ({ v: o.name, why: `a ${o.name} has ${o.fact}` })));
    return { ...m, stem: `Which shape has ${s.fact}?`, working: 'Check sides, angles and parallel pairs one at a time.', explanation: `A ${s.name} has ${s.fact}.` };
  }
  const t = pick(rng, TRUE); const fs = [...FALSE].sort(() => rng() - 0.5).slice(0, 3);
  const m = mc4(rng, t, fs.map(([f, why]) => ({ v: f, why })));
  return { ...m, stem: 'Which statement is TRUE?', working: 'Test each statement against the definition of the shape.', explanation: `"${t}" is true.` };
}
