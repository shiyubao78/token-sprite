// 6 个品种，每个一条 5 段进化线（1-seed 蛋 → 2-sprout → 3-growth → 4-bud → 5-adult 化形）。
// 图在 assets/sprite/<folder>/<n>-*.png。稀有度决定孵化门槛与抽中概率。
export const SPECIES = [
  { key: 'flower', name: '萌芽精灵', rarity: 'common', folder: '00-flower-spirit', note: '草木之灵，化形为花仙子' },
  { key: 'shell', name: '贝壳精灵', rarity: 'common', folder: '01-water-shell', note: '海洋之灵，背着海螺壳' },
  { key: 'fire', name: '火苗精灵', rarity: 'rare', folder: '02-fire-lava', note: '岩浆之灵，化形为熔岩兽' },
  { key: 'thunder', name: '雷精灵', rarity: 'rare', folder: '03-thunder-spirit', note: '雷电之灵，化形为雷电团子' },
  { key: 'ice', name: '冰凤凰', rarity: 'epic', folder: '05-ice-phoenix', note: '冰晶之灵，化形为冰晶战鸟' },
  { key: 'mech', name: '机械兽', rarity: 'legendary', folder: '04-mech-spirit', note: '科技之灵，化形为金色机械兽' },
];

export function speciesByKey(key) {
  return SPECIES.find((s) => s.key === key) || null;
}
export function speciesOfRarity(rarity) {
  return SPECIES.filter((s) => s.rarity === rarity);
}
