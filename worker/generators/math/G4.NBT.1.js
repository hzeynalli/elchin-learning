// G4.NBT.1 — Place value to 1,000,000: read, write, compare, round (4.NBT.A.1-3)
import { ri, pick, fmt, numberToWords, placeName, numeric, chance } from '../lib.js';

export function generate(tier, rng) {
  if (tier === 1) {
    const n = ri(rng, 1000, 999999);
    if (chance(rng, 0.5)) {
      return numeric(`Write in digits: ${numberToWords(n)}.`, n, String(n), { working: 'Write each group (thousands, then hundreds-tens-ones) and keep the zeros as place holders.', explanation: `${numberToWords(n)} is ${fmt(n)}.` });
    }
    const s = String(n); const pos = ri(rng, 0, s.length - 1); const d = Number(s[pos]) || Number(s[s.length - 1]); const p = d === Number(s[pos]) ? s.length - 1 - pos : 0;
    const value = d * 10 ** p;
    return numeric(`What is the value of the digit ${d} in ${fmt(n)}?`, value, `${d}*${10 ** p}`, { working: `The ${d} is in the ${placeName(p)} place, so it is worth ${d} × ${fmt(10 ** p)}.`, explanation: `Value = digit × its place: ${fmt(value)}.` });
  }
  if (tier === 2) {
    const n = ri(rng, 10000, 999999);
    const p = pick(rng, [1, 2, 3, 4]);                          // tens … ten thousands
    const unit = 10 ** p;
    const rounded = Math.round(n / unit) * unit;
    return numeric(`Round ${fmt(n)} to the nearest ${p === 1 ? 'ten' : p === 2 ? 'hundred' : p === 3 ? 'thousand' : 'ten thousand'}.`, rounded, `floor((${n} + ${unit / 2}) / ${unit}) * ${unit}`, { working: `Look at the digit to the right of the ${placeName(p)} place: 5 or more rounds up, less than 5 keeps it.`, explanation: `${fmt(n)} rounds to ${fmt(rounded)}.` });
  }
  // tier 3: order four near-identical numbers (place-value confusables)
  const base = ri(rng, 1, 9) * 100000;
  const vals = new Set(); while (vals.size < 4) vals.add(base + pick(rng, [0, 9, 90, 900, 9000, 90000]) + pick(rng, [0, 9, 90, 900, 9000]));
  const values = [...vals]; const labels = values.map(fmt);
  const sorted = [...values].sort((a, b) => a - b).map(fmt);
  return { format: 'ordering', stem: `Put these numbers in order from smallest to largest: ${labels.join('   ')}`, options: labels, answer: sorted, params: { check: { type: 'sort', values, labels } }, working: 'Compare the biggest place first; if equal, move one place to the right.', explanation: `Smallest to largest: ${sorted.join(' < ')}.` };
}
