import { RARITY } from '../config/rarities.js';

// 孵化进度：从这颗蛋开始在孵到现在，喂了多少 / 该稀有度门槛。
export function incubation(growthTotal, incubationStart, rarity) {
  const need = (RARITY[rarity] && RARITY[rarity].hatch) || 0;
  const fed = Math.max(0, (growthTotal || 0) - (incubationStart || 0));
  const fraction = need > 0 ? Math.min(1, fed / need) : 1;
  return { fed, need, fraction, done: fed >= need };
}
