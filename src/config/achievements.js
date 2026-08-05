const B = 1_000_000_000;
const M = 1_000_000;

// 成就：达成一次给一张对应稀有度的抽卡券。check(ctx) 用真实本地数据判定。
// ctx = { growthTotal, breakdown:[{source,total}], todayTokens, streakDays, nightDays, ownedCount }
export const ACHIEVEMENTS = [
  // —— 新手期：门槛低、发普通+稀有券，让新人前几天就能集齐「前 4 只」(萌芽/贝壳/火苗/雷) 挑一只重点养 ——
  { id: 'meet', name: '初次相遇', desc: '敲下第一个 token', ticket: 'common',
    check: (c) => c.growthTotal > 0 },
  { id: 'warmup', name: '小试牛刀', desc: '累计喂养满 100M', ticket: 'rare',
    check: (c) => c.growthTotal >= 100 * M },
  { id: 'getting-there', name: '渐入佳境', desc: '累计喂养满 500M', ticket: 'common',
    check: (c) => c.growthTotal >= 500 * M },
  { id: 'first-hatch', name: '破壳时刻', desc: '孵出第一只精灵', ticket: 'rare',
    check: (c) => (c.ownedCount || 0) >= 1 },
  { id: 'first-1b', name: '初出茅庐', desc: '累计喂养满 1B token', ticket: 'common',
    check: (c) => c.growthTotal >= 1 * B },
  { id: 'dual', name: '双修', desc: '任意两个工具各累计 ≥ 300M', ticket: 'common',
    check: (c) => c.breakdown.filter((b) => b.total >= 300 * M).length >= 2 },
  { id: 'night-3', name: '昼夜不息', desc: '深夜(0–6点)写代码满 3 天', ticket: 'common',
    check: (c) => c.nightDays >= 3 },
  { id: 'burst-2b', name: '爆种', desc: '单日喂养破 2B', ticket: 'rare',
    check: (c) => c.todayTokens >= 2 * B },
  { id: 'streak-7', name: '一周不辍', desc: '连续开工满 7 天', ticket: 'rare',
    check: (c) => c.streakDays >= 7 },
  { id: 'milestone', name: '里程碑', desc: '连续 30 天，或累计破 10B', ticket: 'epic',
    check: (c) => c.streakDays >= 30 || c.growthTotal >= 10 * B },
  { id: 'legend-100b', name: '传说之路', desc: '累计破 100B', ticket: 'legendary',
    check: (c) => c.growthTotal >= 100 * B },
];
