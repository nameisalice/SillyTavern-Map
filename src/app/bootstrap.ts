/**
 * Bootstrap: the composition root that starts Atlas after the host is
 * ready.
 *
 * This module is intentionally outside `core/` because, as the
 * composition root, it is the one place allowed to wire UI controllers
 * and host adapters together. Pure core infrastructure (logger, events,
 * container, lifecycle, errors) lives in `@/core` and depends on
 * nothing above it.
 *
 * Each step is independent and wrapped so that a failure in one
 * non-critical step (e.g. mounting the settings drawer) does not
 * prevent the rest of the extension from loading. Critical failures
 * (no host context) surface a toast and stop.
 *
 * This module owns construction order and registers the core singletons
 * (logger, event bus, settings bridge) with the dependency container so
 * later milestones never instantiate those directly.
 */

import { EXTENSIONS_MENU_SELECTOR } from '@/constants';
import { tryGetContext } from '@/st/context';
import { loadSettings, saveMapIndex } from '@/st/settings-bridge';
import { mountSettingsDrawer } from '@/ui/settings-controller';
import {
  openAtlasPanel,
  setActionService,
  setViewerService,
  setTravelService,
} from '@/ui/panel-controller';
import { openMapLibrary } from '@/ui/map-library-controller';
import { openEditor } from '@/ui/editor-dialog-controller';
import { openCreateMapDialog, setCreateMapUploadService } from '@/ui/create-map-controller';
import { logError, logInfo } from '@/core/logger';
import { EventBus } from '@/core/events';
import { Container, type DependencyToken, token } from '@/core/container';
import { registerSlashCommands } from '@/st/slash-command-bridge';
import { AtlasViewerService, type ViewerService } from '@/services/viewer-service';
import { LocalForageStorageProvider, type StorageProvider } from '@/providers/storage';
import {
  AssetRepository,
  MapRepository,
  ThumbnailRepository,
  ViewerStateRepository,
} from '@/repositories';
import {
  ExportService,
  ImageUploadService,
  ImportService,
  MapDraftService,
  MapLibraryService,
  ThumbnailService,
  AtlasTravelService,
  MapSeedingService,
  type TravelService,
  AtlasSpatialContextService,
  type SpatialContextService,
  ActionService,
} from '@/services';
import { ChatStateCoordinator } from './chat-state-coordinator';
import { createActionExecutionAdapter } from '@/st/action-bridge';

/**
 * Dependency tokens for the core singletons. Declared here so any
 * future module can resolve them by token instead of constructing its
 * own instance.
 */
export const EventBusToken: DependencyToken<EventBus> = token<EventBus>('EventBus');
export const StorageProviderToken: DependencyToken<StorageProvider> =
  token<StorageProvider>('StorageProvider');
export const MapRepositoryToken: DependencyToken<MapRepository> =
  token<MapRepository>('MapRepository');
export const AssetRepositoryToken: DependencyToken<AssetRepository> =
  token<AssetRepository>('AssetRepository');
export const ThumbnailRepositoryToken: DependencyToken<ThumbnailRepository> =
  token<ThumbnailRepository>('ThumbnailRepository');
export const ViewerStateRepositoryToken: DependencyToken<ViewerStateRepository> =
  token<ViewerStateRepository>('ViewerStateRepository');
export const ImportServiceToken: DependencyToken<ImportService> =
  token<ImportService>('ImportService');
export const ExportServiceToken: DependencyToken<ExportService> =
  token<ExportService>('ExportService');
export const MapLibraryServiceToken: DependencyToken<MapLibraryService> =
  token<MapLibraryService>('MapLibraryService');
export const MapDraftServiceToken: DependencyToken<MapDraftService> =
  token<MapDraftService>('MapDraftService');
export const ImageUploadServiceToken: DependencyToken<ImageUploadService> =
  token<ImageUploadService>('ImageUploadService');
export const ThumbnailServiceToken: DependencyToken<ThumbnailService> =
  token<ThumbnailService>('ThumbnailService');
export const TravelServiceToken: DependencyToken<TravelService> =
  token<TravelService>('TravelService');
export const SpatialContextServiceToken: DependencyToken<SpatialContextService> =
  token<SpatialContextService>('SpatialContextService');
export const MapSeedingServiceToken: DependencyToken<MapSeedingService> =
  token<MapSeedingService>('MapSeedingService');
export const ChatStateCoordinatorToken: DependencyToken<ChatStateCoordinator> =
  token<ChatStateCoordinator>('ChatStateCoordinator');
export const ViewerServiceToken: DependencyToken<ViewerService> =
  token<ViewerService>('ViewerService');
export const ActionServiceToken: DependencyToken<ActionService> =
  token<ActionService>('ActionService');

