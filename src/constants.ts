/**
 * Project-wide constants for SillyTavern Atlas.
 *
 * Centralized so that the extension name, storage keys, and log prefix
 * are never duplicated as magic strings across modules.
 */

/**
 * Key under which Atlas global preferences are stored inside
 * `SillyTavern.getContext().extensionSettings`. Using a stable dotted
 * key avoids collisions with other extensions.
 */
export const SETTINGS_KEY = 'sillytavern_atlas';

/**
 * Stable prefix prepended to every log line produced by the logger.
 * Keeping it constant makes Atlas output easy to filter in the console.
 */
export const LOG_PREFIX = '[SillyTavern Atlas]';

/**
 * Key for the current chat's Atlas state in `chatMetadata`. Declared here
 * even though chat state is not used until a later milestone, so the key
 * stays in one canonical place from day one.
 */
export const CHAT_STATE_KEY = 'sillytavern_atlas';

/**
 * DOM selector for the Extensions menu container Atlas appends its
 * launcher button to. Host-provided selector; never overridden.
 */
export const EXTENSIONS_MENU_SELECTOR = '#extensionsMenu';

/**
 * DOM selector for the right-hand Extension Settings column where the
 * Atlas settings drawer is appended. Host-provided selector.
 */
export const EXTENSION_SETTINGS_SELECTOR = '#extensions_settings2';
