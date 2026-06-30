/**
 * Host adapter for safe Atlas actions.
 *
 * Local map actions are implemented through Atlas services. Host-side
 * actions use the public SillyTavern context when available and fail
 * closed with a clear error otherwise.
 */

import type { ActionExecutionAdapter } from '@/services/action-service';
import type { TravelService } from '@/services/travel-service.types';
import type { ViewerService } from '@/services/viewer-service.types';
import { getContext } from '@/st/context';

interface CommandContext extends SillyTavernContext {
  readonly executeSlashCommandsWithOptions?: (input: string) => Promise<unknown>;
}

export function createActionExecutionAdapter(
  travel: TravelService,
  viewer: ViewerService,
): ActionExecutionAdapter {
  return {
    confirm: async (message) => {
      const context = getContext();
      const result = (await context.callGenericPopup(message, context.POPUP_TYPE.CONFIRM)) as number;
      return result === 1;
    },
    setLocation: async (locationId) => {
      const result = await travel.travelTo(locationId, 'click', true);
      if (!result.success) {
        throw new Error(result.error ?? `Could not set location "${locationId}".`);
      }
    },
    openMap: async (mapId, locationId) => {
      await travel.setActiveMapId(mapId);
      await viewer.loadMap(mapId);
      if (locationId) {
        const result = await travel.travelTo(locationId, 'click', true);
        if (!result.success) {
          throw new Error(result.error ?? `Could not set location "${locationId}".`);
        }
      }
    },
    setBackground: async (backgroundName) => {
      await executeHostCommand(`/bg ${quoteSlashArg(backgroundName)}`);
    },
    sendSystemNote: async (text) => {
      await executeHostCommand(`/sys ${quoteSlashArg(text)}`);
    },
    runQuickReply: async (setName, label) => {
      await executeHostCommand(`/qr-set ${quoteSlashArg(setName)} | /qr ${quoteSlashArg(label)}`);
    },
    runStscript: async (script) => {
      await executeHostCommand(script);
    },
  };
}

async function executeHostCommand(command: string): Promise<void> {
  const context = getContext() as CommandContext;
  if (typeof context.executeSlashCommandsWithOptions !== 'function') {
    throw new Error('SillyTavern command execution API is unavailable.');
  }
  await context.executeSlashCommandsWithOptions(command);
}

function quoteSlashArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
