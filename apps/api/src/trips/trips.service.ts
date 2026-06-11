import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  MODEL_VERSION,
  TRIP_SCHEMA_VERSION,
} from '@rideguard/shared';
import type { CreateTripInput, TripLog } from '@rideguard/shared';
import { TRIPS_REPOSITORY, TripsRepository } from './trips.repository';

@Injectable()
export class TripsService {
  constructor(
    @Inject(TRIPS_REPOSITORY) private readonly repo: TripsRepository,
  ) {}

  /**
   * Persist a trip log (Section 10). Requires logging consent. Hashes the
   * rider id, stamps schema/model versions and a uuid, and strips raw GPS
   * traces when the rider has not consented to keeping them.
   */
  async create(input: CreateTripInput): Promise<TripLog> {
    if (!input.consent?.logging) {
      throw new BadRequestException(
        'Trip not stored: logging consent was not given.',
      );
    }

    const prediction = input.consent.raw_gps
      ? input.prediction
      : {
          ...input.prediction,
          // Drop per-point coordinates of the GPS trace; keep the risk values.
          segments: input.prediction.segments.map((s) => ({
            ...s,
            lat: 0,
            lon: 0,
          })),
        };

    const trip: TripLog = {
      schema_version: TRIP_SCHEMA_VERSION,
      trip_id: randomUUID(),
      rider_id: this.hashRiderId(input.rider_id),
      app_version: input.app_version,
      model_version: MODEL_VERSION,
      consent: input.consent,
      trip: input.trip,
      context: input.context,
      prediction,
      outcome: input.outcome,
      response: input.response,
    };

    return this.repo.save(trip);
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

  private hashRiderId(raw: string): string {
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }
}
