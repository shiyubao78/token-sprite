import { RARITY } from '../config/rarities.js';
import { L } from '../config/i18n.js';

// 孵化进度：这颗蛋累计被喂了多少 token / 该稀有度门槛。
// fed 是「这只自己的」累积喂养量（切换在养对象也不清零），由 incubator.accrue 维护。
export function incubation(fed, rarity) {
  const need = (RARITY[rarity] && RARITY[rarity].hatch) || 0;
  const f = Math.max(0, fed || 0);
  const fraction = need > 0 ? Math.min(1, f / need) : 1;
  return { fed: f, need, fraction, done: f >= need };
}

// 孵化中显示第几段进化：0–25%→1(蛋) 25–50%→2 50–75%→3 75–100%→4；满则 5(化形，破壳时)。
export function incubationStage(fraction) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  if (f >= 1) return 5;
  return Math.min(4, Math.floor(f * 4) + 1);
}

// 5 段名（双语）。取第 n 段的当前语言名用 stageName(n)。
export const STAGE_NAMES = [
  { zh: '蛋', en: 'Egg' },
  { zh: '幼体', en: 'Hatchling' },
  { zh: '成长', en: 'Growing' },
  { zh: '蓄能', en: 'Charging' },
  { zh: '化形', en: 'Awakened' },
];
export function stageName(no) {
  return L(STAGE_NAMES[no - 1]);
}

// 每只精灵的「进化详情」：由这只累计喂养 fed + 稀有度门槛，实时算出 5 段的解锁状态与到下一段的距离。
// state：done=已过 / current=当前(带本段进度) / locked=未到的中间段(灰剪影) / mystery=未到的化形(藏成 ?)。
export function evolution(fed, rarity) {
  const need = (RARITY[rarity] && RARITY[rarity].hatch) || 0;
  const f = Math.max(0, fed || 0);
  const fraction = need > 0 ? Math.min(1, f / need) : 1;
  const current = incubationStage(fraction); // 1..5
  const stages = [];
  for (let n = 1; n <= 5; n++) {
    const threshold = ((n - 1) / 4) * need; // 到达第 n 段的累计喂养门槛
    let state;
    if (n < current) state = 'done';
    else if (n === current) state = 'current';
    else state = n === 5 ? 'mystery' : 'locked';
    const stage = { no: n, name: stageName(n), threshold, state };
    if (state === 'current' && n < 5) {
      const start = (n - 1) / 4;
      const end = n / 4;
      stage.withinPct = Math.max(0, Math.min(1, (fraction - start) / (end - start)));
      stage.nextName = stageName(n + 1); // 下一段的名字
      stage.nextThreshold = (n / 4) * need;
      stage.toNext = Math.max(0, stage.nextThreshold - f);
    }
    stages.push(stage);
  }
  return { need, fed: f, fraction, current, toHatch: Math.max(0, need - f), stages };
}
