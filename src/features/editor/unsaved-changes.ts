/**
 * Unsaved-change decision logic.
 *
 * Pure helper that decides what to do when the user attempts to leave,
 * switch maps, or open the viewer while the working document is dirty.
 * The actual confirmation dialog is shown by the editor dialog
 * controller; this function only resolves the decision so it can be
 * unit-tested.
 */

export type UnsavedAction = 'save' | 'discard' | 'cancel';

export type UnsavedPromptResponse = 'save' | 'discard' | 'cancel';

export interface UnsavedChangeDecision {
  /** Whether to proceed with the navigation/close action. */
  readonly proceed: boolean;
  /** Whether to save before proceeding. */
  readonly save: boolean;
}

/**
 * Resolves a confirmation response into a decision. When the working
 * document is not dirty, no prompt is needed and the action proceeds
 * without saving.
 */
export function resolveUnsavedChange(
  isDirty: boolean,
  response: UnsavedPromptResponse | null,
): UnsavedChangeDecision {
  if (!isDirty) {
    return { proceed: true, save: false };
  }
  switch (response) {
    case 'save':
      return { proceed: true, save: true };
    case 'discard':
      return { proceed: true, save: false };
    case 'cancel':
    case null:
      return { proceed: false, save: false };
  }
}

/** The three standard actions offered by the unsaved-change guard. */
export const UNSAVED_ACTIONS: readonly UnsavedAction[] = ['save', 'discard', 'cancel'];
