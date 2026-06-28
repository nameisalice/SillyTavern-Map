/**
 * Lightweight map index entry.
 *
 * Stored in extension settings and in repository metadata. Never stores
 * large image blobs.
 */

import type { AtlasMapType } from '@/domain/generation';

export interface AtlasMapIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly type: AtlasMapType;
  readonly updatedAt: string;
  readonly thumbnailAssetId?: string;
  readonly parentMapId?: string;
}
