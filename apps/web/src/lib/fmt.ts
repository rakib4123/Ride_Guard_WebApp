/**
 * Number formatting. Always Western digits, in both locales: every
 * speedometer, road sign and odometer in Bangladesh uses them, so matching
 * the bike's own dial matters more than script consistency (spec 3.4).
 */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const fmt = {
  /** A 0..1 risk value as a 0..100 string. */
  pct: (x: number): string => String(Math.round(clamp01(x) * 100)),
  km: (x: number): string => x.toFixed(1),
  speed: (x: number): string => String(Math.round(x)),
};
