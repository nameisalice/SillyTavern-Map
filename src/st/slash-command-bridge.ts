/**
 * SlashCommandBridge: registers SillyTavern slash commands for Atlas.
 *
 * All commands are registered once through the `SlashCommandParser.addCommandObject`
 * API. Callbacks delegate exclusively to injected services and UI
 * controllers; they do not access storage or settings directly.
 *
 * Standard pipe-safe strings are returned on success, and clean, friendly
 * errors on failure.
 */

import { getContext } from '@/st/context';
import { saveChatMetadataState } from '@/st/chat-state-bridge';
import type { MapRepository } from '@/repositories';
import type {
  TravelService,
  ViewerService,
  MapLibraryService,
  ImportService,
  ExportService,
  MapDraftService,
  ImageUploadService,
} from '@/services';
import type { EventBus } from '@/core/events';
import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasLocation } from '@/domain/location';
import { logError } from '@/core/logger';
import { openAtlasPanel, centerActiveViewer } from '@/ui/panel-controller';
import { openEditor } from '@/ui/editor-dialog-controller';
import { openMapLibrary } from '@/ui/map-library-controller';
import { openCreateMapDialog } from '@/ui/create-map-controller';
import { openGenerateMapDialog } from '@/ui/generate-map-controller';

let commandsRegistered = false;

/** Resets the commands registration lock. Test-only hook. */
export function testOnlyResetCommandsRegistered(): void {
  commandsRegistered = false;
}

/**
 * Registers all SillyTavern slash commands once. Injection of services
 * keeps this module decoupled from the container.
 */
