import { describe, it, expect } from 'vitest';
import { usageStats } from './usageStats.js';

const M = 1_000_000;

describe('usageStats 用量洞察', () => {
  const today = '2026-08-05';
  const base = {
    todayTokens: 300 * M,
    daily: { '2026-08-05': 300 * M, '2026-08-04': 200 * M, '2026-08-03': 100 * M, '2026-07-20': 999 * M },
    hourly: Array.from({ length: 24 }, (_, h) => (h === 14 ? 500 : h === 9 ? 200 : 0)),
    breakdown: [
      { label: 'Claude Code', total: 5000 * M, todayTokens: 250 * M, weekTokens: 500 * M },
      { label: 'Codex', total: 1000 * M, todayTokens: 50 * M, weekTokens: 120 * M },
    ],
  };

  it('今日/昨日/趋势', () => {
    const s = usageStats(base, today);
    expect(s.today).toBe(300 * M);
    expect(s.yesterday).toBe(200 * M);
    expect(s.trendPct).toBe(50); // (300-200)/200
  });

  it('本周只算最近 7 天（不含 7/20 的老数据）', () => {
    const s = usageStats(base, today);
    expect(s.week).toBe(600 * M); // 300+200+100
  });

  it('活跃时段：峰值小时 + 归一化柱', () => {
    const s = usageStats(base, today);
    expect(s.peakHour).toBe(14);
    expect(s.bars[14]).toBe(100); // 最高归一到 100
    expect(s.bars[9]).toBe(40);   // 200/500
    expect(s.bars[0]).toBe(0);
  });

  it('按工具按周排序', () => {
    const s = usageStats(base, today);
    expect(s.byTool[0].label).toBe('Claude Code');
    expect(s.byTool[0].week).toBe(500 * M);
  });

  it('昨天无数据 → 趋势为 null（不误导、不除零）', () => {
    const s = usageStats({ todayTokens: 100 * M, daily: { '2026-08-05': 100 * M }, hourly: new Array(24).fill(0), breakdown: [] }, today);
    expect(s.trendPct).toBeNull();
    expect(s.peakHour).toBeNull();
  });

  it('空数据不报错', () => {
    const s = usageStats({}, today);
    expect(s.today).toBe(0);
    expect(s.week).toBe(0);
    expect(s.byTool).toEqual([]);
  });
});
