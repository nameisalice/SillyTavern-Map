/**
 * Editor controller: visual Marker, Region, and Route editor orchestration.
 *
 * Implements click-to-add locations, click-to-add region polygons with vertex
 * drag handles, and connection route paths, safely complying with all
 * architecture and security rules.
 */

import L from 'leaflet';
import type { AtlasMapDocument } from '@/domain/map';
import { MapViewer } from '@/features/viewer/map-viewer';
import { MarkerLayer, buildMarkerData } from '@/features/viewer/marker-layer';
import { RegionLayer } from '@/features/viewer/region-layer';
import { RouteLayer } from '@/features/viewer/route-layer';
import { PropertyPanel, type PropertyPanelValues } from './property-panel';
import { EditorSession } from './editor-session';
import { type EditorSubMode } from './editor-state';
import { latLngToNormalized, normalizedToLatLng } from './coordinate-utils';
import { validateMapDocument, type ValidationResult } from '@/domain/map';
import type { MapDraftService } from '@/services/map-draft-service';
import type { EventBus } from '@/core/events';
import { logError, logInfo } from '@/core/logger';

export interface EditorToolbar {
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSave: () => void;
  readonly onTogglePreview: () => void;
  readonly onExit: () => void;
  readonly onAddLocation: () => void;
  readonly onChangeSubMode: (subMode: EditorSubMode) => void;
}

type ToolbarBinder = (commands: EditorToolbar) => void;

export type EditorPopup = (
  content: HTMLElement | string,
  type: 'confirm' | 'text',
) => Promise<number>;

export type OnSavedCallback = (document: AtlasMapDocument) => void;

export class EditorController {
  private viewer: MapViewer | null = null;
  private markers: MarkerLayer | null = null;
  private regions: RegionLayer | null = null;
  private routes: RouteLayer | null = null;
  private vertexMarkers: L.Marker[] = [];
  private vertexGroup: L.LayerGroup | null = null;
  private readonly session: EditorSession;
  private readonly panel: PropertyPanel;
  private readonly container: HTMLElement;
  private readonly propertyHost: HTMLElement;
  private readonly bindToolbar: ToolbarBinder;
  private readonly popup: EditorPopup;
  private readonly draftService: MapDraftService;
  private readonly eventBus: EventBus;
  private readonly onSaved: OnSavedCallback;
  private readonly onExit: () => void;
  private readonly imageUrlOverride?: string;
  private addingLocation = false;
  private addingRoute = false;
  private routeOriginId: string | null = null;

  constructor(args: {
    container: HTMLElement;
    propertyHost: HTMLElement;
    document: AtlasMapDocument;
    imageUrlOverride?: string;
    eventBus: EventBus;
    bindToolbar: ToolbarBinder;
    popup: EditorPopup;
    draftService: MapDraftService;
    onSaved: OnSavedCallback;
    onExit: () => void;
  }) {
    this.container = args.container;
    this.propertyHost = args.propertyHost;
    this.session = new EditorSession(args.document);
    this.imageUrlOverride = args.imageUrlOverride;
    this.eventBus = args.eventBus;
    this.bindToolbar = args.bindToolbar;
    this.popup = args.popup;
    this.draftService = args.draftService;
    this.onSaved = args.onSaved;
    this.onExit = args.onExit;
    this.panel = new PropertyPanel(this.propertyHost, (values) => this.onPropertyChange(values));
    this.session.subscribe(() => this.render());
  }

  open(): void {
    this.viewer = new MapViewer(this.container, this.session.getDocument(), this.imageUrlOverride);
    this.viewer.init();
    const map = this.viewer.getLeafletMap();
    const dims = this.viewer.getDimensions();
    if (map) {
      this.vertexGroup = L.layerGroup().addTo(map);
      this.markers = new MarkerLayer(map, dims, (id) => this.onMarkerClick(id));
      this.regions = new RegionLayer(map, dims, (id) => this.onRegionClick(id));
      this.routes = new RouteLayer(map, dims, (id) => this.onRouteClick(id));
      map.on('click', (event) => this.onMapClick(event));
    }
    this.bindToolbar({
      onUndo: () => this.session.undo(),
      onRedo: () => this.session.redo(),
      onSave: () => void this.save(),
      onTogglePreview: () => this.togglePreview(),
      onExit: () => void this.exit(),
      onAddLocation: () => this.beginAddLocation(),
      onChangeSubMode: (subMode) => this.changeSubMode(subMode),
    });
    this.render();
    this.viewer.invalidateSize();
    this.eventBus.emit('EditorOpened', { mapId: this.session.getDocument().id });
    logInfo('Editor opened.');
  }

