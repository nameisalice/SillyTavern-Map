/**
 * Map library controller: minimal UI over the library service.
 *
 * Lists saved maps, opens them in the viewer or editor, creates new
 * maps, and deletes with confirmation. No sorting, tags, or advanced
 * search — the priority is exercising the repository layer through real
 * UI. All dynamic strings use `textContent`.
 */

import { getContext } from '@/st/context';
import { logError } from '@/core/logger';
import type { AtlasMapIndexEntry } from '@/domain/map';
import type { MapLibraryService } from '@/services/map-library-service';
import mapLibraryTemplate from '@/templates/map-library.html?raw';

/** Actions the host wires for an opened map. */
export interface LibraryActions {
  readonly openInViewer: (mapId: string) => void;
  readonly openInEditor: (mapId: string) => void;
  readonly createMap: () => void;
  readonly generateMap: () => void;
}

/** A dialog/popup helper injected by the host. */
export type LibraryPopup = (
  content: HTMLElement | string,
  type: 'confirm' | 'text',
) => Promise<number>;

/** Renders the map library inside a host popup. */
export async function openMapLibrary(
  service: MapLibraryService,
  actions: LibraryActions,
  popup: LibraryPopup,
): Promise<void> {
  const html = mapLibraryTemplate.trim();
  const root = document.createElement('div');
  if (html) {
    root.innerHTML = html;
  } else {
    logError('Atlas map library template is empty; using fallback.');
    buildFallback(root);
  }

  const list = root.querySelector<HTMLElement>('[data-st-atlas="library-list"]') ?? root;
  let entries: readonly AtlasMapIndexEntry[] = [];
  try {
    entries = await service.listMaps();
  } catch (error) {
    logError('Failed to list maps.', error);
  }
  renderList(list, entries, service, actions, popup);

  root
    .querySelector<HTMLElement>('[data-st-atlas-library-action="create"]')
    ?.addEventListener('click', () => actions.createMap());
  root
    .querySelector<HTMLElement>('[data-st-atlas-library-action="generate"]')
    ?.addEventListener('click', () => actions.generateMap());

  const context = getContext();
  await context.callGenericPopup(root, context.POPUP_TYPE.TEXT);
}

/** Renders the list of map entries into `container`. */
function renderList(
  container: HTMLElement,
  entries: readonly AtlasMapIndexEntry[],
  service: MapLibraryService,
  actions: LibraryActions,
  popup: LibraryPopup,
): void {
  container.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'st-atlas__library-empty';
    empty.textContent = 'No saved maps yet. Create one to get started.';
    container.append(empty);
    return;
  }
  for (const entry of entries) {
    container.append(buildEntry(entry, service, actions, popup));
  }
}

function buildEntry(
  entry: AtlasMapIndexEntry,
  service: MapLibraryService,
  actions: LibraryActions,
  popup: LibraryPopup,
): HTMLElement {
  const item = document.createElement('li');
  item.className = 'st-atlas__library-entry';

  const name = document.createElement('span');
  name.className = 'st-atlas__library-name';
  name.textContent = entry.name;
  const type = document.createElement('span');
  type.className = 'st-atlas__library-type';
  type.textContent = entry.type;
  item.append(name, type);

  const openViewer = document.createElement('button');
  openViewer.type = 'button';
  openViewer.className = 'st-atlas__library-btn menu_button menu_button_icon';
  openViewer.setAttribute('aria-label', `Open ${entry.name} in viewer`);
  openViewer.innerHTML = '<i class="fa-solid fa-eye"></i><span>View</span>';
  openViewer.addEventListener('click', () => actions.openInViewer(entry.id));

  const openEditor = document.createElement('button');
  openEditor.type = 'button';
  openEditor.className = 'st-atlas__library-btn menu_button menu_button_icon';
  openEditor.setAttribute('aria-label', `Open ${entry.name} in editor`);
  openEditor.innerHTML = '<i class="fa-solid fa-pen"></i><span>Edit</span>';
  openEditor.addEventListener('click', () => actions.openInEditor(entry.id));

  const del = document.createElement('button');
  del.type = 'button';
  del.className =
    'st-atlas__library-btn st-atlas__library-btn--danger menu_button menu_button_icon';
  del.setAttribute('aria-label', `Delete ${entry.name}`);
  del.innerHTML = '<i class="fa-solid fa-trash"></i>';
  del.addEventListener('click', async () => {
    const choice = await popup(`Delete "${entry.name}"? This cannot be undone.`, 'confirm');
    if (choice !== 1) {
      return;
    }
    try {
      await service.deleteMap(entry.id);
      item.remove();
    } catch (error) {
      logError('Failed to delete map.', error);
      await popup(
        `Could not delete the map: ${error instanceof Error ? error.message : String(error)}`,
        'text',
      );
    }
  });

  item.append(openViewer, openEditor, del);
  return item;
}

/** Fallback library markup when the template cannot be rendered. */
function buildFallback(root: HTMLElement): void {
  const header = document.createElement('div');
  header.className = 'st-atlas__library-header';
  const title = document.createElement('b');
  title.textContent = 'Atlas Map Library';
  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'st-atlas__library-btn menu_button menu_button_icon';
  create.setAttribute('data-st-atlas-library-action', 'create');
  create.innerHTML = '<i class="fa-solid fa-plus"></i><span>Create Map</span>';
  const generate = document.createElement('button');
  generate.type = 'button';
  generate.className = 'st-atlas__library-btn menu_button menu_button_icon';
  generate.setAttribute('data-st-atlas-library-action', 'generate');
  generate.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate Map</span>';
  header.append(title, create, generate);

  const list = document.createElement('ul');
  list.className = 'st-atlas__library-list';
  list.setAttribute('data-st-atlas', 'library-list');

  root.append(header, list);
}
