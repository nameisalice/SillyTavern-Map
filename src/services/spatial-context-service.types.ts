/**
 * SpatialContextService boundary types.
 *
 * Exposes methods to compile and inject context, and to preview the
 * mock injection block in the UI.
 */

export interface SpatialContextService {
  /**
   * Compiles the concise spatial context for the active chat and
   * injects it into SillyTavern's prompt queue via setExtensionPrompt.
   * Clears the prompt if disabled, missing active data, or invalid.
   */
  rebuildContext(): Promise<void>;

  /**
   * Compiles and returns the prompt text for previewing in settings.
   * Never modifies the host prompt queue. Returns empty string if
   * disabled, invalid, or empty.
   */
  previewContext(): Promise<string>;
}
