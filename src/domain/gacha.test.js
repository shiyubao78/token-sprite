import { describe, it, expect } from 'vitest';
import { drawEgg } from './gacha.js';
import { speciesOfRarity } from '../config/species.js';

function seq(vals) {
  let i = 0;
  return () => vals[i++ % vals.length];
}

describe('drawEgg', () => {
  it('大概率开出本档（不升档）', () => {
    const r = drawEgg('common', seq([0.9, 0])); // 0.9 ≥ 0.15 不升
    expect(r.rarity).toBe('common');
    expect(speciesOfRarity('common').map((s) => s.key)).toContain(r.species);
  });
  it('小概率升一档（rng<0.15）', () => {
    const r = drawEgg('common', seq([0.1, 0]));
    expect(r.rarity).toBe('rare');
  });
  it('只升一档：普通券绝不跳到史诗/传说', () => {
    for (const v of [0.0, 0.05, 0.1, 0.14, 0.5, 0.99]) {
      const r = drawEgg('common', seq([v, 0]));
      expect(['common', 'rare']).toContain(r.rarity);
    }
  });
  it('稀有券最多升到史诗', () => {
    expect(drawEgg('rare', seq([0.1, 0])).rarity).toBe('epic');
    expect(drawEgg('rare', seq([0.9, 0])).rarity).toBe('rare');
  });
  it('传说券封顶（不再升）', () => {
    expect(drawEgg('legendary', seq([0])).rarity).toBe('legendary');
  });
});
