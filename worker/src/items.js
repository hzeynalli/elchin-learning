// Item helpers: stem hashing for dedupe (docs/03 §8) and Jaccard near-duplicate check.
export function normalizeStem(stem) {
  return String(stem || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
/** FNV-1a 32-bit over the normalised stem + numbers — stable across runs. */
export function stemHash(stem) {
  const s = normalizeStem(stem);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** Identity of an item for dedupe: the stem plus its options (a "which statement is true" stem is the same text every time). */
export function itemKey(item) { return normalizeStem(item.stem) + (item.options ? ' | ' + item.options.map(normalizeStem).join(' | ') : ''); }
export function tokens(stem) { return new Set(normalizeStem(stem).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)); }
export function jaccard(a, b) { const A = tokens(a), B = tokens(b); const inter = [...A].filter((x) => B.has(x)).length; const uni = new Set([...A, ...B]).size; return uni ? inter / uni : 0; }
/** true if the stem duplicates one of the recent stems (exact hash) or is a near duplicate (Jaccard > 0.8). */
export function isDuplicate(stem, recentHashes = [], recentStems = []) {
  if (recentHashes.includes(stemHash(stem))) return true;
  return recentStems.some((s) => jaccard(stem, s) > 0.8);
}
export function pointsFor(tier, correct) { return correct ? ({ 1: 1, 2: 2, 3: 3 }[tier] ?? 1) : 0; }
