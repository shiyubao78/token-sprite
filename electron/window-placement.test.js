import { describe, expect, it } from 'vitest';
import {
  bottomRightBounds,
  clampBoundsToWorkArea,
  isVisibleOnAnyDisplay,
  rectsIntersect,
} from './window-placement.js';

describe('rectsIntersect', () => {
  it('窗口部分露出时仍算可见', () => {
    expect(rectsIntersect(
      { x: 1400, y: 100, width: 236, height: 348 },
      { x: 0, y: 0, width: 1440, height: 900 },
    )).toBe(true);
  });

  it('仅仅贴边但没有重叠时不算可见', () => {
    expect(rectsIntersect(
      { x: 1440, y: 100, width: 236, height: 348 },
      { x: 0, y: 0, width: 1440, height: 900 },
    )).toBe(false);
  });
});

describe('isVisibleOnAnyDisplay', () => {
  const workAreas = [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: -1280, y: 100, width: 1280, height: 800 },
    { x: 0, y: -900, width: 1440, height: 900 },
  ];

  it('完整位于主屏时可见', () => {
    expect(isVisibleOnAnyDisplay(
      { x: 1000, y: 400, width: 236, height: 348 },
      workAreas,
    )).toBe(true);
  });

  it('位于负坐标副屏时可见', () => {
    expect(isVisibleOnAnyDisplay(
      { x: -500, y: 200, width: 236, height: 348 },
      workAreas,
    )).toBe(true);
  });

  it('位于上方副屏时可见', () => {
    expect(isVisibleOnAnyDisplay(
      { x: 100, y: -500, width: 236, height: 348 },
      workAreas,
    )).toBe(true);
  });

  it('完全在所有屏幕外时不可见', () => {
    expect(isVisibleOnAnyDisplay(
      { x: 2000, y: 100, width: 236, height: 348 },
      workAreas,
    )).toBe(false);
  });
});

describe('bottomRightBounds', () => {
  it('把完整窗口放到工作区右下角并留出边距', () => {
    expect(bottomRightBounds(
      { x: 0, y: 0, width: 1440, height: 900 },
      { width: 236, height: 348 },
    )).toEqual({ x: 1180, y: 528, width: 236, height: 348 });
  });

  it('正确处理负坐标副屏和收起尺寸', () => {
    expect(bottomRightBounds(
      { x: -1280, y: 0, width: 1280, height: 800 },
      { width: 56, height: 104 },
    )).toEqual({ x: -80, y: 672, width: 56, height: 104 });
  });
});

describe('clampBoundsToWorkArea', () => {
  it('把越界窗口完整夹回工作区', () => {
    expect(clampBoundsToWorkArea(
      { x: 1400, y: -100, width: 236, height: 348 },
      { x: 0, y: 0, width: 1440, height: 900 },
    )).toEqual({ x: 1204, y: 0, width: 236, height: 348 });
  });

  it('工作区比窗口小时使用工作区起点且保留窗口尺寸', () => {
    expect(clampBoundsToWorkArea(
      { x: 50, y: 60, width: 236, height: 348 },
      { x: -20, y: -30, width: 100, height: 120 },
    )).toEqual({ x: -20, y: -30, width: 236, height: 348 });
  });
});
