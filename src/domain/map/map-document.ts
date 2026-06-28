/**
 * Canonical map document types.
 *
 * Milestone 2 establishes `AtlasMapDocument` as the single source of
 * truth for every map. It is a pure, serializable data structure: no
 * runtime objects, no file paths, no Leaflet instances, and no mutable
 * references. Maps reference images through asset ids only.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';
import type { AtlasMapType } from '@/domain/generation';

/** Current canonical map document version. */
export const ATLAS_MAP_DOCUMENT_VERSION = 1 as const;

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
 * Persistent maps reference image assets by id. Bundled example maps may
 * carry an optional `url` during bootstrapping, but import/export and
 * repository persistence always normalize to an `assetId` reference.
 */
export interface AtlasMapImage {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: MapImageMimeType;
  readonly checksum?: string;
  /** Optional bundled fallback URL used only by built-in examples. */
  readonly url?: string;
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
  /** Canonical document version. */
  readonly version: typeof ATLAS_MAP_DOCUMENT_VERSION;
  readonly id: string;
  readonly name: string;
  readonly type: AtlasMapType;
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

/**
 * Runtime unknown document accepted by the migration system. Legacy M1
 * data may still contain `schemaVersion`; validators reject it after
 * migration.
 */
export type UnknownMapDocument = Record<string, unknown>;
