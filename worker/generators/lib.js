// Shared helpers for the maths template generators (docs/03 §3). Every generator exports
//   generate(tier, rng) → { format, tier, stem, answer, working, explanation, params, options?, distractor_rationale?, accept?, time_limit_s? }
// `params.check` is an independent description of the answer that the test-suite re-evaluates with its own code:
//   { type:'expr', expr }              numeric answer equals the arithmetic expression (numbers, + - * / ( ) floor ceil)
//   { type:'divrem', a, b }            answer is "q r r" for a ÷ b
//   { type:'sort', values, labels }    ordering: labels sorted by values ascending
//   { type:'set', correct }            multi_select: the correct option texts
//   { type:'choice', correct }         mc4: the correct option text
//   { type:'exprtext', value }         fill_blank: the answer expression (× ÷ allowed) evaluates to value
//   { type:'text' }                    fill_blank/other: answer ∈ accept (no numeric check)
import { pick, shuffle } from '../src/rng.js';
export { pick, shuffle };
export const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const chance = (rng, p) => rng() < p;
export const fmt = (n) => Number(n).toLocaleString('en-US');
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a, b) => (a * b) / gcd(a, b);
export function simplify(n, d) { const g = gcd(n, d) || 1; return [n / g, d / g]; }
export function frac(n, d) { const [a, b] = simplify(n, d); return b === 1 ? String(a) : `${a}/${b}`; }
export function mixed(n, d) { const [a, b] = simplify(n, d); if (b === 1) return String(a); const w = Math.floor(a / b), r = a % b; return w ? `${w} ${r}/${b}` : `${r}/${b}`; }
export const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
export const factors = (n) => { const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; };
export const digits = (n) => String(n).length;

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below1000(n) {
  let s = '';
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) s += ' '; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; if (n % 10) s += '-' + ONES[n % 10]; } else if (n > 0) s += ONES[n];
  return s;
}
/** 406029 → "four hundred six thousand, twenty-nine" (answer-key style) */
export function numberToWords(n) {
  if (n === 0) return 'zero';
  const parts = [];
  for (const [name, v] of [['billion', 1e9], ['million', 1e6], ['thousand', 1e3], ['', 1]]) {
    const q = Math.floor(n / v); if (q) { parts.push(below1000(q) + (name ? ' ' + name : '')); n %= v; }
  }
  return parts.join(', ');
}
export const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions', 'hundred millions', 'billions'];
export const placeName = (p) => PLACES[p];

export const NAMES = ['Elchin', 'Aysel', 'Rasim', 'Leyla', 'Nigar', 'Murad', 'Kamran', 'Sabina', 'Tural', 'Zahra', 'Daniel', 'Emma', 'Omar', 'Sara', 'Nihad', 'Lala'];
export const CONTEXTS = [
  { thing: 'pencils', pack: 'box', place: 'school' }, { thing: 'apples', pack: 'crate', place: 'market' }, { thing: 'stickers', pack: 'sheet', place: 'shop' },
  { thing: 'marbles', pack: 'bag', place: 'game' }, { thing: 'books', pack: 'shelf', place: 'library' }, { thing: 'balls', pack: 'net', place: 'sports hall' },
  { thing: 'tickets', pack: 'booklet', place: 'Baku Boulevard' }, { thing: 'seeds', pack: 'packet', place: 'garden' }, { thing: 'cups', pack: 'tray', place: 'café' },
  { thing: 'photos', pack: 'album', place: 'museum' }, { thing: 'bottles', pack: 'case', place: 'kiosk' }, { thing: 'coins', pack: 'jar', place: 'bank' },
];
export const MONEY = 'manat';

/** Build a 4-option multiple choice from the correct value and named distractors: [{v, why}]. Ensures 4 distinct options. */
export function mc4(rng, correct, distractors, fmtFn = String) {
  const seen = new Set([fmtFn(correct)]);
  const ds = [];
  for (const d of distractors) { const t = fmtFn(d.v); if (!seen.has(t) && ds.length < 3) { seen.add(t); ds.push({ t, why: d.why }); } }
  let k = 1;
  while (ds.length < 3) {                                    // pad with near misses if a distractor collapsed onto the answer
    const cand = typeof correct === 'number' ? correct + (k % 2 ? k : -k) : `${correct}${k}`;
    const t = fmtFn(cand); if (!seen.has(t)) { seen.add(t); ds.push({ t, why: 'near miss' }); } k++;
  }
  const all = shuffle(rng, [{ t: fmtFn(correct), why: null }, ...ds]);
  const options = all.map((o) => o.t);
  const answer = 'ABCD'[all.findIndex((o) => o.why === null)];
  const distractor_rationale = {}; all.forEach((o, i) => { if (o.why) distractor_rationale['ABCD'[i]] = o.why; });
  return { format: 'mc4', options, answer, distractor_rationale, params: { check: { type: 'choice', correct: fmtFn(correct) } } };
}
export const numeric = (stem, answer, expr, extra = {}) => ({ format: 'numeric', stem, answer: String(answer), params: { check: { type: 'expr', expr } }, ...extra });