export function registerSlashCommands(args: {
  maps: MapRepository;
  travel: TravelService;
  viewer: ViewerService;
  library: MapLibraryService;
  importer: ImportService;
  exporter: ExportService;
  eventBus: EventBus;
  draftService: MapDraftService;
  uploadService: ImageUploadService;
}): void {
  if (commandsRegistered) {
    return;
  }
  commandsRegistered = true;

  try {
    const {
      SlashCommandParser,
      SlashCommand,
      SlashCommandNamedArgument,
      SlashCommandEnumValue,
      ARGUMENT_TYPE,
    } = getContext();

    // Autocomplete helpers
    const getMapOptions = async () => {
      try {
        const index = await args.maps.listIndex();
        return index.map((e) => new SlashCommandEnumValue(e.id, e.name));
      } catch {
        return [];
      }
    };

    const getLocationOptions = async () => {
      try {
        const chatState = await args.travel.loadChatState();
        const mapId = chatState.activeMapId;
        if (!mapId) {
          return [];
        }
        const map = await args.maps.load(mapId);
        if (!map) {
          return [];
        }

        const discovered = new Set(chatState.discoveredLocationIds);
        return map.locations
          .filter((loc) => !loc.hiddenUntilDiscovered || discovered.has(loc.id))
          .map((loc) => new SlashCommandEnumValue(loc.id, loc.name));
      } catch {
        return [];
      }
    };

    // 1. /atlas
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas',
        helpString: 'Open the Atlas viewer panel. Optional map argument opens a specific map.',
        returns: 'Piping result text',
        namedArgumentList: [
          SlashCommandNamedArgument.fromProps({
            name: 'map',
            description: 'Map ID or name to open',
            typeList: [ARGUMENT_TYPE.STRING],
            enumProvider: getMapOptions,
          }),
        ],
        callback: async (named: Record<string, string>) => {
          try {
            const mapQuery = named['map']?.trim();
            if (mapQuery) {
              const map = await resolveMap(mapQuery, args.maps);
              await args.travel.setActiveMapId(map.id);
              await args.viewer.loadMap(map.id);
            } else {
              const activeMapId = args.travel.getActiveMapId();
              if (activeMapId) {
                await args.viewer.loadMap(activeMapId);
              } else {
                await args.viewer.ensureLoaded();
              }
            }
            openAtlasPanel();
            return 'Atlas panel opened';
          } catch (err) {
            logError('Command /atlas failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 2. /atlas-map
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-map',
        helpString: 'Set the active map for the current chat.',
        returns: 'Result status',
        unnamedArgumentList: [
          getContext().SlashCommandArgument.fromProps({
            description: 'Map ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: getMapOptions,
          }),
        ],
        callback: async (_: unknown, unnamed: string) => {
          try {
            const mapQuery = unnamed?.trim();
            if (!mapQuery) {
              return 'Atlas error: Map argument is required';
            }
            const map = await resolveMap(mapQuery, args.maps);
            await args.travel.setActiveMapId(map.id);
            // Refresh viewer if open
            const activeViewer = args.viewer.getActiveMap();
            if (activeViewer) {
              await args.viewer.loadMap(map.id);
            }
            return `Map set: ${map.name}`;
          } catch (err) {
            logError('Command /atlas-map failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 3. /atlas-go
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-go',
        helpString: 'Travel to a location in the active map.',
        returns: 'Result status',
        namedArgumentList: [
          SlashCommandNamedArgument.fromProps({
            name: 'location',
            description: 'Location ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: getLocationOptions,
          }),
          SlashCommandNamedArgument.fromProps({
            name: 'force',
            description: 'Bypass route validation',
            typeList: [ARGUMENT_TYPE.BOOLEAN],
            defaultValue: 'false',
          }),
        ],
        callback: async (named: Record<string, string>) => {
          try {
            const locQuery = named['location']?.trim();
            const force = named['force'] === 'true';
            if (!locQuery) {
              return 'Atlas error: Location argument is required';
            }

            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            if (!mapId) {
              return 'Atlas error: No active map set for this chat';
            }

            const map = await args.maps.load(mapId);
            if (!map) {
              return `Atlas error: Active map "${mapId}" not found`;
            }

            const location = resolveLocation(locQuery, map, chatState.discoveredLocationIds);
            const res = await args.travel.travelTo(location.id, 'slash', force);
            if (res.success) {
              return `Travelled to: ${location.name}`;
            }

            if (res.requiresOverride) {
              return `Atlas error: Route blocked. Use force=true to override`;
            }
            return `Atlas error: ${res.error || 'Travel failed'}`;
          } catch (err) {
            logError('Command /atlas-go failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 4. /atlas-where
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-where',
        helpString: 'Print the current active map and location details.',
        returns: 'Concise position info',
        callback: async () => {
          try {
            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            const locId = chatState.activeLocationId;

            if (!mapId) {
              return 'No active Atlas map';
            }

            const map = await args.maps.load(mapId);
            const mapName = map?.name ?? mapId;
            const location = map?.locations.find((l) => l.id === locId);
            const locName = location?.name ?? locId ?? 'Unknown Location';

            return `${mapName} / ${locName}`;
          } catch (err) {
            logError('Command /atlas-where failed.', err);
            return 'Atlas error';
          }
        },
      }),
    );

    // 5. /atlas-reveal
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-reveal',
        helpString: 'Reveal a location in the active map.',
        returns: 'Result status',
        unnamedArgumentList: [
          getContext().SlashCommandArgument.fromProps({
            description: 'Location ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
          }),
        ],
        callback: async (_: unknown, unnamed: string) => {
          try {
            const locQuery = unnamed?.trim();
            if (!locQuery) {
              return 'Atlas error: Location argument is required';
            }

            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            if (!mapId) {
              return 'Atlas error: No active map set for this chat';
            }

            const map = await args.maps.load(mapId);
            if (!map) {
              return `Atlas error: Active map "${mapId}" not found`;
            }

            // Exclude discoveredIds filter during resolve so we can find hidden ones by passing true
            const location = resolveLocation(locQuery, map, [], true);
            await args.travel.discoverLocation(location.id);
            return `Location revealed: ${location.name}`;
          } catch (err) {
            logError('Command /atlas-reveal failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 6. /atlas-hide
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-hide',
        helpString: 'Hide a revealed location in the active map.',
        returns: 'Result status',
        unnamedArgumentList: [
          getContext().SlashCommandArgument.fromProps({
            description: 'Location ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: getLocationOptions,
          }),
        ],
        callback: async (_: unknown, unnamed: string) => {
          try {
            const locQuery = unnamed?.trim();
            if (!locQuery) {
              return 'Atlas error: Location argument is required';
            }

            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            if (!mapId) {
              return 'Atlas error: No active map set for this chat';
            }

            const map = await args.maps.load(mapId);
            if (!map) {
              return `Atlas error: Active map "${mapId}" not found`;
            }

            const location = resolveLocation(locQuery, map, chatState.discoveredLocationIds);
            const discovered = chatState.discoveredLocationIds.filter((id) => id !== location.id);
            const repairedState = {
              ...chatState,
              discoveredLocationIds: discovered,
              activeLocationId:
                chatState.activeLocationId === location.id ? undefined : chatState.activeLocationId,
            };
            saveChatMetadataState(repairedState);
            args.eventBus.emit('DiscoveryChanged', {
              locationIds: discovered,
              regionIds: chatState.discoveredRegionIds,
            });
            if (chatState.activeLocationId === location.id) {
              args.eventBus.emit('LocationChanged', { mapId, locationId: '' });
            }
            return `Location hidden: ${location.name}`;
          } catch (err) {
            logError('Command /atlas-hide failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 7. /atlas-center
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-center',
        helpString: 'Center the Atlas panel on the current location.',
        returns: 'Result status',
        callback: async () => {
          try {
            openAtlasPanel(); // Always open or focus the panel consistently
            const activeMapId = args.travel.getActiveMapId();
            if (activeMapId) {
              await args.viewer.loadMap(activeMapId);
              centerActiveViewer();
            }
            return 'Viewer centered';
          } catch (err) {
            logError('Command /atlas-center failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 8. /atlas-library
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-library',
        helpString: 'Open the Map Library.',
        returns: 'Result status',
        callback: async () => {
          try {
            openLibraryFlowWrapper(args);
            return 'Library opened';
          } catch (err) {
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 9. /atlas-import
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-import',
        helpString: 'Trigger map library import.',
        returns: 'Result status',
        callback: async () => {
          try {
            // Emulates click on map-library create/import UI paths
            openLibraryFlowWrapper(args);
            return 'Library dialog launched to handle imports';
          } catch (err) {
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 10. /atlas-export
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-export',
        helpString: 'Export the specified map as a portable JSON package.',
        returns: 'Piping result text',
        unnamedArgumentList: [
          getContext().SlashCommandArgument.fromProps({
            description: 'Map ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: getMapOptions,
          }),
        ],
        callback: async (_: unknown, unnamed: string) => {
          try {
            const mapQuery = unnamed?.trim();
            if (!mapQuery) {
              return 'Atlas error: Map argument is required';
            }
            const map = await resolveMap(mapQuery, args.maps);
            const pack = await args.exporter.exportMap(map.id);
            const json = JSON.stringify(pack, null, 2);

            // Trigger browser download safely in host context
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${map.id}.atlas.json`;
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            return `Map exported: ${map.name}`;
          } catch (err) {
            logError('Command /atlas-export failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 11. /atlas-open
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-open',
        helpString: 'Open the child map of the specified location.',
        returns: 'Result status',
        namedArgumentList: [
          SlashCommandNamedArgument.fromProps({
            name: 'location',
            description: 'Location ID or name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
            enumProvider: getLocationOptions,
          }),
        ],
        callback: async (named: Record<string, string>) => {
          try {
            const locQuery = named['location']?.trim();
            if (!locQuery) {
              return 'Atlas error: Location argument is required';
            }

            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            if (!mapId) {
              return 'Atlas error: No active map set for this chat';
            }

            const map = await args.maps.load(mapId);
            if (!map) {
              return `Atlas error: Active map "${mapId}" not found`;
            }

            const location = resolveLocation(locQuery, map, chatState.discoveredLocationIds);
            if (!location.childMapId) {
              return `Atlas error: Location "${location.name}" has no child map.`;
            }

            // check if child map exists
            const childExists = await args.maps.exists(location.childMapId);
            if (!childExists) {
              return `Atlas error: Child map "${location.childMapId}" is missing from the library.`;
            }

            await args.travel.setActiveMapId(location.childMapId);
            await args.viewer.loadMap(location.childMapId);
            openAtlasPanel();
            args.eventBus.emit('ChildMapOpened', { childMapId: location.childMapId });
            return `Opened child map: ${location.name}`;
          } catch (err) {
            logError('Command /atlas-open failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );

    // 12. /atlas-back
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'atlas-back',
        helpString: 'Return to the parent map.',
        returns: 'Result status',
        callback: async () => {
          try {
            const chatState = await args.travel.loadChatState();
            const mapId = chatState.activeMapId;
            if (!mapId) {
              return 'Atlas error: No active map set';
            }

            const map = await args.maps.load(mapId);
            if (!map || !map.parentMapId) {
              return 'Atlas error: No parent map for this map';
            }

            const parentId = map.parentMapId;
            const parentExists = await args.maps.exists(parentId);
            if (!parentExists) {
              return `Atlas error: Parent map "${parentId}" is missing from the library.`;
            }

            await args.travel.setActiveMapId(parentId);
            await args.viewer.loadMap(parentId);
            openAtlasPanel();
            args.eventBus.emit('ParentMapOpened', { parentMapId: parentId });
            return 'Returned to parent map';
          } catch (err) {
            logError('Command /atlas-back failed.', err);
            return `Atlas error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    );
  } catch (error) {
    logError('Failed to register Atlas slash commands.', error);
  }
}

/** Resolves a map by ID, exact name, or unique case-insensitive name. */
export async function resolveMap(query: string, maps: MapRepository): Promise<AtlasMapDocument> {
  const clean = query.trim();
  // 1. Exact ID
  const direct = await maps.load(clean);
  if (direct) {
    return direct;
  }

  // List all to check names
  const all = await maps.list();
  // 2. Exact case-sensitive name
  const exact = all.find((m) => m.name === clean);
  if (exact) {
    return exact;
  }

  // 3. Unique case-insensitive name
  const searchLower = clean.toLowerCase();
  const matches = all.filter((m) => m.name.toLowerCase() === searchLower);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous name. Multiple maps matched: ${matches.map((m) => m.name).join(', ')}`);
  }

  throw new Error(`Map "${query}" not found.`);
}

/** Resolves a location by ID, exact name, unique case-insensitive name, or unique alias. */
export function resolveLocation(
  query: string,
  map: AtlasMapDocument,
  discoveredIds: readonly string[],
  includeHidden = false,
): AtlasLocation {
  const clean = query.trim();
  const discovered = new Set(discoveredIds);

  const filterHidden = (l: AtlasLocation) => {
    if (includeHidden) {
      return true;
    }
    return !l.hiddenUntilDiscovered || discovered.has(l.id);
  };

  // Helper checking lists for presence
  const available = map.locations.filter(filterHidden);

  // 1. Exact ID
  const direct = available.find((l) => l.id === clean);
  if (direct) {
    return direct;
  }

  // 2. Exact case-sensitive name
  const exactName = available.find((l) => l.name === clean);
  if (exactName) {
    return exactName;
  }

  // 3. Unique case-insensitive name
  const queryLower = clean.toLowerCase();
  const nameMatches = available.filter((l) => l.name.toLowerCase() === queryLower);
  if (nameMatches.length === 1) {
    return nameMatches[0];
  }
  if (nameMatches.length > 1) {
    throw new Error(`Ambiguous name. Multiple locations matched: ${nameMatches.map((l) => l.name).join(', ')}`);
  }

  // 4. Unique alias
  const aliasMatches = available.filter((l) => l.aliases && l.aliases.some((a) => a.toLowerCase() === queryLower));
  if (aliasMatches.length === 1) {
    return aliasMatches[0];
  }
  if (aliasMatches.length > 1) {
    throw new Error(`Ambiguous alias. Multiple locations matched: ${aliasMatches.map((l) => l.name).join(', ')}`);
  }

  throw new Error(`Location "${query}" not found.`);
}

async function openLibraryFlowWrapper(args: {
  library: MapLibraryService;
  viewer: ViewerService;
  exporter: ExportService;
  eventBus: EventBus;
  draftService: MapDraftService;
  uploadService: ImageUploadService;
  travel: TravelService;
}): Promise<void> {
  const travelService = args.travel;
  const viewerService = args.viewer;
  const draftService = args.draftService;
  const eventBus = args.eventBus;

  await openMapLibrary(
    args.library,
    {
      openInViewer: async (mapId) => {
        try {
          await travelService.setActiveMapId(mapId);
          await viewerService.loadMap(mapId);
          openAtlasPanel();
        } catch (err) {
          logError('Library View trigger failed.', err);
        }
      },
      openInEditor: async (mapId) => {
        try {
          const resolved = await viewerService.loadMap(mapId);
          await openEditor({
            document: resolved.document,
            imageUrlOverride: resolved.imageUrl,
            draftService,
            viewerService,
            eventBus,
            onSaved: (saved) => {
              eventBus.emit('MapSaved', { mapId: saved.id });
            },
          });
        } catch (err) {
          logError('Library Edit trigger failed.', err);
        }
      },
      createMap: async () => {
        try {
          const result = await openCreateMapDialog(draftService);
          if (!result) return;
          await openEditor({
            document: result.document,
            imageUrlOverride: result.imageUrl,
            draftService,
            viewerService,
            eventBus,
            onSaved: (saved) => {
              eventBus.emit('MapSaved', { mapId: saved.id });
            },
          });
        } catch (err) {
          logError('Library Create Map trigger failed.', err);
        }
      },
      generateMap: async () => {
        try {
          const result = await openGenerateMapDialog({
            draftService,
            uploadService: args.uploadService,
          });
          if (!result) return;
          await openEditor({
            document: result.document,
            imageUrlOverride: result.imageUrl,
            draftService,
            viewerService,
            eventBus,
            onSaved: (saved) => {
              eventBus.emit('MapSaved', { mapId: saved.id });
            },
          });
        } catch (err) {
          logError('Library Generate Map trigger failed.', err);
        }
      },
    },
    async (content, type) => {
      const ctx = getContext();
      const popupType = type === 'confirm' ? ctx.POPUP_TYPE.CONFIRM : ctx.POPUP_TYPE.TEXT;
      return (await ctx.callGenericPopup(content, popupType)) as number;
    },
  );
}
