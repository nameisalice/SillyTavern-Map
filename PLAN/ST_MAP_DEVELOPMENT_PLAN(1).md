# SillyTavern Atlas — Development Plan for an AI Coding Agent

> Working title: **SillyTavern Atlas**  
> Project type: Third-party SillyTavern UI extension  
> Starting point: Fork/reference of `Elthial/SillyTavern-Map`  
> Primary target: SillyTavern users running long-form RPG/roleplay chats, including VPS-hosted installations and mobile browsers  
> Development style: Incremental vibecoding with strict acceptance criteria, small commits, and a runnable build after every milestone

---

## 1. Product Vision

Build a lightweight, modern map extension for SillyTavern that turns a static world map into an interactive roleplay tool.

The extension must allow users to:

1. Import or create a map from an image.
2. Add locations by clicking directly on the map.
3. Add polygonal regions without manually writing SVG paths.
4. Track the current player or party location per chat.
5. Open nested maps such as:
   - World
   - Continent
   - City
   - Building
   - Room
6. Execute safe actions when a location is clicked.
7. Inject concise spatial context into the next model generation.
8. Optionally detect location changes from structured AI output.
9. Work on desktop and mobile.
10. Avoid heavy client-side processing and avoid requiring a separate server.

This is not intended to be a full virtual tabletop. It is an immersive map companion for text roleplay.

---

## 2. Why the Original Extension Should Be Reworked

The original `Elthial/SillyTavern-Map` is useful as a proof of concept, but it should not be extended by stacking more code into its current single-file structure.

Current limitations to treat as migration targets:

- The map filename is hardcoded.
- The UI is assembled directly inside one JavaScript file.
- Interactive zones must be written manually as SVG paths.
- The map viewer has no built-in editor.
- It uses older direct imports from SillyTavern internals.
- It uses the deprecated slash-command registration method.
- It lacks a versioned data schema.
- It has no per-chat player position.
- It has no map-pack import/export workflow.
- It has no safe action permission model.
- It has no structured migration strategy.
- It has no automated tests.

Use the old repository only for:

- Understanding the original user flow.
- Preserving attribution and license notices.
- Migrating old `PNG + JSON` map pairs.
- Reusing the concept of clickable regions that trigger STscript.

Do not preserve the old architecture merely for compatibility.

---


## 2.1 Public Repository Language Policy

English is the canonical language of the project.

The following must be written in English:

- Source code identifiers.
- Source code comments.
- User-facing default UI text.
- Documentation.
- README and installation guides.
- Commit messages.
- Pull request titles and descriptions.
- Issue templates.
- Changelog entries.
- Error messages and diagnostic output.
- Example map data bundled with the repository.
- Agent reports and implementation notes.

Rules:

- Do not introduce Indonesian text into source files or public repository documentation.
- Do not mix languages inside the same source file.
- English must remain the default locale and fallback locale.
- Translation support may be added through locale files, but translations are optional community contributions and must not replace English source strings.
- Internal localization keys must use clear English names.
- Generated example lore, map descriptions, and test fixtures must use English unless a test explicitly verifies Unicode or localization behavior.
- The coding agent must respond in English when producing repository-facing content, reports, commit messages, or documentation.

## 3. Product Principles

### 3.1 Lightweight first

The extension must remain usable in long SillyTavern chats and on low-memory mobile browsers.

Rules:

- Do not use React.
- Do not use Tailwind.
- Do not use Bootstrap.
- Do not rerender the entire panel when one marker changes.
- Do not scan the whole chat after every message.
- Do not store large image blobs in SillyTavern extension settings.
- Do not run an LLM call on every normal map interaction.
- Lazy-load the editor and heavy map-editing modules.

### 3.2 Local-first

The core extension must work without:

- A server plugin.
- A database.
- A cloud account.
- An external map service.
- An external image host.

Use browser storage for local map assets and SillyTavern chat metadata for per-chat state.

### 3.3 Safe by default

A downloaded map pack must not silently run arbitrary STscript.

Default behavior:

- Declarative actions are allowed.
- Raw STscript is disabled until the user explicitly enables “Advanced scripts.”
- Show a confirmation before running script content imported from an untrusted map pack.
- Never use `eval`.
- Never inject unsanitized HTML.
- Never fetch arbitrary remote resources without visible user consent.

### 3.4 SillyTavern-native

The extension should visually belong inside SillyTavern:

- Use SillyTavern CSS variables.
- Respect blur, opacity, text, and border theme variables.
- Use Font Awesome icons already available in SillyTavern.
- Use SillyTavern popups, toasts, extension settings, events, and slash-command APIs.
- Keep all selectors prefixed to avoid collisions.

---

## 4. Recommended Technical Stack

### Core

- **TypeScript**
- **Webpack**
- Official SillyTavern TypeScript/Webpack extension template
- Vanilla DOM components
- HTML template files loaded with `renderExtensionTemplateAsync`
- Plain modular CSS using SillyTavern theme variables

### Map rendering

Use **Leaflet** with `CRS.Simple`.

Why:

- Supports image maps rather than geographic maps.
- Built-in pan and zoom.
- Works well with markers, polygons, tooltips, layers, and mobile touch.
- Mature and smaller in implementation complexity than writing a custom canvas renderer.
- The image can be treated as a coordinate plane.

### Visual editor

For the first editor release, use one of these approaches:

Preferred:

- Leaflet-Geoman Free for marker, polygon, rectangle, and edit handles.

Fallback:

- Implement only marker placement first.
- Add polygon editing in a later milestone using Leaflet.Draw or custom SVG overlay controls.

Do not block the MVP on a perfect polygon editor.


### Optional AI provider layer

AI-assisted generation must be implemented behind provider adapters and must never become a hard dependency of the map viewer.

Text planning and image generation are separate services:

```text
Text planning provider
→ produces validated structured map data

Image generation provider
→ produces an optional unlabeled background image

Atlas renderer
→ adds deterministic markers, labels, regions, routes, and party state
```

Required provider categories:

```text
TextProvider
├─ SillyTavernMainTextProvider
└─ OpenAICompatibleTextProvider

ImageProvider
├─ SillyTavernImageProvider
├─ OpenAICompatibleImageProvider
├─ AsyncTaskImageProvider
└─ GenericRestImageProvider
```

Examples such as DeepSeek, OpenRouter, OmniRoute, or another compatible chat endpoint belong to the text provider layer.

Examples such as Nano Banana Pro, OpenAI Images, Imagen, Flux gateways, or another image endpoint belong to the image provider layer.

Provider-specific behavior must remain isolated from map-domain code.

### Storage

- `SillyTavern.getContext().extensionSettings`:
  - Global extension preferences.
  - Small map index records.
  - Never store large image blobs here.
- `SillyTavern.getContext().chatMetadata`:
  - Current map ID.
  - Current location ID.
  - Discovered locations.
  - Per-chat marker state.
  - Travel history.
- `SillyTavern.libs.localforage`:
  - Map image blobs.
  - Thumbnail blobs.
  - Imported map-pack assets.
  - Large local map documents if necessary.
