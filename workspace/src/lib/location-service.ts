
'use client';

/**
 * Determines the default language based on geographical coordinates.
 * For this app, it specifically checks if the location is within a
 * bounding box for Andhra Pradesh and Telangana.
 *
 * @param lat The latitude of the user's location.
 * @param lng The longitude of the user's location.
 * @returns 'te' for Telugu if within the region, otherwise 'en' for English.
 */
export function getLanguageForLocation(lat: number, lng: number): 'te' | 'en' {
  // A rough bounding box for Andhra Pradesh and Telangana, India.
  // This can be refined for more accuracy.
  const telanganaAndhraPradesh = {
    minLat: 12.6,
    maxLat: 19.9,
    minLng: 77.0,
    maxLng: 84.8,
  };

  if (
    lat >= telanganaAndhraPradesh.minLat &&
    lat <= telanganaAndhraPradesh.maxLat &&
    lng >= telanganaAndhraPradesh.minLng &&
    lng <= telanganaAndhraPradesh.maxLng
  ) {
    return 'te'; // Telugu
  }

  // Default to English for all other locations
  return 'en';
}
