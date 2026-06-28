# SillyTavern Atlas

A lightweight, modern interactive map extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

Atlas turns a static world map into an interactive roleplay companion: import a map
image, place locations by clicking, track the player's current location per chat, open
nested maps (world → city → building → room), and inject concise spatial context into
the model's generations.

> **Status:** Foundation milestone (M0). The build, settings drawer, and a placeholder
> panel are in place. The interactive map viewer arrives in a later milestone.

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
5. Verify the placeholder panel opens and closes without console errors.

### Project layout

```
manifest.json          Extension manifest consumed by SillyTavern
package.json           Node project + scripts
webpack.config.js      Production/dev bundler config
tsconfig.json          Strict TypeScript config
eslint.config.js       ESLint flat config (no `any`)
.prettierrc.json       Prettier formatting config
vitest.config.ts       Vitest unit-test config (jsdom)
global.d.ts            Ambient types for the SillyTavern host surface
src/
├─ index.ts            Entry; host ready callback + bootstrap
├─ constants.ts        Extension name, keys, log prefix
├─ app/                Bootstrap and panel lifecycle
├─ st/                 Host context + settings bridge adapters
├─ infra/              Logger
├─ ui/                 Settings + panel controllers
├─ templates/          HTML templates (rendered by the host)
└─ styles/             Namespaced CSS (.st-atlas / [data-st-atlas])
tests/                 Vitest unit tests
```

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
