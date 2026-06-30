/**
 * Atlas global settings types.
 *
 * Stores only small configuration and lightweight map-index records.
 * Large assets and map documents live in repositories/storage providers.
 */

import type { LogLevel } from '@/core/logger';
import type { AtlasMapIndexEntry } from '@/domain/map';

export type AtlasProviderMode = 'disabled' | 'sillytavern_current' | 'openai_compatible';

export interface AtlasSettings {
  readonly enabled: boolean;
  readonly openMode: 'floating' | 'fullscreen' | 'docked';
  readonly loggingLevel: LogLevel;
  readonly mapIndex: readonly AtlasMapIndexEntry[];

  // Spatial prompt injection settings (Milestone 5)
  readonly promptInjectionEnabled: boolean;
  readonly maxNearbyLocations: number;
  readonly includeDistances: boolean;
  readonly includeDangerInfo: boolean;
  readonly includeRouteRestrictions: boolean;
  readonly contextSizeLimit: number; // in tokens or character approximation
  readonly promptPosition: number; // -1 = NONE, 0 = IN_PROMPT, 1 = IN_CHAT, 2 = BEFORE_PROMPT
  readonly promptDepth: number; // insertion depth, e.g. 0 to 10000

  // Safe action settings (Milestone 8)
  readonly allowAdvancedScripts: boolean;
  readonly confirmImportedScripts: boolean;

  // Optional AI provider settings
  readonly textProviderMode: AtlasProviderMode;
  readonly textProviderBaseUrl: string;
  readonly textProviderApiKey: string;
  readonly textProviderModel: string;
  readonly textProviderTimeoutMs: number;
  readonly imageProviderMode: AtlasProviderMode;
  readonly imageProviderBaseUrl: string;
  readonly imageProviderApiKey: string;
  readonly imageProviderModel: string;
  readonly imageProviderResolution: string;
  readonly imageProviderTimeoutMs: number;
}

export const DEFAULT_SETTINGS: Readonly<AtlasSettings> = Object.freeze({
  enabled: true,
  openMode: 'floating',
  loggingLevel: 'info',
  mapIndex: [],

  // Spatial prompt defaults
  promptInjectionEnabled: true,
  maxNearbyLocations: 5,
  includeDistances: true,
  includeDangerInfo: true,
  includeRouteRestrictions: true,
  contextSizeLimit: 300, // target budget in tokens (~1500 chars)
  promptPosition: 1, // default IN_CHAT (in chat context)
  promptDepth: 0, // default top insertion

  // Advanced imported scripts are disabled unless the user opts in.
  allowAdvancedScripts: false,
  confirmImportedScripts: true,

  // AI providers are optional and disabled by default.
  textProviderMode: 'disabled',
  textProviderBaseUrl: '',
  textProviderApiKey: '',
  textProviderModel: '',
  textProviderTimeoutMs: 30000,
  imageProviderMode: 'disabled',
  imageProviderBaseUrl: '',
  imageProviderApiKey: '',
  imageProviderModel: '',
  imageProviderResolution: '1024x1024',
  imageProviderTimeoutMs: 60000,
});
