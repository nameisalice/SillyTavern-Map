/**
 * Location and map id generation.
 *
 * Pure domain logic: converts free-form names into lowercase slugs and
 * generates unique ids against an existing set. Lives in the domain
 * layer so both services and features can use it without an upward
 * dependency.
 */

import type { AtlasLocation } from './location';

/**
 * Converts a free-form name into a lowercase slug used as the base for
 * a location or map id. Non-alphanumerics become `-`; leading/trailing
 * dashes are stripped; empty input falls back to `location`.
 */
export function nameToSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'location';
}

/**
 * Generates a unique location id from a name, appending `-2`, `-3`, ...
 * when the base slug is already used.
 */
export function uniqueLocationId(
  name: string,
  existing: readonly (AtlasLocation | { id: string })[],
): string {
  const base = nameToSlug(name);
  const used = new Set(existing.map((item) => item.id));
  if (!used.has(base)) {
    return base;
  }
  return suffixUntilUnique(base, used);
}

/** Generates a unique map id from a map name. */
export function uniqueMapId(name: string, existing: readonly { id: string }[]): string {
  const base = nameToSlug(name);
  const used = new Set(existing.map((item) => item.id));
  if (!used.has(base)) {
    return base;
  }
  return suffixUntilUnique(base, used);
}

function suffixUntilUnique(base: string, used: Set<string>): string {
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
