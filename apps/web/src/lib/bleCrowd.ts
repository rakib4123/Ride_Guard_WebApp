/**
 * Count the people around a rider from Bluetooth advertisements, without
 * counting one bus as thirty people.
 *
 * Each nearby phone/watch that advertises shows up as a device id with a
 * signal strength (RSSI). Raw counting fails three ways, and each is handled:
 *
 *  1. The bus problem. Devices on one vehicle arrive in range together and
 *     their signals rise and fall together as it passes. Devices first seen
 *     within CO_ARRIVAL_MS of each other whose RSSI traces correlate are joined
 *     into one group (union-find, so a long bus chains together).
 *  2. Travelling with you. Devices that stay in range while you have moved a
 *     good distance are on your vehicle or riding alongside (a pillion). They
 *     are merged into one "with you" group and not counted as road users.
 *  3. Your own devices. Earbuds/watch: very strong from the start of the ride
 *     and always present. Excluded.
 *
 * Limits (said plainly): many phones do not advertise at all, ids rotate with
 * MAC randomisation, and RSSI-to-distance is rough (+/- several metres). The
 * result is a lower bound on the people around you, not a census.
 */

export interface BleSample {
  id: string;
  /** ms since epoch. */
  t: number;
  rssi: number;
}

export interface BleCrowd {
  /** Devices within range now (excluding yours and those travelling with you). */
  devices: number;
  /** Those devices grouped: one bus = one group. */
  groups: number;
  /** Devices moving with you. */
  travellingWithYou: number;
  /** Devices recognised as your own (earbuds, watch). */
  own: number;
}

export interface BleOptions {
  now: number;
  /** When the ride (and the scan) started. */
  rideStart: number;
  /** How far the rider moved in the last LONG_MS. */
  movedLastMinuteM: number;
}

const WINDOW_MS = 30_000;          // "around you now"
const LONG_MS = 60_000;            // history kept for the with-you / own tests
/** Weakest signal counted as nearby: roughly 15-20 m for a typical phone. Rough. */
const MIN_RSSI = -85;
const OWN_RSSI = -55;
const OWN_FIRST_MS = 15_000;
const OWN_PRESENCE = 0.6;
const WITH_YOU_PRESENCE = 0.5;
const WITH_YOU_MOVED_M = 150;
const CO_ARRIVAL_MS = 3_000;
const INITIAL_MS = 5_000;          // devices already in range when scanning began
const MIN_SHARED_SECONDS = 6;
const MIN_CORR = 0.7;

interface Dev {
  first: number;
  last: number;
  /** second -> strongest RSSI heard in that second */
  bySecond: Map<number, number>;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : -Infinity;
};

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Seconds (within the window) where both devices were heard, and their RSSI then. */
function shared(a: Dev, b: Dev, from: number): [number[], number[]] {
  const xa: number[] = [], xb: number[] = [];
  for (const [sec, r] of a.bySecond) {
    if (sec * 1000 < from) continue;
    const rb = b.bySecond.get(sec);
    if (rb !== undefined) { xa.push(r); xb.push(rb); }
  }
  return [xa, xb];
}

function sameGroup(a: Dev, b: Dev, rideStart: number, from: number): boolean {
  const bothInitial = a.first - rideStart <= INITIAL_MS && b.first - rideStart <= INITIAL_MS;
  if (!bothInitial && Math.abs(a.first - b.first) > CO_ARRIVAL_MS) return false;
  const [xa, xb] = shared(a, b, from);
  return xa.length >= MIN_SHARED_SECONDS && pearson(xa, xb) >= MIN_CORR;
}

export function estimateBleCrowd(samples: BleSample[], o: BleOptions): BleCrowd {
  const devs = new Map<string, Dev>();
  for (const s of samples) {
    if (s.t < o.now - LONG_MS || s.t > o.now) continue;
    let d = devs.get(s.id);
    if (!d) { d = { first: s.t, last: s.t, bySecond: new Map() }; devs.set(s.id, d); }
    d.first = Math.min(d.first, s.t);
    d.last = Math.max(d.last, s.t);
    const sec = Math.floor(s.t / 1000);
    d.bySecond.set(sec, Math.max(d.bySecond.get(sec) ?? -Infinity, s.rssi));
  }

  const longFrom = o.now - LONG_MS;
  const winFrom = o.now - WINDOW_MS;
  const presence = (d: Dev, from: number) => {
    const span = Math.max(1, Math.round((o.now - Math.max(from, d.first)) / 1000));
    let n = 0;
    for (const sec of d.bySecond.keys()) if (sec * 1000 >= from) n++;
    return n / span;
  };

  let own = 0, withYou = 0;
  const road: Dev[] = [];
  for (const d of devs.values()) {
    if (d.last < winFrom) continue;
    const rssiNow = median([...d.bySecond].filter(([sec]) => sec * 1000 >= winFrom).map(([, r]) => r));
    if (d.first - o.rideStart <= OWN_FIRST_MS && rssiNow >= OWN_RSSI && presence(d, d.first) >= OWN_PRESENCE) {
      own++;
      continue;
    }
    if (rssiNow < MIN_RSSI) continue;
    if (o.movedLastMinuteM >= WITH_YOU_MOVED_M && o.now - d.first >= LONG_MS * 0.9 &&
        presence(d, longFrom) >= WITH_YOU_PRESENCE) {
      withYou++;
      continue;
    }
    road.push(d);
  }

  const parent = road.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < road.length; i++) {
    for (let j = i + 1; j < road.length; j++) {
      if (find(i) !== find(j) && sameGroup(road[i], road[j], o.rideStart, winFrom)) parent[find(i)] = find(j);
    }
  }
  const groups = new Set(road.map((_, i) => find(i))).size;
  return { devices: road.length, groups, travellingWithYou: withYou, own };
}
