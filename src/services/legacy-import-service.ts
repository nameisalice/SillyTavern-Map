/**
 * Legacy PNG + JSON importer.
 *
 * Converts simple legacy map JSON into canonical Atlas documents. Raw
 * legacy scripts are preserved as untrusted advanced actions and never
 * executed during import.
 */

import type { AtlasAction } from '@/domain/actions';
import type { AtlasMapDocument } from '@/domain/map';
import { validateMapDocument } from '@/domain/map';
import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AssetRepository, MapRepository } from '@/repositories';
import { nameToSlug, uniqueLocationId } from '@/domain/location';

export interface LegacyImportInput {
  readonly json: string;
  readonly image: Uint8Array;
  readonly imageMime: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly fallbackName?: string;
}

export interface LegacyImportResult {
  readonly mapId: string;
  readonly scriptActionCount: number;
}

interface LegacyLocationRecord {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly label?: unknown;
  readonly description?: unknown;
  readonly x?: unknown;
  readonly y?: unknown;
  readonly coordinates?: unknown;
  readonly script?: unknown;
  readonly stscript?: unknown;
}

interface LegacyRegionRecord {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly label?: unknown;
  readonly description?: unknown;
  readonly polygon?: unknown;
  readonly points?: unknown;
  readonly path?: unknown;
  readonly script?: unknown;
  readonly stscript?: unknown;
}

export class LegacyImportService {
  constructor(
    private readonly maps: MapRepository,
    private readonly assets: AssetRepository,
  ) {}

  async importLegacy(input: LegacyImportInput): Promise<LegacyImportResult> {
    const raw = parseLegacyJson(input.json);
    const name = readString(raw['name']) ?? input.fallbackName ?? 'Imported Legacy Map';
    const mapId = await this.uniqueMapId(name);
    const assetId = `${mapId}-background`;
    const width = readPositiveNumber(raw['width']) ?? readPositiveNumber(raw['imageWidth']) ?? 1000;
    const height =
      readPositiveNumber(raw['height']) ?? readPositiveNumber(raw['imageHeight']) ?? 1000;
    const now = new Date().toISOString();

    const locations = this.convertLocations(readArray(raw['locations']) ?? readArray(raw['markers']));
    const regionResult = this.convertRegions(readArray(raw['regions']) ?? readArray(raw['areas']));

    const document: AtlasMapDocument = {
      version: 1,
      id: mapId,
      name,
      type: 'region',
      image: {
        assetId,
        width,
        height,
        mimeType: input.imageMime,
      },
      defaultLocationId: locations[0]?.id,
      locations,
      regions: regionResult.regions,
      routes: [],
      view: {
        minZoom: -2,
        maxZoom: 2,
        initialZoom: 0,
        initialCenter: [50, 50],
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        source: 'legacy-import',
      },
    };

    const validation = validateMapDocument(document);
    if (!validation.ok) {
      throw new Error(validation.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    }
    if (await this.maps.exists(mapId)) {
      throw new Error(`Map "${mapId}" already exists. Legacy import never overwrites.`);
    }

    await this.assets.saveAsset({
      id: assetId,
      kind: 'image',
      mime: input.imageMime,
      data: input.image,
      createdAt: now,
    });
    await this.maps.save(document);
    return { mapId, scriptActionCount: regionResult.scriptActionCount };
  }

  private convertLocations(values: readonly unknown[] | undefined): readonly AtlasLocation[] {
    if (!values) {
      return [];
    }
    const locations: AtlasLocation[] = [];
    for (const value of values) {
      if (!isRecord(value)) {
        continue;
      }
      const record = value as LegacyLocationRecord;
      const name = readString(record.name) ?? readString(record.label) ?? 'Legacy Location';
      const coords = readCoordinates(record);
      const actions = legacyScriptActions(record);
      locations.push({
        id: uniqueLocationId(readString(record.id) ?? name, locations),
        name,
        description: readString(record.description) ?? undefined,
        coordinates: coords,
        actions: actions.length > 0 ? actions : undefined,
      });
    }
    return locations;
  }

  private convertRegions(values: readonly unknown[] | undefined): {
    readonly regions: readonly AtlasRegion[];
    readonly scriptActionCount: number;
  } {
    if (!values) {
      return { regions: [], scriptActionCount: 0 };
    }
    const regions: AtlasRegion[] = [];
    let scriptActionCount = 0;
    for (const value of values) {
      if (!isRecord(value)) {
        continue;
      }
      const record = value as LegacyRegionRecord;
      const polygon = readPolygon(record.polygon) ?? readPolygon(record.points) ?? readSvgPath(record.path);
      if (!polygon || polygon.length < 3) {
        continue;
      }
      const actions = legacyScriptActions(record);
      scriptActionCount += actions.length;
      const name = readString(record.name) ?? readString(record.label) ?? 'Legacy Region';
      regions.push({
        id: uniqueRegionId(readString(record.id) ?? name, regions),
        name,
        description: readString(record.description) ?? undefined,
        polygon,
        actions: actions.length > 0 ? actions : undefined,
      });
    }
    return { regions, scriptActionCount };
  }

  private async uniqueMapId(name: string): Promise<string> {
    const base = nameToSlug(name);
    let id = base;
    let suffix = 2;
    while (await this.maps.exists(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    return id;
  }
}

function parseLegacyJson(json: string): Record<string, unknown> {
  const parsed = JSON.parse(json) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Legacy map JSON must be an object.');
  }
  return parsed;
}

function legacyScriptActions(record: { readonly script?: unknown; readonly stscript?: unknown }): AtlasAction[] {
  const script = readString(record.script) ?? readString(record.stscript);
  if (!script) {
    return [];
  }
  return [{ type: 'run_stscript', script, requiresConfirmation: true, trusted: false }];
}

function readCoordinates(record: LegacyLocationRecord): { x: number; y: number } {
  if (isRecord(record.coordinates)) {
    return {
      x: normalizeCoordinate(record.coordinates['x']),
      y: normalizeCoordinate(record.coordinates['y']),
    };
  }
  return {
    x: normalizeCoordinate(record.x),
    y: normalizeCoordinate(record.y),
  };
}

function readPolygon(value: unknown): readonly (readonly [number, number])[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const points: [number, number][] = [];
  for (const point of value) {
    if (Array.isArray(point) && point.length >= 2) {
      points.push([normalizeCoordinate(point[0]), normalizeCoordinate(point[1])]);
    } else if (isRecord(point)) {
      points.push([normalizeCoordinate(point['x']), normalizeCoordinate(point['y'])]);
    }
  }
  return points.length >= 3 ? points : null;
}

function readSvgPath(value: unknown): readonly (readonly [number, number])[] | null {
  const path = readString(value);
  if (!path) {
    return null;
  }
  const matches = [...path.matchAll(/[ML]\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/gi)];
  const points = matches.map((match) => [
    normalizeCoordinate(Number(match[1])),
    normalizeCoordinate(Number(match[2])),
  ] as const);
  return points.length >= 3 ? points : null;
}

function normalizeCoordinate(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
}

function readPositiveNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueRegionId(name: string, regions: readonly Pick<AtlasRegion, 'id'>[]): string {
  const base = nameToSlug(name);
  const used = new Set(regions.map((region) => region.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}
