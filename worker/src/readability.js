// Readability check for passages (docs/03 §4): Flesch–Kincaid grade 4.5–6.5 (tier 3 up to 7.0) and mean sentence
// length 11–17 words. Runs in code on every passage before it can be used; rejects otherwise.

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]+/g);                     // one vowel run = one syllable (beau-ti-ful → 3)
  return Math.max(1, groups ? groups.length : 1);
}
export function sentencesOf(text) {
  return String(text || '').replace(/["“”]/g, '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s));
}
export function wordsOf(text) { return String(text || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []; }

export function readability(text) {
  const sents = sentencesOf(text), words = wordsOf(text);
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const wps = words.length / Math.max(1, sents.length), spw = syl / Math.max(1, words.length);
  const fk = 0.39 * wps + 11.8 * spw - 15.59;
  return { words: words.length, sentences: sents.length, syllables: syl, mean_sentence_len: Math.round(wps * 10) / 10, fk_grade: Math.round(fk * 10) / 10, lexile_est: Math.round(Math.max(300, Math.min(1200, 180 * fk + 100))) };
}

/** Accept/reject per docs/03 §4. tier 3 passages may reach FK 7.0. */
export function checkPassage(text, { tier = 2, minWords = 250, maxWords = 500 } = {}) {
  const r = readability(text);
  const problems = [];
  if (r.words < minWords) problems.push(`too short: ${r.words} words (min ${minWords})`);
  if (r.words > maxWords) problems.push(`too long: ${r.words} words (max ${maxWords})`);
  if (r.fk_grade < 4.5) problems.push(`FK grade ${r.fk_grade} below 4.5`);
  if (r.fk_grade > (tier === 3 ? 7.0 : 6.5)) problems.push(`FK grade ${r.fk_grade} above ${tier === 3 ? 7.0 : 6.5}`);
  if (r.mean_sentence_len < 11) problems.push(`mean sentence length ${r.mean_sentence_len} below 11`);
  if (r.mean_sentence_len > 17) problems.push(`mean sentence length ${r.mean_sentence_len} above 17`);
  return { ok: problems.length === 0, problems, ...r };
}
