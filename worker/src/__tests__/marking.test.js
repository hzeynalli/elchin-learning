import { describe, it, expect } from 'vitest';
import { markRule, numericEqual, parseNumber, cadenceFlag, expectedSeconds } from '../marking.js';

describe('numeric normalisation', () => {
  it('commas, spaces, trailing zeros, fraction forms', () => {
    expect(numericEqual('1,058', '1058')).toBe(true);
    expect(numericEqual('22,722', '22 722')).toBe(true);   // space as thousands separator
    expect(numericEqual('0.5', '0.50')).toBe(true);
    expect(numericEqual('1/2', '3/6')).toBe(true);
    expect(numericEqual('1 1/2', '1.5')).toBe(true);
    expect(numericEqual('10^4', '10000')).toBe(true);
    expect(numericEqual('72', '27')).toBe(false);
    expect(parseNumber('abc')).toBeNull();
  });
  it('remainders', () => {
    expect(numericEqual('492 r 5', '492r5')).toBe(true);
    expect(numericEqual('492 r 5', '492 remainder 5')).toBe(true);
    expect(numericEqual('492 r 5', '492')).toBe(false);
  });
  it('multi-part answers', () => {
    expect(markRule({ format: 'numeric', answer: '3,700; 6,000; 45' }, '3700; 6000; 45').correct).toBe(true);
    expect(markRule({ format: 'numeric', answer: '3,700; 6,000; 45' }, '3700; 600; 45').correct).toBe(false);
  });
  it('tolerance', () => {
    expect(markRule({ format: 'numeric', answer: '3.14', tolerance: 0.01 }, '3.141').correct).toBe(true);
  });
});

describe('other formats', () => {
  const mc = { format: 'mc4', options: ['12', '18', '20', '36'], answer: 'B' };
  it('mc4 accepts the letter or the option text', () => {
    expect(markRule(mc, 'b').correct).toBe(true);
    expect(markRule(mc, '18').correct).toBe(true);
    expect(markRule(mc, '12').correct).toBe(false);
  });
  it('multi_select is set equality', () => {
    const it_ = { format: 'multi_select', options: ['2', '3', '4', '9'], answer: ['A', 'B'] };
    expect(markRule(it_, ['B', 'A']).correct).toBe(true);
    expect(markRule(it_, ['A']).correct).toBe(false);
    expect(markRule(it_, '2, 3').correct).toBe(true);
  });
  it('ordering is exact sequence', () => {
    const it_ = { format: 'ordering', answer: ['4,009,000', '4,090,000', '4,099,000', '4,900,000'] };
    expect(markRule(it_, ['4,009,000', '4,090,000', '4,099,000', '4,900,000']).correct).toBe(true);
    expect(markRule(it_, ['4,090,000', '4,009,000', '4,099,000', '4,900,000']).correct).toBe(false);
  });
  it('fill_blank with accepted alternates', () => {
    expect(markRule({ format: 'fill_blank', answer: 'associative', accept: ['associative property'] }, 'Associative Property').correct).toBe(true);
  });
  it('short_text and writing are not rule-marked', () => {
    expect(markRule({ format: 'short_text', answer: 'x' }, 'x')).toBeNull();
  });
});

describe('cadence', () => {
  it('flags guessing and slow-correct', () => {
    expect(cadenceFlag({ correct: false, time_s: 3, expected_s: 45 })).toBe('guessing');
    expect(cadenceFlag({ correct: true, time_s: 120, expected_s: 45 })).toBe('slow_correct');
    expect(cadenceFlag({ correct: true, time_s: 30, expected_s: 45 })).toBeNull();
    expect(expectedSeconds({ format: 'numeric', tier: 3 })).toBe(72);
    expect(expectedSeconds({ format: 'numeric', tier: 1, time_limit_s: 3 })).toBe(3);
  });
});
