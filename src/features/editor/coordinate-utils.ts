/**
 * Editor coordinate utilities.
 *
 * Pure functions for converting between Leaflet image-space coordinates
 * and normalized [0, 100] document coordinates, plus clamping. The slug
 * and id-generation helpers live in the domain layer
 * (`@/domain/location`) so services can use them without an upward
 * dependency; they are re-exported here for editor convenience.
 */

import { nameToSlug, uniqueLocationId, uniqueMapId } from '@/domain/location';

/** Maximum normalized coordinate value (inclusive). */
export const NORMALIZED_MAX = 100;
/** Minimum normalized coordinate value (inclusive). */
export const NORMALIZED_MIN = 0;

/**
 * Inverts `normalizedToLatLng`: converts an image-space lat/lng pair
 * (Leaflet CRS.Simple, y-down image) back into normalized [0, 100]
 * coordinates with clamping.
 */
export function latLngToNormalized(
  lat: number,
  lng: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = clamp((lng / width) * NORMALIZED_MAX, NORMALIZED_MIN, NORMALIZED_MAX);
  const y = clamp(((height - lat) / height) * NORMALIZED_MAX, NORMALIZED_MIN, NORMALIZED_MAX);
  return { x, y };
}

/** Clamps a value to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

// Re-exported from the domain layer for editor convenience.
export { nameToSlug, uniqueLocationId, uniqueMapId };
