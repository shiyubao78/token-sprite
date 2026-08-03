function trim(value) {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatTokens(n) {
  const v = Number.isFinite(n) && n > 0 ? n : 0;
  if (v >= 1_000_000_000) return trim(v / 1_000_000_000) + 'B';
  if (v >= 1_000_000) return trim(v / 1_000_000) + 'M';
  if (v >= 1_000) return trim(v / 1_000) + 'K';
  return String(Math.round(v));
}
