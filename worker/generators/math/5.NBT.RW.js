// 5.NBT.RW — Read, write, compare, order whole numbers to billions; expanded form (5.NBT.A.1 ext.)
import { ri, pick, fmt, numberToWords, chance } from '../lib.js';

function bigNumber(rng, maxPow) {                              // sprinkle zeros so place holders matter
  let n = 0; for (let p = 0; p < maxPow; p++) n += (chance(rng, 0.35) ? 0 : ri(rng, 1, 9)) * 10 ** p;
  return n + ri(rng, 1, 9) * 10 ** maxPow;
}
const expanded = (n) => String(n).split('').reverse().map((d, i) => (d === '0' ? null : fmt(Number(d) * 10 ** i))).filter(Boolean).reverse().join(' + ');

export function generate(tier, rng) {
  if (tier === 1) {
    const n = bigNumber(rng, ri(rng, 6, 9));
    return chance(rng, 0.5)
      ? { format: 'numeric', stem: `Write in digits: ${numberToWords(n)}.`, answer: String(n), params: { check: { type: 'expr', expr: String(n) } }, working: 'Write each period (billions, millions, thousands, ones) as three digits; use zeros to hold empty places.', explanation: `${numberToWords(n)} = ${fmt(n)}.` }
      : { format: 'fill_blank', stem: `Write ${fmt(n)} in words.`, answer: numberToWords(n), accept: [numberToWords(n).replace(/,/g, ''), numberToWords(n).replace(/-/g, ' ')], params: { check: { type: 'text' } }, working: 'Read each period, then say its name: billion, million, thousand.', explanation: `${fmt(n)} = ${numberToWords(n)}.` };
  }
  if (tier === 2) {
    const n = bigNumber(rng, ri(rng, 6, 8));
    const e = expanded(n);
    return { format: 'fill_blank', stem: `Write ${fmt(n)} in expanded form.`, answer: e, accept: [e.replace(/,/g, ''), e.replace(/ /g, '')], params: { check: { type: 'exprtext', value: n } }, working: 'Write the value of every non-zero digit and add them.', explanation: `${fmt(n)} = ${e}.` };
  }
  const base = ri(rng, 1, 9) * 10 ** 9 + ri(rng, 0, 9) * 10 ** 8;
  const vals = new Set(); while (vals.size < 4) vals.add(base + pick(rng, [0, 9, 90]) * 10 ** 5 + pick(rng, [0, 9, 99]) * 10 ** 3 + pick(rng, [0, 9, 90, 900]));
  const values = [...vals], labels = values.map(fmt);
  const sorted = [...values].sort((a, b) => a - b).map(fmt);
  return { format: 'ordering', stem: `Put in order from smallest to largest: ${labels.join('   ')}`, options: labels, answer: sorted, params: { check: { type: 'sort', values, labels } }, working: 'Same number of digits: compare from the left, one place at a time.', explanation: `Smallest to largest: ${sorted.join(' < ')}.` };
}
