/**
 * Thumbnail sizing tests.
 *
 * The pure `fitDimensions` helper is unit-tested; canvas-based rendering
 * requires a real browser and is verified manually.
 */

import { describe, expect, it } from 'vitest';
import { THUMBNAIL_MAX_DIMENSION, fitDimensions } from '@/services/thumbnail-service';

describe('thumbnail fitDimensions', () => {
  it('scales the long edge down to the max, preserving aspect ratio', () => {
    const { width, height } = fitDimensions(1600, 1000);
    expect(Math.max(width, height)).toBe(THUMBNAIL_MAX_DIMENSION);
    // 1600:1000 == 320:200
    expect(width).toBe(320);
    expect(height).toBe(200);
  });

  it('does not upscale images smaller than the max', () => {
    const { width, height } = fitDimensions(100, 50);
    expect(width).toBe(100);
    expect(height).toBe(50);
  });

  it('falls back to a square when dimensions are invalid', () => {
    const { width, height } = fitDimensions(0, 0);
    expect(width).toBe(THUMBNAIL_MAX_DIMENSION);
    expect(height).toBe(THUMBNAIL_MAX_DIMENSION);
  });

  it('always returns at least 1px', () => {
    const { width, height } = fitDimensions(1, 1);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});
