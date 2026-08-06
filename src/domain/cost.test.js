import { describe, it, expect } from 'vitest';
import { DEFAULT_YUAN_PER_MILLION, estimateCost, formatYuan, budgetView, settleBudgetAlert } from './cost.js';

const M = 1_000_000;

describe('estimateCost 花费估算（单一混合价）', () => {
  it('token / 100万 × 单价', () => {
    expect(estimateCost(100 * M, 8)).toBe(800);
    expect(estimateCost(1.5 * M, 8)).toBe(12);
  });
  it('默认单价', () => {
    expect(estimateCost(1 * M, DEFAULT_YUAN_PER_MILLION)).toBe(DEFAULT_YUAN_PER_MILLION);
  });
  it('缺省/非法输入不报错、当 0', () => {
    expect(estimateCost(0, 8)).toBe(0);
    expect(estimateCost(undefined, 8)).toBe(0);
    expect(estimateCost(100 * M, undefined)).toBe(estimateCost(100 * M, DEFAULT_YUAN_PER_MILLION));
    expect(estimateCost(-5, 8)).toBe(0);
  });
});

describe('formatYuan 展示', () => {
  it('大额取整带千分位', () => {
    expect(formatYuan(1234)).toBe('¥1,234');
    expect(formatYuan(800)).toBe('¥800');
  });
  it('小额（<10）保留一位小数', () => {
    expect(formatYuan(3.44)).toBe('¥3.4');
    expect(formatYuan(0)).toBe('¥0');
  });
  it('大额用万/亿缩写（防折行）', () => {
    expect(formatYuan(68170)).toBe('¥6.8万');
    expect(formatYuan(10000)).toBe('¥1万');
    expect(formatYuan(9999)).toBe('¥9,999'); // 不到万仍用千分位
    expect(formatYuan(1234000)).toBe('¥123万'); // ≥100万取整
    expect(formatYuan(250000000)).toBe('¥2.5亿');
  });
});

describe('budgetView 预算进度', () => {
  it('没设预算', () => {
    const v = budgetView(50, null);
    expect(v.hasBudget).toBe(false);
  });
  it('未到 80% = ok', () => {
    const v = budgetView(50, 100);
    expect(v.hasBudget).toBe(true);
    expect(v.pct).toBe(50);
    expect(v.level).toBe('ok');
  });
  it('到 80% = near', () => {
    expect(budgetView(80, 100).level).toBe('near');
    expect(budgetView(99, 100).level).toBe('near');
  });
  it('超 100% = over，进度条封顶 100', () => {
    const v = budgetView(150, 100);
    expect(v.level).toBe('over');
    expect(v.pct).toBe(100);
  });
});

describe('settleBudgetAlert 每日预算提醒（每档每天一次）', () => {
  const today = '2026-08-06';

  it('没设预算不提醒', () => {
    const state = {};
    expect(settleBudgetAlert(state, 999, null, today)).toBeNull();
    expect(state.budgetAlert).toBeUndefined();
  });

  it('未到 80% 不提醒', () => {
    const state = {};
    expect(settleBudgetAlert(state, 50, 100, today)).toBeNull();
  });

  it('首次到 80% 提醒 near 并记档', () => {
    const state = {};
    const r = settleBudgetAlert(state, 85, 100, today);
    expect(r).toEqual({ level: 'near' });
    expect(state.budgetAlert).toEqual({ date: today, level: 80 });
  });

  it('同一天 near 已提醒过，不再重复', () => {
    const state = { budgetAlert: { date: today, level: 80 } };
    expect(settleBudgetAlert(state, 90, 100, today)).toBeNull();
  });

  it('同一天从 near 升到 over，提醒 over', () => {
    const state = { budgetAlert: { date: today, level: 80 } };
    const r = settleBudgetAlert(state, 120, 100, today);
    expect(r).toEqual({ level: 'over' });
    expect(state.budgetAlert).toEqual({ date: today, level: 100 });
  });

  it('直接冲过 100%（没经过 near）也只提醒 over 一次', () => {
    const state = {};
    expect(settleBudgetAlert(state, 200, 100, today)).toEqual({ level: 'over' });
    expect(state.budgetAlert).toEqual({ date: today, level: 100 });
    expect(settleBudgetAlert(state, 300, 100, today)).toBeNull();
  });

  it('跨天重置：昨天提醒过，今天重新算', () => {
    const state = { budgetAlert: { date: '2026-08-05', level: 100 } };
    const r = settleBudgetAlert(state, 85, 100, today);
    expect(r).toEqual({ level: 'near' });
    expect(state.budgetAlert).toEqual({ date: today, level: 80 });
  });
});
