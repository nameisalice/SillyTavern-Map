/**
 * Bundled example map: "Southern Marches".
 *
 * Derived from the development plan (§26). Coordinates are normalized to
 * the [0, 100] range per §9.8; the viewer maps them into the image's
 * pixel space. This fixture is imported as a module so it ships inside
 * `dist/index.js` — no runtime fetch and no storage needed (storage is
 * Milestone 2).
 *
 * Routes are declared but not yet rendered (route rendering is
 * Milestone 7). They are included so the data is complete and the
 * route-domain types are exercised by a real fixture.
 */

import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasRoute } from '@/domain/route';
import bgUrl from './southern-marches-bg.svg';

/** The routes for Southern Marches (rendered in a later milestone). */
const routes: readonly AtlasRoute[] = [
  {
    id: 'route-north-tower_stone-gorge',
    name: 'North Tower to Stone Gorge',
    fromLocationId: 'north-tower',
    toLocationId: 'stone-gorge',
    bidirectional: true,
  },
  {
    id: 'route-stone-gorge_unnamed-village',
    name: 'Stone Gorge to Unnamed Village',
    fromLocationId: 'stone-gorge',
    toLocationId: 'unnamed-village',
    bidirectional: true,
  },
  {
    id: 'route-unnamed-village_vael-tor-ruins',
    name: 'Unnamed Village to Vael-Tor Ruins',
    fromLocationId: 'unnamed-village',
    toLocationId: 'vael-tor-ruins',
    bidirectional: true,
  },
  {
    id: 'route-vael-tor-ruins_moss-stone-camp',
    name: 'Vael-Tor Ruins to Moss Stone Camp',
    fromLocationId: 'vael-tor-ruins',
    toLocationId: 'moss-stone-camp',
    bidirectional: true,
  },
  {
    id: 'route-moss-stone-camp_mournwood-gate',
    name: 'Moss Stone Camp to Mournwood Gate',
    fromLocationId: 'moss-stone-camp',
    toLocationId: 'mournwood-gate',
    bidirectional: true,
  },
  {
    id: 'route-mournwood-gate_missing-point',
    name: 'Mournwood Gate to Missing Point',
    fromLocationId: 'mournwood-gate',
    toLocationId: 'missing-point',
    bidirectional: true,
  },
];

/**
 * The Southern Marches example map document. Bundled with the extension
 * for development and the first-run experience.
 */
export const SOUTHERN_MARCHES: AtlasMapDocument = {
  schemaVersion: 1,
  id: 'southern-marches',
  name: 'Southern Marches',
  description: 'A frontier region of forests, gorges, and old ruins.',
  image: {
    // Bundled SVG background; no stored blob yet (Milestone 2).
    url: bgUrl,
    width: 1600,
    height: 1000,
    mimeType: 'image/svg+xml',
  },
  defaultLocationId: 'mournwood-gate',
  locations: [
    {
      id: 'north-tower',
      name: 'North Tower',
      description: 'The final guarded border post.',
      coordinates: { x: 52, y: 12 },
      dangerLevel: 1,
      discoveredByDefault: true,
    },
    {
      id: 'stone-gorge',
      name: 'Stone Gorge',
      description: 'A narrow road watched by bandits.',
      coordinates: { x: 55, y: 29 },
      dangerLevel: 3,
      discoveredByDefault: true,
    },
    {
      id: 'unnamed-village',
      name: 'Unnamed Village',
      description: 'An isolated settlement south of Stone Gorge.',
      coordinates: { x: 40, y: 48 },
      dangerLevel: 1,
      discoveredByDefault: true,
    },
    {
      id: 'vael-tor-ruins',
      name: 'Vael-Tor Ruins',
      description: 'Crumbling walls over lethal traps.',
      coordinates: { x: 62, y: 56 },
      dangerLevel: 4,
      discoveredByDefault: true,
    },
    {
      id: 'moss-stone-camp',
      name: 'Moss Stone Camp',
      description: 'A waystation under dripping moss.',
      coordinates: { x: 70, y: 70 },
      dangerLevel: 2,
      discoveredByDefault: true,
    },
    {
      id: 'mournwood-gate',
      name: 'Mournwood Gate',
      description: 'The threshold into the deep wood.',
      coordinates: { x: 80, y: 82 },
      dangerLevel: 2,
      discoveredByDefault: true,
    },
    {
      id: 'missing-point',
      name: 'Missing Point',
      description: 'A place no map quite agrees on.',
      coordinates: { x: 90, y: 90 },
      dangerLevel: 5,
      hiddenUntilDiscovered: true,
    },
  ],
  regions: [],
  routes,
  view: {
    minZoom: -2,
    maxZoom: 2,
    initialZoom: 0,
    initialCenter: [50, 50],
  },
  theme: {
    markerStyle: 'pin',
    accentColor: '#c0392b',
    dangerColor: '#8b0000',
  },
  metadata: {
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    author: 'Atlas contributors',
    source: 'bundled-example',
  },
};
