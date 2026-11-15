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

test('route scoring refuses an over-long path instead of sampling it', async () => {
  const svc = new ScoringService({ score: () => ({ score: 0.2, probabilities: {}, factors: [], conformalSet: [], isPlaceholder: true }) }, { prior: () => 0.5 });
  await assert.rejects(
    () => svc.scoreRoute({}, [{ lat: -80, lon: -170 }, { lat: 80, lon: 170 }]),
    (e) => e.getStatus?.() === 400,
  );
  const ok = await svc.scoreRoute({}, [{ lat: 23.78, lon: 90.40 }, { lat: 23.80, lon: 90.41 }]);
  assert.ok(ok.segments.length > 10);
});

test('the mock scorer raises risk for measured dangers and names them', () => {
  const { MockScorer } = require('../dist/behaviour/mock.scorer');
  const m = new MockScorer();
  const base = { Bike_Speed: 35, Speed_Limit: 40, Talk_While_Riding: 'Never', Weather: 'Clear',
    Road_condition: 'Dry', Time_of_Day: 'Afternoon', Road_Type: 'City Road', Traffic_Density: 4 };
  const calm = m.score(base);
  const fast = m.score({ ...base, Bike_Speed: 80 });
  const phone = m.score({ ...base, Talk_While_Riding: 'Regularly' });
  assert.ok(fast.score > calm.score && phone.score > calm.score);
  assert.equal(fast.factors[0].id, 'overLimit');
  assert.equal(phone.factors[0].id, 'phone');
  assert.equal(calm.isPlaceholder, true);
});

test('severity passes through from the real model, never from a placeholder', async () => {
  const spatial = { prior: () => 0.5 };
  const sev = { ksi: 0.58, source: 'UK STATS19', validatedIn: ['GB'], modelVersion: 'sev-x' };
  const base = { score: 0.3, probabilities: {}, factors: [], conformalSet: [], severity: sev };
  const loc = { lat: 51.5, lon: -0.12 };
  const real = new ScoringService({ score: () => ({ ...base, isPlaceholder: false }) }, spatial);
  const mock = new ScoringService({ score: () => ({ ...base, isPlaceholder: true }) }, spatial);
  assert.deepEqual((await real.scorePoint({}, loc)).severity, sev);
  assert.equal((await mock.scorePoint({}, loc)).severity, null);
});

test('scorerVersion says which scorer produced the score, and mock is never mislabelled', async () => {
  const spatial = { prior: () => 0.5 };
  const base = { score: 0.4, probabilities: {}, factors: [], conformalSet: [] };
  const real = new ScoringService({ score: () => ({ ...base, isPlaceholder: false, modelVersion: 'tier1-x' }) }, spatial);
  const mock = new ScoringService({ score: () => ({ ...base, isPlaceholder: true, modelVersion: 'tier1-x' }) }, spatial);
  const loc = { lat: 23.75, lon: 90.39 };
  assert.equal((await real.scorePoint({}, loc)).scorerVersion, 'tier1-x');
  assert.equal((await mock.scorePoint({}, loc)).scorerVersion, 'mock');
  assert.equal((await mock.scoreRoute({}, [loc, loc])).scorerVersion, 'mock');
});
