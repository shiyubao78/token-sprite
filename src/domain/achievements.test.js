import { describe, it, expect } from 'vitest';
import { evaluateAchievements, computeStreak } from './achievements.js';

const B = 1_000_000_000;

describe('computeStreak', () => {
  it('连续三天', () => {
    expect(computeStreak(['2026-08-01', '2026-08-02', '2026-08-03'], '2026-08-03')).toBe(3);
  });
  it('今天还没写、昨天连续，仍算', () => {
    expect(computeStreak(['2026-08-01', '2026-08-02'], '2026-08-03')).toBe(2);
  });
  it('断一天则从最近连续段算', () => {
    expect(computeStreak(['2026-07-30', '2026-08-02', '2026-08-03'], '2026-08-03')).toBe(2);
  });
  it('无记录为 0', () => {
    expect(computeStreak([], '2026-08-03')).toBe(0);
  });
});

describe('evaluateAchievements', () => {
  const ctx = {
    growthTotal: 1.2 * B,
    breakdown: [{ source: 'a', total: 0.4 * B }, { source: 'b', total: 0.5 * B }],
    todayTokens: 0,
    streakDays: 0,
    nightDays: 0,
  };

  it('累计1B与双修达成，各发普通券', () => {
    const r = evaluateAchievements(ctx, {});
    const ids = r.newly.map((a) => a.id);
    expect(ids).toContain('first-1b');
    expect(ids).toContain('dual');
    expect(r.tickets.common).toBeGreaterThanOrEqual(2);
  });
  it('已解锁的不再重复发', () => {
    const r = evaluateAchievements(ctx, { 'first-1b': { at: 1 }, dual: { at: 1 } });
    expect(r.newly.map((a) => a.id)).not.toContain('first-1b');
  });
  it('传说之路需累计破 100B，发传说券', () => {
    const r = evaluateAchievements({ ...ctx, growthTotal: 100 * B }, {});
    expect(r.newly.map((a) => a.id)).toContain('legend-100b');
    expect(r.tickets.legendary).toBe(1);
  });
});
