/**
 * Editor state model.
 *
 * Editor-only state is kept separate from `AtlasMapDocument`. The
 * working document is a deep clone of a repository-owned document (or a
 * fresh draft); the editor never mutates repository-owned documents.
 * Selection, mode, and dirty flags live here, never inside the document.
 */

import type { AtlasMapDocument } from '@/domain/map';

export type EditorMode = 'edit' | 'preview';

/**
 * A snapshot of editor state. The `document` is the working copy the
 * editor is free to mutate; it is only persisted after validation.
 */
export interface AtlasEditorState {
  readonly document: AtlasMapDocument;
  readonly selectedLocationId?: string;
  readonly mode: EditorMode;
  readonly isDirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** Creates an initial editor state for a fresh working document. */
export function createEditorState(document: AtlasMapDocument): AtlasEditorState {
  return {
    document,
    mode: 'edit',
    isDirty: false,
    canUndo: false,
    canRedo: false,
  };
}
