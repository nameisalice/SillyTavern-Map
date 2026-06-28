/**
 * Settings bridge: reads and writes Atlas global preferences through
 * `SillyTavern.getContext().extensionSettings`, never touching host
 * internals directly.
 *
 * The bridge also keeps the logger level in sync with the stored
 * `loggingLevel` preference.
 */

import { SETTINGS_KEY } from '@/constants';
import { DEFAULT_SETTINGS, type AtlasSettings } from '@/types/settings';
import { getContext } from '@/st/context';
import { setLogLevel } from '@/infra/logger';

/**
 * Returns the raw (possibly partial) record stored under the Atlas key.
 * Could be `{}` on first install.
 */
function readRawSettings(): Record<string, unknown> {
  const context = getContext();
  const bucket = context.extensionSettings[SETTINGS_KEY];
  if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
    return bucket as Record<string, unknown>;
  }
  return {};
}

/**
 * Deep-merges a stored partial over the defaults. Only known keys are
 * copied; unknown keys are dropped so a corrupt or older settings blob
 * cannot introduce unexpected state.
 */
export function mergeDefaults(stored: Record<string, unknown>): AtlasSettings {
  const known: Record<keyof AtlasSettings, unknown> = {
    enabled: stored['enabled'],
    openMode: stored['openMode'],
    loggingLevel: stored['loggingLevel'],
    mapIndex: stored['mapIndex'],
  };

  const enabled = typeof known.enabled === 'boolean' ? known.enabled : DEFAULT_SETTINGS.enabled;

  const openMode =
    known.openMode === 'floating' || known.openMode === 'fullscreen' || known.openMode === 'docked'
      ? known.openMode
      : DEFAULT_SETTINGS.openMode;

  const loggingLevel =
    known.loggingLevel === 'error' ||
    known.loggingLevel === 'warn' ||
    known.loggingLevel === 'info' ||
    known.loggingLevel === 'debug'
      ? known.loggingLevel
      : DEFAULT_SETTINGS.loggingLevel;

  const mapIndex = Array.isArray(known.mapIndex)
    ? known.mapIndex.filter((entry): entry is AtlasSettings['mapIndex'][number] => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return false;
        }
        const item = entry as Record<string, unknown>;
        return (
          typeof item['id'] === 'string' &&
          typeof item['name'] === 'string' &&
          typeof item['type'] === 'string' &&
          typeof item['updatedAt'] === 'string'
        );
      })
    : DEFAULT_SETTINGS.mapIndex;

  return { enabled, openMode, loggingLevel, mapIndex };
}

/**
 * Loads Atlas settings, applying defaults for any missing or invalid
 * field, and syncs the logger to the stored level. Returns the resolved
 * settings object.
 */
export function loadSettings(): AtlasSettings {
  const merged = mergeDefaults(readRawSettings());
  setLogLevel(merged.loggingLevel);
  return merged;
}

/**
 * Persists updated Atlas settings back to the host settings object and
 * schedules a debounced save. The stored bucket is replaced wholesale
 * with the merged value to avoid partial writes.
 */
export function saveSettings(next: Partial<AtlasSettings>): void {
  const context = getContext();
  const current = mergeDefaults(readRawSettings());
  const updated: AtlasSettings = {
    enabled: next.enabled ?? current.enabled,
    openMode: next.openMode ?? current.openMode,
    loggingLevel: next.loggingLevel ?? current.loggingLevel,
    mapIndex: next.mapIndex ?? current.mapIndex,
  };

  context.extensionSettings[SETTINGS_KEY] = updated;
  setLogLevel(updated.loggingLevel);
  context.saveSettingsDebounced();
}

/** Stores the lightweight map index in extension settings. */
export function saveMapIndex(mapIndex: AtlasSettings['mapIndex']): void {
  saveSettings({ mapIndex });
}
