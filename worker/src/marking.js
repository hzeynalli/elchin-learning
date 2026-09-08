// Rule-based marking (docs/03 §7) for numeric, mc4, multi_select, ordering, fill_blank. short_text/writing go to the LLM.
// Normalises spaces, commas, case, fraction forms, trailing zeros, "r" remainders.

export function normalizeText(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/\s*([=×x*÷/+−–-])\s*/g, '$1');
}
const stripThousands = (s) => s.replace(/(\d)[, ](?=\d{3}\b)/g, '$1');   // accepts 22,722 and 22 722

/** Parse "492 r 5", "492 remainder 5", "492r5" → {q, r}; else null */
export function parseRemainder(s) {
  const m = normalizeText(s).replace(/remainder|rem\.?/g, 'r').match(/^(-?\d+)\s*r\s*(\d+)$/);
  return m ? { q: Number(m[1]), r: Number(m[2]) } : null;
}
/** Parse "3/6", "1 1/2", "0.5", "1,058", "10^4" → number, or null */
export function parseNumber(s) {
  let t = stripThousands(normalizeText(s)).replace(/[^\d./^\- ]/g, '').trim();
  if (!t) return null;
  let m;
  if ((m = t.match(/^(-?\d+)\s+(\d+)\/(\d+)$/))) return Number(m[1]) + Math.sign(Number(m[1]) || 1) * Number(m[2]) / Number(m[3]);
  if ((m = t.match(/^(-?\d+)\/(\d+)$/))) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if ((m = t.match(/^(-?\d+)\^(\d+)$/))) return Math.pow(Number(m[1]), Number(m[2]));
  if (/^-?\d*\.?\d+$/.test(t)) return Number(t);
  return null;
}
export function numericEqual(expected, given, tolerance = 0) {
  const er = parseRemainder(expected), gr = parseRemainder(given);
  if (er) return !!gr && er.q === gr.q && er.r === gr.r;
  const e = parseNumber(expected), g = parseNumber(given);
  if (e == null || g == null) return normalizeText(expected) === normalizeText(given);
  return Math.abs(e - g) <= (tolerance || 1e-9);
}
/** Multi-part numeric answers "3,700; 6,000; 45" — each part must match in order. */
export function multiNumericEqual(expected, given, tolerance = 0) {
  const ep = String(expected).split(';').map((x) => x.trim()), gp = String(given).split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  return ep.length === gp.length && ep.every((e, i) => numericEqual(e, gp[i], tolerance));
}

function letterOf(given, options) {
  const g = normalizeText(given);
  if (/^[a-d]$/.test(g)) return g.toUpperCase();
  const idx = (options || []).findIndex((o) => normalizeText(o) === g);
  return idx >= 0 ? 'ABCD'[idx] : null;
}

/** @returns {{correct:boolean, marked_by:'rule', partial?:number}|null} null when the format needs the LLM */
export function markRule(item, given) {
  const fmt = item.format;
  const accept = [item.answer, ...(item.accept || [])];
  switch (fmt) {
    case 'numeric': {
      const tol = item.tolerance || 0;
      const ok = accept.some((a) => (String(a).includes(';') ? multiNumericEqual(a, given, tol) : numericEqual(a, given, tol)));
      return { correct: ok, marked_by: 'rule' };
    }
    case 'mc4': {
      const want = /^[A-D]$/.test(String(item.answer)) ? item.answer : letterOf(item.answer, item.options);
      return { correct: letterOf(given, item.options) === want, marked_by: 'rule' };
    }
    case 'multi_select': {
      const norm = (arr) => new Set((Array.isArray(arr) ? arr : String(arr).split(/[,;]/)).map((x) => letterOf(x, item.options) || normalizeText(x)));
      const a = norm(item.answer), g = norm(given);
      return { correct: a.size === g.size && [...a].every((x) => g.has(x)), marked_by: 'rule' };
    }
    case 'ordering': {
      const norm = (arr) => (Array.isArray(arr) ? arr : String(arr).split(/[,;→>]/)).map((x) => normalizeText(x));
      const a = norm(item.answer), g = norm(given);
      return { correct: a.length === g.length && a.every((x, i) => x === g[i]), marked_by: 'rule' };
    }
    case 'fill_blank': {
      const g = normalizeText(given);
      return { correct: accept.some((a) => normalizeText(a) === g), marked_by: 'rule' };
    }
    default:
      return null;                                   // short_text, writing, passage_mc(short) → LLM / parent
  }
}

/** Expected seconds per item by tier and format (docs/07 §2 cadence). */
export function expectedSeconds(item) {
  const base = { numeric: 45, mc4: 40, multi_select: 50, ordering: 60, fill_blank: 35, short_text: 90, writing: 600, passage_mc: 60 }[item.format] ?? 45;
  const tierMul = { 1: 0.7, 2: 1, 3: 1.6 }[item.tier] ?? 1;
  return item.time_limit_s ? item.time_limit_s : Math.round(base * tierMul);
}
export function cadenceFlag({ correct, time_s, expected_s }) {
  if (time_s == null || !expected_s) return null;
  if (!correct && time_s < 0.25 * expected_s) return 'guessing';
  if (correct && time_s > 2 * expected_s) return 'slow_correct';
  return null;
}
