// 轻量更新提醒：查 GitHub 最新 Release，发现新版本就弹窗引导去下载页。
// 不下载、不安装、无需代码签名——只是提醒用户去 Releases 手动更新。

// 从 github.com/<repo>/releases/latest 跟随重定向后的最终 URL 解析最新版本。
// 用 github.com 网页重定向而非 api.github.com——后者未登录仅 60 次/小时，公司共享出口 IP 常被限流。
// 命中 /releases/tag/<ver> 才算有正式版；否则（如重定向到 /releases 列表）视为暂无发布。
export function parseReleaseFromUrl(finalUrl) {
  const m = String(finalUrl || '').match(/\/releases\/tag\/([^/?#]+)/);
  if (!m) return null;
  return { version: decodeURIComponent(m[1]), url: finalUrl };
}

// 版本比较：忽略前缀 v，按 主.次.修 逐段比。a<b→-1，a>b→1，相等→0。
export function compareVersions(a, b) {
  const parse = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

const DIALOG_TEXT = {
  zh: {
    download: '去下载', later: '稍后', gotIt: '知道了',
    newVersion: (v) => `发现新版本 ${v}`,
    newDetail: '打开下载页获取最新版，拖进「应用程序」覆盖即可，成长数据会保留。',
    latest: '已经是最新版本',
    failTitle: '暂时无法检查更新',
    failDetail: '请检查网络后稍后再试，小精灵可以继续正常使用。',
  },
  en: {
    download: 'Download', later: 'Later', gotIt: 'Got it',
    newVersion: (v) => `New version ${v} available`,
    newDetail: 'Open the download page for the latest build; drag it into Applications to replace — your progress is kept.',
    latest: 'You’re on the latest version',
    failTitle: 'Couldn’t check for updates',
    failDetail: 'Check your connection and try again later. The sprite keeps working fine.',
  },
};

export function createUpdateController({
  currentVersion,
  fetchLatest, // async () => { version, url } | null（null 表示还没有发布任何版本）
  dialog,
  openExternal, // async (url) => void
  isEnabled,
  locale = 'zh',
  startupDelayMs = 30_000,
  intervalMs = 6 * 60 * 60 * 1000,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
  clearTimeoutFn = clearTimeout,
  clearIntervalFn = clearInterval,
}) {
  const tx = DIALOG_TEXT[locale] || DIALOG_TEXT.zh;
  let startupTimer = null;
  let intervalTimer = null;
  let checking = false;

  async function show(options) {
    return dialog.showMessageBox({ type: 'info', defaultId: 0, cancelId: 1, noLink: true, ...options });
  }

  async function check({ userInitiated = false } = {}) {
    if (!isEnabled || checking) return;
    checking = true;
    try {
      const latest = await fetchLatest();
      const hasNewer = latest && latest.version && compareVersions(currentVersion, latest.version) < 0;
      if (hasNewer) {
        const { response } = await show({
          buttons: [tx.download, tx.later],
          message: tx.newVersion(latest.version),
          detail: tx.newDetail,
        });
        if (response === 0) await openExternal(latest.url);
      } else if (userInitiated) {
        await show({ buttons: [tx.gotIt], cancelId: 0, message: tx.latest });
      }
    } catch {
      if (userInitiated) {
        await show({
          type: 'warning',
          buttons: [tx.gotIt],
          cancelId: 0,
          message: tx.failTitle,
          detail: tx.failDetail,
        });
      }
    } finally {
      checking = false;
    }
  }

  function start() {
    if (!isEnabled || startupTimer || intervalTimer) return;
    startupTimer = setTimeoutFn(() => check(), startupDelayMs);
    intervalTimer = setIntervalFn(() => check(), intervalMs);
  }

  function dispose() {
    if (startupTimer) clearTimeoutFn(startupTimer);
    if (intervalTimer) clearIntervalFn(intervalTimer);
    startupTimer = null;
    intervalTimer = null;
  }

  return { enabled: !!isEnabled, start, check, dispose };
}
