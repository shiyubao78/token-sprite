import { describe, it, expect } from 'vitest';
import { bootWaitMs, MIN_BOOT_MS } from './bootDelay.js';

describe('bootWaitMs', () => {
  it('刚开窗时要补满最小展示时间', () => {
    expect(bootWaitMs(1000, 1000)).toBe(MIN_BOOT_MS);
  });

  it('已经显示了一部分，只补剩下的', () => {
    expect(bootWaitMs(1000, 1000 + 200)).toBe(MIN_BOOT_MS - 200);
  });

  it('已经够久了就不再等', () => {
    expect(bootWaitMs(1000, 1000 + MIN_BOOT_MS)).toBe(0);
    expect(bootWaitMs(1000, 1000 + 99999)).toBe(0);
  });

  it('时钟回拨或缺失时间戳时不等待', () => {
    expect(bootWaitMs(1000, 900)).toBe(0);
    expect(bootWaitMs(undefined, 1000)).toBe(0);
    expect(bootWaitMs(NaN, 1000)).toBe(0);
  });

  it('等待时间永远不超过上限', () => {
    expect(bootWaitMs(1000, 1000, 300)).toBe(300);
  });
});
