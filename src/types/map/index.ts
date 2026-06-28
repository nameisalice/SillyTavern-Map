/**
 * Barrel for shared map types.
 *
 * Re-exports the canonical map document types from `@/domain/map` so
 * consumers that prefer a single types entry point can import them
 * here. The canonical definitions live in the domain layer.
 */

export type {
  AtlasMapDocument,
  AtlasMapImage,
  AtlasMapMetadata,
  AtlasMapTheme,
  AtlasMapView,
  MapImageMimeType,
} from '@/domain/map';
