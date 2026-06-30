/**
 * TravelService boundary types.
 *
 * Coordinates chat state loading, saving, validation, repair, and routing.
 * Concrete implementation lives in `travel-service.ts`.
 */

import type { TravelSource, AtlasChatState } from '@/domain/travel/chat-state';
import type { AtlasMapDocument } from '@/domain/map';

/** Result of a travel attempt. */
export interface TravelResult {
  readonly success: boolean;
  readonly requiresOverride?: boolean;
  readonly error?: string;
}

/** Travel and Chat State coordination contract. */
export interface TravelService {
  /**
   * Moves the player to a location.
   * If a route exists, requires it to be directly connected, otherwise
   * returns success: false + requiresOverride: true.
   * If force: true is passed, bypasses route validation.
   */
  travelTo(locationId: string, source: TravelSource, force?: boolean): Promise<TravelResult>;

  /** Returns the current location id for the active chat, or null. */
  getCurrentLocationId(): string | null;

  /** Returns the active map id for the active chat, or null. */
  getActiveMapId(): string | null;

  /** Sets the active map for the current chat, loading its default location. */
  setActiveMapId(mapId: string | undefined): Promise<void>;

  /** Reconciles the active chat's metadata, repairing stale references. */
  reconcileActiveChatState(): Promise<void>;

  /** Marks a location as discovered in the active chat. */
  discoverLocation(locationId: string): Promise<void>;

  /** Marks a region as discovered in the active chat. */
  discoverRegion(regionId: string): Promise<void>;

  /** Returns the full parsed chat state (for the UI / viewer). */
  loadChatState(): Promise<AtlasChatState>;

  /** Loads a map document by id from storage, returning null if absent. */
  loadMapDocument(mapId: string): Promise<AtlasMapDocument | null>;
}
