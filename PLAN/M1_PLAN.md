# Milestone 1 — Map Viewer MVP (implementation plan)

Source of truth: `PLAN/ST_MAP_DEVELOPMENT_PLAN(1).md` §19 Milestone 1, plus the
agent rules in §21 and the acceptance test rule in §18.

## Goal

Display an image map with pan, zoom, and markers. Real modules — no empty
placeholder folders.

## Two latent M0 bugs the viewer depends on (must fix in M1)

1. **Templates never reach the extension root.**
   `renderExtensionTemplateAsync('SillyTavern-Map','panel')` fetches
   `/scripts/extensions/SillyTavern-Map/panel.html` — the extension **folder
   root** (sibling of `manifest.json`), not `dist/`. Webpack currently emits
   nothing there, so the host 404s and the panel/settings silently fall back to
   hardcoded DOM. Fix: copy `src/templates/*.html` to the **repo root** (next to
   `dist/`) via `copy-webpack-plugin`, so the installed extension has
   `panel.html`/`settings.html` at its root where the host fetches them.

2. **No ambient declarations for `*.css` / `*.svg` / `*.html` imports.**
   `tsc --noEmit` will error once the viewer imports a CSS module and an SVG.
   Fix: add `src/types/assets.d.ts` declaring those module shapes.

Both are part of "make the viewer work" — not scope creep.

## Architecture placement (fills real modules, no new empty folders)

Per the layered rules (UI → Features → Services → Domain → Providers → Storage,
Core shared), the viewer is a **feature** that depends on a **service** and
**domain** types. Concretely:

```
src/
  domain/map/        existing AtlasMapDocument — keep; it's the real contract
  domain/location/   existing AtlasLocation — keep
  services/viewer-service.ts   ← implement the interface (was a placeholder)
  features/viewer/   ← fill with real modules (was an empty placeholder)
      map-viewer.ts          Leaflet adapter + lifecycle
      marker-layer.ts        render markers, selection, current-location marker
      tooltip-controller.ts  marker hover/tap detail popup
      viewer-controller.ts   open/close panel, toolbar wiring, dispose
      viewer.css             namespaced .st-atlas styles for canvas/toolbar
      viewer.html            viewer template (canvas + toolbar markup)
  ui/panel-controller.ts      ← host the viewer inside the panel body
  templates/panel.html        ← gain a viewer container + toolbar
```

The existing `ViewerService` interface (`open/close/centerOnCurrentLocation/
fitToViewport`) is implemented for real. No new top-level folders.

## Dependency

- `leaflet@1.9.4` (BSD-2-Clause, libre — verified) + `@types/leaflet@1.9.21`.
- `copy-webpack-plugin@14` (devDep) to ship templates to the extension root.
No CDN; bundled by webpack. Documented why (plan §21 rule 13/14).

## Data: the bundled example map

Plan §26 specifies one bundled example: "Southern Marches" with 7 locations and
6 routes. For M1 we only render markers (routes are M7), so we ship a minimal
example **map document** + a small placeholder **background image**. To stay
libre and avoid a 2.6 MB binary in the repo, the background is a tiny generated
SVG bundled as a webpack asset (or a small PNG authored in-repo). The example
document lives under `src/examples/` and is imported as a JSON module so it
ships inside `dist/index.js` (no runtime fetch, no storage needed — storage is
M2).

The map document uses `schemaVersion: 1` and the existing domain types. Since
we have no real `assetId`-backed image store yet (M2), the example carries an
inline image URL (bundled asset path) rather than an `assetId` blob reference.
I'll add a minimal `AtlasMapDocument`-shaped fixture and document this
simplification as M1-scoped technical debt (reconciled when storage lands).

## Viewer behavior (acceptance criteria mapped)

- Leaflet `CRS.Simple`, image overlay via `L.imageOverlay`.
- Pan (drag) + zoom (wheel/pinch). Marker tap → detail popup.
- Current-location marker visually distinct (different icon/class).
- Toolbar: Fit, Center, Zoom in, Zoom out. (Edit/⋮ come later.)
- **No listener duplication on reopen**: one `MapViewer` instance, reused;
  `L.Map.invalidateSize()` on open; `remove()` only on full dispose.
- **Disposal**: `viewer-controller` disposes the Leaflet instance when the
  panel is destroyed (not on close — close just hides).
- **Mobile**: panel goes fullscreen ≤ a breakpoint; min 44px touch targets;
  no horizontal overflow; works at 360px width.

## EventBus usage (real, finally)

Wire two real events now that infra exists and the milestone touches them:
`MapOpened` (on `open`), `MapClosed` (on dispose), `MarkerSelected` (on
marker tap). Emitted through the container-resolved `EventBus`. This makes the
"don't emit Atlas events yet" constraint from M0.5 lift naturally for the
events this milestone owns. Other events (LocationChanged, Travel*, etc.)
remain unimplemented.

Per your note: EventBus handler errors currently `console.error` directly —
leave as-is for M1 (route through logger later).

## Tests (Vitest + jsdom)

jsdom has no real layout/canvas, so Leaflet rendering is integration-tested
manually. Unit tests cover pure logic:
- `marker-layer`: build marker data from an `AtlasMapDocument`; current-location
  marker selection; filtering hidden markers (hiddenUntilDiscovered).
- `tooltip-controller`: build detail text from a location (no HTML injection —
  `textContent`).
- example-map fixture: schemaVersion, unique ids, finite coordinates
  (mirrors the §9.8 validation intent at the fixture level).
- `viewer-service`/`viewer-controller`: behavior that doesn't need a live
  Leaflet is kept thin; the Leaflet adapter is exercised manually.

## Typecheck/lint/build

- `tsc --noEmit` clean (strict, no `any` — Leaflet brings its own types).
- `eslint .` clean.
- `vitest run` green.
- `webpack --mode production` emits `dist/index.js`, `dist/style.css`, and
  copies `panel.html`/`settings.html` to repo root.

## Manifest / docs

- Manifest: no change required (`js`/`css` already point at `dist/`).
  `minimum_client_version` still omitted (verified reason, pre-release).
- README: add a "Map viewer" section to the architecture/features description
  and note the template-delivery fix. CHANGELOG: M1 entry.

## Out of scope (explicitly NOT done)

Storage/localforage, map library CRUD, marker editor, routes, regions, nested
maps, per-chat location, prompt injection, slash commands, AI. The viewer
loads exactly one bundled example map.

## Commit

`feat: add responsive interactive map viewer` (plan §19 M1).
