import type { Weather, TimeOfDay, RoadCondition } from '@rideguard/shared';

/** Wet roads when it's raining or foggy; dry when clear (model has Dry|Wet). */
export const roadConditionFromWeather = (w: Weather): RoadCondition =>
  w === 'Clear' ? 'Dry' : 'Wet';

/**
 * Rough Dhaka traffic estimate by time of day (1 light .. 8 gridlock). Measured
 * signals — live traffic or the crowd around the rider — can only raise it.
 */
export const trafficFromTime = (t: TimeOfDay): number =>
  ({ Morning: 6, Noon: 5, Afternoon: 5, Evening: 7, Night: 2 }[t] ?? 4);
