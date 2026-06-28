/**
 * Barrel for the Atlas shared types layer.
 *
 * Re-exports the canonical type definitions grouped by concern. The
 * canonical homes are: common primitives/settings here, event types in
 * `@/core/events`, provider contracts in `@/providers`, and map domain
 * types in `@/domain`. This barrel gives consumers one import path.
 */

export * from './common';
export * from './events';
export * from './providers';
export * from './map';
