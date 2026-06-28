/**
 * Persistent viewer state.
 *
 * ViewerState is intentionally separate from MapDocument. It stores how
 * a user last viewed a map, not the map's canonical content.
 */

/** Rendered layer currently focused in the viewer. */
export type AtlasViewerLayer = 'locations' | 'regions' | 'routes' | 'custom-markers';

/** Persistent viewer state for one map. */
export interface AtlasViewerState {
  readonly version: 1;
  readonly mapId: string;
  readonly zoom: number;
  readonly center: readonly [number, number];
  readonly selectedMarkerId?: string;
  readonly openedPopupLocationId?: string;
  readonly currentLayer: AtlasViewerLayer;
  readonly fullscreen: boolean;
  readonly updatedAt: string;
}
