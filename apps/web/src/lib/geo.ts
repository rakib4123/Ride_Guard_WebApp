import type { LatLon } from '@rideguard/shared';

/** Central Dhaka fallback / starting point. */
export const DHAKA_CENTER: LatLon = { lat: 23.7806, lon: 90.407 };

export interface FixResult extends LatLon {
  /** Reported accuracy radius in metres (lower is better). */
  accuracy: number;
}

/**
 * One-shot high-accuracy location fix. On a desktop without GPS this is derived
 * from network/IP and can be off by kilometres, so we surface `accuracy` to the
 * UI and let the rider correct it by dragging the pin or searching.
 */
export function getFix(): Promise<FixResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
