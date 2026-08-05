import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createUpdateController } from './update-controller.js';

function fakeUpdater() {
  const updater = new EventEmitter();
  updater.checkForUpdates = vi.fn().mockResolvedValue(undefined);
  updater.downloadUpdate = vi.fn().mockResolvedValue(undefined);
  updater.quitAndInstall = vi.fn();
  return updater;
}

function fakeTimers() {
  return {
    setTimeoutFn: vi.fn((callback) => ({ callback, kind: 'timeout' })),
    setIntervalFn: vi.fn((callback) => ({ callback, kind: 'interval' })),
    clearTimeoutFn: vi.fn(),
    clearIntervalFn: vi.fn(),
  };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createUpdateController', () => {
  it('开发环境不设置定时器也不检查更新', async () => {
    const updater = fakeUpdater();
    const timers = fakeTimers();
    const controller = createUpdateController({
      updater,
      dialog: { showMessageBox: vi.fn() },
      isEnabled: false,
      ...timers,
    });

    controller.start();
    await controller.check({ userInitiated: true });

    expect(controller.enabled).toBe(false);
    expect(timers.setTimeoutFn).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('启动时延迟检查并安排低频复查', async () => {
    const updater = fakeUpdater();
    const timers = fakeTimers();
    const controller = createUpdateController({
      updater,
      dialog: { showMessageBox: vi.fn() },
      isEnabled: true,
      startupDelayMs: 30_000,
      intervalMs: 4 * 60 * 60 * 1000,
      ...timers,
    });

    controller.start();
    expect(timers.setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(timers.setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 4 * 60 * 60 * 1000);

    await timers.setTimeoutFn.mock.calls[0][0]();
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('发现新版本后只有用户同意才下载', async () => {
    const updater = fakeUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
    createUpdateController({ updater, dialog, isEnabled: true, ...fakeTimers() });

    updater.emit('update-available', { version: '1.1.0', releaseNotes: '新增菜单栏入口' });
    await flush();

    expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      buttons: ['下载更新', '稍后'],
      message: '发现新版本 1.1.0',
    }));
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  });

  it('下载完成后只有用户确认才重启安装', async () => {
    const updater = fakeUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
    createUpdateController({ updater, dialog, isEnabled: true, ...fakeTimers() });

    updater.emit('update-downloaded', { version: '1.1.0' });
    await flush();

    expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      buttons: ['重启并更新', '稍后'],
    }));
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('只有主动检查才提示没有更新', async () => {
    const updater = fakeUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
    const controller = createUpdateController({ updater, dialog, isEnabled: true, ...fakeTimers() });

    await controller.check({ userInitiated: false });
    updater.emit('update-not-available', { version: '1.0.0' });
    await flush();
    expect(dialog.showMessageBox).not.toHaveBeenCalled();

    await controller.check({ userInitiated: true });
    updater.emit('update-not-available', { version: '1.0.0' });
    await flush();
    expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      message: '已经是最新版本',
    }));
  });

  it('后台错误保持安静，主动检查错误才提示', async () => {
    const updater = fakeUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
    const controller = createUpdateController({ updater, dialog, isEnabled: true, ...fakeTimers() });

    await controller.check({ userInitiated: false });
    updater.emit('error', new Error('offline'));
    await flush();
    expect(dialog.showMessageBox).not.toHaveBeenCalled();

    await controller.check({ userInitiated: true });
    updater.emit('error', new Error('offline'));
    await flush();
    expect(dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      message: '暂时无法检查更新',
    }));
  });
});
