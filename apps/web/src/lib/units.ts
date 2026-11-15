/**
 * Display units. The model and API always work in km/h; only what the rider
 * reads changes. Countries whose road signs are in miles per hour show mph, so
 * the number on screen matches the sign at the roadside.
 */
export type SpeedUnit = 'km/h' | 'mph';

const MPH_COUNTRIES = new Set(['GB', 'US', 'LR', 'MM', 'IM', 'JE', 'GG', 'PR', 'GU', 'VI', 'AS', 'MP']);
const KMH_PER_MPH = 1.609344;

export const speedUnitFor = (country: string | null | undefined): SpeedUnit =>
  country && MPH_COUNTRIES.has(country.toUpperCase()) ? 'mph' : 'km/h';

/** A km/h value in the given unit, rounded for display. */
export const inUnit = (kmh: number, unit: SpeedUnit): number =>
  Math.round(unit === 'mph' ? kmh / KMH_PER_MPH : kmh);
