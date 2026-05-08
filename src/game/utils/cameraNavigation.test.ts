import { describe, expect, it } from 'vitest';
import {
  blendVelocity,
  decayVelocity,
  hasExceededDragThreshold,
  toWorldDelta,
} from './cameraNavigation';

describe('cameraNavigation', () => {
  it('requires threshold distance before drag starts', () => {
    expect(hasExceededDragThreshold(0, 0, 4, 4, 8)).toBe(false);
    expect(hasExceededDragThreshold(0, 0, 8, 0, 8)).toBe(true);
    expect(hasExceededDragThreshold(10, 10, 16, 16, 8)).toBe(true);
  });

  it('converts pixel delta to world delta using zoom', () => {
    expect(toWorldDelta(20, 2)).toBe(10);
    expect(toWorldDelta(-12, 3)).toBe(-4);
    expect(toWorldDelta(5, 0)).toBe(0);
  });

  it('blends velocity and clamps to max', () => {
    const blended = blendVelocity(0.2, 8, 16, { smoothing: 0.5, maxAbs: 2 });
    expect(blended).toBeCloseTo(0.35, 5);

    const clampedHigh = blendVelocity(0, 200, 16, { smoothing: 1, maxAbs: 2 });
    const clampedLow = blendVelocity(0, -200, 16, { smoothing: 1, maxAbs: 2 });
    expect(clampedHigh).toBe(2);
    expect(clampedLow).toBe(-2);
  });

  it('decays velocity by friction and zeroes very small values', () => {
    const decayed = decayVelocity(1, 16, { frictionPerMs: 0.004, minAbs: 0.001 });
    expect(decayed).toBeCloseTo(0.936, 5);

    const nearZero = decayVelocity(0.004, 16, { frictionPerMs: 0.004, minAbs: 0.01 });
    expect(nearZero).toBe(0);
  });
});
