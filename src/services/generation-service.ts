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
import type { TextProvider } from '@/providers/text';
import { createTextProviderFromSettings } from '@/providers/provider-factory';
import type { AtlasSettings } from '@/types/settings';

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

export class AtlasGenerationService implements GenerationService {
  constructor(
    private readonly textProviders: ReadonlyMap<string, TextProvider>,
    private readonly readSettings?: () => AtlasSettings,
  ) {}

  async generateBlueprint(request: GenerationRequest): Promise<AtlasMapBlueprint> {
    const provider = this.resolveTextProvider(request.preset.textProfileId);
    if (!provider) {
      throw new Error('Text provider is disabled or not configured.');
    }
    return provider.generateMapBlueprint({
      concept: request.concept,
      mapType: request.mapType,
      stylePrompt: request.stylePrompt ?? request.preset.stylePrompt,
    });
  }

  private resolveTextProvider(profileId: string): TextProvider | null {
    const registered = this.textProviders.get(profileId);
    if (registered) {
      return registered;
    }
    if (!this.readSettings) {
      return null;
    }
    return createTextProviderFromSettings(this.readSettings());
  }
}
