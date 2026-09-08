// 5.MD.2 — Line plots with fractional units; solve problems from the data (5.MD.B.2)
import { ri, pick, frac, mixed, numeric } from '../lib.js';

function plot(rng) {
  const d = pick(rng, [4, 8]);
  const values = []; const counts = {};
  for (let i = 0; i < ri(rng, 6, 9); i++) { const n = ri(rng, 1, d - 1); values.push(n); counts[n] = (counts[n] || 0) + 1; }
  const desc = Object.keys(counts).map(Number).sort((a, b) => a - b).map((n) => `${frac(n, d)} m: ${'✕'.repeat(counts[n])}`).join('   ');
  return { d, values, counts, desc };
}

export function generate(tier, rng) {
  const p = plot(rng);
  const intro = `A line plot shows the lengths of ribbon pieces (each ✕ is one piece):  ${p.desc}.`;
  if (tier === 1) {
    const n = pick(rng, Object.keys(p.counts).map(Number));
    return numeric(`${intro}  How many pieces are ${frac(n, p.d)} m long?`, p.counts[n], String(p.counts[n]), { working: 'Count the ✕ marks above that length.', explanation: `${p.counts[n]} piece${p.counts[n] === 1 ? '' : 's'}.` });
  }
  const total = p.values.reduce((a, b) => a + b, 0);
  if (tier === 2) {
    return { format: 'numeric', stem: `${intro}  What is the total length of all the pieces, in metres?`, answer: frac(total, p.d), accept: [`${total}/${p.d}`, mixed(total, p.d)], params: { check: { type: 'expr', expr: p.values.map((v) => `${v}/${p.d}`).join('+') } }, working: 'Multiply each length by its number of ✕, then add.', explanation: `Total = ${total}/${p.d} = ${mixed(total, p.d)} m.` };
  }
  const k = p.values.length;
  return { format: 'numeric', stem: `${intro}  If the total length were shared equally among the ${k} pieces, how long would each piece be?`, answer: frac(total, p.d * k), accept: [`${total}/${p.d * k}`, mixed(total, p.d * k)], params: { check: { type: 'expr', expr: `(${p.values.map((v) => `${v}/${p.d}`).join('+')})/${k}` } }, working: `Total ${frac(total, p.d)} m divided by ${k} pieces.`, explanation: `${frac(total, p.d)} ÷ ${k} = ${frac(total, p.d * k)} m each.` };
}
