import type { AtlasSettings } from '@/types/settings';
import type { TextProvider } from '@/providers/text';
import { OpenAICompatibleTextProvider, SillyTavernCurrentTextProvider } from '@/providers/text';
import type { ImageProvider } from '@/providers/image';
import { OpenAICompatibleImageProvider, SillyTavernCurrentImageProvider } from '@/providers/image';

export function createTextProviderFromSettings(settings: AtlasSettings): TextProvider | null {
  switch (settings.textProviderMode) {
    case 'disabled':
      return null;
    case 'sillytavern_current':
      return new SillyTavernCurrentTextProvider();
    case 'openai_compatible':
      return new OpenAICompatibleTextProvider({
        id: 'atlas-custom-text',
        name: 'Custom OpenAI-compatible Text',
        provider: 'openai-compatible',
        endpoint: settings.textProviderBaseUrl,
        apiKey: settings.textProviderApiKey,
        model: settings.textProviderModel,
        timeoutMs: settings.textProviderTimeoutMs,
      });
  }
}

export function createImageProviderFromSettings(settings: AtlasSettings): ImageProvider | null {
  switch (settings.imageProviderMode) {
    case 'disabled':
      return null;
    case 'sillytavern_current':
      return new SillyTavernCurrentImageProvider();
    case 'openai_compatible':
      return new OpenAICompatibleImageProvider({
        id: 'atlas-custom-image',
        name: 'Custom OpenAI-compatible Image',
        provider: 'openai-compatible',
        endpoint: settings.imageProviderBaseUrl,
        apiKey: settings.imageProviderApiKey,
        model: settings.imageProviderModel,
        timeoutMs: settings.imageProviderTimeoutMs,
      });
  }
}
