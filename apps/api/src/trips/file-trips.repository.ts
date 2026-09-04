import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { TripLog } from '@rideguard/shared';
import { TripsRepository } from './trips.repository';

/**
 * Simple JSON-file repository. Not for high concurrency; fine for the pilot.
 * Writes are serialised through a promise chain and land via a temp file +
 * rename, so overlapping saves cannot interleave or truncate the store.
 */
@Injectable()
export class FileTripsRepository implements TripsRepository {
  private readonly logger = new Logger(FileTripsRepository.name);
  private readonly file = resolveDataFile();
  /** Tail of the write queue; every save appends to it. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.logger.log(`Trip logs at ${this.file}`);
  }

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
    // Write-then-rename so a crash mid-write cannot leave a partial file.
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(trips, null, 2), 'utf-8');
    renameSync(tmp, this.file);
  }

  /** Run `fn` after every previously queued write has settled. */
  private enqueue<T>(fn: () => T): Promise<T> {
    const next = this.queue.then(fn, fn);
    // Keep the chain alive even if a save throws.
    this.queue = next.catch(() => undefined);
    return next;
  }

  async save(trip: TripLog): Promise<TripLog> {
    return this.enqueue(() => {
      const trips = this.read();
      trips.push(trip);
      this.write(trips);
      return trip;
    });
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

/**
 * Resolve the trips file independently of the working directory. Render starts
 * the API from the repo root (`node apps/api/dist/main.js`), so a cwd-relative
 * default would write to a different, un-ignored path than local runs do.
 */
function resolveDataFile(): string {
  const configured = process.env.TRIPS_DATA_FILE;
  if (configured) return resolve(configured);
  // dist/trips -> apps/api/data/trips.json, whatever the cwd is.
  return join(__dirname, '..', '..', 'data', 'trips.json');
}
