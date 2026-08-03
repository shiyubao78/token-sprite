import { describe, it, expect } from 'vitest';
import { stageFor, nextStageFor, progressFor, decayLevels, effectiveStage } from './growth.js';
import { STAGES, DECAY_MS } from '../config/stages.js';

const B = 1_000_000_000;
const M = 1_000_000;

describe('5 段进化链', () => {
  it('封顶为 5 段，终点是化形小精灵', () => {
    expect(STAGES).toHaveLength(5);
    expect(STAGES[4].key).toBe('fairy');
  });
});

describe('stageFor（按累计消耗）', () => {
  it('0 是种子，负数按 0', () => {
    expect(stageFor(0).key).toBe('seed');
    expect(stageFor(-5).key).toBe('seed');
  });
  it('阈值分界正确', () => {
    expect(stageFor(300 * M).key).toBe('sprout');
    expect(stageFor(1.5 * B).key).toBe('seedling');
    expect(stageFor(5 * B).key).toBe('bud');
    expect(stageFor(15 * B).key).toBe('fairy');
  });
  it('差一点不进化', () => {
    expect(stageFor(300 * M - 1).key).toBe('seed');
  });
  it('超过顶格仍是精灵', () => {
    expect(stageFor(500 * B).key).toBe('fairy');
  });
});

describe('progressFor', () => {
  it('顶格进度锁定 100%', () => {
    const p = progressFor(30 * B);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
  });
  it('阶段中段进度约 0.5', () => {
    const mid = (1.5 * B + 5 * B) / 2;
    expect(progressFor(mid).fraction).toBeCloseTo(0.5, 5);
  });
});

describe('decayLevels（空窗回落）', () => {
  it('24 小时内不掉级', () => {
    expect(decayLevels(0)).toBe(0);
    expect(decayLevels(DECAY_MS - 1)).toBe(0);
  });
  it('每满 24 小时掉一级', () => {
    expect(decayLevels(DECAY_MS)).toBe(1);
    expect(decayLevels(2.5 * DECAY_MS)).toBe(2);
  });
});

describe('effectiveStage（累计消耗 + 空窗回落）', () => {
  it('活跃时等于累计消耗对应的形态', () => {
    const r = effectiveStage(2 * B, 0);
    expect(r.stage.key).toBe('seedling');
    expect(r.decayed).toBe(false);
  });
  it('超 24 小时没消耗退回一级', () => {
    const r = effectiveStage(2 * B, DECAY_MS + 1000);
    expect(r.base.key).toBe('seedling');
    expect(r.stage.key).toBe('sprout');
    expect(r.decayed).toBe(true);
    expect(r.dropped).toBe(1);
  });
  it('再蔫也不会低于种子', () => {
    const r = effectiveStage(400 * M, 10 * DECAY_MS);
    expect(r.stage.key).toBe('seed');
  });
});
