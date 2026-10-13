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
  /**
   * Date and time in the rider's language, but always with Western digits:
   * plain 'bn-BD' formatting would emit Bengali digits, so the latn numbering
   * system is requested explicitly.
   */
  dateTime: (d: Date, locale: 'en' | 'bn'): string =>
    d.toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
};
