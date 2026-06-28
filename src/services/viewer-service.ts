/**
 * ViewerService implementation.
 *
 * Repository-backed: loads a map document from `MapRepository`, resolves
 * its background image asset to a temporary object URL via
 * `AssetRepository`, and revokes that URL when the map changes or the
 * viewer is disposed. The bundled example remains as a fallback/seed
 * when no repository map with that id exists.
 *
 * It deliberately does NOT construct the `ViewerController` — that is UI
 * orchestration owned by the panel (UI → Features is permitted; Services
 * sit below Features).
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument } from '@/domain/map';
import type { EventBus } from '@/core/events';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { getContext } from '@/st/context';
import { logError } from '@/core/logger';
import type { AssetRepository, MapRepository } from '@/repositories';
import type { ResolvedMapImage, ViewerService } from './viewer-service.types';

/** Bundled map id for the first-run experience and fallback. */
const BUNDLED_MAP_ID = 'southern-marches';

/**
 * The concrete viewer service. Constructed by the composition root with
 * the shared EventBus and the repositories.
 */
export class AtlasViewerService implements ViewerService {
  private activeDocument: AtlasMapDocument | null = null;
  private activeImageUrl: string | undefined;
  private readonly eventBus: EventBus;
  private readonly maps: MapRepository;
  private readonly assets: AssetRepository;

  constructor(eventBus: EventBus, maps: MapRepository, assets: AssetRepository) {
    this.eventBus = eventBus;
    this.maps = maps;
    this.assets = assets;
  }

  /** Loads a map document by id, resolving its image asset. */
  async loadMap(mapId: string): Promise<ResolvedMapImage> {
    // Revoke any previously-resolved object URL before swapping maps.
    this.revokeActiveUrl();

    if (mapId === BUNDLED_MAP_ID) {
      // Prefer a stored copy of the bundled example if it was seeded; fall
      // back to the in-memory bundled document otherwise.
      const stored = await this.maps.load(mapId);
      if (stored) {
        this.activeDocument = stored;
        this.activeImageUrl = await this.resolveAssetUrl(stored);
        return { document: stored, imageUrl: this.activeImageUrl };
      }
      this.activeDocument = SOUTHERN_MARCHES;
      return { document: SOUTHERN_MARCHES, imageUrl: SOUTHERN_MARCHES.image.url };
    }

    const document = await this.maps.load(mapId);
    if (!document) {
      throw new Error(`Map "${mapId}" was not found in the library.`);
    }
    this.activeDocument = document;
    this.activeImageUrl = await this.resolveAssetUrl(document);
    return { document, imageUrl: this.activeImageUrl };
  }

  /** Returns the active map document, if any. */
  getActiveMap(): AtlasMapDocument | null {
    return this.activeDocument;
  }

  /** Looks up a location by id within the active map. */
  findLocationById(locationId: string): AtlasLocation | null {
    if (!this.activeDocument) {
      return null;
    }
    return this.activeDocument.locations.find((l) => l.id === locationId) ?? null;
  }

  /** Returns the shared EventBus for the viewer feature to emit on. */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Shows a location detail element through the host Popup API. The
   * element is built by the feature layer; the service owns the host
   * call so features stay free of host-adapter imports.
   */
  async showLocationDetail(element: HTMLElement): Promise<void> {
    try {
      const context = getContext();
      await context.callGenericPopup(element, context.POPUP_TYPE.TEXT);
    } catch (error) {
      // Host popup unavailable (e.g. jsdom); degrade gracefully.
      logError('Failed to show location detail popup.', error);
    }
  }

  /** Ensures the bundled map is loaded and returns it. */
  async ensureLoaded(): Promise<ResolvedMapImage> {
    if (!this.activeDocument) {
      return this.loadMap(BUNDLED_MAP_ID);
    }
    return { document: this.activeDocument, imageUrl: this.activeImageUrl };
  }

  /** Releases the active document reference and revokes any object URL. */
  dispose(): void {
    this.revokeActiveUrl();
    this.activeDocument = null;
  }

  /**
   * Resolves a map's background asset to a temporary object URL. Returns
   * undefined for bundled maps that carry an inline `url`. Surfaces a
   * clear error (logged) if the referenced asset is missing — the viewer
   * will show an error state rather than silently using the wrong image.
   */
  private async resolveAssetUrl(document: AtlasMapDocument): Promise<string | undefined> {
    if (document.image.url) {
      return document.image.url;
    }
    const asset = await this.assets.loadAsset(document.image.assetId);
    if (!asset) {
      logError(`Background asset "${document.image.assetId}" for map "${document.id}" is missing.`);
      return undefined;
    }
    const blob = new Blob([asset.data as BlobPart], { type: asset.metadata.mime });
    return URL.createObjectURL(blob);
  }

  private revokeActiveUrl(): void {
    if (this.activeImageUrl && this.activeImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.activeImageUrl);
    }
    this.activeImageUrl = undefined;
  }
}

// Re-export the service interface for convenience.
export type { ResolvedMapImage, ViewerService };
