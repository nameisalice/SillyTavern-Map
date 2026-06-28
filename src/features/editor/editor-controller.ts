/**
 * Editor controller: orchestrates the visual marker editor.
 *
 * Composes focused modules rather than being a God class:
 *  - `EditorSession` owns the working document, history, selection.
 *  - `MapViewer` owns the Leaflet map surface.
 *  - `MarkerLayer` (viewer's) renders markers; the editor toggles drag.
 *  - `PropertyPanel` renders the location form.
 *  - `MapDraftService` persists on Save.
 *
 * Host interaction (popups) is injected via callbacks so the editor
 * feature stays free of host-adapter imports.
 */

import type L from 'leaflet';
import type { AtlasMapDocument } from '@/domain/map';
import { MapViewer } from '@/features/viewer/map-viewer';
import { MarkerLayer, buildMarkerData } from '@/features/viewer/marker-layer';
import { PropertyPanel, type PropertyPanelValues } from './property-panel';
import { EditorSession } from './editor-session';
import { type AddMarkerInput } from './marker-editor';
import { latLngToNormalized } from './coordinate-utils';
import { validateMapDocument, type ValidationResult } from '@/domain/map';
import type { MapDraftService } from '@/services/map-draft-service';
import type { EventBus } from '@/core/events';
import { logError, logInfo } from '@/core/logger';

/** Toolbar commands the editor surfaces to its host. */
export interface EditorToolbar {
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onSave: () => void;
  readonly onTogglePreview: () => void;
  readonly onExit: () => void;
  readonly onAddLocation: () => void;
}

/** Creates the toolbar wiring for a freshly-mounted editor. */
type ToolbarBinder = (commands: EditorToolbar) => void;

/** Shows a confirmation/info popup; returns the chosen action. */
export type EditorPopup = (
  content: HTMLElement | string,
  type: 'confirm' | 'text',
) => Promise<number>;

/** Notified after a successful save. */
export type OnSavedCallback = (document: AtlasMapDocument) => void;

