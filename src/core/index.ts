/**
 * Barrel for the Atlas core layer.
 *
 * Core is shared across every other layer. It must not depend on UI,
 * features, services, domain, providers, or storage. Anything that
 * needs host I/O or wiring lives in the `app/` composition root or the
 * `st/` adapters, not here.
 *
 * Core contains only pure infrastructure: error types, the logger, the
 * event bus, the dependency container, and the panel lifecycle state
 * machine.
 */

export * from './errors';
export * from './logger';
export * from './events';
export * from './container';
export * from './lifecycle';
