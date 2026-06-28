/**
 * Cross-cutting primitive types shared across layers.
 */

/**
 * A branded id distinguishing a string from arbitrary text. Used to
 * make map/location/region ids type-safe in later milestones.
 */
export type Id = string & { readonly __id: true };

/** A 2D point in normalized [0, 100] coordinate space. */
export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}
