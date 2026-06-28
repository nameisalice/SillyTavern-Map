/** ExportService implementation. */

import type { AtlasMapPackage, AtlasMapPackageAsset } from '@/domain/map';
import { bytesToBase64 } from '@/repositories';
import type { AssetRepository, MapRepository } from '@/repositories';

export class ExportService {
  constructor(
    private readonly maps: MapRepository,
    private readonly assets: AssetRepository,
  ) {}

  async exportMap(mapId: string): Promise<AtlasMapPackage> {
    const map = await this.maps.load(mapId);
    if (!map) {
      throw new Error(`Map "${mapId}" not found.`);
    }
    const assets: AtlasMapPackageAsset[] = [];
    const imageAsset = await this.assets.loadAsset(map.image.assetId);
    if (!imageAsset) {
      throw new Error(`Map image asset "${map.image.assetId}" not found.`);
    }
    assets.push({
      id: imageAsset.metadata.id,
      kind: imageAsset.metadata.kind,
      mime: imageAsset.metadata.mime,
      checksum: imageAsset.metadata.checksum,
      size: imageAsset.metadata.size,
      createdAt: imageAsset.metadata.createdAt,
      data: bytesToBase64(imageAsset.data),
    });
    return {
      manifest: {
        format: 'sillytavern-atlas',
        formatVersion: 1,
        name: map.name,
        mapId: map.id,
        exportedAt: new Date().toISOString(),
      },
      map,
      assets,
    };
  }

  async exportMapJson(mapId: string): Promise<string> {
    return JSON.stringify(await this.exportMap(mapId), null, 2);
  }
}
