import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasGenerationService } from '@/services';
import { OpenAICompatibleImageProvider } from '@/providers/image';
import {
  OpenAICompatibleTextProvider,
  validateMapBlueprint,
  type TextProvider,
} from '@/providers/text';
import type { AtlasGenerationPreset } from '@/domain';

describe('M9 blueprint validation', () => {
  it('accepts valid structured blueprints and rejects malformed coordinates', () => {
    expect(
      validateMapBlueprint({
        schemaVersion: 1,
        name: 'Generated City',
        type: 'city',
        locations: [{ id: 'gate', name: 'Gate', x: 20, y: 30 }],
      }).ok,
    ).toBe(true);

    const invalid = validateMapBlueprint({
      schemaVersion: 1,
      name: 'Bad',
      type: 'city',
      locations: [{ id: 'Gate', name: 'Gate', x: 200, y: 30 }],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.some((error) => error.includes('lowercase slug'))).toBe(true);
    expect(invalid.errors.some((error) => error.includes('between 0 and 100'))).toBe(true);
  });
});

describe('M9 OpenAI-compatible providers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates and validates a text blueprint from JSON response content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schemaVersion: 1,
                  name: 'Generated Region',
                  type: 'region',
                  locations: [{ id: 'camp', name: 'Camp', x: 10, y: 20 }],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAICompatibleTextProvider({
      id: 'text-1',
      name: 'Text',
      provider: 'openai-compatible',
      endpoint: 'https://example.test/v1',
      model: 'mock-model',
      apiKey: 'secret',
    });

    const blueprint = await provider.generateMapBlueprint({
      concept: 'frontier',
      mapType: 'region',
    });

    expect(blueprint.name).toBe('Generated Region');
    const request = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as Record<string, unknown>;
    expect(JSON.stringify(request)).not.toContain('secret');
  });

  it('requests unlabeled image backgrounds and decodes returned image bytes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: btoa('\x01\x02\x03') }] }), {
        status: 200,
      }),
    );
    const provider = new OpenAICompatibleImageProvider({
      id: 'image-1',
      name: 'Image',
      provider: 'openai-compatible',
      endpoint: 'https://example.test/v1',
      model: 'image-model',
    });

    const image = await provider.generateImage({ prompt: 'forest region', resolution: '1024x1024' });

    expect([...image.data]).toEqual([1, 2, 3]);
    const request = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as { prompt: string };
    expect(request.prompt).toContain('No text');
    expect(request.prompt).toContain('markers');
  });
});

describe('M9 generation service', () => {
  it('uses configured text provider profile and fails closed when missing', async () => {
    const preset: AtlasGenerationPreset = {
      id: 'preset',
      name: 'Preset',
      textProfileId: 'text-profile',
      mapType: 'city',
    };
    const provider: TextProvider = {
      id: 'text-provider',
      capabilities: { structuredOutput: true, streaming: false },
      testConnection: vi.fn(),
      generateMapBlueprint: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        name: 'City',
        type: 'city',
        locations: [],
      }),
    };
    const service = new AtlasGenerationService(new Map([['text-profile', provider]]));

    await expect(
      service.generateBlueprint({ concept: 'canals', mapType: 'city', preset }),
    ).resolves.toMatchObject({ name: 'City' });

    const missing = new AtlasGenerationService(new Map());
    await expect(
      missing.generateBlueprint({ concept: 'canals', mapType: 'city', preset }),
    ).rejects.toThrow(/disabled or not configured/);
  });
});
