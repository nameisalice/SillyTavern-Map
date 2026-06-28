import { describe, expect, it } from 'vitest';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { AssetRepository, MapRepository } from '@/repositories';
import { ExportService, ImportService } from '@/services';
import { MemoryStorageProvider } from './storage-helpers';

describe('import/export', () => {
  it('round-trips a map package and preserves data integrity', async () => {
    const sourceStorage = new MemoryStorageProvider();
    const sourceMaps = new MapRepository(sourceStorage);
    const sourceAssets = new AssetRepository(sourceStorage);
    await sourceAssets.saveAsset({
      id: SOUTHERN_MARCHES.image.assetId,
      kind: 'image',
      mime: SOUTHERN_MARCHES.image.mimeType,
      data: new Uint8Array([9, 8, 7]),
    });
    await sourceMaps.save(SOUTHERN_MARCHES);

    const exported = await new ExportService(sourceMaps, sourceAssets).exportMap(
      SOUTHERN_MARCHES.id,
    );

    const targetStorage = new MemoryStorageProvider();
    const targetMaps = new MapRepository(targetStorage);
    const targetAssets = new AssetRepository(targetStorage);
    await new ImportService(targetMaps, targetAssets).importPackage(exported);

    expect(await targetMaps.load(SOUTHERN_MARCHES.id)).toEqual(SOUTHERN_MARCHES);
    expect((await targetAssets.loadAsset(SOUTHERN_MARCHES.image.assetId))?.data).toEqual(
      new Uint8Array([9, 8, 7]),
    );
  });

  it('never overwrites an existing map on import', async () => {
    const storage = new MemoryStorageProvider();
    const maps = new MapRepository(storage);
    const assets = new AssetRepository(storage);
    await maps.save(SOUTHERN_MARCHES);
    const pack = {
      manifest: {
        format: 'sillytavern-atlas' as const,
        formatVersion: 1 as const,
        name: SOUTHERN_MARCHES.name,
        mapId: SOUTHERN_MARCHES.id,
        exportedAt: '2025-01-01T00:00:00.000Z',
      },
      map: SOUTHERN_MARCHES,
      assets: [],
    };
    await expect(new ImportService(maps, assets).importPackage(pack)).rejects.toThrow(
      /already exists/,
    );
  });
});
