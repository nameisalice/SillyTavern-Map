/**
 * TravelService implementation.
 *
 * Persists per-chat Atlas state using SillyTavern chat metadata via
 * `loadChatMetadataState` / `saveChatMetadataState` bridge functions.
 * Coordinates chat state loading, saving, validation, repair, and routing.
 *
 * Listens to SillyTavern events: app ready, chat changed, chat created,
 * and chat deleted to automatically refresh active map and location state
 * and emit corresponding Atlas EventBus events.
 */

import type { TravelService, TravelResult } from './travel-service.types';
import type { TravelSource, AtlasChatState } from '@/domain/travel/chat-state';
import { loadChatMetadataState, saveChatMetadataState } from '@/st/chat-state-bridge';
import type { MapRepository } from '@/repositories';
import type { EventBus } from '@/core/events';
import { logInfo, logWarn } from '@/core/logger';

export class AtlasTravelService implements TravelService {
  constructor(
    private readonly maps: MapRepository,
    private readonly eventBus: EventBus,
  ) {}

  async travelTo(locationId: string, source: TravelSource, force = false): Promise<TravelResult> {
    const state = await this.loadChatState();
    const mapId = state.activeMapId;
    if (!mapId) {
      return { success: false, error: 'No active map.' };
    }

    const map = await this.maps.load(mapId);
    if (!map) {
      return { success: false, error: `Active map "${mapId}" not found.` };
    }

    const location = map.locations.find((l) => l.id === locationId);
    if (!location) {
      return { success: false, error: `Location "${locationId}" not found on map.` };
    }

    const fromLocationId = state.activeLocationId ?? null;

    if (!force) {
      // Route validation:
      // - Permit movement when no routes exist.
      // - When routes exist, require a direct valid route.
      const hasRoutes = map.routes && map.routes.length > 0;
      if (hasRoutes && fromLocationId) {
        const hasConnectedRoute = map.routes.some((route) => {
          const matchesEndpoints =
            (route.fromLocationId === fromLocationId && route.toLocationId === locationId) ||
            (route.bidirectional &&
              route.fromLocationId === locationId &&
              route.toLocationId === fromLocationId);
          return matchesEndpoints;
        });

        if (!hasConnectedRoute) {
          return { success: false, requiresOverride: true };
        }
      }
    }

    // Save travel history and update location
    const now = new Date().toISOString();
    const historyEntry = {
      mapId,
      fromLocationId: fromLocationId ?? undefined,
      toLocationId: locationId,
      timestamp: now,
      source,
    };

    const updatedState: AtlasChatState = {
      ...state,
      activeLocationId: locationId,
      travelHistory: [...state.travelHistory, historyEntry],
    };

    saveChatMetadataState(updatedState);

    // Emit Atlas EventBus events
    this.eventBus.emit('TravelStarted', { fromLocationId, toLocationId: locationId });
    this.eventBus.emit('TravelFinished', { toLocationId: locationId });
    this.eventBus.emit('TravelRecorded', { entry: historyEntry });
    // Backward compatibility or direct location events
    this.eventBus.emit('LocationChanged', { mapId, locationId });
    logInfo(`Traveled to location "${locationId}" (source: ${source}).`);

    return { success: true };
  }

  getCurrentLocationId(): string | null {
    const state = loadChatMetadataState();
    return state.activeLocationId ?? null;
  }

  getActiveMapId(): string | null {
    const state = loadChatMetadataState();
    return state.activeMapId ?? null;
  }

  async setActiveMapId(mapId: string | undefined): Promise<void> {
    const state = await this.loadChatState();
    const oldMapId = state.activeMapId;
    if (oldMapId === mapId) {
      return;
    }

    let defaultLocationId: string | undefined;
    if (mapId) {
      const map = await this.maps.load(mapId);
      if (map) {
        defaultLocationId = map.defaultLocationId ?? undefined;
      }
    }

    const updatedState: AtlasChatState = {
      ...state,
      activeMapId: mapId,
      activeLocationId: defaultLocationId,
    };

    saveChatMetadataState(updatedState);
    this.eventBus.emit('ActiveMapChanged', { oldMapId, newMapId: mapId });
    if (defaultLocationId) {
      this.eventBus.emit('LocationChanged', { mapId: mapId!, locationId: defaultLocationId });
    }
  }

  async discoverLocation(locationId: string): Promise<void> {
    const state = await this.loadChatState();
    if (state.discoveredLocationIds.includes(locationId)) {
      return;
    }
    const updatedState: AtlasChatState = {
      ...state,
      discoveredLocationIds: [...state.discoveredLocationIds, locationId],
    };
    saveChatMetadataState(updatedState);
    this.eventBus.emit('DiscoveryChanged', {
      locationIds: updatedState.discoveredLocationIds,
      regionIds: updatedState.discoveredRegionIds,
    });
  }

  async discoverRegion(regionId: string): Promise<void> {
    const state = await this.loadChatState();
    if (state.discoveredRegionIds.includes(regionId)) {
      return;
    }
    const updatedState: AtlasChatState = {
      ...state,
      discoveredRegionIds: [...state.discoveredRegionIds, regionId],
    };
    saveChatMetadataState(updatedState);
    this.eventBus.emit('DiscoveryChanged', {
      locationIds: updatedState.discoveredLocationIds,
      regionIds: updatedState.discoveredRegionIds,
    });
  }

  async loadChatState(): Promise<AtlasChatState> {
    return loadChatMetadataState();
  }

  /**
   * Reconciles the active chat's metadata, repairing stale references in
   * activeMapId or activeLocationId without deleting documents.
   */
  async reconcileActiveChatState(): Promise<void> {
    const state = loadChatMetadataState();
    let dirty = false;
    let activeMapId = state.activeMapId;
    let activeLocationId = state.activeLocationId;

    if (activeMapId) {
      const map = await this.maps.load(activeMapId);
      if (!map) {
        activeMapId = undefined;
        activeLocationId = undefined;
        dirty = true;
        logWarn(`Active map "${state.activeMapId}" no longer exists; cleared from chat state.`);
        this.showToast('Active map no longer exists in library.', 'warning');
      } else if (activeLocationId) {
        const location = map.locations.find((l) => l.id === activeLocationId);
        if (!location) {
          activeLocationId = undefined;
          dirty = true;
          logWarn(
            `Active location "${state.activeLocationId}" no longer exists in map "${activeMapId}"; cleared.`,
          );
          this.showToast('Active location no longer exists on map.', 'warning');
        }
      }
    }

    if (dirty) {
      const repaired: AtlasChatState = {
        ...state,
        activeMapId,
        activeLocationId,
      };
      saveChatMetadataState(repaired);
    }
  }

  private showToast(message: string, type: 'warning' | 'info'): void {
    if (typeof toastr !== 'undefined') {
      if (type === 'warning') {
        toastr.warning(message, 'Atlas');
      } else {
        toastr.info(message, 'Atlas');
      }
    }
  }
}
