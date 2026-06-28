# Changelog

All notable changes to SillyTavern Atlas are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- TypeScript strict-mode project foundation with Webpack production and development
  builds.
- ESLint (flat config, TypeScript parser, no `any`) and Prettier formatting.
- Vitest unit-test harness with a jsdom environment.
- `global.d.ts` ambient type declarations for the SillyTavern host context surface.
- Valid `manifest.json` referencing `dist/index.js` and `dist/style.css`.
- Extension bootstrap using `SillyTavern.getContext()`, with an error boundary that
  never lets an uncaught exception reach the host.
- Minimal settings drawer rendered from an HTML template via
  `renderExtensionTemplateAsync`, wired to an `extensionSettings`-backed settings
  bridge.
- Atlas launcher button in the SillyTavern Extensions menu.
- Minimal placeholder panel that opens and closes via CSS toggling (created once, no
  listener duplication on reopen).
- Namespaced CSS (`.st-atlas` / `[data-st-atlas]`) following SillyTavern theme
  variables.
- Leveled logger utility with a stable console prefix.
- README, CONTRIBUTING, and SECURITY documentation.

### Changed (Milestone 0.5 — architecture refinement)

- Introduced a strict layered architecture: `UI → Features → Services → Domain →
Providers → Storage`, with a shared `core/` layer.
- Moved lifecycle and logger into `src/core/` (`lifecycle/`, `logger/`); bootstrap is
  the composition root in `src/app/bootstrap.ts`. The old `src/infra/` path is now a
  backward-compat re-export shim for the logger.
- Added `src/core/errors/` (typed Atlas error hierarchy), `src/core/events/` (a
  strongly-typed EventBus — infrastructure only, no Atlas events emitted), and
  `src/core/container/` (a lightweight dependency container for singleton/service
  registration).
- Added `src/providers/` (`base/`, `text/`, `image/`, `storage/`) — interfaces only,
  no implementations or network.
- Added `src/domain/` (`map/`, `location/`, `region/`, `route/`, `actions/`,
  `travel/`, `generation/`) — canonical data contracts and placeholders.
- Added `src/services/` (MapService, TravelService, GenerationService, ImportService,
  ExportService, ViewerService) — architectural boundaries only.
- Added `src/features/` (viewer, editor, travel, generation, library, import, export)
  — self-contained placeholders.
- Reorganized `src/types/` into `common/`, `events/`, `providers/`, `map/`; the old
  `src/types/settings.ts` is now a re-export shim.
- Added future-asset directories `src/assets/{icons,markers,themes}`.
- Expanded README with an architecture overview, folder responsibilities, dependency
  rules, module boundaries, extension lifecycle, and the future provider architecture.
- Documented why `minimum_client_version` is omitted from the manifest.

### Notes

- This milestone establishes the foundation only. No map rendering, markers, editor,
  storage, slash commands, prompt injection, function tools, or AI provider features
  are included. Those arrive in subsequent milestones.

## [0.2.0] — Unreleased — Milestone 1 (Map Viewer MVP)

### Added

- Interactive map viewer built on Leaflet with `CRS.Simple`, treating the map image
  as a flat coordinate plane. Pan (drag) and zoom (wheel / pinch) work on desktop and
  touch.
- Bundled example map "Southern Marches" (plan §26): seven locations and six routes,
  with a libre SVG placeholder background. Coordinates are normalized to [0, 100] and
  mapped into image pixel space with y inverted.
- Marker layer rendering locations as Leaflet `divIcon` markers, with a visually
  distinct current-location marker, selection highlight, and hidden-location filtering
  (undiscovered `hiddenUntilDiscovered` locations are not rendered).
- Tooltip / detail controller building safe location detail (all dynamic text via
  `textContent`, never `innerHTML`) shown through the host `callGenericPopup` API.
- Viewer toolbar: Fit-to-viewport, Center on current location, Zoom in, Zoom out.
- Responsive fullscreen layout at ≤ 600px width with 44px minimum touch targets; no
  horizontal overflow; usable at 360px width.
- Real `ViewerService` implementation (was a placeholder) plus `AtlasViewerService`,
  registered in the dependency container and injected into the panel.
- Real viewer feature modules (were placeholders): `map-viewer`, `marker-layer`,
  `tooltip-controller`, `viewer-controller`.
- The `EventBus` now carries real events: `MapOpened`, `MapClosed`, `MarkerSelected`.
- Ambient declarations for `*.css` / `*.svg` / `*.html` imports (`src/types/assets.d.ts`).
- Vitest unit tests for marker-layer logic, tooltip HTML-safety, and the example-map
  fixture (28 tests total).

### Changed

- Webpack now copies `src/templates/*.html` to the extension root (sibling of
  `manifest.json`) so `renderExtensionTemplateAsync` can fetch them at runtime — this
  fixes a latent M0 bug where templates 404'd and the panel/settings fell back to
  hardcoded DOM.
- The panel template (`panel.html`) now contains the viewer canvas + toolbar; the
  panel controller hosts the viewer and reuses one `ViewerController` across reopens
  (no listener duplication), disposing it only on panel destroy.
- `AtlasMapImage` gained an optional `url` (for bundled/inlined images) and the MIME
  union added `image/svg+xml`; `assetId` became optional. Reconciled with the
  localforage store when storage lands (Milestone 2).
- `global.d.ts` extended with `callGenericPopup`, `POPUP_TYPE`, and `isMobile`.

### Notes

