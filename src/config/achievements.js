const B = 1_000_000_000;
const M = 1_000_000;

// 成就：达成一次给一张对应稀有度的抽卡券。check(ctx) 用真实本地数据判定。
// ctx = { growthTotal, breakdown:[{source,total}], todayTokens, streakDays, nightDays }
export const ACHIEVEMENTS = [
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
