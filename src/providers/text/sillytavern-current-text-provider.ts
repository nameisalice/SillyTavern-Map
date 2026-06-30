import type {
  ProviderAbortSignal,
  ProviderTestResult,
  TextProviderCapabilities,
} from '@/providers/base';
import { tryGetContext } from '@/st/context';
import type { AtlasMapBlueprint, MapBlueprintRequest, TextProvider } from './text-provider';
import {
  buildMapBlueprintUserPrompt,
  MAP_BLUEPRINT_SYSTEM_PROMPT,
  parseBlueprintFromText,
} from './blueprint-json';

interface CurrentTextContext extends SillyTavernContext {
  readonly generateRaw?: (prompt: string, ...args: readonly unknown[]) => Promise<string>;
}

interface CurrentTextContextWithGenerate extends CurrentTextContext {
  readonly generateRaw: (prompt: string, ...args: readonly unknown[]) => Promise<string>;
}

export class SillyTavernCurrentTextProvider implements TextProvider {
  readonly id = 'sillytavern-current-text';
  readonly capabilities: TextProviderCapabilities = {
    structuredOutput: false,
    streaming: false,
  };

  async testConnection(): Promise<ProviderTestResult> {
    const context = getCurrentTextContext();
    if (!context) {
      return {
        ok: false,
        message: 'Current SillyTavern provider is unavailable in this client.',
      };
    }
    try {
      const response = await context.generateRaw(
        'Atlas provider test. Reply with exactly: OK',
      );
      if (!response.trim()) {
        return {
          ok: false,
          message: 'Current SillyTavern text provider returned an empty response.',
        };
      }
      return { ok: true, message: 'Current SillyTavern text provider responded.' };
    } catch (error) {
      return {
        ok: false,
        message: safeErrorMessage(error, 'Current SillyTavern text provider failed.'),
      };
    }
  }

  async generateMapBlueprint(
    request: MapBlueprintRequest,
    _signal?: ProviderAbortSignal,
  ): Promise<AtlasMapBlueprint> {
    const context = getCurrentTextContext();
    if (!context) {
      throw new Error('Current SillyTavern provider is unavailable in this client.');
    }
    const prompt = `${MAP_BLUEPRINT_SYSTEM_PROMPT}\n\n${buildMapBlueprintUserPrompt(request)}`;
    const content = await context.generateRaw(prompt);
    return parseBlueprintFromText(content);
  }
}

function getCurrentTextContext(): CurrentTextContextWithGenerate | null {
  const context = tryGetContext() as CurrentTextContext | null;
  if (!context || typeof context.generateRaw !== 'function') {
    return null;
  }
  return context as CurrentTextContextWithGenerate;
}

function safeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