- No storage, map library CRUD, marker editor, routes, regions, nested maps, per-chat
  location, prompt injection, slash commands, or AI features. The viewer loads exactly
  one bundled example map.

## [0.3.0] — Unreleased — Milestone 2 (Persistence Layer and Map Repository)

### Added

- Canonical versioned `AtlasMapDocument` (`version: 1`) with map `type`, asset-backed
  image references, locations, regions, routes, view defaults, theme, and metadata.
- Persistent `AtlasViewerState` model, separate from MapDocument.
- Extended chat-state model with campaign id, bookmarks, and fog-state reference (model
  only; no chat integration yet).
- Asset model (`AtlasAssetMetadata`) for images, thumbnails, and icons: id, mime,
  checksum, size, createdAt.
- Generic `StorageProvider` abstraction with `save`, `load`, `delete`, `list`, and
  `exists`, plus `LocalForageStorageProvider` backed by SillyTavern's
  `window.localforage` shim.
- Repository layer: `MapRepository`, `AssetRepository`, `ThumbnailRepository`, and
  `ViewerStateRepository`.
- Map library backend (`MapLibraryService`) for list/search/rename/duplicate/delete.
- Portable single-JSON `AtlasMapPackage` import/export format: manifest + map JSON +
  base64 assets.
- Import/export services with validation, duplicate detection, asset checksum
  verification, and checksum-based asset deduplication. Imports never overwrite
  automatically.
- Migration pipeline (`upgradeDocument`) and validation pipeline (`validateMapDocument`).
- 13 new persistence-focused tests; 41 total tests passing.

### Changed

- `PLAN/` is now removed from git tracking and ignored, per repository hygiene guidance.
- `AtlasMapImage.assetId` is canonical again; bundled example maps may keep `url` only
  as a fallback.
- `AtlasSettings` now includes a lightweight `mapIndex`; repositories sync index changes
  through an injected callback rather than importing settings directly.

### Notes

- No editor, upload UI, drawing tools, AI, prompt injection, slash commands, travel, or
  chat integration were added.

## [0.4.0] — Unreleased — Milestone 3 (Visual Marker Editor and Map Creation)

### Added

- Create Map workflow: collects name, map type, optional description, and a
  background image; builds a draft only after minimum fields are valid.
- Image upload service: validates MIME (PNG/JPEG/WebP), enforces a 20 MB
  limit, decodes to record intrinsic dimensions, stores via AssetRepository
  by assetId, revokes temporary object URLs. SVG upload is disabled for
  user-provided files (unsafe inline-rendering risk); the bundled SVG example
  remains.
- Visual marker editor: click-to-add (converts Leaflet coords to normalized
  [0,100]), marker selection, property editing (name, description, category,
  icon, danger level 0-5, aliases, hidden/discovered flags, World Info
  keywords, set-as-default), marker dragging (one history entry per drag,
  clamped coords), and marker deletion (clears selection + defaultLocationId,
  undoable).
- Editor state model separate from AtlasMapDocument: selection, mode
  (edit/preview), dirty, canUndo/canRedo. The editor works on a deep clone;
  repository-owned documents are never mutated.
- Bounded undo/redo history (max 100 entries, snapshot-based, binary assets
  referenced by id only). Redo clears after a new command.
- Preview mode: hides editor handles, disables drag and click-to-add,
  preserves camera, opens marker details, writes nothing to persistence.
- Validation before save: reuses the M2 pipeline plus editor-specific
  constraints; invalid maps cannot be saved; warnings for empty maps etc.
- Unsaved-change protection: Save / Discard / Cancel guard on editor exit,
  map switch, and viewer open; a single beforeunload listener removed on
  dispose.
- Minimal map library UI: list, open in viewer, open in editor, create,
  delete with confirmation. Exercises the repository layer through real UI.
- Viewer repository integration: ViewerService resolves assetId to a
  temporary object URL via AssetRepository, revokes on map change/dispose;
  bundled example remains as fallback/seed; missing assets surface a clear
  error rather than a silent wrong image.
- Thumbnail service: canvas-based, max 320px long edge, WebP preferred with
  PNG fallback, generated once and reused via ThumbnailRepository; failures
  are non-fatal.
- Editor events on the EventBus: EditorOpened, EditorClosed, MapDraftChanged,
  MapSaved, MapDeleted, EditorLocationSelected, EditorModeChanged.
- Focused editor modules (no God class): EditorSession, EditorHistory,
  MarkerEditor, PropertyPanel, EditorController, MapDraftService,
  ThumbnailService, ImageUploadService.
- 23 new editor/thumbnail tests; 64 total tests passing.

### Changed

- `MarkerLayer` gained optional drag support (`setDraggable`) shared by the
  viewer and editor.
- `MapViewer` accepts an optional `imageUrlOverride` for repository-resolved
  object URLs; `ViewerController` passes it through.
- `ViewerService.loadMap` now returns a `ResolvedMapImage` (document + URL)
  and is backed by MapRepository + AssetRepository.
- Slug/id helpers (`nameToSlug`, `uniqueLocationId`, `uniqueMapId`) moved to
  the domain layer so services do not import features.
- Bootstrap registers MapDraftService, ImageUploadService, ThumbnailService,
  injects them into the panel and Create Map workflow, and adds an "Atlas
  Library" menu button.

### Notes

- No region/polygon editing, route editing, nested maps, travel, per-chat
  persistence, fog of war, AI, prompt injection, slash commands, or function
  tools were added.
