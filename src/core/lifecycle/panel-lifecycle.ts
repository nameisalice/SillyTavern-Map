/**
 * Panel lifecycle: a tiny state machine for the Atlas panel.
 *
 * Milestone 0 only needs open/close. The panel is built once and
 * toggled via CSS rather than re-created, which keeps listeners from
 * duplicating on reopen (a requirement of the plan, §17).
 *
 * This module owns only the open/closed state of the panel DOM node.
 * Higher-level extension lifecycle (load/unload of the whole extension)
 * is the responsibility of the bootstrap module.
 */

import { logDebug } from '@/core/logger';

export type PanelState = 'closed' | 'open';

let currentState: PanelState = 'closed';
let rootEl: HTMLElement | null = null;

/**
 * Binds the lifecycle to a root element. Called once during bootstrap
 * after the panel template is inserted into the DOM.
 */
export function bindPanel(root: HTMLElement): void {
  rootEl = root;
}

/** Returns whether the panel is currently open. */
export function isPanelOpen(): boolean {
  return currentState === 'open';
}

/** Opens the panel. No-op if it is already open or not yet bound. */
export function openPanel(): void {
  if (!rootEl) {
    logDebug('openPanel called before bindPanel; ignoring.');
    return;
  }
  if (currentState === 'open') {
    return;
  }
  rootEl.setAttribute('data-st-atlas-panel-state', 'open');
  rootEl.classList.add('st-atlas__panel--open');
  currentState = 'open';
  logDebug('Panel opened.');
}

/** Closes the panel. No-op if it is already closed or not yet bound. */
export function closePanel(): void {
  if (!rootEl) {
    logDebug('closePanel called before bindPanel; ignoring.');
    return;
  }
  if (currentState === 'closed') {
    return;
  }
  rootEl.setAttribute('data-st-atlas-panel-state', 'closed');
  rootEl.classList.remove('st-atlas__panel--open');
  currentState = 'closed';
  logDebug('Panel closed.');
}

/** Toggles the panel between open and closed. */
export function togglePanel(): void {
  if (currentState === 'open') {
    closePanel();
  } else {
    openPanel();
  }
}
