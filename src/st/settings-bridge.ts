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
    promptInjectionEnabled: stored['promptInjectionEnabled'],
    maxNearbyLocations: stored['maxNearbyLocations'],
    includeDistances: stored['includeDistances'],
    includeDangerInfo: stored['includeDangerInfo'],
    includeRouteRestrictions: stored['includeRouteRestrictions'],
    contextSizeLimit: stored['contextSizeLimit'],
    promptPosition: stored['promptPosition'],
    promptDepth: stored['promptDepth'],
    allowAdvancedScripts: stored['allowAdvancedScripts'],
    confirmImportedScripts: stored['confirmImportedScripts'],
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

  const promptInjectionEnabled =
    typeof known.promptInjectionEnabled === 'boolean'
      ? known.promptInjectionEnabled
      : DEFAULT_SETTINGS.promptInjectionEnabled;

  const maxNearbyLocations =
    typeof known.maxNearbyLocations === 'number' && Number.isFinite(known.maxNearbyLocations)
      ? known.maxNearbyLocations
      : DEFAULT_SETTINGS.maxNearbyLocations;

  const includeDistances =
    typeof known.includeDistances === 'boolean'
      ? known.includeDistances
      : DEFAULT_SETTINGS.includeDistances;

  const includeDangerInfo =
    typeof known.includeDangerInfo === 'boolean'
      ? known.includeDangerInfo
      : DEFAULT_SETTINGS.includeDangerInfo;

  const includeRouteRestrictions =
    typeof known.includeRouteRestrictions === 'boolean'
      ? known.includeRouteRestrictions
      : DEFAULT_SETTINGS.includeRouteRestrictions;

  const contextSizeLimit =
    typeof known.contextSizeLimit === 'number' && Number.isFinite(known.contextSizeLimit)
      ? known.contextSizeLimit
      : DEFAULT_SETTINGS.contextSizeLimit;

  const promptPosition =
    typeof known.promptPosition === 'number' && Number.isFinite(known.promptPosition)
      ? known.promptPosition
      : DEFAULT_SETTINGS.promptPosition;

  const promptDepth =
    typeof known.promptDepth === 'number' && Number.isFinite(known.promptDepth)
      ? known.promptDepth
      : DEFAULT_SETTINGS.promptDepth;

  const allowAdvancedScripts =
    typeof known.allowAdvancedScripts === 'boolean'
      ? known.allowAdvancedScripts
      : DEFAULT_SETTINGS.allowAdvancedScripts;

  const confirmImportedScripts =
    typeof known.confirmImportedScripts === 'boolean'
      ? known.confirmImportedScripts
      : DEFAULT_SETTINGS.confirmImportedScripts;

  return {
    enabled,
    openMode,
    loggingLevel,
    mapIndex,
    promptInjectionEnabled,
    maxNearbyLocations,
    includeDistances,
    includeDangerInfo,
    includeRouteRestrictions,
    contextSizeLimit,
    promptPosition,
    promptDepth,
    allowAdvancedScripts,
    confirmImportedScripts,
  };
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
    promptInjectionEnabled: next.promptInjectionEnabled ?? current.promptInjectionEnabled,
    maxNearbyLocations: next.maxNearbyLocations ?? current.maxNearbyLocations,
    includeDistances: next.includeDistances ?? current.includeDistances,
    includeDangerInfo: next.includeDangerInfo ?? current.includeDangerInfo,
    includeRouteRestrictions: next.includeRouteRestrictions ?? current.includeRouteRestrictions,
    contextSizeLimit: next.contextSizeLimit ?? current.contextSizeLimit,
    promptPosition: next.promptPosition ?? current.promptPosition,
    promptDepth: next.promptDepth ?? current.promptDepth,
    allowAdvancedScripts: next.allowAdvancedScripts ?? current.allowAdvancedScripts,
    confirmImportedScripts: next.confirmImportedScripts ?? current.confirmImportedScripts,
  };

  context.extensionSettings[SETTINGS_KEY] = updated;
  setLogLevel(updated.loggingLevel);
  context.saveSettingsDebounced();
}

/** Stores the lightweight map index in extension settings. */
export function saveMapIndex(mapIndex: AtlasSettings['mapIndex']): void {
  saveSettings({ mapIndex });
}
