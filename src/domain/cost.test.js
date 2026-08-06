import { describe, it, expect } from 'vitest';
import { DEFAULT_USD_PER_MILLION, estimateCost, formatMoney } from './cost.js';

const M = 1_000_000;

describe('estimateCost 花费估算（单一混合价）', () => {
  it('token / 100万 × 单价', () => {
    expect(estimateCost(100 * M, 8)).toBe(800);
    expect(estimateCost(1.5 * M, 8)).toBe(12);
  });
  it('默认单价', () => {
    expect(estimateCost(1 * M, DEFAULT_USD_PER_MILLION)).toBe(DEFAULT_USD_PER_MILLION);
  });
  it('缺省/非法输入不报错、当 0', () => {
    expect(estimateCost(0, 8)).toBe(0);
    expect(estimateCost(undefined, 8)).toBe(0);
    expect(estimateCost(100 * M, undefined)).toBe(estimateCost(100 * M, DEFAULT_USD_PER_MILLION));
    expect(estimateCost(-5, 8)).toBe(0);
  });
});

describe('formatMoney 展示（美元）', () => {
  it('小额取整带千分位', () => {
    expect(formatMoney(147)).toBe('$147');
    expect(formatMoney(800)).toBe('$800');
    expect(formatMoney(999)).toBe('$999');
  });
  it('小额（<10）保留一位小数', () => {
    expect(formatMoney(3.44)).toBe('$3.4');
    expect(formatMoney(0)).toBe('$0');
  });
  it('大额用 K/M 缩写（防折行）', () => {
    expect(formatMoney(9400)).toBe('$9.4K');
    expect(formatMoney(1000)).toBe('$1K');
    expect(formatMoney(12229)).toBe('$12.2K');
    expect(formatMoney(150000)).toBe('$150K'); // ≥100K取整
    expect(formatMoney(1_200_000)).toBe('$1.2M');
  });
});
