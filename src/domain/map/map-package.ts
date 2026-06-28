/**
 * Portable Atlas map package format.
 *
 * M2 uses a single JSON object with embedded base64 asset data. ZIP is
 * a future enhancement; this shape is easy to validate and export now.
 */

import type { AtlasMapDocument, MapImageMimeType } from './map-document';

export interface AtlasMapPackageManifest {
  readonly format: 'sillytavern-atlas';
  readonly formatVersion: 1;
  readonly name: string;
  readonly mapId: string;
  readonly exportedAt: string;
}

export interface AtlasMapPackageAsset {
  readonly id: string;
  readonly kind: 'image' | 'thumbnail' | 'icon';
  readonly mime: MapImageMimeType;
  readonly checksum: string;
  readonly size: number;
  readonly createdAt: string;
  /** Base64 encoded binary data. */
  readonly data: string;
}

export interface AtlasMapPackage {
  readonly manifest: AtlasMapPackageManifest;
  readonly map: AtlasMapDocument;
  readonly assets: readonly AtlasMapPackageAsset[];
}
