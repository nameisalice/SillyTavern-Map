/**
 * Thumbnail service.
 *
 * Generates a small thumbnail from a full-size image using a canvas,
 * preserving aspect ratio, capped at 320px on the long edge. Prefers
 * WebP when supported, falling back to PNG then JPEG. Generated once and
 * reused via the ThumbnailRepository. Failures are non-fatal.
 */

import type { MapImageMimeType } from '@/domain/map';
import type { AssetRepository, ThumbnailRepository } from '@/repositories';

/** Recommended maximum thumbnail dimension (long edge). */
export const THUMBNAIL_MAX_DIMENSION = 320;

export class ThumbnailService {
  constructor(
    private readonly assets: AssetRepository,
    private readonly thumbnails: ThumbnailRepository,
  ) {}

  /**
   * Ensures a thumbnail exists for the given image asset id, generating
   * one if needed. Returns the thumbnail asset id (same as image id) or
   * `null` if generation failed.
   */
  async ensureThumbnail(imageAssetId: string): Promise<string | null> {
    const image = await this.assets.loadAsset(imageAssetId);
    if (!image) {
      return null;
    }
    // Thumbnail asset id reuses the image asset id so library lookups are O(1).
    if (await this.thumbnails.thumbnailExists(imageAssetId)) {
      return imageAssetId;
    }
    const generated = await this.generate(image.data, image.metadata.mime);
    if (!generated) {
      return null;
    }
    try {
      await this.thumbnails.saveThumbnail({
        id: imageAssetId,
        mime: generated.mime,
        data: generated.data,
      });
      return imageAssetId;
    } catch {
      return null;
    }
  }

  /**
   * Loads thumbnail bytes by asset id, or `null` if absent. The library
   * uses this to build an object URL without loading full-size images.
   */
  async loadThumbnail(
    imageAssetId: string,
  ): Promise<{ data: Uint8Array; mime: MapImageMimeType } | null> {
    const data = await this.thumbnails.loadThumbnail(imageAssetId);
    if (!data) {
      return null;
    }
    // Thumbnails are stored as WebP/PNG/JPEG; mime is implicit here.
    return { data, mime: 'image/webp' as MapImageMimeType };
  }

  /**
   * Renders a thumbnail blob from image bytes. Pure-ish: uses a canvas
   * and an HTMLImageElement. Resolves `null` if decoding fails.
   */
  private async generate(
    data: Uint8Array,
    mime: MapImageMimeType,
  ): Promise<{ data: Uint8Array; mime: MapImageMimeType } | null> {
    const blob = new Blob([data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outMime = preferredThumbnailMime();
      const outBlob = await canvasToBlob(canvas, outMime);
      if (!outBlob) {
        return null;
      }
      return { data: new Uint8Array(await outBlob.arrayBuffer()), mime: outMime };
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Computes thumbnail dimensions preserving aspect ratio. */
export function fitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  max: number = THUMBNAIL_MAX_DIMENSION,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: max, height: max };
  }
  const scale = Math.min(1, max / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/** Picks the best thumbnail MIME type the browser supports. */
export function preferredThumbnailMime(): MapImageMimeType {
  const canvas = document.createElement('canvas');
  if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    return 'image/webp';
  }
  return 'image/png';
}

/** Loads an HTMLImageElement from a URL, rejecting on error. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.src = url;
  });
}

/** Converts a canvas to a blob of the given MIME type. */
function canvasToBlob(canvas: HTMLCanvasElement, mime: MapImageMimeType): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, 0.9));
}
