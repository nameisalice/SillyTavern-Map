import type {
  ProviderAbortSignal,
  ProviderTestResult,
  TextProviderCapabilities,
} from '@/providers/base';
import { tryGetContext } from '@/st/context';
import type { AtlasMapBlueprint, MapBlueprintRequest, TextProvider } from './text-provider';

interface CurrentTextContext extends SillyTavernContext {
  readonly generateRaw?: (prompt: string, signal?: ProviderAbortSignal) => Promise<string>;
}

export class SillyTavernCurrentTextProvider implements TextProvider {
  readonly id = 'sillytavern-current-text';
  readonly capabilities: TextProviderCapabilities = {
    structuredOutput: false,
    streaming: false,
  };

  async testConnection(): Promise<ProviderTestResult> {
    const context = tryGetContext() as CurrentTextContext | null;
    if (!context || typeof context.generateRaw !== 'function') {
      return {
        ok: false,
        message: 'Current SillyTavern provider is unavailable in this client.',
      };
    }
    return { ok: true, message: 'Current SillyTavern text provider is available.' };
  }

  async generateMapBlueprint(
    _request: MapBlueprintRequest,
    _signal?: ProviderAbortSignal,
  ): Promise<AtlasMapBlueprint> {
    throw new Error('Current SillyTavern blueprint generation is unavailable in this client.');
  }
}
