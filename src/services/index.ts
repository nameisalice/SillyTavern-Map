/**
 * Barrel for the Atlas services layer.
 *
 * Services coordinate everything. They sit above domain and providers
 * and below features. A service depends on domain types, provider
 * interfaces, and other services (resolved through the container, never
 * instantiated directly). They never import UI or features.
 */

export type { GenerationRequest, GenerationService } from './generation-service';
export type { ExportService } from './export-service';
export type { ImportService } from './import-service';
export type { MapService } from './map-service';
export type { TravelService } from './travel-service';
export type { ViewerService } from './viewer-service';
