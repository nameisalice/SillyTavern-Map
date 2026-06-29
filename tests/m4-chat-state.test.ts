/**
 * M4 Chat State & Travel Service tests.
 *
 * Tests:
 * 1. missing metadata uses defaults
 * 2. malformed metadata is handled safely
 * 3. two chats retain different maps and locations (using simulated host switches)
 * 4. travel history was appended correctly
 * 5. direct route validation and override behavior
 * 6. deleted map/location reference recovery
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasTravelService } from '@/services/travel-service';
import { MapRepository } from '@/repositories/map-repository';
import { MemoryStorageProvider } from './storage-helpers';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { EventBus } from '@/core/events';
import { CHAT_STATE_KEY } from '@/constants';
import * as contextBridge from '@/st/context';
import { ChatStateCoordinator } from '@/app/chat-state-coordinator';
import { MapSeedingService } from '@/services/map-seeding-service';

interface MockContext {
  chatMetadata: Record<string, unknown>;
  eventSource: {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
  };
  eventTypes: Record<string, string>;
  saveMetadataDebounced: () => void;
}

describe('M4 Chat State and Travel Service', () => {
  let mockContext: MockContext;
  let maps: MapRepository;
  let travelService: AtlasTravelService;
  let eventBus: EventBus;

  beforeEach(() => {
    mockContext = {
      chatMetadata: {},
      eventSource: {
        on: vi.fn(),
        removeListener: vi.fn(),
        once: vi.fn(),
      },
      eventTypes: {
        APP_READY: 'app_ready',
        CHAT_CHANGED: 'chat_id_changed',
        CHAT_CREATED: 'chat_created',
        CHAT_DELETED: 'chat_deleted',
      },
      saveMetadataDebounced: vi.fn(),
    };

    // Stubs getContext to return our mock context
    vi.spyOn(contextBridge, 'getContext').mockReturnValue(
      mockContext as unknown as SillyTavernContext,
    );
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(
      mockContext as unknown as SillyTavernContext,
    );

    const storage = new MemoryStorageProvider();
    maps = new MapRepository(storage);
    eventBus = new EventBus();
    travelService = new AtlasTravelService(maps, eventBus);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ChatStateCoordinator binds host listeners and MapSeedingService seeds map', async () => {
    // 1. Test coordinator binding
    const coordinator = new ChatStateCoordinator(travelService, eventBus);
    coordinator.initialize();

    expect(mockContext.eventSource.on).toHaveBeenCalledWith('app_ready', expect.any(Function));
    expect(mockContext.eventSource.on).toHaveBeenCalledWith(
      'chat_id_changed',
      expect.any(Function),
    );
    expect(mockContext.eventSource.on).toHaveBeenCalledWith('chat_created', expect.any(Function));
    expect(mockContext.eventSource.on).toHaveBeenCalledWith('chat_deleted', expect.any(Function));

    // 2. Test seeding service
    const seeder = new MapSeedingService(maps);
    expect(await maps.exists(SOUTHERN_MARCHES.id)).toBe(false);
    await seeder.seed();
    expect(await maps.exists(SOUTHERN_MARCHES.id)).toBe(true);
  });

  it('missing metadata uses default chat state', async () => {
    mockContext.chatMetadata = {};
    const state = await travelService.loadChatState();
    expect(state.version).toBe(1);
    expect(state.discoveredLocationIds).toEqual([]);
    expect(state.travelHistory).toEqual([]);
  });

  it('malformed metadata is safely merged and recovered', async () => {
    mockContext.chatMetadata = {
      [CHAT_STATE_KEY]: {
        version: 'corrupt-string',
        activeMapId: 12345, // invalid type
        discoveredLocationIds: 'not-an-array',
        travelHistory: [{ mapId: 'invalid-entry-with-no-toLocationId' }],
      },
    };
    const state = await travelService.loadChatState();
    expect(state.version).toBe(1);
    expect(state.activeMapId).toBeUndefined();
    expect(state.discoveredLocationIds).toEqual([]);
    expect(state.travelHistory).toEqual([]);
  });

  it('appending travel history correctly', async () => {
    await maps.save(SOUTHERN_MARCHES);
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const travelResult = await travelService.travelTo('stone-gorge', 'click', false);
    expect(travelResult.success).toBe(true);

    const state = await travelService.loadChatState();
    expect(state.activeLocationId).toBe('stone-gorge');
    expect(state.travelHistory).toHaveLength(1);
    expect(state.travelHistory[0]).toMatchObject({
      mapId: SOUTHERN_MARCHES.id,
      fromLocationId: 'north-tower',
      toLocationId: 'stone-gorge',
      source: 'click',
    });
  });

  it('validation enforces direct route connections, supporting override (force)', async () => {
    await maps.save(SOUTHERN_MARCHES);
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    // There is no route direct from north-tower to mournwood-gate
    // (routes go north-tower <-> stone-gorge <-> unnamed-village <-> ...)
    const failedResult = await travelService.travelTo('mournwood-gate', 'click', false);
    expect(failedResult.success).toBe(false);
    expect(failedResult.requiresOverride).toBe(true);

    // Force travel bypasses route validation
    const forcedResult = await travelService.travelTo('mournwood-gate', 'click', true);
    expect(forcedResult.success).toBe(true);

    const state = await travelService.loadChatState();
    expect(state.activeLocationId).toBe('mournwood-gate');
  });

  it('permits movement when map has no routes', async () => {
    const mapWithoutRoutes = { ...SOUTHERN_MARCHES, routes: [] };
    await maps.save(mapWithoutRoutes);

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: mapWithoutRoutes.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const result = await travelService.travelTo('mournwood-gate', 'click', false);
    expect(result.success).toBe(true);
  });

  it('reconciles and repairs stale location references when loaded', async () => {
    await maps.save(SOUTHERN_MARCHES);

    // Setting active state referencing missing location ID
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'missing-stale-id',
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    await travelService.reconcileActiveChatState();

    const state = await travelService.loadChatState();
    expect(state.activeLocationId).toBeUndefined(); // Cleared because stale!
  });

  it('simulates rapid chat tab switching while retaining independent states', async () => {
    await maps.save(SOUTHERN_MARCHES);

    // Dynamic metadata cache representing Chat A
    const chatAMetadata = {
      [CHAT_STATE_KEY]: {
        version: 1,
        activeMapId: SOUTHERN_MARCHES.id,
        activeLocationId: 'north-tower',
        travelHistory: [],
      },
    };

    // Dynamic metadata cache representing Chat B
    const chatBMetadata = {
      [CHAT_STATE_KEY]: {
        version: 1,
        activeMapId: SOUTHERN_MARCHES.id,
        activeLocationId: 'mournwood-gate',
        travelHistory: [],
      },
    };

    // Switch to Chat A
    mockContext.chatMetadata = chatAMetadata;
    expect(travelService.getCurrentLocationId()).toBe('north-tower');

    // Switch to Chat B
    mockContext.chatMetadata = chatBMetadata;
    expect(travelService.getCurrentLocationId()).toBe('mournwood-gate');
  });
});
