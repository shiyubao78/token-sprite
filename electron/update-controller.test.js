import { describe, expect, it, vi } from 'vitest';
import { createUpdateController, compareVersions, parseReleaseFromUrl } from './update-controller.js';

function fakeDialog(response = 0) {
  return { showMessageBox: vi.fn().mockResolvedValue({ response }) };
}

function make(overrides = {}) {
  const dialog = overrides.dialog || fakeDialog(0);
  const openExternal = overrides.openExternal || vi.fn().mockResolvedValue(undefined);
  const controller = createUpdateController({
    currentVersion: '0.1.0',
    fetchLatest: overrides.fetchLatest || (async () => null),
    dialog,
    openExternal,
    isEnabled: overrides.isEnabled ?? true,
  });
  return { controller, dialog, openExternal };
}

describe('compareVersions', () => {
  it('忽略 v 前缀、逐段比较', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('v1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0);
    expect(compareVersions('0.1', '0.1.1')).toBe(-1);
  });
});

describe('parseReleaseFromUrl（从 github.com 重定向 URL 解析版本）', () => {
  it('命中 /releases/tag/<ver> → 解析出版本和下载页', () => {
    const url = 'https://github.com/shiyubao78/token-sprite/releases/tag/v0.3.0';
    expect(parseReleaseFromUrl(url)).toEqual({ version: 'v0.3.0', url });
  });
  it('重定向到 releases 列表（暂无发布）→ null', () => {
    expect(parseReleaseFromUrl('https://github.com/shiyubao78/token-sprite/releases')).toBeNull();
  });
  it('空/异常输入 → null', () => {
    expect(parseReleaseFromUrl('')).toBeNull();
    expect(parseReleaseFromUrl(null)).toBeNull();
  });
});

describe('轻量更新提醒', () => {
  it('有新版本 → 弹窗，点「去下载」→ 打开下载页', async () => {
    const { controller, dialog, openExternal } = make({
      dialog: fakeDialog(0),
      fetchLatest: async () => ({ version: '0.2.0', url: 'https://example.com/releases/0.2.0' }),
    });
    await controller.check({ userInitiated: true });
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(dialog.showMessageBox.mock.calls[0][0].message).toContain('0.2.0');
    expect(openExternal).toHaveBeenCalledWith('https://example.com/releases/0.2.0');
  });

  it('有新版本但点「稍后」→ 不打开下载页', async () => {
    const { controller, openExternal } = make({
      dialog: fakeDialog(1),
      fetchLatest: async () => ({ version: '0.2.0', url: 'https://x' }),
    });
    await controller.check({ userInitiated: true });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('已是最新 + 用户手动查 → 提示「已经是最新版本」', async () => {
    const { controller, dialog } = make({
      fetchLatest: async () => ({ version: '0.1.0', url: 'https://x' }),
    });
    await controller.check({ userInitiated: true });
    expect(dialog.showMessageBox.mock.calls[0][0].message).toBe('已经是最新版本');
  });

  it('已是最新 + 后台自动查 → 不打扰（无弹窗）', async () => {
    const { controller, dialog } = make({
      fetchLatest: async () => ({ version: '0.1.0', url: 'https://x' }),
    });
    await controller.check({ userInitiated: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('还没有任何 Release（null）→ 后台不打扰、手动查提示已最新', async () => {
    const { controller, dialog } = make({ fetchLatest: async () => null });
    await controller.check({ userInitiated: false });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    await controller.check({ userInitiated: true });
    expect(dialog.showMessageBox.mock.calls[0][0].message).toBe('已经是最新版本');
  });

  it('查询失败 + 用户手动查 → 提示「暂时无法检查更新」', async () => {
    const { controller, dialog } = make({
      fetchLatest: async () => { throw new Error('network'); },
    });
    await controller.check({ userInitiated: true });
    expect(dialog.showMessageBox.mock.calls[0][0].message).toBe('暂时无法检查更新');
  });

  it('未启用 → 完全不动作', async () => {
    const { controller, dialog, openExternal } = make({
      isEnabled: false,
      fetchLatest: async () => ({ version: '9.9.9', url: 'https://x' }),
    });
    await controller.check({ userInitiated: true });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('start 只在启用时装定时器，dispose 可清理', () => {
    const setTimeoutFn = vi.fn().mockReturnValue(1);
    const setIntervalFn = vi.fn().mockReturnValue(2);
    const clearTimeoutFn = vi.fn();
    const clearIntervalFn = vi.fn();
    const controller = createUpdateController({
      currentVersion: '0.1.0', fetchLatest: async () => null,
      dialog: fakeDialog(), openExternal: vi.fn(), isEnabled: true,
      setTimeoutFn, setIntervalFn, clearTimeoutFn, clearIntervalFn,
    });
    controller.start();
    expect(setTimeoutFn).toHaveBeenCalledOnce();
    expect(setIntervalFn).toHaveBeenCalledOnce();
    controller.dispose();
    expect(clearTimeoutFn).toHaveBeenCalledWith(1);
    expect(clearIntervalFn).toHaveBeenCalledWith(2);
  });
});
