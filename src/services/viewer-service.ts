/**
 * ViewerService implementation.
 *
 * Coordinates data and host interaction for the map viewer: loads the
 * bundled example map, looks up locations, owns the host Popup call for
 * location details, and exposes the shared EventBus. It deliberately
 * does NOT construct the `ViewerController` — that is UI orchestration
 * owned by the panel (UI → Features is permitted; Services must sit
 * below Features).
 *
 * For Milestone 1 there is exactly one bundled map and no storage, so
 * `loadMap` returns the bundled example. Milestone 2 (storage) will
 * replace this with a repository lookup.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument } from '@/domain/map';
import type { EventBus } from '@/core/events';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { getContext } from '@/st/context';
import { logError } from '@/core/logger';
import type { ViewerService } from './viewer-service.types';

/** Bundled map id for the first-run experience. */
const BUNDLED_MAP_ID = 'southern-marches';

/**
 * The concrete viewer service. Constructed by the composition root with
 * the shared EventBus.
 */
export class AtlasViewerService implements ViewerService {
  private activeDocument: AtlasMapDocument | null = null;
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Loads a map document by id, making it active. */
  async loadMap(mapId: string): Promise<AtlasMapDocument> {
    // Milestone 1: only the bundled example is available.
    if (mapId === BUNDLED_MAP_ID) {
      this.activeDocument = SOUTHERN_MARCHES;
      return SOUTHERN_MARCHES;
    }
    throw new Error(
      `Map "${mapId}" not found. Only the bundled example is available in Milestone 1.`,
    );
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
  async ensureLoaded(): Promise<AtlasMapDocument> {
    if (!this.activeDocument) {
      await this.loadMap(BUNDLED_MAP_ID);
    }
    return this.activeDocument!;
  }

  /** Releases the active document reference. */
  dispose(): void {
    this.activeDocument = null;
  }
}

// Re-export the service interface for convenience.
export type { ViewerService };