  dispose(): void {
    this.clearVertexMarkers();
    this.vertexGroup?.remove();
    this.markers?.dispose();
    this.markers = null;
    this.regions?.dispose();
    this.regions = null;
    this.routes?.dispose();
    this.routes = null;
    this.viewer?.dispose();
    this.viewer = null;
    this.session.dispose();
    this.eventBus.emit('EditorClosed', {});
    logInfo('Editor closed.');
  }

  isDirty(): boolean {
    return this.session.isDirty();
  }

  togglePreview(): void {
    const next = this.session.getMode() === 'edit' ? 'preview' : 'edit';
    if (next === 'preview') {
      this.addingLocation = false;
      this.addingRoute = false;
      this.routeOriginId = null;
    }
    this.session.setMode(next);
    this.updateCanvasInteractionState();
    this.eventBus.emit('EditorModeChanged', {
      mapId: this.session.getDocument().id,
      mode: next,
    });
  }

  beginAddLocation(): void {
    if (this.session.getMode() !== 'edit') {
      return;
    }
    const subMode = this.session.getState().subMode;
    if (subMode === 'marker' || subMode === 'region') {
      this.addingLocation = true;
      this.addingRoute = false;
      this.routeOriginId = null;
      this.updateCanvasInteractionState();
      return;
    }
    if (subMode === 'route') {
      this.addingRoute = true;
      this.addingLocation = false;
      this.routeOriginId = null;
      this.updateCanvasInteractionState();
      void this.popup('Click the first marker, then click the target marker to create a route.', 'text');
    }
  }

  changeSubMode(subMode: EditorSubMode): void {
    this.addingLocation = false;
    this.addingRoute = false;
    this.routeOriginId = null;
    this.session.setSubMode(subMode);
    this.updateCanvasInteractionState();
  }

  async save(): Promise<void> {
    const document = this.session.getDocument();
    const validation = validateMapDocument(document);
    if (!validation.ok) {
      await this.showValidationErrors(validation);
      return;
    }
    try {
      const saved = await this.draftService.save(document);
      this.session.markSaved(saved);
      this.onSaved(saved);
      this.eventBus.emit('MapSaved', { mapId: saved.id });
      await this.popup('Map saved to the library.', 'text');
    } catch (error) {
      logError('Failed to save map.', error);
      await this.popup(`Could not save the map: ${error instanceof Error ? error.message : String(error)}`, 'text');
    }
  }

  async exit(): Promise<void> {
    if (this.session.isDirty()) {
      const choice = await this.confirmUnsaved();
      if (choice === 'cancel') {
        return;
      }
      if (choice === 'save') {
        const document = this.session.getDocument();
        const validation = validateMapDocument(document);
        if (!validation.ok) {
          await this.showValidationErrors(validation);
          return;
        }
        await this.draftService.save(document);
      }
    }
    this.onExit();
    this.dispose();
  }

  private render(): void {
    const state = this.session.getState();
    const document = state.document;
    this.eventBus.emit('MapDraftChanged', { mapId: document.id, isDirty: state.isDirty });

    this.clearVertexMarkers();
    this.updateCanvasInteractionState();

    // Determine submode and selections
    const isEditMode = state.mode === 'edit';
    const subMode = state.subMode;

    if (this.markers) {
      const currentLocId =
        state.selectedType === 'location' ? state.selectedItemId : undefined;
      this.markers.render(buildMarkerData(document, currentLocId ?? null, new Set()));
      const draggable = isEditMode && subMode === 'marker';
      this.markers.setDraggable(draggable, (id, lat, lng) => this.onMarkerDragEnd(id, lat, lng));
    }

    if (this.regions) {
      this.regions.render(document.regions || [], new Set(document.regions.map((r) => r.id)));
      if (state.selectedType === 'region' && state.selectedItemId) {
        this.regions.select(state.selectedItemId);
        if (isEditMode) {
          this.renderRegionDragHandles(state.selectedItemId);
        }
      } else {
        this.regions.clearSelection();
      }
    }

    if (this.routes) {
      this.routes.render(document.routes || [], document.locations);
      if (state.selectedType === 'route' && state.selectedItemId) {
        this.routes.select(state.selectedItemId);
      } else {
        this.routes.clearSelection();
      }
    }

    // Render property panels
    if (state.selectedItemId) {
      if (state.selectedType === 'location') {
        const selected = this.session.findLocation(state.selectedItemId);
        const isDefault = state.selectedItemId === document.defaultLocationId;
        this.panel.renderLocation(selected, isDefault);
      } else if (state.selectedType === 'region') {
        const selected = this.session.findRegion(state.selectedItemId);
        this.panel.renderRegion(selected);
      } else if (state.selectedType === 'route') {
        const selected = this.session.findRoute(state.selectedItemId);
        this.panel.renderRoute(selected);
      }
    } else {
      this.panel.clear();
    }
  }

