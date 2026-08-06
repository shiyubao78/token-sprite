import { describe, it, expect } from 'vitest';
import { bondPoints, bondLevel, petInteract, settleBondLevel, bondView, CODE_PER_POINT, INTERACT_DAILY_CAP } from './bond.js';

const M = 1_000_000;

describe('bondPoints（写代码 + 互动累积）', () => {
  it('写代码每 20M +1', () => {
    expect(bondPoints({}, 100 * M)).toBe(5);      // 100M / 20M = 5
    expect(bondPoints({}, 0)).toBe(0);
    expect(bondPoints({}, 19 * M)).toBe(0);        // 不满一档不计
  });
  it('叠加互动分', () => {
    expect(bondPoints({ bond: { interactPoints: 7 } }, 40 * M)).toBe(9); // 2 + 7
  });
});

describe('bondLevel 分段', () => {
  it.each([
    [0, 1], [19, 1], [20, 2], [59, 2], [60, 3], [149, 3], [150, 4], [300, 5], [9999, 5],
  ])('%i 分 → Lv%i', (pts, lv) => {
    expect(bondLevel(pts).level).toBe(lv);
  });
});

describe('petInteract 每日上限', () => {
  it('每天最多加 INTERACT_DAILY_CAP 次', () => {
    const s = {};
    let added = 0;
    for (let i = 0; i < INTERACT_DAILY_CAP + 5; i++) if (petInteract(s, '2026-08-05')) added++;
    expect(added).toBe(INTERACT_DAILY_CAP);
    expect(s.bond.interactPoints).toBe(INTERACT_DAILY_CAP);
  });
  it('换一天重置上限', () => {
    const s = {};
    for (let i = 0; i < INTERACT_DAILY_CAP; i++) petInteract(s, '2026-08-05');
    expect(petInteract(s, '2026-08-05')).toBe(false); // 当天满了
    expect(petInteract(s, '2026-08-06')).toBe(true);  // 新的一天又能加
    expect(s.bond.interactPoints).toBe(INTERACT_DAILY_CAP + 1);
  });
});

describe('settleBondLevel 升级检测', () => {
  it('跨过门槛返回新等级，用于庆祝', () => {
    const s = { bond: { interactPoints: 0, todayInteract: 0, day: '', level: 1 } };
    const up = settleBondLevel(s, 20 * CODE_PER_POINT); // 20 分 → Lv2
    expect(up.level).toBe(2);
    expect(s.bond.level).toBe(2);
  });
  it('没升级返回 null，且不降级', () => {
    const s = { bond: { interactPoints: 0, todayInteract: 0, day: '', level: 3 } };
    expect(settleBondLevel(s, 0)).toBeNull(); // 算出来 Lv1 但已是 Lv3，不降
    expect(s.bond.level).toBe(3);
  });
});

describe('bondView 进度', () => {
  it('给出到下一级的进度与解锁', () => {
    const v = bondView({ bond: { interactPoints: 40 } }, 0); // 40 分 → Lv2(20~60)
    expect(v.level).toBe(2);
    expect(v.nextName).toBe('亲近');
    expect(v.toNext).toBe(20);          // 60 - 40
    expect(v.pct).toBe(50);             // (40-20)/(60-20)
    expect(v.isMax).toBe(false);
  });
  it('满级 pct=100、isMax', () => {
    const v = bondView({ bond: { interactPoints: 500 } }, 0);
    expect(v.isMax).toBe(true);
    expect(v.pct).toBe(100);
  });
});
