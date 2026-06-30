import type { AtlasMapBlueprint, MapBlueprintRequest } from './text-provider';
import { assertValidMapBlueprint } from './blueprint-validation';

export const MAP_BLUEPRINT_SYSTEM_PROMPT =
  'Return only valid JSON for a SillyTavern Atlas map blueprint. Coordinates must be 0-100. Do not include credentials, markdown, comments, or explanatory text.';

export function buildMapBlueprintUserPrompt(request: MapBlueprintRequest): string {
  return [
    `Map type: ${request.mapType}`,
    `Concept: ${request.concept}`,
    `Style: ${request.stylePrompt ?? ''}`,
    '',
    'Required JSON shape:',
    '{"schemaVersion":1,"name":"Map name","type":"map-type","locations":[{"id":"lowercase-slug","name":"Location name","x":50,"y":50}]}',
  ].join('\n');
}

export function parseBlueprintFromText(content: string): AtlasMapBlueprint {
  const parsed = parseJsonObject(content);
  assertValidMapBlueprint(parsed);
  return parsed;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const direct = tryParseJson(trimmed);
  if (direct.ok) {
    return direct.value;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsedFence = tryParseJson(fenced.trim());
    if (parsedFence.ok) {
      return parsedFence.value;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsedSlice = tryParseJson(trimmed.slice(firstBrace, lastBrace + 1));
    if (parsedSlice.ok) {
      return parsedSlice.value;
    }
  }

  throw new Error('Text provider returned blueprint content that was not valid JSON.');
}

function tryParseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}
