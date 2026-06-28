/**
 * Barrel for shared provider types.
 *
 * Re-exports the provider base contracts from `@/providers/base` so
 * consumers that prefer a single types entry point can import them
 * here. The concrete provider interfaces live in `@/providers`.
 */

export type {
  ImageProviderCapabilities,
  ProviderAbortSignal,
  ProviderTestResult,
  TextProviderCapabilities,
} from '@/providers/base';
