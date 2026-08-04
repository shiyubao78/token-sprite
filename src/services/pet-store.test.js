import { describe, it, expect } from 'vitest';
import { loadPet, savePet, defaultState } from './pet-store.js';

function memStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe('pet-store', () => {
  it('没有存档时返回默认小苗', () => {
    const s = loadPet(memStorage());
    expect(s.petName).toBe('小苗');
    expect(s.tickets.common).toBe(0);
    expect(s.eggs).toEqual([]);
  });

  it('存档能读回', () => {
    const store = memStorage();
    savePet({ ...defaultState(), petName: '闪闪', tickets: { common: 2, rare: 1, epic: 0, legendary: 0 } }, store);
    const s = loadPet(store);
    expect(s.petName).toBe('闪闪');
    expect(s.tickets.rare).toBe(1);
  });

  it('存档损坏时回落默认，不抛错', () => {
    const store = memStorage({ 'token-sprite:pet:v1': '{坏掉的 json' });
    const s = loadPet(store);
    expect(s.petName).toBe('小苗');
  });

  it('缺字段的旧存档会补齐默认值', () => {
    const store = memStorage({ 'token-sprite:pet:v1': JSON.stringify({ petName: '半个' }) });
    const s = loadPet(store);
    expect(s.petName).toBe('半个');
    expect(s.tickets.common).toBe(0);
    expect(s.collection).toEqual({});
  });
});
