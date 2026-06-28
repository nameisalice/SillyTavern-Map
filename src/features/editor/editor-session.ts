/**
 * Editor session: ties a working document to its history and selection.
 *
 * The session owns the mutable working copy and the `EditorHistory`. It
 * exposes editor operations (add/edit/move/delete/set-default) that
 * produce a new document, record a history entry, and update dirty/
 * canUndo/canRedo flags. It is the single authority on editor state so
 * the controller stays thin.
 */

import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasLocation } from '@/domain/location';
import { cloneJson, nowIso } from '@/repositories/repository-utils';
import {
  type AddMarkerInput,
  type MarkerFieldUpdate,
  addMarker,
  deleteMarker,
  editMarker,
  moveMarker,
  setDefaultLocation,
} from './marker-editor';
import { type AtlasEditorState, type EditorMode } from './editor-state';
import { EditorHistory } from './editor-history';

/**
 * A listener notified whenever the session state changes. The controller
 * subscribes to re-render markers and the property panel.
 */
export type SessionChangeListener = (state: AtlasEditorState) => void;

export class EditorSession {
  private readonly history = new EditorHistory();
  private document: AtlasMapDocument;
  private selectedLocationId: string | undefined;
  private mode: EditorMode = 'edit';
  private readonly listeners = new Set<SessionChangeListener>();

  constructor(document: AtlasMapDocument) {
    // Always work on a deep clone; never mutate a repository-owned doc.
    this.document = cloneJson(document);
    this.selectedLocationId = document.defaultLocationId;
    this.history.initialize(this.document, this.selectedLocationId);
  }

  /** Returns the current editor state snapshot. */
  getState(): AtlasEditorState {
    return {
      document: this.document,
      selectedLocationId: this.selectedLocationId,
      mode: this.mode,
      isDirty: this.history.canUndo(),
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
    };
  }

  /** Returns the working document (caller must not mutate). */
  getDocument(): AtlasMapDocument {
    return this.document;
  }

  /** Returns the id of the currently selected location, if any. */
  getSelectedLocationId(): string | undefined {
    return this.selectedLocationId;
  }

  /** Selects a location by id (or clears selection). */
  selectLocation(locationId: string | undefined): void {
    this.selectedLocationId = locationId;
    this.notify();
  }

  /** Sets the editor mode (edit / preview). Preview never alters the doc. */
  setMode(mode: EditorMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.notify();
  }

  /** Returns the current editor mode. */
  getMode(): EditorMode {
    return this.mode;
  }

  /** True if there are unsaved (undoable) changes. */
  isDirty(): boolean {
    return this.history.canUndo();
  }

  /** Adds a marker, selecting it and recording history. */
  addMarkerOp(input: AddMarkerInput): string {
    const { document, locationId } = addMarker(this.document, input);
    this.commit(document, locationId);
    return locationId;
  }

  /** Edits the selected (or named) marker's fields, recording history. */
  editMarkerOp(locationId: string, update: MarkerFieldUpdate): void {
    this.commit(editMarker(this.document, locationId, update), this.selectedLocationId);
  }

  /** Moves a marker to clamped normalized coordinates, recording history. */
  moveMarkerOp(locationId: string, x: number, y: number): void {
    this.commit(moveMarker(this.document, locationId, x, y), this.selectedLocationId);
  }

  /** Deletes a marker, clearing selection/default as needed, recording history. */
  deleteMarkerOp(locationId: string): void {
    const { document } = deleteMarker(this.document, locationId);
    const nextSelected =
      this.selectedLocationId === locationId ? undefined : this.selectedLocationId;
    this.commit(document, nextSelected);
  }

  /** Sets the default location, recording history. */
  setDefaultLocationOp(locationId: string | undefined): void {
    this.commit(setDefaultLocation(this.document, locationId), this.selectedLocationId);
  }

  /** Undoes the last command. */
  undo(): void {
    const snapshot = this.history.undo();
    if (snapshot) {
      this.document = cloneJson(snapshot.document);
      this.selectedLocationId = snapshot.selectedLocationId;
      this.notify();
    }
  }

  /** Redoes the last undone command. */
  redo(): void {
    const snapshot = this.history.redo();
    if (snapshot) {
      this.document = cloneJson(snapshot.document);
      this.selectedLocationId = snapshot.selectedLocationId;
      this.notify();
    }
  }

  /**
   * Marks the document as saved: resets history to the current state
   * (so dirty/canUndo flags clear) and touches `updatedAt` on the
   * working copy.
   */
  markSaved(document: AtlasMapDocument): void {
    this.document = cloneJson(document);
    this.history.initialize(this.document, this.selectedLocationId);
    this.notify();
  }

  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Disposes the session and releases listeners. */
  dispose(): void {
    this.listeners.clear();
    this.history.clear();
  }

  /** Returns the location with the given id, or null. */
  findLocation(locationId: string): AtlasLocation | null {
    return this.document.locations.find((l) => l.id === locationId) ?? null;
  }

  private commit(document: AtlasMapDocument, selectedLocationId: string | undefined): void {
    this.document = document;
    this.selectedLocationId = selectedLocationId;
    this.history.push(this.document, this.selectedLocationId);
    this.notify();
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

/** Helper to build a fresh working document's updatedAt timestamp. */
export function freshUpdatedAt(document: AtlasMapDocument): AtlasMapDocument {
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: nowIso() },
  };
}
