import { describe, it, expect } from 'vitest';
import { syllables, readability, checkPassage } from '../readability.js';

describe('readability (docs/03 §4)', () => {
  it('counts syllables sensibly', () => {
    expect(syllables('cat')).toBe(1); expect(syllables('water')).toBe(2); expect(syllables('beautiful')).toBe(3);
    expect(syllables('the')).toBe(1); expect(syllables('elephant')).toBe(3); expect(syllables('played')).toBe(1);
  });
  it('a simple Grade-5 style paragraph lands in the target band', () => {
    const text = 'The old fisherman lived alone by the sea. Every morning he pushed his small boat into the water. He knew the waves like old friends. One day a storm came without warning. The sky turned grey and the wind howled across the beach. He pulled hard on the oars and sang to keep his courage. When he reached the shore, his daughter was waiting with a blanket. She did not say a word. She only held his hand and smiled.';
    const r = readability(text);
    expect(r.fk_grade).toBeGreaterThan(1); expect(r.fk_grade).toBeLessThan(7);   // short, simple sentences → low grade
    expect(r.sentences).toBe(9);
    // a Grade-5 paragraph: ~13 words per sentence, some 2–3 syllable words → inside the 4.5–6.5 band
    const g5 = 'High in the mountains, where the river ran fast and cold, a narrow bridge crossed a deep gorge. The bridge was nothing more than a single wooden plank, worn smooth by many years of hooves. It was so narrow that only one animal could cross at a time, and everyone in the valley knew it. One bright morning, a white goat stepped onto the plank from the eastern bank. At exactly the same moment, a black goat started across from the western side. They met in the middle, with the water roaring far below their feet.';
    const r2 = readability(g5);
    expect(r2.fk_grade).toBeGreaterThanOrEqual(4.5); expect(r2.fk_grade).toBeLessThanOrEqual(7);
    expect(r2.mean_sentence_len).toBeGreaterThanOrEqual(11);
  });
  it('rejects passages that are too short, too hard or too long-sentenced', () => {
    expect(checkPassage('Short. Very short.').ok).toBe(false);
    const long = Array(30).fill('The extraordinary photosynthetic mechanisms of subterranean organisms demonstrate remarkable evolutionary adaptations throughout innumerable geological epochs, consequently astonishing contemporary researchers everywhere.').join(' ');
    const c = checkPassage(long);
    expect(c.ok).toBe(false); expect(c.problems.join(' ')).toMatch(/FK grade|sentence length/);
  });
});
