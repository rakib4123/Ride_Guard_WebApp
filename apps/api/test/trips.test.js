/**
 * Trip consent + pseudonymisation. These guard rider privacy, so they are the
 * first thing to break loudly if the stripping logic is ever changed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { TripsService } = require('../dist/trips/trips.service');

/** In-memory repository standing in for the file store. */
function fakeRepo() {
  const rows = [];
  return {
    rows,
    save: async (t) => (rows.push(t), t),
    findAll: async () => rows,
    findById: async (id) => rows.find((t) => t.trip_id === id) ?? null,
    count: async () => rows.length,
  };
}

const ORIGIN = { lat: 23.8759, lon: 90.3795 };
const DEST = { lat: 23.733, lon: 90.4172 };

function input(consent) {
  return {
    rider_id: 'alice@example.com',
    app_version: '1.0.0',
    consent,
    trip: { start_time: 'a', end_time: 'b', origin: { ...ORIGIN }, destination: { ...DEST }, distance_km: 12.4 },
    context: { time_of_day: 'Morning', day_of_week: 'Thursday', weather: {}, rider: {} },
    prediction: {
      behaviour_score: 0.15, spatial_prior: 1, fused_risk_R: 0.195, advisory_level: 'Low',
      conformal_set: [], top_factors: [],
      segments: [{ seg_id: 0, lat: 23.87, lon: 90.37, R: 0.19, level: 'Low', warning_issued: false, warning_time: null }],
    },
    outcome: {
      incident: { occurred: true, type: 'near_miss', severity_self_report: '', time: null, lat: 23.8, lon: 90.4, nearest_seg_id: 0 },
      auto_events: [{ type: 'hard_brake', time: 't', decel_g: 0.5, lat: 23.8, lon: 90.4 }],
      rider_felt_risky_rating: null,
    },
    response: {},
  };
}

test('a trip without logging consent is rejected', async () => {
  const svc = new TripsService(fakeRepo());
  await assert.rejects(() => svc.create(input({ logging: false, raw_gps: false })), /consent/i);
});

test('declining raw GPS strips EVERY coordinate, not just the trace', async () => {
  const svc = new TripsService(fakeRepo());
  const t = await svc.create(input({ logging: true, raw_gps: false }));

  assert.deepEqual(t.prediction.segments[0].lat, 0);
  assert.deepEqual(t.prediction.segments[0].lon, 0);
  // Origin and destination identify home and work more precisely than the
  // trace does, so they must go too.
  assert.deepEqual(t.trip.origin, { lat: 0, lon: 0 });
  assert.deepEqual(t.trip.destination, { lat: 0, lon: 0 });
  assert.equal(t.outcome.incident.lat, null);
  assert.equal(t.outcome.incident.lon, null);
  assert.equal(t.outcome.auto_events[0].lat, 0);

  // Non-spatial value is preserved.
  assert.equal(t.prediction.segments[0].R, 0.19);
  assert.equal(t.trip.distance_km, 12.4);
  assert.equal(t.outcome.incident.type, 'near_miss');
});

test('consenting to raw GPS keeps the coordinates', async () => {
  const svc = new TripsService(fakeRepo());
  const t = await svc.create(input({ logging: true, raw_gps: true }));
  assert.deepEqual(t.trip.origin, ORIGIN);
  assert.deepEqual(t.trip.destination, DEST);
  assert.equal(t.prediction.segments[0].lat, 23.87);
});

test('stripping does not mutate the caller-supplied input', async () => {
  const svc = new TripsService(fakeRepo());
  const i = input({ logging: true, raw_gps: false });
  await svc.create(i);
  assert.deepEqual(i.trip.origin, ORIGIN, 'caller object was mutated');
  assert.equal(i.prediction.segments[0].lat, 23.87);
});

test('the rider id is never stored in the clear, and is stable', async () => {
  process.env.RIDER_ID_SALT = 'test-salt';
  const svc = new TripsService(fakeRepo());
  const a = await svc.create(input({ logging: true, raw_gps: true }));
  const b = await svc.create(input({ logging: true, raw_gss: true, raw_gps: true }));
  assert.notEqual(a.rider_id, 'alice@example.com');
  assert.match(a.rider_id, /^[0-9a-f]{32}$/);
  assert.equal(a.rider_id, b.rider_id, 'same rider must map to the same id');
});

test('the rider id is keyed by the salt, not a bare digest', async () => {
  process.env.RIDER_ID_SALT = 'salt-one';
  const one = (await new TripsService(fakeRepo()).create(input({ logging: true, raw_gps: true }))).rider_id;
  process.env.RIDER_ID_SALT = 'salt-two';
  const two = (await new TripsService(fakeRepo()).create(input({ logging: true, raw_gps: true }))).rider_id;
  assert.notEqual(one, two, 'changing the salt must change the id');

  // A plain sha256 of the email must not reproduce it.
  const bare = require('node:crypto').createHash('sha256').update('alice@example.com').digest('hex').slice(0, 32);
  assert.notEqual(two, bare);
});

test('refuses to start in production without RIDER_ID_SALT', () => {
  const prevSalt = process.env.RIDER_ID_SALT;
  const prevEnv = process.env.NODE_ENV;
  delete process.env.RIDER_ID_SALT;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => new TripsService(fakeRepo()), /RIDER_ID_SALT/);
  } finally {
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
    if (prevSalt === undefined) delete process.env.RIDER_ID_SALT; else process.env.RIDER_ID_SALT = prevSalt;
  }
});

test('warns but does not throw outside production without RIDER_ID_SALT', () => {
  const prevSalt = process.env.RIDER_ID_SALT;
  const prevEnv = process.env.NODE_ENV;
  delete process.env.RIDER_ID_SALT;
  process.env.NODE_ENV = 'development';
  try {
    assert.doesNotThrow(() => new TripsService(fakeRepo()));
  } finally {
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
    if (prevSalt === undefined) delete process.env.RIDER_ID_SALT; else process.env.RIDER_ID_SALT = prevSalt;
  }
});

test('server-assigned fields are stamped, and each trip gets a unique id', async () => {
  const svc = new TripsService(fakeRepo());
  const a = await svc.create(input({ logging: true, raw_gps: true }));
  const b = await svc.create(input({ logging: true, raw_gps: true }));
  assert.equal(a.schema_version, '1.0');
  assert.equal(a.model_version, 'rideguard-2026-06');
  assert.notEqual(a.trip_id, b.trip_id);
});
