/**
 * Image provider contract.
 *
 * An image provider produces an unlabeled background image for a map.
 * The contract is derived from the development plan (§9.4, §9.9).
 * Atlas remains the source of truth for labels, markers, and routes;
 * a generated image must never bake in text or markers.
 *
 * Only the interface is declared here. Implementations (SillyTavern
 * image integration, OpenAI-compatible images, async task/polling,
 * generic REST) arrive in a later milestone and must live behind this
 * adapter.
 */

import type {
  ImageProviderCapabilities,
  ProviderAbortSignal,
  ProviderTestResult,
} from '@/providers/base';

/** Request for a generated map background image. */
export interface MapImageRequest {
  /** Prompt describing the desired unlabeled background. */
  readonly prompt: string;
  /** Optional negative prompt. */
  readonly negativePrompt?: string;
  /** Optional aspect ratio constraint. */
  readonly aspectRatio?: string;
  /** Optional resolution constraint. */
  readonly resolution?: string;
}

/** A generated map background image. */
export interface GeneratedMapImage {
  /** MIME type of the returned image data. */
  readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Raw image bytes. */
  readonly data: Uint8Array;
  /** Pixel width, if known. */
  readonly width?: number;
  /** Pixel height, if known. */
  readonly height?: number;
}

/**
 * An image provider adapter. Implementations must:
 * - Request unlabeled backgrounds (no text, no legends, no markers).
 * - Support cancellation and timeout via the optional signal.
 * - Validate image MIME type and size before returning.
 * - Never embed credentials in the result.
 */
export interface ImageProvider {
  /** Stable provider identifier, e.g. 'async-task'. */
  readonly id: string;
  /** Advertised capabilities. */
  readonly capabilities: ImageProviderCapabilities;

  /** Tests the provider connection without generating anything. */
  testConnection(signal?: ProviderAbortSignal): Promise<ProviderTestResult>;

  /** Generates an unlabeled map background image. */
  generateImage(request: MapImageRequest, signal?: ProviderAbortSignal): Promise<GeneratedMapImage>;
}
