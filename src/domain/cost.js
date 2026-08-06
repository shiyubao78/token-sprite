// 花费/额度：把 token 折成美元（单一混合价，粗略可调）+ 每日预算提醒。
// 现有管线把 输入/输出/缓存 token 全加成一个总数、不拆类型，所以用一个「混合价」折算，面板标注「粗略估算·可调」。
export const DEFAULT_USD_PER_MILLION = 1.3; // 主流模型 输入/输出/缓存 混合价粗估（美元/百万 token）

// tokens ÷ 100万 × 每百万单价 = 约多少美元。非法输入当 0。
export function estimateCost(tokens, rate) {
  const t = Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
  const r = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_PER_MILLION;
  return (t / 1_000_000) * r;
}

// 展示：大额用 K/M 缩写（省宽、防折行），<10 保留一位小数（看得出在动），中间取整带千分位。
export function formatMoney(n) {
  const v = Number.isFinite(n) && n > 0 ? n : 0;
  if (v >= 1_000_000) return '$' + trimUnit(v / 1_000_000) + 'M';
  if (v >= 1_000) return '$' + trimUnit(v / 1_000) + 'K';
  if (v > 0 && v < 10) return '$' + v.toFixed(1).replace(/\.0$/, '');
  return '$' + Math.round(v).toLocaleString('en-US');
}
// K/M 缩写：≥100 取整，否则一位小数并去掉多余的 0。
function trimUnit(x) {
  if (x >= 100) return String(Math.round(x));
  return x.toFixed(1).replace(/\.0$/, '');
}
