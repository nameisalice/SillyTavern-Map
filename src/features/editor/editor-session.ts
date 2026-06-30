/**
 * Editor session: ties a working document to its history and selection.
 *
 * Exposes operations for Markers, Regions, and Routes, updating the
 * undo/redo history stack cleanly.
 */

import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';
import { cloneJson, nowIso } from '@/repositories/repository-utils';
import {
  type AddMarkerInput,
  type MarkerFieldUpdate,
  addMarker,
  deleteMarker,
  editMarker,
  moveMarker,
  setDefaultLocation,
  type AddRegionInput,
  type RegionFieldUpdate,
  addRegion,
  editRegion,
  deleteRegion,
  moveRegionPoint,
  addRegionPoint,
  removeRegionPoint,
  type AddRouteInput,
  type RouteFieldUpdate,
  addRoute,
  editRoute,
  deleteRoute,
  moveRoutePoint,
  addRoutePoint,
  removeRoutePoint,
} from './marker-editor';
import { type AtlasEditorState, type EditorMode, type EditorSubMode } from './editor-state';
import { EditorHistory } from './editor-history';

export type SessionChangeListener = (state: AtlasEditorState) => void;

export class EditorSession {
  private readonly history = new EditorHistory();
  private document: AtlasMapDocument;
  private selectedItemId: string | undefined;
  private selectedType: 'location' | 'region' | 'route' | undefined;
  private mode: EditorMode = 'edit';
  private subMode: EditorSubMode = 'marker';
  private readonly listeners = new Set<SessionChangeListener>();

  constructor(document: AtlasMapDocument) {
    this.document = cloneJson(document);
    this.selectedItemId = document.defaultLocationId;
    this.selectedType = document.defaultLocationId ? 'location' : undefined;
    this.history.initialize(this.document, this.selectedItemId, this.selectedType);
  }

  getState(): AtlasEditorState {
    return {
      document: this.document,
      selectedItemId: this.selectedItemId,
      selectedType: this.selectedType,
      mode: this.mode,
      subMode: this.subMode,
      isDirty: this.history.canUndo(),
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
    };
  }

  getDocument(): AtlasMapDocument {
    return this.document;
  }

  getSelectedItemId(): string | undefined {
    return this.selectedItemId;
  }

  getSelectedType(): 'location' | 'region' | 'route' | undefined {
    return this.selectedType;
  }

  selectItem(id: string | undefined, type: 'location' | 'region' | 'route' | undefined): void {
    this.selectedItemId = id;
    this.selectedType = type;
    this.notify();
  }

  setMode(mode: EditorMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.notify();
  }

  getMode(): EditorMode {
    return this.mode;
  }

  setSubMode(subMode: EditorSubMode): void {
    if (this.subMode === subMode) {
      return;
    }
    this.subMode = subMode;
    // Clear selection when sub mode changes to maintain clean state
    this.selectedItemId = undefined;
    this.selectedType = undefined;
    this.notify();
  }

  isDirty(): boolean {
    return this.history.canUndo();
  }

  // --- Marker Operations ---

  addMarkerOp(input: AddMarkerInput): string {
    const { document, locationId } = addMarker(this.document, input);
    this.commit(document, locationId, 'location');
    return locationId;
  }

  editMarkerOp(locationId: string, update: MarkerFieldUpdate): void {
    this.commit(editMarker(this.document, locationId, update), this.selectedItemId, 'location');
  }

  moveMarkerOp(locationId: string, x: number, y: number): void {
    this.commit(moveMarker(this.document, locationId, x, y), this.selectedItemId, 'location');
  }

  deleteMarkerOp(locationId: string): void {
    const { document } = deleteMarker(this.document, locationId);
    const nextSelected = this.selectedItemId === locationId ? undefined : this.selectedItemId;
    const nextType = nextSelected ? this.selectedType : undefined;
    this.commit(document, nextSelected, nextType);
  }

  setDefaultLocationOp(locationId: string | undefined): void {
    this.commit(setDefaultLocation(this.document, locationId), this.selectedItemId, 'location');
  }

  // --- Region Operations (M7) ---

