import { describe, expect, it } from 'vitest';
import { listedArtifactNames, verifyUpdateArtifacts } from './verify-update-artifacts.mjs';

describe('verifyUpdateArtifacts', () => {
  it('读取更新描述中的下载文件并去重', () => {
    const yaml = `
files:
  - url: token-sprite-1.0.0-universal-mac.zip
  - url: token-sprite-1.0.0.dmg
path: token-sprite-1.0.0-universal-mac.zip
`;
    expect(listedArtifactNames(yaml)).toEqual([
      'token-sprite-1.0.0-universal-mac.zip',
      'token-sprite-1.0.0.dmg',
    ]);
  });

  it('描述文件名与本地产物不一致时失败', () => {
    const yaml = 'files:\n  - url: token-sprite-1.0.0.dmg\n';
    const existing = new Set(['Token小精灵-1.0.0.dmg']);
    expect(() => verifyUpdateArtifacts('/release', yaml, (name) => existing.has(name)))
      .toThrow(/token-sprite-1.0.0.dmg/);
  });

  it('描述的所有产物真实存在时通过', () => {
    const yaml = 'files:\n  - url: token-sprite-1.0.0.dmg\n  - url: token-sprite-1.0.0.zip\n';
    const existing = new Set(['token-sprite-1.0.0.dmg', 'token-sprite-1.0.0.zip']);
    expect(verifyUpdateArtifacts('/release', yaml, (name) => existing.has(name)))
      .toEqual(['token-sprite-1.0.0.dmg', 'token-sprite-1.0.0.zip']);
  });
});
