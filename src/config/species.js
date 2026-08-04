// 起步 6 个品种，跨 4 档稀有度。art 暂借现有形象当占位（stage-N.png），产品出图后换成
// assets/species/<key>/adult.png。品种、稀有度、名字、图路径都集中在这里。
export const SPECIES = [
  { key: 'mossling', name: '草木灵', rarity: 'common', art: 3, note: '最常见的森野小灵' },
  { key: 'sprout', name: '嫩芽兽', rarity: 'common', art: 2, note: '刚破壳的一点绿' },
  { key: 'nightfox', name: '夜行狐', rarity: 'rare', art: 4, note: '深夜出没的火花' },
  { key: 'dawndeer', name: '晨露鹿', rarity: 'rare', art: 1, note: '沾着晨光的种子' },
  { key: 'bloomwhale', name: '绽放鲸', rarity: 'epic', art: 5, note: '花开时浮现的光' },
  { key: 'crownfae', name: '花冠精灵', rarity: 'legendary', art: 6, note: '传说的化形精灵' },
];

export function speciesByKey(key) {
  return SPECIES.find((s) => s.key === key) || null;
}

export function speciesOfRarity(rarity) {
  return SPECIES.filter((s) => s.rarity === rarity);
}
