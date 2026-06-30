/**
 * Editor unit tests.
 *
 * Pure logic only — no Leaflet, no host. Covers coordinate conversion,
 * id generation, marker operations, undo/redo, dirty state, default-
 * location cleanup, and unsaved-change decision logic.
 */

import { describe, expect, it, vi } from 'vitest';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import {
  EditorHistory,
  PropertyPanel,
  type EditorSnapshot,
  addMarker,
  addRegion,
  addRegionPoint,
  addRoute,
  deleteMarker,
  editMarker,
  moveRegionPoint,
  latLngToNormalized,
  moveMarker,
  nameToSlug,
  removeRegionPoint,
  setDefaultLocation,
  uniqueLocationId,
  uniqueMapId,
} from '@/features/editor';
import { resolveUnsavedChange } from '@/features/editor';
import { cloneJson } from '@/repositories/repository-utils';
import type { AtlasMapDocument } from '@/domain/map';

function clone(): AtlasMapDocument {
  return JSON.parse(JSON.stringify(SOUTHERN_MARCHES)) as AtlasMapDocument;
}

function emptyDraft(): AtlasMapDocument {
  const doc = clone();
  return { ...doc, locations: [], routes: [], defaultLocationId: undefined };
}

describe('coordinate-utils', () => {
  it('inverts normalizedToLatLng with y flipped and clamped', () => {
    const { x, y } = latLngToNormalized(500, 800, 1600, 1000);
    // lng 800 / 1600 = 50; lat 500 => (1000-500)/1000 = 50
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(50, 5);
  });

  it('clamps out-of-range clicks to [0, 100]', () => {
    // lng 99999 -> x 100; lat 2000 (well below the image) -> y 0.
    const { x, y } = latLngToNormalized(2000, 99999, 1600, 1000);
    expect(x).toBe(100);
    expect(y).toBe(0);
  });

  it('slugs names and falls back to "location" for empty', () => {
    expect(nameToSlug('North Gate!')).toBe('north-gate');
    expect(nameToSlug('   ')).toBe('location');
  });

  it('generates unique location ids with suffixes', () => {
    const existing = [{ id: 'north-gate' }, { id: 'north-gate-2' }];
    expect(uniqueLocationId('North Gate', existing)).toBe('north-gate-3');
    expect(uniqueLocationId('Camp', existing)).toBe('camp');
  });

  it('generates unique map ids', () => {
    expect(uniqueMapId('Southern Marches', [{ id: 'southern-marches' }])).toBe(
      'southern-marches-2',
    );
  });
});

describe('marker operations', () => {
  it('adds a marker with a unique id and clamped coords', () => {
    const doc = emptyDraft();
    const { document, locationId } = addMarker(doc, { name: 'Tower', x: 200, y: -5 });
    expect(locationId).toBe('tower');
    expect(document.locations).toHaveLength(1);
    expect(document.locations[0].coordinates.x).toBe(100);
    expect(document.locations[0].coordinates.y).toBe(0);
  });

  it('edits marker fields immutably', () => {
    const doc = clone();
    const original = doc.locations[0];
    const updated = editMarker(doc, original.id, {
      name: 'Renamed',
      dangerLevel: 5,
      aliases: ['old'],
    });
    const edited = updated.locations.find((l) => l.id === original.id)!;
    expect(edited.name).toBe('Renamed');
    expect(edited.dangerLevel).toBe(5);
    expect(edited.aliases).toEqual(['old']);
    expect(doc.locations[0].name).toBe(original.name);
  });

  it('moves a marker with clamped coordinates', () => {
    const doc = clone();
    const id = doc.locations[0].id;
    const moved = moveMarker(doc, id, 150, -10);
    expect(moved.locations[0].coordinates).toEqual({ x: 100, y: 0 });
  });

  it('deleting the default location clears defaultLocationId', () => {
    const doc = clone();
    const defaultId = doc.defaultLocationId!;
    const { document, clearedDefault } = deleteMarker(doc, defaultId);
    expect(clearedDefault).toBe(true);
    expect(document.defaultLocationId).toBeUndefined();
    expect(document.locations.find((l) => l.id === defaultId)).toBeUndefined();
  });

  it('deleting a route-referenced location keeps the route (validation catches it)', () => {
    const doc = clone();
    const id = doc.locations[0].id;
    const { document } = deleteMarker(doc, id);
    // A route still references the deleted location.
    expect(document.routes.some((r) => r.fromLocationId === id || r.toLocationId === id)).toBe(
      true,
    );
  });

  it('sets the default location immutably', () => {
    const doc = emptyDraft();
    const { locationId } = addMarker(doc, { name: 'Camp', x: 10, y: 10 });
    const withDefault = setDefaultLocation(doc, locationId);
    expect(withDefault.defaultLocationId).toBe(locationId);
    expect(doc.defaultLocationId).toBeUndefined();
  });
});

