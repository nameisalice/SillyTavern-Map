/**
 * Route domain types.
 *
 * Derived from the development plan (§6.4). A route is a directed (or
 * bidirectional) connection between two locations. Pure type
 * declarations.
 */

import type { DangerLevel } from '@/domain/location';

/** Units a route distance may be expressed in. */
export type DistanceUnit = 'm' | 'km' | 'mi' | 'day' | 'hour';

/** Units a route travel time may be expressed in. */
export type TravelTimeUnit = 'minute' | 'hour' | 'day';

/** A connection between two locations. */
export interface AtlasRoute {
  readonly id: string;
  readonly name: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly points?: readonly (readonly [number, number])[];
  readonly distance?: number;
  readonly distanceUnit?: DistanceUnit;
  readonly travelTime?: number;
  readonly travelTimeUnit?: TravelTimeUnit;
  readonly bidirectional: boolean;
  readonly locked?: boolean;
  readonly requirements?: readonly string[];
  readonly dangerLevel?: DangerLevel;
}
