import { ACHIEVEMENTS } from '../config/achievements.js';

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDay(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayStr(dt);
}

// 连续开工天数：从今天(若今天已活跃)或昨天往前数连续活跃日。
export function computeStreak(activeDates = [], today = todayStr()) {
  const set = new Set(activeDates);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

// 结算成就：返回本次新达成的成就与要发的券。
export function evaluateAchievements(ctx, unlocked = {}) {
  const newly = [];
  const tickets = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    if (a.check(ctx)) {
      newly.push(a);
      tickets[a.ticket] = (tickets[a.ticket] || 0) + 1;
    }
  }
  return { newly, tickets };
}
