// 加载各品种文件夹里的 5 段图：assets/sprite/<folder>/<n>-*.png
const modules = import.meta.glob('../../assets/sprite/0*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byFolder = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\/([^/]+)\/(\d+)-[^/]+\.png$/);
  if (!m) continue;
  const folder = m[1];
  const n = Number(m[2]);
  (byFolder[folder] || (byFolder[folder] = {}))[n] = url;
}

// 某品种第 n 段(1-5)的图；缺则回退到化形(5)。
export function stageUrl(folder, n) {
  const set = byFolder[folder] || {};
  return set[n] || set[5] || null;
}

// 化形(成体)图
export function adultUrl(folder) {
  return stageUrl(folder, 5);
}
