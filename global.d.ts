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

interface SillyTavernEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void | Promise<void>): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  once(event: string, listener: (...args: unknown[]) => void): void;
}

/**
 * Subset of the object returned by `SillyTavern.getContext()`.
 * Only fields Atlas relies on are declared; new fields are added as
 * milestones begin to use them.
 */
interface SillyTavernContext {
  /** Event bus used to subscribe to host lifecycle events. */
  readonly eventSource: SillyTavernEventEmitter;
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
  /** Inject an extension prompt into the chat context. */
  readonly setExtensionPrompt: (
    key: string,
    value: string,
    position: number,
    depth: number,
    scan?: boolean,
    role?: number,
    filter?: unknown,
  ) => void;
  /** Shows a host popup and resolves when it is dismissed. */
  readonly callGenericPopup: (
    content: HTMLElement | string,
    type: number,
    inputValue?: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  /** Host popup type enum values (TEXT, CONFIRM, INPUT, DISPLAY...). */
  readonly POPUP_TYPE: {
    readonly TEXT: number;
    readonly CONFIRM: number;
    readonly INPUT: number;
    readonly DISPLAY: number;
  };
  /** Whether the host considers the current client mobile. */
  readonly isMobile: () => boolean;
}

/**
 * The global `SillyTavern` object exposed by the host. Atlas never imports
 * host internals directly; it always goes through `getContext()`.
 */
declare const SillyTavern: {
  readonly getContext: () => SillyTavernContext;
};

/** Minimal localforage surface exposed by SillyTavern's public/lib.js shim. */
interface AtlasLocalForage {
  readonly setItem: <T>(key: string, value: T) => Promise<T>;
  readonly getItem: <T>(key: string) => Promise<T | null>;
  readonly removeItem: (key: string) => Promise<void>;
  readonly keys: () => Promise<string[]>;
}

interface Window {
  readonly localforage?: AtlasLocalForage;
}

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

/** Host-provided prompt injection positions. */
declare const extension_prompt_types: {
  readonly NONE: number;
  readonly IN_PROMPT: number;
  readonly IN_CHAT: number;
  readonly BEFORE_PROMPT: number;
};

/** Host-provided prompt injection message roles. */
declare const extension_prompt_roles: {
  readonly SYSTEM: number;
  readonly USER: number;
  readonly ASSISTANT: number;
};
