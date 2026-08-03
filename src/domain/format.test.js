import { describe, it, expect } from 'vitest';
import { formatTokens } from './format.js';

describe('formatTokens', () => {
  it('小于一千直接显示整数', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(742)).toBe('742');
  });

  it('千 / 百万 / 十亿分级', () => {
    expect(formatTokens(12_500)).toBe('12.5K');
    expect(formatTokens(340_000_000)).toBe('340M');
    expect(formatTokens(1_200_000_000)).toBe('1.2B');
  });

  it('整数量级不带多余小数', () => {
    expect(formatTokens(2_000_000_000)).toBe('2B');
    expect(formatTokens(5_000_000)).toBe('5M');
  });

  it('负数按 0 处理', () => {
    expect(formatTokens(-5)).toBe('0');
  });
});
