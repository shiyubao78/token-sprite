import { L } from './i18n.js';

const B = 1_000_000_000;
const T = (zh, en) => ({ zh, en });
function mk(o) {
  return { ...o, get name() { return L(o._name); } };
}

// 4 档稀有度：抽中权重(越低越稀有) + 孵化门槛(安装以来喂的 token)。name 双语，调用点仍用 .name。
export const RARITY = {
  common: mk({ key: 'common', _name: T('普通', 'Common'), hatch: 0.5 * B, weight: 60, color: '#7aa06a' }),
  rare: mk({ key: 'rare', _name: T('稀有', 'Rare'), hatch: 2 * B, weight: 25, color: '#4f97cf' }),
  epic: mk({ key: 'epic', _name: T('史诗', 'Epic'), hatch: 8 * B, weight: 12, color: '#9b7fd4' }),
  legendary: mk({ key: 'legendary', _name: T('传说', 'Legendary'), hatch: 30 * B, weight: 3, color: '#dca33f' }),
};

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

// 合并同类蛋：每多合并一颗，额外送该稀有度的奖励 token（约各自孵化门槛的 10%，不同等级不同）。
export const MERGE_BONUS = { common: 0.05 * B, rare: 0.2 * B, epic: 0.8 * B, legendary: 3 * B };