/** The single shared container instance for the extension lifetime. */
let container: Container | null = null;

const FLOATING_LAUNCHER_POSITION_KEY = 'sillytavern_atlas.floating_launcher_position';
const FLOATING_LAUNCHER_DRAG_THRESHOLD_PX = 6;

interface FloatingLauncherPosition {
  readonly left: number;
  readonly top: number;
}

/**
 * Returns the shared container, creating and seeding it on first call.
 * The container holds the core singletons; feature/service modules
 * resolve their dependencies from here.
 */
export function getContainer(): Container {
  if (container) {
    return container;
  }
  container = new Container();
  const eventBus = new EventBus();
  const storage = new LocalForageStorageProvider();
  const mapRepository = new MapRepository(storage, saveMapIndex);
  const assetRepository = new AssetRepository(storage);
  const thumbnailRepository = new ThumbnailRepository(assetRepository);
  const viewerStateRepository = new ViewerStateRepository(storage);

  container.register(EventBusToken, () => eventBus, 'singleton');
  container.register(StorageProviderToken, () => storage, 'singleton');
  container.register(MapRepositoryToken, () => mapRepository, 'singleton');
  container.register(AssetRepositoryToken, () => assetRepository, 'singleton');
  container.register(ThumbnailRepositoryToken, () => thumbnailRepository, 'singleton');
  container.register(ViewerStateRepositoryToken, () => viewerStateRepository, 'singleton');
  container.register(
    ImportServiceToken,
    () => new ImportService(mapRepository, assetRepository),
    'singleton',
  );
  container.register(
    ExportServiceToken,
    () => new ExportService(mapRepository, assetRepository),
    'singleton',
  );
  container.register(
    MapLibraryServiceToken,
    () => new MapLibraryService(mapRepository, viewerStateRepository),
    'singleton',
  );
  container.register(
    MapDraftServiceToken,
    () => new MapDraftService(mapRepository, assetRepository),
    'singleton',
  );
  container.register(
    ImageUploadServiceToken,
    () => new ImageUploadService(assetRepository),
    'singleton',
  );
  container.register(
    ThumbnailServiceToken,
    () => new ThumbnailService(assetRepository, thumbnailRepository),
    'singleton',
  );
  container.register(
    TravelServiceToken,
    () => new AtlasTravelService(mapRepository, eventBus),
    'singleton',
  );
  container.register(
    SpatialContextServiceToken,
    () => new AtlasSpatialContextService(mapRepository, getContainer().resolve(TravelServiceToken)),
    'singleton',
  );
  container.register(
    MapSeedingServiceToken,
    () => new MapSeedingService(mapRepository),
    'singleton',
  );
  container.register(
    ChatStateCoordinatorToken,
    () => new ChatStateCoordinator(getContainer().resolve(TravelServiceToken), eventBus),
    'singleton',
  );
  container.register(
    ViewerServiceToken,
    () => new AtlasViewerService(eventBus, mapRepository, assetRepository),
    'singleton',
  );
  container.register(
    ActionServiceToken,
    () =>
      new ActionService(
        createActionExecutionAdapter(
          getContainer().resolve(TravelServiceToken),
          getContainer().resolve(ViewerServiceToken),
        ),
        () => loadSettings(),
      ),
    'singleton',
  );
  return container;
}

/**
 * Starts Atlas. Intended to be called from the host's jQuery ready
 * callback in `index.ts`. Returns `true` on success.
 */
