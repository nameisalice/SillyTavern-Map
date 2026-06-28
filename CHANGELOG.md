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
