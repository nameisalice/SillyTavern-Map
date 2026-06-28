/** Map library backend service.
 *
 * No fancy UI here. This service exposes list/search/rename/duplicate/
 * delete and delegates persistence to repositories.
 */

import type { AtlasMapDocument, AtlasMapIndexEntry } from '@/domain/map';
import type { MapRepository, ViewerStateRepository } from '@/repositories';

export class MapLibraryService {
  constructor(
    private readonly maps: MapRepository,
    private readonly viewerStates: ViewerStateRepository,
  ) {}

  listMaps(): Promise<readonly AtlasMapIndexEntry[]> {
    return this.maps.listIndex();
  }

  searchMaps(query: string): Promise<readonly AtlasMapIndexEntry[]> {
    return this.maps.search(query);
  }

  renameMap(id: string, name: string): Promise<AtlasMapDocument> {
    return this.maps.rename(id, name);
  }

  duplicateMap(id: string, newId: string): Promise<AtlasMapDocument> {
    return this.maps.duplicate(id, newId);
  }

  async deleteMap(id: string): Promise<void> {
    await this.maps.delete(id);
    await this.viewerStates.delete(id);
  }
}
