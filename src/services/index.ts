/**
 * Barrel for the Atlas services layer.
 *
 * Services coordinate everything. They sit above repositories/domain and
 * below features. Services never know the storage implementation.
 */

export type { GenerationRequest, GenerationService } from './generation-service';
export { ExportService } from './export-service';
export { ImageUploadService, MAX_IMAGE_SIZE_BYTES } from './image-upload-service';
export { ImportService } from './import-service';
export { MapDraftService } from './map-draft-service';
export { MapLibraryService } from './map-library-service';
export { MapSeedingService } from './map-seeding-service';
export { ThumbnailService, THUMBNAIL_MAX_DIMENSION } from './thumbnail-service';
export type { MapService } from './map-service';
export type { TravelService, TravelResult } from './travel-service.types';
export { AtlasTravelService } from './travel-service';
export type { SpatialContextService } from './spatial-context-service.types';
export { AtlasSpatialContextService } from './spatial-context-service';
export type { ViewerService, ViewerToolbar } from './viewer-service.types';
export { AtlasViewerService } from './viewer-service';
