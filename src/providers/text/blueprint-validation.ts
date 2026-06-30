import type { AtlasMapBlueprint } from './text-provider';

export interface BlueprintValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function validateMapBlueprint(value: unknown): BlueprintValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['Blueprint must be an object.'] };
  }
  if (value['schemaVersion'] !== 1) {
    errors.push('schemaVersion must be 1.');
  }
  if (typeof value['name'] !== 'string' || value['name'].trim().length === 0) {
    errors.push('name is required.');
  }
  if (typeof value['type'] !== 'string' || value['type'].trim().length === 0) {
    errors.push('type is required.');
  }
  const locations = value['locations'];
  if (!Array.isArray(locations)) {
    errors.push('locations must be an array.');
  } else {
    const ids = new Set<string>();
    locations.forEach((location, index) => {
      if (!isRecord(location)) {
        errors.push(`locations[${index}] must be an object.`);
        return;
      }
      const id = location['id'];
      if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
        errors.push(`locations[${index}].id must be a lowercase slug.`);
      } else if (ids.has(id)) {
        errors.push(`Duplicate location id "${id}".`);
      } else {
        ids.add(id);
      }
      if (typeof location['name'] !== 'string' || location['name'].trim().length === 0) {
        errors.push(`locations[${index}].name is required.`);
      }
      for (const key of ['x', 'y'] as const) {
        const coord = location[key];
        if (typeof coord !== 'number' || !Number.isFinite(coord) || coord < 0 || coord > 100) {
          errors.push(`locations[${index}].${key} must be between 0 and 100.`);
        }
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

export function assertValidMapBlueprint(value: unknown): asserts value is AtlasMapBlueprint {
  const result = validateMapBlueprint(value);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
