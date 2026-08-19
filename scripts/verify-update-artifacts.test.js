import { describe, expect, it } from 'vitest';
import { listedArtifactNames, parseUpdateEntries, verifyUpdateArtifacts } from './verify-update-artifacts.mjs';

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

describe('校验和核对', () => {
  const yaml = `version: 1.0.0
files:
  - url: app.zip
    sha512: AAAA==
    size: 100
  - url: app.dmg
    sha512: BBBB==
    size: 200
path: app.zip
`;
  const exists = () => true;

  it('校验和与大小都对得上时通过', () => {
    const digests = { 'app.zip': { sha512: 'AAAA==', size: 100 }, 'app.dmg': { sha512: 'BBBB==', size: 200 } };
    expect(verifyUpdateArtifacts('/release', yaml, exists, (n) => digests[n])).toContain('app.zip');
  });

  it('校验和对不上时拦住（描述和安装包不是同一次构建）', () => {
    const digests = { 'app.zip': { sha512: 'WRONG==', size: 100 }, 'app.dmg': { sha512: 'BBBB==', size: 200 } };
    expect(() => verifyUpdateArtifacts('/release', yaml, exists, (n) => digests[n]))
      .toThrow(/app\.zip 校验和对不上/);
  });

  it('大小对不上时拦住', () => {
    const digests = { 'app.zip': { sha512: 'AAAA==', size: 999 }, 'app.dmg': { sha512: 'BBBB==', size: 200 } };
    expect(() => verifyUpdateArtifacts('/release', yaml, exists, (n) => digests[n]))
      .toThrow(/大小对不上/);
  });

  it('解析出每个产物的校验和与大小', () => {
    expect(parseUpdateEntries(yaml)).toEqual([
      { name: 'app.zip', sha512: 'AAAA==', size: 100 },
      { name: 'app.dmg', sha512: 'BBBB==', size: 200 },
    ]);
  });
});
