/** AssetRepository implementation. */

import type { AtlasAsset, AtlasAssetKind, AtlasAssetMetadata } from '@/domain/map';
import type { MapImageMimeType } from '@/domain/map';
import type { StorageProvider } from '@/providers/storage';
import { nowIso, sha256Hex } from './repository-utils';

interface StoredAssetRecord {
  readonly version: 1;
  readonly metadata: AtlasAssetMetadata;
  readonly data: number[];
}

export class AssetRepository {
  constructor(private readonly storage: StorageProvider) {}

  async saveAsset(args: {
    readonly id: string;
    readonly kind: AtlasAssetKind;
    readonly mime: MapImageMimeType;
    readonly data: Uint8Array;
    readonly createdAt?: string;
  }): Promise<AtlasAssetMetadata> {
    const checksum = await sha256Hex(args.data);
    const existing = await this.findByChecksum(checksum);
    if (existing) {
      return existing;
    }
    const metadata: AtlasAssetMetadata = {
      id: args.id,
      kind: args.kind,
      mime: args.mime,
      checksum,
      size: args.data.byteLength,
      createdAt: args.createdAt ?? nowIso(),
    };
    const record: StoredAssetRecord = {
      version: 1,
      metadata,
      data: [...args.data],
    };
    await this.storage.save('assets', args.id, record);
    return metadata;
  }

  async loadAsset(id: string): Promise<AtlasAsset | null> {
    const record = await this.storage.load<StoredAssetRecord>('assets', id);
    if (!record) {
      return null;
    }
    return {
      metadata: record.metadata,
      data: new Uint8Array(record.data),
    };
  }

  async deleteAsset(id: string): Promise<void> {
    await this.storage.delete('assets', id);
  }

  async exists(id: string): Promise<boolean> {
    return this.storage.exists('assets', id);
  }

  async listAssets(): Promise<readonly AtlasAssetMetadata[]> {
    const ids = await this.storage.list('assets');
    const out: AtlasAssetMetadata[] = [];
    for (const id of ids) {
      const asset = await this.loadAsset(id);
      if (asset) {
        out.push(asset.metadata);
      }
    }
    return out;
  }

  async findByChecksum(checksum: string): Promise<AtlasAssetMetadata | null> {
    const assets = await this.listAssets();
    return assets.find((asset) => asset.checksum === checksum) ?? null;
  }
}
