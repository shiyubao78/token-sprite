import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { KEY, loadPet, savePet } from './pet-store.js';

// 跨版本更新时，用户的成长/喂养进度能否保留，取决于这几个"身份"是否稳定：
//  - 存档 key：定位 localStorage 里的存档
//  - build.appId / build.productName：决定 macOS 用户数据目录（~/Library/Application Support/<productName>）
// 任何一个变了，覆盖安装后旧存档就读不到 = 用户进度"丢失"。这个测试把它们钉死。
const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

describe('存档持久化不变量（改动会导致更新后用户进度丢失）', () => {
  it('存档 key 必须保持不变', () => {
    expect(KEY).toBe('token-sprite:pet:v1');
  });

  it('appId 必须保持不变（决定用户数据目录）', () => {
    expect(pkg.build?.appId).toBe('com.tokensprite.app');
  });

  it('productName 必须保持不变（决定用户数据目录名）', () => {
    expect(pkg.build?.productName).toBe('Token小精灵');
  });

  it('喂养进度能原样存取回来（模拟"新版本读旧存档"）', () => {
    const store = new Map();
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };

    // 旧版本存下：正在孵的贝壳蛋喂了 2 亿、图鉴已收萌芽
    const before = { petName: '小贝', eggs: [{ id: 'e1', species: 'shell', rarity: 'common', at: 1, fed: 2e8 }], activeEggId: 'e1', collection: { flower: { count: 1, firstAt: 1 } }, baseline: { total: 5e9, bySource: {}, at: 1 } };
    savePet(before, storage);

    // 新版本启动：用同一个 key 读回
    const after = loadPet(storage);
    expect(after.eggs[0].fed).toBe(2e8);         // 喂养量不变
    expect(after.activeEggId).toBe('e1');         // 在养的还是它
    expect(after.collection.flower.count).toBe(1); // 图鉴保留
    expect(after.baseline.total).toBe(5e9);        // 基准保留（成长按新增算，不会突然清零/暴涨）
    expect(after.petName).toBe('小贝');
  });
});
