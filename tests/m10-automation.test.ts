import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AtlasAutomationService,
  parseAtlasStructuredCommands,
  stripAtlasStructuredCommands,
} from '@/services';
import { MapRepository } from '@/repositories';
import { MemoryStorageProvider } from './storage-helpers';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { EventBus } from '@/core/events';
import { AtlasTravelService } from '@/services/travel-service';
import { CHAT_STATE_KEY } from '@/constants';
import * as contextBridge from '@/st/context';
import { registerAtlasFunctionTools, unregisterAtlasFunctionTools } from '@/st/tool-bridge';

describe('M10 structured parser', () => {
  it('parses only exact Atlas tags and strips them safely', () => {
    const text =
      'Move maybe north tower <atlas-travel location="north-tower" /> and <atlas-reveal location="missing-point" />';

    expect(parseAtlasStructuredCommands(text)).toEqual([
      { type: 'travel', locationId: 'north-tower' },
      { type: 'reveal', locationId: 'missing-point' },
    ]);
    expect(parseAtlasStructuredCommands('go to north tower')).toEqual([]);
    expect(stripAtlasStructuredCommands(text)).toBe('Move maybe north tower  and');
  });
});

describe('M10 controlled automation service', () => {
  let mockContext: SillyTavernContext;
  let maps: MapRepository;
  let travel: AtlasTravelService;
  let automation: AtlasAutomationService;

  beforeEach(async () => {
    const storage = new MemoryStorageProvider();
    maps = new MapRepository(storage);
    await maps.save(SOUTHERN_MARCHES);
    mockContext = {
      chatMetadata: {
        [CHAT_STATE_KEY]: {
          version: 1,
          activeMapId: SOUTHERN_MARCHES.id,
          activeLocationId: 'north-tower',
          discoveredLocationIds: ['north-tower', 'stone-gorge'],
          discoveredRegionIds: [],
          bookmarks: [],
          customMarkers: [],
          travelHistory: [],
        },
      },
      saveMetadataDebounced: vi.fn(),
      extensionSettings: {},
      saveSettingsDebounced: vi.fn(),
      eventSource: { on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
      eventTypes: {},
      renderExtensionTemplateAsync: vi.fn(),
      setExtensionPrompt: vi.fn(),
      callGenericPopup: vi.fn(),
      POPUP_TYPE: { TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 },
      isMobile: () => false,
      SlashCommandParser: { addCommandObject: vi.fn() },
      SlashCommand: { fromProps: (props: Record<string, unknown>) => props },
      SlashCommandArgument: { fromProps: (props: Record<string, unknown>) => props },
      SlashCommandNamedArgument: { fromProps: (props: Record<string, unknown>) => props },
      SlashCommandEnumValue: class {},
      ARGUMENT_TYPE: { STRING: 1, BOOLEAN: 2, NUMBER: 3 },
    } as unknown as SillyTavernContext;
    vi.spyOn(contextBridge, 'getContext').mockReturnValue(mockContext);
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(mockContext);
    travel = new AtlasTravelService(maps, new EventBus());
    automation = new AtlasAutomationService(maps, travel);
  });

  it('rejects unknown ids and route-invalid movement without guessing', async () => {
    await expect(automation.moveToLocation('not-real')).resolves.toMatchObject({ ok: false });
    await expect(automation.moveToLocation('mournwood-gate')).resolves.toMatchObject({
      ok: false,
      message: 'Route validation failed.',
    });
  });

  it('reveals and hides exact location ids', async () => {
    await expect(automation.revealLocation('missing-point')).resolves.toMatchObject({ ok: true });
    expect((await travel.loadChatState()).discoveredLocationIds).toContain('missing-point');

    await expect(automation.hideLocation('missing-point')).resolves.toMatchObject({ ok: true });
    expect((await travel.loadChatState()).discoveredLocationIds).not.toContain('missing-point');
  });
});

describe('M10 function tool bridge', () => {
  it('registers and unregisters only when host APIs are present', () => {
    const tools = new Map<string, Record<string, unknown>>();
    const context = {
      registerFunctionTool: vi.fn((tool: Record<string, unknown>) => tools.set(tool.name as string, tool)),
      unregisterFunctionTool: vi.fn((name: string) => tools.delete(name)),
    } as unknown as SillyTavernContext;
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(context);
    const automation = {
      moveToLocation: vi.fn(),
      revealLocation: vi.fn(),
    } as unknown as AtlasAutomationService;

    expect(registerAtlasFunctionTools(automation)).toBe(true);
    expect(tools.has('atlas_move_to_location')).toBe(true);
    expect(tools.has('atlas_reveal_location')).toBe(true);

    unregisterAtlasFunctionTools();
    expect(tools.size).toBe(0);
  });
});