export class EditorController {
  private viewer: MapViewer | null = null;
  private markers: MarkerLayer | null = null;
  private readonly session: EditorSession;
  private readonly panel: PropertyPanel;
  private readonly container: HTMLElement;
  private readonly propertyHost: HTMLElement;
  private readonly bindToolbar: ToolbarBinder;
  private readonly popup: EditorPopup;
  private readonly draftService: MapDraftService;
  private readonly eventBus: EventBus;
  private readonly onSaved: OnSavedCallback;
  private readonly imageUrlOverride?: string;
  private addingLocation = false;

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
    this.panel = new PropertyPanel(this.propertyHost, (values) => this.onPropertyChange(values));
    this.session.subscribe(() => this.render());
  }

  /** Initializes the editor and emits EditorOpened. */
  open(): void {
    this.viewer = new MapViewer(this.container, this.session.getDocument(), this.imageUrlOverride);
    this.viewer.init();
    const map = this.viewer.getLeafletMap();
    const dims = this.viewer.getDimensions();
    if (map) {
      this.markers = new MarkerLayer(map, dims, (locationId) => this.onMarkerClick(locationId));
      map.on('click', (event) => this.onMapClick(event));
    }
    this.bindToolbar({
      onUndo: () => this.session.undo(),
      onRedo: () => this.session.redo(),
      onSave: () => void this.save(),
      onTogglePreview: () => this.togglePreview(),
      onExit: () => void this.exit(),
      onAddLocation: () => this.beginAddLocation(),
    });
    this.render();
    this.viewer.invalidateSize();
    this.eventBus.emit('EditorOpened', { mapId: this.session.getDocument().id });
    logInfo('Editor opened.');
  }

  /** Disposes the editor and releases listeners. */
  dispose(): void {
    this.markers?.dispose();
    this.markers = null;
    this.viewer?.dispose();
    this.viewer = null;
    this.session.dispose();
    this.eventBus.emit('EditorClosed', {});
    logInfo('Editor closed.');
  }

  /** Returns true if there are unsaved changes. */
  isDirty(): boolean {
    return this.session.isDirty();
  }

  /** Toggles between edit and preview mode. */
  togglePreview(): void {
    const next = this.session.getMode() === 'edit' ? 'preview' : 'edit';
    this.session.setMode(next);
    this.eventBus.emit('EditorModeChanged', {
      mapId: this.session.getDocument().id,
      mode: next,
    });
  }

  /** Begins click-to-add mode. */
  beginAddLocation(): void {
    if (this.session.getMode() !== 'edit') {
      return;
    }
    this.addingLocation = true;
    this.container.classList.add('st-atlas__canvas--placing');
  }

  /** Validates and saves the working document through MapDraftService. */
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
      await this.popup(`Could not save the map: ${stringifyError(error)}`, 'text');
    }
  }

  /** Exits the editor, prompting to save if dirty. */
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
    this.dispose();
  }

  /** Renders markers + property panel from the current session state. */
  private render(): void {
    const state = this.session.getState();
    const document = state.document;
    this.eventBus.emit('MapDraftChanged', { mapId: document.id, isDirty: state.isDirty });

    if (this.markers) {
      const currentId = state.selectedLocationId ?? document.defaultLocationId;
      this.markers.render(buildMarkerData(document, currentId ?? null, new Set()));
      this.updateDraggability();
    }

    const selected = state.selectedLocationId
      ? this.session.findLocation(state.selectedLocationId)
      : null;
    const isDefault = state.selectedLocationId === document.defaultLocationId;
    this.panel.render(selected, isDefault);
  }

  /** Enables/disables marker dragging based on the editor mode. */
  private updateDraggability(): void {
    if (!this.markers) {
      return;
    }
    const draggable = this.session.getMode() === 'edit';
    // MarkerLayer exposes the underlying L.Marker map via private field;
    // we re-render with drag options by clearing and rebuilding is not
    // needed — Leaflet markers can be toggled through the layer.
    this.markers.setDraggable(draggable, (id, lat, lng) => this.onMarkerDragEnd(id, lat, lng));
  }

  /** Handles a marker click: select + open property panel. */
  private onMarkerClick(locationId: string): void {
    this.session.selectLocation(locationId);
    this.eventBus.emit('EditorLocationSelected', {
      mapId: this.session.getDocument().id,
      locationId,
    });
  }

  /** Handles a map click in add-location mode. */
  private onMapClick(event: L.LeafletMouseEvent): void {
    if (!this.addingLocation || !this.viewer) {
      return;
    }
    this.addingLocation = false;
    this.container.classList.remove('st-atlas__canvas--placing');
    const dims = this.viewer.getDimensions();
    const { x, y } = latLngToNormalized(
      event.latlng.lat,
      event.latlng.lng,
      dims.width,
      dims.height,
    );
    const name = `Location ${this.session.getDocument().locations.length + 1}`;
    const input: AddMarkerInput = { name, x, y };
    const id = this.session.addMarkerOp(input);
    this.session.selectLocation(id);
  }

  /** Handles a completed marker drag: one history entry per drag. */
  private onMarkerDragEnd(locationId: string, lat: number, lng: number): void {
    if (!this.viewer) {
      return;
    }
    const dims = this.viewer.getDimensions();
    const { x, y } = latLngToNormalized(lat, lng, dims.width, dims.height);
    this.session.moveMarkerOp(locationId, x, y);
  }

  /** Collects property-panel edits and applies them as one history entry. */
  private onPropertyChange(values: PropertyPanelValues): void {
    const id = this.session.getSelectedLocationId();
    if (!id) {
      return;
    }
    this.session.editMarkerOp(id, {
      name: values.name,
      description: values.description,
      category: values.category,
      icon: values.icon,
      dangerLevel: values.dangerLevel,
      aliases: values.aliases,
      worldInfoKeywords: values.worldInfoKeywords,
      hiddenUntilDiscovered: values.hiddenUntilDiscovered,
      discoveredByDefault: values.discoveredByDefault,
    });
    if (values.isDefault) {
      this.session.setDefaultLocationOp(id);
    } else if (this.session.getDocument().defaultLocationId === id) {
      this.session.setDefaultLocationOp(undefined);
    }
  }

  /** Shows validation errors as a popup listing every problem. */
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

  /** Prompts the user to save, discard, or cancel. */
  private async confirmUnsaved(): Promise<'save' | 'discard' | 'cancel'> {
    const message = 'You have unsaved changes. Save before continuing?';
    const result = await this.popup(message, 'confirm');
    // POPUP_RESULT.AFFIRMATIVE === 1, CANCEL === 0 (host convention).
    if (result === 1) {
      return 'save';
    }
    if (result === 0) {
      return 'cancel';
    }
    return 'discard';
  }
}

/** Stringifies an unknown error into a readable message. */
function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
