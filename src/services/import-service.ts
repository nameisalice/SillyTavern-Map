/** ImportService implementation. */

import type { AtlasMapPackage } from '@/domain/map';
import { upgradeDocument, validateMapDocument } from '@/domain/map';
import { base64ToBytes, sha256Hex } from '@/repositories';
import type { AssetRepository, MapRepository } from '@/repositories';

export class ImportService {
  constructor(
    private readonly maps: MapRepository,
    private readonly assets: AssetRepository,
  ) {}

  async importPackage(pack: AtlasMapPackage): Promise<{ readonly mapId: string }> {
    this.validatePackageShape(pack);
    const map = upgradeDocument(pack.map);
    const validation = validateMapDocument(map);
    if (!validation.ok) {
      throw new Error(validation.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    }
    if (await this.maps.exists(map.id)) {
      throw new Error(`Map "${map.id}" already exists. Import never overwrites automatically.`);
    }

    const imageAsset = pack.assets.find((asset) => asset.id === map.image.assetId);
    if (!imageAsset) {
      throw new Error(`Package is missing image asset "${map.image.assetId}".`);
    }

    for (const asset of pack.assets) {
      const bytes = base64ToBytes(asset.data);
      const checksum = await sha256Hex(bytes);
      if (checksum !== asset.checksum) {
        throw new Error(`Asset "${asset.id}" checksum mismatch.`);
      }
      if (bytes.byteLength !== asset.size) {
        throw new Error(`Asset "${asset.id}" size mismatch.`);
      }
      await this.assets.saveAsset({
        id: asset.id,
        kind: asset.kind,
        mime: asset.mime,
        data: bytes,
        createdAt: asset.createdAt,
      });
    }

    await this.maps.save(map);
    return { mapId: map.id };
  }

  async importJson(json: string): Promise<{ readonly mapId: string }> {
    return this.importPackage(JSON.parse(json) as AtlasMapPackage);
  }

  private validatePackageShape(pack: AtlasMapPackage): void {
    if (pack.manifest?.format !== 'sillytavern-atlas') {
      throw new Error('Invalid Atlas package format.');
    }
    if (pack.manifest.formatVersion !== 1) {
      throw new Error(`Unsupported Atlas package version ${pack.manifest.formatVersion}.`);
    }
    if (!Array.isArray(pack.assets)) {
      throw new Error('Package assets must be an array.');
    }
  }
}
