// 开窗加载态的最小展示时间：本地打包脚本几十毫秒就加载完，
// 不兜一下的话那只 🌱 一闪而过，人眼根本看不见。
export const MIN_BOOT_MS = 700;

// 还需要再等多久（毫秒）。bootAt 缺失/异常时不等待。
export function bootWaitMs(bootAt, now, min = MIN_BOOT_MS) {
  if (!Number.isFinite(bootAt) || !Number.isFinite(now)) return 0;
  const elapsed = now - bootAt;
  if (!(elapsed >= 0)) return 0; // 时钟回拨等异常，不等
  return Math.max(0, Math.min(min, min - elapsed));
}
