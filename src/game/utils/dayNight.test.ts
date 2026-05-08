import { describe, expect, it } from 'vitest';
import { computeDayNightTint } from './dayNight';

describe('computeDayNightTint', () => {
  it('returns transparent (alpha 0) at mid-day', () => {
    const result = computeDayNightTint(0.45);
    expect(result.alpha).toBe(0);
  });

  it('returns higher alpha at night than at noon', () => {
    const noon = computeDayNightTint(0.5);
    const night = computeDayNightTint(0.95);
    expect(night.alpha).toBeGreaterThan(noon.alpha);
  });

  it('wraps cyclically', () => {
    const a = computeDayNightTint(0.25);
    const b = computeDayNightTint(1.25);
    expect(a.alpha).toBeCloseTo(b.alpha, 5);
    expect(a.color).toBe(b.color);
  });

  it('handles negative input by wrapping', () => {
    const result = computeDayNightTint(-0.1);
    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThanOrEqual(1);
  });

  it('produces a valid 24-bit color', () => {
    const result = computeDayNightTint(0.78);
    expect(result.color).toBeGreaterThanOrEqual(0);
    expect(result.color).toBeLessThanOrEqual(0xffffff);
  });
});
