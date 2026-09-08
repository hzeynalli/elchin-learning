import { describe, it, expect } from 'vitest';
import { activeSeconds, sessionStats } from '../telemetry.js';
const at = (s) => new Date(1_700_000_000_000 + s * 1000).toISOString();

describe('active minutes (docs/07 §2)', () => {
  it('counts time while visible with an action in the last 90 s; idle pauses the clock', () => {
    const ev = [
      { kind: 'visible', at: at(0) }, { kind: 'answer', at: at(10) }, { kind: 'answer', at: at(40) },
      { kind: 'answer', at: at(70) }, { kind: 'idle', at: at(200) }, { kind: 'answer', at: at(400) },
    ];
    // 10→70 fully active (60 s), 70→160 window of 90 s (90 s), then nothing until 400; 400→end(400) = 0
    expect(activeSeconds(ev)).toBe(150);
  });
  it('hidden tab is never active', () => {
    const ev = [{ kind: 'answer', at: at(0) }, { kind: 'hidden', at: at(20) }, { kind: 'visible', at: at(300) }, { kind: 'answer', at: at(310) }];
    expect(activeSeconds(ev, { now: at(330) })).toBe(20 + 0 + 20);
  });
  it('session stats', () => {
    const ev = [{ kind: 'visible', at: at(0) }, { kind: 'answer', at: at(0) }, { kind: 'answer', at: at(60) }, { kind: 'answer', at: at(120) }];
    const s = sessionStats(ev, { now: at(240) });
    expect(s.elapsed_s).toBe(240); expect(s.active_s).toBe(210); expect(s.focus_ratio).toBe(0.88); expect(s.answers).toBe(3);
  });
});
