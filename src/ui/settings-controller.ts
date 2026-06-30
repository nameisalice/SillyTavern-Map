/**
 * Settings controller: renders the Atlas settings drawer from a bundled
 * HTML template and wires its controls to the settings bridge. The
 * bundled template avoids third-party install path mismatches in
 * SillyTavern's runtime template fetcher.
 */

import { EXTENSION_SETTINGS_SELECTOR } from '@/constants';
import { loadSettings, saveSettings } from '@/st/settings-bridge';
import { getContext } from '@/st/context';
import { logError } from '@/infra/logger';
import { getContainer, SpatialContextServiceToken } from '@/app/bootstrap';
import {
  createImageProviderFromSettings,
  createTextProviderFromSettings,
} from '@/providers/provider-factory';
import type { AtlasProviderMode } from '@/types/common/settings';
import settingsTemplate from '@/templates/settings.html?raw';

/**
 * Renders and inserts the settings drawer.
 * Throws from the host API are caught and logged; the rest of the
 * extension still loads.
 */
export async function mountSettingsDrawer(): Promise<void> {
  const html = settingsTemplate.trim();
  if (!html) {
    logError('Atlas settings template is empty.');
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
  const textProviderMode = root.querySelector<HTMLSelectElement>('#st-atlas-text-provider-mode');
  const textProviderBaseUrl = root.querySelector<HTMLInputElement>(
    '#st-atlas-text-provider-base-url',
  );
  const textProviderApiKey = root.querySelector<HTMLInputElement>('#st-atlas-text-provider-api-key');
  const textProviderModel = root.querySelector<HTMLInputElement>('#st-atlas-text-provider-model');
  const textProviderTimeout = root.querySelector<HTMLInputElement>(
    '#st-atlas-text-provider-timeout',
  );
  const testTextProvider = root.querySelector<HTMLButtonElement>('#st-atlas-test-text-provider');
  const imageProviderMode = root.querySelector<HTMLSelectElement>('#st-atlas-image-provider-mode');
  const imageProviderBaseUrl = root.querySelector<HTMLInputElement>(
    '#st-atlas-image-provider-base-url',
  );
  const imageProviderApiKey = root.querySelector<HTMLInputElement>(
    '#st-atlas-image-provider-api-key',
  );
  const imageProviderModel = root.querySelector<HTMLInputElement>('#st-atlas-image-provider-model');
  const imageProviderResolution = root.querySelector<HTMLInputElement>(
    '#st-atlas-image-provider-resolution',
  );
  const imageProviderTimeout = root.querySelector<HTMLInputElement>(
    '#st-atlas-image-provider-timeout',
  );
  const testImageProvider = root.querySelector<HTMLButtonElement>('#st-atlas-test-image-provider');

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

  if (textProviderMode) {
    textProviderMode.value = settings.textProviderMode;
    textProviderMode.addEventListener('change', () => {
      const mode = textProviderMode.value as AtlasProviderMode;
      updateProviderFieldVisibility(root);
      void triggerChange({ textProviderMode: mode });
    });
  }

  if (textProviderBaseUrl) {
    textProviderBaseUrl.value = settings.textProviderBaseUrl;
    textProviderBaseUrl.addEventListener('change', () => {
      void triggerChange({ textProviderBaseUrl: textProviderBaseUrl.value.trim() });
    });
  }

  if (textProviderApiKey) {
    textProviderApiKey.value = settings.textProviderApiKey;
    textProviderApiKey.addEventListener('change', () => {
      void triggerChange({ textProviderApiKey: textProviderApiKey.value });
    });
  }

  if (textProviderModel) {
    textProviderModel.value = settings.textProviderModel;
    textProviderModel.addEventListener('change', () => {
      void triggerChange({ textProviderModel: textProviderModel.value.trim() });
    });
  }

  if (textProviderTimeout) {
    textProviderTimeout.value = String(settings.textProviderTimeoutMs);
    textProviderTimeout.addEventListener('change', () => {
      void triggerChange({ textProviderTimeoutMs: Number(textProviderTimeout.value) });
    });
  }

  if (testTextProvider) {
    testTextProvider.addEventListener('click', () => {
      void testActiveTextProvider();
    });
  }

  if (imageProviderMode) {
    imageProviderMode.value = settings.imageProviderMode;
    imageProviderMode.addEventListener('change', () => {
      const mode = imageProviderMode.value as AtlasProviderMode;
      updateProviderFieldVisibility(root);
      void triggerChange({ imageProviderMode: mode });
    });
  }

  if (imageProviderBaseUrl) {
    imageProviderBaseUrl.value = settings.imageProviderBaseUrl;
    imageProviderBaseUrl.addEventListener('change', () => {
      void triggerChange({ imageProviderBaseUrl: imageProviderBaseUrl.value.trim() });
    });
  }

  if (imageProviderApiKey) {
    imageProviderApiKey.value = settings.imageProviderApiKey;
    imageProviderApiKey.addEventListener('change', () => {
      void triggerChange({ imageProviderApiKey: imageProviderApiKey.value });
    });
  }

  if (imageProviderModel) {
    imageProviderModel.value = settings.imageProviderModel;
    imageProviderModel.addEventListener('change', () => {
      void triggerChange({ imageProviderModel: imageProviderModel.value.trim() });
    });
  }

  if (imageProviderResolution) {
    imageProviderResolution.value = settings.imageProviderResolution;
    imageProviderResolution.addEventListener('change', () => {
      void triggerChange({ imageProviderResolution: imageProviderResolution.value.trim() });
    });
  }

  if (imageProviderTimeout) {
    imageProviderTimeout.value = String(settings.imageProviderTimeoutMs);
    imageProviderTimeout.addEventListener('change', () => {
      void triggerChange({ imageProviderTimeoutMs: Number(imageProviderTimeout.value) });
    });
  }

  if (testImageProvider) {
    testImageProvider.addEventListener('click', () => {
      void testActiveImageProvider();
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

  updateProviderFieldVisibility(root);
}

export function updateProviderFieldVisibility(root: HTMLElement): void {
  const textMode = root.querySelector<HTMLSelectElement>('#st-atlas-text-provider-mode');
  const imageMode = root.querySelector<HTMLSelectElement>('#st-atlas-image-provider-mode');
  const textFields = root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="text"]');
  const imageFields = root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="image"]');

  if (textFields) {
    textFields.hidden = textMode?.value !== 'openai_compatible';
  }
  if (imageFields) {
    imageFields.hidden = imageMode?.value !== 'openai_compatible';
  }
}

async function testActiveTextProvider(): Promise<void> {
  const provider = createTextProviderFromSettings(loadSettings());
  if (!provider) {
    await showProviderResult('Text provider is disabled.');
    return;
  }
  const result = await provider.testConnection();
  await showProviderResult(result.message);
}

async function testActiveImageProvider(): Promise<void> {
  const provider = createImageProviderFromSettings(loadSettings());
  if (!provider) {
    await showProviderResult('Image provider is disabled.');
    return;
  }
  const result = await provider.testConnection();
  await showProviderResult(result.message);
}

async function showProviderResult(message: string): Promise<void> {
  const context = getContext();
  await context.callGenericPopup(message, context.POPUP_TYPE.TEXT);
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
  textProviderMode: AtlasProviderMode;
  textProviderBaseUrl: string;
  textProviderApiKey: string;
  textProviderModel: string;
  textProviderTimeoutMs: number;
  imageProviderMode: AtlasProviderMode;
  imageProviderBaseUrl: string;
  imageProviderApiKey: string;
  imageProviderModel: string;
  imageProviderResolution: string;
  imageProviderTimeoutMs: number;
}