export async function bootstrap(): Promise<boolean> {
  // Initialize the container first so core singletons are resolvable
  // for any module that needs them during bootstrap.
  getContainer();

  const context = tryGetContext();
  if (!context) {
    // The host context is unavailable. A toast is the most visible
    // signal we can give without a panel yet.
    if (typeof toastr !== 'undefined') {
      toastr.error('Atlas could not start: host context unavailable.');
    }
    return false;
  }

  // Load settings first so the logger level is correct for everything below.
  loadSettings();

  // Inject the viewer service into the panel via the container so the
  // panel never constructs services itself.
  setViewerService(getContainer().resolve(ViewerServiceToken));
  setCreateMapUploadService(getContainer().resolve(ImageUploadServiceToken));
  setTravelService(getContainer().resolve(TravelServiceToken));
  setActionService(getContainer().resolve(ActionServiceToken));

  // Seed the bundled map into the repository on first run if missing
  const seeder = getContainer().resolve(MapSeedingServiceToken);
  await seeder.seed();

  // Initialize and run the travel/chat state coordinator and service
  const coordinator = getContainer().resolve(ChatStateCoordinatorToken);
  coordinator.initialize();

  const travelService = getContainer().resolve(TravelServiceToken);
  void travelService.reconcileActiveChatState();

  // Setup prompt rebuild response on state changes
  const bus = getContainer().resolve(EventBusToken);
  const contextService = getContainer().resolve(SpatialContextServiceToken);

  bus.subscribe('ChatAtlasStateLoaded', () => {
    void contextService.rebuildContext();
  });
  bus.subscribe('ActiveMapChanged', () => {
    void contextService.rebuildContext();
  });
  bus.subscribe('LocationChanged', () => {
    void contextService.rebuildContext();
  });
  bus.subscribe('DiscoveryChanged', () => {
    void contextService.rebuildContext();
  });
  bus.subscribe('MapSaved', () => {
    void contextService.rebuildContext();
  });

  // Register modern SillyTavern slash commands once
  registerSlashCommands({
    maps: getContainer().resolve(MapRepositoryToken),
    travel: travelService,
    viewer: getContainer().resolve(ViewerServiceToken),
    library: getContainer().resolve(MapLibraryServiceToken),
    importer: getContainer().resolve(ImportServiceToken),
    exporter: getContainer().resolve(ExportServiceToken),
    eventBus: bus,
    draftService: getContainer().resolve(MapDraftServiceToken),
  });

  await safeMountSettings();
  mountMenuButton();
  mountLibraryButton();
  mountFloatingLauncher();

  logInfo('Atlas bootstrap complete.');
  return true;
}

async function safeMountSettings(): Promise<void> {
  try {
    await mountSettingsDrawer();
  } catch (error) {
    // Non-fatal: the panel still works without a settings drawer.
    logError('Atlas settings drawer failed to mount.', error);
  }
}

function mountMenuButton(): void {
  try {
    const menu = document.querySelector(EXTENSIONS_MENU_SELECTOR);
    if (!menu) {
      logError(`Extensions menu "${EXTENSIONS_MENU_SELECTOR}" not found.`);
      return;
    }
    menu.append(createMenuButton());
  } catch (error) {
    logError('Atlas menu button failed to mount.', error);
  }
}

function mountLibraryButton(): void {
  try {
    const menu = document.querySelector(EXTENSIONS_MENU_SELECTOR);
    if (!menu) {
      return;
    }
    const button = document.createElement('div');
    button.className = 'st-atlas__menu-button list-group-item flex-container flexGap5';
    button.setAttribute('data-st-atlas', 'library-button');
    button.innerHTML =
      '<div class="fa-solid fa-map-location-dot" title="Open the Atlas map library"></div>Atlas Library';
    button.addEventListener('click', () => void openLibraryFlow());
    menu.append(button);
  } catch (error) {
    logError('Atlas library button failed to mount.', error);
  }
}

