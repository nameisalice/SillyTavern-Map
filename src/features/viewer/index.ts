/**
 * Viewer feature module.
 *
 * Visual map elements: Leaflet map adapters, markers, polylines,
 * polygons, tooltips, and controllers. Depend only on domain and
 * services, never on providers or storage.
 */

export { MapViewer, normalizedToLatLng } from './map-viewer';
export { MarkerLayer, buildMarkerData } from './marker-layer';
export { RegionLayer } from './region-layer';
export { RouteLayer } from './route-layer';
export { buildLocationDetail, buildLocationDetailElement } from './tooltip-controller';
export { ViewerController } from './viewer-controller';
