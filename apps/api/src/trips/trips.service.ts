import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import {
  MODEL_VERSION,
  TRIP_SCHEMA_VERSION,
} from '@rideguard/shared';
import type { CreateTripInput, TripLog } from '@rideguard/shared';
import { TRIPS_REPOSITORY, TripsRepository } from './trips.repository';

/** Coordinate stand-in stored when the rider declined raw-GPS retention. */
const REDACTED_POINT = { lat: 0, lon: 0 };

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @Inject(TRIPS_REPOSITORY) private readonly repo: TripsRepository,
  ) {
    if (!process.env.RIDER_ID_SALT) {
      // Mirror AdminGuard: fail closed in production rather than silently
      // pseudonymising rider ids with a default key that is public in this
      // repository — the exact reversible-hash problem this code exists to
      // fix. Non-production runs (and the test suite) keep the dev default.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'RIDER_ID_SALT must be set in production. Refusing to start with ' +
            'a default pseudonymisation key that is public in this repository.',
        );
      }
      this.logger.warn(
        'RIDER_ID_SALT is not set — rider ids are hashed with a default key, ' +
          'which is reversible for low-entropy ids such as email addresses. ' +
          'Set RIDER_ID_SALT to a long random secret in production.',
      );
    }
  }

  /**
   * Persist a trip log (Section 10). Requires logging consent. Hashes the
   * rider id, stamps schema/model versions and a uuid, and — when the rider
   * has not consented to raw GPS retention — strips every coordinate in the
   * record, including the trip's own origin and destination (a rider's start
   * and end points identify home and work more precisely than the trace does).
   */
  async create(input: CreateTripInput): Promise<TripLog> {
    if (!input.consent?.logging) {
      throw new BadRequestException(
        'Trip not stored: logging consent was not given.',
      );
    }

    const keepGps = Boolean(input.consent.raw_gps);

    const prediction = keepGps
      ? input.prediction
      : {
          ...input.prediction,
          // Drop per-point coordinates of the GPS trace; keep the risk values.
          segments: input.prediction.segments.map((s) => ({
            ...s,
            ...REDACTED_POINT,
          })),
        };

    const trip: TripLog['trip'] = keepGps
      ? input.trip
      : { ...input.trip, origin: { ...REDACTED_POINT }, destination: { ...REDACTED_POINT } };

    const outcome = keepGps
      ? input.outcome
      : {
          ...input.outcome,
          incident: { ...input.outcome.incident, lat: null, lon: null },
          auto_events: input.outcome.auto_events.map((e) => ({ ...e, ...REDACTED_POINT })),
        };

    const log: TripLog = {
      schema_version: TRIP_SCHEMA_VERSION,
      trip_id: randomUUID(),
      rider_id: this.hashRiderId(input.rider_id),
      app_version: input.app_version,
      model_version: MODEL_VERSION,
      consent: input.consent,
      trip,
      context: input.context,
      prediction,
      outcome,
      response: input.response,
    };

    return this.repo.save(log);
  }

  findAll(): Promise<TripLog[]> {
    return this.repo.findAll();
  }

  findById(id: string): Promise<TripLog | null> {
    return this.repo.findById(id);
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  /**
   * Pseudonymise the rider id. Keyed HMAC rather than a bare digest: rider ids
   * are emails/uuids drawn from a small, guessable space, so an unsalted hash
   * is reversible by anyone who can enumerate candidates.
   */
  private hashRiderId(raw: string): string {
    const salt = process.env.RIDER_ID_SALT ?? 'rideguard-dev-salt';
    return createHmac('sha256', salt).update(raw).digest('hex').slice(0, 32);
  }
}
