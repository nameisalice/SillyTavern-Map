/**
 * Location domain types.
 *
 * Derived from the development plan (§6.2). A location is a point on
 * the map the player can occupy or travel to. Pure type declarations.
 */

/** Coordinates in the map's image coordinate space. */
export interface AtlasCoordinates {
  readonly x: number;
  readonly y: number;
}

/** A danger level from 0 (safe) to 5 (lethal). */
export type DangerLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** A point location on the map. */
export interface AtlasLocation {
  readonly id: string;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly description?: string;
  readonly coordinates: AtlasCoordinates;
  readonly icon?: string;
  readonly category?: string;
  readonly dangerLevel?: DangerLevel;
  readonly discoveredByDefault?: boolean;
  readonly hiddenUntilDiscovered?: boolean;
  readonly childMapId?: string;
  readonly worldInfoKeywords?: readonly string[];
  // Actions are declared in the actions domain module; referenced by
  // id-only here to avoid a circular import until that module lands.
  // readonly actions?: readonly AtlasAction[];
}