- Downloadable map-pack files:
  - Portable backup and sharing.
  - Required for moving maps between browsers or devices in local-only mode.

### SillyTavern integration

Prefer APIs exposed by:

```ts
const context = SillyTavern.getContext();
```

Important context APIs:

- `eventSource`
- `eventTypes`
- `extensionSettings`
- `saveSettingsDebounced`
- `chatMetadata`
- `saveMetadata`
- `saveMetadataDebounced`
- `renderExtensionTemplateAsync`
- `SlashCommandParser`
- `SlashCommand`
- `SlashCommandArgument`
- `SlashCommandNamedArgument`
- `ARGUMENT_TYPE`
- `executeSlashCommandsWithOptions`
- `setExtensionPrompt`
- `registerFunctionTool`
- `unregisterFunctionTool`
- `Popup`
- `loader`
- `libs.localforage`
- `libs.DOMPurify`
- `libs.lodash`

Avoid importing mutable SillyTavern internals directly unless no context API exists.

---

## 5. Core Architecture

Use a modular architecture.

```text
src/
├─ index.ts
├─ constants.ts
├─ types/
│  ├─ map.ts
│  ├─ settings.ts
│  ├─ actions.ts
│  └─ sillytavern.d.ts
├─ app/
│  ├─ bootstrap.ts
│  ├─ lifecycle.ts
│  └─ event-bus.ts
├─ st/
│  ├─ context.ts
│  ├─ settings-bridge.ts
│  ├─ chat-state-bridge.ts
│  ├─ prompt-bridge.ts
│  ├─ slash-command-bridge.ts
│  └─ tool-bridge.ts
├─ domain/
│  ├─ map-document.ts
│  ├─ map-validator.ts
│  ├─ map-migrations.ts
│  ├─ location-service.ts
│  ├─ travel-service.ts
│  ├─ discovery-service.ts
│  └─ action-service.ts
├─ storage/
│  ├─ map-repository.ts
│  ├─ asset-repository.ts
│  ├─ localforage-adapter.ts
│  ├─ import-export.ts
│  └─ legacy-importer.ts
├─ viewer/
│  ├─ map-viewer.ts
│  ├─ leaflet-adapter.ts
│  ├─ marker-layer.ts
│  ├─ region-layer.ts
│  ├─ route-layer.ts
│  ├─ fog-layer.ts
│  └─ tooltip-controller.ts
├─ editor/
│  ├─ editor-controller.ts
│  ├─ editor-state.ts
│  ├─ marker-editor.ts
│  ├─ region-editor.ts
│  ├─ route-editor.ts
│  ├─ property-panel.ts
│  └─ history.ts
├─ automation/
│  ├─ structured-location-parser.ts
│  ├─ message-listener.ts
│  ├─ function-tools.ts
│  └─ location-reconciler.ts
├─ ui/
│  ├─ panel-controller.ts
│  ├─ settings-controller.ts
│  ├─ map-library-controller.ts
│  ├─ mobile-controller.ts
│  └─ dialogs.ts
├─ templates/
│  ├─ settings.html
│  ├─ panel.html
│  ├─ library.html
│  ├─ editor.html
│  └─ location-dialog.html
└─ styles/
   ├─ base.css
   ├─ panel.css
   ├─ viewer.css
   ├─ editor.css
   └─ mobile.css
```

Build output:

```text
dist/
├─ index.js
├─ style.css
└─ assets/
```

Repository root:

```text
manifest.json
package.json
package-lock.json
webpack.config.js
tsconfig.json
README.md
LICENSE
CHANGELOG.md
CONTRIBUTING.md
SECURITY.md
src/
dist/
tests/
examples/
```

---

## 6. Data Model

Use a versioned map document.

### 6.1 Map document

```ts
interface AtlasMapDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;

  image: {
    assetId: string;
    width: number;
    height: number;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    checksum?: string;
  };

  parentMapId?: string;
  defaultLocationId?: string;

  locations: AtlasLocation[];
  regions: AtlasRegion[];
  routes: AtlasRoute[];

  view: {
    minZoom: number;
    maxZoom: number;
    initialZoom: number;
    initialCenter: [number, number];
  };

  theme?: {
    markerStyle?: 'pin' | 'dot' | 'crest';
    accentColor?: string;
    dangerColor?: string;
  };

  metadata: {
    createdAt: string;
    updatedAt: string;
    author?: string;
    source?: string;
  };
}
```

### 6.2 Location

```ts
interface AtlasLocation {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;

  coordinates: {
    x: number;
    y: number;
  };

  icon?: string;
  category?: string;
  dangerLevel?: 0 | 1 | 2 | 3 | 4 | 5;

  discoveredByDefault?: boolean;
  hiddenUntilDiscovered?: boolean;

  childMapId?: string;
  worldInfoKeywords?: string[];

  actions?: AtlasAction[];
}
```

### 6.3 Region

```ts
interface AtlasRegion {
  id: string;
  name: string;
  description?: string;
  polygon: Array<[number, number]>;

  fillColor?: string;
  borderColor?: string;
  opacity?: number;

  hiddenUntilDiscovered?: boolean;
  actions?: AtlasAction[];
}
```

### 6.4 Route

```ts
interface AtlasRoute {
  id: string;
  name: string;
  fromLocationId: string;
  toLocationId: string;

  points?: Array<[number, number]>;
  distance?: number;
  distanceUnit?: 'm' | 'km' | 'mi' | 'day' | 'hour';
  travelTime?: number;
  travelTimeUnit?: 'minute' | 'hour' | 'day';

  bidirectional: boolean;
  locked?: boolean;
  requirements?: string[];
  dangerLevel?: 0 | 1 | 2 | 3 | 4 | 5;
}
```

### 6.5 Declarative actions

```ts
type AtlasAction =
  | {
      type: 'set_location';
      locationId: string;
    }
  | {
      type: 'open_map';
      mapId: string;
      locationId?: string;
    }
  | {
      type: 'set_background';
      backgroundName: string;
    }
  | {
      type: 'send_system_note';
      text: string;
    }
  | {
      type: 'run_quick_reply';
      setName: string;
      label: string;
    }
  | {
      type: 'run_stscript';
      script: string;
      requiresConfirmation: true;
    };
```

### 6.6 Per-chat state

Store under one unique `chatMetadata` key:

```ts
interface AtlasChatState {
  schemaVersion: 1;
  activeMapId?: string;
  activeLocationId?: string;

  discoveredLocationIds: string[];
  discoveredRegionIds: string[];

  customMarkers: Array<{
    id: string;
    mapId: string;
    label: string;
    x: number;
    y: number;
    icon?: string;
  }>;

  travelHistory: Array<{
    mapId: string;
    fromLocationId?: string;
    toLocationId: string;
    timestamp: string;
    source: 'user' | 'click' | 'slash' | 'tool' | 'parser';
  }>;

  lastInjectedContextHash?: string;
}
```

Use:

```ts
const CHAT_STATE_KEY = 'sillytavern_atlas';
```

Do not cache the `chatMetadata` object reference globally. Retrieve it from `getContext()` whenever the current chat may have changed.

