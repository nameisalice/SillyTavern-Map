/**
 * Atlas global settings types.
 *
 * Stores only small configuration and lightweight map-index records.
 * Large assets and map documents live in repositories/storage providers.
 */

import type { LogLevel } from '@/core/logger';
import type { AtlasMapIndexEntry } from '@/domain/map';

export interface AtlasSettings {
  readonly enabled: boolean;
  readonly openMode: 'floating' | 'fullscreen' | 'docked';
  readonly loggingLevel: LogLevel;
  /** Lightweight map index only; never stores large image blobs. */
  readonly mapIndex: readonly AtlasMapIndexEntry[];
}

export const DEFAULT_SETTINGS: Readonly<AtlasSettings> = Object.freeze({
  enabled: true,
  openMode: 'floating',
  loggingLevel: 'info',
  mapIndex: [],
});
