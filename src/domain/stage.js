// 主界面到底显示「在孵的蛋」还是「已化形的精灵」。
//
// 以前这件事和「哪颗蛋在吃 token」共用 activeEggId 一个字段：只要有蛋在孵，
// 主界面就永远是蛋。用户在图鉴里点已孵化的精灵，activePetSpecies 确实被改了，
// 但界面纹丝不动——看着就是"点不动"。所以把两个职责拆开：
//   activeEggId → 谁在吃 token（孵化器管）
//   stageMode   → 主界面显示什么（用户点图鉴/孵化器时切换）

export function ownsSpecies(collection, key) {
  const c = key && collection && collection[key];
  return !!(c && (c.count || 0) > 0);
}

// 'pet' = 显示已化形的精灵，'incubating' = 显示在孵的蛋
export function resolveStage({ stageMode, hasActiveEgg, collection, activePetSpecies }) {
  // 用户明确点过"让它陪我"，且确实拥有这只，就听用户的——哪怕还有蛋在孵
  if (stageMode === 'pet' && ownsSpecies(collection, activePetSpecies)) return 'pet';
  if (hasActiveEgg) return 'incubating';
  return 'pet'; // 没有在养的蛋时保持原有行为（没拥有任何精灵时上层用首个品种兜底）
}
