/**
 * Viewer controller: orchestrates the map viewer feature.
 *
 * Owns the `MapViewer` (Leaflet adapter) and `MarkerLayer` for a single
 * open map, wires the toolbar (fit / center / zoom), and exposes
 * open/close/dispose so the panel can reuse one instance across reopens
 * (no listener duplication — plan §17).
 *
 * All host-adjacent dependencies are injected through the constructor:
 * the `EventBus` (core) and a `showDetail` callback (host Popup, owned
 * by the service layer). This keeps the feature free of host-adapter
 * and service imports.
 *
 * Emits `MapOpened`, `MapClosed`, and `MarkerSelected` through the
 * injected EventBus. Other Atlas events remain unimplemented.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';
import { MapViewer, type MapViewer as MapViewerType } from './map-viewer';
import { MarkerLayer, buildMarkerData, type MarkerLayer as MarkerLayerType } from './marker-layer';
import { RegionLayer } from './region-layer';
import { RouteLayer } from './route-layer';
import {
  buildLocationDetailElement,
  buildRegionDetailElement,
  buildRouteDetailElement,
} from './tooltip-controller';
import { logError, logInfo } from '@/core/logger';
import { type EventBus } from '@/core/events';
import type { ViewerToolbar } from '@/services/viewer-service.types';

/** Creates the toolbar wiring for a freshly-mounted viewer. */
type ToolbarBinder = (commands: ViewerToolbar) => void;

/** Shows a location detail element. Backed by the host Popup (service). */
export type ShowLocationDetail = (
  element: HTMLElement,
  item: AtlasLocation | AtlasRegion | AtlasRoute,
) => Promise<void>;

/**
 * The viewer controller. Constructed per open panel; disposed when the
 * panel is destroyed (not on close — close just hides the container).
 */
export class ViewerController {
  private viewer: MapViewerType | null = null;
  private markers: MarkerLayerType | null = null;
  private regions: RegionLayer | null = null;
  private routes: RouteLayer | null = null;
  private readonly container: HTMLElement;
  private readonly document: AtlasMapDocument;
  private readonly eventBus: EventBus;
  private readonly bindToolbar: ToolbarBinder;
  private readonly showDetail: ShowLocationDetail;
  private readonly requestTravel: (locationId: string) => void;
  private readonly requestOpenChildMap: (childMapId: string) => void;
  private readonly imageUrlOverride?: string;
  private readonly discoveredLocationIds: ReadonlySet<string>;
  private readonly discoveredRegionIds: ReadonlySet<string>;
  private showRegions = true;
  private showRoutes = true;
  private currentLocationId: string | null;

  constructor(args: {
    container: HTMLElement;
    document: AtlasMapDocument;
    eventBus: EventBus;
    bindToolbar: ToolbarBinder;
    showDetail: ShowLocationDetail;
    requestTravel: (locationId: string) => void;
    requestOpenChildMap: (childMapId: string) => void;
    discoveredLocationIds: ReadonlySet<string>;
    discoveredRegionIds: ReadonlySet<string>;
    /** Repository-resolved object URL for a persistent map's image. */
    imageUrlOverride?: string;
    currentLocationId?: string | null;
  }) {
    this.container = args.container;
    this.document = args.document;
    this.eventBus = args.eventBus;
    this.bindToolbar = args.bindToolbar;
    this.showDetail = args.showDetail;
    this.requestTravel = args.requestTravel;
    this.requestOpenChildMap = args.requestOpenChildMap;
    this.discoveredLocationIds = args.discoveredLocationIds;
    this.discoveredRegionIds = args.discoveredRegionIds;
    this.imageUrlOverride = args.imageUrlOverride;
    this.currentLocationId = args.currentLocationId ?? args.document.defaultLocationId ?? null;
  }

