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

describe('新手成就（前期多给券，凑齐前 4 只挑一只）', () => {
  const M = 1_000_000;
  const base = { growthTotal: 0, breakdown: [], todayTokens: 0, streakDays: 0, nightDays: 0, ownedCount: 0 };

  it('敲下第一个 token → 初次相遇（普通券）', () => {
    const r = evaluateAchievements({ ...base, growthTotal: 1 }, {});
    expect(r.newly.map((a) => a.id)).toContain('meet');
    expect(r.tickets.common).toBeGreaterThanOrEqual(1);
  });
  it('100M → 小试牛刀（稀有券，解锁火苗/雷）', () => {
    const r = evaluateAchievements({ ...base, growthTotal: 100 * M }, {});
    expect(r.newly.map((a) => a.id)).toContain('warmup');
    expect(r.tickets.rare).toBeGreaterThanOrEqual(1);
  });
  it('500M → 渐入佳境；且初次相遇/小试牛刀也一并达成', () => {
    const r = evaluateAchievements({ ...base, growthTotal: 500 * M }, {});
    const ids = r.newly.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['meet', 'warmup', 'getting-there']));
    // 2 普通(初次相遇+渐入佳境) + 1 稀有(小试牛刀)
    expect(r.tickets.common).toBeGreaterThanOrEqual(2);
    expect(r.tickets.rare).toBeGreaterThanOrEqual(1);
  });
  it('破壳时刻要真的孵出过一只（ownedCount≥1）才发', () => {
    const before = evaluateAchievements({ ...base, growthTotal: 1 }, {});
    expect(before.newly.map((a) => a.id)).not.toContain('first-hatch');
    const after = evaluateAchievements({ ...base, growthTotal: 1, ownedCount: 1 }, {});
    expect(after.newly.map((a) => a.id)).toContain('first-hatch');
  });
});