---

## 7. User Experience

### 7.1 Main entry points

Add:

1. An **Atlas** button to the SillyTavern Extensions menu.
2. An inline settings drawer in Extension Settings.
3. Slash commands.
4. Optional function tools.
5. Optional small current-location badge near the chat input.

### 7.2 Main panel layout

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ Atlas     [Map ▼] [Current location]       [Edit] [⋮] [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                       MAP CANVAS                            │
│                                                             │
│           markers, regions, current party marker            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Location title                                               │
│ Short description                  [Travel] [Open child map] │
└─────────────────────────────────────────────────────────────┘
```

Mobile:

- Fullscreen sheet.
- Sticky top bar.
- Map occupies most of the screen.
- Bottom details sheet can be collapsed.
- Minimum touch target: 44 × 44 CSS pixels.
- No tiny hover-only interaction.
- Long press may open location details, but normal tap must work.

### 7.3 Viewer interactions

- Drag: pan.
- Mouse wheel or pinch: zoom.
- Tap marker: open location preview.
- Double tap: optional quick travel, disabled by default.
- Tap region: show region information.
- Travel button: update current location after confirmation.
- Child-map button: open nested map.
- Back button: open parent map.
- Center button: focus current location.
- Fit button: fit map image to viewport.
- Optional route layer.
- Optional fog of war layer.

### 7.4 Editor interactions

MVP editor:

- Upload image.
- Name map.
- Click to add marker.
- Edit marker:
  - Name
  - Description
  - Icon
  - Danger level
  - Child map
  - Actions
- Drag marker.
- Delete marker.
- Preview mode.
- Save.
- Export map pack.

Later editor:

- Draw polygon.
- Edit polygon points.
- Draw route.
- Connect locations.
- Set travel distance/time.
- Configure fog and discovery.

---

## 8. Storage Strategy

### 8.1 Global settings

Store only small configuration:

```ts
interface AtlasSettings {
  enabled: boolean;
  openMode: 'floating' | 'fullscreen' | 'docked';
  rememberPanelPosition: boolean;
  showCurrentLocationBadge: boolean;
  promptInjectionEnabled: boolean;
  promptInjectionDepth: number;
  automationMode: 'off' | 'structured' | 'tool';
  allowAdvancedScripts: boolean;
  confirmImportedScripts: boolean;
  mapIndex: Array<{
    id: string;
    name: string;
    updatedAt: string;
    thumbnailAssetId?: string;
  }>;
}
```

### 8.2 Asset storage

Use localforage keys:

```text
atlas:map:{mapId}:document
atlas:asset:{assetId}:blob
atlas:asset:{assetId}:thumbnail
```

### 8.3 Portability warning

Browser-local assets do not automatically synchronize between a desktop browser and phone.

Therefore:

- Provide export/import from the first stable release.
- Show a visible “Stored on this browser” label.
- Never imply that local map assets are stored on the VPS.
- Later, add an optional storage adapter for server-side persistence.

### 8.4 Optional server storage

This is not required for the core extension.

Potential later implementation:

- Optional SillyTavern server plugin.
- Endpoints under `/api/plugins/sillytavern-atlas/...`.
- Store files inside the current user’s data directory.
- Enforce file type and file size limits.
- Never trust the uploaded filename.
- Use generated IDs.
- Provide delete and quota controls.

Important product decision:

The UI extension must still function without the server plugin so it remains eligible for endorsed extension submission.

---


## 9. AI-Assisted Map Generation

AI generation is optional. The extension must remain fully usable when all AI features are disabled.

### 9.1 Supported generation modes

#### Manual mode

The user uploads an existing map image and creates locations through the visual editor.

This is the required baseline mode.

#### Text-only generation

A text model creates a validated map blueprint containing:

- Map name and type.
- Terrain layout.
- Locations.
- Coordinates.
- Regions.
- Routes.
- Distances.
- Travel times.
- Danger levels.
- Parent and child map relationships.
- A visual prompt that may later be sent to an image provider.

The extension may render a functional schematic map from this data without calling an image model.

#### Image-only generation

An image provider creates an unlabeled background.

The user or editor adds the structured map data afterward.

#### Hybrid generation

The recommended AI workflow is:

```text
User concept
→ text provider creates a structured blueprint
→ user reviews or edits the blueprint
→ image provider creates an unlabeled background
→ Atlas overlays deterministic labels and interactive data
```

Do not ask an image model to produce final labels, coordinates, routes, or canonical location names inside the image.

### 9.2 World, region, city, building, and room generation

The generation wizard must support map types:

```text
world
continent
region
city
district
building
room
dungeon
custom
```

A generated map may reference:

- `parentMapId`
- child map IDs from individual locations
- a default entry location
- an exit location back to the parent map

Examples:

```text
World
└─ Southern Kingdom
   └─ Valeria
      └─ Royal Palace
         └─ Underground Archive
```

The text provider must create each level as a separate map document. It must not place every world, city, and room detail into one oversized document.

### 9.3 Text provider contract

```ts
interface TextProvider {
  readonly id: string;
  readonly capabilities: {
    structuredOutput: boolean;
    streaming: boolean;
  };

  testConnection(signal?: AbortSignal): Promise<ProviderTestResult>;

  generateMapBlueprint(
    request: MapBlueprintRequest,
    signal?: AbortSignal,
  ): Promise<AtlasMapBlueprint>;
}
```

Minimum text provider implementations:

1. **Use SillyTavern Main API**
   - Reuse the currently configured SillyTavern text-generation connection when a supported public extension API is available.
   - Do not duplicate credentials.
   - Clearly show which active model will be used.
   - Fail with a useful message if the current connection cannot provide structured output.

2. **Custom OpenAI-Compatible**
   - User-configurable base URL.
   - API key or server-managed credential reference.
   - Model ID.
   - Optional custom headers.
   - Temperature.
   - Maximum output tokens.
   - Timeout.
   - JSON response mode when supported.
   - Configurable endpoint normalization.
   - Connection test.

Text generation must return JSON matching a validated schema. Never accept free-form prose directly as a map document.

### 9.4 Image provider contract

```ts
interface ImageProvider {
  readonly id: string;
  readonly capabilities: {
    synchronous: boolean;
    asynchronous: boolean;
    referenceImages: boolean;
    aspectRatios?: string[];
    resolutions?: string[];
  };

  testConnection(signal?: AbortSignal): Promise<ProviderTestResult>;

  generateImage(
    request: MapImageRequest,
    signal?: AbortSignal,
  ): Promise<GeneratedMapImage>;
}
```

Minimum image provider implementations:

1. **Use SillyTavern Image Generation**
   - Reuse an available SillyTavern image-generation integration when a stable extension-facing API exists.
   - Show a clear unsupported message when the integration cannot be called safely.

2. **OpenAI-Compatible Images**
   - Configurable base URL.
   - Configurable image endpoint.
   - Model ID.
   - Size or aspect ratio.
   - Quality and format fields when supported.
   - Support either URL or base64 image responses.

3. **Asynchronous task provider**
   - Supports APIs that return a task ID first.
   - Configurable create endpoint.
   - Configurable status endpoint template.
   - Task ID response path.
   - Status response path.
   - Success and failure status values.
   - Image URL or base64 response path.
   - Poll interval.
   - Maximum poll duration.
   - Cancellation.

   This adapter category is suitable for services such as Nano Banana Pro gateways when they use task creation and polling.

4. **Generic REST image provider**
   - Advanced mode.
   - Configurable method.
   - Request-body template.
   - Prompt field mapping.
   - Model field mapping.
   - Custom headers.
   - Response extraction paths.
   - Disabled by default until explicitly configured and tested.

### 9.5 Provider profiles

Users may create named profiles independently:

```text
Text profile: Cheap Map Planner
Provider: Custom OpenAI-Compatible
Model: deepseek-compatible-model

Image profile: Fantasy Backgrounds
Provider: Async Task Image Provider
Model: image-generation-model
```

A generation preset references one text profile and zero or one image profile.

```ts
interface AtlasGenerationPreset {
  id: string;
  name: string;
  textProfileId: string;
  imageProfileId?: string;
  mapType: AtlasMapType;
  stylePrompt?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  resolution?: string;
}
```

The roleplay model, map-planning model, and image model may all be different.

### 9.6 Credential handling

Provider credentials must never be:

- Stored in map documents.
- Stored in chat metadata.
- Included in exports.
- Included in diagnostic reports.
- Written to logs.
- Embedded in generated JavaScript bundles.
- Sent to an unrelated provider.

Preferred order:

1. Reuse a SillyTavern-managed connection or secret reference.
2. Use an optional server-side Atlas bridge for custom credentials.
3. Permit direct browser credentials only as an explicit advanced mode with a security warning and only when technically unavoidable.

The implementation agent must inspect current SillyTavern secret-management APIs before choosing storage. Do not invent or assume an API without verifying it.

### 9.7 Generation workflow

The generation wizard should use staged review:

```text
1. Enter concept
2. Select map type
3. Select text profile
4. Generate blueprint
5. Validate blueprint
6. Review and edit locations
7. Optionally select image profile
8. Generate background without labels
9. Align or revise markers
10. Save map
```

The user must be able to stop after step 6 and keep a text-only or procedurally rendered map.

### 9.8 Structured blueprint requirements

The text model should produce normalized coordinates from `0` to `100`.

Example:

```json
{
  "schemaVersion": 1,
  "name": "Southern Marches",
  "type": "region",
  "visualPrompt": "Top-down hand-drawn fantasy frontier map, no labels, no text",
  "locations": [
    {
      "id": "north-tower",
      "name": "North Tower",
      "x": 52,
      "y": 12,
      "description": "The final guarded border post.",
      "dangerLevel": 1
    },
    {
      "id": "stone-gorge",
      "name": "Stone Gorge",
      "x": 55,
      "y": 29,
      "description": "A narrow road watched by bandits.",
      "dangerLevel": 3
    }
  ],
  "routes": [
    {
      "fromLocationId": "north-tower",
      "toLocationId": "stone-gorge",
      "distance": 18,
      "distanceUnit": "km",
      "bidirectional": true
    }
  ]
}
```

After parsing:

- Validate the schema.
- Normalize IDs.
- Reject duplicate IDs.
- Clamp or reject invalid coordinates.
- Verify route endpoints.
- Show validation errors to the user.
- Never silently discard malformed locations.
- Never save model output before validation.

### 9.9 Image prompt requirements

Generated image prompts should request:

- Top-down or cartographic perspective.
- Clear large terrain regions.
- Open space for overlays.
- No text.
- No labels.
- No legends.
- No UI.
- No character portraits.
- No watermark.
- No baked-in markers unless intentionally requested.

The extension renderer remains the source of truth for names, markers, routes, and party state.

### 9.10 Network behavior

Every provider request must support:

- Timeout.
- Abort/cancel.
- Clear loading state.
- User-visible error summary.
- Debug details without credentials.
- Response size limits.
- Image file type validation.
- Image dimension limits.
- Retry only when safe.
- No infinite polling.
- No automatic request on every chat message.

### 9.11 Generation history

Store lightweight generation metadata with the map:

```ts
interface AtlasGenerationMetadata {
  generated: boolean;
  textProviderId?: string;
  textModel?: string;
  imageProviderId?: string;
  imageModel?: string;
  generatedAt?: string;
  promptHash?: string;
}
```

Do not store API keys or full provider headers.

## 10. Prompt Context Integration

The model should know the current location without dumping the full map into every prompt.

Use `setExtensionPrompt` through a dedicated `PromptBridge`.

Example injected context:

```text
[Spatial Context]
Current map: Southern Marches
Current location: Mournwood Gate
Parent region: Mournwood
Nearby known locations:
- Old Watchtower: 4 km north
- Vael-Tor Ruins: 7 km northeast
- Moss Stone Camp: 3 km southwest
Reachable routes:
- Deep Mournwood: dangerous, approximately 1 day
- Unnamed Village: approximately 5 hours
Do not teleport characters between locations unless the narrative explicitly justifies it.
```

Rules:

- Maximum default budget: 180–300 tokens.
- Inject only:
  - Current location.
  - Parent region.
  - Directly connected routes.
  - Nearby discovered locations.
  - Relevant travel restrictions.
- Do not inject all map locations.
- Do not inject hidden locations.
- Do not inject private editor notes.
- Rebuild only when:
  - Chat changes.
  - Map changes.
  - Location changes.
  - Discovery changes.
  - Route data changes.
- Clear the extension prompt when disabled or no map is active.
- Use a unique prompt key.
- Add configurable insertion depth and role if supported by the current ST API.
- Encapsulate all ST-specific prompt parameters in one adapter.

Suggested prompt key:

```ts
const PROMPT_KEY = 'sillytavern_atlas_spatial_context';
```

---

## 11. Automatic Location Tracking

Do not begin with free-form AI extraction. It is unreliable and creates extra model calls.

Implement in this order.

### Mode A: Manual

The user moves using:

- Map clicks.
- Travel button.
- Slash commands.

This is the default and must be fully functional.

### Mode B: Structured tags

Optionally parse an explicit machine-readable tag from generated assistant messages:

```text
<atlas_location map="southern-marches" location="mournwood-gate" />
```

Parser rules:

- Parse only exact tags.
- Do not display the tag to the user if a formatting hook can safely remove it.
- Validate IDs.
- Ignore unknown map or location IDs.
- Never create locations automatically from an untrusted tag.
- Log a debug warning, not a disruptive popup, when parsing fails.

### Mode C: Function tools

Register tools only when function calling is supported.

Suggested tools:

```text
atlas_get_current_location
atlas_list_reachable_locations
atlas_move_to_location
atlas_reveal_location
atlas_open_map
```

Rules:

- `atlas_move_to_location` validates routes.
- Never permit hidden destination IDs unless the model already knows them.
- A setting controls whether model-initiated movement requires user confirmation.
- Tool results must remain concise.
- Unregister tools when automation is disabled.

### Mode D: LLM extraction

This is optional future work.

If implemented:

- Run only when location ambiguity is detected.
- Use a user-configured interval.
- Use a separate structured extraction prompt.
- Never run for every message by default.
- Require explicit opt-in.
- Rate limit and debounce calls.
- Do not block the normal reply.

---

## 12. Safe Action Engine

Create an `ActionService` that executes declarative actions.

### Allowed without advanced permission

- Set current location.
- Open nested map.
- Update current marker.
- Show toast.
- Show location popup.
- Set a known SillyTavern background through a controlled adapter.
- Insert a fixed system note after user confirmation.

### Permission-gated

- Run Quick Reply.
- Execute STscript.
- Fetch remote URL.
- Open external URL.

### Raw STscript rules

- Disabled by default.
- Imported script must be marked untrusted.
- Show the complete script before first execution.
- User may approve:
  - Once.
  - For this map pack.
  - Cancel.
- Store approvals by map checksum, not just map name.
- If the map pack changes, approval is invalidated.
- Use `executeSlashCommandsWithOptions`.
- Catch errors and show a concise toast.
- Never interpolate location descriptions directly into executable scripts.

---

## 13. Import and Export

### 12.1 New map pack format

Use a ZIP-like map package later if adding a ZIP dependency is acceptable. For the first implementation, a single JSON file with embedded image data is acceptable for small maps, but large images require a better format.

Recommended stable format:

```text
my-map.atlas.zip
├─ manifest.json
├─ map.json
├─ image.webp
└─ thumbnail.webp
```

`manifest.json`:

```json
{
  "format": "sillytavern-atlas",
  "formatVersion": 1,
  "name": "Southern Marches",
  "mapFile": "map.json",
  "imageFile": "image.webp",
  "thumbnailFile": "thumbnail.webp"
}
```

### 12.2 Legacy importer

Support the original format:

```text
Japan.png
Japan.Json
```

Migration flow:

1. User selects old JSON.
2. User selects corresponding image if the JSON path cannot be resolved.
3. Parse `backgroundImage`.
4. Convert SVG path shapes into `AtlasRegion`.
5. Convert each old `script` to:
   - `run_stscript`
   - `requiresConfirmation: true`
   - `trusted: false`
6. Generate a new map ID.
7. Save as schema version 1.
8. Show migration summary.

Do not execute any migrated script during import.

### 12.3 Validation

Validate:

- Schema version.
- Unique IDs.
- Image MIME type.
- Image size.
- Polygon point count.
- Finite coordinates.
- Parent map references.
- Child map references.
- Action type.
- Script length.
- Remote URL scheme.
- Duplicate routes.
- Broken route endpoints.

Reject a corrupt pack with a clear human-readable error list.

---

## 14. Slash Commands

Use the current `SlashCommandParser.addCommandObject()` API.

Commands:

### Open map

```text
/atlas
/atlas map="Southern Marches"
```

### Set location

```text
/atlas-go location="Mournwood Gate"
/atlas-go map="Southern Marches" location="Mournwood Gate"
```

### Show current location

```text
/atlas-where
```

Return:

```text
Southern Marches / Mournwood Gate
```

### Reveal a location

```text
/atlas-reveal location="Vael-Tor Ruins"
```

### Hide a location

```text
/atlas-hide location="Vael-Tor Ruins"
```

### Center current location

```text
/atlas-center
```

### Export

```text
/atlas-export map="Southern Marches"
```

### Import UI

```text
/atlas-import
```

Requirements:

- Autocomplete map and location names.
- Support IDs and names.
- Return clear error strings.
- Do not throw uncaught errors.
- Include help examples.
- Add aliases only when they do not conflict with popular ST commands.

---

## 15. Settings UI

Use a normal SillyTavern inline drawer.

Sections:

### General

- Enable Atlas.
- Viewer mode:
  - Floating
  - Fullscreen
  - Docked
- Remember last map.
- Show current-location badge.
- Open panel when location changes.

### Context injection

- Enable spatial context.
- Max nearby locations.
- Include route distance.
- Include danger information.
- Include hidden location names: always disabled unless debug mode.
- Prompt insertion position/depth.

### Automation

- Off.
- Structured tag.
- Function tools.
- Confirm model movement.
- Auto-open changed map.

### Security

- Allow advanced scripts.
- Confirm imported scripts.
- Clear trusted map-pack approvals.
- Disable remote images.
- Maximum import image size.

### Storage

- Browser storage usage.
- Export all maps.
- Import maps.
- Delete unused assets.
- Reset extension data.


### AI providers

- Enable AI-assisted map generation.
- Text provider profile.
- Image provider profile.
- Use SillyTavern main text API.
- Use SillyTavern image-generation integration.
- Custom OpenAI-compatible text settings.
- Custom image endpoint settings.
- Separate model IDs for text and image.
- Connection tests.
- Request timeout.
- Maximum output size.
- Provider profile import/export without credentials.
- Generation preset management.
- Direct-browser credential warning when applicable.

### Map generation

- Map type.
- Parent map.
- Generation mode:
  - Text only
  - Image only
  - Hybrid
- Style prompt.
- Negative prompt.
- Aspect ratio.
- Resolution.
- Blueprint preview.
- Validate before save.
- Regenerate blueprint.
- Regenerate background without replacing structured data.

### Debug

- Logging level.
- Show IDs.
- Validate all maps.
- Export diagnostic report.

Do not expose dozens of options before the corresponding features exist.

---

## 16. Visual Design Direction

Do not use an “AI dashboard” appearance.

Style direction:

- Compact cartography tool.
- Neutral dark glass panel that follows the current ST theme.
- Subtle parchment option only inside the map canvas, never across the whole application.
- Clean typography.
- Thin borders.
- No excessive gradients.
- No huge rounded cards.
- No purple-blue SaaS palette.
- No animated glowing buttons.
- No emoji as primary icons.
- Use Font Awesome for interface actions.
- Keep map artwork visually dominant.

CSS rules:

```css
.st-atlas { ... }
.st-atlas__toolbar { ... }
.st-atlas__canvas { ... }
.st-atlas__details { ... }
```

Every selector must begin with `.st-atlas` or `[data-st-atlas]`.

Use variables such as:

```css
color: var(--SmartThemeBodyColor);
background: var(--SmartThemeBlurTintColor);
border-color: var(--SmartThemeBorderColor);
box-shadow: 0 8px 24px var(--black30a);
```

Provide responsive breakpoints but prefer container-driven layout.

---

## 17. Performance Requirements

Targets:

- Initial extension bootstrap under 100 ms excluding dynamic imports.
- Viewer opens without scanning chat history.
- Editor code is lazy-loaded only after Edit is selected.
- No polling loop.
- No global `MutationObserver` unless narrowly scoped.
- No listener duplication after panel reopen.
- Dispose Leaflet map instance when panel is destroyed.
- Reuse one panel instance when possible.
- Store thumbnails for the map library.
- Resize uploaded images only for thumbnails; preserve original image unless user requests compression.
- Do not render hidden markers.
- Use one layer group for markers and one for regions.
- Debounce editor saves.
- Use `saveMetadataDebounced` for frequent per-chat state changes.
- Avoid writing chat metadata during every pan or zoom.
- Viewer pan/zoom state may remain in memory or local browser state unless the user enables persistence.

Mobile targets:

- Smooth pan on a typical mid-range phone.
- No horizontal page overflow.
- No body scroll lock remaining after the panel closes.
- Panel must be usable at 360 CSS pixels width.

---

## 18. Testing Strategy

### Unit tests

Test:

- Map schema validation.
- Version migration.
- Coordinate normalization.
- Location lookup by ID, exact name, alias, and case-insensitive name.
- Route reachability.
- Hidden-location filtering.
- Prompt context builder.
- Structured location tag parser.
- Action permission checks.
- Legacy JSON conversion.
- Map checksum trust invalidation.

### Integration tests

Mock the SillyTavern context.

Test:

- Settings initialize with missing keys.
- Switching chats reloads current map state.
- Setting location writes chat metadata.
- Disabling context injection clears the extension prompt.
- Slash commands call the correct domain service.
- Function tools register and unregister cleanly.
- Import does not execute scripts.
- Delete map removes index and unused assets.

### Manual test matrix

Browsers:

- Desktop Chrome/Edge.
- Desktop Firefox.
- Android Chrome.
- iOS Safari when available.

SillyTavern conditions:

- Solo character chat.
- Group chat.
- Empty chat.
- Very long chat.
- Switching between chats rapidly.
- Reloading browser.
- Extension disabled and re-enabled.
- User-scoped extension installation.
- Global extension installation.
- Multi-user SillyTavern.

Map conditions:

- Small 800 × 600 image.
- Large 5000 × 3000 image.
- PNG with transparency.
- JPEG.
- WebP.
- 1 marker.
- 500 markers.
- 100 polygons.
- Nested maps.
- Broken child reference.
- Old-format imported map.

### Acceptance test rule

A milestone is not complete merely because the UI appears.

It is complete only when:

- Build succeeds.
- Lint succeeds.
- Tests succeed.
- Manual acceptance checklist succeeds.
- No uncaught console errors.
- README is updated.
- Changes are committed.

---

## 19. Development Milestones

## Milestone 0 — Repository and Build Foundation

Goal: A clean extension loads in SillyTavern.

Tasks:

1. Fork the original repository or create a new repository with attribution.
2. Preserve the original MIT license attribution.
3. Start from the official SillyTavern TypeScript/Webpack template.
4. Configure:
   - TypeScript strict mode.
   - ESLint.
   - Prettier.
   - Vitest or Jest.
   - Webpack production and development builds.
5. Add `global.d.ts` for SillyTavern types.
6. Create a valid `manifest.json`.
7. Add extension load logging with a stable prefix.
8. Render a minimal settings drawer.
9. Add an Extensions-menu button.
10. Add a placeholder panel.
11. Add development documentation.

Acceptance criteria:

- `npm install` succeeds.
- `npm run build` succeeds.
- Extension loads through SillyTavern’s third-party extension directory.
- Settings drawer appears.
- Atlas button opens and closes the placeholder panel.
- No direct import from `power-user.js` or `RossAscends-mods.js`.
- No deprecated slash-command API.
- No console errors.

Commit:

```text
chore: establish TypeScript extension foundation
```

---

## Milestone 1 — Map Viewer MVP

Goal: Display an image map with pan, zoom, and markers.

Tasks:

1. Add Leaflet with `CRS.Simple`.
2. Create a `MapViewer` abstraction.
3. Load one bundled example map.
4. Render image overlay.
5. Render markers.
6. Add marker tooltip and detail popup.
7. Add current-location marker.
8. Add:
   - Fit map
   - Center current location
   - Zoom in
   - Zoom out
9. Handle viewer disposal.
10. Add responsive fullscreen mobile layout.

Acceptance criteria:

- Example map opens.
- Map pans and zooms with mouse and touch.
- Marker selection works.
- Current marker is visually distinct.
- Reopening the panel does not duplicate the map.
- Closing the panel removes listeners.
- Works at 360 px width.
- No horizontal overflow.

Commit:

```text
feat: add responsive interactive map viewer
```

---

## Milestone 2 — Storage and Map Library

Goal: Persist imported maps and show a map library.

Tasks:

1. Implement localforage asset repository.
2. Implement versioned map repository.
3. Add map index to extension settings.
4. Create map library screen.
5. Add:
   - Import map.
   - Rename map.
   - Duplicate map.
   - Delete map.
   - Export map.
6. Generate thumbnails.
7. Add asset garbage collection.
8. Add visible local-storage explanation.

Acceptance criteria:

- Imported map survives browser reload.
- Deleting a map removes its unused image.
- Duplicate has new IDs.
- Exported map can be re-imported.
- Large image is not written into extension settings.
- Map library loads thumbnails without loading every full-size image.

Commit:

```text
feat: add local map library and portable map storage
```

---

## Milestone 3 — Marker Editor

Goal: Create a map without writing JSON.

Tasks:

1. Add Create Map wizard.
2. Upload map image.
3. Create marker by clicking.
4. Edit marker fields.
5. Drag marker.
6. Delete marker.
7. Add undo/redo for editor operations.
8. Add preview mode.
9. Validate before save.
10. Add unsaved-change warning.

Acceptance criteria:

- User can create a map from only the UI.
- Marker coordinates remain accurate after zoom.
- Undo and redo work.
- Invalid location names or duplicate IDs are handled.
- Closing with unsaved changes asks for confirmation.
- Editor is lazy-loaded.

Commit:

```text
feat: add visual marker editor
```

---

## Milestone 4 — Per-Chat Location State

Goal: Track player location separately for every chat.

Tasks:

1. Implement `ChatStateBridge`.
2. Store active map and location in `chatMetadata`.
3. Listen to:
   - `APP_READY`
   - `CHAT_CHANGED`
   - `CHAT_CREATED`
   - `CHAT_DELETED`
4. Add Travel action.
5. Add travel history.
6. Add current-location badge.
7. Restore correct state when switching chats.
8. Handle group chats.
9. Add optional route validation.

Acceptance criteria:

- Two chats can have different current locations.
- Reload restores current location.
- Switching chats updates viewer without stale state.
- Deleting a map handles chats referring to it.
- Group chat does not depend on `characterId`.

Commit:

```text
feat: persist map and location state per chat
```

---

## Milestone 5 — Spatial Prompt Injection

Goal: Give the model concise map awareness.

Tasks:

1. Implement context builder.
2. Implement `PromptBridge` using `setExtensionPrompt`.
3. Add settings.
4. Include current location and reachable discovered neighbors.
5. Apply strict token/length budget.
6. Update on state changes only.
7. Clear on disable.
8. Add preview of injected context.
9. Add debug logging without exposing hidden locations.

Acceptance criteria:

- Current location appears in generated prompt context.
- Hidden locations never appear.
- Full map is not dumped into prompt.
- Disabling feature clears prompt.
- Switching chats replaces context correctly.
- Context preview matches actual built text.

Commit:

```text
feat: inject concise spatial context into generations
```

---

## Milestone 6 — Slash Commands

Goal: Control Atlas from STscript and Quick Replies.

Tasks:

1. Register commands using the new slash-command object API.
2. Add autocomplete.
3. Add help strings.
4. Add map and location resolver.
5. Add clear error handling.
6. Add command tests.

Acceptance criteria:

- `/atlas`
- `/atlas-go`
- `/atlas-where`
- `/atlas-reveal`
- `/atlas-hide`
- `/atlas-center`
- `/atlas-import`
- `/atlas-export`

All work without deprecated APIs.

Commit:

```text
feat: add Atlas slash commands and autocomplete
```

---

## Milestone 7 — Regions, Routes, and Nested Maps

Goal: Support useful spatial structure.

Tasks:

1. Add polygon region renderer.
2. Add region drawing/editing.
3. Add route data.
4. Add route renderer.
5. Add location connections.
6. Add parent and child maps.
7. Add breadcrumbs.
8. Add route travel confirmation.
9. Add route restrictions.

Acceptance criteria:

- World → city → building navigation works.
- Back navigation works.
- Regions can be created visually.
- Route endpoints must exist.
- Locked route cannot be used without override.
- Prompt context includes only direct reachable locations.

Commit:

```text
feat: add regions routes and nested maps
```

---

## Milestone 8 — Safe Action System and Legacy Import

Goal: Preserve original extension power without unsafe defaults.

Tasks:

1. Add declarative action engine.
2. Add background action adapter.
3. Add system-note action.
4. Add Quick Reply action.
5. Add advanced STscript action.
6. Add permission dialog and map-pack trust.
7. Add checksum-based approval.
8. Add legacy `PNG + JSON` importer.
9. Mark migrated scripts untrusted.
10. Add migration report.

Acceptance criteria:

- Imported script never runs during import.
- Raw STscript cannot run when disabled.
- Approval is invalidated after pack modification.
- Old SVG paths render as regions.
- Failed actions do not break the viewer.

Commit:

```text
feat: add safe map actions and legacy map migration
```

---


## Milestone 9 — Optional AI Provider Infrastructure

Goal: Generate validated world, region, and city map drafts using independently configurable text and image providers.

Tasks:

1. Add provider contracts.
2. Add provider profile storage without embedding credentials in map exports.
3. Add text provider:
   - SillyTavern main API adapter when supported.
   - Custom OpenAI-compatible adapter.
4. Add image provider:
   - SillyTavern image-generation adapter when supported.
   - OpenAI-compatible image adapter.
   - Asynchronous task/polling adapter.
5. Add connection tests.
6. Add generation wizard.
7. Add structured blueprint schema and validator.
8. Add text-only map generation.
9. Add optional unlabeled image-background generation.
10. Add world, region, city, building, room, dungeon, and custom map types.
11. Add cancellation, timeout, and safe polling.
12. Add generation metadata without credentials.
13. Add tests using mocked providers.
14. Document provider creation and security.

Acceptance criteria:

- Text and image models can use different providers and model IDs.
- A text-only map can be generated without an image provider.
- A manually created map works without any AI configuration.
- OpenAI-compatible text output is schema-validated.
- Asynchronous image tasks stop on success, failure, timeout, or cancellation.
- Provider failures do not corrupt an existing map.
- No credential is included in exports, logs, chat metadata, or map documents.
- Generated image prompts explicitly request no labels or text.
- World and city generation create separate nestable map documents.
- The user reviews generated data before it becomes the saved map.

Commit:

```text
feat: add optional text and image generation providers
```

---

## Milestone 10 — Structured Automation and Function Tools

Goal: Let the model interact with the map in a controlled way.

Tasks:

1. Add exact structured-tag parser.
2. Add optional formatter hook to hide valid tags.
3. Add function tools.
4. Add route validation.
5. Add movement confirmation setting.
6. Add reveal-location tool.
7. Add tool unregister logic.
8. Add clear tool descriptions.
9. Add protection against hallucinated IDs.

Acceptance criteria:

- Unknown IDs are rejected.
- Hidden locations cannot be leaked.
- Tool movement can require confirmation.
- Disabling tools unregisters all tools.
- Structured parser never guesses a location from ordinary prose.

Commit:

```text
feat: add controlled model-driven map automation
```

---

## Milestone 11 — Polish, Documentation, and Release

Goal: Publish a reliable v1.0.

Tasks:

1. Accessibility pass.
2. Mobile pass.
3. Performance pass.
4. Security review.
5. Add localization infrastructure:
   - English as the canonical default and fallback locale.
   - Translation files may be contributed later.
   - Do not place non-English strings in source code.
6. Complete README.
7. Add screenshots and example maps.
8. Add install instructions.
9. Add troubleshooting.
10. Add migration instructions.
11. Add privacy and storage explanation.
12. Add changelog.
13. Add GitHub issue templates.
14. Add release workflow.
15. Test latest SillyTavern release.

Acceptance criteria:

- Fresh install works.
- Upgrade from previous Atlas beta works.
- Old original map can be imported.
- No required server plugin.
- No unresolved high-severity issue.
- All documentation matches current UI.
- Build artifacts are committed if required by ST extension installation.
- Version number is synchronized across package and manifest.

Commit:

```text
release: prepare SillyTavern Atlas v1.0.0
```

---

## 20. MVP Scope

The first public MVP should contain only:

- Map library.
- Image-map viewer.
- Pan and zoom.
- Marker creation.
- Marker editing.
- Current location per chat.
- Manual travel.
- Spatial prompt injection.
- Basic slash commands.
- Import/export.
- Mobile usability.

Do not include in the first MVP:

- Fog of war.
- Automatic free-form location extraction.
- Mandatory AI generation or mandatory provider credentials.
- Route-finding algorithm.
- Collaborative editing.
- Cloud synchronization.
- Live multi-user marker updates.
- Weather simulation.
- Procedural map generation.
- Hex-grid combat.
- Full VTT combat tools.
- NPC movement simulation.
- Vector database.
- Server plugin requirement.

This boundary is important. The MVP must become stable before advanced features are added.

---

## 21. Agent Working Rules

The AI coding agent must follow these rules.

### Language requirements

1. Write all repository-facing content in English.
2. Use English for source code comments, UI defaults, documentation, tests, commit messages, implementation reports, and examples.
3. Do not introduce Indonesian strings into the repository.
4. Keep English as the default and fallback locale.

### Before coding

1. Inspect the current repository.
2. Inspect the latest SillyTavern extension documentation.
3. Inspect the current `SillyTavern.getContext()` API.
4. Identify deprecated functions in the old code.
5. Write a short implementation note for the current milestone.
6. List files that will be created or modified.
7. Do not begin the next milestone.

### During coding

1. Keep TypeScript strict.
2. Avoid `any` unless documented.
3. Do not create a giant `index.ts`.
4. Do not silently change the schema.
5. Add a migration for schema changes.
6. Prefix CSS classes.
7. Keep UI strings ready for i18n.
8. Add error boundaries around imports and storage.
9. Validate every external file.
10. Keep console logs behind a logger.
11. Use SillyTavern APIs through adapters.
12. Do not copy large portions of SillyTavern source.
13. Do not add a dependency without documenting why.
14. Do not use CDN dependencies.
15. Do not use inline event handlers.
16. Do not use unsafe HTML.
17. Never use `eval`.
18. Never execute imported STscript automatically.

### After coding

1. Run typecheck.
2. Run lint.
3. Run tests.
4. Run production build.
5. Inspect output size.
6. Update documentation.
7. Write manual testing steps.
8. Summarize known limitations.
9. Commit with one focused commit.
10. Stop and report results.

---

## 22. Definition of Done for Every Task

A task is done only when all conditions are true:

- Feature is implemented.
- Feature is reachable from UI or command.
- Failure state is handled.
- Data persists correctly.
- Tests exist where practical.
- Mobile layout is not broken.
- No uncaught console error.
- No deprecated API introduced.
- Documentation updated.
- Build succeeds.
- Changes are committed.

Do not mark a task complete because code was written but not run.

---

## 23. Suggested `manifest.json`

The exact minimum client version must be chosen after testing against the current SillyTavern release.

```json
{
  "display_name": "SillyTavern Atlas",
  "loading_order": 50,
  "js": "dist/index.js",
  "css": "dist/style.css",
  "author": "Project contributors",
  "version": "0.1.0",
  "homePage": "REPLACE_WITH_REPOSITORY_URL",
  "auto_update": true,
  "minimum_client_version": "REPLACE_AFTER_TESTING",
  "i18n": {
    "en": "i18n/en.json",
    "id-id": "i18n/id-id.json"
  }
}
```

Do not add `requires` or a required server plugin.

---

## 24. Suggested Package Scripts

```json
{
  "scripts": {
    "dev": "webpack --mode development --watch",
    "build": "webpack --mode production",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests",
    "lint:fix": "eslint src tests --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
```

The agent may adjust tooling, but the final repository must offer one command equivalent to:

```bash
npm run check
```

---

## 25. Example Prompt Context Builder Output

```text
[Atlas Spatial Context]
Map: Southern Marches
Location: Unnamed Village
Location summary: An isolated settlement south of Stone Gorge.
Known adjacent destinations:
- Stone Gorge — 18 km north; bandit danger; reachable.
- Vael-Tor Ruins — 12 km southeast; lethal traps; reachable.
- Hunter Trail — alternate route toward Mournwood; slower but avoids the eastern gate.
Travel continuity: Characters are currently inside the village. A scene at another destination requires explicit travel or a justified transition.
```

The builder must omit unknown or undiscovered locations.

---

## 26. Example First Map

Create one bundled example map for development.

Name:

```text
Southern Marches
```

Locations:

- North Tower
- Stone Gorge
- Unnamed Village
- Vael-Tor Ruins
- Moss Stone Camp
- Mournwood Gate
- Missing Point

Routes:

- North Tower ↔ Stone Gorge
- Stone Gorge ↔ Unnamed Village
- Unnamed Village ↔ Vael-Tor Ruins
- Vael-Tor Ruins ↔ Moss Stone Camp
- Moss Stone Camp ↔ Mournwood Gate
- Mournwood Gate ↔ Missing Point

Use generic or project-owned placeholder artwork. Do not package copyrighted map art without permission.

---

## 27. Release Roadmap

### 0.1.0

- Foundation.
- Viewer.
- Bundled example.

### 0.2.0

- Local map library.
- Import/export.

### 0.3.0

- Marker editor.

### 0.4.0

- Per-chat current location.
- Travel history.

### 0.5.0

- Prompt context.
- Slash commands.

### 0.6.0

- Regions and nested maps.

### 0.7.0

- Routes.
- Safe actions.
- Legacy import.

### 0.8.0

- Optional text-provider infrastructure.
- Optional image-provider infrastructure.
- World and city generation wizard.

### 0.9.0

- Structured automation.
- Function tools.

### 0.10.0

- Mobile polish.
- Localization infrastructure.
- Migration testing.

### 1.0.0

- Stable documented release.

---

## 28. First Agent Assignment

The first assignment must be only Milestone 0.

Deliverables:

- Repository converted to TypeScript/Webpack architecture.
- Valid manifest.
- Minimal settings drawer.
- Minimal Atlas panel.
- Modern SillyTavern APIs.
- Test and lint setup.
- Build instructions.
- One clean commit.

The agent must not add Leaflet, map import, markers, or editor logic during Milestone 0.

This prevents the foundation from being mixed with feature work.

---

## 29. Technical Decisions That Require Explicit Approval

The agent must stop and document the tradeoff before making any of these changes:

- Replacing Leaflet with another renderer.
- Adding React, Vue, Svelte, or another UI framework.
- Requiring a server plugin.
- Adding a cloud service.
- Storing image data in extension settings.
- Changing the map schema version.
- Enabling raw STscript by default.
- Adding background LLM calls.
- Making AI generation mandatory.
- Coupling text and image generation to the same provider.
- Storing raw provider credentials in browser-exportable project data.
- Adding a provider-specific implementation outside the provider adapter layer.
- Adding telemetry.
- Adding remote analytics.
- Adding a non-libre dependency.
- Removing legacy import support after it has shipped.

---

## 30. Security Checklist

Before every release:

- [ ] Imported JSON is schema-validated.
- [ ] Image MIME type is checked.
- [ ] Image size is limited.
- [ ] Object URLs are revoked.
- [ ] No imported script executes automatically.
- [ ] STscript permission is explicit.
- [ ] Trusted approval is checksum-bound.
- [ ] No `eval`.
- [ ] No unsafe `innerHTML`.
- [ ] User-provided text is rendered with `textContent`.
- [ ] Remote URLs are disabled or restricted by default.
- [ ] External navigation uses safe URL schemes.
- [ ] Storage deletion cannot target unrelated keys.
- [ ] Debug exports do not expose API keys or chat contents.
- [ ] Tool actions validate map and location IDs.
- [ ] Hidden locations are not returned to the model.
- [ ] Provider credentials are absent from map documents, chat metadata, exports, logs, and diagnostics.
- [ ] Text and image responses are size-limited and validated.
- [ ] Asynchronous image polling has timeout and cancellation.
- [ ] Provider adapters do not expose hidden locations in prompts.
- [ ] Generated map JSON is schema-validated before saving.

---

## 31. Final Product Success Criteria

The project is successful when a non-technical SillyTavern user can:

1. Install the extension from a repository URL.
2. Open Atlas from the Extensions menu.
3. Upload a fantasy map image.
4. Click the map to create locations.
5. Start a chat and select a starting location.
6. Click a connected location to travel.
7. Reopen the chat later and see the same position.
8. Let the model receive concise current-location context.
9. Use the same map pack in another browser by exporting and importing it.
10. Perform all essential actions on a phone without editing JSON or SVG.
11. Optionally generate a world, region, or city blueprint with a chosen text provider.
12. Optionally generate an unlabeled background with a different image provider.
13. Use the complete viewer and editor without configuring either provider.

That is the core product. Everything else is secondary.
