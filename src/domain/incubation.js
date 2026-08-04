import { RARITY } from '../config/rarities.js';

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
