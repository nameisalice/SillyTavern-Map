import type {
  ImageProviderCapabilities,
  ProviderAbortSignal,
  ProviderTestResult,
} from '@/providers/base';
import { tryGetContext } from '@/st/context';
import type { GeneratedMapImage, ImageProvider, MapImageRequest } from './image-provider';

interface CurrentImageContext extends SillyTavernContext {
  readonly generateImage?: (prompt: string, signal?: ProviderAbortSignal) => Promise<GeneratedMapImage>;
  readonly getRequestHeaders?: () => Record<string, string>;
}

type SdSettings = Record<string, unknown>;
type ExtrasFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface ExtrasGlobal {
  readonly doExtrasFetch?: ExtrasFetch;
  readonly getApiUrl?: () => string;
}

const SERVER_SOURCE_ENDPOINTS: Readonly<Record<string, string>> = {
  aimlapi: '/api/sd/aimlapi/generate-image',
  auto: '/api/sd/generate',
  bfl: '/api/sd/bfl/generate',
  chutes: '/api/sd/chutes/generate',
  drawthings: '/api/sd/drawthings/generate',
  electronhub: '/api/sd/electronhub/generate',
  falai: '/api/sd/falai/generate',
  google: '/api/google/generate-image',
  horde: '/api/horde/generate-image',
  huggingface: '/api/sd/huggingface/generate',
  nanogpt: '/api/sd/nanogpt/generate',
  novel: '/api/novelai/generate-image',
  openai: '/api/openai/generate-image',
  openrouter: '/api/openrouter/image/generate',
  pollinations: '/api/sd/pollinations/generate',
  sdcpp: '/api/sd/sdcpp/generate',
  stability: '/api/sd/stability/generate',
  togetherai: '/api/sd/together/generate',
  vlad: '/api/sd/generate',
  workersai: '/api/sd/workersai/generate',
  xai: '/api/sd/xai/generate',
  zai: '/api/sd/zai/generate',
};

export class SillyTavernCurrentImageProvider implements ImageProvider {
  readonly id = 'sillytavern-current-image';
  readonly capabilities: ImageProviderCapabilities = {
    synchronous: false,
    asynchronous: true,
    referenceImages: false,
  };

  async testConnection(): Promise<ProviderTestResult> {
    const context = getCurrentImageContext();
    if (!context) {
      return {
        ok: false,
        message: 'Current SillyTavern provider is unavailable in this client.',
      };
    }
    if (typeof context.generateImage === 'function') {
      return { ok: true, message: 'Current SillyTavern image provider is available.' };
    }

    const settings = getSillyTavernImageSettings(context);
    const source = getSource(settings);
    if (!settings || !source) {
      return {
        ok: false,
        message:
          'Current SillyTavern image provider is not configured. Configure SillyTavern image generation or use a custom image provider.',
      };
    }
    const endpoint = resolveSourceEndpoint(source, settings, context);
    if (!endpoint) {
      if (source === 'extras') {
        return {
          ok: false,
          message:
            'Current SillyTavern image provider uses Extras, but Atlas could not find the Extras API URL.',
          modelId: readString(settings.model),
        };
      }
      return {
        ok: true,
        message: `Current SillyTavern image provider is configured (${source}); Atlas cannot directly generate images from this source yet.`,
        modelId: readString(settings.model),
      };
    }
    return {
      ok: true,
      message: `Current SillyTavern image provider is configured (${source}).`,
      modelId: readString(settings.model),
    };
  }

