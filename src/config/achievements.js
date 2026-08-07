import { L } from './i18n.js';

const B = 1_000_000_000;
const M = 1_000_000;
const T = (zh, en) => ({ zh, en });

// name/desc 双语：调用点仍用 a.name / a.desc，getter 按当前语言解析。
function mk(o) {
  return {
    ...o,
    get name() { return L(o._name); },
    get desc() { return L(o._desc); },
  };
}

// 成就：达成一次给一张对应稀有度的抽卡券。check(ctx) 用真实本地数据判定。
// ctx = { growthTotal, breakdown:[{source,total}], todayTokens, streakDays, nightDays, ownedCount }
export const ACHIEVEMENTS = [
  // —— 新手期：门槛低、发普通+稀有券，让新人前几天就能集齐「前 4 只」(萌芽/贝壳/火苗/雷) 挑一只重点养 ——
  mk({ id: 'meet', _name: T('初次相遇', 'First Contact'), _desc: T('敲下第一个 token', 'Type your first token'), ticket: 'common',
    check: (c) => c.growthTotal > 0 }),
  mk({ id: 'warmup', _name: T('小试牛刀', 'Warming Up'), _desc: T('累计喂养满 100M', 'Feed 100M total'), ticket: 'rare',
    check: (c) => c.growthTotal >= 100 * M }),
  mk({ id: 'getting-there', _name: T('渐入佳境', 'Getting There'), _desc: T('累计喂养满 500M', 'Feed 500M total'), ticket: 'common',
    check: (c) => c.growthTotal >= 500 * M }),
  mk({ id: 'first-hatch', _name: T('破壳时刻', 'First Hatch'), _desc: T('孵出第一只精灵', 'Hatch your first sprite'), ticket: 'rare',
    check: (c) => (c.ownedCount || 0) >= 1 }),
  mk({ id: 'first-1b', _name: T('初出茅庐', 'Rookie'), _desc: T('累计喂养满 1B token', 'Feed 1B total'), ticket: 'common',
    check: (c) => c.growthTotal >= 1 * B }),
  mk({ id: 'dual', _name: T('双修', 'Dual Wield'), _desc: T('任意两个工具各累计 ≥ 300M', '300M+ on any two tools'), ticket: 'common',
    check: (c) => c.breakdown.filter((b) => b.total >= 300 * M).length >= 2 }),
  mk({ id: 'night-3', _name: T('昼夜不息', 'Night Owl'), _desc: T('深夜(0–6点)写代码满 3 天', 'Code after midnight (0–6) for 3 days'), ticket: 'common',
    check: (c) => c.nightDays >= 3 }),
  mk({ id: 'burst-2b', _name: T('爆种', 'Burst'), _desc: T('单日喂养破 2B', '2B in a single day'), ticket: 'rare',
    check: (c) => c.todayTokens >= 2 * B }),
  mk({ id: 'streak-7', _name: T('一周不辍', 'Week Streak'), _desc: T('连续开工满 7 天', '7 days in a row'), ticket: 'rare',
    check: (c) => c.streakDays >= 7 }),
  mk({ id: 'milestone', _name: T('里程碑', 'Milestone'), _desc: T('连续 30 天，或累计破 10B', '30-day streak, or 10B total'), ticket: 'epic',
    check: (c) => c.streakDays >= 30 || c.growthTotal >= 10 * B }),
  mk({ id: 'legend-100b', _name: T('传说之路', 'Path to Legend'), _desc: T('累计破 100B', 'Reach 100B total'), ticket: 'legendary',
    check: (c) => c.growthTotal >= 100 * B }),
];