  private onMarkerClick(locationId: string): void {
    const state = this.session.getState();
    if (state.mode === 'edit' && state.subMode === 'route') {
      // Connect routes
      if (!this.routeOriginId) {
        this.routeOriginId = locationId;
        this.addingRoute = true;
        this.updateCanvasInteractionState();
        this.session.selectItem(locationId, 'location');
      } else {
        if (this.routeOriginId === locationId) {
          this.routeOriginId = null;
          this.addingRoute = false;
          this.updateCanvasInteractionState();
          return;
        }
        try {
          const routeId = this.session.addRouteOp({
            fromLocationId: this.routeOriginId,
            toLocationId: locationId,
            bidirectional: true,
          });
          this.session.selectItem(routeId, 'route');
          this.routeOriginId = null;
          this.addingRoute = false;
          this.updateCanvasInteractionState();
        } catch (error) {
          void this.popup(`Could not connect locations: ${error instanceof Error ? error.message : String(error)}`, 'text');
        }
      }
    } else {
      this.session.selectItem(locationId, 'location');
    }
  }

  private onRegionClick(regionId: string): void {
    this.session.selectItem(regionId, 'region');
  }

  private onRouteClick(routeId: string): void {
    this.session.selectItem(routeId, 'route');
  }

  private onMapClick(event: L.LeafletMouseEvent): void {
    if (!this.addingLocation || !this.viewer) {
      return;
    }
    this.addingLocation = false;
    this.updateCanvasInteractionState();
    const dims = this.viewer.getDimensions();
    const { x, y } = latLngToNormalized(event.latlng.lat, event.latlng.lng, dims.width, dims.height);

    const subMode = this.session.getState().subMode;
    if (subMode === 'marker') {
      const name = `Location ${this.session.getDocument().locations.length + 1}`;
      const id = this.session.addMarkerOp({ name, x, y });
      this.session.selectItem(id, 'location');
    } else if (subMode === 'region') {
      // For Milestone 7 drawing polygons: click seeds a default triangle at click coordinates,
      // and opens the vertex drag handles immediately.
      const name = `Region ${this.session.getDocument().regions.length + 1}`;
      const id = this.session.addRegionOp({
        name,
        polygon: [
          [clampNormalized(x - 4), clampNormalized(y - 3)],
          [clampNormalized(x + 4), clampNormalized(y - 3)],
          [clampNormalized(x), clampNormalized(y + 5)],
        ],
      });
      this.session.selectItem(id, 'region');
    }
  }

  private onMarkerDragEnd(locationId: string, lat: number, lng: number): void {
    if (!this.viewer) {
      return;
    }
    const dims = this.viewer.getDimensions();
    const { x, y } = latLngToNormalized(lat, lng, dims.width, dims.height);
    this.session.moveMarkerOp(locationId, x, y);
  }

  private onPropertyChange(values: PropertyPanelValues): void {
    const id = this.session.getSelectedItemId();
    if (!id) {
      return;
    }

    if (values.type === 'location' && values.location) {
      const v = values.location;
      this.session.editMarkerOp(id, {
        name: v.name,
        description: v.description,
        category: v.category,
        icon: v.icon,
        dangerLevel: v.dangerLevel,
        aliases: v.aliases,
        worldInfoKeywords: v.worldInfoKeywords,
        hiddenUntilDiscovered: v.hiddenUntilDiscovered,
        discoveredByDefault: v.discoveredByDefault,
        childMapId: v.childMapId,
      });
      if (v.isDefault) {
        this.session.setDefaultLocationOp(id);
      } else if (this.session.getDocument().defaultLocationId === id) {
        this.session.setDefaultLocationOp(undefined);
      }
    } else if (values.type === 'region' && values.region) {
      const v = values.region;
      this.session.editRegionOp(id, {
        name: v.name,
        description: v.description,
        fillColor: v.fillColor,
        borderColor: v.borderColor,
        opacity: v.opacity,
        hiddenUntilDiscovered: v.hiddenUntilDiscovered,
      });
    } else if (values.type === 'route' && values.route) {
      const v = values.route;
      this.session.editRouteOp(id, {
        name: v.name,
        bidirectional: v.bidirectional,
        distance: v.distance,
        distanceUnit: v.distanceUnit,
        travelTime: v.travelTime,
        travelTimeUnit: v.travelTimeUnit,
        dangerLevel: v.dangerLevel,
        locked: v.locked,
        requirements: v.requirements,
      });
    }
  }

