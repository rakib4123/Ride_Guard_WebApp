import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hotspot, LatLon } from '@rideguard/shared';
import { SPATIAL_KERNEL_SIGMA_M } from '@rideguard/shared';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Tier-2 spatial prior. Production should query the KDE held by the pipeline
 * (Section 7). Here we approximate it in-process with a Gaussian kernel over
 * the loaded hotspot points: pi -> a hotspot's density near it, decaying to 0
 * far away. pi = 0.5 is the neutral point for fusion (Section 5).
 */
@Injectable()
export class SpatialService implements OnModuleInit {
  private readonly logger = new Logger(SpatialService.name);
  private hotspots: Hotspot[] = [];
  private source = 'unloaded';

  /** Try several locations so it works whether started from apps/api, the repo
   * root (Render), or the compiled dist folder. */
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
      this.source = raw.source ?? 'unknown';
      this.logger.log(
        `Loaded ${this.hotspots.length} hotspots (source: ${this.source}) from ${path}.`,
      );
    } catch (err) {
      this.logger.warn(`Could not load hotspots.json: ${String(err)}`);
      this.hotspots = [];
    }
  }

  getHotspots(): Hotspot[] {
    return this.hotspots;
  }

  getSource(): string {
    return this.source;
  }

  /** Relative-risk prior pi in [0,1] at a point. */
  prior(point: LatLon): number {
    if (this.hotspots.length === 0) return 0.5; // neutral if no data
    const twoSigmaSq = 2 * SPATIAL_KERNEL_SIGMA_M * SPATIAL_KERNEL_SIGMA_M;
    let max = 0;
    for (const h of this.hotspots) {
      const d = haversineMeters(point, { lat: h.lat, lon: h.lon });
      const kernel = h.normDensity * Math.exp(-(d * d) / twoSigmaSq);
      if (kernel > max) max = kernel;
    }
    return Math.max(0, Math.min(1, max));
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
