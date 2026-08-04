import { describe, it, expect } from 'vitest';
import { incubation } from './incubation.js';

const B = 1_000_000_000;

describe('incubation', () => {
  it('喂够门槛即破壳', () => {
    const r = incubation(1.5 * B, 0.5 * B, 'common'); // fed 1B, need 0.5B
    expect(r.done).toBe(true);
    expect(r.fraction).toBe(1);
  });
  it('中途进度按比例', () => {
    const r = incubation(0.75 * B, 0.5 * B, 'common'); // fed 0.25B / 0.5B
    expect(r.fraction).toBeCloseTo(0.5, 5);
    expect(r.done).toBe(false);
  });
  it('传说门槛更高、更难孵', () => {
    const r = incubation(5 * B, 0, 'legendary'); // fed 5B / 30B
    expect(r.done).toBe(false);
    expect(r.fraction).toBeLessThan(0.2);
  });
});
