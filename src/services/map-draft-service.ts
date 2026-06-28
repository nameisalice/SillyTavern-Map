/**
 * Map draft service.
 *
 * Creates fresh draft documents for the Create Map workflow and saves
 * working documents through the existing repository layer. It owns no
 * persistence details — only orchestration of MapRepository and
 * AssetRepository. It never touches localforage.
 */

import type {
  AtlasAssetMetadata,
  AtlasMapDocument,
  AtlasMapImage,
  MapImageMimeType,
} from '@/domain/map';
import type { AtlasMapType } from '@/domain/generation';
import type { AssetRepository, MapRepository } from '@/repositories';
import { uniqueMapId } from '@/domain/location';
import { nowIso } from '@/repositories/repository-utils';
import { ATLAS_MAP_DOCUMENT_VERSION } from '@/domain/map';

/** Input for creating a new map draft. */
export interface CreateMapDraftInput {
  readonly name: string;
  readonly type: AtlasMapType;
  readonly description?: string;
  readonly imageAssetId: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageMimeType: MapImageMimeType;
  readonly imageChecksum?: string;
}

/**
 * Creates and persists map drafts. The Create Map workflow builds a draft
 * here; the editor mutates a clone of it; Save persists through this
 * service.
 */
export class MapDraftService {
  constructor(
    private readonly maps: MapRepository,
    private readonly assets: AssetRepository,
  ) {}

  /**
   * Builds a fresh unsaved draft document. Does NOT persist it — the
   * editor works on the draft and persists only on Save.
   */
  buildDraft(input: CreateMapDraftInput): AtlasMapDocument {
    const id = input.imageAssetId;
    const image: AtlasMapImage = {
      assetId: input.imageAssetId,
      width: input.imageWidth,
      height: input.imageHeight,
      mimeType: input.imageMimeType,
      checksum: input.imageChecksum,
    };
    const now = nowIso();
    return {
      version: ATLAS_MAP_DOCUMENT_VERSION,
      id,
      name: input.name,
      type: input.type,
      description: input.description,
      image,
      locations: [],
      regions: [],
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
        source: 'editor',
      },
    };
  }

  /**
   * Ensures a map id is unique against the stored index. Used by the
   * Create Map workflow when finalizing an id from the map name.
   */
  async uniqueIdForName(name: string): Promise<string> {
    const index = await this.maps.listIndex();
    return uniqueMapId(name, index);
  }

  /**
   * Saves a working document through MapRepository. Preserves the
   * original `createdAt` and updates `updatedAt`. The document must
   * already pass validation (MapRepository re-validates).
   */
  async save(document: AtlasMapDocument): Promise<AtlasMapDocument> {
    const existing = await this.maps.load(document.id);
    const createdAt = existing?.metadata.createdAt ?? document.metadata.createdAt;
    const saved: AtlasMapDocument = {
      ...document,
      metadata: {
        ...document.metadata,
        createdAt,
        updatedAt: nowIso(),
      },
    };
    await this.maps.save(saved);
    return saved;
  }

  /** Returns the asset metadata for a map's background image, if present. */
  async loadImageAsset(assetId: string): Promise<AtlasAssetMetadata | null> {
    const asset = await this.assets.loadAsset(assetId);
    return asset?.metadata ?? null;
  }
}
