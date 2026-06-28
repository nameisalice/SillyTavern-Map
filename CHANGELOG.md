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

### Notes

- This milestone establishes the foundation only. No map rendering, markers, editor,
  storage, slash commands, prompt injection, function tools, or AI provider features
  are included. Those arrive in subsequent milestones.
