import type { AtlasProviderProfile } from '@/providers/base';
import type { ProviderAbortSignal, ProviderTestResult, TextProviderCapabilities } from '@/providers/base';
import type { AtlasMapBlueprint, MapBlueprintRequest, TextProvider } from './text-provider';
import { assertValidMapBlueprint } from './blueprint-validation';

interface ChatCompletionResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

export class OpenAICompatibleTextProvider implements TextProvider {
  readonly id = 'openai-compatible-text';
  readonly capabilities: TextProviderCapabilities = {
    structuredOutput: true,
    streaming: false,
  };

  constructor(private readonly profile: AtlasProviderProfile) {}

  async testConnection(signal?: ProviderAbortSignal): Promise<ProviderTestResult> {
    try {
      const response = await fetch(this.endpoint('/models'), {
        method: 'GET',
        headers: this.headers(),
        signal,
      });
      return {
        ok: response.ok,
        message: response.ok ? 'Text provider connection OK.' : `Text provider returned ${response.status}.`,
        modelId: this.profile.model,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async generateMapBlueprint(
    request: MapBlueprintRequest,
    signal?: ProviderAbortSignal,
  ): Promise<AtlasMapBlueprint> {
    const response = await fetch(this.endpoint('/chat/completions'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: this.profile.model,
        messages: [
          {
            role: 'system',
            content:
              'Return only valid JSON for a SillyTavern Atlas map blueprint. Coordinates must be 0-100. Do not include credentials.',
          },
          {
            role: 'user',
            content: `Map type: ${request.mapType}\nConcept: ${request.concept}\nStyle: ${
              request.stylePrompt ?? ''
            }`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Text provider returned ${response.status}.`);
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Text provider returned no blueprint content.');
    }
    const blueprint = JSON.parse(content) as unknown;
    assertValidMapBlueprint(blueprint);
    return blueprint;
  }

  private endpoint(path: string): string {
    const base = this.profile.endpoint?.replace(/\/$/, '');
    if (!base) {
      throw new Error('Text provider endpoint is not configured.');
    }
    return `${base}${path}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.profile.apiKey
      ? { ...extra, Authorization: `Bearer ${this.profile.apiKey}` }
      : extra;
  }
}
