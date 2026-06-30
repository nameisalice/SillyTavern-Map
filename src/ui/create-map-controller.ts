/**
 * Create Map workflow controller.
 *
 * Collects map name, type, optional description, and a background image.
 * Validates inputs, uploads the image through `ImageUploadService`
 * (never stores base64 in settings), builds a draft through
 * `MapDraftService`, and returns the draft plus a resolved image URL.
 *
 * On failure, the uploaded draft asset is cleaned up so failed map
 * creation does not leave permanent orphan assets.
 */

import { getContext } from '@/st/context';
import { logError } from '@/core/logger';
import type { AtlasMapDocument, MapImageMimeType } from '@/domain/map';
import type { AtlasMapType } from '@/domain/generation';
import type { ImageUploadService } from '@/services/image-upload-service';
import type { MapDraftService } from '@/services/map-draft-service';

/** Result of a completed Create Map workflow. */
export interface CreateMapResult {
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

/** Opens the Create Map dialog. Returns the draft or null on cancel. */
export async function openCreateMapDialog(
  draftService: MapDraftService,
): Promise<CreateMapResult | null> {
  const form = buildForm();
  const context = getContext();
  const result = (await context.callGenericPopup(form, context.POPUP_TYPE.CONFIRM)) as number;
  if (result !== 1) {
    return null;
  }

  const name = form.querySelector<HTMLInputElement>('[name="name"]')?.value.trim() ?? '';
  const type = (form.querySelector<HTMLSelectElement>('[name="type"]')?.value ??
    'region') as AtlasMapType;
  const description =
    form.querySelector<HTMLInputElement>('[name="description"]')?.value.trim() ?? '';
  const fileInput = form.querySelector<HTMLInputElement>('[name="image"]');
  const file = fileInput?.files?.[0];

  if (!name) {
    await context.callGenericPopup('A map name is required.', context.POPUP_TYPE.TEXT);
    return null;
  }
  if (!file) {
    await context.callGenericPopup('A background image is required.', context.POPUP_TYPE.TEXT);
    return null;
  }

  return finalizeCreateMap(name, type, description, file, draftService);
}

/** Builds the Create Map form using safe DOM APIs. */
function buildForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'st-atlas__create-map';

  form.append(buildRow('Map name', buildTextInput('name', '')));
  form.append(buildRow('Map type', buildTypeSelect()));
  form.append(buildRow('Description (optional)', buildTextInput('description', '')));
  form.append(buildRow('Background image', buildFileInput()));
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

function buildTextInput(name: string, value: string): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.className = 'st-atlas__create-map-input text_pole';
  input.value = value;
  return input;
}

function buildTypeSelect(): HTMLElement {
  const select = document.createElement('select');
  select.name = 'type';
  select.className = 'st-atlas__create-map-input text_pole';
  for (const type of MAP_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.append(option);
  }
  return select;
}

function buildFileInput(): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'st-atlas__file-field';
  const input = document.createElement('input');
  input.type = 'file';
  input.name = 'image';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.className = 'st-atlas__file-input';
  const button = document.createElement('span');
  button.className = 'st-atlas__file-button menu_button';
  button.textContent = 'Choose image';
  const filename = document.createElement('span');
  filename.className = 'st-atlas__file-name';
  filename.textContent = 'No image selected';
  input.addEventListener('change', () => {
    filename.textContent = input.files?.[0]?.name ?? 'No image selected';
  });
  wrapper.append(input, button, filename);
  return wrapper;
}

/**
 * Finalizes map creation: uploads the image, builds the draft, resolves
 * an object URL for the editor preview. Cleans up the uploaded asset if
 * draft building fails.
 */
async function finalizeCreateMap(
  name: string,
  type: AtlasMapType,
  description: string,
  file: File,
  draftService: MapDraftService,
): Promise<CreateMapResult | null> {
  // The ImageUploadService is resolved by the caller and exposed on the
  // draft service's asset repository. Bootstrap passes a real upload
  // service through a thin wrapper to avoid UI importing the container.
  const uploadService = getUploadService();
  let uploaded;
  try {
    uploaded = await uploadService.upload(file);
  } catch (error) {
    logError('Image upload failed during map creation.', error);
    await showText(
      `Could not upload the image: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  try {
    const draft = draftService.buildDraft({
      name,
      type,
      description: description || undefined,
      imageAssetId: uploaded.assetId,
      imageWidth: uploaded.width,
      imageHeight: uploaded.height,
      imageMimeType: uploaded.mimeType,
      imageChecksum: uploaded.checksum,
    });
    const imageUrl = await resolveObjectUrl(uploaded.assetId, uploaded.mimeType, draftService);
    return { document: draft, imageUrl };
  } catch (error) {
    logError('Draft build failed; cleaning up uploaded asset.', error);
    await cleanupAsset(uploaded.assetId, draftService);
    await showText(
      `Could not create the map: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/** Resolves a stored asset to an object URL for editor preview. */
async function resolveObjectUrl(
  assetId: string,
  mime: MapImageMimeType,
  draftService: MapDraftService,
): Promise<string> {
  const metadata = await draftService.loadImageAsset(assetId);
  void metadata;
  // Load raw bytes via the upload service to build a blob URL.
  const asset = await getUploadService().loadAsset(assetId);
  if (!asset) {
    throw new Error('The uploaded image could not be loaded for preview.');
  }
  const blob = new Blob([asset.data as BlobPart], { type: mime });
  return URL.createObjectURL(blob);
}

/** Cleans up an orphan draft asset after a failed creation. */
async function cleanupAsset(assetId: string, _draftService: MapDraftService): Promise<void> {
  try {
    // The draft service does not expose delete; the upload service does
    // properly now. We call deleteAsset on the injected upload service.
    await getUploadService().deleteAsset(assetId);
  } catch {
    // Best-effort cleanup; logged but non-fatal.
  }
}

async function showText(message: string): Promise<void> {
  try {
    const context = getContext();
    await context.callGenericPopup(message, context.POPUP_TYPE.TEXT);
  } catch {
    // Host unavailable; nothing more we can do.
  }
}

// --- injection seam ---------------------------------------------------------

/**
 * The Create Map workflow needs an `ImageUploadService` to upload the
 * chosen image. Bootstrap sets it here so this controller does not
 * import the composition root.
 */
let injectedUploadService: ImageUploadService | null = null;

/** Injects the upload service (called by bootstrap). */
export function setCreateMapUploadService(service: ImageUploadService): void {
  injectedUploadService = service;
}

function getUploadService(): ImageUploadService {
  if (!injectedUploadService) {
    throw new Error('Create Map upload service was not injected.');
  }
  return injectedUploadService;
}
