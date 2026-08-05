import { describe, expect, it } from 'vitest';
import { verifyReleaseVersion } from './verify-release-version.mjs';

describe('verifyReleaseVersion', () => {
  it('接受与应用版本一致的 v 标签', () => {
    expect(verifyReleaseVersion('v1.2.3', '1.2.3')).toBe('1.2.3');
  });

  it('拒绝与应用版本不一致的标签', () => {
    expect(() => verifyReleaseVersion('v1.2.4', '1.2.3')).toThrow(/不一致/);
  });

  it('拒绝不符合 v 加语义版本的标签', () => {
    expect(() => verifyReleaseVersion('release-1.2.3', '1.2.3')).toThrow(/格式/);
    expect(() => verifyReleaseVersion('v1.2', '1.2.0')).toThrow(/格式/);
  });

  it('支持预发布版本标签', () => {
    expect(verifyReleaseVersion('v2.0.0-beta.1', '2.0.0-beta.1')).toBe('2.0.0-beta.1');
  });
});
