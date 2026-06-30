/**
 * Bounded undo/redo history for the editor.
 *
 * Snapshot-based: stores the working document plus selection coordinates.
 */

import type { AtlasMapDocument } from '@/domain/map';
import { cloneJson } from '@/repositories/repository-utils';

export const MAX_HISTORY = 100;

export interface EditorSnapshot {
  readonly document: AtlasMapDocument;
  readonly selectedItemId?: string;
  readonly selectedType?: 'location' | 'region' | 'route';
}

export class EditorHistory {
  private readonly undoStack: EditorSnapshot[] = [];
  private readonly redoStack: EditorSnapshot[] = [];
  private readonly limit: number;

  constructor(limit: number = MAX_HISTORY) {
    this.limit = limit;
  }

  initialize(
    document: AtlasMapDocument,
    selectedItemId?: string,
    selectedType?: 'location' | 'region' | 'route',
  ): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.undoStack.push(this.snapshot(document, selectedItemId, selectedType));
  }

  push(
    document: AtlasMapDocument,
    selectedItemId?: string,
    selectedType?: 'location' | 'region' | 'route',
  ): void {
    this.redoStack.length = 0;
    this.undoStack.push(this.snapshot(document, selectedItemId, selectedType));
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit);
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): EditorSnapshot | null {
    if (!this.canUndo()) {
      return null;
    }
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.undoStack[this.undoStack.length - 1];
  }

  redo(): EditorSnapshot | null {
    if (!this.canRedo()) {
      return null;
    }
    const snapshot = this.redoStack.pop()!;
    this.undoStack.push(snapshot);
    return snapshot;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private snapshot(
    document: AtlasMapDocument,
    selectedItemId?: string,
    selectedType?: 'location' | 'region' | 'route',
  ): EditorSnapshot {
    return {
      document: cloneJson(document),
      selectedItemId,
      selectedType,
    };
  }
}
