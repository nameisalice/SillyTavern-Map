/**
 * Panel controller: builds the Atlas panel and hosts the map viewer.
 *
 * The panel is created once and toggled via CSS to avoid listener
 * duplication on reopen (plan §17). When first opened, it asks the
 * `ViewerService` to mount the viewer into the canvas and binds the
 * toolbar buttons to the service's commands.
 *
 * The `ViewerService` is injected by the composition root (bootstrap)
 * via `setViewerService`, so the panel never constructs services itself
 * and never imports the composition root.
 */

import { EXTENSION_NAME } from '@/constants';
import { getContext } from '@/st/context';
import { bindPanel, closePanel, openPanel } from '@/app/lifecycle';
import { logError, logInfo } from '@/core/logger';
import type { ViewerService, ViewerToolbar } from '@/services/viewer-service.types';
import type { TravelService } from '@/services/travel-service.types';
import { ViewerController } from '@/features/viewer/viewer-controller';

/** Lazily-created root element so the panel is built only once. */
let panelRoot: HTMLElement | null = null;
/** The viewer controller, reused across reopens; disposed on panel destroy. */
let viewerController: ViewerController | null = null;
/** Injected by the composition root. */
let viewerService: ViewerService | null = null;
/** Injected by the composition root. */
let travelService: TravelService | null = null;

/**
 * Injects the travel service. Called once by bootstrap before the panel
 * is first opened.
 */
export function setTravelService(service: TravelService): void {
  travelService = service;
}

/**
 * Injects the viewer service. Called once by bootstrap before the panel
 * is first opened.
 */
export function setViewerService(service: ViewerService): void {
  viewerService = service;

  // Bind reload/refresh when active map or chat changes.
  const bus = service.getEventBus();
  bus.subscribe('ChatAtlasStateLoaded', () => {
    updateLocationBadge();
    void reloadViewer();
  });
  bus.subscribe('ActiveMapChanged', () => {
    updateLocationBadge();
    void reloadViewer();
  });
  bus.subscribe('LocationChanged', () => {
    updateLocationBadge();
    void reloadViewer();
  });
}

/** Recreates the viewer. Called when chat state or map changes. */
export function reloadViewer(): void {
  if (viewerController) {
    viewerController.dispose();
    viewerController = null;
  }
  void mountViewer();
}

/**
 * Returns the panel root, creating it on first call. The panel is
 * hidden by default; call [[openAtlasPanel]] to show it.
 */
export function getPanelRoot(): HTMLElement {
  if (panelRoot) {
    return panelRoot;
  }
  panelRoot = createPanel();
  document.body.append(panelRoot);
  bindPanel(panelRoot);
  return panelRoot;
}

/** Opens the Atlas panel, creating it on first use and mounting the viewer. */
export function openAtlasPanel(): void {
  getPanelRoot();
  openPanel();
  void mountViewer();
  logInfo('Atlas panel opened.');
}

/** Closes the Atlas panel (keeps the viewer instance alive). */
export function closeAtlasPanel(): void {
  closePanel();
}

/** Centers the active viewer on the current location. */
export function centerActiveViewer(): void {
  viewerController?.centerOnCurrent();
}

/**
 * Builds the panel DOM from the host-rendered template. Falls back to a
 * vanilla DOM if the template cannot be rendered.
 */
function createPanel(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'st-atlas__panel';
  root.setAttribute('data-st-atlas', 'panel');
  root.setAttribute('data-st-atlas-panel-state', 'closed');

  try {
    const context = getContext();
    void context.renderExtensionTemplateAsync(EXTENSION_NAME, 'panel').then((html) => {
      if (panelRoot === root && html) {
        root.innerHTML = html;
        wirePanelControls(root);
        // The viewer may have been requested before the template landed.
        if (!viewerController) {
          void mountViewer();
        }
      }
    });
  } catch (error) {
    logError('Failed to render Atlas panel template; using fallback.', error);
    buildFallbackPanel(root);
    wirePanelControls(root);
  }
  // Wire the close button immediately (fallback has it; template wires
  // again once loaded — idempotent because it queries the same element).
  wirePanelControls(root);
  return root;
}

/**
 * Constructs a minimal panel from raw DOM when the template path is
 * unavailable. Mirrors the template structure: header + toolbar + body.
 */
function buildFallbackPanel(root: HTMLElement): void {
  const header = document.createElement('div');
  header.className = 'st-atlas__panel-header';

  const title = document.createElement('span');
  title.className = 'st-atlas__panel-title';
  title.textContent = 'Atlas';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'st-atlas__panel-close menu_button menu_button_icon';
  close.setAttribute('aria-label', 'Close Atlas panel');
  close.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'st-atlas__panel-body';
  const canvas = document.createElement('div');
  canvas.className = 'st-atlas__canvas';
  canvas.setAttribute('data-st-atlas', 'canvas');
  body.append(canvas);

  root.append(header, body);
}

/** Wires the close button. */
function wirePanelControls(root: HTMLElement): void {
  const close = root.querySelector<HTMLElement>('.st-atlas__panel-close');
  if (close) {
    // Replace to avoid duplicate listeners on re-render.
    close.replaceWith(close.cloneNode(true));
    const fresh = root.querySelector<HTMLElement>('.st-atlas__panel-close');
    fresh?.addEventListener('click', () => closeAtlasPanel());
  }
}

