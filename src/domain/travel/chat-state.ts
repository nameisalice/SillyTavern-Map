/**
 * Per-chat travel state types.
 *
 * Derived from the development plan (§6.6). The current map, current
 * location, discovery state, custom markers, and travel history are
 * stored under a single `chatMetadata` key. Pure type declarations.
 */

/** Source that initiated a travel event. */
export type TravelSource = 'user' | 'click' | 'slash' | 'tool' | 'parser';

/** A custom marker placed by the user in a chat. */
export interface AtlasCustomMarker {
  readonly id: string;
  readonly mapId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly icon?: string;
}

/** A single travel history entry. */
export interface AtlasTravelHistoryEntry {
  readonly mapId: string;
  readonly fromLocationId?: string;
  readonly toLocationId: string;
  readonly timestamp: string;
  readonly source: TravelSource;
}

/**
 * The full per-chat Atlas state, stored under the `sillytavern_atlas`
 * chatMetadata key. Do not cache the `chatMetadata` object reference
 * globally; retrieve it from `getContext()` whenever the current chat
 * may have changed.
 */
export interface AtlasChatState {
  readonly schemaVersion: 1;
  readonly activeMapId?: string;
  readonly activeLocationId?: string;
  readonly discoveredLocationIds: readonly string[];
  readonly discoveredRegionIds: readonly string[];
  readonly customMarkers: readonly AtlasCustomMarker[];
  readonly travelHistory: readonly AtlasTravelHistoryEntry[];
  readonly lastInjectedContextHash?: string;
}
