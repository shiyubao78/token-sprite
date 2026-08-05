import { describe, it, expect } from 'vitest';
import { drawFromTicket, ensureStarter, setActiveEgg, settleHatch, accrue, mergeDuplicates, mergeableGroups, normalizeSpecies } from './incubator.js';
import { speciesByKey } from '../config/species.js';

const B = 1_000_000_000;
function seq(vals) { let i = 0; return () => vals[i++ % vals.length]; }
function baseState() {
  return {
    tickets: { common: 1, rare: 0, epic: 0, legendary: 0 },
    eggs: [], activeEggId: null, lastGrowth: null, collection: {}, activePetSpecies: null,
  };
}

describe('drawFromTicket', () => {
  it('消耗一张券、得一颗蛋、初始喂养为 0', () => {
    const s = baseState();
    const r = drawFromTicket(s, 'common', seq([0.9, 0]));
    expect(r.egg.rarity).toBe('common');
    expect(s.tickets.common).toBe(0);
    expect(s.eggs).toHaveLength(1);
    expect(s.eggs[0].fed).toBe(0);
  });
  it('没券返回 null', () => {
    const s = baseState();
    s.tickets.common = 0;
    expect(drawFromTicket(s, 'common', seq([0.9, 0]))).toBeNull();
  });
});

describe('ensureStarter', () => {
  it('全空时送启动蛋并设为在孵', () => {
    const s = baseState();
    s.tickets.common = 0;
    expect(ensureStarter(s, 0, seq([0.9, 0]))).toBe(true);
    expect(s.eggs).toHaveLength(1);
    expect(s.activeEggId).toBe(s.eggs[0].id);
  });
  it('已有图鉴则不再送', () => {
    const s = baseState();
    s.collection = { mossling: { count: 1 } };
    expect(ensureStarter(s, 0, seq([0.9, 0]))).toBe(false);
  });
  it('默认名跟随启动的那只（用它的昵称）', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.9, 0]));
    const sp = speciesByKey(s.eggs[0].species);
    expect(s.petName).toBe(sp.nick);
  });
  it('用户已改过名就不覆盖', () => {
    const s = baseState();
    s.petName = '旺财';
    ensureStarter(s, 0, seq([0.9, 0]));
    expect(s.petName).toBe('旺财');
  });
});

describe('accrue（每只自己累积喂养）', () => {
  it('只有桌面上那只(在养)吸收新增 token', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.9, 0]));
    accrue(s, 0);          // 初始化记账基准
    accrue(s, 0.3 * B);    // 新增 0.3B → 全喂给在养的这只
    expect(s.eggs[0].fed).toBeCloseTo(0.3 * B, 0);
  });

  it('切换在养对象时，各自进度都保留、不清零', () => {
    const s = baseState();
    // 手动放两颗蛋
    s.eggs = [
      { id: 'a', rarity: 'common', species: 'flower', at: 1, fed: 0 },
      { id: 'b', rarity: 'common', species: 'shell', at: 2, fed: 0 },
    ];
    s.activeEggId = 'a';
    accrue(s, 0);
    accrue(s, 0.2 * B);              // a 吃到 0.2B
    setActiveEgg(s, 'b', 0.2 * B);   // 切到 b（先把增量结算给 a）
    accrue(s, 0.5 * B);              // 新增 0.3B → 给 b
    expect(s.eggs.find((e) => e.id === 'a').fed).toBeCloseTo(0.2 * B, 0); // a 冻结在 0.2B
    expect(s.eggs.find((e) => e.id === 'b').fed).toBeCloseTo(0.3 * B, 0); // b 累积 0.3B
    // 再切回 a，继续在 0.2B 基础上累积
    setActiveEgg(s, 'a', 0.5 * B);
    accrue(s, 0.6 * B);              // 新增 0.1B → 给 a
    expect(s.eggs.find((e) => e.id === 'a').fed).toBeCloseTo(0.3 * B, 0);
  });

  it('迁移旧存档：把在孵蛋的历史进度换算成 fed', () => {
    const s = baseState();
    s.eggs = [{ id: 'a', rarity: 'common', species: 'flower', at: 1 }]; // 无 fed
    s.activeEggId = 'a';
    s.incubationStart = 0.1 * B; // 旧字段：从 growth=0.1B 开始在孵
    s.lastGrowth = null;
    accrue(s, 0.4 * B); // 当前 growth 0.4B → 已喂 0.3B
    expect(s.eggs[0].fed).toBeCloseTo(0.3 * B, 0);
    expect(s.lastGrowth).toBe(0.4 * B);
  });
});

