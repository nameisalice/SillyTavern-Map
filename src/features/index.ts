/**
 * Barrel for the Atlas features layer.
 *
 * Each feature is a self-contained vertical slice of UI + wiring. A
 * feature depends on services (and through them, domain/providers). A
 * feature never calls a provider or the storage layer directly, and a
 * feature never imports another feature's internals — only via
 * services and the event bus.
 *
 * All entries are placeholders for later milestones.
 */

export {};
