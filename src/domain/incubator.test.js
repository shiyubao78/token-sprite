import { describe, it, expect } from 'vitest';
import { drawFromTicket, ensureStarter, setActiveEgg, settleHatch } from './incubator.js';

const B = 1_000_000_000;
function seq(vals) { let i = 0; return () => vals[i++ % vals.length]; }
function baseState() {
  return {
    tickets: { common: 1, rare: 0, epic: 0, legendary: 0 },
    eggs: [], activeEggId: null, incubationStart: 0, collection: {}, activePetSpecies: null,
  };
}

describe('drawFromTicket', () => {
  it('消耗一张券、得一颗蛋', () => {
    const s = baseState();
    const r = drawFromTicket(s, 'common', seq([0.1, 0]));
    expect(r.egg.rarity).toBe('common');
    expect(s.tickets.common).toBe(0);
    expect(s.eggs).toHaveLength(1);
  });
  it('没券返回 null', () => {
    const s = baseState();
    s.tickets.common = 0;
    expect(drawFromTicket(s, 'common', seq([0.1, 0]))).toBeNull();
  });
});

describe('ensureStarter', () => {
  it('全空时送启动蛋并设为在孵', () => {
    const s = baseState();
    s.tickets.common = 0;
    expect(ensureStarter(s, 0, seq([0.1, 0]))).toBe(true);
    expect(s.eggs).toHaveLength(1);
    expect(s.activeEggId).toBe(s.eggs[0].id);
  });
  it('已有图鉴则不再送', () => {
    const s = baseState();
    s.collection = { mossling: { count: 1 } };
    expect(ensureStarter(s, 0, seq([0.1, 0]))).toBe(false);
  });
});

describe('settleHatch', () => {
  it('喂够门槛破壳、进图鉴、清空在孵、设为出战', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.1, 0])); // 一颗 common 蛋在孵，start=0
    const species = s.eggs[0].species;
    const r = settleHatch(s, 0.6 * B); // common 门槛 0.5B → 破壳
    expect(r.species).toBe(species);
    expect(s.collection[species].count).toBe(1);
    expect(s.activeEggId).toBeNull();
    expect(s.eggs).toHaveLength(0);
    expect(s.activePetSpecies).toBe(species);
  });
  it('没喂够不破壳', () => {
    const s = baseState();
    ensureStarter(s, 0, seq([0.1, 0]));
    expect(settleHatch(s, 0.2 * B)).toBeNull();
  });
});
