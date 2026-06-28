/**
 * Asset domain model.
 *
 * Maps reference assets by id, never by file path. Asset metadata is
 * persisted separately from binary data so map library screens can list
 * thumbnails without loading full-size images.
 */

import type { MapImageMimeType } from './map-document';

/** Supported asset categories. */
export type AtlasAssetKind = 'image' | 'thumbnail' | 'icon';

/** Metadata stored for every asset. */
export interface AtlasAssetMetadata {
  readonly id: string;
  readonly kind: AtlasAssetKind;
  readonly mime: MapImageMimeType;
  readonly checksum: string;
  readonly size: number;
  readonly createdAt: string;
}

/** Asset metadata + binary bytes. */
export interface AtlasAsset {
  readonly metadata: AtlasAssetMetadata;
  readonly data: Uint8Array;
}
