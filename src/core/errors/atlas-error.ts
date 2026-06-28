/**
 * Typed error hierarchy for SillyTavern Atlas.
 *
 * A small set of named error classes lets callers discriminate failure
 * modes without inspecting message strings. Every Atlas error carries
 * a stable `code` so logs and (future) diagnostics can group them.
 *
 * These are infrastructure only; throwing is left to the modules that
 * detect the condition.
 */

/** Base class for every Atlas-thrown error. */
export class AtlasError extends Error {
  /** Stable machine-readable code, e.g. `'host_unavailable'`. */
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AtlasError';
    this.code = code;
  }
}

/** Raised when the SillyTavern host context cannot be obtained. */
export class HostUnavailableError extends AtlasError {
  constructor(message = 'SillyTavern host context is unavailable.') {
    super(message, 'host_unavailable');
    this.name = 'HostUnavailableError';
  }
}

/** Raised when a dependency cannot be resolved from the container. */
export class DependencyNotFoundError extends AtlasError {
  readonly key: string;

  constructor(key: string) {
    super(`No dependency registered for key "${key}".`, 'dependency_not_found');
    this.name = 'DependencyNotFoundError';
    this.key = key;
  }
}

/** Raised when an event payload fails a runtime type guard. */
export class InvalidEventPayloadError extends AtlasError {
  readonly eventType: string;

  constructor(eventType: string, message: string) {
    super(`Invalid payload for "${eventType}": ${message}`, 'invalid_event_payload');
    this.name = 'InvalidEventPayloadError';
    this.eventType = eventType;
  }
}
