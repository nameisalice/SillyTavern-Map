/**
 * Barrel for the map domain module.
 */

export { ATLAS_MAP_DOCUMENT_VERSION } from './map-document';
export type {
  AtlasMapDocument,
  AtlasMapImage,
  AtlasMapMetadata,
  AtlasMapTheme,
  AtlasMapView,
  MapImageMimeType,
  UnknownMapDocument,
} from './map-document';
export type { AtlasAsset, AtlasAssetKind, AtlasAssetMetadata } from './asset';
export type { AtlasViewerState, AtlasViewerLayer } from './viewer-state';
export type { AtlasMapIndexEntry } from './map-index';
export type { AtlasMapPackage, AtlasMapPackageAsset, AtlasMapPackageManifest } from './map-package';
export type { ValidationError, ValidationResult } from './validation';
export { validateMapDocument } from './validation';
export { upgradeDocument } from './migration';
