import { describe, expect, it, vi } from 'vitest';
import { createImageProviderFromSettings, createTextProviderFromSettings } from '@/providers';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { OpenAICompatibleTextProvider, SillyTavernCurrentTextProvider } from '@/providers/text';
import { OpenAICompatibleImageProvider, SillyTavernCurrentImageProvider } from '@/providers/image';
import { updateProviderFieldVisibility } from '@/ui/settings-controller';
import * as contextBridge from '@/st/context';

describe('AI provider settings factory', () => {
  it('returns null for disabled providers', () => {
    expect(createTextProviderFromSettings(DEFAULT_SETTINGS)).toBeNull();
    expect(createImageProviderFromSettings(DEFAULT_SETTINGS)).toBeNull();
  });

  it('creates OpenAI-compatible providers from custom settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      textProviderMode: 'openai_compatible' as const,
      textProviderBaseUrl: 'https://example.test/v1',
      textProviderModel: 'text-model',
      textProviderApiKey: 'secret-text',
      imageProviderMode: 'openai_compatible' as const,
      imageProviderBaseUrl: 'https://image.test/v1',
      imageProviderModel: 'image-model',
      imageProviderApiKey: 'secret-image',
    };

    expect(createTextProviderFromSettings(settings)).toBeInstanceOf(OpenAICompatibleTextProvider);
    expect(createImageProviderFromSettings(settings)).toBeInstanceOf(OpenAICompatibleImageProvider);
  });

  it('creates current SillyTavern providers that fail closed when host APIs are missing', async () => {
    vi.spyOn(contextBridge, 'tryGetContext').mockReturnValue(null);
    const settings = {
      ...DEFAULT_SETTINGS,
      textProviderMode: 'sillytavern_current' as const,
      imageProviderMode: 'sillytavern_current' as const,
    };

    const textProvider = createTextProviderFromSettings(settings);
    const imageProvider = createImageProviderFromSettings(settings);

    expect(textProvider).toBeInstanceOf(SillyTavernCurrentTextProvider);
    expect(imageProvider).toBeInstanceOf(SillyTavernCurrentImageProvider);
    await expect(textProvider?.testConnection()).resolves.toMatchObject({ ok: false });
    await expect(imageProvider?.testConnection()).resolves.toMatchObject({ ok: false });
  });
});

describe('AI provider settings UI', () => {
  it('toggles custom field groups only for OpenAI-compatible mode', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <select id="st-atlas-text-provider-mode"><option value="disabled">Disabled</option><option value="openai_compatible">Custom</option></select>
      <div data-st-atlas-provider-fields="text"></div>
      <select id="st-atlas-image-provider-mode"><option value="sillytavern_current">Current</option><option value="openai_compatible">Custom</option></select>
      <div data-st-atlas-provider-fields="image"></div>
    `;

    updateProviderFieldVisibility(root);
    expect(root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="text"]')?.hidden).toBe(
      true,
    );
    expect(root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="image"]')?.hidden).toBe(
      true,
    );

    root.querySelector<HTMLSelectElement>('#st-atlas-text-provider-mode')!.value =
      'openai_compatible';
    root.querySelector<HTMLSelectElement>('#st-atlas-image-provider-mode')!.value =
      'openai_compatible';
    updateProviderFieldVisibility(root);

    expect(root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="text"]')?.hidden).toBe(
      false,
    );
    expect(root.querySelector<HTMLElement>('[data-st-atlas-provider-fields="image"]')?.hidden).toBe(
      false,
    );
  });
});
