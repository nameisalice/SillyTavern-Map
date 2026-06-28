/**
 * Region domain types.
 *
 * Derived from the development plan (§6.3). A region is a polygonal
 * area on the map. Pure type declarations.
 */

/** A polygon expressed as an ordered list of [x, y] points. */
export type AtlasPolygon = readonly (readonly [number, number])[];

/** A polygonal region on the map. */
export interface AtlasRegion {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly polygon: AtlasPolygon;
  readonly fillColor?: string;
  readonly borderColor?: string;
  readonly opacity?: number;
  readonly hiddenUntilDiscovered?: boolean;
}
