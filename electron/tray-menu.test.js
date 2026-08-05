import { describe, expect, it, vi } from 'vitest';
import { createTrayMenuTemplate } from './tray-menu.js';

function callbacks() {
  return {
    onRecall: vi.fn(),
    onCheckUpdates: vi.fn(),
    onToggleAutoLaunch: vi.fn(),
    onQuit: vi.fn(),
  };
}

describe('createTrayMenuTemplate', () => {
  it('按固定顺序生成五个用户入口', () => {
    const menu = createTrayMenuTemplate({
      version: '1.0.0',
      autoLaunch: true,
      updateEnabled: true,
      ...callbacks(),
    });

    expect(menu.filter((item) => item.type !== 'separator').map((item) => item.label))
      .toEqual(['召回小精灵', '检查更新', '开机启动', '当前版本 1.0.0', '退出']);
  });

  it('反映开机启动状态并转发用户选择', () => {
    const actions = callbacks();
    const menu = createTrayMenuTemplate({
      version: '1.0.0',
      autoLaunch: true,
      updateEnabled: true,
      ...actions,
    });
    const autoLaunch = menu.find((item) => item.id === 'auto-launch');

    expect(autoLaunch).toMatchObject({ type: 'checkbox', checked: true });
    autoLaunch.click({ checked: false });
    expect(actions.onToggleAutoLaunch).toHaveBeenCalledWith(false);
  });

  it('转发召回、检查更新和退出动作', () => {
    const actions = callbacks();
    const menu = createTrayMenuTemplate({
      version: '1.0.0',
      autoLaunch: false,
      updateEnabled: true,
      ...actions,
    });

    menu.find((item) => item.id === 'recall').click();
    menu.find((item) => item.id === 'check-updates').click();
    menu.find((item) => item.id === 'quit').click();

    expect(actions.onRecall).toHaveBeenCalledOnce();
    expect(actions.onCheckUpdates).toHaveBeenCalledOnce();
    expect(actions.onQuit).toHaveBeenCalledOnce();
  });

  it('开发环境禁用检查更新', () => {
    const menu = createTrayMenuTemplate({
      version: '0.1.0-dev',
      autoLaunch: false,
      updateEnabled: false,
      ...callbacks(),
    });

    expect(menu.find((item) => item.id === 'check-updates').enabled).toBe(false);
  });
});
