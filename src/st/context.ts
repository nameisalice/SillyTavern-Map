/**
 * Thin adapter over `SillyTavern.getContext()`.
 *
 * Atlas never imports host internals directly (no `power-user.js`,
 * no `RossAscends-mods.js`, no `slash-commands.js`). Every host API the
 * extension touches is reached through this module, so the coupling to
 * the host surface is isolated in one place and easy to audit.
 */

import { logError } from '@/infra/logger';

/**
 * Returns the current SillyTavern context. All host interactions go
 * through here. Throws are caught and re-surfaced as a typed error so
 * callers can degrade gracefully if the host is unavailable.
 */
export function getContext(): SillyTavernContext {
  if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') {
    // This is a hard failure: the host did not expose the context API.
    // We log and throw so bootstrap can show a concise toast.
    throw new Error('SillyTavern host context is unavailable.');
  }
  return SillyTavern.getContext();
}

/**
 * Safe accessor that never throws. Returns `null` if the host context
 * cannot be obtained, so optional/deferred callers can skip work instead
 * of crashing the bootstrap.
 */
export function tryGetContext(): SillyTavernContext | null {
  try {
    return getContext();
  } catch (error) {
    logError('Failed to acquire host context.', error);
    return null;
  }
}
