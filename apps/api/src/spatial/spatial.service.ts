import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hotspot, LatLon, SpatialGrid } from '@rideguard/shared';
import { makeSpatialPrior } from '@rideguard/shared';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Location prior from the regional crash grids (apps/model/build_spatial.py writes
 * data/hotspots.json). See makeSpatialPrior for the definition: 0.5 is
 * neutral, and the layer can raise a reading but never lower it.
 */
@Injectable()
export class SpatialService implements OnModuleInit {
  private readonly logger = new Logger(SpatialService.name);
  private hotspots: Hotspot[] = [];
  private regions: SpatialGrid[] = [];
  private source = 'unloaded';
  private priorFn: (p: LatLon) => number = makeSpatialPrior(null);

  /** Works whether started from apps/api, the repo root (Render), or dist. */
  private resolveDataFile(): string | null {
    const candidates = [
      process.env.HOTSPOTS_FILE,
      join(__dirname, '..', '..', 'data', 'hotspots.json'),
      join(process.cwd(), 'data', 'hotspots.json'),
      join(process.cwd(), 'apps', 'api', 'data', 'hotspots.json'),
    ].filter(Boolean) as string[];
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  onModuleInit(): void {
    try {
      const path = this.resolveDataFile();
      if (!path) throw new Error('hotspots.json not found in any known location');
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      this.hotspots = raw.hotspots ?? [];
      // Older single-grid files carry `grid`; current files carry `regions`.
      this.regions = raw.regions ?? (raw.grid ? [raw.grid] : []);
      this.source = raw.source ?? 'unknown';
      for (const r of this.regions) {
        this.logger.log(`Crash grid ${r.name ?? '(unnamed)'}: ${r.cells.length} cells of ${r.gridM} m, ${r.crashes ?? '?'} crashes.`);
      }
    } catch (err) {
      this.logger.warn(`Could not load hotspots.json: ${String(err)}`);
      this.hotspots = [];
      this.regions = [];
    }
    this.priorFn = makeSpatialPrior(this.regions);
  }

  getHotspots(): Hotspot[] {
    return this.hotspots;
  }

  getRegions(): SpatialGrid[] {
    return this.regions;
  }

  getSource(): string {
    return this.source;
  }

  /** Location prior pi in [0.5, 1] at a point. */
  prior(point: LatLon): number {
    return this.priorFn(point);
  }
}

export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
