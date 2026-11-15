import { describe, it, expect } from 'vitest';
import { easeOutCubic, lerpLatLon, nearestAngle, settleSheet } from '@/lib/motion';

describe('motion helpers', () => {
  it('eases from 0 to 1 and clamps outside', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // ease-out: past halfway at half time
  });

  it('interpolates positions', () => {
    expect(lerpLatLon({ lat: 0, lon: 0 }, { lat: 2, lon: 4 }, 0.5)).toEqual({ lat: 1, lon: 2 });
  });

  it('turns the heading cone the short way round', () => {
    expect(nearestAngle(350, 10)).toBe(370);
    expect(nearestAngle(10, 350)).toBe(-10);
    expect(nearestAngle(90, 180)).toBe(180);
    expect(nearestAngle(720, 0)).toBe(720);
  });

  it('settles a sheet by flick first, then by position', () => {
    expect(settleSheet(0.2, 2)).toBe(true);
    expect(settleSheet(0.9, -2)).toBe(false);
    expect(settleSheet(0.6, 0)).toBe(true);
    expect(settleSheet(0.4, 0)).toBe(false);
  });
});
