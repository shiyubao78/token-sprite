// 亲密度 / 羁绊系统：化形之后「关系的开始」。只涨不掉——回落交给心情，不扣亲密度。
// 驱动 = 写代码 + 逗它（方案 B，越常写越常逗越快变亲）。

const M = 1_000_000;

export const CODE_PER_POINT = 20 * M;   // 每写 20M token +1 亲密度
export const INTERACT_DAILY_CAP = 15;   // 逗它每天最多 +15（防狂点刷）

// 5 段羁绊：达到 min 分即该等级。每级解锁在 UI/台词里体现。
export const BOND_LEVELS = [
  { level: 1, name: '初识', min: 0, unlock: '刚认识，慢慢熟悉中' },
  { level: 2, name: '熟络', min: 20, unlock: '会更主动跟你打招呼' },
  { level: 3, name: '亲近', min: 60, unlock: '开始用昵称叫你' },
  { level: 4, name: '依赖', min: 150, unlock: '有了专属口头禅' },
  { level: 5, name: '羁绊', min: 300, unlock: '纪念日特别反应 + 专属称号' },
];

function ensureBond(state) {
  if (!state.bond) state.bond = { interactPoints: 0, todayInteract: 0, day: '', level: 1 };
  return state.bond;
}

// 亲密度总分 = 写代码换算分（按累计 growthTotal）+ 互动累积分。
export function bondPoints(state, growthTotal) {
  const code = Math.floor(Math.max(0, growthTotal || 0) / CODE_PER_POINT);
  return code + ((state.bond && state.bond.interactPoints) || 0);
}

export function bondLevel(points) {
  let cur = BOND_LEVELS[0];
  for (const l of BOND_LEVELS) if (points >= l.min) cur = l;
  return cur;
}

// 逗它一次：每天上限内 +1 亲密度。返回是否真的加了分（超上限返回 false）。
export function petInteract(state, today) {
  const b = ensureBond(state);
  if (b.day !== today) { b.day = today; b.todayInteract = 0; }
  if ((b.todayInteract || 0) >= INTERACT_DAILY_CAP) return false;
  b.interactPoints = (b.interactPoints || 0) + 1;
  b.todayInteract = (b.todayInteract || 0) + 1;
  return true;
}

// 结算等级：算出的等级高于已记录则更新，并返回新达成的等级对象（用于弹庆祝），否则 null。
export function settleBondLevel(state, growthTotal) {
  const b = ensureBond(state);
  const lv = bondLevel(bondPoints(state, growthTotal)).level;
  const prev = b.level || 1;
  b.level = Math.max(prev, lv);
  return lv > prev ? BOND_LEVELS.find((l) => l.level === lv) : null;
}

// UI 视图：当前等级、到下一级进度、解锁说明。
export function bondView(state, growthTotal) {
  const points = bondPoints(state, growthTotal);
  const cur = bondLevel(points);
  const idx = BOND_LEVELS.findIndex((l) => l.level === cur.level);
  const next = BOND_LEVELS[idx + 1] || null;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((points - cur.min) / (next.min - cur.min)) * 100))) : 100;
  return {
    points, level: cur.level, name: cur.name, unlock: cur.unlock,
    isMax: !next, nextName: next ? next.name : null, nextMin: next ? next.min : cur.min,
    toNext: next ? Math.max(0, next.min - points) : 0, pct,
  };
}
