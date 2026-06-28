/**
 * Ambient type declarations for the SillyTavern host environment.
 *
 * These types describe only the subset of the `SillyTavern.getContext()`
 * surface that SillyTavern Atlas currently consumes. They are intentionally
 * narrow and `any`-free: unknown properties are omitted rather than typed
 * loosely, so the compiler keeps us honest as the host API evolves.
 *
 * Verified against `public/scripts/st-context.js` in SillyTavern/SillyTavern.
 */

/** Stable log prefix used by every Atlas log line. */
declare const SillyTavernAtlasBuild: unknown;

/**
 * Subset of the object returned by `SillyTavern.getContext()`.
 * Only fields Atlas relies on are declared; new fields are added as
 * milestones begin to use them.
 */
interface SillyTavernContext {
  /** Event bus used to subscribe to host lifecycle events. */
  readonly eventSource: JQuery;
  /** Map of host event type names to their string values. */
  readonly eventTypes: Record<string, string>;
  /** Per-extension settings object stored under the extension key. */
  readonly extensionSettings: Record<string, unknown>;
  /** Debounced saver for the host settings file. */
  readonly saveSettingsDebounced: () => void;
  /** Per-chat metadata object (mutable, chat-scoped). */
  readonly chatMetadata: Record<string, unknown>;
  /** Debounced saver for chat metadata. */
  readonly saveMetadataDebounced: () => void;
  /**
   * Renders an extension HTML template asynchronously. Templates are
   * required to live at `scripts/extensions/<extensionName>/<id>.html`.
   */
  readonly renderExtensionTemplateAsync: (
    extensionName: string,
    templateId: string,
    templateData?: Record<string, unknown>,
  ) => Promise<string>;
}

/**
 * The global `SillyTavern` object exposed by the host. Atlas never imports
 * host internals directly; it always goes through `getContext()`.
 */
declare const SillyTavern: {
  readonly getContext: () => SillyTavernContext;
};

/**
 * jQuery is provided by the host. The extension uses it only for the
 * `jQuery(async () => ...)` ready callback and minimal DOM composition,
 * consistent with the official extension pattern.
 */
declare const jQuery: JQueryStatic;
declare const $: JQueryStatic;

/** Toast notification helper provided by the host. */
declare const toastr: {
  readonly info: (message?: string, title?: string) => void;
  readonly success: (message?: string, title?: string) => void;
  readonly warning: (message?: string, title?: string) => void;
  readonly error: (message?: string, title?: string) => void;
};
