import type { AtlasProviderProfile } from '@/providers/base';
import type { ImageProviderCapabilities, ProviderAbortSignal, ProviderTestResult } from '@/providers/base';
import type { GeneratedMapImage, ImageProvider, MapImageRequest } from './image-provider';

interface ImageResponse {
  readonly data?: readonly {
    readonly b64_json?: string;
  }[];
}

export class OpenAICompatibleImageProvider implements ImageProvider {
  readonly id = 'openai-compatible-image';
  readonly capabilities: ImageProviderCapabilities = {
    synchronous: true,
    asynchronous: false,
    referenceImages: false,
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
        message: response.ok ? 'Image provider connection OK.' : `Image provider returned ${response.status}.`,
        modelId: this.profile.model,
      };
    } catch (error) {
      return {
        ok: false,
        message: this.safeErrorMessage(error, 'Image provider request failed.'),
        modelId: this.profile.model,
      };
    }
  }

  async generateImage(
    request: MapImageRequest,
    signal?: ProviderAbortSignal,
  ): Promise<GeneratedMapImage> {
    const prompt = `${request.prompt}\n\nUnlabeled fantasy map background only. No text, labels, legends, icons, pins, markers, UI, or watermarks.`;
    let response: Response;
    try {
      response = await fetch(this.endpoint('/images/generations'), {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          model: this.profile.model,
          prompt,
          size: request.resolution,
          response_format: 'b64_json',
        }),
        signal,
      });
    } catch (error) {
      throw new Error(this.safeErrorMessage(error, 'Image provider request failed.'));
    }
    if (!response.ok) {
      throw new Error(`Image provider returned ${response.status}.`);
    }
    const payload = (await response.json()) as ImageResponse;
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) {
      throw new Error('Image provider returned no image data.');
    }
    return {
      mimeType: 'image/png',
      data: base64ToBytes(encoded),
    };
  }

  private endpoint(path: string): string {
    const base = this.profile.endpoint
      ?.trim()
      .replace(/\/+$/, '')
      .replace(/\/images\/generations$/i, '');
    if (!base) {
      throw new Error('Image provider endpoint is not configured.');
    }
    return `${base}${path}`;
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
      ? 'Image provider request failed before a response was received. The configured endpoint likely blocks browser CORS; use an endpoint that allows browser requests or use Current SillyTavern image provider.'
      : redacted;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
