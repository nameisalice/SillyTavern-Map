/** MapRepository implementation. */

import type { AtlasMapDocument, AtlasMapIndexEntry } from '@/domain/map';
import { upgradeDocument, validateMapDocument } from '@/domain/map';
import type { StorageProvider } from '@/providers/storage';
import { cloneJson, nowIso, suffixId } from './repository-utils';

const MAP_INDEX_KEY = 'map-index';

export class MapRepository {
  constructor(
    private readonly storage: StorageProvider,
    private readonly onIndexChanged?: (index: readonly AtlasMapIndexEntry[]) => void,
  ) {}

  async save(document: AtlasMapDocument): Promise<void> {
    const validation = validateMapDocument(document);
    if (!validation.ok) {
      throw new Error(validation.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    }
    await this.storage.save('maps', document.id, cloneJson(document));
    await this.upsertIndex(document);
  }

  async load(id: string): Promise<AtlasMapDocument | null> {
    const raw = await this.storage.load<unknown>('maps', id);
    if (!raw) {
      return null;
    }
    return upgradeDocument(raw);
  }

  async delete(id: string): Promise<void> {
    await this.storage.delete('maps', id);
    const index = (await this.listIndex()).filter((entry) => entry.id !== id);
    await this.writeIndex(index);
  }

  async exists(id: string): Promise<boolean> {
    return this.storage.exists('maps', id);
  }

  async list(): Promise<readonly AtlasMapDocument[]> {
    const ids = await this.storage.list('maps');
    const maps: AtlasMapDocument[] = [];
    for (const id of ids) {
      const map = await this.load(id);
      if (map) {
        maps.push(map);
      }
    }
    return maps;
  }

  async listIndex(): Promise<readonly AtlasMapIndexEntry[]> {
    return (await this.storage.load<AtlasMapIndexEntry[]>('metadata', MAP_INDEX_KEY)) ?? [];
  }

  async search(query: string): Promise<readonly AtlasMapIndexEntry[]> {
    const q = query.trim().toLowerCase();
    const index = await this.listIndex();
    if (!q) {
      return index;
    }
    return index.filter((entry) => entry.name.toLowerCase().includes(q) || entry.id.includes(q));
  }

  async rename(id: string, name: string): Promise<AtlasMapDocument> {
    const map = await this.load(id);
    if (!map) {
      throw new Error(`Map "${id}" not found.`);
    }
    const renamed: AtlasMapDocument = {
      ...map,
      name,
      metadata: { ...map.metadata, updatedAt: nowIso() },
    };
    await this.save(renamed);
    return renamed;
  }

  async duplicate(id: string, newId: string): Promise<AtlasMapDocument> {
    const map = await this.load(id);
    if (!map) {
      throw new Error(`Map "${id}" not found.`);
    }
    if (await this.exists(newId)) {
      throw new Error(`Map "${newId}" already exists.`);
    }
    const duplicated: AtlasMapDocument = {
      ...cloneJson(map),
      id: newId,
      name: `${map.name} Copy`,
      locations: map.locations.map((location) => ({ ...location })),
      regions: map.regions.map((region) => ({ ...region })),
      routes: map.routes.map((route) => ({ ...route, id: suffixId(route.id, 'copy') })),
      metadata: {
        ...map.metadata,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        source: 'duplicate',
      },
    };
    await this.save(duplicated);
    return duplicated;
  }

  private async upsertIndex(document: AtlasMapDocument): Promise<void> {
    const index = [...(await this.listIndex())];
    const entry: AtlasMapIndexEntry = {
      id: document.id,
      name: document.name,
      type: document.type,
      updatedAt: document.metadata.updatedAt,
      thumbnailAssetId: undefined,
      parentMapId: document.parentMapId,
    };
    const i = index.findIndex((item) => item.id === document.id);
    if (i >= 0) {
      index[i] = entry;
    } else {
      index.push(entry);
    }
    await this.writeIndex(index);
  }

  private async writeIndex(index: readonly AtlasMapIndexEntry[]): Promise<void> {
    await this.storage.save('metadata', MAP_INDEX_KEY, [...index]);
    this.onIndexChanged?.(index);
  }
}
