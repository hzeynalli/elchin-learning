// G4.NF.3 — Decimals to hundredths; relate to fractions; compare decimals (4.NF.C.5-7)
import { ri, pick, mc4, chance } from '../lib.js';

const dec2 = (n) => (n / 100).toFixed(2).replace(/0$/, '').replace(/\.$/, '');

export function generate(tier, rng) {
  if (tier === 1) {
    const n = ri(rng, 1, 99);
    if (chance(rng, 0.5)) return { format: 'numeric', stem: `Write 0.${String(n).padStart(2, '0')} as a fraction.`, answer: `${n}/100`, params: { check: { type: 'expr', expr: `${n}/100` } }, working: 'Two decimal places means hundredths.', explanation: `0.${String(n).padStart(2, '0')} = ${n}/100.` };
    return { format: 'numeric', stem: `Write ${n}/100 as a decimal.`, answer: (n / 100).toFixed(2), params: { check: { type: 'expr', expr: `${n}/100` } }, working: 'Hundredths take two decimal places.', explanation: `${n}/100 = ${(n / 100).toFixed(2)}.` };
  }
  if (tier === 2) {
    let a, b; do { a = ri(rng, 5, 99); b = ri(rng, 1, 9) * 10; } while (a === b);      // e.g. 0.47 vs 0.5
    const A = dec2(a), B = dec2(b); const larger = a > b ? A : B, smaller = larger === A ? B : A;
    const m = mc4(rng, larger, [{ v: smaller, why: 'compared the number of digits instead of place value' }, { v: 'They are equal', why: 'line up the tenths first' }, { v: 'Cannot tell', why: 'write both with two decimal places' }]);
    return { ...m, stem: `Which is bigger: ${A} or ${B}?`, working: `Write both with two decimal places: ${(a / 100).toFixed(2)} and ${(b / 100).toFixed(2)}.`, explanation: `${larger} is bigger: compare the tenths first.` };
  }
  const byValue = new Map();                                   // keyed by value so 1/2 and 5/10 never both appear
  while (byValue.size < 4) {
    if (chance(rng, 0.5)) { const n = ri(rng, 5, 95); byValue.set(n / 100, dec2(n)); }
    else { const d = pick(rng, [2, 4, 5, 10, 20, 25]), n = ri(rng, 1, d - 1); if (!byValue.has(n / d)) byValue.set(n / d, `${n}/${d}`); }
  }
  const values = [...byValue.keys()], labels = [...byValue.values()];
  const sorted = labels.map((l, i) => [l, values[i]]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
  return { format: 'ordering', stem: `Put in order from smallest to largest: ${labels.join('   ')}`, options: labels, answer: sorted, params: { check: { type: 'sort', values, labels } }, working: 'Turn every fraction into hundredths (a decimal), then compare.', explanation: `Smallest to largest: ${sorted.join(' < ')}.` };
}
