/**
 * Marker editor: pure operations on a working document.
 *
 * Each operation returns a new `AtlasMapDocument` (immutable update)
 * so the editor history snapshots are clean and selection can be
 * restored sensibly. The editor never mutates repository-owned
 * documents — callers pass a working clone.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument } from '@/domain/map';
import { clamp, uniqueLocationId } from './coordinate-utils';
import { NORMALIZED_MAX, NORMALIZED_MIN } from './coordinate-utils';

/** Input for creating a marker. `name` is required to commit. */
export interface AddMarkerInput {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly description?: string;
  readonly category?: string;
  readonly icon?: string;
  readonly dangerLevel?: AtlasLocation['dangerLevel'];
  readonly aliases?: readonly string[];
  readonly worldInfoKeywords?: readonly string[];
  readonly hiddenUntilDiscovered?: boolean;
  readonly discoveredByDefault?: boolean;
}

/** Adds a location to a working document, returning a new document. */
export function addMarker(
  document: AtlasMapDocument,
  input: AddMarkerInput,
): { document: AtlasMapDocument; locationId: string } {
  const id = uniqueLocationId(input.name, document.locations);
  const location: AtlasLocation = {
    id,
    name: input.name,
    description: input.description,
    coordinates: {
      x: clamp(input.x, NORMALIZED_MIN, NORMALIZED_MAX),
      y: clamp(input.y, NORMALIZED_MIN, NORMALIZED_MAX),
    },
    icon: input.icon,
    category: input.category,
    dangerLevel: input.dangerLevel,
    aliases: input.aliases ? [...input.aliases] : undefined,
    worldInfoKeywords: input.worldInfoKeywords ? [...input.worldInfoKeywords] : undefined,
    hiddenUntilDiscovered: input.hiddenUntilDiscovered,
    discoveredByDefault: input.discoveredByDefault,
  };
  return {
    document: { ...document, locations: [...document.locations, location] },
    locationId: id,
  };
}

/** Partial field updates for editing a location. */
export type MarkerFieldUpdate = Partial<{
  name: string;
  description: string;
  category: string;
  icon: string;
  dangerLevel: AtlasLocation['dangerLevel'];
  aliases: readonly string[];
  worldInfoKeywords: readonly string[];
  hiddenUntilDiscovered: boolean;
  discoveredByDefault: boolean;
}>;

/** Updates fields on a location, returning a new document. */
export function editMarker(
  document: AtlasMapDocument,
  locationId: string,
  update: MarkerFieldUpdate,
): AtlasMapDocument {
  const locations = document.locations.map((location) => {
    if (location.id !== locationId) {
      return location;
    }
    return {
      ...location,
      ...stripUndefined({
        name: update.name,
        description: update.description,
        category: update.category,
        icon: update.icon,
        dangerLevel: update.dangerLevel,
        hiddenUntilDiscovered: update.hiddenUntilDiscovered,
        discoveredByDefault: update.discoveredByDefault,
        aliases: update.aliases ? [...update.aliases] : undefined,
        worldInfoKeywords: update.worldInfoKeywords ? [...update.worldInfoKeywords] : undefined,
      }),
    };
  });
  return { ...document, locations };
}

/** Moves a location to clamped normalized coordinates, returning a new document. */
export function moveMarker(
  document: AtlasMapDocument,
  locationId: string,
  x: number,
  y: number,
): AtlasMapDocument {
  const locations = document.locations.map((location) => {
    if (location.id !== locationId) {
      return location;
    }
    return {
      ...location,
      coordinates: {
        x: clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
        y: clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
      },
    };
  });
  return { ...document, locations };
}

/** Result of deleting a marker, including side effects on defaultLocationId. */
export interface DeleteMarkerResult {
  readonly document: AtlasMapDocument;
  readonly clearedDefault: boolean;
}

/**
 * Deletes a location, clearing `defaultLocationId` if it referenced the
 * deleted marker. Routes referencing the deleted location are NOT
 * silently removed — they remain so validation will catch them before
 * save (plan: do not silently delete routes).
 */
export function deleteMarker(document: AtlasMapDocument, locationId: string): DeleteMarkerResult {
  const locations = document.locations.filter((location) => location.id !== locationId);
  const clearedDefault = document.defaultLocationId === locationId;
  return {
    document: {
      ...document,
      locations,
      defaultLocationId: clearedDefault ? undefined : document.defaultLocationId,
    },
    clearedDefault,
  };
}

/** Sets the default location id, returning a new document. */
export function setDefaultLocation(
  document: AtlasMapDocument,
  locationId: string | undefined,
): AtlasMapDocument {
  return { ...document, defaultLocationId: locationId };
}

/** Strips keys whose value is `undefined`. */
function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as Partial<T>;
}