describe('normalizeSpecies 旧存档迁移', () => {
  it('废弃品种归一到现有品种，之后能合并到一起', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'nightfox', rarity: 'common', at: 1, fed: 5000000 }, // 废弃
      { id: 'b', species: 'mossling', rarity: 'common', at: 2, fed: 0 },        // 废弃
      { id: 'c', species: 'flower', rarity: 'common', at: 3, fed: 50000000 },   // 现有
      { id: 'd', species: 'ice', rarity: 'epic', at: 4, fed: 0 },               // 现有，不动
    ];
    expect(normalizeSpecies(s)).toBe(true);
    // 前 3 只都归一成同一个现有品种 → 变成可合并的一组
    expect(mergeableGroups(s)).toBe(1);
    const r = mergeDuplicates(s);
    expect(r.merged[0].count).toBe(3);
    expect(s.eggs).toHaveLength(2); // 合并后：1 归一品种 + 1 ice
  });
  it('全是现有品种时不改动', () => {
    const s = baseState();
    s.eggs = [{ id: 'a', species: 'flower', rarity: 'common', at: 1, fed: 0 }];
    expect(normalizeSpecies(s)).toBe(false);
  });
  it('废弃的出战品种清空', () => {
    const s = baseState();
    s.activePetSpecies = 'nightfox';
    expect(normalizeSpecies(s)).toBe(true);
    expect(s.activePetSpecies).toBeNull();
  });
});

describe('mergeDuplicates 合并同类蛋', () => {
  it('同品种多颗并成一颗：fed 累加 + 每多一颗送奖励', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'shell', rarity: 'common', at: 1, fed: 0.1 * B },
      { id: 'b', species: 'shell', rarity: 'common', at: 2, fed: 0.05 * B },
      { id: 'c', species: 'shell', rarity: 'common', at: 3, fed: 0 },
    ];
    const r = mergeDuplicates(s);
    expect(s.eggs).toHaveLength(1);
    // 0.15B 累加 + 普通奖励 0.05B × (3-1) = 0.25B
    expect(s.eggs[0].fed).toBeCloseTo(0.25 * B, 0);
    expect(r.merged[0]).toMatchObject({ species: 'shell', count: 3 });
    expect(r.totalGained).toBeCloseTo(0.1 * B, 0);
  });

  it('不同品种不合并；各自成组', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'shell', rarity: 'common', at: 1, fed: 0 },
      { id: 'b', species: 'flower', rarity: 'common', at: 2, fed: 0 },
    ];
    expect(mergeDuplicates(s)).toBeNull(); // 没有 ≥2 的同类
    expect(s.eggs).toHaveLength(2);
  });

  it('保留在养的那颗当合并结果', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'shell', rarity: 'common', at: 1, fed: 0 },
      { id: 'keep', species: 'shell', rarity: 'common', at: 2, fed: 0 },
    ];
    s.activeEggId = 'keep';
    mergeDuplicates(s);
    expect(s.eggs).toHaveLength(1);
    expect(s.eggs[0].id).toBe('keep');
    expect(s.activeEggId).toBe('keep');
  });

  it('稀有度不同奖励不同（稀有 0.2B/颗）', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'fire', rarity: 'rare', at: 1, fed: 0 },
      { id: 'b', species: 'fire', rarity: 'rare', at: 2, fed: 0 },
    ];
    const r = mergeDuplicates(s);
    expect(r.totalGained).toBeCloseTo(0.2 * B, 0);
  });

  it('mergeableGroups 数可合并的品种组', () => {
    const s = baseState();
    s.eggs = [
      { id: 'a', species: 'shell', rarity: 'common', at: 1, fed: 0 },
      { id: 'b', species: 'shell', rarity: 'common', at: 2, fed: 0 },
      { id: 'c', species: 'fire', rarity: 'rare', at: 3, fed: 0 },
    ];
    expect(mergeableGroups(s)).toBe(1);
  });
});

describe('settleHatch', () => {
  it('喂够门槛破壳、进图鉴、清空在孵、设为陪伴', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.9, 0])); // 一颗 common 蛋在孵
    const species = s.eggs[0].species;
    accrue(s, 0);
    accrue(s, 0.6 * B); // common 门槛 0.5B → 喂够
    const r = settleHatch(s, 0.6 * B);
    expect(r.species).toBe(species);
    expect(s.collection[species].count).toBe(1);
    expect(s.activeEggId).toBeNull();
    expect(s.eggs).toHaveLength(0);
    expect(s.activePetSpecies).toBe(species);
  });
  it('没喂够不破壳', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.9, 0]));
    accrue(s, 0);
    accrue(s, 0.2 * B);
    expect(settleHatch(s, 0.2 * B)).toBeNull();
  });
});