describe('region and route operations', () => {
  it('adds and edits region vertices with clamped coordinates', () => {
    const doc = emptyDraft();
    const { document, regionId } = addRegion(doc, {
      name: 'Old Woods',
      polygon: [
        [-10, 10],
        [40, 20],
        [20, 140],
      ],
    });

    expect(regionId).toBe('old-woods');
    expect(document.regions[0].polygon).toEqual([
      [0, 10],
      [40, 20],
      [20, 100],
    ]);

    const moved = moveRegionPoint(document, regionId, 1, 120, -5);
    expect(moved.regions[0].polygon[1]).toEqual([100, 0]);

    const added = addRegionPoint(moved, regionId, 30, 30);
    expect(added.regions[0].polygon).toHaveLength(4);

    const removed = removeRegionPoint(added, regionId, 0);
    expect(removed.regions[0].polygon).toHaveLength(3);

    const minimum = removeRegionPoint(removed, regionId, 0);
    expect(minimum.regions[0].polygon).toHaveLength(3);
  });

  it('adds routes with stable unique ids and keeps endpoints explicit', () => {
    const doc = emptyDraft();
    const first = addMarker(doc, { name: 'Gate', x: 20, y: 30 });
    const second = addMarker(first.document, { name: 'Keep', x: 80, y: 60 });

    const route = addRoute(second.document, {
      fromLocationId: first.locationId,
      toLocationId: second.locationId,
      bidirectional: true,
      distance: 4,
      distanceUnit: 'km',
    });
    const duplicate = addRoute(route.document, {
      fromLocationId: first.locationId,
      toLocationId: second.locationId,
      bidirectional: false,
    });

    expect(route.routeId).toBe('route-gate_keep');
    expect(duplicate.routeId).toBe('route-gate_keep-2');
    expect(duplicate.document.routes[0]).toMatchObject({
      fromLocationId: 'gate',
      toLocationId: 'keep',
      bidirectional: true,
    });
  });
});

describe('editor history', () => {
  function snap(name: string, sel?: string): EditorSnapshot {
    const document = { ...clone(), name } as AtlasMapDocument;
    return { document, selectedItemId: sel, selectedType: sel ? 'location' : undefined };
  }

  it('undo and redo restore prior states', () => {
    const history = new EditorHistory();
    history.initialize(clone(), undefined);
    history.push(snap('a').document, 'a');
    history.push(snap('b').document, 'b');
    expect(history.canUndo()).toBe(true);
    const undone = history.undo()!;
    expect(undone.document.name).toBe('a');
    expect(undone.selectedItemId).toBe('a');
    expect(history.canRedo()).toBe(true);
    const redone = history.redo()!;
    expect(redone.document.name).toBe('b');
  });

  it('clears redo after a new command', () => {
    const history = new EditorHistory();
    history.initialize(clone(), undefined);
    history.push(snap('a').document, undefined);
    history.undo();
    expect(history.canRedo()).toBe(true);
    history.push(snap('b').document, undefined);
    expect(history.canRedo()).toBe(false);
  });

  it('bounds history to the limit', () => {
    const history = new EditorHistory(5);
    history.initialize(clone(), undefined);
    for (let i = 0; i < 20; i += 1) {
      history.push(snap(`n${i}`).document, undefined);
    }
    expect(history.canUndo()).toBe(true);
    history.undo();
    expect(history.canRedo()).toBe(true);
  });
});

