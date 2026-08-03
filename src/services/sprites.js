const modules = import.meta.glob('../../assets/sprite/stage-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byLevel = {};
for (const [path, url] of Object.entries(modules)) {
  const match = path.match(/stage-(\d+)\.png$/);
  if (match) byLevel[Number(match[1])] = url;
}

export function spriteUrl(level) {
  return byLevel[level] || null;
}
