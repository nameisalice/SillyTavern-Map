/**
 * M5 Spatial Context Service tests.
 *
 * Tests:
 * 1. Valid context generation (map details, location descriptive continuous rules).
 * 2. Exclusion of hidden/undiscovered locations.
 * 3. Inclusion of only direct reachable routes.
 * 4. Verification of max location count and size token budget limits (approximation).
 * 5. Feature disabling clears host prompts.
 * 6. Missing maps/locations clear host prompts.
 * 7. Context output matches exactly and deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasSpatialContextService } from '@/services/spatial-context-service';
import { MapRepository } from '@/repositories/map-repository';
import { MemoryStorageProvider } from './storage-helpers';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { AtlasTravelService } from '@/services/travel-service';
import { EventBus } from '@/core/events';
import * as promptBridge from '@/st/prompt-bridge';
import { saveSettings } from '@/st/settings-bridge';
import { CHAT_STATE_KEY } from '@/constants';
import * as contextBridge from '@/st/context';

describe('M5 Spatial Context Service', () => {
  let maps: MapRepository;
  let travel: AtlasTravelService;
  let eventBus: EventBus;
  let service: AtlasSpatialContextService;
  let mockContext: Record<string, unknown> & SillyTavernContext;
  let injectSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockContext = {
      chatMetadata: {},
      eventSource: {
        on: vi.fn(),
        removeListener: vi.fn(),
        once: vi.fn(),
      } as unknown as SillyTavernEventEmitter,
      eventTypes: {
        APP_READY: 'app_ready',
        CHAT_CHANGED: 'chat_id_changed',
        CHAT_CREATED: 'chat_created',
        CHAT_DELETED: 'chat_deleted',
      },
      saveMetadataDebounced: vi.fn(),
      saveSettingsDebounced: vi.fn(),
      setExtensionPrompt: vi.fn(),
      extensionSettings: {},
    } as unknown as Record<string, unknown> & SillyTavernContext;

    vi.spyOn(contextBridge, 'getContext').mockReturnValue(mockContext);
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(mockContext);

    // Reset spatial context settings defaults before each test
    saveSettings({
      promptInjectionEnabled: true,
      maxNearbyLocations: 5,
      includeDistances: true,
      includeDangerInfo: true,
      includeRouteRestrictions: true,
      contextSizeLimit: 300,
      promptPosition: 1,
      promptDepth: 0,
    });

    injectSpy = vi.spyOn(promptBridge, 'injectSpatialPrompt');
    clearSpy = vi.spyOn(promptBridge, 'clearSpatialPrompt');

    const storage = new MemoryStorageProvider();
    maps = new MapRepository(storage);
    eventBus = new EventBus();
    travel = new AtlasTravelService(maps, eventBus);
    service = new AtlasSpatialContextService(maps, travel);

    await maps.save(SOUTHERN_MARCHES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compiles valid spatial context with default continuity rule', async () => {
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'stone-gorge',
      discoveredLocationIds: ['stone-gorge', 'north-tower', 'unnamed-village'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const text = await service.previewContext();
    expect(text).toContain('[Atlas Spatial Context]');
    expect(text).toContain('Map: Southern Marches');
    expect(text).toContain('Current location: Stone Gorge');
    expect(text).toContain('Travel continuity: Characters are currently inside the Stone Gorge');
  });

  it('excludes hidden undiscovered locations from reachable list', async () => {
    // mournwood-gate connects to missing-point (which is hidden)
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'mournwood-gate',
      discoveredLocationIds: ['mournwood-gate'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    let text = await service.previewContext();
    expect(text).not.toContain('Missing Point'); // Excluded!

    // Discover missing-point
    const chatState = mockContext.chatMetadata[CHAT_STATE_KEY] as Record<string, unknown>;
    const discovered = chatState.discoveredLocationIds as string[];
    discovered.push('missing-point');
    text = await service.previewContext();
    expect(text).toContain('Missing Point'); // Now included!
  });

  it('respects max location limits by dropping locations from list', async () => {
    // northern-tower has 1 route (stone-gorge).
    // stone-gorge has 2 routes (north-tower, unnamed-village).
    // let's set maxNearbyLocations depth to 1
    saveSettings({ maxNearbyLocations: 1 });

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'stone-gorge',
      discoveredLocationIds: ['stone-gorge', 'north-tower', 'unnamed-village'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const text = await service.previewContext();
    // Counts occurrences of bullet markers "- "
    const count = (text.match(/^- /gm) || []).length;
    expect(count).toBeLessThanOrEqual(1);
  });

  it('enforces character/token limits by dropping sections', async () => {
    // set small context size limit: 30 tokens (~150 chars)
    saveSettings({ contextSizeLimit: 30 });

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'stone-gorge',
      discoveredLocationIds: ['stone-gorge', 'north-tower', 'unnamed-village'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const text = await service.previewContext();
    expect(text.length).toBeLessThanOrEqual(150);
    // Continuity rule or nearby locations were dropped to fit budget
  });

  it('truncates descriptions with an ellipsis and avoids splitting Unicode surrogate pairs', async () => {
    // Large description containing emoji surrogate pairs
    const unicodeStory = 'A massive mountain path decorated by ancient runes 🛡️⚔️. Legend says dragons reside here.';
    const customMap = {
      ...SOUTHERN_MARCHES,
      locations: [
        {
          ...SOUTHERN_MARCHES.locations[0],
          id: 'test-loc',
          name: 'Runes',
          description: unicodeStory,
        },
      ],
      routes: [],
      defaultLocationId: 'test-loc',
    };
    await maps.save(customMap);

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: customMap.id,
      activeLocationId: 'test-loc',
      discoveredLocationIds: ['test-loc'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    // Budget of 60 tokens (~300 chars) which will force description truncation
    // Basic layout is ~232 chars, full content is ~320 chars.
    saveSettings({ contextSizeLimit: 60 });
    const textDesc = await service.previewContext();
    expect(textDesc).toContain('...');
    expect(textDesc.length).toBeLessThanOrEqual(300);

    // Extreme budget (e.g. 3 tokens ~ 15 characters) which forces hard head truncation of the first line.
    // The first line is: "[Atlas Spatial Context]" which is 23 chars. 15 chars budget forces ellipsis truncation of this line.
    saveSettings({ contextSizeLimit: 3 });
    const textExtreme = await service.previewContext();
    expect(textExtreme.length).toBeLessThanOrEqual(15);
    expect(textExtreme.endsWith('...')).toBe(true);

    // Make sure no surrogate pairs are cut in half (valid javascript string check)
    expect(isStringCodeValid(textExtreme)).toBe(true);
  });

  it('triggers clearSpatialPrompt when spatial injection or Atlas is disabled', async () => {
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'stone-gorge',
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    // Disabled injection
    saveSettings({ promptInjectionEnabled: false });
    await service.rebuildContext();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // Re-enable and verify it injects
    saveSettings({ promptInjectionEnabled: true });
    await service.rebuildContext();
    expect(injectSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers clearSpatialPrompt when active map or location is missing', async () => {
    // Missing activeMapId
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: undefined,
      activeLocationId: undefined,
      discoveredLocationIds: [],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    await service.rebuildContext();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('is deterministic for the same state', async () => {
    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'stone-gorge',
      discoveredLocationIds: ['stone-gorge', 'north-tower', 'unnamed-village'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const text1 = await service.previewContext();
    const text2 = await service.previewContext();
    expect(text1).toBe(text2);
  });
});

function isStringCodeValid(str: string): boolean {
  // Checks for unpaired surrogate halves in Javascript
  const unpairedSurrogate = /[\uD800-\uDBFF][^\uDC00-\uDFFF]|[^\uD800-\uDBFF][\uDC00-\uDFFF]/;
  return !unpairedSurrogate.test(str);
}
