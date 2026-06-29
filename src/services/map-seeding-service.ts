/**
 * MapSeedingService.
 *
 * Dedicated service to seed the bundled example map ("Southern Marches")
 * into the MapRepository on first run. Keeping this out of bootstrap
 * and travel coordinators maintains a clean separation of concerns.
 */

import type { MapRepository } from '@/repositories/map-repository';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';
import { logError, logInfo } from '@/core/logger';

export class MapSeedingService {
  constructor(private readonly maps: MapRepository) {}

  /** Seeds the bundled map doc if it does not already exist in storage. */
  async seed(): Promise<void> {
    try {
      if (!(await this.maps.exists(SOUTHERN_MARCHES.id))) {
        await this.maps.save(SOUTHERN_MARCHES);
        logInfo('Seeded bundled example map into repository.');
      }
    } catch (error) {
      logError('Failed to seed bundled example map.', error);
    }
  }
}
