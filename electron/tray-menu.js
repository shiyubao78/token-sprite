// 托盘菜单模板。labels 随 locale（'zh' | 'en'）切换，默认中文。
const T = {
  zh: { recall: '召回小精灵', check: '检查更新', auto: '开机启动', version: (v) => `当前版本 ${v}`, quit: '退出' },
  en: { recall: 'Recall sprite', check: 'Check for updates', auto: 'Launch at login', version: (v) => `Version ${v}`, quit: 'Quit' },
};

export function createTrayMenuTemplate({
  version,
  autoLaunch,
  updateEnabled,
  onRecall,
  onCheckUpdates,
  onToggleAutoLaunch,
  onQuit,
  locale = 'zh',
}) {
  const t = T[locale] || T.zh;
  return [
    { id: 'recall', label: t.recall, click: onRecall },
    {
      id: 'check-updates',
      label: t.check,
      enabled: updateEnabled,
      click: onCheckUpdates,
    },
    { type: 'separator' },
    {
      id: 'auto-launch',
      label: t.auto,
      type: 'checkbox',
      checked: autoLaunch,
      click: (item) => onToggleAutoLaunch(item.checked),
    },
    { id: 'version', label: t.version(version), enabled: false },
    { type: 'separator' },
    { id: 'quit', label: t.quit, click: onQuit },
  ];
}
