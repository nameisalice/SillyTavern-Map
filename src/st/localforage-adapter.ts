/**
 * Host localforage adapter.
 *
 * Current SillyTavern exposes localforage on `window.localforage` via
 * public/lib.js. `getContext().libs.localforage` is not available in
 * the current host surface. This adapter is the only place Atlas reads
 * the global directly.
 */

export function getLocalForage(): AtlasLocalForage {
  if (!window.localforage) {
    throw new Error('SillyTavern localforage shim is unavailable.');
  }
  return window.localforage;
}
