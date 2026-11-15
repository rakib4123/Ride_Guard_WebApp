/**
 * D2D presence: phones are grouped into vehicles, so a full bus counts once.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const { PresenceService } = require('../dist/presence/presence.service');
const { sameVehicle, countVehicles, trafficWithCrowd } = require('@rideguard/shared');

const LAT = 23.7806, LON = 90.407;
/** Point `m` metres north-east-ish of the origin. */
const at = (northM, eastM = 0) => ({
  lat: LAT + northM / 111_320,
  lon: LON + eastM / (111_320 * Math.cos((LAT * Math.PI) / 180)),
});

/** A phone moving north at `kmh`, `offsetM` ahead and `sideM` to the side, fixes every 5 s. */
function track(kmh, offsetM, sideM = 0, heading = 0, n = 4, t0 = 0, phase = 0) {
  return Array.from({ length: n }, (_, k) => {
    const t = t0 + k * 5000 + phase;
    const d = offsetM + (kmh / 3.6) * (t / 1000);
    return { t, ...at(d, sideM), speedKmh: kmh, headingDeg: heading };
  });
}

test('phones on one moving bus are one vehicle, even posting at different moments', () => {
  const a = track(40, 0, 0, 0, 4, 0, 0);
  const b = track(40, 9, 1.5, 0, 4, 0, 2300);   // 9 m further back on the bus, 2.3 s out of phase
  assert.equal(sameVehicle(a, b), true);
});

test('a rider overtaking a bus is not on the bus', () => {
  const bus = track(30, 0);
  const rider = track(55, -20, 3);               // starts behind, passes within metres
  assert.equal(sameVehicle(bus, rider), false);
});

test('opposite directions never group, however close', () => {
  const north = track(30, 0, 0, 0);
  const south = track(30, 0, 2, 180).map((f, k) => ({ ...f, ...at(-((30 / 3.6) * 5 * k), 2) }));
  assert.equal(sameVehicle(north, south), false);
});

test('one shared fix is not enough to call it the same vehicle', () => {
  assert.equal(sameVehicle(track(30, 0, 0, 0, 1), track(30, 2, 0, 0, 1)), false);
});

test('the bus problem: 30 phones on a bus + a passing rider + a pedestrian = 3 groups', () => {
  const bus = Array.from({ length: 30 }, (_, k) => track(35, (k % 10) * 1.2, (k % 3) * 0.8, 0, 4, 0, (k * 700) % 5000));
  const rider = track(60, -25, 4);
  const pedestrian = Array.from({ length: 4 }, (_, k) => ({ t: k * 5000, ...at(5, 6), speedKmh: 0, headingDeg: null }));
  assert.equal(countVehicles([...bus, rider, pedestrian]), 3);
});

test('service: riders around you are counted as vehicles, and your own co-travellers apart', () => {
  const svc = new PresenceService();
  const me = randomUUID();
  const busIds = Array.from({ length: 12 }, () => randomUUID());
  const pillion = randomUUID();
  let answer;
  for (let k = 0; k < 4; k++) {
    const now = 1_000_000 + k * 5000;
    const d = (40 / 3.6) * 5 * k;
    busIds.forEach((id, i) => svc.update(
      { sessionId: id, ...at(d + 12 + i * 0.8, 3), speedKmh: 40, headingDeg: 0, accuracyM: 8 }, now + 100 + i * 10));
    svc.update({ sessionId: pillion, ...at(d + 0.5, 0), speedKmh: 40, headingDeg: 0, accuracyM: 8 }, now + 50);
    answer = svc.update({ sessionId: me, ...at(d, 0), speedKmh: 40, headingDeg: 0, accuracyM: 8 }, now + 400);
  }
  assert.equal(answer.travellingWithYou, 1, 'the pillion phone moves with me');
  assert.equal(answer.ridersNearby, 12, 'twelve phones on the bus');
  assert.equal(answer.groupsNearby, 1, 'but one bus');
});

test('service: stale sessions vanish, vague fixes are ignored, fast posting is throttled', () => {
  const svc = new PresenceService();
  const me = randomUUID(), other = randomUUID();
  svc.update({ sessionId: other, ...at(5), speedKmh: 0, headingDeg: null, accuracyM: 5 }, 0);
  const vague = svc.update({ sessionId: me, ...at(0), speedKmh: 0, headingDeg: null, accuracyM: 400 }, 1000);
  assert.equal(vague.ridersNearby, 0, 'a 400 m fix cannot place me');
  const later = svc.update({ sessionId: me, ...at(0), speedKmh: 0, headingDeg: null, accuracyM: 5 }, 60_000);
  assert.equal(later.ridersNearby, 0, 'the other rider stopped posting long ago');

  const a = svc.update({ sessionId: me, ...at(0), speedKmh: 0, headingDeg: null, accuracyM: 5 }, 60_500);
  assert.equal(a, later, 'a post inside 2 s returns the previous answer');
});

test('crowd can only raise the traffic estimate', () => {
  assert.equal(trafficWithCrowd(5, null), 5);
  assert.equal(trafficWithCrowd(5, 0), 5);
  assert.equal(trafficWithCrowd(2, 4), 5);
  assert.equal(trafficWithCrowd(2, 40), 8);
});
