/**
 * Bootstrap: the single orchestrator that starts Atlas after the host
 * is ready.
 *
 * Each step is independent and wrapped so that a failure in one
 * non-critical step (e.g. mounting the settings drawer) does not
 * prevent the rest of the extension from loading. Critical failures
 * (no host context) surface a toast and stop.
 */

import { EXTENSIONS_MENU_SELECTOR } from '@/constants';
import { tryGetContext } from '@/st/context';
import { loadSettings } from '@/st/settings-bridge';
import { mountSettingsDrawer } from '@/ui/settings-controller';
import { openAtlasPanel } from '@/ui/panel-controller';
import { logError, logInfo } from '@/infra/logger';

/**
 * Starts Atlas. Intended to be called from the host's jQuery ready
 * callback in `index.ts`. Returns `true` on success.
 */
export async function bootstrap(): Promise<boolean> {
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
