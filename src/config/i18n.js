// 极简 i18n：一个全局 locale + L() 解析双语对。默认中文，保证旧测试与中文体验不变。
// 界面文案就地写 L({ zh:'…', en:'…' })，翻译贴着用处走，不维护单独的 key 表。

let locale = 'zh';

export function setLocale(l) {
  locale = l === 'en' ? 'en' : 'zh';
  return locale;
}
export function getLocale() {
  return locale;
}
export function isEN() {
  return locale === 'en';
}

// 解析 { zh, en } 双语对；传普通字符串则原样返回。
export function L(pair) {
  if (pair == null) return '';
  if (typeof pair === 'string') return pair;
  if (pair[locale] != null) return pair[locale];
  return pair.zh != null ? pair.zh : pair.en || '';
}

// 从系统语言标签探测默认语言：zh* → 中文，其余 → 英文。
export function detectLocale(tag) {
  return /^zh/i.test(String(tag || '')) ? 'zh' : 'en';
}
