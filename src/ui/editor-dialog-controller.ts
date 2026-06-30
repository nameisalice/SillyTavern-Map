/**
 * Editor dialog controller: hosts the visual editor inside a host popup.
 *
 * Owns the editor DOM, wires the toolbar buttons from the template to
 * the `EditorController`, and manages unsaved-change protection
 * (beforeunload + exit guard). All host interaction is injected.
 */

import { getContext } from '@/st/context';
import { logError } from '@/core/logger';
import type { AtlasMapDocument } from '@/domain/map';
import { EditorController, type EditorPopup, type EditorSubMode } from '@/features/editor';
import type { MapDraftService } from '@/services/map-draft-service';
import type { ViewerService } from '@/services/viewer-service.types';
import type { EventBus } from '@/core/events';
import editorTemplate from '@/templates/editor.html?raw';

/** A popup helper that mirrors the host confirm/text contract. */
const popup: EditorPopup = async (content, type) => {
  const context = getContext();
  const popupType = type === 'confirm' ? context.POPUP_TYPE.CONFIRM : context.POPUP_TYPE.TEXT;
  return (await context.callGenericPopup(content, popupType)) as number;
};

interface PopupInstance {
  complete(result: number): void;
}

/** Opens the editor for a map document inside a host popup. */
export async function openEditor(args: {
  document: AtlasMapDocument;
  imageUrlOverride?: string;
  draftService: MapDraftService;
  viewerService: ViewerService;
  eventBus: EventBus;
  onSaved: (document: AtlasMapDocument) => void;
}): Promise<void> {
  const html = editorTemplate.trim();
  const root = document.createElement('div');
  if (html) {
    root.innerHTML = html;
  } else {
    logError('Atlas editor template is empty; using fallback.');
    buildFallback(root);
  }

  const canvas = root.querySelector<HTMLElement>('[data-st-atlas="editor-canvas"]');
  const propertyHost = root.querySelector<HTMLElement>('[data-st-atlas="editor-properties"]');
  if (!canvas || !propertyHost) {
    await popup('The editor could not be initialized.', 'text');
    return;
  }

  let allowedClose = false;
  let activePopup: PopupInstance | null = null;

  const controller = new EditorController({
    container: canvas,
    propertyHost,
    document: args.document,
    imageUrlOverride: args.imageUrlOverride,
    eventBus: args.eventBus,
    bindToolbar: (commands) => wireToolbar(root, commands),
    popup,
    draftService: args.draftService,
    onSaved: args.onSaved,
    onExit: () => {
      allowedClose = true;
      if (activePopup) {
        activePopup.complete(0);
      }
    },
  });

  // beforeunload guard: only while the editor is open and dirty.
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (controller.isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);

  const context = getContext();
  try {
    controller.open();
    // Host callGenericPopup setup with onClosing callback to intercept popup closing
    await context.callGenericPopup(root, context.POPUP_TYPE.TEXT, '', {
      onClosing: (popupInstance: PopupInstance) => {
        activePopup = popupInstance;
        if (allowedClose) {
          return true;
        }
        void controller.exit();
        return false;
      },
    });
  } finally {
    // Popup closed by the host: ensure the editor is disposed and the
    // guard removed.
    controller.dispose();
    window.removeEventListener('beforeunload', beforeUnload);
  }
}

/** Wires toolbar buttons by `data-st-atlas-editor-action`. */
function wireToolbar(
  root: HTMLElement,
  commands: {
    onAddLocation: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onTogglePreview: () => void;
    onExit: () => void;
    onChangeSubMode: (subMode: EditorSubMode) => void;
  },
): void {
  const buttons = root.querySelectorAll<HTMLElement>('[data-st-atlas-editor-action]');
  for (const btn of buttons) {
    const action = btn.getAttribute('data-st-atlas-editor-action');
    const handler = toolbarHandler(action, commands, buttons, root);
    if (handler) {
      btn.addEventListener('click', handler);
    }
  }
}

function toolbarHandler(
  action: string | null,
  commands: {
    onAddLocation: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onTogglePreview: () => void;
    onExit: () => void;
    onChangeSubMode: (subMode: EditorSubMode) => void;
  },
  buttons: NodeListOf<HTMLElement>,
  root: HTMLElement,
): (() => void) | null {
  if (action && action.startsWith('mode-')) {
    const subMode = action.replace('mode-', '');
    if (!isEditorSubMode(subMode)) {
      return null;
    }
    return () => {
      // Toggle active visual class on mode group buttons
      for (const btn of buttons) {
        const btnAction = btn.getAttribute('data-st-atlas-editor-action');
        if (btnAction && btnAction.startsWith('mode-')) {
          btn.classList.toggle('st-atlas__editor-btn--active-mode', btnAction === action);
        }
      }
      // Re-label mode display text
      const modeText = root.querySelector<HTMLElement>('[data-st-atlas="editor-mode"]');
      if (modeText) {
        const capitalSub = subMode.charAt(0).toUpperCase() + subMode.slice(1);
        modeText.textContent = `Edit (${capitalSub}s)`;
      }
      commands.onChangeSubMode(subMode);
    };
  }

  switch (action) {
    case 'add':
      return () => commands.onAddLocation();
    case 'undo':
      return () => commands.onUndo();
    case 'redo':
      return () => commands.onRedo();
    case 'save':
      return () => commands.onSave();
    case 'preview':
      return () => {
        // Toggle preview labels
        const modeText = root.querySelector<HTMLElement>('[data-st-atlas="editor-mode"]');
        if (modeText) {
          const isPreview = modeText.getAttribute('data-mode') === 'preview';
          modeText.setAttribute('data-mode', isPreview ? 'edit' : 'preview');
          modeText.textContent = isPreview ? 'Edit (Markers)' : 'Preview Mode';
        }
        commands.onTogglePreview();
      };
    case 'exit':
      return () => commands.onExit();
    default:
      return null;
  }
}

function isEditorSubMode(value: string): value is EditorSubMode {
  return value === 'marker' || value === 'region' || value === 'route';
}

/** Fallback editor markup when the template cannot be rendered. */
function buildFallback(root: HTMLElement): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'st-atlas__editor-toolbar';
  for (const [action, icon, label] of [
    ['add', 'fa-location-dot', 'Add'],
    ['undo', 'fa-rotate-left', ''],
    ['redo', 'fa-rotate-right', ''],
    ['preview', 'fa-eye', 'Preview'],
    ['save', 'fa-floppy-disk', 'Save'],
    ['exit', 'fa-xmark', 'Exit'],
  ] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'st-atlas__editor-btn menu_button menu_button_icon';
    btn.setAttribute('data-st-atlas-editor-action', action);
    btn.innerHTML = `<i class="fa-solid ${icon}"></i>${label ? `<span>${label}</span>` : ''}`;
    toolbar.append(btn);
  }

  const body = document.createElement('div');
  body.className = 'st-atlas__editor-body';
  const canvas = document.createElement('div');
  canvas.className = 'st-atlas__canvas st-atlas__canvas--editor';
  canvas.setAttribute('data-st-atlas', 'editor-canvas');
  const properties = document.createElement('div');
  properties.className = 'st-atlas__property-panel';
  properties.setAttribute('data-st-atlas', 'editor-properties');
  body.append(canvas, properties);

  root.append(toolbar, body);
}
