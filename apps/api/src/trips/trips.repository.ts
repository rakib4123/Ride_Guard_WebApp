import type { TripLog } from '@rideguard/shared';

export const TRIPS_REPOSITORY = Symbol('TRIPS_REPOSITORY');

/**
 * Persistence seam for trip logs. The default FileTripsRepository writes JSON
 * to disk for development. In production (Section 12), bind a database-backed
 * implementation (Postgres/Prisma) the project owner controls.
 */
export interface TripsRepository {
  save(trip: TripLog): Promise<TripLog>;
  findAll(): Promise<TripLog[]>;
  findById(id: string): Promise<TripLog | null>;
  count(): Promise<number>;
}
