/**
 * AI-assisted generation domain types.
 *
 * Derived from the development plan (§9.2, §9.5, §9.11). These describe
 * map types, generation presets, and generation metadata. AI generation
 * is always optional; these types exist so the domain layer has a
 * canonical vocabulary before the provider implementations land.
 *
 * Pure type declarations — no logic, no network.
 */

/** Map type categories supported by the generation wizard. */
export type AtlasMapType =
  | 'world'
  | 'continent'
  | 'region'
  | 'city'
  | 'district'
  | 'building'
  | 'room'
  | 'dungeon'
  | 'custom';

/** A named preset binding a text profile and an optional image profile. */
export interface AtlasGenerationPreset {
  readonly id: string;
  readonly name: string;
  readonly textProfileId: string;
  readonly imageProfileId?: string;
  readonly mapType: AtlasMapType;
  readonly stylePrompt?: string;
  readonly negativePrompt?: string;
  readonly aspectRatio?: string;
  readonly resolution?: string;
}

/** Lightweight generation metadata stored with a map. No credentials. */
export interface AtlasGenerationMetadata {
  readonly generated: boolean;
  readonly textProviderId?: string;
  readonly textModel?: string;
  readonly imageProviderId?: string;
  readonly imageModel?: string;
  readonly generatedAt?: string;
  readonly promptHash?: string;
}
