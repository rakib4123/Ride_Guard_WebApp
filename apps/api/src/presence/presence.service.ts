import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  PRESENCE, countVehicles, haversineM, sameVehicle,
} from '@rideguard/shared';
import type { PresenceFix, PresenceResponse, PresenceUpdate } from '@rideguard/shared';

/** More concurrent riders than this and new sessions are refused (memory cap). */
const MAX_SESSIONS = 20_000;
/** A client posting faster than this gets its previous answer back. */
const MIN_INTERVAL_MS = 2_000;
/** Fixes worse than this are too vague to place a phone in a vehicle. */
const MAX_ACCURACY_M = 50;

interface Track {
  fixes: PresenceFix[];
  lastPost: number;
  lastAnswer: PresenceResponse | null;
}

const EMPTY: PresenceResponse = {
  radiusM: PRESENCE.radiusM, ridersNearby: 0, groupsNearby: 0, travellingWithYou: 0,
};

/**
 * Live "RideGuard riders around me", grouped into vehicles (see
 * packages/shared/src/presence.ts for the bus problem and how it is solved).
 *
 * Privacy: memory only, never written to disk or logged. Sessions are random
 * ids the client rotates, not account ids, and vanish PRESENCE.ttlMs after
 * their last post. Server time stamps the fixes, so client clocks do not matter.
 */
@Injectable()
export class PresenceService {
  private readonly tracks = new Map<string, Track>();
  private lastSweep = 0;

  update(u: PresenceUpdate, now = Date.now()): PresenceResponse {
    this.sweep(now);
    let track = this.tracks.get(u.sessionId);
    if (!track) {
      if (this.tracks.size >= MAX_SESSIONS) {
        throw new ServiceUnavailableException('Presence is at capacity; try again shortly.');
      }
      track = { fixes: [], lastPost: 0, lastAnswer: null };
      this.tracks.set(u.sessionId, track);
    }
    if (now - track.lastPost < MIN_INTERVAL_MS && track.lastAnswer) return track.lastAnswer;
    track.lastPost = now;

    if (u.accuracyM <= MAX_ACCURACY_M) {
      track.fixes.push({ t: now, lat: u.lat, lon: u.lon, speedKmh: u.speedKmh, headingDeg: u.headingDeg });
      if (track.fixes.length > PRESENCE.historyFixes) track.fixes.shift();
    }
    track.lastAnswer = track.fixes.length ? this.around(u.sessionId, track, now) : EMPTY;
    return track.lastAnswer;
  }

  /** Number of live sessions (for tests and health). */
  size(): number {
    return this.tracks.size;
  }

  private around(id: string, me: Track, now: number): PresenceResponse {
    const here = me.fixes[me.fixes.length - 1];
    const others: PresenceFix[][] = [];
    let withYou = 0;
    for (const [k, t] of this.tracks) {
      if (k === id) continue;
      const last = t.fixes[t.fixes.length - 1];
      if (!last || now - last.t > PRESENCE.ttlMs) continue;
      if (haversineM(here, last) > PRESENCE.radiusM) continue;
      if (sameVehicle(me.fixes, t.fixes)) withYou++;
      else others.push(t.fixes);
    }
    return {
      radiusM: PRESENCE.radiusM,
      ridersNearby: others.length,
      groupsNearby: countVehicles(others),
      travellingWithYou: withYou,
    };
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 5_000) return;
    this.lastSweep = now;
    for (const [k, t] of this.tracks) {
      const last = t.fixes[t.fixes.length - 1]?.t ?? t.lastPost;
      if (now - last > PRESENCE.ttlMs) this.tracks.delete(k);
    }
  }
}
