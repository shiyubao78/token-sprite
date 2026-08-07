// 亲密度 / 羁绊系统：化形之后「关系的开始」。只涨不掉——回落交给心情，不扣亲密度。
// 驱动 = 写代码 + 逗它（方案 B，越常写越常逗越快变亲）。

import { L } from '../config/i18n.js';

const M = 1_000_000;

export const CODE_PER_POINT = 20 * M;   // 每写 20M token +1 亲密度
export const INTERACT_DAILY_CAP = 15;   // 逗它每天最多 +15（防狂点刷）

const T = (zh, en) => ({ zh, en });
function mk(o) {
  return {
    ...o,
    get name() { return L(o._name); },
    get unlock() { return L(o._unlock); },
  };
}

// 5 段羁绊：达到 min 分即该等级。name/unlock 双语，调用点仍用 .name / .unlock。
export const BOND_LEVELS = [
  mk({ level: 1, min: 0, _name: T('初识', 'Acquainted'), _unlock: T('刚认识，慢慢熟悉中', 'Just met — warming up') }),
  mk({ level: 2, min: 20, _name: T('熟络', 'Familiar'), _unlock: T('会更主动跟你打招呼', 'Greets you more often') }),
  mk({ level: 3, min: 60, _name: T('亲近', 'Close'), _unlock: T('开始用昵称叫你', 'Starts calling you by name') }),
  mk({ level: 4, min: 150, _name: T('依赖', 'Attached'), _unlock: T('有了专属口头禅', 'Has a catchphrase just for you') }),
  mk({ level: 5, min: 300, _name: T('羁绊', 'Bonded'), _unlock: T('纪念日特别反应 + 专属称号', 'Anniversary surprises + a special title') }),
];

function ensureBond(state) {
  if (!state.bond) state.bond = { interactPoints: 0, todayInteract: 0, day: '', level: 1 };
  return state.bond;
}

// 羁绊是否已开始（孵出第一只精灵后才激活——化形=关系的开始）。
export function bondActive(state) {
  return !!(state.bond && state.bond.startedAt != null);
}

// 首次化形时激活羁绊，记录那一刻的 growth 当基准（之后写代码才计入）。返回是否刚激活。
export function activateBond(state, growthTotal) {
  const b = ensureBond(state);
  if (b.startedAt != null) return false;
  b.startedAt = Math.max(0, growthTotal || 0);
  b.level = 1;
  return true;
}

// 亲密度总分 = 化形后新写的代码换算分 + 互动累积分。未激活则为 0。
export function bondPoints(state, growthTotal) {
  const b = state.bond;
  if (!b || b.startedAt == null) return 0;
  const code = Math.floor(Math.max(0, (growthTotal || 0) - b.startedAt) / CODE_PER_POINT);
  return code + (b.interactPoints || 0);
}

export function bondLevel(points) {
  let cur = BOND_LEVELS[0];
  for (const l of BOND_LEVELS) if (points >= l.min) cur = l;
  return cur;
}

// 逗它一次：每天上限内 +1 亲密度。返回是否真的加了分（未激活或超上限返回 false）。
export function petInteract(state, today) {
  if (!bondActive(state)) return false; // 化形前只逗着玩，不累积羁绊
  const b = ensureBond(state);
  if (b.day !== today) { b.day = today; b.todayInteract = 0; }
  if ((b.todayInteract || 0) >= INTERACT_DAILY_CAP) return false;
  b.interactPoints = (b.interactPoints || 0) + 1;
  b.todayInteract = (b.todayInteract || 0) + 1;
  return true;
}

// 结算等级：算出的等级高于已记录则更新，并返回新达成的等级对象（用于弹庆祝），否则 null。
export function settleBondLevel(state, growthTotal) {
  if (!bondActive(state)) return null;
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
    active: bondActive(state),
    points, level: cur.level, name: cur.name, unlock: cur.unlock,
    isMax: !next, nextName: next ? next.name : null, nextMin: next ? next.min : cur.min,
    toNext: next ? Math.max(0, next.min - points) : 0, pct,
  };
}
