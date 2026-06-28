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
import { openAtlasPanel, setViewerService } from '@/ui/panel-controller';
import { logError, logInfo } from '@/core/logger';
import { EventBus } from '@/core/events';
import { Container, type DependencyToken, token } from '@/core/container';
import { AtlasViewerService, type ViewerService } from '@/services/viewer-service';
import { LocalForageStorageProvider, type StorageProvider } from '@/providers/storage';
import {
  AssetRepository,
  MapRepository,
  ThumbnailRepository,
  ViewerStateRepository,
} from '@/repositories';
import { ExportService, ImportService, MapLibraryService } from '@/services';

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
export const ViewerServiceToken: DependencyToken<ViewerService> =
  token<ViewerService>('ViewerService');

/** The single shared container instance for the extension lifetime. */
let container: Container | null = null;

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
  container.register(ViewerServiceToken, () => new AtlasViewerService(eventBus), 'singleton');
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

  await safeMountSettings();
  mountMenuButton();

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
