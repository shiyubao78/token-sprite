import { describe, it, expect } from 'vitest';
import { shouldAutoInstall, messageFor } from './auto-install.mjs';

const base = { platform: 'darwin', env: {}, appInstalled: true };

describe('shouldAutoInstall', () => {
  it('已装过 + mac + 普通环境：自动重装', () => {
    expect(shouldAutoInstall(base)).toEqual({ run: true, reason: 'update' });
  });

  it('首次 clone（还没装过）：不擅自装，只提示', () => {
    expect(shouldAutoInstall({ ...base, appInstalled: false })).toEqual({ run: false, reason: 'first-time' });
  });

  it('CI 里绝不触发', () => {
    expect(shouldAutoInstall({ ...base, env: { CI: 'true' } }).run).toBe(false);
  });

  it('开发者可以用环境变量关掉', () => {
    expect(shouldAutoInstall({ ...base, env: { TS_NO_AUTO_INSTALL: '1' } })).toEqual({ run: false, reason: 'opted-out' });
  });

  it('非 macOS 不触发（一键安装脚本只支持 mac）', () => {
    expect(shouldAutoInstall({ ...base, platform: 'win32' }).run).toBe(false);
    expect(shouldAutoInstall({ ...base, platform: 'linux' }).run).toBe(false);
  });

  it('CI 优先于「已装过」——即使 CI 机器上有 app 也不装', () => {
    expect(shouldAutoInstall({ platform: 'darwin', env: { CI: '1' }, appInstalled: true }).run).toBe(false);
  });
});

describe('messageFor', () => {
  it('首次提示里给出该跑的命令', () => {
    expect(messageFor('first-time')).toContain('npm run install:local');
  });

  it('自动重装时告诉用户怎么关掉', () => {
    expect(messageFor('update')).toContain('TS_NO_AUTO_INSTALL');
  });

  it('未知原因不输出噪音', () => {
    expect(messageFor('whatever')).toBe('');
  });
});
