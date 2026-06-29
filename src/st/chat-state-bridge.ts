/**
 * ChatStateBridge: reads and writes per-chat Atlas state through the
 * SillyTavern `chatMetadata` object.
 *
 * It is pure host-I/O infrastructure: it parses the raw metadata bucket,
 * merges defaults, validates the structure, and serializes back. It
 * does not validate map or location document existence — that is a
 * service concern. It never caches the metadata object reference globally.
 */

import { CHAT_STATE_KEY } from '@/constants';
import { getContext } from '@/st/context';
import type { AtlasChatState } from '@/domain/travel/chat-state';

/** Default empty chat state. */
export const DEFAULT_CHAT_STATE: Readonly<AtlasChatState> = Object.freeze({
  version: 1,
  discoveredLocationIds: [],
  discoveredRegionIds: [],
  bookmarks: [],
  customMarkers: [],
  travelHistory: [],
});

/**
 * Loads the Atlas state for the current active chat. If missing,
 * malformed, or of an older schema, it returns a default version 1 state.
 * Never throws.
 */
export function loadChatMetadataState(): AtlasChatState {
  try {
    const context = getContext();
    const raw = context.chatMetadata[CHAT_STATE_KEY];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return mergeChatStateDefaults(raw as Record<string, unknown>);
    }
  } catch {
    // Host contexts might be unavailable in unit tests; degrade.
  }
  return { ...DEFAULT_CHAT_STATE };
}

/**
 * Persists the Atlas state to the active chat's metadata object and
 * schedules a debounced save.
 */
export function saveChatMetadataState(state: AtlasChatState): void {
  try {
    const context = getContext();
    context.chatMetadata[CHAT_STATE_KEY] = state;
    context.saveMetadataDebounced();
  } catch {
    // Host contexts might be unavailable in unit tests; degrade.
  }
}

/**
 * Validates the raw fields of an unknown object, merging them over
 * defaults. Keeps the model structurally sound.
 */
export function mergeChatStateDefaults(raw: Record<string, unknown>): AtlasChatState {
  const version = raw['version'] === 1 ? 1 : 1;
  const activeMapId = typeof raw['activeMapId'] === 'string' ? raw['activeMapId'] : undefined;
  const activeLocationId =
    typeof raw['activeLocationId'] === 'string' ? raw['activeLocationId'] : undefined;
  const campaignId = typeof raw['campaignId'] === 'string' ? raw['campaignId'] : undefined;

  const discoveredLocationIds = Array.isArray(raw['discoveredLocationIds'])
    ? raw['discoveredLocationIds'].filter((id): id is string => typeof id === 'string')
    : [];

  const discoveredRegionIds = Array.isArray(raw['discoveredRegionIds'])
    ? raw['discoveredRegionIds'].filter((id): id is string => typeof id === 'string')
    : [];

  const bookmarks = Array.isArray(raw['bookmarks'])
    ? raw['bookmarks']
        .filter(
          (b): b is Record<string, unknown> => b && typeof b === 'object' && !Array.isArray(b),
        )
        .map((b) => ({
          id: typeof b['id'] === 'string' ? b['id'] : '',
          mapId: typeof b['mapId'] === 'string' ? b['mapId'] : '',
          locationId: typeof b['locationId'] === 'string' ? b['locationId'] : undefined,
          label: typeof b['label'] === 'string' ? b['label'] : 'Bookmark',
          createdAt: typeof b['createdAt'] === 'string' ? b['createdAt'] : new Date().toISOString(),
        }))
        .filter((b) => b.id && b.mapId)
    : [];

  const customMarkers = Array.isArray(raw['customMarkers'])
    ? raw['customMarkers']
        .filter(
          (m): m is Record<string, unknown> => m && typeof m === 'object' && !Array.isArray(m),
        )
        .map((m) => ({
          id: typeof m['id'] === 'string' ? m['id'] : '',
          mapId: typeof m['mapId'] === 'string' ? m['mapId'] : '',
          label: typeof m['label'] === 'string' ? m['label'] : 'Marker',
          x: typeof m['x'] === 'number' && Number.isFinite(m['x']) ? m['x'] : 0,
          y: typeof m['y'] === 'number' && Number.isFinite(m['y']) ? m['y'] : 0,
          icon: typeof m['icon'] === 'string' ? m['icon'] : undefined,
        }))
        .filter((m) => m.id && m.mapId)
    : [];

  const travelHistory = Array.isArray(raw['travelHistory'])
    ? raw['travelHistory']
        .filter(
          (h): h is Record<string, unknown> => h && typeof h === 'object' && !Array.isArray(h),
        )
        .map((h) => ({
          mapId: typeof h['mapId'] === 'string' ? h['mapId'] : '',
          fromLocationId: typeof h['fromLocationId'] === 'string' ? h['fromLocationId'] : undefined,
          toLocationId: typeof h['toLocationId'] === 'string' ? h['toLocationId'] : '',
          timestamp: typeof h['timestamp'] === 'string' ? h['timestamp'] : new Date().toISOString(),
          source: (['user', 'click', 'slash', 'tool', 'parser'].includes(h['source'] as string)
            ? h['source']
            : 'user') as 'user' | 'click' | 'slash' | 'tool' | 'parser',
        }))
        .filter((h) => h.mapId && h.toLocationId)
    : [];

  const lastInjectedContextHash =
    typeof raw['lastInjectedContextHash'] === 'string' ? raw['lastInjectedContextHash'] : undefined;

  const fogStateRef =
    raw['fogStateRef'] &&
    typeof raw['fogStateRef'] === 'object' &&
    !Array.isArray(raw['fogStateRef'])
      ? {
          id:
            typeof (raw['fogStateRef'] as Record<string, unknown>)['id'] === 'string'
              ? ((raw['fogStateRef'] as Record<string, unknown>)['id'] as string)
              : '',
          mapId:
            typeof (raw['fogStateRef'] as Record<string, unknown>)['mapId'] === 'string'
              ? ((raw['fogStateRef'] as Record<string, unknown>)['mapId'] as string)
              : '',
        }
      : undefined;

  return {
    version,
    activeMapId,
    activeLocationId,
    campaignId,
    discoveredLocationIds,
    discoveredRegionIds,
    ...(fogStateRef && fogStateRef.id && fogStateRef.mapId ? { fogStateRef } : {}),
    bookmarks,
    customMarkers,
    travelHistory,
    lastInjectedContextHash,
  };
}
