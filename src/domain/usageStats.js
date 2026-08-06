import { todayStr, shiftDay } from './achievements.js';

// 用量洞察：把读取器给的 { todayTokens, daily:{date:tokens}, hourly:[24], breakdown } 算成面板统计。
function weekSum(daily, today) {
  let s = 0;
  for (let i = 0; i < 7; i += 1) s += daily[shiftDay(today, -i)] || 0; // 含今天在内最近 7 天
  return s;
}

export function usageStats(usage = {}, today = todayStr()) {
  const daily = usage.daily || {};
  const todayTokens = usage.todayTokens || 0;
  const yesterday = daily[shiftDay(today, -1)] || 0;
  const week = weekSum(daily, today);

  // 趋势：昨天没数据时给 null（新用户/无对比），避免除零和误导
  const trendPct = yesterday > 0 ? Math.round(((todayTokens - yesterday) / yesterday) * 100) : null;

  const hourly = Array.isArray(usage.hourly) && usage.hourly.length === 24 ? usage.hourly : new Array(24).fill(0);
  const maxHour = Math.max(1, ...hourly);
  const bars = hourly.map((v) => Math.round((v / maxHour) * 100)); // 0~100 供画柱
  const anyHour = hourly.some((v) => v > 0);
  const peakHour = anyHour ? hourly.reduce((best, v, i, a) => (v > a[best] ? i : best), 0) : null;

  const byTool = (usage.breakdown || [])
    .map((b) => ({ label: b.label, today: b.todayTokens || 0, week: b.weekTokens || 0, total: b.total || 0 }))
    .sort((a, b) => b.week - a.week || b.total - a.total);

  return { today: todayTokens, yesterday, trendPct, week, byTool, hourly, bars, peakHour };
}
