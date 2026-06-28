/**
 * Atlas global settings types.
 *
 * Milestone 0 only needs a minimal subset: whether Atlas is enabled,
 * the panel open mode, and the log level. The full settings shape
 * described in the development plan (§8.1) is intentionally not modeled
 * yet — fields are added as the milestones that use them land.
 *
 * Moved here from `src/types/settings.ts` during the M0.5 layering
 * pass. The legacy path re-exports this module for backward
 * compatibility.
 */

import type { LogLevel } from '@/core/logger';

/**
 * Minimal Atlas settings for the foundation milestone.
 * Every field has a default so a fresh install never reads `undefined`.
 */
export interface AtlasSettings {
  /** Master switch for the extension. */
  readonly enabled: boolean;
  /** How the Atlas panel is presented. */
  readonly openMode: 'floating' | 'fullscreen' | 'docked';
  /** Console log verbosity. */
  readonly loggingLevel: LogLevel;
}

/**
 * The default settings applied on first install or when a stored field
 * is missing.
 */
export const DEFAULT_SETTINGS: Readonly<AtlasSettings> = Object.freeze({
  enabled: true,
  openMode: 'floating',
  loggingLevel: 'info',
});
