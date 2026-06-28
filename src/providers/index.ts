/**
 * Barrel for the Atlas provider layer.
 *
 * Providers are the outermost layer: they know how to talk to external
 * services (text models, image endpoints, storage backends) but nothing
 * about map domain logic or UI. Domain and services depend on these
 * interfaces; they never depend on a concrete adapter.
 */

export * from './base';
export * from './text';
export * from './image';
export * from './storage';
