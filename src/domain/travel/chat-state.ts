/**
 * Per-chat Atlas state model.
 *
 * Derived from the development plan (§6.6) and Milestone 2's ChatState
 * requirements. This is a model only in M2; no chatMetadata integration
 * is implemented yet.
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

/** A bookmark saved by the user for quick return. */
export interface AtlasBookmark {
  readonly id: string;
  readonly mapId: string;
  readonly locationId?: string;
  readonly label: string;
  readonly createdAt: string;
}

/** A fog-of-war state reference. Actual fog data is stored separately. */
export interface AtlasFogStateRef {
  readonly id: string;
  readonly mapId: string;
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
 * chatMetadata key in a later milestone. Do not cache the `chatMetadata`
 * object reference globally; retrieve it from `getContext()` whenever
 * the current chat may have changed.
 */
export interface AtlasChatState {
  readonly version: 1;
  readonly activeMapId?: string;
  readonly activeLocationId?: string;
  readonly campaignId?: string;
  readonly discoveredLocationIds: readonly string[];
  readonly discoveredRegionIds: readonly string[];
  readonly fogStateRef?: AtlasFogStateRef;
  readonly bookmarks: readonly AtlasBookmark[];
  readonly customMarkers: readonly AtlasCustomMarker[];
  readonly travelHistory: readonly AtlasTravelHistoryEntry[];
  readonly lastInjectedContextHash?: string;
}
