import type { AtlasProviderProfile } from '@/providers/base';
import type { ProviderAbortSignal, ProviderTestResult, TextProviderCapabilities } from '@/providers/base';
import { tryGetContext } from '@/st/context';
import type { AtlasMapBlueprint, MapBlueprintRequest, TextProvider } from './text-provider';
import {
  buildMapBlueprintUserPrompt,
  MAP_BLUEPRINT_SYSTEM_PROMPT,
  parseBlueprintFromText,
} from './blueprint-json';

interface ChatCompletionMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface ChatCompletionResponse {
  readonly error?: string | { readonly message?: string };
  readonly choices?: readonly {
    readonly text?: string;
    readonly message?: {
      readonly content?: unknown;
    };
  }[];
}

interface SillyTavernBackendContext extends SillyTavernContext {
  readonly getRequestHeaders?: () => Record<string, string>;
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
      const content = await this.requestChatCompletion(
        [
          {
            role: 'system',
            content: 'Reply with exactly OK.',
          },
          {
            role: 'user',
            content: 'OK',
          },
        ],
        { maxTokens: 8, jsonObject: false },
        signal,
      );
      return {
        ok: content.trim().length > 0,
        message: content.trim().length > 0
          ? 'Text provider connection OK.'
          : 'Text provider returned an empty response.',
        modelId: this.profile.model,
      };
    } catch (error) {
      return {
        ok: false,
        message: this.safeErrorMessage(error, 'Text provider request failed.'),
        modelId: this.profile.model,
      };
    }
  }

  async generateMapBlueprint(
    request: MapBlueprintRequest,
    signal?: ProviderAbortSignal,
  ): Promise<AtlasMapBlueprint> {
    const content = await this.requestChatCompletion(
      [
        {
          role: 'system',
          content: MAP_BLUEPRINT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildMapBlueprintUserPrompt(request),
        },
      ],
      { maxTokens: 1200, jsonObject: true },
      signal,
    );
    return parseBlueprintFromText(content);
  }

  private async requestChatCompletion(
    messages: readonly ChatCompletionMessage[],
    options: { readonly maxTokens: number; readonly jsonObject: boolean },
    signal?: ProviderAbortSignal,
  ): Promise<string> {
    const backendContent = await this.tryRequestViaSillyTavernBackend(messages, options, signal);
    if (backendContent !== null) {
      return backendContent;
    }
    return this.requestDirect(messages, options, signal);
  }

  private async tryRequestViaSillyTavernBackend(
    messages: readonly ChatCompletionMessage[],
    options: { readonly maxTokens: number; readonly jsonObject: boolean },
    signal?: ProviderAbortSignal,
  ): Promise<string | null> {
    const context = tryGetContext() as SillyTavernBackendContext | null;
    if (!context || typeof context.getRequestHeaders !== 'function') {
      return null;
    }

    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: {
        ...context.getRequestHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildSillyTavernBackendBody(messages, options)),
      signal,
    });
    if (response.status === 404 || response.status === 405) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Text provider returned ${response.status}.`);
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    return this.extractContent(payload);
  }

  private async requestDirect(
    messages: readonly ChatCompletionMessage[],
    options: { readonly maxTokens: number; readonly jsonObject: boolean },
    signal?: ProviderAbortSignal,
  ): Promise<string> {
    try {
      const response = await fetch(this.endpoint('/chat/completions'), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          model: this.profile.model,
          messages,
          max_tokens: options.maxTokens,
          response_format: options.jsonObject ? { type: 'json_object' } : undefined,
        }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`Text provider returned ${response.status}.`);
      }
      const payload = (await response.json()) as ChatCompletionResponse;
      return this.extractContent(payload);
    } catch (error) {
      throw new Error(this.safeErrorMessage(error, 'Text provider request failed.'));
    }
  }

  private buildSillyTavernBackendBody(
    messages: readonly ChatCompletionMessage[],
    options: { readonly maxTokens: number; readonly jsonObject: boolean },
  ): Record<string, unknown> {
    const extraHeaders = this.profile.apiKey
      ? { Authorization: `Bearer ${this.profile.apiKey}` }
      : {};
    const extraBody = options.jsonObject ? { response_format: { type: 'json_object' } } : {};
    return {
      chat_completion_source: 'custom',
      custom_url: this.baseEndpoint(),
      custom_include_headers: JSON.stringify(extraHeaders),
      custom_include_body: JSON.stringify(extraBody),
      model: this.profile.model,
      messages,
      max_tokens: options.maxTokens,
      stream: false,
      temperature: 0,
    };
  }

  private extractContent(payload: ChatCompletionResponse): string {
    if (payload.error) {
      const message =
        typeof payload.error === 'string' ? payload.error : payload.error.message;
      throw new Error(message || 'Text provider returned an error.');
    }
    const choice = payload.choices?.[0];
    const content = choice?.message?.content ?? choice?.text;
    if (!content) {
      throw new Error('Text provider returned no blueprint content.');
    }
    return messageContentToString(content);
  }

  private endpoint(path: string): string {
    return `${this.baseEndpoint()}${path}`;
  }

  private baseEndpoint(): string {
    const base = this.profile.endpoint
      ?.trim()
      .replace(/\/+$/, '')
      .replace(/\/chat\/completions$/i, '');
    if (!base) {
      throw new Error('Text provider endpoint is not configured.');
    }
    return base;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.profile.apiKey
      ? { ...extra, Authorization: `Bearer ${this.profile.apiKey}` }
      : extra;
  }

  private safeErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error && error.message ? error.message : fallback;
    const redacted = this.profile.apiKey
      ? message.split(this.profile.apiKey).join('[redacted]')
      : message;
    return redacted === 'Failed to fetch'
      ? 'Text provider request failed before a response was received. In SillyTavern, Atlas uses the SillyTavern backend to avoid browser CORS; outside SillyTavern, the endpoint must allow browser requests.'
      : redacted;
  }
}

function messageContentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'text' in item) {
          const text = (item as { readonly text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return JSON.stringify(content);
}
