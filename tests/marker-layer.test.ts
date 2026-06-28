/**
 * Tests for the marker layer's pure logic.
 *
 * jsdom has no real layout, so we test `buildMarkerData` — the function
 * that decides which locations render and how coordinates map — rather
 * than the Leaflet-backed `MarkerLayer` class.
 */

import { describe, expect, it } from 'vitest';

import { buildMarkerData } from '@/features/viewer/marker-layer';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';

describe('buildMarkerData', () => {
  it('renders every non-hidden location by default', () => {
    const markers = buildMarkerData(SOUTHERN_MARCHES, null, new Set());
    const ids = markers.map((m) => m.locationId);
    // Missing Point is hiddenUntilDiscovered and not discovered.
    expect(ids).not.toContain('missing-point');
    expect(ids).toHaveLength(SOUTHERN_MARCHES.locations.length - 1);
  });

  it('includes a hidden location once it is discovered', () => {
    const markers = buildMarkerData(SOUTHERN_MARCHES, null, new Set(['missing-point']));
    const ids = markers.map((m) => m.locationId);
    expect(ids).toContain('missing-point');
    const hidden = markers.find((m) => m.locationId === 'missing-point');
    expect(hidden?.hidden).toBe(true);
  });

  it('marks the current location distinctly', () => {
    const markers = buildMarkerData(SOUTHERN_MARCHES, 'mournwood-gate', new Set());
    const current = markers.find((m) => m.locationId === 'mournwood-gate');
    expect(current?.current).toBe(true);
    const other = markers.find((m) => m.locationId === 'north-tower');
    expect(other?.current).toBe(false);
  });

  it('always renders the current location even if hidden', () => {
    // Set the hidden one as current: it must still render.
    const markers = buildMarkerData(SOUTHERN_MARCHES, 'missing-point', new Set());
    const ids = markers.map((m) => m.locationId);
    expect(ids).toContain('missing-point');
  });

  it('maps normalized coordinates into pixel space with y inverted', () => {
    const markers = buildMarkerData(SOUTHERN_MARCHES, null, new Set());
    const north = markers.find((m) => m.locationId === 'north-tower')!;
    // x=52 normalized on width 1600 -> lng ~832.
    expect(north.lng).toBeCloseTo((52 / 100) * 1600, 1);
    // y=12 normalized on height 1000 -> lat = 1000 - 120 = 880.
    expect(north.lat).toBeCloseTo(1000 - (12 / 100) * 1000, 1);
  });
});
