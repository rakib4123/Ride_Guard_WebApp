/**
 * Live traffic. Google is called only with a key, never twice for the same
 * request at once, and any failure degrades to "unavailable" instead of
 * breaking route planning. Google is stubbed: these tests make no real calls.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TrafficService, decodePolyline, trafficDensityFromDelay,
} = require('../dist/traffic/traffic.service');

const A = { lat: 23.8759, lon: 90.3795 };
const B = { lat: 23.733, lon: 90.4172 };

/** Build a service with a key, with global fetch replaced by `impl`. */
function withGoogle(impl) {
  process.env.GOOGLE_MAPS_SERVER_KEY = 'test-key';
  const svc = new TrafficService();
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, init }); return impl(); };
  return { svc, calls, restore: () => { global.fetch = realFetch; } };
}

const okResponse = () => ({
  ok: true,
  json: async () => ({
    routes: [{
      duration: '2400s', staticDuration: '1200s', distanceMeters: 16500,
      polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    }],
  }),
});

test('decodePolyline matches Google\'s documented example', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { lat: 38.5, lon: -120.2 },
    { lat: 40.7, lon: -120.95 },
    { lat: 43.252, lon: -126.453 },
  ]);
});

test('traffic density: free flow is 1, double the time or worse is 8', () => {
  assert.equal(trafficDensityFromDelay(600, 600), 1);
  assert.equal(trafficDensityFromDelay(900, 600), 5); // 1.5x
  assert.equal(trafficDensityFromDelay(1200, 600), 8);
  assert.equal(trafficDensityFromDelay(5000, 600), 8);
  assert.equal(trafficDensityFromDelay(500, 600), 1); // faster than free flow
  assert.equal(trafficDensityFromDelay(600, 0), 1);
});

test('without a key it never calls Google', async () => {
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  const realFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const r = await new TrafficService().route(A, B);
    assert.deepEqual(r, { available: false, reason: 'not-configured' });
    assert.equal(called, false);
  } finally { global.fetch = realFetch; }
});

test('with a key it asks for a two-wheeler traffic route with a field mask', async () => {
  const { svc, calls, restore } = withGoogle(okResponse);
  try {
    const r = await svc.route(A, B);
    assert.equal(calls.length, 1);
    const { init } = calls[0];
    assert.equal(init.headers['X-Goog-Api-Key'], 'test-key');
    assert.match(init.headers['X-Goog-FieldMask'], /routes\.duration/);
    const body = JSON.parse(init.body);
    assert.equal(body.travelMode, 'TWO_WHEELER');
    assert.equal(body.routingPreference, 'TRAFFIC_AWARE');

    assert.equal(r.available, true);
    assert.equal(r.durationMin, 40);
    assert.equal(r.freeFlowMin, 20);
    assert.equal(r.trafficDensity, 8);
    assert.equal(r.distanceKm, 16.5);
    assert.equal(r.path.length, 3);
  } finally { restore(); }
});

test('identical requests at the same time share one Google call', async () => {
  const { svc, calls, restore } = withGoogle(okResponse);
  try {
    const [r1, r2] = await Promise.all([svc.route(A, B), svc.route(A, B)]);
    assert.equal(calls.length, 1);
    assert.deepEqual(r1, r2);
    await svc.route(A, B); // finished requests are not reused (no caching)
    assert.equal(calls.length, 2);
  } finally { restore(); }
});

test('a Google failure degrades to unavailable instead of throwing', async () => {
  for (const impl of [
    () => ({ ok: false, status: 403, text: async () => 'API key not valid' }),
    () => ({ ok: true, json: async () => ({ routes: [] }) }),
    () => { throw new Error('network down'); },
  ]) {
    const { svc, restore } = withGoogle(impl);
    try {
      assert.deepEqual(await svc.route(A, B), { available: false, reason: 'google-error' });
    } finally { restore(); }
  }
});
