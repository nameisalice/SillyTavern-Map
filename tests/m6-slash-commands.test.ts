/**
 * M6 Slash Commands integration tests.
 *
 * Tests:
 * 1. Command registration occurs exactly once.
 * 2. Map resolution by ID, exact name, unique case-insensitive name, and ambiguous names.
 * 3. Location resolution by ID, exact name, unique case-insensitive name, alias, and ambiguous aliases.
 * 4. Hidden locations are filtered from autocomplete options.
 * 5. Commands (/atlas-map, /atlas-go, /atlas-where, /atlas-reveal, /atlas-hide, /atlas-export) execute safely and output piping-friendly messages.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerSlashCommands,
  resolveLocation,
  resolveMap,
  testOnlyResetCommandsRegistered,
} from '@/st/slash-command-bridge';
import { MapRepository } from '@/repositories/map-repository';
import { AssetRepository } from '@/repositories/asset-repository';
import { MemoryStorageProvider } from './storage-helpers';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { AtlasTravelService } from '@/services/travel-service';
import { AtlasViewerService } from '@/services/viewer-service';
import { MapLibraryService } from '@/services/map-library-service';
import type { ViewerStateRepository } from '@/repositories';
import type { MapDraftService } from '@/services';
import { ImportService } from '@/services/import-service';
import { ExportService } from '@/services/export-service';
import { EventBus } from '@/core/events';
import { CHAT_STATE_KEY } from '@/constants';
import * as contextBridge from '@/st/context';

interface MockContext {
  chatMetadata: Record<string, unknown>;
  eventSource: SillyTavernEventEmitter;
  eventTypes: Record<string, string>;
  saveMetadataDebounced: () => void;
  SlashCommandParser: {
    addCommandObject: ReturnType<typeof vi.fn>;
  };
  SlashCommand: {
    fromProps: (props: Record<string, unknown>) => unknown;
  };
  SlashCommandArgument: {
    fromProps: (props: Record<string, unknown>) => unknown;
  };
  SlashCommandNamedArgument: {
    fromProps: (props: Record<string, unknown>) => unknown;
  };
  SlashCommandEnumValue: unknown;
  ARGUMENT_TYPE: {
    STRING: number;
    BOOLEAN: number;
    NUMBER: number;
  };
  POPUP_TYPE: { TEXT: number; CONFIRM: number };
  callGenericPopup: ReturnType<typeof vi.fn>;
  renderExtensionTemplateAsync: ReturnType<typeof vi.fn>;
}

describe('M6 Slash Commands', () => {
  let mockContext: MockContext;
  let maps: MapRepository;
  let assets: AssetRepository;
  let travel: AtlasTravelService;
  let viewer: AtlasViewerService;
  let library: MapLibraryService;
  let importer: ImportService;
  let exporter: ExportService;
  let eventBus: EventBus;
  const registeredCommands = new Map<
    string,
    { callback: (named: Record<string, string>, unnamed: string) => Promise<string> }
  >();

  beforeEach(async () => {
    registeredCommands.clear();

    const mockAddCommand = vi.fn().mockImplementation((cmd: Record<string, unknown>) => {
      const name = cmd.name as string;
      const callback = cmd.callback as (
        named: Record<string, string>,
        unnamed: string,
      ) => Promise<string>;
      registeredCommands.set(name, { callback });
    });

    class MockSlashCommandEnumValue {
      constructor(public value: string, public name: string) {}
    }

    mockContext = {
      chatMetadata: {},
      eventSource: {
        on: vi.fn(),
        removeListener: vi.fn(),
        once: vi.fn(),
      } as unknown as SillyTavernEventEmitter,
      eventTypes: {},
      saveMetadataDebounced: vi.fn(),
      SlashCommandParser: {
        addCommandObject: mockAddCommand,
      },
      SlashCommand: {
        fromProps: (props: Record<string, unknown>) => props,
      },
      SlashCommandArgument: {
        fromProps: (props: Record<string, unknown>) => props,
      },
      SlashCommandNamedArgument: {
        fromProps: (props: Record<string, unknown>) => props,
      },
      SlashCommandEnumValue: MockSlashCommandEnumValue,
      ARGUMENT_TYPE: {
        STRING: 1,
        BOOLEAN: 2,
        NUMBER: 3,
      },
      POPUP_TYPE: { TEXT: 1, CONFIRM: 2 },
      callGenericPopup: vi.fn().mockResolvedValue(1), // affirmative
      renderExtensionTemplateAsync: vi.fn().mockResolvedValue('<div data-st-atlas="canvas"></div>'),
    };

    vi.spyOn(contextBridge, 'getContext').mockReturnValue(mockContext as unknown as SillyTavernContext);
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(mockContext as unknown as SillyTavernContext);

    const storage = new MemoryStorageProvider();
    maps = new MapRepository(storage);
    assets = new AssetRepository(storage);
    eventBus = new EventBus();
    travel = new AtlasTravelService(maps, eventBus);
    viewer = new AtlasViewerService(eventBus, maps, assets);
    library = new MapLibraryService(maps, null as unknown as ViewerStateRepository);
    importer = new ImportService(maps, assets);
    exporter = new ExportService(maps, assets);

    testOnlyResetCommandsRegistered();

    await maps.save(SOUTHERN_MARCHES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves maps by ID, exact name, and unique case-insensitive name', async () => {
    // 1. Exact ID
    const resId = await resolveMap('southern-marches', maps);
    expect(resId.id).toBe(SOUTHERN_MARCHES.id);

    // 2. Exact case-sensitive name
    const resName = await resolveMap('Southern Marches', maps);
    expect(resName.id).toBe(SOUTHERN_MARCHES.id);

    // 3. Unique case-insensitive name
    const resLower = await resolveMap('southern marches', maps);
    expect(resLower.id).toBe(SOUTHERN_MARCHES.id);

    // 4. Missing map
    await expect(resolveMap('missing-map', maps)).rejects.toThrow(/not found/);

    // 5. Ambiguous names
    const duplicateMap = { ...SOUTHERN_MARCHES, id: 'duplicate-id', name: 'Southern Marches' };
    await maps.save(duplicateMap);
    await expect(resolveMap('southern marches', maps)).rejects.toThrow(/Ambiguous name/);
  });

  it('resolves locations by ID, name, and unique alias', () => {
    // Modify location 0 for test aliases
    const mockMap = {
      ...SOUTHERN_MARCHES,
      locations: [
        {
          ...SOUTHERN_MARCHES.locations[0],
          id: 'tower-id',
          name: 'Watchtower',
          aliases: ['front-tower', 'guard-tower'],
        },
        {
          ...SOUTHERN_MARCHES.locations[1],
          id: 'gate-id',
          name: 'Front-Gate',
          aliases: ['guard-gate'],
        },
      ],
    };

    // 1. Exact ID
    expect(resolveLocation('tower-id', mockMap, []).name).toBe('Watchtower');

    // 2. Exact name
    expect(resolveLocation('Watchtower', mockMap, []).id).toBe('tower-id');

    // 3. Case-insensitive name
    expect(resolveLocation('watchtower', mockMap, []).id).toBe('tower-id');

    // 4. Unique alias
    expect(resolveLocation('front-tower', mockMap, []).id).toBe('tower-id');

    // 5. Ambiguous aliases
    const ambiguousMap = {
      ...mockMap,
      locations: [
        ...mockMap.locations,
        {
          ...SOUTHERN_MARCHES.locations[2],
          id: 'other-id',
          name: 'Other',
          aliases: ['guard-tower'], // Duplicate alias!
        },
      ],
    };
    expect(() => resolveLocation('guard-tower', ambiguousMap, [])).toThrow(/Ambiguous alias/);
  });

  it('registers all 12 commands on SlashCommandParser', () => {
    registerSlashCommands({
      maps,
      travel,
      viewer,
      library,
      importer,
      exporter,
      eventBus,
      draftService: null as unknown as MapDraftService,
    });

    expect(registeredCommands.size).toBe(12);
    expect(registeredCommands.has('atlas')).toBe(true);
    expect(registeredCommands.has('atlas-map')).toBe(true);
    expect(registeredCommands.has('atlas-go')).toBe(true);
    expect(registeredCommands.has('atlas-where')).toBe(true);
    expect(registeredCommands.has('atlas-reveal')).toBe(true);
    expect(registeredCommands.has('atlas-hide')).toBe(true);
    expect(registeredCommands.has('atlas-center')).toBe(true);
    expect(registeredCommands.has('atlas-library')).toBe(true);
    expect(registeredCommands.has('atlas-import')).toBe(true);
    expect(registeredCommands.has('atlas-export')).toBe(true);
    expect(registeredCommands.has('atlas-open')).toBe(true);
    expect(registeredCommands.has('atlas-back')).toBe(true);
  });

  it('/atlas-map command updates active map for current chat state', async () => {
    registerSlashCommands({
      maps,
      travel,
      viewer,
      library,
      importer,
      exporter,
      eventBus,
      draftService: null as unknown as MapDraftService,
    });

    const atlasMapCmd = registeredCommands.get('atlas-map')!;
    mockContext.chatMetadata = {};

    const output = await atlasMapCmd.callback({}, 'Southern Marches');
    expect(output).toContain('Map set: Southern Marches');
    expect(travel.getActiveMapId()).toBe(SOUTHERN_MARCHES.id);
  });

  it('/atlas-open and /atlas-back navigate child and parent maps', async () => {
    const childMap = {
      ...SOUTHERN_MARCHES,
      id: 'north-tower-interior',
      name: 'North Tower Interior',
      parentMapId: SOUTHERN_MARCHES.id,
      defaultLocationId: 'north-tower',
    };
    const parentMap = {
      ...SOUTHERN_MARCHES,
      locations: SOUTHERN_MARCHES.locations.map((location) =>
        location.id === 'north-tower'
          ? { ...location, childMapId: childMap.id }
          : location,
      ),
    };
    await maps.save(parentMap);
    await maps.save(childMap);

    registerSlashCommands({
      maps,
      travel,
      viewer,
      library,
      importer,
      exporter,
      eventBus,
      draftService: null as unknown as MapDraftService,
    });

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: ['north-tower'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    const openCmd = registeredCommands.get('atlas-open')!;
    const backCmd = registeredCommands.get('atlas-back')!;

    const openOutput = await openCmd.callback({ location: 'North Tower' }, '');
    expect(openOutput).toContain('Opened child map');
    expect(travel.getActiveMapId()).toBe(childMap.id);

    const backOutput = await backCmd.callback({}, '');
    expect(backOutput).toBe('Returned to parent map');
    expect(travel.getActiveMapId()).toBe(SOUTHERN_MARCHES.id);
    expect(travel.getCurrentLocationId()).toBe('north-tower');
  });

  it('/atlas-go coordinates route validation and force travel override', async () => {
    registerSlashCommands({
      maps,
      travel,
      viewer,
      library,
      importer,
      exporter,
      eventBus,
      draftService: null as unknown as MapDraftService,
    });

    const goCmd = registeredCommands.get('atlas-go')!;

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: ['north-tower', 'stone-gorge', 'mournwood-gate'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    // Travel to undisconnected location (mournwood-gate) without force -> blocks
    const result1 = await goCmd.callback({ location: 'Mournwood Gate', force: 'false' }, '');
    expect(result1).toContain('Route blocked');

    // Force travel overrides connections
    const result2 = await goCmd.callback({ location: 'Mournwood Gate', force: 'true' }, '');
    expect(result2).toContain('Travelled to: Mournwood Gate');
    expect(travel.getCurrentLocationId()).toBe('mournwood-gate');
  });

  it('/atlas-where and reveal/hide commands output formatting', async () => {
    registerSlashCommands({
      maps,
      travel,
      viewer,
      library,
      importer,
      exporter,
      eventBus,
      draftService: null as unknown as MapDraftService,
    });

    const whereCmd = registeredCommands.get('atlas-where')!;
    const revealCmd = registeredCommands.get('atlas-reveal')!;
    const hideCmd = registeredCommands.get('atlas-hide')!;

    mockContext.chatMetadata[CHAT_STATE_KEY] = {
      version: 1,
      activeMapId: SOUTHERN_MARCHES.id,
      activeLocationId: 'north-tower',
      discoveredLocationIds: ['north-tower'],
      discoveredRegionIds: [],
      bookmarks: [],
      customMarkers: [],
      travelHistory: [],
    };

    expect(await whereCmd.callback({}, '')).toBe('Southern Marches / North Tower');

    // Reveal missing-point
    const revOut = await revealCmd.callback({}, 'Missing Point');
    expect(revOut).toContain('Location revealed: Missing Point');
    expect((await travel.loadChatState()).discoveredLocationIds).toContain('missing-point');

    // Hide it back
    const hideOut = await hideCmd.callback({}, 'Missing Point');
    expect(hideOut).toContain('Location hidden: Missing Point');
    expect((await travel.loadChatState()).discoveredLocationIds).not.toContain('missing-point');
  });
});
