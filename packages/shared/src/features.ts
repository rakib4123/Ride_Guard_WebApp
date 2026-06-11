/**
 * The 19 Tier-1 features (Handoff Section 3 / config/feature_gate.yaml). The
 * value domains below match the TRAINED MODEL's schema exactly (the Mendeley
 * bike dataset), so the app collects precisely what CatBoost consumes — no
 * lossy remapping at the boundary.
 */

export type Occupation = 'Business' | 'Others' | 'Service' | 'Student';
export type EducationLevel = 'Less than high school' | 'High school' | 'Above high school';
/** Phone/smoking frequency while riding. */
export type Frequency = 'Never' | 'Sometimes' | 'Regularly';
export type Ownership = 'Bought with own money' | 'Inherited';
export type YesNo = 'Yes' | 'No';
export type BikeCondition = 'New' | 'Old';
export type RoadType = 'City Road' | 'Highway' | 'Village Road';
export type RoadCondition = 'Dry' | 'Wet';
export type Weather = 'Clear' | 'Foggy' | 'Rainy';
export type TimeOfDay = 'Morning' | 'Noon' | 'Afternoon' | 'Evening' | 'Night';
/** 0 = no alcohol, 1 = alcohol (numeric in the model). */
export type AlcoholFlag = 0 | 1;

/** Set once and reused across trips. */
export interface RiderProfile {
  Biker_Age: number;
  Biker_Occupation: Occupation;
  Biker_Education_Level: EducationLevel;
  Riding_Experience: number;
  Daily_Travel_Distance: number;
  Motorcycle_Ownership: Ownership;
  Valid_Driving_License: YesNo;
  Bike_Condition: BikeCondition;
}

/** Asked or inferred per trip. */
export interface TripToggles {
  Talk_While_Riding: Frequency;
  Smoke_While_Riding: Frequency;
  Wearing_Helmet: YesNo;
  Biker_Alcohol: AlcoholFlag;
  Road_Type: RoadType;
  Road_condition: RoadCondition;
  /** Ordinal traffic density 1 (light) .. 8 (gridlock). Numeric in the model. */
  Traffic_Density: number;
  /** Posted limit in km/h (model saw 40..80). */
  Speed_Limit: number;
  Bike_Speed: number;
}

/** Auto-filled from sensors / clock / weather API. */
export interface TripContext {
  Weather: Weather;
  Time_of_Day: TimeOfDay;
}

/** The full 19-feature vector handed to the behaviour scorer. */
export type FeatureVector = RiderProfile & TripToggles & TripContext;

export const OCCUPATIONS: Occupation[] = ['Business', 'Others', 'Service', 'Student'];
export const EDUCATION_LEVELS: EducationLevel[] = ['Less than high school', 'High school', 'Above high school'];
export const FREQUENCIES: Frequency[] = ['Never', 'Sometimes', 'Regularly'];
export const OWNERSHIPS: Ownership[] = ['Bought with own money', 'Inherited'];
export const BIKE_CONDITIONS: BikeCondition[] = ['New', 'Old'];
export const ROAD_TYPES: RoadType[] = ['City Road', 'Highway', 'Village Road'];
export const ROAD_CONDITIONS: RoadCondition[] = ['Dry', 'Wet'];
export const WEATHERS: Weather[] = ['Clear', 'Foggy', 'Rainy'];
export const TIMES_OF_DAY: TimeOfDay[] = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];
export const SPEED_LIMITS: number[] = [40, 50, 60, 70, 80];
export const TRAFFIC_LEVELS: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const DEFAULT_PROFILE: RiderProfile = {
  Biker_Age: 30,
  Biker_Occupation: 'Service',
  Biker_Education_Level: 'High school',
  Riding_Experience: 5,
  Daily_Travel_Distance: 20,
  Motorcycle_Ownership: 'Bought with own money',
  Valid_Driving_License: 'Yes',
  Bike_Condition: 'New',
};

export const DEFAULT_TOGGLES: TripToggles = {
  Talk_While_Riding: 'Never',
  Smoke_While_Riding: 'Never',
  Wearing_Helmet: 'Yes',
  Biker_Alcohol: 0,
  Road_Type: 'City Road',
  Road_condition: 'Dry',
  Traffic_Density: 4,
  Speed_Limit: 40,
  Bike_Speed: 35,
};
