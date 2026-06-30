/**
 * Generate Map workflow controller.
 *
 * Opens a small host popup, calls the configured text/image providers,
 * stores the generated image locally, and returns an editable draft map.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument, MapImageMimeType } from '@/domain/map';
import type { AtlasMapType } from '@/domain/generation';
import { createImageProviderFromSettings, createTextProviderFromSettings } from '@/providers';
import type { AtlasMapBlueprint } from '@/providers/text';
import { getContext } from '@/st/context';
import { loadSettings } from '@/st/settings-bridge';
import { logError } from '@/core/logger';
import type { ImageUploadService, MapDraftService } from '@/services';

export interface GenerateMapResult {
  readonly document: AtlasMapDocument;
  readonly imageUrl: string;
}

const MAP_TYPES: readonly AtlasMapType[] = [
  'world',
  'continent',
  'region',
  'city',
  'district',
  'building',
  'room',
  'dungeon',
  'custom',
];

/** Opens the Generate Map dialog. Returns a draft or null on cancel/failure. */
export async function openGenerateMapDialog(args: {
  readonly draftService: MapDraftService;
  readonly uploadService: ImageUploadService;
}): Promise<GenerateMapResult | null> {
  const form = buildForm();
  const context = getContext();
  const result = (await context.callGenericPopup(form, context.POPUP_TYPE.CONFIRM)) as number;
  if (result !== 1) {
    return null;
  }

  const concept = readInput(form, 'concept');
  const mapType = readInput(form, 'type') as AtlasMapType;
  const stylePrompt = readInput(form, 'style');
  if (!concept) {
    await showText('A map concept is required.');
    return null;
  }

  return generateMapDraft({ concept, mapType, stylePrompt }, args.draftService, args.uploadService);
}

function buildForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'st-atlas__generate-map';
  form.append(
    buildRow('Concept', buildTextarea('concept', 'A haunted coastal city with canals and old watchtowers')),
    buildRow('Map type', buildTypeSelect()),
    buildRow('Style', buildTextarea('style', 'Unlabeled fantasy map, readable terrain, no text or markers')),
  );
  return form;
}

function buildRow(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('label');
  row.className = 'st-atlas__create-map-row';
  const text = document.createElement('span');
  text.className = 'st-atlas__create-map-label';
  text.textContent = label;
  row.append(text, control);
  return row;
}

function buildTextarea(name: string, placeholder: string): HTMLElement {
  const textarea = document.createElement('textarea');
  textarea.name = name;
  textarea.rows = name === 'concept' ? 4 : 3;
  textarea.placeholder = placeholder;
  textarea.className = 'st-atlas__create-map-input st-atlas__generate-map-textarea text_pole';
  return textarea;
}

function buildTypeSelect(): HTMLElement {
  const select = document.createElement('select');
  select.name = 'type';
  select.className = 'st-atlas__create-map-input text_pole';
  for (const type of MAP_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    if (type === 'region') {
      option.selected = true;
    }
    select.append(option);
  }
  return select;
}

async function generateMapDraft(
  request: { readonly concept: string; readonly mapType: AtlasMapType; readonly stylePrompt: string },
  draftService: MapDraftService,
  uploadService: ImageUploadService,
): Promise<GenerateMapResult | null> {
  const settings = loadSettings();
  const textProvider = createTextProviderFromSettings(settings);
  const imageProvider = createImageProviderFromSettings(settings);
  if (!textProvider) {
    await showText('Text provider is disabled. Configure Atlas AI Providers first.');
    return null;
  }
  if (!imageProvider) {
    await showText('Image provider is disabled. Configure Atlas AI Providers first.');
    return null;
  }

  try {
    await showToast('Generating map blueprint...');
    const blueprint = await textProvider.generateMapBlueprint({
      concept: request.concept,
      mapType: request.mapType,
      stylePrompt: request.stylePrompt,
    });

    await showToast('Generating map background...');
    const image = await imageProvider.generateImage({
      prompt: buildImagePrompt(blueprint, request.concept, request.stylePrompt),
      resolution: settings.imageProviderResolution,
    });

    const uploaded = await uploadService.saveGeneratedImage({
      name: blueprint.name,
      data: image.data,
      mimeType: image.mimeType as MapImageMimeType,
      width: image.width,
      height: image.height,
    });
    const draft = draftService.buildDraft({
      name: blueprint.name,
      type: request.mapType,
      description: request.concept,
      imageAssetId: uploaded.assetId,
      imageWidth: uploaded.width,
      imageHeight: uploaded.height,
      imageMimeType: uploaded.mimeType,
      imageChecksum: uploaded.checksum,
    });
    const document = applyBlueprintLocations(draft, blueprint);
    const imageUrl = URL.createObjectURL(new Blob([image.data as BlobPart], { type: image.mimeType }));
    await showToast('Generated map draft is ready.');
    return { document, imageUrl };
  } catch (error) {
    logError('AI map generation failed.', error);
    await showText(`Could not generate map: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function applyBlueprintLocations(
  draft: AtlasMapDocument,
  blueprint: AtlasMapBlueprint,
): AtlasMapDocument {
  const locations: AtlasLocation[] = blueprint.locations.map((location, index) => ({
    id: location.id,
    name: location.name,
    coordinates: { x: location.x, y: location.y },
    discoveredByDefault: true,
    dangerLevel: 0,
    category: 'generated',
    description: index === 0 ? 'Generated starting location.' : undefined,
  }));
  return {
    ...draft,
    name: blueprint.name,
    type: blueprint.type as AtlasMapType,
    defaultLocationId: locations[0]?.id,
    locations,
    metadata: {
      ...draft.metadata,
      source: 'ai-generated',
    },
  };
}

function buildImagePrompt(
  blueprint: AtlasMapBlueprint,
  concept: string,
  stylePrompt: string,
): string {
  const locationNames = blueprint.locations.map((location) => location.name).join(', ');
  return [
    `${blueprint.type} map: ${blueprint.name}`,
    concept,
    stylePrompt,
    locationNames ? `Visual geography should support these places: ${locationNames}` : '',
    'Unlabeled background map only. No text, labels, icons, pins, routes, UI, or watermark.',
  ]
    .filter(Boolean)
    .join('\n');
}

function readInput(root: HTMLElement, name: string): string {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${name}"]`,
  );
  return input?.value.trim() ?? '';
}

async function showText(message: string): Promise<void> {
  const context = getContext();
  await context.callGenericPopup(message, context.POPUP_TYPE.TEXT);
}

async function showToast(message: string): Promise<void> {
  if (typeof toastr !== 'undefined') {
    toastr.info(message, 'Atlas');
  }
}
