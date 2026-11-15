import { describe, it, expect } from 'vitest';
import { estimateBleCrowd, type BleSample } from '@/lib/bleCrowd';

const T0 = 1_000_000;
/** Deterministic pseudo-random noise in [-1, 1]. */
const noise = (seed: number) => Math.sin(seed * 12.9898) * 43758.5453 % 1;

/** One advertisement per second for each device over [from, to] seconds after T0. */
function emit(id: string, from: number, to: number, rssiAt: (s: number) => number): BleSample[] {
  const out: BleSample[] = [];
  for (let s = from; s <= to; s++) out.push({ id, t: T0 + s * 1000, rssi: rssiAt(s) });
  return out;
}

/** A bus that comes into range at `arrive`, closest at `arrive+10`, phones scattered on it. */
const bus = (n: number, arrive: number) =>
  Array.from({ length: n }, (_, k) => emit(`bus${k}`, arrive + (k % 3), arrive + 20,
    (s) => -60 - Math.abs(s - (arrive + 10)) * 2.5 - (k % 5) * 2 + noise(k * 100 + s) * 1.5)).flat();

/** A pedestrian arriving at their own moment, signal wandering independently. */
const walker = (k: number, arrive: number) =>
  emit(`walk${k}`, arrive, 60, (s) => -75 + noise(k * 977 + s) * 6);

const opts = { now: T0 + 60_000, rideStart: T0, movedLastMinuteM: 40 };

describe('estimateBleCrowd', () => {
  it('counts a passing bus full of phones as one group', () => {
    const r = estimateBleCrowd(bus(25, 38), opts);
    expect(r.devices).toBe(25);
    expect(r.groups).toBe(1);
  });

  it('counts people who arrive separately as separate groups', () => {
    const s = [walker(1, 32), walker(2, 39), walker(3, 46), walker(4, 51)].flat();
    expect(estimateBleCrowd(s, opts).groups).toBe(4);
  });

  it('a bus plus four pedestrians is five groups, not twenty-nine people', () => {
    const s = [...bus(25, 38), walker(1, 32), walker(2, 39), walker(3, 46), walker(4, 51)].flat();
    const r = estimateBleCrowd(s, opts);
    expect(r.devices).toBe(29);
    expect(r.groups).toBe(5);
  });

  it('excludes your own earbuds and watch', () => {
    const s = [...emit('earbuds', 0, 60, () => -42), ...emit('watch', 1, 60, () => -48), ...walker(1, 40)];
    const r = estimateBleCrowd(s, opts);
    expect(r.own).toBe(2);
    expect(r.groups).toBe(1);
  });

  it('a phone that stays with you while you ride is "with you", not a road user', () => {
    const s = [...emit('pillion', 2, 60, (x) => -65 + noise(x)), ...walker(1, 45)];
    const r = estimateBleCrowd(s, { ...opts, movedLastMinuteM: 600 });
    expect(r.travellingWithYou).toBe(1);
    expect(r.devices).toBe(1);
  });

  it('ignores devices too faint to be near, and ones that left', () => {
    const s = [...emit('far', 30, 60, () => -97), ...emit('gone', 0, 20, () => -60)];
    const r = estimateBleCrowd(s, opts);
    expect(r.devices).toBe(0);
  });
});
