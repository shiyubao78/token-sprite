const B = 1_000_000_000;

// 4 档稀有度：抽中权重(越低越稀有) + 孵化门槛(安装以来喂的 token)
export const RARITY = {
  common: { key: 'common', name: '普通', hatch: 0.5 * B, weight: 60, color: '#7aa06a' },
  rare: { key: 'rare', name: '稀有', hatch: 2 * B, weight: 25, color: '#4f97cf' },
  epic: { key: 'epic', name: '史诗', hatch: 8 * B, weight: 12, color: '#9b7fd4' },
  legendary: { key: 'legendary', name: '传说', hatch: 30 * B, weight: 3, color: '#dca33f' },
};

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

// 合并同类蛋：每多合并一颗，额外送该稀有度的奖励 token（约各自孵化门槛的 10%，不同等级不同）。
export const MERGE_BONUS = { common: 0.05 * B, rare: 0.2 * B, epic: 0.8 * B, legendary: 3 * B };
