import { RARITIES } from '../config/rarities.js';
import { speciesOfRarity } from '../config/species.js';

export const UPGRADE_CHANCE = 0.15; // 小概率升一档

// 用一张 ticketRarity 的券抽一颗蛋：大概率本档，小概率升一档(封顶传说)，绝不跳档、不降档。
// 返回 { rarity, species }。
export function drawEgg(ticketRarity, rng = Math.random) {
  const idx = RARITIES.indexOf(ticketRarity);
  let rarity = idx >= 0 ? ticketRarity : 'common';
  if (idx >= 0 && idx < RARITIES.length - 1 && rng() < UPGRADE_CHANCE) {
    rarity = RARITIES[idx + 1];
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
