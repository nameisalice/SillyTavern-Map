/**
 * ViewerService boundary.
 *
 * Coordinates the map viewer: opening/closing the panel, centering on
 * the current location, fit-to-viewport, and zoom. Concrete
 * implementation arrives in a later milestone (Leaflet is introduced
 * in Milestone 1).
 */

/** Map viewer coordination contract. */
export interface ViewerService {
  /** Opens the viewer for a map. */
  open(mapId: string): Promise<void>;

  /** Closes the viewer and disposes the renderer instance. */
  close(): void;

  /** Centers the view on the current location. */
  centerOnCurrentLocation(): void;

  /** Fits the map image to the viewport. */
  fitToViewport(): void;
}
