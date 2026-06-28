/**
 * ViewerService boundary types.
 *
 * The service owns data + host interaction for the viewer; the panel
 * (UI) owns the ViewerController orchestration. The interface fixes the
 * contract between them.
 */

import type { AtlasMapDocument } from '@/domain/map';
import type { AtlasLocation } from '@/domain/location';
import type { EventBus } from '@/core/events';

/** Toolbar commands the viewer surfaces to the panel. */
export interface ViewerToolbar {
  readonly onFit: () => void;
  readonly onCenter: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}

/** A resolved image for a map document. */
export interface ResolvedMapImage {
  readonly document: AtlasMapDocument;
  /** Object URL for the background image, or undefined for bundled maps. */
  readonly imageUrl?: string;
}

/** Map viewer coordination contract. */
export interface ViewerService {
  /** Returns the active map document for the current chat, if any. */
  getActiveMap(): AtlasMapDocument | null;

  /**
   * Loads a map document by id, making it active. Resolves the
   * background image asset to an object URL for persistent maps.
   * Bundled maps return their inline `url`.
   */
  loadMap(mapId: string): Promise<ResolvedMapImage>;

  /** Ensures the bundled map is loaded and returns it. */
  ensureLoaded(): Promise<ResolvedMapImage>;

  /** Looks up a location by id within the active map. */
  findLocationById(locationId: string): AtlasLocation | null;

  /** Returns the shared EventBus for the viewer feature to emit on. */
  getEventBus(): EventBus;

  /**
   * Shows a location detail element through the host Popup API. The
   * element is built by the caller (feature layer); the service owns
   * the host call.
   */
  showLocationDetail(element: HTMLElement): Promise<void>;

  /** Releases the active document reference and revokes any object URL. */
  dispose(): void;
}
