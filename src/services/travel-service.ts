/**
 * TravelService boundary.
 *
 * Moves the player between locations, validates routes, and records
 * travel history. Concrete implementation arrives in a later milestone.
 */

import type { TravelSource } from '@/domain';

/** Travel coordination contract. */
export interface TravelService {
  /** Moves the player to a location, validating the route if possible. */
  travelTo(locationId: string, source: TravelSource): Promise<boolean>;

  /** Returns the current location id for the active chat. */
  getCurrentLocationId(): string | null;
}