function mountFloatingLauncher(): void {
  try {
    if (document.querySelector('[data-st-atlas="floating-launcher"]')) {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'st-atlas__floating-launcher';
    button.setAttribute('data-st-atlas', 'floating-launcher');
    button.setAttribute('aria-label', 'Open Atlas');
    button.title = 'Open Atlas';
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M12 2.5c-3.1 0-5.6 2.5-5.6 5.6 0 4.3 5.6 10.5 5.6 10.5s5.6-6.2 5.6-10.5c0-3.1-2.5-5.6-5.6-5.6Zm0 7.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
        <path d="M5.1 19.2h13.8v2H5.1v-2Z" />
      </svg>`;
    bindFloatingLauncherDrag(button);
    document.body.append(button);
    restoreFloatingLauncherPosition(button);
  } catch (error) {
    logError('Atlas floating launcher failed to mount.', error);
  }
}

function bindFloatingLauncherDrag(button: HTMLButtonElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let didDrag = false;
  let suppressNextClick = false;

  button.addEventListener('click', (event) => {
    if (suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
      return;
    }
    openAtlasPanel();
  });

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    const rect = button.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    didDrag = false;
    button.classList.add('st-atlas__floating-launcher--dragging');
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort across mobile webviews.
    }
  });

  button.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!didDrag && Math.hypot(dx, dy) < FLOATING_LAUNCHER_DRAG_THRESHOLD_PX) {
      return;
    }
    didDrag = true;
    event.preventDefault();
    applyFloatingLauncherPosition(button, {
      left: startLeft + dx,
      top: startTop + dy,
    });
  });

  const finishDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    pointerId = null;
    button.classList.remove('st-atlas__floating-launcher--dragging');
    try {
      if (button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Some mobile clients can lose capture before pointerup/cancel.
    }
    if (!didDrag) {
      return;
    }
    event.preventDefault();
    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
    saveFloatingLauncherPosition(button);
  };

  button.addEventListener('pointerup', finishDrag);
  button.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', () => {
    clampFloatingLauncherToViewport(button);
    saveFloatingLauncherPosition(button);
  });
}

function restoreFloatingLauncherPosition(button: HTMLElement): void {
  const stored = readFloatingLauncherPosition();
  if (!stored) {
    return;
  }
  applyFloatingLauncherPosition(button, stored);
}

function readFloatingLauncherPosition(): FloatingLauncherPosition | null {
  try {
    const raw = window.localStorage.getItem(FLOATING_LAUNCHER_POSITION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<FloatingLauncherPosition>;
    if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return { left: Number(parsed.left), top: Number(parsed.top) };
    }
  } catch (error) {
    logError('Failed to read Atlas floating launcher position.', error);
  }
  return null;
}

function saveFloatingLauncherPosition(button: HTMLElement): void {
  try {
    const rect = button.getBoundingClientRect();
    window.localStorage.setItem(
      FLOATING_LAUNCHER_POSITION_KEY,
      JSON.stringify({ left: rect.left, top: rect.top }),
    );
  } catch (error) {
    logError('Failed to save Atlas floating launcher position.', error);
  }
}

function applyFloatingLauncherPosition(
  button: HTMLElement,
  position: FloatingLauncherPosition,
): void {
  const clamped = clampFloatingLauncherPosition(button, position);
  button.style.left = `${clamped.left}px`;
  button.style.top = `${clamped.top}px`;
  button.style.right = 'auto';
  button.style.bottom = 'auto';
}

function clampFloatingLauncherToViewport(button: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  applyFloatingLauncherPosition(button, { left: rect.left, top: rect.top });
}

function clampFloatingLauncherPosition(
  button: HTMLElement,
  position: FloatingLauncherPosition,
): FloatingLauncherPosition {
  const rect = button.getBoundingClientRect();
  const width = rect.width || 48;
  const height = rect.height || 48;
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(position.left, margin), maxLeft),
    top: Math.min(Math.max(position.top, margin), maxTop),
  };
}

/** Opens the map library, wiring open/edit/create actions to services. */
async function openLibraryFlow(): Promise<void> {
  const c = getContainer();
  const libraryService = c.resolve(MapLibraryServiceToken);
  const viewerService = c.resolve(ViewerServiceToken);
  const draftService = c.resolve(MapDraftServiceToken);
  const travelService = c.resolve(TravelServiceToken);
  const eventBus = c.resolve(EventBusToken);
  try {
    await openMapLibrary(
      libraryService,
      {
        openInViewer: (mapId) => void openMapInViewMode(mapId, viewerService, travelService),
        openInEditor: (mapId) =>
          void openMapInEditorMode(mapId, viewerService, draftService, eventBus),
        createMap: () => void openCreateMapFlow(draftService, viewerService, eventBus),
      },
      async (content, type) => {
        const ctx = tryGetContext();
        if (!ctx) {
          return 0;
        }
        const popupType = type === 'confirm' ? ctx.POPUP_TYPE.CONFIRM : ctx.POPUP_TYPE.TEXT;
        return (await ctx.callGenericPopup(content, popupType)) as number;
      },
    );
  } catch (error) {
    logError('Atlas library flow failed.', error);
  }
}

/** Opens a saved map in the viewer panel. */
async function openMapInViewMode(
  mapId: string,
  viewerService: ViewerService,
  travelService: TravelService,
): Promise<void> {
  try {
    await travelService.setActiveMapId(mapId);
    await viewerService.loadMap(mapId);
    openAtlasPanel();
  } catch (error) {
    logError('Failed to open map in viewer.', error);
  }
}

/** Opens a saved map in the editor dialog. */
async function openMapInEditorMode(
  mapId: string,
  viewerService: ViewerService,
  draftService: MapDraftService,
  eventBus: EventBus,
): Promise<void> {
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
  } catch (error) {
    logError('Failed to open map in editor.', error);
  }
}

/** Opens the Create Map workflow. */
async function openCreateMapFlow(
  draftService: MapDraftService,
  viewerService: ViewerService,
  eventBus: EventBus,
): Promise<void> {
  try {
    const result = await openCreateMapDialog(draftService);
    if (!result) {
      return;
    }
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
  } catch (error) {
    logError('Create map flow failed.', error);
  }
}

/**
 * Builds the Atlas launcher button appended to the Extensions menu.
 * Uses Font Awesome (host-provided) and a namespaced class.
 */
function createMenuButton(): HTMLElement {
  const button = document.createElement('div');
  button.className = 'st-atlas__menu-button list-group-item flex-container flexGap5';
  button.setAttribute('data-st-atlas', 'menu-button');
  button.innerHTML = '<div class="fa-solid fa-map" title="Open Atlas"></div>Atlas';
  button.addEventListener('click', () => openAtlasPanel());
  return button;
}
