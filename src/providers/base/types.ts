/**
 * Shared base types for all Atlas providers.
 *
 * These are the common contracts every provider adapter satisfies,
 * independent of whether it produces text, images, or storage. They
 * are derived from the development plan (§9.3, §9.4, §9.10) but carry
 * no implementation and make no network assumptions.
 */

/** Result of a provider connection test. */
export interface ProviderTestResult {
  /** Whether the provider responded correctly. */
  readonly ok: boolean;
  /** Human-readable summary, safe to show in the UI (no credentials). */
  readonly message: string;
  /** Optional model identifier the provider reported, if any. */
  readonly modelId?: string;
}

/** Capabilities a text provider advertises. */
export interface TextProviderCapabilities {
  /** Whether the provider can return structured (JSON) output. */
  readonly structuredOutput: boolean;
  /** Whether the provider supports streaming responses. */
  readonly streaming: boolean;
}

/** Capabilities an image provider advertises. */
export interface ImageProviderCapabilities {
  /** Whether the provider returns a finished image synchronously. */
  readonly synchronous: boolean;
  /** Whether the provider uses an async task/polling model. */
  readonly asynchronous: boolean;
  /** Whether the provider accepts reference images. */
  readonly referenceImages: boolean;
  /** Supported aspect ratios, if the provider constrains them. */
  readonly aspectRatios?: readonly string[];
  /** Supported resolutions, if the provider constrains them. */
  readonly resolutions?: readonly string[];
}

/**
 * A signal the provider can pass through to an underlying network call
 * to support cancellation. Re-declared here so provider interfaces do
 * not depend on DOM lib types directly, though it matches `AbortSignal`.
 */
export type ProviderAbortSignal = AbortSignal | undefined;
