/**
 * Text provider contract.
 *
 * A text provider produces a validated map blueprint (structured JSON)
 * from a user concept. The contract is derived from the development
 * plan (§9.3). Only the interface is declared here; implementations
 * (SillyTavern main API, OpenAI-compatible) arrive in a later milestone
 * and must live behind this adapter so map-domain code never couples
 * to a specific service.
 *
 * The request/result shapes are declared locally as forward references.
 * When the domain generation layer lands, it will provide the canonical
 * `MapBlueprintRequest` and `AtlasMapBlueprint` types and this interface
 * will re-export them. No implementation is provided here.
 */

import type {
  ProviderAbortSignal,
  ProviderTestResult,
  TextProviderCapabilities,
} from '@/providers/base';

/**
 * Request for a generated map blueprint. Minimal shape; the domain
 * layer will expand and own the canonical version.
 */
export interface MapBlueprintRequest {
  /** Free-form user concept for the map. */
  readonly concept: string;
  /** Map type, e.g. 'world', 'city', 'room'. */
  readonly mapType: string;
  /** Optional style guidance. */
  readonly stylePrompt?: string;
}

/**
 * Structured map blueprint returned by a text provider. Minimal shape;
 * the domain layer will own the validated canonical version.
 */
export interface AtlasMapBlueprint {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly type: string;
  readonly locations: readonly {
    readonly id: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
  }[];
}

/**
 * A text provider adapter. Implementations must:
 * - Never embed credentials in the result.
 * - Return JSON matching the validated blueprint schema.
 * - Support cancellation and timeout via the optional signal.
 * - Never become a hard dependency of the map viewer.
 */
export interface TextProvider {
  /** Stable provider identifier, e.g. 'openai-compatible'. */
  readonly id: string;
  /** Advertised capabilities. */
  readonly capabilities: TextProviderCapabilities;

  /** Tests the provider connection without generating anything. */
  testConnection(signal?: ProviderAbortSignal): Promise<ProviderTestResult>;

  /** Generates a validated map blueprint from a request. */
  generateMapBlueprint(
    request: MapBlueprintRequest,
    signal?: ProviderAbortSignal,
  ): Promise<AtlasMapBlueprint>;
}
