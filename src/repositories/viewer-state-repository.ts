/** ViewerStateRepository implementation. */

import type { AtlasViewerState } from '@/domain/map';
import type { StorageProvider } from '@/providers/storage';

export class ViewerStateRepository {
  constructor(private readonly storage: StorageProvider) {}

  async save(state: AtlasViewerState): Promise<void> {
    await this.storage.save('viewer-state', state.mapId, state);
  }

  async load(mapId: string): Promise<AtlasViewerState | null> {
    return this.storage.load<AtlasViewerState>('viewer-state', mapId);
  }

  async delete(mapId: string): Promise<void> {
    await this.storage.delete('viewer-state', mapId);
  }

  async exists(mapId: string): Promise<boolean> {
    return this.storage.exists('viewer-state', mapId);
  }
}
