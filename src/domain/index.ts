/**
 * Barrel for the Atlas domain layer.
 *
 * Domain holds the canonical data contracts and (in later milestones)
 * pure domain logic: validation, migration, coordinate normalization,
 * lookup, reachability. It depends only on itself and on shared types.
 * It never imports UI, features, services, providers, or storage.
 */

export * from './map';
export * from './location';
export * from './region';
export * from './route';
export * from './actions';
export * from './travel';
export * from './generation';
