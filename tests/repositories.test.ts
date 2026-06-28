import { describe, expect, it } from 'vitest';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { AssetRepository, MapRepository, ViewerStateRepository } from '@/repositories';
import { MemoryStorageProvider } from './storage-helpers';

describe('MapRepository', () => {
  it('saves and loads a map without losing information', async () => {
    const repo = new MapRepository(new MemoryStorageProvider());
    await repo.save(SOUTHERN_MARCHES);
    await expect(repo.load(SOUTHERN_MARCHES.id)).resolves.toEqual(SOUTHERN_MARCHES);
  });

  it('maintains a lightweight map index', async () => {
    const repo = new MapRepository(new MemoryStorageProvider());
    await repo.save(SOUTHERN_MARCHES);
    const index = await repo.listIndex();
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ id: SOUTHERN_MARCHES.id, name: SOUTHERN_MARCHES.name });
  });

  it('renames and deletes maps', async () => {
    const repo = new MapRepository(new MemoryStorageProvider());
    await repo.save(SOUTHERN_MARCHES);
    await repo.rename(SOUTHERN_MARCHES.id, 'Renamed');
    expect((await repo.load(SOUTHERN_MARCHES.id))?.name).toBe('Renamed');
    await repo.delete(SOUTHERN_MARCHES.id);
    expect(await repo.load(SOUTHERN_MARCHES.id)).toBeNull();
  });
});

describe('AssetRepository', () => {
  it('stores metadata and deduplicates by checksum', async () => {
    const repo = new AssetRepository(new MemoryStorageProvider());
    const first = await repo.saveAsset({
      id: 'image-1',
      kind: 'image',
      mime: 'image/png',
      data: new Uint8Array([1, 2, 3]),
    });
    const duplicate = await repo.saveAsset({
      id: 'image-2',
      kind: 'image',
      mime: 'image/png',
      data: new Uint8Array([1, 2, 3]),
    });
    expect(duplicate.id).toBe(first.id);
    expect(first.size).toBe(3);
    expect(first.checksum).toHaveLength(64);
  });
});

describe('ViewerStateRepository', () => {
  it('persists viewer state independently from map documents', async () => {
    const storage = new MemoryStorageProvider();
    const maps = new MapRepository(storage);
    const states = new ViewerStateRepository(storage);
    await maps.save(SOUTHERN_MARCHES);
    await states.save({
      version: 1,
      mapId: SOUTHERN_MARCHES.id,
      zoom: 1,
      center: [25, 75],
      selectedMarkerId: 'north-tower',
      openedPopupLocationId: 'north-tower',
      currentLayer: 'locations',
      fullscreen: false,
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect((await states.load(SOUTHERN_MARCHES.id))?.selectedMarkerId).toBe('north-tower');
    expect((await maps.load(SOUTHERN_MARCHES.id))?.id).toBe(SOUTHERN_MARCHES.id);
  });
});