  addRegionOp(input: AddRegionInput): string {
    const { document, regionId } = addRegion(this.document, input);
    this.commit(document, regionId, 'region');
    return regionId;
  }

  editRegionOp(regionId: string, update: RegionFieldUpdate): void {
    this.commit(editRegion(this.document, regionId, update), this.selectedItemId, 'region');
  }

  moveRegionPointOp(regionId: string, pointIndex: number, x: number, y: number): void {
    this.commit(moveRegionPoint(this.document, regionId, pointIndex, x, y), this.selectedItemId, 'region');
  }

  addRegionPointOp(regionId: string, x: number, y: number): void {
    this.commit(addRegionPoint(this.document, regionId, x, y), this.selectedItemId, 'region');
  }

  removeRegionPointOp(regionId: string, pointIndex: number): void {
    this.commit(removeRegionPoint(this.document, regionId, pointIndex), this.selectedItemId, 'region');
  }

  deleteRegionOp(regionId: string): void {
    const document = deleteRegion(this.document, regionId);
    const nextSelected = this.selectedItemId === regionId ? undefined : this.selectedItemId;
    const nextType = nextSelected ? this.selectedType : undefined;
    this.commit(document, nextSelected, nextType);
  }

  // --- Route Operations (M7) ---

  addRouteOp(input: AddRouteInput): string {
    const { document, routeId } = addRoute(this.document, input);
    this.commit(document, routeId, 'route');
    return routeId;
  }

  editRouteOp(routeId: string, update: RouteFieldUpdate): void {
    this.commit(editRoute(this.document, routeId, update), this.selectedItemId, 'route');
  }

  moveRoutePointOp(routeId: string, pointIndex: number, x: number, y: number): void {
    this.commit(moveRoutePoint(this.document, routeId, pointIndex, x, y), this.selectedItemId, 'route');
  }

  addRoutePointOp(routeId: string, x: number, y: number): void {
    this.commit(addRoutePoint(this.document, routeId, x, y), this.selectedItemId, 'route');
  }

  removeRoutePointOp(routeId: string, pointIndex: number): void {
    this.commit(removeRoutePoint(this.document, routeId, pointIndex), this.selectedItemId, 'route');
  }

  deleteRouteOp(routeId: string): void {
    const document = deleteRoute(this.document, routeId);
    const nextSelected = this.selectedItemId === routeId ? undefined : this.selectedItemId;
    const nextType = nextSelected ? this.selectedType : undefined;
    this.commit(document, nextSelected, nextType);
  }

  // --- Global History coordination ---

  undo(): void {
    const snapshot = this.history.undo();
    if (snapshot) {
      this.document = cloneJson(snapshot.document);
      this.selectedItemId = snapshot.selectedItemId;
      this.selectedType = snapshot.selectedType;
      this.notify();
    }
  }

  redo(): void {
    const snapshot = this.history.redo();
    if (snapshot) {
      this.document = cloneJson(snapshot.document);
      this.selectedItemId = snapshot.selectedItemId;
      this.selectedType = snapshot.selectedType;
      this.notify();
    }
  }

  markSaved(document: AtlasMapDocument): void {
    this.document = cloneJson(document);
    this.history.initialize(this.document, this.selectedItemId, this.selectedType);
    this.notify();
  }

  subscribe(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
    this.history.clear();
  }

  findLocation(locationId: string): AtlasLocation | null {
    return this.document.locations.find((l) => l.id === locationId) ?? null;
  }

  findRegion(regionId: string): AtlasRegion | null {
    return (this.document.regions || []).find((r) => r.id === regionId) ?? null;
  }

  findRoute(routeId: string): AtlasRoute | null {
    return (this.document.routes || []).find((r) => r.id === routeId) ?? null;
  }

  private commit(
    document: AtlasMapDocument,
    selectedItemId: string | undefined,
    selectedType: 'location' | 'region' | 'route' | undefined,
  ): void {
    this.document = document;
    this.selectedItemId = selectedItemId;
    this.selectedType = selectedType;
    this.history.push(this.document, this.selectedItemId, this.selectedType);
    this.notify();
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export function freshUpdatedAt(document: AtlasMapDocument): AtlasMapDocument {
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: nowIso() },
  };
}
