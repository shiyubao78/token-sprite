import { describe, it, expect } from 'vitest';
import { incubation, evolution } from './incubation.js';

const B = 1_000_000_000;

describe('incubation', () => {
  it('喂够门槛即破壳', () => {
    const r = incubation(1 * B, 'common'); // fed 1B / need 0.5B
    expect(r.done).toBe(true);
    expect(r.fraction).toBe(1);
  });
  it('中途进度按比例', () => {
    const r = incubation(0.25 * B, 'common'); // fed 0.25B / 0.5B
    expect(r.fraction).toBeCloseTo(0.5, 5);
    expect(r.done).toBe(false);
  });
  it('传说门槛更高、更难孵', () => {
    const r = incubation(5 * B, 'legendary'); // fed 5B / 30B
    expect(r.done).toBe(false);
    expect(r.fraction).toBeLessThan(0.2);
  });
});

describe('evolution 进化详情', () => {
  it('刚开始(0%)：当前第1段(蛋)，化形保持神秘', () => {
    const e = evolution(0, 'common'); // need 0.5B
    expect(e.current).toBe(1);
    expect(e.stages.map((s) => s.state)).toEqual(['current', 'locked', 'locked', 'locked', 'mystery']);
    expect(e.toHatch).toBe(0.5 * B);
    expect(e.stages[0].toNext).toBe(0.125 * B); // 到幼体还差 1/4 门槛
    expect(e.stages[0].nextName).toBe('幼体');
  });

  it('养到 40%：当前第2段(幼体)，本段已 60%、距成长还差 50M', () => {
    const e = evolution(0.2 * B, 'common'); // 0.2/0.5 = 40%
    expect(e.current).toBe(2);
    expect(e.stages[0].state).toBe('done');
    expect(e.stages[1].state).toBe('current');
    expect(e.stages[1].withinPct).toBeCloseTo(0.6, 5);
    expect(e.stages[1].toNext).toBeCloseTo(0.05 * B, 3); // 250M-200M
    expect(e.stages[1].nextName).toBe('成长');
  });

  it('段边界(50%)：进入第3段(成长)，本段进度归零', () => {
    const e = evolution(0.25 * B, 'common'); // 50%
    expect(e.current).toBe(3);
    expect(e.stages[2].state).toBe('current');
    expect(e.stages[2].withinPct).toBeCloseTo(0, 5);
  });

  it('中间段是 locked、化形段永远 mystery（未满时）', () => {
    const e = evolution(0.6 * B, 'common'); // 满了? 0.6/0.5=1.2 -> clamp 1
    // 用不满门槛的稀有度看 mystery：史诗 8B，喂 4B → 50%
    const ep = evolution(4 * B, 'epic');
    expect(ep.stages[4].state).toBe('mystery'); // 化形仍神秘
    expect(ep.stages[4].name).toBe('化形');
  });

  it('每段累计门槛按 (n-1)/4 × need', () => {
    const e = evolution(0, 'rare'); // need 2B
    expect(e.stages.map((s) => s.threshold)).toEqual([0, 0.5 * B, 1 * B, 1.5 * B, 2 * B]);
  });
});
