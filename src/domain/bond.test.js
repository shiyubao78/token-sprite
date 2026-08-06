import { describe, it, expect } from 'vitest';
import { bondPoints, bondLevel, petInteract, settleBondLevel, bondView, bondActive, activateBond, CODE_PER_POINT, INTERACT_DAILY_CAP } from './bond.js';

const M = 1_000_000;
// 已激活的空羁绊（startedAt=0，方便直接用 growthTotal 当"化形后新增"）。
const active = (interactPoints = 0, level = 1) => ({ bond: { startedAt: 0, interactPoints, todayInteract: 0, day: '', level } });

describe('激活门槛（化形后才开始）', () => {
  it('未激活时亲密度恒为 0、逗它/升级都不生效', () => {
    const s = {};
    expect(bondActive(s)).toBe(false);
    expect(bondPoints(s, 999 * M)).toBe(0);
    expect(petInteract(s, '2026-08-05')).toBe(false);
    expect(settleBondLevel(s, 999 * M)).toBeNull();
    expect(bondView(s, 999 * M).active).toBe(false);
  });
  it('activateBond 记录起始 growth，之后按"新增"计分', () => {
    const s = {};
    expect(activateBond(s, 100 * M)).toBe(true);   // 化形时 growth=100M 当基准
    expect(bondActive(s)).toBe(true);
    expect(bondPoints(s, 100 * M)).toBe(0);         // 刚激活，新增 0
    expect(bondPoints(s, 200 * M)).toBe(5);         // 新增 100M / 20M = 5
    expect(activateBond(s, 500 * M)).toBe(false);   // 不重复激活
  });
});

describe('bondPoints（化形后写代码 + 互动累积）', () => {
  it('写代码每 20M +1', () => {
    expect(bondPoints(active(), 100 * M)).toBe(5);
    expect(bondPoints(active(), 19 * M)).toBe(0);
  });
  it('叠加互动分', () => {
    expect(bondPoints(active(7), 40 * M)).toBe(9); // 2 + 7
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
    const s = active();
    let added = 0;
    for (let i = 0; i < INTERACT_DAILY_CAP + 5; i++) if (petInteract(s, '2026-08-05')) added++;
    expect(added).toBe(INTERACT_DAILY_CAP);
  });
  it('换一天重置上限', () => {
    const s = active();
    for (let i = 0; i < INTERACT_DAILY_CAP; i++) petInteract(s, '2026-08-05');
    expect(petInteract(s, '2026-08-05')).toBe(false);
    expect(petInteract(s, '2026-08-06')).toBe(true);
  });
});

describe('settleBondLevel 升级检测', () => {
  it('跨过门槛返回新等级，用于庆祝', () => {
    const s = active(0, 1);
    const up = settleBondLevel(s, 20 * CODE_PER_POINT); // 20 分 → Lv2
    expect(up.level).toBe(2);
    expect(s.bond.level).toBe(2);
  });
  it('没升级返回 null，且不降级', () => {
    const s = active(0, 3);
    expect(settleBondLevel(s, 0)).toBeNull();
    expect(s.bond.level).toBe(3);
  });
});

describe('bondView 进度', () => {
  it('给出到下一级的进度与解锁', () => {
    const v = bondView(active(40), 0); // 40 分 → Lv2(20~60)
    expect(v.active).toBe(true);
    expect(v.level).toBe(2);
    expect(v.nextName).toBe('亲近');
    expect(v.toNext).toBe(20);
    expect(v.pct).toBe(50);
  });
  it('满级 pct=100、isMax', () => {
    const v = bondView(active(500), 0);
    expect(v.isMax).toBe(true);
    expect(v.pct).toBe(100);
  });
});
