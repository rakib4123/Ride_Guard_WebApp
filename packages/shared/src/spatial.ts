import type { LatLon } from './scoring';

const M_PER_DEG = 111_320;

/** One grid cell of the location layer (apps/model/build_spatial.py). */
export interface GridCell {
  i: number;
  j: number;
  /** Motorcycle-involved crashes recorded in this cell. */
  count: number;
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** One region's crash grid (apps/model/build_spatial.py). */
export interface SpatialGrid {
  gridM: number;
  /** Reference latitude for the longitude scale. */
  lat0: number;
  cells: GridCell[];
  /** Region metadata; a grid without a bbox covers everywhere it has cells. */
  id?: string;
  name?: string;
  /** ISO 3166-1 alpha-2. */
  country?: string;
  bbox?: BBox;
  /** Data credit to show with the layer. */
  credit?: string;
  years?: string;
  crashes?: number;
}

/** The region whose box contains a point, if any. */
export function regionAt<T extends { bbox?: BBox }>(regions: T[], p: LatLon): T | null {
  for (const r of regions) {
    const b = r.bbox;
    if (!b || (p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon)) return r;
  }
  return null;
}

/** Grid index of a point. Must match cell_ij() in build_spatial.py. */
export function cellIndex(p: LatLon, gridM: number, lat0: number): [number, number] {
  return [
    Math.floor((p.lat * M_PER_DEG) / gridM),
    Math.floor((p.lon * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)) / gridM),
  ];
}

/**
 * The location prior pi(l) in [0.5, 1], from one grid or one grid per region.
 *
 * Built from motorcycle crash counts per cell, the cell size chosen per region
 * by a check on later years (apps/model/build_spatial.py). In a cell with
 * recorded crashes, pi = 0.5 + 0.5 x the share of crashes that happened in
 * less crash-dense cells (mid-rank), so the city's densest cells approach 1.
 *
 * Anywhere without recorded crashes, and outside every region, pi is 0.5, the
 * fusion rule's neutral point. Crash records are incomplete (and Dhaka's are
 * geocoded place names, not GPS fixes), so a cell without a record is not
 * evidence that it is safe: the location layer can raise a reading, never
 * lower it.
 */
export function makeSpatialPrior(
  layer: SpatialGrid | SpatialGrid[] | null | undefined,
): (p: LatLon) => number {
  const grids = (Array.isArray(layer) ? layer : layer ? [layer] : []).filter((g) => g.cells.length);
  if (grids.length === 0) return () => 0.5;
  if (grids.length === 1 && !grids[0].bbox) return gridPrior(grids[0]);
  // Several regions: score a point with the grid of the region it is in.
  const fns = grids.map((g) => ({ bbox: g.bbox, fn: gridPrior(g) }));
  return (p: LatLon) => regionAt(fns, p)?.fn(p) ?? 0.5;
}

function gridPrior(grid: SpatialGrid): (p: LatLon) => number {

  const total = grid.cells.reduce((s, c) => s + c.count, 0);
  // Weight of crashes in cells with a lower count, plus half of those tied.
  const byCount = new Map<number, number>();
  for (const c of grid.cells) byCount.set(c.count, (byCount.get(c.count) ?? 0) + c.count);
  const levels = [...byCount.keys()].sort((a, b) => a - b);
  const pct = new Map<number, number>();
  let below = 0;
  for (const n of levels) {
    const tied = byCount.get(n) as number;
    pct.set(n, (below + tied / 2) / total);
    below += tied;
  }

  const lookup = new Map<string, number>();
  for (const c of grid.cells) lookup.set(`${c.i}_${c.j}`, 0.5 + 0.5 * (pct.get(c.count) as number));

  return (p: LatLon): number => {
    const [i, j] = cellIndex(p, grid.gridM, grid.lat0);
    return lookup.get(`${i}_${j}`) ?? 0.5;
  };
}
