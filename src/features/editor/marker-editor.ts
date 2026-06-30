/**
 * Marker, Region, and Route editor logic.
 *
 * Implements pure functions that produce a new `AtlasMapDocument` for the
 * visual editor, making all operations undoable and avoiding in-place
 * mutations.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';
import type { AtlasMapDocument } from '@/domain/map';
import { clamp, uniqueLocationId } from './coordinate-utils';
import { NORMALIZED_MAX, NORMALIZED_MIN } from './coordinate-utils';
import { uniqueLocationId as uniqueRegionId } from '@/domain/location';

// --- Marker (Location) Ops ---

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
  readonly childMapId?: string;
}

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
    childMapId: input.childMapId,
  };
  return {
    document: { ...document, locations: [...document.locations, location] },
    locationId: id,
  };
}

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
  childMapId: string;
}>;

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
        childMapId: update.childMapId === '' ? undefined : update.childMapId,
      }),
    };
  });
  return { ...document, locations };
}

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

export interface DeleteMarkerResult {
  readonly document: AtlasMapDocument;
  readonly clearedDefault: boolean;
}

export function deleteMarker(
  document: AtlasMapDocument,
  locationId: string,
): DeleteMarkerResult {
  const locations = document.locations.filter((location) => location.id !== locationId);
  const clearedDefault = document.defaultLocationId === locationId;

  // We do NOT silently delete routes referencing this location (M7 requirement: "deleting a location must not silently delete connected routes. Invalid connected routes must block save").
  // So routes remain untouched so the validation phase catches it.

  return {
    document: {
      ...document,
      locations,
      defaultLocationId: clearedDefault ? undefined : document.defaultLocationId,
    },
    clearedDefault,
  };
}

export function setDefaultLocation(
  document: AtlasMapDocument,
  locationId: string | undefined,
): AtlasMapDocument {
  return { ...document, defaultLocationId: locationId };
}

// --- Region Ops (M7) ---

export interface AddRegionInput {
  readonly name: string;
  readonly polygon: readonly (readonly [number, number])[];
  readonly description?: string;
  readonly fillColor?: string;
  readonly borderColor?: string;
  readonly opacity?: number;
  readonly hiddenUntilDiscovered?: boolean;
}

export function addRegion(
  document: AtlasMapDocument,
  input: AddRegionInput,
): { document: AtlasMapDocument; regionId: string } {
  // Region lists are stored in document.regions; we create unique region IDs using location helper (slugs)
  const id = uniqueRegionId(input.name, document.regions || []);
  const region: AtlasRegion = {
    id,
    name: input.name,
    polygon: input.polygon.map(([x, y]) => [
      clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
      clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
    ]),
    description: input.description,
    fillColor: input.fillColor,
    borderColor: input.borderColor,
    opacity: input.opacity,
    hiddenUntilDiscovered: input.hiddenUntilDiscovered,
  };
  return {
    document: { ...document, regions: [...(document.regions || []), region] },
    regionId: id,
  };
}

export type RegionFieldUpdate = Partial<{
  name: string;
  description: string;
  fillColor: string;
  borderColor: string;
  opacity: number;
  hiddenUntilDiscovered: boolean;
}>;

export function editRegion(
  document: AtlasMapDocument,
  regionId: string,
  update: RegionFieldUpdate,
): AtlasMapDocument {
  const regions = (document.regions || []).map((region) => {
    if (region.id !== regionId) {
      return region;
    }
    return {
      ...region,
      ...stripUndefined({
        name: update.name,
        description: update.description,
        fillColor: update.fillColor,
        borderColor: update.borderColor,
        opacity: update.opacity,
        hiddenUntilDiscovered: update.hiddenUntilDiscovered,
      }),
    };
  });
  return { ...document, regions };
}

export function deleteRegion(document: AtlasMapDocument, regionId: string): AtlasMapDocument {
  const regions = (document.regions || []).filter((r) => r.id !== regionId);
  return { ...document, regions };
}

export function moveRegionPoint(
  document: AtlasMapDocument,
  regionId: string,
  pointIndex: number,
  x: number,
  y: number,
): AtlasMapDocument {
  const regions = (document.regions || []).map((region) => {
    if (region.id !== regionId) {
      return region;
    }
    const polygon = region.polygon.map((pt, idx) => {
      if (idx !== pointIndex) {
        return pt;
      }
      return [
        clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
        clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
      ] as readonly [number, number];
    });
    return { ...region, polygon };
  });
  return { ...document, regions };
}

export function addRegionPoint(
  document: AtlasMapDocument,
  regionId: string,
  x: number,
  y: number,
): AtlasMapDocument {
  const regions = (document.regions || []).map((region) => {
    if (region.id !== regionId) {
      return region;
    }
    const polygon = [
      ...region.polygon,
      [
        clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
        clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
      ] as readonly [number, number],
    ];
    return { ...region, polygon };
  });
  return { ...document, regions };
}

export function removeRegionPoint(
  document: AtlasMapDocument,
  regionId: string,
  pointIndex: number,
): AtlasMapDocument {
  const regions = (document.regions || []).map((region) => {
    if (region.id !== regionId) {
      return region;
    }
    // Only allow removal if it retains >= 3 points
    if (region.polygon.length <= 3) {
      return region;
    }
    const polygon = region.polygon.filter((_, idx) => idx !== pointIndex);
    return { ...region, polygon };
  });
  return { ...document, regions };
}

// --- Route Ops (M7) ---

export interface AddRouteInput {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly bidirectional: boolean;
  readonly distance?: number;
  readonly distanceUnit?: AtlasRoute['distanceUnit'];
  readonly travelTime?: number;
  readonly travelTimeUnit?: AtlasRoute['travelTimeUnit'];
  readonly dangerLevel?: AtlasRoute['dangerLevel'];
  readonly locked?: boolean;
  readonly requirements?: readonly string[];
}

export function addRoute(
  document: AtlasMapDocument,
  input: AddRouteInput,
): { document: AtlasMapDocument; routeId: string } {
  // Route IDs are generated as: `route-fromLocationId_toLocationId`
  const baseId = `route-${input.fromLocationId}_${input.toLocationId}`;
  let id = baseId;
  const used = new Set((document.routes || []).map((r) => r.id));
  let suffix = 2;
  while (used.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const route: AtlasRoute = {
    id,
    name: `${input.fromLocationId} to ${input.toLocationId}`,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    bidirectional: input.bidirectional,
    distance: input.distance,
    distanceUnit: input.distanceUnit,
    travelTime: input.travelTime,
    travelTimeUnit: input.travelTimeUnit,
    dangerLevel: input.dangerLevel,
    locked: input.locked,
    requirements: input.requirements ? [...input.requirements] : undefined,
    points: [],
  };

  return {
    document: { ...document, routes: [...(document.routes || []), route] },
    routeId: id,
  };
}

export type RouteFieldUpdate = Partial<{
  name: string;
  bidirectional: boolean;
  distance: number;
  distanceUnit: AtlasRoute['distanceUnit'];
  travelTime: number;
  travelTimeUnit: AtlasRoute['travelTimeUnit'];
  dangerLevel: AtlasRoute['dangerLevel'];
  locked: boolean;
  requirements: readonly string[];
}>;

export function editRoute(
  document: AtlasMapDocument,
  routeId: string,
  update: RouteFieldUpdate,
): AtlasMapDocument {
  const routes = (document.routes || []).map((route) => {
    if (route.id !== routeId) {
      return route;
    }
    return {
      ...route,
      ...stripUndefined({
        name: update.name,
        bidirectional: update.bidirectional,
        distance: update.distance,
        distanceUnit: update.distanceUnit,
        travelTime: update.travelTime,
        travelTimeUnit: update.travelTimeUnit,
        dangerLevel: update.dangerLevel,
        locked: update.locked,
        requirements: update.requirements ? [...update.requirements] : undefined,
      }),
    };
  });
  return { ...document, routes };
}

export function deleteRoute(document: AtlasMapDocument, routeId: string): AtlasMapDocument {
  const routes = (document.routes || []).filter((r) => r.id !== routeId);
  return { ...document, routes };
}

export function moveRoutePoint(
  document: AtlasMapDocument,
  routeId: string,
  pointIndex: number,
  x: number,
  y: number,
): AtlasMapDocument {
  const routes = (document.routes || []).map((route) => {
    if (route.id !== routeId) {
      return route;
    }
    const points = (route.points || []).map((pt, idx) => {
      if (idx !== pointIndex) {
        return pt;
      }
      return [
        clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
        clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
      ] as readonly [number, number];
    });
    return { ...route, points };
  });
  return { ...document, routes };
}

export function addRoutePoint(
  document: AtlasMapDocument,
  routeId: string,
  x: number,
  y: number,
): AtlasMapDocument {
  const routes = (document.routes || []).map((route) => {
    if (route.id !== routeId) {
      return route;
    }
    const points = [
      ...(route.points || []),
      [
        clamp(x, NORMALIZED_MIN, NORMALIZED_MAX),
        clamp(y, NORMALIZED_MIN, NORMALIZED_MAX),
      ] as readonly [number, number],
    ];
    return { ...route, points };
  });
  return { ...document, routes };
}

export function removeRoutePoint(
  document: AtlasMapDocument,
  routeId: string,
  pointIndex: number,
): AtlasMapDocument {
  const routes = (document.routes || []).map((route) => {
    if (route.id !== routeId) {
      return route;
    }
    const points = (route.points || []).filter((_, idx) => idx !== pointIndex);
    return { ...route, points };
  });
  return { ...document, routes };
}

// --- Helper details ---

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as Partial<T>;
}
