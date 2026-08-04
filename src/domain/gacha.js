import { RARITY, RARITIES } from '../config/rarities.js';
import { speciesOfRarity } from '../config/species.js';

function weightedPick(items, weightOf, rng) {
  const total = items.reduce((s, i) => s + weightOf(i), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// 用一张 ticketRarity 的券抽一颗蛋：0.7 概率就是本档，0.3 概率按全局权重落到别的档(惊喜)。
// 返回 { rarity, species }。
export function drawEgg(ticketRarity, rng = Math.random) {
  let rarity;
  if (rng() < 0.7) {
    rarity = ticketRarity;
  } else {
    const others = RARITIES.filter((r) => r !== ticketRarity);
    rarity = weightedPick(others, (r) => RARITY[r].weight, rng);
  }
  let pool = speciesOfRarity(rarity);
  if (!pool.length) {
    rarity = ticketRarity;
    pool = speciesOfRarity(rarity);
  }
  if (!pool.length) return null;
  const species = pool[Math.floor(rng() * pool.length)];
  return { rarity, species: species.key };
}
