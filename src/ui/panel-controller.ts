/**
 * Panel controller: builds the minimal Atlas panel placeholder and
 * wires open/close to the lifecycle module.
 *
 * Milestone 0 only proves the panel can open and close. There is no
 * map canvas, no markers, no toolbar beyond a title and a close
 * button. The panel is created once and toggled via CSS to avoid
 * listener duplication on reopen.
 */

import { EXTENSION_NAME } from '@/constants';
import { getContext } from '@/st/context';
import { bindPanel, closePanel, openPanel } from '@/app/lifecycle';
import { logError, logInfo } from '@/infra/logger';

/** Lazily-created root element so the panel is built only once. */
let panelRoot: HTMLElement | null = null;

/**
 * Returns the panel root, creating it on first call. The panel is
 * hidden by default; call [[openAtlasPanel]] to show it.
 */
export function getPanelRoot(): HTMLElement {
  if (panelRoot) {
    return panelRoot;
  }
  panelRoot = createPanel();
  document.body.append(panelRoot);
  bindPanel(panelRoot);
  return panelRoot;
}

/**
 * Opens the Atlas panel, creating it on first use.
 */
export function openAtlasPanel(): void {
  getPanelRoot();
  openPanel();
  logInfo('Atlas panel opened.');
}

/**
 * Closes the Atlas panel.
 */
export function closeAtlasPanel(): void {
  closePanel();
}

/**
 * Builds the panel DOM. Uses an HTML template via the host renderer so
 * markup lives in a .html file, not in a string. Falls back to a
 * vanilla DOM construction if the template cannot be rendered.
 */
function createPanel(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'st-atlas__panel';
  root.setAttribute('data-st-atlas', 'panel');
  root.setAttribute('data-st-atlas-panel-state', 'closed');

  let inner: string | null = null;
  try {
    const context = getContext();
    // Render synchronously-shaped markup but keep it async-safe.
    void context.renderExtensionTemplateAsync(EXTENSION_NAME, 'panel').then((html) => {
      if (panelRoot === root && html) {
        root.innerHTML = html;
        wirePanelControls(root);
      }
    });
  } catch (error) {
    logError('Failed to render Atlas panel template; using fallback.', error);
    inner = null;
  }

  if (inner === null) {
    buildFallbackPanel(root);
  }
  wirePanelControls(root);
  return root;
}

/**
 * Constructs a minimal panel from raw DOM when the template path is
 * unavailable. Kept simple: a title bar with a close button.
 */
function buildFallbackPanel(root: HTMLElement): void {
  const header = document.createElement('div');
  header.className = 'st-atlas__panel-header';

  const title = document.createElement('span');
  title.className = 'st-atlas__panel-title';
  title.textContent = 'Atlas';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'st-atlas__panel-close';
  close.setAttribute('aria-label', 'Close Atlas panel');
  close.innerHTML = '<i class="fa-solid fa-xmark"></i>';

  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'st-atlas__panel-body';
  body.textContent = 'Atlas is ready. Map viewer arrives in a later milestone.';

  root.append(header, body);
}

/** Wires the close button (and any template-provided close control). */
function wirePanelControls(root: HTMLElement): void {
  const close = root.querySelector<HTMLElement>('.st-atlas__panel-close');
  if (close) {
    close.addEventListener('click', () => closeAtlasPanel());
  }
}
