/**
 * Validation tests for the bundled example map fixture.
 *
 * Mirrors the blueprint-validation intent (plan §9.8) at the fixture
 * level: the bundled example must itself be well-formed so the viewer
 * has a trustworthy input.
 */

import { describe, expect, it } from 'vitest';

import { SOUTHERN_MARCHES } from '@/examples/southern-marches';

describe('Southern Marches fixture', () => {
  it('uses schema version 1', () => {
    expect(SOUTHERN_MARCHES.schemaVersion).toBe(1);
  });

  it('has a resolvable image (url) and finite dimensions', () => {
    expect(SOUTHERN_MARCHES.image.url).toBeTruthy();
    expect(Number.isFinite(SOUTHERN_MARCHES.image.width)).toBe(true);
    expect(Number.isFinite(SOUTHERN_MARCHES.image.height)).toBe(true);
  });

  it('has unique location ids', () => {
    const ids = SOUTHERN_MARCHES.locations.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has finite, in-range normalized coordinates', () => {
    for (const loc of SOUTHERN_MARCHES.locations) {
      expect(Number.isFinite(loc.coordinates.x)).toBe(true);
      expect(Number.isFinite(loc.coordinates.y)).toBe(true);
      expect(loc.coordinates.x).toBeGreaterThanOrEqual(0);
      expect(loc.coordinates.x).toBeLessThanOrEqual(100);
      expect(loc.coordinates.y).toBeGreaterThanOrEqual(0);
      expect(loc.coordinates.y).toBeLessThanOrEqual(100);
    }
  });

  it('declares the seven expected locations', () => {
    const names = SOUTHERN_MARCHES.locations.map((l) => l.name);
    expect(names).toEqual([
      'North Tower',
      'Stone Gorge',
      'Unnamed Village',
      'Vael-Tor Ruins',
      'Moss Stone Camp',
      'Mournwood Gate',
      'Missing Point',
    ]);
  });

  it('declares the six expected routes with valid endpoints', () => {
    const ids = new Set(SOUTHERN_MARCHES.locations.map((l) => l.id));
    expect(SOUTHERN_MARCHES.routes).toHaveLength(6);
    for (const route of SOUTHERN_MARCHES.routes) {
      expect(ids.has(route.fromLocationId)).toBe(true);
      expect(ids.has(route.toLocationId)).toBe(true);
    }
  });

  it('points the default location at an existing id', () => {
    const ids = SOUTHERN_MARCHES.locations.map((l) => l.id);
    expect(ids).toContain(SOUTHERN_MARCHES.defaultLocationId);
  });
});
