/**
 * Real global feature importance from the trained pipeline
 * (results/shap_global.csv: mean |SHAP| over the test set). Used to show riders
 * which factors the model actually leans on the most. Highest first.
 */
export const SHAP_GLOBAL: { feature: string; label: string; value: number }[] = [
  { feature: 'Talk_While_Riding', label: 'Phone use while riding', value: 0.8204 },
  { feature: 'Smoke_While_Riding', label: 'Smoking while riding', value: 0.5606 },
  { feature: 'Road_Type', label: 'Road type', value: 0.361 },
  { feature: 'Biker_Occupation', label: 'Occupation', value: 0.3382 },
  { feature: 'Valid_Driving_License', label: 'Valid license', value: 0.2544 },
  { feature: 'Bike_Speed', label: 'Bike speed', value: 0.2388 },
  { feature: 'Speed_Limit', label: 'Speed limit', value: 0.2239 },
  { feature: 'Biker_Alcohol', label: 'Alcohol', value: 0.212 },
  { feature: 'Daily_Travel_Distance', label: 'Daily distance', value: 0.2085 },
  { feature: 'Riding_Experience', label: 'Riding experience', value: 0.1457 },
];
