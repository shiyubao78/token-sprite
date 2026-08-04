import { describe, it, expect } from 'vitest';
import { drawEgg } from './gacha.js';
import { speciesOfRarity } from '../config/species.js';

function seq(vals) {
  let i = 0;
  return () => vals[i++ % vals.length];
}

describe('drawEgg', () => {
  it('券档命中(rng<0.7)开出本档蛋', () => {
    const r = drawEgg('common', seq([0.1, 0]));
    expect(r.rarity).toBe('common');
    expect(speciesOfRarity('common').map((s) => s.key)).toContain(r.species);
  });
  it('传说券命中开出传说蛋', () => {
    const r = drawEgg('legendary', seq([0.1, 0]));
    expect(r.rarity).toBe('legendary');
  });
  it('惊喜(rng≥0.7)落到别的档', () => {
    const r = drawEgg('common', seq([0.9, 0.0, 0]));
    expect(r.rarity).not.toBe('common');
    expect(['rare', 'epic', 'legendary']).toContain(r.rarity);
  });
});
