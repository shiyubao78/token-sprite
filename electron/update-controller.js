function releaseNotesText(releaseNotes) {
  const raw = Array.isArray(releaseNotes)
    ? releaseNotes.map((note) => note?.note || '').join('\n')
    : releaseNotes || '';
  return String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

export function createUpdateController({
  updater,
  dialog,
  isEnabled,
  startupDelayMs = 30_000,
  intervalMs = 4 * 60 * 60 * 1000,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
  clearTimeoutFn = clearTimeout,
  clearIntervalFn = clearInterval,
}) {
  let startupTimer = null;
  let intervalTimer = null;
  let checking = false;
  let userInitiatedCheck = false;
  const listeners = [];

  function listen(event, handler) {
    updater.on(event, handler);
    listeners.push([event, handler]);
  }

  async function show(options) {
    return dialog.showMessageBox({
      type: 'info',
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      ...options,
    });
  }

  if (isEnabled) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;

    listen('update-available', async (info) => {
      checking = false;
      const notes = releaseNotesText(info.releaseNotes);
      const { response } = await show({
        buttons: ['下载更新', '稍后'],
        message: `发现新版本 ${info.version}`,
        detail: notes || '新版本已经准备好，要现在下载吗？',
      });
      if (response === 0) await updater.downloadUpdate();
    });

    listen('update-not-available', async () => {
      checking = false;
      const shouldNotify = userInitiatedCheck;
      userInitiatedCheck = false;
      if (shouldNotify) {
        await show({ buttons: ['知道了'], cancelId: 0, message: '已经是最新版本' });
      }
    });

    listen('update-downloaded', async (info) => {
      const { response } = await show({
        buttons: ['重启并更新', '稍后'],
        message: `新版本 ${info.version} 已下载完成`,
        detail: '重启 Token 小精灵即可完成更新，成长数据会保留。',
      });
      if (response === 0) updater.quitAndInstall();
    });

    listen('error', async () => {
      checking = false;
      const shouldNotify = userInitiatedCheck;
      userInitiatedCheck = false;
      if (shouldNotify) {
        await show({
          type: 'warning',
          buttons: ['知道了'],
          cancelId: 0,
          message: '暂时无法检查更新',
          detail: '请检查网络后稍后再试，小精灵可以继续正常使用。',
        });
      }
    });
  }

  async function check({ userInitiated = false } = {}) {
    if (!isEnabled || checking) return;
    checking = true;
    userInitiatedCheck = userInitiated;
    try {
      await updater.checkForUpdates();
    } catch {
      updater.emit('error', new Error('check for updates failed'));
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
    for (const [event, handler] of listeners) updater.removeListener(event, handler);
  }

  return { enabled: !!isEnabled, start, check, dispose };
}