  /** Initializes and opens the viewer. Idempotent if already open. */
  open(): void {
    if (this.viewer) {
      this.viewer.invalidateSize();
      return;
    }
    try {
      this.viewer = new MapViewer(this.container, this.document, this.imageUrlOverride);
      this.viewer.init();
    } catch (error) {
      logError('Failed to initialize map viewer.', error);
      return;
    }

    const map = this.viewer.getLeafletMap();
    const dims = this.viewer.getDimensions();
    if (map) {
      this.markers = new MarkerLayer(map, dims, (locationId) => this.onMarkerSelected(locationId));
      this.markers.render(
        buildMarkerData(this.document, this.currentLocationId, this.discoveredLocationIds),
      );

      this.regions = new RegionLayer(map, dims, (regionId) => this.onRegionSelected(regionId));
      this.regions.render(this.document.regions || [], this.discoveredRegionIds);

      this.routes = new RouteLayer(map, dims, (routeId) => this.onRouteSelected(routeId));
      this.routes.render(this.document.routes || [], this.document.locations);
    }

    this.bindToolbar({
      onFit: () => this.viewer?.fitToViewport(),
      onCenter: () => this.centerOnCurrent(),
      onZoomIn: () => this.viewer?.zoomIn(),
      onZoomOut: () => this.viewer?.zoomOut(),
      onToggleRegions: () => this.toggleRegions(),
      onToggleRoutes: () => this.toggleRoutes(),
    });

    // Size now that the container is visible.
    this.viewer.invalidateSize();
    if (this.currentLocationId) {
      this.centerOnCurrent();
    } else {
      this.viewer.fitToViewport();
    }

    this.eventBus.emit('MapOpened', { mapId: this.document.id });
    logInfo(`Opened map "${this.document.name}".`);
  }

  /** Re-centers on the current location. */
  centerOnCurrent(): void {
    if (!this.viewer || !this.currentLocationId) {
      this.viewer?.fitToViewport();
      return;
    }
    const location = this.document.locations.find((l) => l.id === this.currentLocationId);
    if (!location) {
      this.viewer?.fitToViewport();
      return;
    }
    this.viewer.centerOnNormalized(location.coordinates.x, location.coordinates.y);
    this.markers?.focusLocation(this.currentLocationId);
  }

  /** Handles a marker selection: highlight + detail popup + event. */
  private onMarkerSelected(locationId: string): void {
    this.currentLocationId = locationId;
    this.markers?.select(locationId);
    const location = this.document.locations.find((l) => l.id === locationId);
    if (location) {
      const isCurrent = locationId === this.currentLocationId;
      void this.showDetail(
        buildLocationDetailElement(
          location,
          isCurrent,
          () => this.requestTravel(locationId),
          location.childMapId ? () => this.requestOpenChildMap(location.childMapId!) : undefined,
        ),
        location,
      );
    }
    this.eventBus.emit('MarkerSelected', { locationId });
  }

  /** Handles region selection: highlight + detail popup + event. */
  private onRegionSelected(regionId: string): void {
    this.regions?.select(regionId);
    const region = this.document.regions.find((r) => r.id === regionId);
    if (region) {
      void this.showDetail(buildRegionDetailElement(region), region);
    }
    this.eventBus.emit('RegionSelected', { regionId });
  }

  /** Handles route selection: highlight + detail popup + event. */
  private onRouteSelected(routeId: string): void {
    this.routes?.select(routeId);
    const route = this.document.routes.find((r) => r.id === routeId);
    if (route) {
      void this.showDetail(buildRouteDetailElement(route, this.document.locations), route);
    }
    this.eventBus.emit('RouteSelected', { routeId });
  }

  /** Toggles the region layer visibility. */
  toggleRegions(): void {
    this.showRegions = !this.showRegions;
    this.regions?.setVisible(this.showRegions);
  }

  /** Toggles the route layer visibility. */
  toggleRoutes(): void {
    this.showRoutes = !this.showRoutes;
    this.routes?.setVisible(this.showRoutes);
  }

  /** Closes the viewer without destroying it (panel hidden). */
  close(): void {
    // Nothing to do for the Leaflet instance; the container is hidden by
    // the panel. Kept as a hook for future state flushing.
  }

  /** Destroys the viewer and releases all listeners. */
  dispose(): void {
    this.markers?.dispose();
    this.markers = null;
    this.regions?.dispose();
    this.regions = null;
    this.routes?.dispose();
    this.routes = null;
    this.viewer?.dispose();
    this.viewer = null;
    this.eventBus.emit('MapClosed', {});
    logInfo(`Closed map "${this.document.name}".`);
  }
}
