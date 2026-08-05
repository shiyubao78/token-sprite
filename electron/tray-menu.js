export function createTrayMenuTemplate({
  version,
  autoLaunch,
  updateEnabled,
  onRecall,
  onCheckUpdates,
  onToggleAutoLaunch,
  onQuit,
}) {
  return [
    { id: 'recall', label: '召回小精灵', click: onRecall },
    {
      id: 'check-updates',
      label: '检查更新',
      enabled: updateEnabled,
      click: onCheckUpdates,
    },
    { type: 'separator' },
    {
      id: 'auto-launch',
      label: '开机启动',
      type: 'checkbox',
      checked: autoLaunch,
      click: (item) => onToggleAutoLaunch(item.checked),
    },
    { id: 'version', label: `当前版本 ${version}`, enabled: false },
    { type: 'separator' },
    { id: 'quit', label: '退出', click: onQuit },
  ];
}
