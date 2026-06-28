/**
 * A small leveled logger for SillyTavern Atlas.
 *
 * Every line is prefixed with the stable [[LOG_PREFIX]] so it can be
 * filtered in the browser console. The active level is driven by the
 * user-configurable `loggingLevel` setting, so noisy output can be
 * silenced without code changes.
 *
 * This module is the canonical logger home. The legacy `@/infra/logger`
 * path re-exports these symbols for backward compatibility with code
 * that has not been migrated yet.
 */

import { LOG_PREFIX } from '@/constants';

/**
 * Log severity levels, ordered from quietest to noisiest.
 * A higher numeric level permits more verbose output.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
});

/**
 * In-memory active level. Defaults to 'info'; the settings bridge updates
 * it once the user's preference is loaded. This is intentionally a single
 * module-scoped value rather than a global mutable object.
 */
let activeLevel: LogLevel = 'info';

/**
 * Set the minimum level that will be emitted. Called by the settings
 * bridge whenever the user changes `loggingLevel`.
 */
export function setLogLevel(level: LogLevel): void {
  activeLevel = level;
}

/** Current effective log level. Exposed for tests and diagnostics. */
export function getLogLevel(): LogLevel {
  return activeLevel;
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] <= LEVEL_WEIGHT[activeLevel];
}

function format(message: string): string {
  return `${LOG_PREFIX} ${message}`;
}

/** Log an error. Always emitted unless the level is set above error. */
export function logError(message: string, ...args: unknown[]): void {
  if (shouldEmit('error')) {
    // eslint-disable-next-line no-console
    console.error(format(message), ...args);
  }
}

/** Log a warning. */
export function logWarn(message: string, ...args: unknown[]): void {
  if (shouldEmit('warn')) {
    // eslint-disable-next-line no-console
    console.warn(format(message), ...args);
  }
}

/** Log an informational message. */
export function logInfo(message: string, ...args: unknown[]): void {
  if (shouldEmit('info')) {
    // eslint-disable-next-line no-console
    console.info(format(message), ...args);
  }
}

/** Log a debug message. Silenced unless the level is 'debug'. */
export function logDebug(message: string, ...args: unknown[]): void {
  if (shouldEmit('debug')) {
    // eslint-disable-next-line no-console
    console.debug(format(message), ...args);
  }
}
