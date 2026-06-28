/**
 * Tests for the settings merge logic.
 *
 * The bridge depends on `getContext()`, but the pure merge function can
 * be tested in isolation: it must apply defaults for missing fields and
 * reject unknown keys so a corrupt blob cannot poison the settings.
 */

import { describe, expect, it } from 'vitest';

import { mergeDefaults } from '@/st/settings-bridge';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('mergeDefaults', () => {
  it('returns the full defaults for an empty stored blob', () => {
    expect(mergeDefaults({})).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves valid stored values', () => {
    const result = mergeDefaults({
      enabled: false,
      openMode: 'fullscreen',
      loggingLevel: 'debug',
    });
    expect(result).toEqual({
      enabled: false,
      openMode: 'fullscreen',
      loggingLevel: 'debug',
      mapIndex: [],
    });
  });

  it('falls back to defaults for invalid field values', () => {
    const result = mergeDefaults({
      enabled: 'not-a-boolean',
      openMode: 'teleport',
      loggingLevel: 'verbose',
    });
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('drops unknown keys rather than carrying them through', () => {
    const result = mergeDefaults({
      enabled: true,
      openMode: 'floating',
      loggingLevel: 'info',
      promptInjectionEnabled: true,
      allowAdvancedScripts: true,
    });
    expect(result).toEqual(DEFAULT_SETTINGS);
    // Unknown keys must not appear on the typed result.
    expect((result as unknown as Record<string, unknown>).promptInjectionEnabled).toBeUndefined();
  });

  it('merges partial blobs field by field', () => {
    const result = mergeDefaults({ enabled: false });
    expect(result).toEqual({
      enabled: false,
      openMode: DEFAULT_SETTINGS.openMode,
      loggingLevel: DEFAULT_SETTINGS.loggingLevel,
      mapIndex: DEFAULT_SETTINGS.mapIndex,
    });
  });
});
