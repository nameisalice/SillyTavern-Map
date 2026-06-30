/**
 * Image upload service.
 *
 * Validates an uploaded image file, decodes it to confirm it is a real
 * image and to record its intrinsic dimensions, stores it through the
 * AssetRepository, and returns the asset id. Never stores base64 data
 * in extension settings and never stores raw file paths.
 *
 * SVG upload is intentionally disabled for user-provided files in this
 * milestone: an untrusted SVG can carry script and would be rendered
 * inline by the host, which is an unsafe rendering risk under the
 * current security model. The bundled SVG example remains, because it
 * is authored in-repo and trusted.
 */

import type { AtlasAssetMetadata, MapImageMimeType } from '@/domain/map';
import type { AssetRepository } from '@/repositories';

/** Maximum accepted image file size (20 MB). */
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

/** MIME types accepted for user-uploaded images. SVG is excluded. */
export const ACCEPTED_IMAGE_MIME_TYPES: readonly MapImageMimeType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** Result of a successful image upload. */
export interface UploadedImage {
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: MapImageMimeType;
  readonly checksum: string;
}

/** Input for storing image bytes returned by an AI image provider. */
export interface GeneratedImageUploadInput {
  readonly name: string;
  readonly data: Uint8Array;
  readonly mimeType: MapImageMimeType;
  readonly width?: number;
  readonly height?: number;
}

export class ImageUploadService {
  constructor(private readonly assets: AssetRepository) {}

  /**
   * Validates, decodes, and stores an uploaded image file. Throws with
   * a readable message on any failure (bad MIME, too large, unreadable,
   * zero-sized).
   */
  async upload(file: File): Promise<UploadedImage> {
    if (file.size <= 0) {
      throw new Error('The selected image is empty.');
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('The selected image is larger than 20 MB.');
    }
    const mimeType = normalizeMime(file.type);
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(
        'Unsupported image type. Use PNG, JPEG, or WebP. SVG upload is disabled for user files.',
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const dimensions = await decodeDimensions(buffer, mimeType).catch(() => null);
    if (!dimensions) {
      throw new Error('The selected image could not be decoded.');
    }
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('The selected image has no dimensions.');
    }

    const assetId = await generateAssetId(file.name);
    const metadata = await this.assets.saveAsset({
      id: assetId,
      kind: 'image',
      mime: mimeType,
      data: buffer,
    });
    return {
      assetId: metadata.id,
      width: dimensions.width,
      height: dimensions.height,
      mimeType,
      checksum: metadata.checksum,
    };
  }

  /** Stores provider-generated image bytes as a normal Atlas image asset. */
  async saveGeneratedImage(input: GeneratedImageUploadInput): Promise<UploadedImage> {
    if (input.data.byteLength <= 0) {
      throw new Error('The generated image is empty.');
    }
    if (input.data.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('The generated image is larger than 20 MB.');
    }
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(input.mimeType)) {
      throw new Error('Generated image type is unsupported. Use PNG, JPEG, or WebP.');
    }

    const dimensions =
      input.width && input.height
        ? { width: input.width, height: input.height }
        : await decodeDimensions(input.data, input.mimeType).catch(() => null);
    if (!dimensions) {
      throw new Error('The generated image could not be decoded.');
    }
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('The generated image has no dimensions.');
    }

    const assetId = await generateAssetId(`${input.name}.${extensionForMime(input.mimeType)}`);
    const metadata = await this.assets.saveAsset({
      id: assetId,
      kind: 'image',
      mime: input.mimeType,
      data: input.data,
    });
    return {
      assetId: metadata.id,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: input.mimeType,
      checksum: metadata.checksum,
    };
  }

  /** Loads an asset's bytes + metadata, or null. */
  async loadAsset(
    assetId: string,
  ): Promise<{ data: Uint8Array; metadata: AtlasAssetMetadata } | null> {
    const asset = await this.assets.loadAsset(assetId);
    if (!asset) {
      return null;
    }
    return { data: asset.data, metadata: asset.metadata };
  }

  /** Deletes an asset by id from the repository. */
  async deleteAsset(assetId: string): Promise<void> {
    await this.assets.deleteAsset(assetId);
  }
}

/** Normalizes a browser MIME string into a known Atlas type. */
function normalizeMime(raw: string): MapImageMimeType {
  switch (raw) {
    case 'image/png':
      return 'image/png';
    case 'image/jpeg':
      return 'image/jpeg';
    case 'image/webp':
      return 'image/webp';
    case 'image/svg+xml':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

function extensionForMime(mime: MapImageMimeType): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    case 'image/png':
    default:
      return 'png';
  }
}

/** Decodes intrinsic image dimensions via an object URL. */
function decodeDimensions(
  data: Uint8Array,
  mime: MapImageMimeType,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      URL.revokeObjectURL(url);
      resolve({ width: naturalWidth, height: naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

/** Builds a stable asset id from a filename + timestamp-free suffix. */
async function generateAssetId(filename: string): Promise<string> {
  const base = filename
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'image'}-${suffix}`;
}
