import { describe, expect, it, vi } from 'vitest';
import { ActionService, LegacyImportService } from '@/services';
import { AssetRepository, MapRepository } from '@/repositories';
import { MemoryStorageProvider } from './storage-helpers';

describe('M8 safe action service', () => {
  function adapter() {
    return {
      confirm: vi.fn().mockResolvedValue(true),
      setLocation: vi.fn().mockResolvedValue(undefined),
      openMap: vi.fn().mockResolvedValue(undefined),
      setBackground: vi.fn().mockResolvedValue(undefined),
      sendSystemNote: vi.fn().mockResolvedValue(undefined),
      runQuickReply: vi.fn().mockResolvedValue(undefined),
      runStscript: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('executes declarative local actions through the injected adapter', async () => {
    const calls = adapter();
    const service = new ActionService(calls);

    const result = await service.execute({ type: 'set_location', locationId: 'north-tower' });

    expect(result.ok).toBe(true);
    expect(calls.setLocation).toHaveBeenCalledWith('north-tower');
  });

  it('blocks raw STscript when advanced scripts are disabled', async () => {
    const calls = adapter();
    const service = new ActionService(calls, () => ({
      allowAdvancedScripts: false,
      confirmImportedScripts: true,
    }));

    const result = await service.execute({
      type: 'run_stscript',
      script: '/echo unsafe',
      requiresConfirmation: true,
      trusted: false,
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(calls.runStscript).not.toHaveBeenCalled();
  });

  it('confirms untrusted STscript before execution when enabled', async () => {
    const calls = adapter();
    const service = new ActionService(calls, () => ({
      allowAdvancedScripts: true,
      confirmImportedScripts: true,
    }));

    const result = await service.execute({
      type: 'run_stscript',
      script: '/echo allowed',
      requiresConfirmation: true,
      trusted: false,
    });

    expect(result.ok).toBe(true);
    expect(calls.confirm).toHaveBeenCalledTimes(1);
    expect(calls.runStscript).toHaveBeenCalledWith('/echo allowed');
  });
});

describe('M8 legacy importer', () => {
  it('imports legacy markers and SVG paths without executing scripts', async () => {
    const storage = new MemoryStorageProvider();
    const maps = new MapRepository(storage);
    const assets = new AssetRepository(storage);
    const importer = new LegacyImportService(maps, assets);

    const result = await importer.importLegacy({
      json: JSON.stringify({
        name: 'Old Campaign',
        width: 800,
        height: 600,
        markers: [{ name: 'Start', x: 10, y: 20, script: '/echo marker' }],
        areas: [{ name: 'Old Zone', path: 'M 10 10 L 30 10 L 30 30 Z', stscript: '/echo zone' }],
      }),
      image: new Uint8Array([1, 2, 3, 4]),
      imageMime: 'image/png',
    });

    const map = await maps.load(result.mapId);
    expect(map?.name).toBe('Old Campaign');
    expect(map?.locations[0].actions?.[0]).toMatchObject({
      type: 'run_stscript',
      trusted: false,
    });
    expect(map?.regions[0].polygon).toEqual([
      [10, 10],
      [30, 10],
      [30, 30],
    ]);
    expect(map?.regions[0].actions?.[0]).toMatchObject({
      type: 'run_stscript',
      trusted: false,
    });
    expect(result.scriptActionCount).toBe(1);
    expect(await assets.exists('old-campaign-background')).toBe(true);
  });
});
