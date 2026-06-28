# Master Prompt — SillyTavern Atlas Coding Agent

You are the lead engineer responsible for developing **SillyTavern Atlas**, a lightweight interactive map extension for SillyTavern.

Read `ST_MAP_DEVELOPMENT_PLAN.md` completely before modifying code.


## Repository language policy

English is mandatory for all repository-facing work.

Use English for:

- Source code identifiers and comments.
- Default UI strings.
- Documentation.
- README content.
- Tests and fixtures.
- Error messages.
- Commit messages.
- Pull request and issue text.
- Implementation reports.
- Example map content.

Do not introduce Indonesian text into the repository. English must remain the default and fallback locale. Translation support may be added later through locale files, but it is not part of the current assignment.

## Main objective

Replace the proof-of-concept architecture of `Elthial/SillyTavern-Map` with a maintainable TypeScript extension that eventually supports:

- Image maps.
- Pan and zoom.
- Visual marker editing.
- Regions and routes.
- Nested maps.
- Current player location per chat.
- Concise spatial prompt context.
- Safe clickable actions.
- Mobile usage.
- Legacy map import.
- Optional text-based world and city blueprint generation.
- Optional image-background generation through a separate provider.
- Independent custom API profiles for text and image models.

## Non-negotiable constraints

- Use TypeScript.
- Use the official SillyTavern TypeScript/Webpack extension pattern.
- Use vanilla DOM components, not React.
- Do not use Tailwind or Bootstrap.
- Prefer `SillyTavern.getContext()` over direct internal imports.
- Use `renderExtensionTemplateAsync` for extension UI templates.
- Use `SlashCommandParser.addCommandObject()` for commands.
- Store global preferences in `extensionSettings`.
- Store active map/location in `chatMetadata`.
- Use localforage for large local assets.
- Never store large map images in extension settings.
- Never use `eval`.
- Never execute imported STscript automatically.
- Raw STscript must be disabled by default.
- Do not require a server plugin for core functionality.
- Keep every CSS selector prefixed with `.st-atlas` or `[data-st-atlas]`.
- Keep every milestone independently runnable.
- AI generation must remain optional.
- Text planning and image generation must use separate provider abstractions.
- Support a future custom OpenAI-compatible text provider.
- Support future synchronous and asynchronous image-provider adapters.
- Never couple the roleplay model, map-planning model, and image model.
- Never store provider credentials in maps, chat metadata, exports, logs, or diagnostics.
- Image generation must request unlabeled backgrounds; Atlas owns canonical labels and markers.
- Do not implement later milestones early.

## Required workflow

For the current milestone:

1. Inspect the repository.
2. Inspect the current SillyTavern extension documentation and `getContext()` surface.
3. State the milestone goal.
4. List files to create or change.
5. Identify compatibility risks.
6. Implement only the milestone.
7. Add or update tests.
8. Run:
   - Typecheck
   - Lint
   - Tests
   - Production build
9. Report exact results.
10. Update README or development notes.
11. Commit using a focused conventional commit.
12. Stop.

Do not claim a command passed unless you actually ran it.

## Current assignment: Milestone 0 only

Create the project foundation.

Deliver:

- TypeScript strict-mode setup.
- Webpack build.
- ESLint and formatting.
- Unit-test setup.
- `global.d.ts` with SillyTavern types.
- Valid `manifest.json`.
- Extension bootstrap using current context APIs.
- Minimal settings drawer loaded from an HTML template.
- Atlas button in the Extensions menu.
- Minimal panel that opens and closes.
- Namespaced CSS.
- Logger utility.
- Error handling for bootstrap.
- README development instructions.
- One clean commit.

Do not add:

- Leaflet.
- Map rendering.
- Map uploads.
- Map storage.
- Markers.
- Editor.
- Routes.
- Prompt injection.
- Function tools.
- AI provider configuration.
- Text map generation.
- Image generation.
- Custom API requests.

## Acceptance criteria

- `npm install` succeeds.
- `npm run check` succeeds.
- Production bundle is generated.
- SillyTavern loads the extension.
- Settings drawer appears.
- Atlas panel opens and closes.
- The extension does not import `power-user.js` or `RossAscends-mods.js`.
- No deprecated slash-command registration is used.
- There are no uncaught console errors.
- There are no generic unprefixed CSS selectors.
- README explains local installation and build workflow.

When finished, write the entire report in English and output:

1. Summary.
2. Files changed.
3. Commands executed and results.
4. Manual SillyTavern test procedure.
5. Known limitations.
6. Commit hash.
7. Confirmation that no Milestone 1 feature was implemented.