  async generateImage(
    request: MapImageRequest,
    signal?: ProviderAbortSignal,
  ): Promise<GeneratedMapImage> {
    const context = getCurrentImageContext();
    if (!context) {
      throw new Error('Current SillyTavern image provider is unavailable in this client.');
    }
    const prompt = `${request.prompt}\n\nUnlabeled map background only. No text, labels, markers, pins, or watermarks.`;
    if (typeof context.generateImage === 'function') {
      return context.generateImage(prompt, signal);
    }
    const settings = getSillyTavernImageSettings(context);
    const source = getSource(settings);
    if (!settings || !source) {
      throw new Error('Current SillyTavern image provider is not configured.');
    }
    const endpoint = resolveSourceEndpoint(source, settings, context);
    if (!endpoint) {
      if (source === 'extras') {
        throw new Error(
          'Current SillyTavern image provider uses Extras, but Atlas could not find the Extras API URL.',
        );
      }
      throw new Error(`Atlas cannot directly generate images from SillyTavern source "${source}".`);
    }
    if (source !== 'extras' && typeof context.getRequestHeaders !== 'function') {
      throw new Error('Current SillyTavern image provider cannot access host request headers.');
    }

    const response = await fetchImageEndpoint(source, endpoint, {
      method: 'POST',
      headers: buildRequestHeaders(source, context),
      body: JSON.stringify(buildImageRequestBody(source, settings, request, prompt)),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Current SillyTavern image provider returned ${response.status}.`);
    }
    return imageFromResponse(await readImagePayload(response));
  }
}

function getCurrentImageContext(): CurrentImageContext | null {
  const context = tryGetContext() as CurrentImageContext | null;
  if (!context) {
    return null;
  }
  return context;
}

function getSillyTavernImageSettings(context: CurrentImageContext): SdSettings | null {
  const settings = context.extensionSettings.sd;
  return settings && typeof settings === 'object' ? (settings as SdSettings) : null;
}

function getSource(settings: SdSettings | null): string | null {
  const source = readString(settings?.source);
  return source ? source.toLowerCase() : null;
}

function resolveSourceEndpoint(
  source: string,
  settings: SdSettings,
  context: CurrentImageContext,
): string | null {
  if (source === 'extras') {
    return resolveExtrasEndpoint(settings, context);
  }
  return SERVER_SOURCE_ENDPOINTS[source] ?? null;
}

function resolveExtrasEndpoint(settings: SdSettings, context: CurrentImageContext): string | null {
  const baseUrl =
    readString((context.extensionSettings as Record<string, unknown>).apiUrl) ||
    readString(settings.apiUrl) ||
    readString(settings.extras_api_url) ||
    readString(settings.extrasUrl) ||
    readGlobalExtrasApiUrl();
  if (!baseUrl) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    url.pathname = '/api/image';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function readGlobalExtrasApiUrl(): string | undefined {
  const globalApi = globalThis as ExtrasGlobal;
  if (typeof globalApi.getApiUrl !== 'function') {
    return undefined;
  }
  try {
    return readString(globalApi.getApiUrl());
  } catch {
    return undefined;
  }
}

function buildRequestHeaders(
  source: string,
  context: CurrentImageContext,
): Record<string, string> {
  if (source === 'extras') {
    const apiKey = readString((context.extensionSettings as Record<string, unknown>).apiKey);
    return {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
    };
  }
  return {
    ...(context.getRequestHeaders?.() ?? {}),
    'Content-Type': 'application/json',
  };
}

async function fetchImageEndpoint(
  source: string,
  endpoint: string,
  init: RequestInit,
): Promise<Response> {
  const globalApi = globalThis as ExtrasGlobal;
  if (source === 'extras' && typeof globalApi.doExtrasFetch === 'function') {
    return globalApi.doExtrasFetch(endpoint, init);
  }
  return fetch(endpoint, init);
}

function buildImageRequestBody(
  source: string,
  settings: SdSettings,
  request: MapImageRequest,
  prompt: string,
): Record<string, unknown> {
  const dimensions = resolveDimensions(request.resolution, settings);
  const negativePrompt =
    request.negativePrompt ||
    readString(settings.negative_prompt) ||
    'text, labels, markers, pins, watermark, logo, UI';
  const base = {
    ...buildConnectionBody(source, settings),
    prompt,
    negative_prompt: negativePrompt,
    width: dimensions.width,
    height: dimensions.height,
    model: readString(settings.model),
    sampler_name: readString(settings.sampler),
    scheduler: readString(settings.scheduler),
    steps: readNumber(settings.steps, 20),
    cfg_scale: readNumber(settings.scale, 7),
    seed: readNumber(settings.seed, -1),
  };

  switch (source) {
    case 'extras':
      return {
        prompt,
        sampler: readString(settings.sampler),
        steps: readNumber(settings.steps, 20),
        scale: readNumber(settings.scale, 7),
        width: dimensions.width,
        height: dimensions.height,
        negative_prompt: negativePrompt,
        restore_faces: !!readBoolean(settings.restore_faces),
        enable_hr: !!readBoolean(settings.enable_hr),
        karras: !!readBoolean(settings.horde_karras),
        hr_upscaler: readString(settings.hr_upscaler),
        hr_scale: readNumber(settings.hr_scale, 2),
        denoising_strength: readNumber(settings.denoising_strength, 0.7),
        hr_second_pass_steps: readNumber(settings.hr_second_pass_steps, 0),
        seed: readSeed(settings.seed),
      };
    case 'openai':
      return {
        prompt,
        model: readString(settings.model),
        size: `${dimensions.width}x${dimensions.height}`,
        n: 1,
        quality: readString(settings.openai_quality) || readString(settings.openai_quality_gpt),
        style: readString(settings.openai_style),
        response_format: 'b64_json',
      };
    case 'google':
      return {
        prompt,
        aspect_ratio: closestAspectRatio(dimensions.width, dimensions.height, 'google'),
        negative_prompt: negativePrompt,
        model: readString(settings.model),
        enhance: readBoolean(settings.google_enhance),
        api: readString(settings.google_api) || 'makersuite',
        seed: readSeed(settings.seed),
      };
    case 'openrouter':
      return {
        prompt,
        model: readString(settings.model),
        aspect_ratio: closestAspectRatio(dimensions.width, dimensions.height, 'stability'),
      };
    case 'xai':
      return {
        prompt,
        model: readString(settings.model),
        aspect_ratio: closestAspectRatio(dimensions.width, dimensions.height, 'xai'),
        resolution: dimensions.width * dimensions.height > 1296 * 864 ? '2k' : '1k',
      };
    case 'horde':
      return {
        prompt,
        negative_prompt: negativePrompt,
        model: readString(settings.model),
        width: dimensions.width,
        height: dimensions.height,
        steps: readNumber(settings.steps, 20),
        cfg_scale: readNumber(settings.scale, 7),
        sampler_name: readString(settings.sampler),
      };
    case 'stability':
      return {
        model: readString(settings.model),
        payload: {
          prompt,
          negative_prompt: negativePrompt,
          aspect_ratio: closestAspectRatio(dimensions.width, dimensions.height, 'stability'),
          seed: readSeed(settings.seed),
          style_preset: readString(settings.stability_style_preset),
          output_format: 'png',
        },
      };
    case 'huggingface':
      return {
        model: readString(settings.huggingface_model_id) || readString(settings.model),
        prompt,
      };
    case 'chutes':
      return {
        model: readString(settings.model),
        prompt,
        negative_prompt: negativePrompt,
        width: dimensions.width,
        height: dimensions.height,
        steps: readNumber(settings.steps, 20),
        guidance_scale: readNumber(settings.scale, 7),
      };
    case 'electronhub':
      return {
        model: readString(settings.model),
        prompt,
        size: `${dimensions.width}x${dimensions.height}`,
        quality: readString(settings.electronhub_quality),
      };
    case 'nanogpt':
      return {
        model: readString(settings.model),
        prompt,
        negative_prompt: negativePrompt,
        num_steps: readNumber(settings.steps, 20),
        scale: readNumber(settings.scale, 7),
        width: dimensions.width,
        height: dimensions.height,
        resolution: `${dimensions.width}x${dimensions.height}`,
        showExplicitContent: true,
        nImages: 1,
      };
    case 'bfl':
      return {
        prompt,
        model: readString(settings.model),
        steps: clamp(readNumber(settings.steps, 20), 1, 50),
        guidance: clamp(readNumber(settings.scale, 7), 1.5, 5),
        width: clamp(dimensions.width, 256, 1440),
        height: clamp(dimensions.height, 256, 1440),
        prompt_upsampling: readBoolean(settings.bfl_upsampling),
        seed: readSeed(settings.seed),
      };
    case 'falai':
      return {
        prompt,
        negative_prompt: negativePrompt,
        model: readString(settings.model),
        steps: clamp(readNumber(settings.steps, 20), 1, 50),
        guidance: clamp(readNumber(settings.scale, 7), 1.5, 5),
        width: clamp(dimensions.width, 256, 1440),
        height: clamp(dimensions.height, 256, 1440),
        seed: readSeed(settings.seed),
      };
    case 'aimlapi':
      return {
        prompt,
        model: readString(settings.model),
        width: clamp(dimensions.width, 256, 1440),
        height: clamp(dimensions.height, 256, 1440),
        steps: clamp(readNumber(settings.steps, 20), 1, 50),
        guidance: clamp(readNumber(settings.scale, 7), 1.5, 5),
        seed: readSeed(settings.seed),
        n: 1,
        size: `${dimensions.width}x${dimensions.height}`,
        quality: readString(settings.openai_quality),
        style: readString(settings.openai_style),
      };
    case 'pollinations':
      return {
        prompt,
        negative_prompt: negativePrompt,
        model: readString(settings.model),
        width: dimensions.width,
        height: dimensions.height,
        enhance: readBoolean(settings.pollinations_enhance),
        seed: readSeed(settings.seed),
      };
    case 'togetherai':
      return {
        prompt,
        negative_prompt: negativePrompt,
        model: readString(settings.model),
        steps: readNumber(settings.steps, 20),
        width: dimensions.width,
        height: dimensions.height,
        seed: readSeed(settings.seed),
      };
    case 'sdcpp':
      return {
        url: readString(settings.sdcpp_url),
        model: readString(settings.model),
        prompt,
        negative_prompt: negativePrompt,
        steps: readNumber(settings.steps, 20),
        cfg_scale: readNumber(settings.scale, 7),
        width: dimensions.width,
        height: dimensions.height,
        batch_size: 1,
        seed: readSeed(settings.seed),
        sampler_name: readString(settings.sampler),
        scheduler: readString(settings.scheduler),
        clip_skip: readNumber(settings.clip_skip, 0),
      };
    case 'zai':
      return {
        prompt,
        model: readString(settings.model),
        quality: readString(settings.openai_quality),
        size: `${roundToMultiple(dimensions.width, 32)}x${roundToMultiple(dimensions.height, 32)}`,
      };
    default:
      return base;
  }
}

function buildConnectionBody(source: string, settings: SdSettings): Record<string, unknown> {
  switch (source) {
    case 'auto':
      return { url: readString(settings.auto_url), auth: readString(settings.auto_auth) };
    case 'vlad':
      return { url: readString(settings.vlad_url), auth: readString(settings.vlad_auth) };
    case 'drawthings':
      return {
        url: readString(settings.drawthings_url),
        auth: readString(settings.drawthings_auth),
      };
    default:
      return {};
  }
}

function resolveDimensions(
  requestedResolution: string | undefined,
  settings: SdSettings,
): { width: number; height: number } {
  const parsed = requestedResolution?.match(/^(\d{2,5})x(\d{2,5})$/);
  if (parsed) {
    return {
      width: Number(parsed[1]),
      height: Number(parsed[2]),
    };
  }
  return {
    width: readNumber(settings.width, 1024),
    height: readNumber(settings.height, 1024),
  };
}

async function readImagePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function imageFromResponse(payload: unknown): GeneratedMapImage {
  const encoded = findBase64Image(payload);
  if (!encoded) {
    throw new Error('Current SillyTavern image provider returned no image data.');
  }
  const responseFormat =
    payload && typeof payload === 'object'
      ? readString((payload as Record<string, unknown>).format)
      : undefined;
  const mimeType = encoded.mimeType ?? mimeTypeFromFormat(responseFormat) ?? 'image/png';
  return {
    mimeType,
    data: base64ToBytes(encoded.value),
  };
}

function findBase64Image(
  payload: unknown,
): { readonly value: string; readonly mimeType?: GeneratedMapImage['mimeType'] } | null {
  if (typeof payload === 'string') {
    return parseDataUrlOrBase64(payload);
  }
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.image,
    record.output,
    record.data,
    Array.isArray(record.images) ? record.images[0] : undefined,
    Array.isArray(record.data) ? record.data[0] : undefined,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return parseDataUrlOrBase64(candidate);
    }
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const value = nested.b64_json ?? nested.base64 ?? nested.image;
      if (typeof value === 'string') {
        return parseDataUrlOrBase64(value);
      }
    }
  }
  return null;
}

function parseDataUrlOrBase64(
  value: string,
): { readonly value: string; readonly mimeType?: GeneratedMapImage['mimeType'] } {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) {
    return { value };
  }
  return {
    value: match[2],
    mimeType: match[1] as GeneratedMapImage['mimeType'],
  };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readSeed(value: unknown): number | undefined {
  const seed = readNumber(value, -1);
  return seed >= 0 ? seed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

function closestAspectRatio(
  width: number,
  height: number,
  source: 'google' | 'stability' | 'xai',
): string {
  const ratios: Record<typeof source, Record<string, number>> = {
    google: {
      '1:1': 1,
      '16:9': 16 / 9,
      '9:16': 9 / 16,
      '4:3': 4 / 3,
      '3:4': 3 / 4,
    },
    stability: {
      '16:9': 16 / 9,
      '1:1': 1,
      '21:9': 21 / 9,
      '2:3': 2 / 3,
      '3:2': 3 / 2,
      '4:5': 4 / 5,
      '5:4': 5 / 4,
      '9:16': 9 / 16,
      '9:21': 9 / 21,
    },
    xai: {
      '1:1': 1,
      '3:4': 3 / 4,
      '4:3': 4 / 3,
      '9:16': 9 / 16,
      '16:9': 16 / 9,
      '2:3': 2 / 3,
      '3:2': 3 / 2,
      '9:19.5': 9 / 19.5,
      '19.5:9': 19.5 / 9,
      '9:20': 9 / 20,
      '20:9': 20 / 9,
      '1:2': 1 / 2,
      '2:1': 2,
    },
  };
  const target = width / height;
  return Object.entries(ratios[source]).reduce((best, [name, ratio]) => {
    const bestRatio = ratios[source][best];
    return Math.abs(ratio - target) < Math.abs(bestRatio - target) ? name : best;
  }, Object.keys(ratios[source])[0]);
}

function mimeTypeFromFormat(format: string | undefined): GeneratedMapImage['mimeType'] | undefined {
  switch (format?.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    default:
      return undefined;
  }
}
