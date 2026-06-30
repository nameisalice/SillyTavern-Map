import { afterEach, describe, expect, it, vi } from 'vitest';

import * as contextBridge from '@/st/context';

describe('panel controller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('opens from bundled markup without requesting a host template', async () => {
    const renderExtensionTemplateAsync = vi.fn().mockRejectedValue(new Error('404 Not Found'));
    vi.spyOn(contextBridge, 'getContext').mockReturnValue({
      renderExtensionTemplateAsync,
      callGenericPopup: vi.fn(),
      POPUP_TYPE: { TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 },
    } as unknown as SillyTavernContext);

    const { openAtlasPanel } = await import('@/ui/panel-controller');

    openAtlasPanel();

    const panel = document.querySelector<HTMLElement>('[data-st-atlas="panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('st-atlas__panel--open')).toBe(true);
    expect(panel?.querySelector('[data-st-atlas="canvas"]')).not.toBeNull();
    expect(renderExtensionTemplateAsync).not.toHaveBeenCalled();
  });
});
