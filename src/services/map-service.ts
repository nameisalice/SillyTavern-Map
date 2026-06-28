/**
 * MapService boundary.
 *
 * Coordinates loading, indexing, and lookup of map documents. The
 * concrete implementation arrives in a later milestone; this interface
 * fixes the boundary so UI/features can depend on the abstraction.
 *
 * Services coordinate everything: they sit above domain and providers,
 * and below features. They never know about UI.
 */

import type { AtlasMapDocument, AtlasLocation } from '@/domain';

/** Read-only map lookup contract. */
export interface MapService {
  /** Returns the active map document for the current chat, if any. */
  getActiveMap(): Promise<AtlasMapDocument | null>;

  /** Loads a map document by id, making it active. */
  loadMap(mapId: string): Promise<AtlasMapDocument>;

  /** Looks up a location by id within the active map. */
  findLocationById(locationId: string): AtlasLocation | null;
}
