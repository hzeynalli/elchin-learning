// 5.G.1 — Coordinate plane, first quadrant: plot and interpret points (5.G.A.1-2)
import { ri, pick, mc4, numeric, chance } from '../lib.js';

export function generate(tier, rng) {
  const x = ri(rng, 1, 9), y = ri(rng, 1, 9);
  if (tier === 1) {
    const m = mc4(rng, `(${x}, ${y})`, [{ v: `(${y}, ${x})`, why: 'x (across) comes first, then y (up)' }, { v: `(${x}, 0)`, why: 'the point is also ' + y + ' up' }, { v: `(0, ${y})`, why: 'the point is also ' + x + ' across' }]);
    return { ...m, stem: `Point P is ${x} units to the right of the origin and ${y} units up. What are its coordinates?`, working: 'Across first, then up: (x, y).', explanation: `P = (${x}, ${y}).` };
  }
  if (tier === 2) {
    const x2 = ri(rng, 1, 9), y2 = ri(rng, 1, 9);
    return chance(rng, 0.5)
      ? numeric(`A is at (${x}, ${y}) and B is at (${x2}, ${y}). How many units apart are they?`, Math.abs(x - x2) || 1, x === x2 ? '1' : `${Math.max(x, x2)}-${Math.min(x, x2)}`, { working: 'Same y: count along the x-axis.', explanation: `Distance = ${Math.abs(x - x2) || 1}.` })
      : numeric(`A is at (${x}, ${y}) and C is at (${x}, ${y2}). How many units apart are they?`, Math.abs(y - y2) || 1, y === y2 ? '1' : `${Math.max(y, y2)}-${Math.min(y, y2)}`, { working: 'Same x: count along the y-axis.', explanation: `Distance = ${Math.abs(y - y2) || 1}.` });
  }
  const dy = ri(rng, 1, 5), dx = ri(rng, 1, 5);
  const correct = `${dx} units right and ${dy} units up`;
  const m = mc4(rng, correct, [{ v: `${dy} units right and ${dx} units up`, why: 'swapped x and y' }, { v: `${dx} units left and ${dy} units down`, why: 'wrong direction' }, { v: `${dx + dy} units in a straight line`, why: 'the grid moves across and up separately' }]);
  return { ...m, stem: `On a map, the school is at (${x}, ${y}) and the library is at (${x + dx}, ${y + dy}). How do you get from the school to the library?`, working: 'Subtract the x-values, then the y-values.', explanation: `${x + dx} − ${x} = ${dx} right; ${y + dy} − ${y} = ${dy} up.` };
}
