import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TripLog } from '@rideguard/shared';
import { TripsRepository } from './trips.repository';

/** Simple JSON-file repository. Not for high concurrency; fine for the pilot. */
@Injectable()
export class FileTripsRepository implements TripsRepository {
  private readonly logger = new Logger(FileTripsRepository.name);
  private readonly file =
    process.env.TRIPS_DATA_FILE ?? join(process.cwd(), 'data', 'trips.json');

  private read(): TripLog[] {
    try {
      if (!existsSync(this.file)) return [];
      return JSON.parse(readFileSync(this.file, 'utf-8')) as TripLog[];
    } catch (err) {
      this.logger.error(`Failed reading trips file: ${String(err)}`);
      return [];
    }
  }

  private write(trips: TripLog[]): void {
    const dir = dirname(this.file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.file, JSON.stringify(trips, null, 2), 'utf-8');
  }

  async save(trip: TripLog): Promise<TripLog> {
    const trips = this.read();
    trips.push(trip);
    this.write(trips);
    return trip;
  }

  async findAll(): Promise<TripLog[]> {
    return this.read();
  }

  async findById(id: string): Promise<TripLog | null> {
    return this.read().find((t) => t.trip_id === id) ?? null;
  }

  async count(): Promise<number> {
    return this.read().length;
  }
}
