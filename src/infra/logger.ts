/**
 * Legacy logger path. The canonical implementation now lives in
 * `@/core/logger`. This file re-exports it so existing imports keep
 * working during the layering migration. Prefer `@/core/logger` in
 * new code.
 */

export type { LogLevel } from '@/core/logger';
export { getLogLevel, logDebug, logError, logInfo, logWarn, setLogLevel } from '@/core/logger';
