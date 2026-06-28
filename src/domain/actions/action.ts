/**
 * Declarative action domain types.
 *
 * Derived from the development plan (§6.5). An action is a safe,
 * declarative operation triggered by clicking a location or region.
 * The discriminated union makes each action type-safe.
 *
 * `run_stscript` is the only permission-gated action and always
 * requires confirmation. Pure type declarations — the safe action
 * engine that executes them arrives in a later milestone.
 */

/** Sets the player's current location. */
export interface SetLocationAction {
  readonly type: 'set_location';
  readonly locationId: string;
}

/** Opens a nested (child) map. */
export interface OpenMapAction {
  readonly type: 'open_map';
  readonly mapId: string;
  readonly locationId?: string;
}

/** Sets a known SillyTavern background by name. */
export interface SetBackgroundAction {
  readonly type: 'set_background';
  readonly backgroundName: string;
}

/** Inserts a fixed system note after user confirmation. */
export interface SendSystemNoteAction {
  readonly type: 'send_system_note';
  readonly text: string;
}

/** Runs a Quick Reply set/label. */
export interface RunQuickReplyAction {
  readonly type: 'run_quick_reply';
  readonly setName: string;
  readonly label: string;
}

/**
 * Runs raw STScript. Always `requiresConfirmation: true`; disabled by
 * default and marked untrusted when imported.
 */
export interface RunStscriptAction {
  readonly type: 'run_stscript';
  readonly script: string;
  readonly requiresConfirmation: true;
}

/** Any declarative action. */
export type AtlasAction =
  | SetLocationAction
  | OpenMapAction
  | SetBackgroundAction
  | SendSystemNoteAction
  | RunQuickReplyAction
  | RunStscriptAction;