describe('unsaved-change decision logic', () => {
  it('proceeds without saving when not dirty', () => {
    expect(resolveUnsavedChange(false, null)).toEqual({ proceed: true, save: false });
  });

  it('saves when the user chooses save', () => {
    expect(resolveUnsavedChange(true, 'save')).toEqual({ proceed: true, save: true });
  });

  it('discards when the user chooses discard', () => {
    expect(resolveUnsavedChange(true, 'discard')).toEqual({ proceed: true, save: false });
  });

  it('cancels when the user chooses cancel or null', () => {
    expect(resolveUnsavedChange(true, 'cancel')).toEqual({ proceed: false, save: false });
    expect(resolveUnsavedChange(true, null)).toEqual({ proceed: false, save: false });
  });
});

describe('property panel UI', () => {
  it('keeps one stable container and emits edits after re-render', () => {
    const host = document.createElement('div');
    host.className = 'st-atlas__property-panel';
    document.body.append(host);
    const onChange = vi.fn();
    const panel = new PropertyPanel(host, onChange);
    const location = clone().locations[0];

    panel.renderLocation(location, false);
    const firstContainer = document.querySelector('.st-atlas__property-panel');
    expect(firstContainer).toBe(host);
    host.querySelector<HTMLInputElement>('[name="name"]')!.value = 'Renamed Gate';
    host
      .querySelector<HTMLInputElement>('[name="name"]')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'location',
        location: expect.objectContaining({ name: 'Renamed Gate' }),
      }),
    );

    panel.renderRegion(clone().regions[0] ?? {
      id: 'test-region',
      name: 'Test Region',
      polygon: [
        [10, 10],
        [20, 10],
        [10, 20],
      ],
    });
    expect(document.querySelector('.st-atlas__property-panel')).toBe(host);
    host.querySelector<HTMLInputElement>('[name="name"]')!.value = 'Renamed Region';
    host
      .querySelector<HTMLInputElement>('[name="name"]')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'region',
        region: expect.objectContaining({ name: 'Renamed Region' }),
      }),
    );
  });
});

describe('repository-backed save/open round trip', () => {
  it('saves a draft through MapDraftService and reloads it via MapRepository', async () => {
    const { MapRepository, AssetRepository } = await import('@/repositories');
    const { MapDraftService } = await import('@/services/map-draft-service');
    const { MemoryStorageProvider } = await import('./storage-helpers');

    const storage = new MemoryStorageProvider();
    const maps = new MapRepository(storage);
    const assets = new AssetRepository(storage);
    const draftService = new MapDraftService(maps, assets);

    // Seed the background asset the document references.
    await assets.saveAsset({
      id: SOUTHERN_MARCHES.image.assetId,
      kind: 'image',
      mime: SOUTHERN_MARCHES.image.mimeType,
      data: new Uint8Array([1, 2, 3, 4]),
    });

    const draft = draftService.buildDraft({
      name: 'Test Map',
      type: 'city',
      imageAssetId: SOUTHERN_MARCHES.image.assetId,
      imageWidth: 800,
      imageHeight: 600,
      imageMimeType: 'image/png',
    });
    const withMarker = addMarker(cloneJson(draft), { name: 'Gate', x: 20, y: 30 });
    const withDefault = setDefaultLocation(withMarker.document, withMarker.locationId);
    const saved = await draftService.save(withDefault);

    // updatedAt is touched on save; createdAt is preserved from the draft.
    expect(saved.metadata.updatedAt >= saved.metadata.createdAt).toBe(true);
    expect(saved.locations).toHaveLength(1);

    // A second save preserves the original createdAt.
    const firstCreatedAt = saved.metadata.createdAt;
    const reSaved = await draftService.save(saved);
    expect(reSaved.metadata.createdAt).toBe(firstCreatedAt);

    const reloaded = await maps.load(saved.id);
    expect(reloaded?.locations[0].name).toBe('Gate');
    expect(reloaded?.defaultLocationId).toBe(withMarker.locationId);
  });
});
