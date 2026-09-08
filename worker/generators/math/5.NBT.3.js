// 5.NBT.3 — Decimals to thousandths: read, write, compare, expanded form (5.NBT.A.3)
import { ri, pick, mc4, numberToWords, chance } from '../lib.js';

const dec3 = (n) => (n / 1000).toFixed(3);
const words = (whole, th) => `${numberToWords(whole)} and ${numberToWords(th)} thousandths`;

export function generate(tier, rng) {
  if (tier === 1) {
    const whole = ri(rng, 1, 9), th = ri(rng, 1, 999);
    const correct = `${whole}.${String(th).padStart(3, '0')}`;
    const m = mc4(rng, correct, [{ v: `${whole}.${th}`, why: 'thousandths need three decimal places' }, { v: `${whole}.${String(th).padStart(4, '0')}`, why: 'that is ten-thousandths' }, { v: `${whole}${String(th).padStart(3, '0')}`, why: 'the decimal point is missing' }]);
    return { ...m, stem: `Which decimal is "${words(whole, th)}"?`, working: 'Thousandths = three places after the decimal point. Pad with zeros.', explanation: `${words(whole, th)} = ${correct}.` };
  }
  if (tier === 2) {
    if (chance(rng, 0.5)) {
      let a = ri(rng, 100, 999), b; do { b = ri(rng, 10, 99) * 10; } while (b === a);   // e.g. 0.305 vs 0.350
      const A = dec3(a), B = (b / 1000).toFixed(2);
      const larger = a > b ? A : B, smaller = larger === A ? B : A;
      const m = mc4(rng, larger, [{ v: smaller, why: 'compared digit counts instead of place value' }, { v: 'They are equal', why: 'line up the decimal points' }, { v: 'Cannot tell', why: 'write both with three decimal places' }]);
      return { ...m, stem: `Which is larger: ${A} or ${B}?`, working: `Write both with three decimal places: ${A} and ${(b / 1000).toFixed(3)}.`, explanation: `${larger} is larger.` };
    }
    const whole = ri(rng, 1, 9), t = ri(rng, 1, 9), h = ri(rng, 1, 9), th = ri(rng, 1, 9);
    const n = `${whole}.${t}${h}${th}`;
    const correct = `${whole} + ${t}/10 + ${h}/100 + ${th}/1000`;
    const m = mc4(rng, correct, [{ v: `${whole} + ${t}/100 + ${h}/1000 + ${th}/10000`, why: 'places shifted one to the right' }, { v: `${whole} + ${t}/10 + ${h}/10 + ${th}/10`, why: 'every place is not tenths' }, { v: `${whole} + ${t} + ${h} + ${th}`, why: 'the decimal digits are fractions of 1' }]);
    return { ...m, stem: `Which is the expanded form of ${n}?`, working: 'Tenths, hundredths, thousandths — each place is ten times smaller.', explanation: `${n} = ${correct}.` };
  }
  const vals = new Set(); while (vals.size < 4) vals.add(pick(rng, [ri(rng, 1, 9) / 10, ri(rng, 10, 99) / 100, ri(rng, 100, 999) / 1000]));
  const values = [...vals], labels = values.map((v) => String(v));
  const sorted = [...values].sort((a, b) => a - b).map(String);
  return { format: 'ordering', stem: `Put in order from smallest to largest: ${labels.join('   ')}`, options: labels, answer: sorted, params: { check: { type: 'sort', values, labels } }, working: 'Give every number three decimal places, then compare.', explanation: `Smallest to largest: ${sorted.join(' < ')}.` };
}
