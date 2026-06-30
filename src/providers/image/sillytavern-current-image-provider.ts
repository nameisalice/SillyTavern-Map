import type {
  ImageProviderCapabilities,
  ProviderAbortSignal,
  ProviderTestResult,
} from '@/providers/base';
import { tryGetContext } from '@/st/context';
import type { GeneratedMapImage, ImageProvider, MapImageRequest } from './image-provider';

interface CurrentImageContext extends SillyTavernContext {
  readonly generateImage?: (prompt: string, signal?: ProviderAbortSignal) => Promise<GeneratedMapImage>;
}

export class SillyTavernCurrentImageProvider implements ImageProvider {
  readonly id = 'sillytavern-current-image';
  readonly capabilities: ImageProviderCapabilities = {
    synchronous: false,
    asynchronous: true,
    referenceImages: false,
  };

  async testConnection(): Promise<ProviderTestResult> {
    const context = tryGetContext() as CurrentImageContext | null;
    if (!context || typeof context.generateImage !== 'function') {
      return {
        ok: false,
        message: 'Current SillyTavern provider is unavailable in this client.',
      };
    }
    return { ok: true, message: 'Current SillyTavern image provider is available.' };
  }

  async generateImage(
    request: MapImageRequest,
    signal?: ProviderAbortSignal,
  ): Promise<GeneratedMapImage> {
    const context = tryGetContext() as CurrentImageContext | null;
    if (!context || typeof context.generateImage !== 'function') {
      throw new Error('Current SillyTavern image provider is unavailable in this client.');
    }
    const prompt = `${request.prompt}\n\nUnlabeled map background only. No text, labels, markers, pins, or watermarks.`;
    return context.generateImage(prompt, signal);
  }
}
