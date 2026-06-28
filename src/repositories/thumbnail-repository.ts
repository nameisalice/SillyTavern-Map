/** ThumbnailRepository implementation.
 *
 * M2 stores thumbnail assets and metadata. Actual thumbnail generation
 * from images is intentionally deferred; callers provide bytes.
 */

import type { AtlasAssetMetadata, MapImageMimeType } from '@/domain/map';
import type { AssetRepository } from './asset-repository';

export class ThumbnailRepository {
  constructor(private readonly assets: AssetRepository) {}

  async saveThumbnail(args: {
    readonly id: string;
    readonly mime: MapImageMimeType;
    readonly data: Uint8Array;
  }): Promise<AtlasAssetMetadata> {
    return this.assets.saveAsset({
      id: args.id,
      kind: 'thumbnail',
      mime: args.mime,
      data: args.data,
    });
  }

  async loadThumbnail(id: string): Promise<Uint8Array | null> {
    const asset = await this.assets.loadAsset(id);
    return asset?.data ?? null;
  }

  async deleteThumbnail(id: string): Promise<void> {
    await this.assets.deleteAsset(id);
  }
}
