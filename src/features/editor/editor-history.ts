/**
 * Bounded undo/redo history for the editor.
 *
 * Snapshot-based: each entry stores the working document plus the
 * selected location id at the time of the edit. Binary assets are
 * referenced by id inside the document, so no image blobs are stored
 * per entry — only the JSON-shaped document, which is cheap at current
 * scale.
 *
 * Redo history is cleared whenever a new command is committed.
 */

import type { AtlasMapDocument } from '@/domain/map';
import { cloneJson } from '@/repositories/repository-utils';

/** Recommended maximum history length. */
export const MAX_HISTORY = 100;

export interface EditorSnapshot {
  readonly document: AtlasMapDocument;
  readonly selectedLocationId?: string;
}

/**
 * A bounded command history. Call `push` after each completed editor
 * command; `undo`/`redo` restore prior states. The initial state is the
 * first entry on the undo stack so undo can return to it.
 */
export class EditorHistory {
  private readonly undoStack: EditorSnapshot[] = [];
  private readonly redoStack: EditorSnapshot[] = [];
  private readonly limit: number;

  constructor(limit: number = MAX_HISTORY) {
    this.limit = limit;
  }

  /** Seeds the history with an initial (pre-edit) snapshot. */
  initialize(document: AtlasMapDocument, selectedLocationId?: string): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.undoStack.push(this.snapshot(document, selectedLocationId));
  }

  /**
   * Records a new state. Clears the redo stack. The oldest entry is
   * dropped when the undo stack exceeds the limit.
   */
  push(document: AtlasMapDocument, selectedLocationId?: string): void {
    this.redoStack.length = 0;
    this.undoStack.push(this.snapshot(document, selectedLocationId));
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit);
    }
  }

  /** Returns true if undo is possible. */
  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  /** Returns true if redo is possible. */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Undoes the last command. Returns the restored snapshot or `null` if
   * nothing to undo. The current (pre-undo) state is pushed to redo.
   */
  undo(): EditorSnapshot | null {
    if (!this.canUndo()) {
      return null;
    }
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.undoStack[this.undoStack.length - 1];
  }

  /**
   * Redoes the last undone command. Returns the restored snapshot or
   * `null` if nothing to redo.
   */
  redo(): EditorSnapshot | null {
    if (!this.canRedo()) {
      return null;
    }
    const snapshot = this.redoStack.pop()!;
    this.undoStack.push(snapshot);
    return snapshot;
  }

  /** Clears all history (e.g. after a save that resets dirty state). */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private snapshot(document: AtlasMapDocument, selectedLocationId?: string): EditorSnapshot {
    return {
      document: cloneJson(document),
      selectedLocationId,
    };
  }
}
