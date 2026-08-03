import { describe, it, expect } from 'vitest';
import { computeMood, pickBubble, ACTIVE_MS, RETURN_IDLE_MS } from './mood.js';

const M = 1_000_000;

describe('computeMood', () => {
  it('蔫优先', () => {
    expect(computeMood({ decayed: true, idleMs: 0, hour: 10 })).toBe('wilted');
  });
  it('深夜活跃 = 犯困', () => {
    expect(computeMood({ idleMs: 0, hour: 2, sessionMinutes: 10, recentTokens: 0 })).toBe('sleepy');
  });
  it('刚爆发 = 兴奋', () => {
    expect(computeMood({ idleMs: 0, hour: 14, sessionMinutes: 10, recentTokens: 9 * M })).toBe('excited');
  });
  it('连写久 = 关心', () => {
    expect(computeMood({ idleMs: 0, hour: 14, sessionMinutes: 120, recentTokens: 0 })).toBe('caring');
  });
  it('普通活跃 = 专注', () => {
    expect(computeMood({ idleMs: 0, hour: 14, sessionMinutes: 5, recentTokens: 0 })).toBe('focused');
  });
  it('久别 = 想你', () => {
    expect(computeMood({ idleMs: RETURN_IDLE_MS + 1000, hour: 14 })).toBe('lonely');
  });
  it('短暂离开 = 待机', () => {
    expect(computeMood({ idleMs: ACTIVE_MS + 1000, hour: 14 })).toBe('idle');
  });
});

describe('pickBubble', () => {
  const base = { active: true, hour: 9, sessionMinutes: 5, burst: false, justReturned: false, today: '2026-08-03', sessionId: 100 };

  it('早上第一次给早安，并标记当天已问候', () => {
    const b = pickBubble(base, {});
    expect(b.text).toBeTruthy();
    expect(b.set.greetDate).toBe('2026-08-03');
  });
  it('当天已问候则不再早安', () => {
    const b = pickBubble(base, { greetDate: '2026-08-03' });
    expect(b).toBeNull();
  });
  it('连写≥90分钟劝歇，每个 session 一次', () => {
    const sig = { ...base, greetDate: undefined, hour: 14, sessionMinutes: 95 };
    const b = pickBubble(sig, { greetDate: '2026-08-03' });
    expect(b.set.restSession).toBe(100);
    const again = pickBubble(sig, { greetDate: '2026-08-03', restSession: 100 });
    expect(again).toBeNull();
  });
  it('久别重逢会打招呼', () => {
    const b = pickBubble({ ...base, hour: 14, justReturned: true }, { greetDate: '2026-08-03' });
    expect(b.text).toBeTruthy();
  });
  it('普通闲聊有节流', () => {
    const sig = { ...base, hour: 14, burst: true };
    const mem = { greetDate: '2026-08-03', lastBubbleAt: Date.now() };
    expect(pickBubble(sig, mem, Date.now())).toBeNull();
  });
});
