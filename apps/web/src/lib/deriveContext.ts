import type { Weather, TimeOfDay, RoadCondition, RoadType } from '@rideguard/shared';

/** Wet roads when it's raining or foggy; dry when clear (model has Dry|Wet). */
export const roadConditionFromWeather = (w: Weather): RoadCondition =>
  w === 'Clear' ? 'Dry' : 'Wet';

/** Rough Dhaka traffic estimate by time of day (1 light .. 8 gridlock). */
export const trafficFromTime = (t: TimeOfDay): number =>
  ({ Morning: 6, Noon: 5, Afternoon: 5, Evening: 7, Night: 2 }[t] ?? 4);

/** Typical posted limit for the road type (km/h). */
export const speedLimitFromRoadType = (r: RoadType): number =>
  r === 'Highway' ? 80 : r === 'Village Road' ? 50 : 40;
