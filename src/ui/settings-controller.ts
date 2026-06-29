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
import { getContainer, SpatialContextServiceToken } from '@/app/bootstrap';

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
  await updatePreview(root);
}

/**
 * Reads the current settings into the drawer's controls and binds
 * change handlers that persist updates through the settings bridge.
 */
function wireSettingsControls(root: HTMLElement, settings: AtlasSettingsView): void {
  const enabled = root.querySelector<HTMLInputElement>('#st-atlas-enabled');
  const openMode = root.querySelector<HTMLSelectElement>('#st-atlas-open-mode');
  const loggingLevel = root.querySelector<HTMLSelectElement>('#st-atlas-logging-level');

  // M5 Spatial prompt controls
  const promptInjection = root.querySelector<HTMLInputElement>('#st-atlas-prompt-injection');
  const maxNearby = root.querySelector<HTMLInputElement>('#st-atlas-max-nearby');
  const inclDistances = root.querySelector<HTMLInputElement>('#st-atlas-include-distances');
  const inclDanger = root.querySelector<HTMLInputElement>('#st-atlas-include-danger');
  const inclRestrictions = root.querySelector<HTMLInputElement>('#st-atlas-include-restrictions');
  const sizeLimit = root.querySelector<HTMLInputElement>('#st-atlas-size-limit');
  const promptPosition = root.querySelector<HTMLSelectElement>('#st-atlas-prompt-position');
  const promptDepth = root.querySelector<HTMLInputElement>('#st-atlas-prompt-depth');
  const refreshBtn = root.querySelector<HTMLButtonElement>('#st-atlas-refresh-preview');

  const triggerChange = async (nextSettings: Partial<AtlasSettingsView>) => {
    saveSettings(nextSettings);
    await updatePreview(root);
  };

  if (enabled) {
    enabled.checked = settings.enabled;
    enabled.addEventListener('change', () => {
      void triggerChange({ enabled: enabled.checked });
    });
  }

  if (openMode) {
    openMode.value = settings.openMode;
    openMode.addEventListener('change', () => {
      void triggerChange({ openMode: openMode.value as 'floating' | 'fullscreen' | 'docked' });
    });
  }

  if (loggingLevel) {
    loggingLevel.value = settings.loggingLevel;
    loggingLevel.addEventListener('change', () => {
      void triggerChange({
        loggingLevel: loggingLevel.value as 'error' | 'warn' | 'info' | 'debug',
      });
    });
  }

  if (promptInjection) {
    promptInjection.checked = settings.promptInjectionEnabled;
    promptInjection.addEventListener('change', () => {
      void triggerChange({ promptInjectionEnabled: promptInjection.checked });
    });
  }

  if (maxNearby) {
    maxNearby.value = String(settings.maxNearbyLocations);
    maxNearby.addEventListener('change', () => {
      void triggerChange({ maxNearbyLocations: Number(maxNearby.value) });
    });
  }

  if (inclDistances) {
    inclDistances.checked = settings.includeDistances;
    inclDistances.addEventListener('change', () => {
      void triggerChange({ includeDistances: inclDistances.checked });
    });
  }

  if (inclDanger) {
    inclDanger.checked = settings.includeDangerInfo;
    inclDanger.addEventListener('change', () => {
      void triggerChange({ includeDangerInfo: inclDanger.checked });
    });
  }

  if (inclRestrictions) {
    inclRestrictions.checked = settings.includeRouteRestrictions;
    inclRestrictions.addEventListener('change', () => {
      void triggerChange({ includeRouteRestrictions: inclRestrictions.checked });
    });
  }

  if (sizeLimit) {
    sizeLimit.value = String(settings.contextSizeLimit);
    sizeLimit.addEventListener('change', () => {
      void triggerChange({ contextSizeLimit: Number(sizeLimit.value) });
    });
  }

  if (promptPosition) {
    promptPosition.value = String(settings.promptPosition);
    promptPosition.addEventListener('change', () => {
      void triggerChange({ promptPosition: Number(promptPosition.value) });
    });
  }

  if (promptDepth) {
    promptDepth.value = String(settings.promptDepth);
    promptDepth.addEventListener('change', () => {
      void triggerChange({ promptDepth: Number(promptDepth.value) });
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      void updatePreview(root);
    });
  }
}

/** Updates the spatial context preview textbox. */
async function updatePreview(root: HTMLElement): Promise<void> {
  const textarea = root.querySelector<HTMLTextAreaElement>('#st-atlas-preview');
  if (!textarea) {
    return;
  }
  try {
    const c = getContainer();
    const contextService = c.resolve(SpatialContextServiceToken);
    const text = await contextService.previewContext();
    textarea.value = text || '[Spatial Context is empty or disabled]';
  } catch {
    textarea.value = '[Preview generation failed]';
  }
}

/** Local view of the settings used to populate form controls. */
interface AtlasSettingsView {
  enabled: boolean;
  openMode: 'floating' | 'fullscreen' | 'docked';
  loggingLevel: 'error' | 'warn' | 'info' | 'debug';
  promptInjectionEnabled: boolean;
  maxNearbyLocations: number;
  includeDistances: boolean;
  includeDangerInfo: boolean;
  includeRouteRestrictions: boolean;
  contextSizeLimit: number;
  promptPosition: number;
  promptDepth: number;
}
