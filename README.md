# SillyTavern Atlas

A lightweight, modern interactive map extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

Atlas turns a static world map into an interactive roleplay companion: import a map
image, place locations by clicking, track the player's current location per chat, open
nested maps (world → city → building → room), and inject concise spatial context into
the model's generations.

> **Status:** Foundation + architecture + map viewer MVP (M0 / M0.5 / M1). The build,
> tests, linting, and bootstrap are working, the layered architecture is in place, and
> an interactive image-map viewer with pan, zoom, and markers is bundled with one
> example map. Storage, the marker editor, per-chat location, prompt injection, and
> AI generation arrive in later milestones.

This project is a rework of the original proof-of-concept
[`Elthial/SillyTavern-Map`](https://github.com/Elthial/SillyTavern-Map), which remains
the original source of the concept and is preserved here only as a migration reference.
Full attribution is retained under the MIT license (see [LICENSE](./LICENSE)).

## Principles

- **Lightweight first** — no React, no Tailwind, no Bootstrap. Vanilla DOM, HTML
  templates, namespaced CSS, and SillyTavern theme variables.
- **Local-first** — no server plugin, database, or cloud account required for the core
  extension.
- **Safe by default** — declarative actions only; raw STScript is disabled until
  explicitly enabled; imported scripts never run automatically.
- **SillyTavern-native** — `SillyTavern.getContext()` over direct internal imports,
  `renderExtensionTemplateAsync` for UI, Font Awesome icons, ST popups/toasts/settings.

## Requirements

- A recent release of [SillyTavern](https://github.com/SillyTavern/SillyTavern).
- Node.js 18+ and npm (for building from source).

## Installation for users

Install through SillyTavern's third-party extension installer using this repository:

```
https://github.com/nameisalice/SillyTavern-Map
```

After installation, the **Atlas** button appears in the SillyTavern Extensions menu,
and an **Atlas** settings drawer appears in Extension Settings.

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### First-time setup

```bash
npm install
```

### Available scripts

| Script                 | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Watch mode development build (rebuilds on change). |
| `npm run build`        | Production build into `dist/`.                     |
| `npm run typecheck`    | TypeScript strict type-check (`tsc --noEmit`).     |
| `npm run lint`         | Lint with ESLint.                                  |
| `npm run lint:fix`     | Lint and auto-fix.                                 |
| `npm run format`       | Format with Prettier.                              |
| `npm run format:check` | Check formatting without writing.                  |
| `npm run test`         | Run the Vitest unit tests once.                    |
| `npm run test:watch`   | Run tests in watch mode.                           |
| `npm run check`        | Type-check, lint, test, and build in one command.  |

### Building

```bash
npm install
npm run build
```

The production build writes to `dist/`:

```
dist/
├─ index.js    # referenced by manifest.json "js"
└─ style.css   # referenced by manifest.json "css"
```

### Local manual test in SillyTavern

To test a local build inside a running SillyTavern:

1. Build the extension: `npm run build`.
2. Copy or symlink this repository into your SillyTavern
   `data/default-user/extensions/` (third-party) directory.
3. Restart (or reload) SillyTavern.
4. Open the Extensions menu and click **Atlas**.
5. Verify the Atlas panel opens and closes without console errors. The bundled
   "Southern Marches" example map renders: it pans (drag) and zooms (wheel / pinch),
   markers are clickable and show a location detail popup, the current-location
   marker (Mournwood Gate) is visually distinct, and the toolbar buttons
   (Fit / Center / Zoom in / Zoom out) work. Resizing to a narrow width switches the
   panel to a fullscreen layout.

## Architecture

Atlas is organized in strict layers with a one-way dependency direction. Core is
shared across every layer.

```
UI  →  Features  →  Services  →  Domain  →  Providers  →  Storage
                          ↑
                        Core (shared)
```

### Dependency rules

- **UI** may call Features and Services. UI must **never** call Providers or Storage
  directly.
- **Features** are self-contained vertical slices. A feature depends on Services (and,
  through them, Domain/Providers). A feature never imports another feature's internals —
  features communicate via Services and the EventBus.
- **Services** coordinate everything. A service depends on Domain types and Provider
  interfaces, and on other services resolved through the dependency container — **never
  by constructing them directly** (`new Logger()`, `new SettingsBridge()` inside an
  unrelated module is forbidden).
- **Domain** holds the canonical data contracts and pure logic (validation, migration,
  coordinate normalization, lookup). Domain **must never** import UI, Features,
  Services, Providers, or Storage.
- **Providers** know how to talk to external services (text models, image endpoints,
  storage backends) and nothing else. Providers **must never** know about UI.
- **Storage** is the persistence backend behind provider abstractions. The host-backed
  `extensionSettings` and `chatMetadata` are reached through `getContext()` adapters in
  `src/st/`, not from domain or UI directly.
- **Core** (errors, logger, events, container, lifecycle) is shared. It
  depends on nothing above it. It must not depend on UI, Features, Services, Domain,
  Providers, or Storage. The composition root (`src/app/bootstrap.ts`) is the one
  exception: it wires everything together and is therefore outside `core/`.

### Folder responsibilities

```
src/
├─ index.ts              Entry: host ready callback + bootstrap; imports CSS
├─ constants.ts          Extension name, storage keys, log prefix, host selectors
├─ app/                  Composition root (allowed to wire everything)
│  └─ bootstrap.ts       Registers core singletons, mounts UI, error boundary
├─ core/                 Shared core (no upward dependencies)
│  ├─ errors/            Typed Atlas error hierarchy
│  ├─ logger/            Leveled logger with stable prefix
│  ├─ events/            Strongly-typed EventBus (no Atlas events emitted yet)
│  ├─ container/         Lightweight dependency container (singleton/service)
│  └─ lifecycle/         Panel open/close state machine
├─ st/                   SillyTavern host adapters (infrastructure, not a layer)
│  ├─ context.ts         getContext() adapter; no direct internal imports
│  └─ settings-bridge.ts extensionSettings load/save with default-merge
├─ types/                Shared types barrel
│  ├─ common/            Settings + cross-cutting primitives
│  ├─ events/            Re-exports the event map from core
│  ├─ providers/         Re-exports provider base contracts
│  └─ map/               Re-exports canonical map document types
├─ domain/               Canonical data contracts + future pure logic
│  ├─ map/               AtlasMapDocument and related types
│  ├─ location/          AtlasLocation, coordinates, danger levels
│  ├─ region/            AtlasRegion, polygon type
│  ├─ route/             AtlasRoute, distance/travel units
│  ├─ actions/           Declarative AtlasAction discriminated union
│  ├─ travel/            Per-chat AtlasChatState, travel history
│  └─ generation/        Map types, generation presets, metadata
├─ providers/            External-service abstractions (interfaces only)
│  ├─ base/              Shared provider base types
│  ├─ text/              TextProvider (blueprint generation)
│  ├─ image/             ImageProvider (unlabeled background generation)
│  └─ storage/           AssetStore, MapDocumentStore
├─ services/             Application service boundaries (interfaces only)
│  ├─ map-service.ts     MapService
│  ├─ travel-service.ts  TravelService
│  ├─ generation-service.ts GenerationService
│  ├─ import-service.ts  ImportService
│  ├─ export-service.ts  ExportService
│  └─ viewer-service.ts  ViewerService
├─ features/             Self-contained feature modules
│  ├─ viewer/            Map viewer (Leaflet adapter, marker layer, tooltip, controller)
│  ├─ editor/            Visual editor UI (lazy-loaded, placeholder)
│  ├─ travel/            Travel UI + current-location badge (placeholder)
│  ├─ generation/        AI generation wizard (optional, placeholder)
│  ├─ library/           Map library screen (placeholder)
│  ├─ import/            Import UI (placeholder)
│  └─ export/            Export UI (placeholder)
├─ examples/             Bundled example map (Southern Marches) + placeholder artwork
│  ├─ travel/            Travel UI + current-location badge
│  ├─ generation/        AI generation wizard (optional)
│  ├─ library/           Map library screen
│  ├─ import/            Import UI
│  └─ export/            Export UI
├─ ui/                   Currently-mounted UI controllers
│  ├─ settings-controller.ts  Settings drawer (template-rendered)
│  └─ panel-controller.ts     Placeholder panel
├─ templates/            Host-rendered HTML templates (settings, panel); copied to the
│                        extension root by the build so renderExtensionTemplateAsync
│                        can fetch them at runtime
├─ styles/               Namespaced CSS (.st-atlas / [data-st-atlas])
└─ assets/               Future binary assets
   ├─ icons/             Custom UI icons
   ├─ markers/           Marker artwork
   └─ themes/            Optional canvas themes
```

### Module boundaries

- **No God classes, no giant files.** Each module has one responsibility. Bootstrap is
  the only place that wires modules together.
- **No global mutable state.** Module-scoped state (e.g. the logger level, the panel
  state) is intentional and minimal; cross-module state flows through the container or
  the EventBus.
- **Host coupling is isolated.** Every `SillyTavern.getContext()` call goes through
  `src/st/context.ts`. Atlas never imports host internals (`power-user.js`,
  `RossAscends-mods.js`, `slash-commands.js`) directly.
- **Legacy paths are shims.** During the M0.5 migration, `src/infra/logger.ts`,
  `src/app/bootstrap.ts`, `src/app/lifecycle.ts`, and `src/types/settings.ts` were
  reduced to re-export shims so existing imports kept working. New code should import
  from the canonical paths (`@/core/logger`, `@/core/bootstrap`, `@/core/lifecycle`,
  `@/types/common`).

### Extension lifecycle

1. The host loads `dist/index.js` as a classic script.
2. The host's jQuery ready callback fires; `index.ts` calls `bootstrap()`.
3. `bootstrap()` (in `src/app/`, the composition root) initializes the dependency
   container and registers the core singletons (EventBus; logger and settings bridge
   remain function-based for now).
4. `bootstrap()` acquires the host context via `tryGetContext()`. If the host context is
   unavailable, it surfaces a toast and stops.
5. Settings are loaded (applying defaults; syncing the logger level).
6. The settings drawer is mounted (template-rendered, error-isolated).
7. The Atlas launcher button is appended to the Extensions menu.
8. Clicking the launcher builds the panel once and toggles it open/closed via CSS — no
   listener duplication on reopen.
9. Every step is wrapped in an error boundary so a non-critical failure cannot crash the
   host.

### Dependency container

`src/core/container` provides a minimal singleton/service container. Bootstrap is the
composition root and registers the core singletons. Future services resolve their
dependencies by token (`container.resolve(Token)`) rather than constructing them
directly, so construction order and wiring live in one auditable place.

### Future provider architecture

AI-assisted generation is **always optional**. The provider layer defines two
independent abstractions so the roleplay model, the map-planning text model, and the
image model are never coupled:

- **TextProvider** — produces a validated map blueprint (structured JSON). Future
  implementations: SillyTavern main API, custom OpenAI-compatible.
- **ImageProvider** — produces an unlabeled background image. Atlas remains the source
  of truth for labels, markers, and routes. Future implementations: SillyTavern image
  integration, OpenAI-compatible images, async task/polling, generic REST.
- **Storage providers** — `AssetStore` (binary blobs via localforage) and
  `MapDocumentStore` (versioned map documents), swappable for an optional server-storage
  adapter later.

Provider-specific behavior stays inside the adapter layer. Map-domain code depends only
on the interfaces. Credentials are never stored in maps, chat metadata, exports, logs,
or diagnostics, and never embedded in the JavaScript bundle.

### Manifest notes

`manifest.json` references `dist/index.js` and `dist/style.css`, sets
`loading_order: 9` (extensions load in ascending order), `version: 0.1.0`, and
`homePage` to this repository. `requires` is empty — the core extension needs no other
extension and no server plugin.

`minimum_client_version` is **intentionally omitted**. SillyTavern's loader
(`public/scripts/extensions.js`) gates loading on this field when present: an incorrect
value would block Atlas from loading on older SillyTavern builds. The correct minimum
can only be determined by testing against a live SillyTavern release, which is a manual
step to perform before the first public release. It will be added then.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All repository-facing content (code,
comments, documentation, commit messages, UI strings) must be written in English.

## Security

See [SECURITY.md](./SECURITY.md). Atlas is safe by default: raw STScript and remote
resource access are disabled until explicitly enabled, and imported map packs never
execute scripts automatically.

## License

MIT — see [LICENSE](./LICENSE). Original concept and attribution:
[`Elthial/SillyTavern-Map`](https://github.com/Elthial/SillyTavern-Map).
