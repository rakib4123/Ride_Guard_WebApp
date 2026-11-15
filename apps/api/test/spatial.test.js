/**
 * Location prior from the regional crash grids. Each region is scored with its
 * own crashes; it may raise a reading at known crash places but never lower
 * one, and anywhere outside the regions it is neutral (0.5).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeSpatialPrior, cellIndex, regionAt } = require('@rideguard/shared');
const data = require('../data/hotspots.json');

const prior = makeSpatialPrior(data.regions);
const byId = Object.fromEntries(data.regions.map((r) => [r.id, r]));

test('the data carries Dhaka, Great Britain and New York City', () => {
  assert.deepEqual(Object.keys(byId).sort(), ['dhaka', 'gb', 'nyc']);
});

test('no grid gives the neutral prior', () => {
  assert.equal(makeSpatialPrior(null)({ lat: 23.75, lon: 90.39 }), 0.5);
  assert.equal(makeSpatialPrior([])({ lat: 23.75, lon: 90.39 }), 0.5);
});

test('each region\'s busiest cell sits at the top of the scale', () => {
  for (const r of data.regions) {
    const c = r.cells[0];
    // A point inside that cell: undo cellIndex.
    const lat = ((c.i + 0.5) * r.gridM) / 111_320;
    const lon = ((c.j + 0.5) * r.gridM) / (111_320 * Math.cos((r.lat0 * Math.PI) / 180));
    assert.deepEqual(cellIndex({ lat, lon }, r.gridM, r.lat0), [c.i, c.j]);
    assert.equal(regionAt(data.regions, { lat, lon }).id, r.id);
    assert.ok(prior({ lat, lon }) > 0.95, `${r.id} busiest cell scored ${prior({ lat, lon })}`);
  }
});

test('the prior never drops below neutral, and stays in [0.5, 1]', () => {
  for (const r of data.regions) {
    const b = r.bbox;
    for (let k = 0; k < 200; k++) {
      const p = prior({
        lat: b.minLat + ((k % 20) / 19) * (b.maxLat - b.minLat),
        lon: b.minLon + (Math.floor(k / 20) / 9) * (b.maxLon - b.minLon),
      });
      assert.ok(p >= 0.5 && p <= 1, `${r.id} out of range: ${p}`);
    }
  }
});

test('outside every region the prior is neutral', () => {
  assert.equal(prior({ lat: 22.3569, lon: 91.7832 }), 0.5);   // Chattogram
  assert.equal(prior({ lat: 48.8566, lon: 2.3522 }), 0.5);    // Paris
});

test('every region carries its check on later years and a data credit', () => {
  for (const r of data.regions) {
    assert.ok(r.validation.lift_vs_random_area > 1, `${r.id} is no better than a random map`);
    assert.ok(r.credit && r.credit.length > 10);
  }
});
