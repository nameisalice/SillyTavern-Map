/**
 * Canonical map document types.
 *
 * Derived from the development plan (§6.1). These are the data contracts
 * the whole extension speaks in: validators, services, storage, and the
 * viewer all reference them. Pure type declarations — no logic.
 */

/** MIME types accepted for map background images. */
export type MapImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';

/** Visual style hints a map document may carry. */
export interface AtlasMapTheme {
  readonly markerStyle?: 'pin' | 'dot' | 'crest';
  readonly accentColor?: string;
  readonly dangerColor?: string;
}

/** View configuration for the map canvas. */
export interface AtlasMapView {
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly initialZoom: number;
  readonly initialCenter: readonly [number, number];
}

/**
 * Image reference inside a map document.
 *
 * In the full storage model (Milestone 2+), `assetId` points at a blob
 * in the localforage asset store. For bundled or inlined images that
 * have no stored blob yet, `url` carries a resolvable URL instead.
 * Exactly one of the two is expected to be set; consumers prefer
 * `url` when present and fall back to resolving `assetId` via storage.
 */
export interface AtlasMapImage {
  readonly assetId?: string;
  readonly url?: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: MapImageMimeType;
  readonly checksum?: string;
}

/** Metadata block for a map document. */
export interface AtlasMapMetadata {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author?: string;
  readonly source?: string;
}

/**
 * The versioned, canonical map document. This is the single source of
 * truth for a map's structure.
 */
export interface AtlasMapDocument {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly image: AtlasMapImage;
  readonly parentMapId?: string;
  readonly defaultLocationId?: string;
  readonly locations: readonly AtlasLocation[];
  readonly regions: readonly AtlasRegion[];
  readonly routes: readonly AtlasRoute[];
  readonly view: AtlasMapView;
  readonly theme?: AtlasMapTheme;
  readonly metadata: AtlasMapMetadata;
}

// Forward references to sibling domain modules. The concrete interfaces
// are declared in their own files; importing them here keeps a single
// `import type { AtlasMapDocument }` entry point for consumers.
import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';
