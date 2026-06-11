import type { Weather, TimeOfDay } from '@rideguard/shared';

/** Map Open-Meteo WMO weather codes to the model's 3 weather classes. */
function codeToWeather(code: number): Weather {
  if ([45, 48].includes(code)) return 'Foggy';
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
      code,
    )
  )
    return 'Rainy';
  return 'Clear';
}

export interface WeatherNow {
  condition: Weather;
  tempC: number;
  rainMmHr: number;
}

/** Free, keyless current weather from Open-Meteo (Handoff Section 3). */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherNow> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  const data = await res.json();
  const c = data.current ?? {};
  return {
    condition: codeToWeather(Number(c.weather_code ?? 0)),
    tempC: Number(c.temperature_2m ?? NaN),
    rainMmHr: Number(c.precipitation ?? 0),
  };
}

/** Derive Time_of_Day from the local clock (Handoff Section 3). */
export function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'Morning';
  if (h >= 11 && h < 14) return 'Noon';
  if (h >= 14 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}
