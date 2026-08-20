import { describe, it, expect } from 'vitest';
import { nearestEdge, dockedBounds } from './dock.js';

const WA = { x: 0, y: 25, width: 1440, height: 875 }; // 带菜单栏的工作区
const PEEK = { w: 56, h: 104 };

describe('nearestEdge', () => {
  it('窗口在左半边时吸左', () => {
    expect(nearestEdge(10, PEEK.w, WA)).toBe('left');
    expect(nearestEdge(600, PEEK.w, WA)).toBe('left');
  });

  it('窗口在右半边时吸右', () => {
    expect(nearestEdge(1384, PEEK.w, WA)).toBe('right');
    expect(nearestEdge(800, PEEK.w, WA)).toBe('right');
  });

  it('多屏：按所在屏幕的工作区判断，不按绝对坐标', () => {
    const second = { x: 1440, y: 0, width: 1920, height: 1080 };
    expect(nearestEdge(1500, PEEK.w, second)).toBe('left');  // 副屏的左边
    expect(nearestEdge(3300, PEEK.w, second)).toBe('right');
  });
});

describe('dockedBounds', () => {
  it('吸右时贴住工作区右缘', () => {
    expect(dockedBounds('right', PEEK, 400, WA)).toEqual({ x: 1384, y: 400, width: 56, height: 104 });
  });

  it('吸左时贴住工作区左缘', () => {
    expect(dockedBounds('left', PEEK, 400, WA)).toEqual({ x: 0, y: 400, width: 56, height: 104 });
  });

  it('竖直位置保持不变', () => {
    expect(dockedBounds('right', PEEK, 123, WA).y).toBe(123);
  });

  it('顶部越界时夹回工作区内（不盖住菜单栏）', () => {
    expect(dockedBounds('right', PEEK, -50, WA).y).toBe(25);
  });

  it('底部越界时夹回工作区内', () => {
    expect(dockedBounds('right', PEEK, 9999, WA).y).toBe(25 + 875 - 104);
  });

  it('工作区比窗口还矮时也不会算出负数位置', () => {
    const tiny = { x: 0, y: 0, width: 400, height: 60 };
    expect(dockedBounds('right', PEEK, 500, tiny).y).toBe(0);
  });
});