  /** Render handles for moving, adding or removing points of the active region. */
  private renderRegionDragHandles(regionId: string): void {
    const region = this.session.findRegion(regionId);
    if (!region || !this.viewer || !this.vertexGroup) {
      return;
    }
    const map = this.viewer.getLeafletMap();
    if (!map) {
      return;
    }
    const { width, height } = this.viewer.getDimensions();

    region.polygon.forEach((pt, index) => {
      const latLng = normalizedToLatLng(pt[0], pt[1], width, height);

      // Create a small colored marker per point
      const marker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'st-atlas__vertex-handle',
          html: `<span class="st-atlas__vertex-dot" title="Drag to move vertex. Right-click to remove.">${index + 1}</span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        draggable: true,
      });

      // Point drag handles updates coordinates
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        const norm = latLngToNormalized(lat, lng, width, height);
        this.session.moveRegionPointOp(regionId, index, norm.x, norm.y);
      });

      // Context menu or alt click removes point (requires poly length > 3)
      marker.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e.originalEvent);
        if (region.polygon.length <= 3) {
          this.popup('A region polygon cannot have less than 3 points.', 'text');
          return;
        }
        this.session.removeRegionPointOp(regionId, index);
      });

      marker.addTo(this.vertexGroup!);
      this.vertexMarkers.push(marker);
    });

    // Helper text in properties card
    const hint = document.createElement('div');
    hint.className = 'st-atlas__property-row';
    const label = document.createElement('span');
    label.className = 'st-atlas__property-label';
    label.textContent = 'Vertex Operations';
    const desc = document.createElement('span');
    desc.className = 'st-atlas__property-empty';
    desc.textContent = 'Drag numbered vertices on the map to modify coordinates. Right-click vertex dot to remove. Click "Add Point" button below to append point to the end.';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu_button st-atlas__property-input';
    btn.textContent = 'Add Point';
    btn.addEventListener('click', () => {
      // Append point next to first point offset
      const first = region.polygon[0];
      this.session.addRegionPointOp(regionId, first[0] + 3, first[1] + 3);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'menu_button st-atlas__property-input st-atlas__library-btn--danger';
    delBtn.textContent = 'Delete Region';
    delBtn.addEventListener('click', async () => {
      const choice = await this.popup(`Delete region "${region.name}"?`, 'confirm');
      if (choice === 1) {
        this.session.deleteRegionOp(regionId);
      }
    });

    hint.append(label, desc, btn, delBtn);
    this.propertyHost.append(hint);
  }

  private clearVertexMarkers(): void {
    this.vertexGroup?.clearLayers();
    this.vertexMarkers = [];
  }

  private updateCanvasInteractionState(): void {
    this.container.classList.toggle('st-atlas__canvas--placing', this.addingLocation);
    this.container.classList.toggle('st-atlas__canvas--connecting', this.addingRoute);
    this.container.dataset['editorSubmode'] = this.session.getState().subMode;
  }

  private async showValidationErrors(validation: ValidationResult): Promise<void> {
    const list = document.createElement('ul');
    list.className = 'st-atlas__validation-list';
    for (const error of validation.errors) {
      const item = document.createElement('li');
      item.textContent = `${error.path}: ${error.message}`;
      list.append(item);
    }
    const heading = document.createElement('p');
    heading.textContent = 'The map cannot be saved until these issues are resolved:';
    const container = document.createElement('div');
    container.append(heading, list);
    await this.popup(container, 'text');
  }

  private async confirmUnsaved(): Promise<'save' | 'discard' | 'cancel'> {
    const message = 'You have unsaved changes. Save before continuing?';
    const result = await this.popup(message, 'confirm');
    if (result === 1) {
      return 'save';
    }
    if (result === 0) {
      return 'cancel';
    }
    return 'discard';
  }
}

function clampNormalized(value: number): number {
  return Math.max(0, Math.min(100, value));
}
