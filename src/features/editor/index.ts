/**
 * Barrel for the editor feature module.
 *
 * The editor is lazy-loaded only after the user selects Edit (plan §3.1).
 * It depends on services and domain, never on providers or the host
 * directly. Host interaction (popups) is injected via callbacks.
 */

export {
  NORMALIZED_MAX,
  NORMALIZED_MIN,
  clamp,
  latLngToNormalized,
  nameToSlug,
  uniqueLocationId,
  uniqueMapId,
} from './coordinate-utils';
export {
  type AtlasEditorState,
  type EditorMode,
  type EditorSubMode,
  createEditorState,
} from './editor-state';
export { type EditorSnapshot, EditorHistory, MAX_HISTORY } from './editor-history';
export {
  type AddRegionInput,
  type AddRouteInput,
  type AddMarkerInput,
  type DeleteMarkerResult,
  type MarkerFieldUpdate,
  type RegionFieldUpdate,
  type RouteFieldUpdate,
  addMarker,
  addRegion,
  addRegionPoint,
  addRoute,
  addRoutePoint,
  deleteMarker,
  deleteRegion,
  deleteRoute,
  editMarker,
  editRegion,
  editRoute,
  moveMarker,
  moveRegionPoint,
  moveRoutePoint,
  removeRegionPoint,
  removeRoutePoint,
  setDefaultLocation,
} from './marker-editor';
export {
  UNSAVED_ACTIONS,
  type UnsavedAction,
  type UnsavedChangeDecision,
  type UnsavedPromptResponse,
  resolveUnsavedChange,
} from './unsaved-changes';
export { EditorSession } from './editor-session';
export { PropertyPanel, type PropertyPanelValues } from './property-panel';
export { type EditorPopup, type EditorToolbar, EditorController } from './editor-controller';
