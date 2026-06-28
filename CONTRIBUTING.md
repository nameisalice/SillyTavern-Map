# Contributing to SillyTavern Atlas

Thank you for your interest in improving Atlas. This document describes how to set up
the project and the conventions every contribution must follow.

## Repository language policy

English is the canonical language of this repository. All repository-facing content
must be written in English, including:

- Source code identifiers and comments.
- Default UI strings.
- Documentation, README, and installation guides.
- Tests and fixtures.
- Error messages and diagnostic output.
- Commit messages, pull request titles and descriptions, and issue text.

Do not introduce other languages into source files or public documentation. English
must remain the default and fallback locale. Translation support may be added later
through locale files, but translations are optional community contributions and must
not replace English source strings.

## Development setup

```bash
git clone https://github.com/nameisalice/SillyTavern-Map.git
cd SillyTavern-Map
npm install
```

## Before opening a pull request

Run the full check locally:

```bash
npm run check
```

This runs type-checking, linting, unit tests, and the production build. A pull request
is not ready for review until `npm run check` passes cleanly.

### Code style

- **TypeScript strict mode** — no `any`. Type declarations live in `global.d.ts` for
  host types and under `src/types/` for Atlas types.
- **Vanilla DOM** — no React, no Tailwind, no Bootstrap. Use HTML templates loaded via
  `renderExtensionTemplateAsync`.
- **Namespaced CSS** — every selector must begin with `.st-atlas` or `[data-st-atlas]`.
  Never add unprefixed global selectors.
- **Host coupling** — reach the host through `SillyTavern.getContext()` (see
  `src/st/context.ts`). Do not import host internals such as `power-user.js`,
  `RossAscends-mods.js`, or `slash-commands.js` directly.
- **Modules** — keep files small and composable. Avoid global mutable state and God
  classes.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example:

```
feat: add responsive interactive map viewer
chore: establish TypeScript extension foundation
fix: prevent panel listener duplication on reopen
docs: clarify local build workflow
```

## Testing

- Add or update unit tests for any non-trivial logic.
- Tests live under `tests/` and run under Vitest with a jsdom environment.
- Prefer pure-logic tests (e.g. schema validation, coordinate normalization, settings
  merging) over tests that depend on the live SillyTavern host.

## Manual verification

The build, lint, and test commands can all run without a SillyTavern installation.
Verifying that the extension actually loads inside SillyTavern is a manual step: copy
the built extension into your SillyTavern third-party extensions directory, reload, and
confirm there are no uncaught console errors.
