/**
 * Scoring maths. Runs against the compiled dist/ via node --test, so there is
 * no test-framework dependency to install.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { ScoringService, samplePolyline, percentile } = require('../dist/scoring/scoring.service');
const { haversineMeters } = require('../dist/spatial/spatial.service');

test('fuse: a neutral prior leaves the behavioural score untouched', () => {
  assert.equal(ScoringService.fuse(0.5, 0.5), 0.5);
});

test('fuse: the prior moves risk by +/-30% at the extremes', () => {
  assert.ok(Math.abs(ScoringService.fuse(0.5, 1.0) - 0.65) < 1e-9);
  assert.ok(Math.abs(ScoringService.fuse(0.5, 0.0) - 0.35) < 1e-9);
});

test('fuse: output stays clipped to [0,1]', () => {
  assert.equal(ScoringService.fuse(1, 1), 1);
  assert.equal(ScoringService.fuse(0, 0), 0);
});

test('fuse is multiplicative: a zero behaviour score cannot be raised by location', () => {
  assert.equal(ScoringService.fuse(0, 1), 0);
});

test('advisory: bands sit on the documented thresholds', () => {
  assert.equal(ScoringService.advisory(0.32), 'Low');
  assert.equal(ScoringService.advisory(0.33), 'Medium');
  assert.equal(ScoringService.advisory(0.59), 'Medium');
  assert.equal(ScoringService.advisory(0.6), 'High');
});

test('samplePolyline: keeps the origin and spaces samples about 75m apart', () => {
  const a = { lat: 23.78, lon: 90.40 };
  const b = { lat: 23.79, lon: 90.40 }; // ~1.1 km
  const pts = samplePolyline([a, b], 75);
  assert.deepEqual(pts[0], a);
  assert.ok(pts.length > 10, `expected many samples, got ${pts.length}`);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(haversineMeters(pts[i - 1], pts[i]) <= 80);
  }
});

test('samplePolyline: a degenerate path does not divide by zero', () => {
  const p = { lat: 23.78, lon: 90.4 };
  assert.deepEqual(samplePolyline([p, p], 75), [p, p]);
});

test('percentile: nearest-rank, and empty input is 0 not NaN', () => {
  assert.equal(percentile([], 0.9), 0);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
  assert.equal(percentile([5], 0.9), 5);
});
