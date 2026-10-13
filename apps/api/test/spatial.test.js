/**
 * Spatial prior. The fusion rule treats pi = 0.5 as neutral, so the prior must
 * be centred on where crashes happen or the spatial tier silently discounts
 * every rider's risk (the bug this definition replaced).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeSpatialPrior } = require('@rideguard/shared');
const { hotspots } = require('../data/hotspots.json');

const prior = makeSpatialPrior(hotspots);

test('no hotspot data gives the neutral prior', () => {
  assert.equal(makeSpatialPrior([])({ lat: 23.75, lon: 90.39 }), 0.5);
});

test('the prior is centred: about half the crashes sit at or above 0.5', () => {
  const total = hotspots.reduce((s, h) => s + h.count, 0);
  const above = hotspots.filter((h) => prior(h) >= 0.5).reduce((s, h) => s + h.count, 0);
  const share = above / total;
  assert.ok(share > 0.4 && share < 0.6, `share at or above 0.5 was ${share}`);
});

test('the densest hotspot is at the top of the scale', () => {
  const densest = [...hotspots].sort((a, b) => b.count - a.count)[0];
  assert.ok(prior(densest) > 0.95);
});

test('outside the crash data coverage the prior is neutral, not a discount', () => {
  assert.equal(prior({ lat: 22.3569, lon: 91.7832 }), 0.5); // Chattogram
});

test('the prior stays in [0,1]', () => {
  for (let i = 0; i < 50; i++) {
    const p = prior({ lat: 23.7 + i * 0.004, lon: 90.34 + i * 0.0025 });
    assert.ok(p >= 0 && p <= 1, `out of range: ${p}`);
  }
});
