const B = 1_000_000_000;
const M = 1_000_000;

// 5 段封顶，按「累计消耗」养成（不清零）。
// art 指向 assets/sprite/stage-{art}.png；结尾用最终精灵形态(art 7)，呼应「Token 小精灵」。
export const STAGES = [
  { level: 1, key: 'seed', name: '种子', art: 1, threshold: 0, note: '埋进土里的一颗光种子' },
  { level: 2, key: 'sprout', name: '嫩芽', art: 2, threshold: 1 * B, note: '顶开土，冒出第一点绿' },
  { level: 3, key: 'seedling', name: '幼苗', art: 3, threshold: 3 * B, note: '舒展开两片叶子' },
  { level: 4, key: 'bud', name: '花苞', art: 4, threshold: 12 * B, note: '抽枝，结出发光花苞' },
  { level: 5, key: 'fairy', name: '化形·小精灵', art: 6, threshold: 35 * B, note: '羽化成精灵·传说形态' },
];

export const MAX_LEVEL = STAGES.length;

// 超过这个时长没有新增消耗，就蔫一级
export const DECAY_MS = 24 * 60 * 60 * 1000;
