/**
 * Map document validation pipeline.
 *
 * Validators reject malformed documents and never repair data silently.
 * Callers decide how to surface the returned error list.
 */

import type { AtlasMapDocument } from './map-document';
import { ATLAS_MAP_DOCUMENT_VERSION } from './map-document';

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly ValidationError[];
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function error(path: string, message: string): ValidationError {
  return { path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/** Validates an unknown value as an AtlasMapDocument. */
export function validateMapDocument(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: [error('$', 'Document must be an object.')] };
  }

  if (value['version'] !== ATLAS_MAP_DOCUMENT_VERSION) {
    errors.push(error('version', `Document version must be ${ATLAS_MAP_DOCUMENT_VERSION}.`));
  }
  if (typeof value['id'] !== 'string' || !validId(value['id'])) {
    errors.push(error('id', 'Map id must be a lowercase slug.'));
  }
  if (typeof value['name'] !== 'string' || value['name'].trim().length === 0) {
    errors.push(error('name', 'Map name is required.'));
  }

  const image = value['image'];
  if (!isRecord(image)) {
    errors.push(error('image', 'Image reference is required.'));
  } else {
    if (typeof image['assetId'] !== 'string' || !validId(image['assetId'])) {
      errors.push(error('image.assetId', 'Image assetId must be a lowercase slug.'));
    }
    if (!finiteNumber(image['width']) || image['width'] <= 0) {
      errors.push(error('image.width', 'Image width must be a positive finite number.'));
    }
    if (!finiteNumber(image['height']) || image['height'] <= 0) {
      errors.push(error('image.height', 'Image height must be a positive finite number.'));
    }
  }

  const locations = Array.isArray(value['locations']) ? value['locations'] : null;
  if (!locations) {
    errors.push(error('locations', 'Locations must be an array.'));
  }
  const locationIds = new Set<string>();
  if (locations) {
    locations.forEach((loc, index) => {
      const path = `locations[${index}]`;
      if (!isRecord(loc)) {
        errors.push(error(path, 'Location must be an object.'));
        return;
      }
      const id = loc['id'];
      if (typeof id !== 'string' || !validId(id)) {
        errors.push(error(`${path}.id`, 'Location id must be a lowercase slug.'));
      } else if (locationIds.has(id)) {
        errors.push(error(`${path}.id`, `Duplicate location id "${id}".`));
      } else {
        locationIds.add(id);
      }
      const coordinates = loc['coordinates'];
      if (!isRecord(coordinates)) {
        errors.push(error(`${path}.coordinates`, 'Coordinates are required.'));
      } else {
        const x = coordinates['x'];
        const y = coordinates['y'];
        if (!finiteNumber(x) || x < 0 || x > 100) {
          errors.push(error(`${path}.coordinates.x`, 'x must be finite and between 0 and 100.'));
        }
        if (!finiteNumber(y) || y < 0 || y > 100) {
          errors.push(error(`${path}.coordinates.y`, 'y must be finite and between 0 and 100.'));
        }
      }
    });
  }

  const routes = Array.isArray(value['routes']) ? value['routes'] : null;
  if (!routes) {
    errors.push(error('routes', 'Routes must be an array.'));
  } else {
    const routeIds = new Set<string>();
    routes.forEach((route, index) => {
      const path = `routes[${index}]`;
      if (!isRecord(route)) {
        errors.push(error(path, 'Route must be an object.'));
        return;
      }
      const id = route['id'];
      if (typeof id !== 'string' || !validId(id)) {
        errors.push(error(`${path}.id`, 'Route id must be a lowercase slug.'));
      } else if (routeIds.has(id)) {
        errors.push(error(`${path}.id`, `Duplicate route id "${id}".`));
      } else {
        routeIds.add(id);
      }
      const from = route['fromLocationId'];
      const to = route['toLocationId'];
      if (typeof from !== 'string' || !locationIds.has(from)) {
        errors.push(
          error(`${path}.fromLocationId`, 'Route fromLocationId must reference a location.'),
        );
      }
      if (typeof to !== 'string' || !locationIds.has(to)) {
        errors.push(error(`${path}.toLocationId`, 'Route toLocationId must reference a location.'));
      }
    });
  }

  const regions = Array.isArray(value['regions']) ? value['regions'] : null;
  if (!regions) {
    errors.push(error('regions', 'Regions must be an array.'));
  } else {
    const regionIds = new Set<string>();
    regions.forEach((region, index) => {
      const path = `regions[${index}]`;
      if (!isRecord(region)) {
        errors.push(error(path, 'Region must be an object.'));
        return;
      }
      const id = region['id'];
      if (typeof id !== 'string' || !validId(id)) {
        errors.push(error(`${path}.id`, 'Region id must be a lowercase slug.'));
      } else if (regionIds.has(id)) {
        errors.push(error(`${path}.id`, `Duplicate region id "${id}".`));
      } else {
        regionIds.add(id);
      }
      if (!Array.isArray(region['polygon'])) {
        errors.push(error(`${path}.polygon`, 'Region polygon must be an array.'));
      }
    });
  }

  const defaultLocationId = value['defaultLocationId'];
  if (
    defaultLocationId !== undefined &&
    (typeof defaultLocationId !== 'string' || !locationIds.has(defaultLocationId))
  ) {
    errors.push(error('defaultLocationId', 'Default location must reference a location.'));
  }

  return { ok: errors.length === 0, errors };
}

/** Asserts that a value is a valid AtlasMapDocument. */
export function assertValidMapDocument(value: unknown): asserts value is AtlasMapDocument {
  const result = validateMapDocument(value);
  if (!result.ok) {
    throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  }
}
