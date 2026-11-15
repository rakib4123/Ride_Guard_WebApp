/**
 * The model's inputs. Every field is measured or derived by the app itself —
 * the rider is asked nothing (apps/model/rideguard_model.py). Value domains
 * match the training data so nothing is remapped at the boundary.
 */

/** Phone use. The app sends 'Regularly' while the screen is touched on the move, else 'Never'. */
export type Frequency = 'Never' | 'Sometimes' | 'Regularly';
export type RoadType = 'City Road' | 'Highway' | 'Village Road';
export type RoadCondition = 'Dry' | 'Wet';
export type Weather = 'Clear' | 'Foggy' | 'Rainy';
export type TimeOfDay = 'Morning' | 'Noon' | 'Afternoon' | 'Evening' | 'Night';
export type Area = 'Urban' | 'Rural';

export interface LiveFeatures {
  /** GPS speed, km/h. */
  Bike_Speed: number;
  /** Posted limit, km/h: OSM maxspeed where tagged, else a road-class default. */
  Speed_Limit: number;
  /** 'Regularly' while the screen is being touched on the move. */
  Talk_While_Riding: Frequency;
  /** Open-Meteo at the rider's location. */
  Weather: Weather;
  /** Wet while it is raining or foggy. */
  Road_condition: RoadCondition;
  /** From the phone's clock. */
  Time_of_Day: TimeOfDay;
  /** From the OSM road class under the rider. */
  Road_Type: RoadType;
  /**
   * 1 (light) .. 8 (gridlock). A time-of-day estimate that measured signals —
   * live traffic, or the crowd counted around the rider — can only raise.
   */
  Traffic_Density: number;
  /** After sunset at the rider's location (Open-Meteo is_day). Used by the severity model. */
  Is_Dark: boolean;
  /** Town/city or countryside, from the reverse-geocoded place. Used by the severity model. */
  Area: Area;
}

/** The vector the scorer consumes. */
export type FeatureVector = LiveFeatures;

export const FREQUENCIES: Frequency[] = ['Never', 'Sometimes', 'Regularly'];
export const ROAD_TYPES: RoadType[] = ['City Road', 'Highway', 'Village Road'];
export const ROAD_CONDITIONS: RoadCondition[] = ['Dry', 'Wet'];
export const WEATHERS: Weather[] = ['Clear', 'Foggy', 'Rainy'];
export const TIMES_OF_DAY: TimeOfDay[] = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];
export const AREAS: Area[] = ['Urban', 'Rural'];

/** Starting state before any sensor has reported. */
export const DEFAULT_FEATURES: LiveFeatures = {
  Bike_Speed: 0,
  Speed_Limit: 40,
  Talk_While_Riding: 'Never',
  Weather: 'Clear',
  Road_condition: 'Dry',
  Time_of_Day: 'Afternoon',
  Road_Type: 'City Road',
  Traffic_Density: 4,
  Is_Dark: false,
  Area: 'Urban',
};
