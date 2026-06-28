/**
 * GenerationService boundary.
 *
 * Orchestrates optional AI-assisted map generation through the text and
 * image provider abstractions. Always optional; the extension remains
 * usable when generation is disabled. Concrete implementation arrives
 * in a later milestone.
 */

import type { AtlasGenerationPreset, AtlasMapType } from '@/domain';
import type { AtlasMapBlueprint } from '@/providers/text';

/** Request to generate a map blueprint. */
export interface GenerationRequest {
  readonly concept: string;
  readonly mapType: AtlasMapType;
  readonly preset: AtlasGenerationPreset;
  readonly stylePrompt?: string;
}

/** AI-assisted generation coordination contract. */
export interface GenerationService {
  /** Generates a validated map blueprint from a concept. */
  generateBlueprint(request: GenerationRequest): Promise<AtlasMapBlueprint>;
}
