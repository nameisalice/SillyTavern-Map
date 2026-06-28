/**
 * Settings controller: renders the Atlas settings drawer from an HTML
 * template and wires its controls to the settings bridge.
 *
 * The template is loaded via the host's `renderExtensionTemplateAsync`
 * (never by string-concatenating HTML), and appended to the host
 * Extension Settings column. All selectors are namespaced under
 * `.st-atlas`.
 */

import { EXTENSION_NAME, EXTENSION_SETTINGS_SELECTOR } from '@/constants';
import { loadSettings, saveSettings } from '@/st/settings-bridge';
import { getContext } from '@/st/context';
import { logError } from '@/infra/logger';

/**
 * Renders and inserts the settings drawer.
 * Throws from the host API are caught and logged; the rest of the
 * extension still loads.
 */
export async function mountSettingsDrawer(): Promise<void> {
  let html: string;
  try {
    const context = getContext();
    html = await context.renderExtensionTemplateAsync(EXTENSION_NAME, 'settings');
  } catch (error) {
    logError('Failed to render Atlas settings template.', error);
    return;
  }

  const container = document.querySelector(EXTENSION_SETTINGS_SELECTOR);
  if (!container) {
    logError(`Extension settings container "${EXTENSION_SETTINGS_SELECTOR}" not found.`);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const root = wrapper.firstElementChild as HTMLElement | null;
  if (!root) {
    logError('Atlas settings template produced an empty root element.');
    return;
  }
  container.append(root);

  const settings = loadSettings();
  wireSettingsControls(root, settings);
}

/**
 * Reads the current settings into the drawer's controls and binds
 * change handlers that persist updates through the settings bridge.
 */
function wireSettingsControls(root: HTMLElement, settings: AtlasSettingsView): void {
  const enabled = root.querySelector<HTMLInputElement>('#st-atlas-enabled');
  const openMode = root.querySelector<HTMLSelectElement>('#st-atlas-open-mode');
  const loggingLevel = root.querySelector<HTMLSelectElement>('#st-atlas-logging-level');

  if (enabled) {
    enabled.checked = settings.enabled;
    enabled.addEventListener('change', () => {
      saveSettings({ enabled: enabled.checked });
    });
  }

  if (openMode) {
    openMode.value = settings.openMode;
    openMode.addEventListener('change', () => {
      saveSettings({ openMode: openMode.value as 'floating' | 'fullscreen' | 'docked' });
    });
  }

  if (loggingLevel) {
    loggingLevel.value = settings.loggingLevel;
    loggingLevel.addEventListener('change', () => {
      saveSettings({
        loggingLevel: loggingLevel.value as 'error' | 'warn' | 'info' | 'debug',
      });
    });
  }
}

/** Local view of the settings used to populate form controls. */
interface AtlasSettingsView {
  enabled: boolean;
  openMode: 'floating' | 'fullscreen' | 'docked';
  loggingLevel: 'error' | 'warn' | 'info' | 'debug';
}
