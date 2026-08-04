import { RARITY } from '../config/rarities.js';

// 孵化进度：从这颗蛋开始在孵到现在，喂了多少 / 该稀有度门槛。
export function incubation(growthTotal, incubationStart, rarity) {
  const need = (RARITY[rarity] && RARITY[rarity].hatch) || 0;
  const fed = Math.max(0, (growthTotal || 0) - (incubationStart || 0));
  const fraction = need > 0 ? Math.min(1, fed / need) : 1;
  return { fed, need, fraction, done: fed >= need };
}

// 孵化中显示第几段进化：0–25%→1(蛋) 25–50%→2 50–75%→3 75–100%→4；满则 5(化形，破壳时)。
export function incubationStage(fraction) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  if (f >= 1) return 5;
  return Math.min(4, Math.floor(f * 4) + 1);
}