/**
 * Mounts the viewer into the panel canvas, constructing the
 * `ViewerController` with dependencies injected from the service.
 * Runs once; subsequent calls are no-ops (the viewer instance is reused
 * across reopens — no listener duplication).
 */
/**
 * Mounts the viewer into the panel canvas, constructing the
 * `ViewerController` with dependencies injected from the service.
 * Runs once; subsequent calls are no-ops (the viewer instance is reused
 * across reopens — no listener duplication).
 */
async function mountViewer(): Promise<void> {
  if (viewerController || !panelRoot || !viewerService) {
    return;
  }
  const canvas = panelRoot.querySelector<HTMLElement>('[data-st-atlas="canvas"]');
  if (!canvas) {
    // Template not loaded yet; will retry on template load.
    return;
  }
  try {
    const service = viewerService;
    const activeMapId = travelService?.getActiveMapId();
    const currentLocId = travelService?.getCurrentLocationId() ?? undefined;
    const chatState = await travelService?.loadChatState();
    const discoveredLocationIds = new Set(chatState?.discoveredLocationIds ?? []);

    const resolved = activeMapId
      ? await service.loadMap(activeMapId)
      : await service.ensureLoaded();

    viewerController = new ViewerController({
      container: canvas,
      document: resolved.document,
      imageUrlOverride: resolved.imageUrl,
      eventBus: service.getEventBus(),
      bindToolbar: (commands: ViewerToolbar) => bindToolbar(commands),
      showDetail: (element) => service.showLocationDetail(element),
      requestTravel: (locationId) => void handleTravel(locationId),
      discoveredLocationIds,
      currentLocationId: currentLocId,
    });
    viewerController.open();
    updateLocationBadge();
  } catch (error) {
    logError('Failed to mount map viewer.', error);
  }
}

/** Handles location travel requests by prompting for confirmation and overrides. */
async function handleTravel(locationId: string): Promise<void> {
  if (!travelService || !viewerService) {
    return;
  }
  const activeMap = viewerService.getActiveMap();
  if (!activeMap) {
    return;
  }
  const location = activeMap.locations.find((l) => l.id === locationId);
  if (!location) {
    return;
  }

  // Travel confirmation popup
  const context = getContext();
  const confirmResult = (await context.callGenericPopup(
    `Do you want to travel to "${location.name}"?`,
    context.POPUP_TYPE.CONFIRM,
  )) as number;

  if (confirmResult !== 1) {
    return;
  }

  // Attempt travel
  const res = await travelService.travelTo(locationId, 'click', false);
  if (!res.success && res.requiresOverride) {
    // Route override confirmation popup
    const overrideResult = (await context.callGenericPopup(
      `No direct route exists to "${location.name}". Travel anyway?`,
      context.POPUP_TYPE.CONFIRM,
    )) as number;

    if (overrideResult === 1) {
      await travelService.travelTo(locationId, 'click', true);
    }
  } else if (!res.success && res.error) {
    await context.callGenericPopup(res.error, context.POPUP_TYPE.TEXT);
  }
}

/**
 * Updates the current-location badge appended to the SillyTavern
 * chat input container (#send_form).
 */
export function updateLocationBadge(): void {
  const sendForm = document.querySelector('#send_form');
  if (!sendForm) {
    return;
  }

  let badge = document.querySelector('#st-atlas-location-badge') as HTMLElement | null;
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'st-atlas-location-badge';
    badge.className = 'st-atlas__location-badge';
    // Append at the beginning of the form
    sendForm.prepend(badge);
  }

  const mapId = travelService?.getActiveMapId();
  const locId = travelService?.getCurrentLocationId();

  if (!mapId) {
    badge.style.display = 'none';
    return;
  }

  badge.style.display = 'inline-flex';
  const activeMap = viewerService?.getActiveMap();
  const mapName = activeMap?.name ?? mapId;
  const location = activeMap?.locations.find((l) => l.id === locId);
  const locName = location?.name ?? locId ?? 'Unknown Location';

  badge.textContent = `${mapName} / ${locName}`;
}

/**
 * Binds toolbar buttons to viewer commands. Buttons are identified by
 * `data-st-atlas-action`.
 */
function bindToolbar(commands: ViewerToolbar): void {
  if (!panelRoot) {
    return;
  }
  const buttons = panelRoot.querySelectorAll<HTMLElement>('.st-atlas__toolbar-btn');
  for (const btn of buttons) {
    const action = btn.getAttribute('data-st-atlas-action');
    const handler = toolbarHandler(action, commands);
    if (handler) {
      btn.addEventListener('click', handler);
    }
  }
}

function toolbarHandler(action: string | null, commands: ViewerToolbar): (() => void) | null {
  switch (action) {
    case 'fit':
      return () => commands.onFit();
    case 'center':
      return () => commands.onCenter();
    case 'zoom-in':
      return () => commands.onZoomIn();
    case 'zoom-out':
      return () => commands.onZoomOut();
    default:
      return null;
  }
}
