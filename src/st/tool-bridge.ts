/**
 * Function tool registration bridge.
 *
 * Uses host function-tool APIs only when present. Unknown or missing APIs
 * fail closed so automation remains optional.
 */

import type { AtlasAutomationService } from '@/services/automation-service';
import { tryGetContext } from '@/st/context';

interface FunctionToolContext extends SillyTavernContext {
  readonly registerFunctionTool?: (tool: Record<string, unknown>) => void;
  readonly unregisterFunctionTool?: (name: string) => void;
}

const TOOL_NAMES = ['atlas_move_to_location', 'atlas_reveal_location'] as const;

export function registerAtlasFunctionTools(automation: AtlasAutomationService): boolean {
  const context = tryGetContext() as FunctionToolContext | null;
  if (!context || typeof context.registerFunctionTool !== 'function') {
    return false;
  }
  context.registerFunctionTool({
    name: 'atlas_move_to_location',
    description:
      'Move the current Atlas party location to an exact location id on the active map. Unknown ids are rejected.',
    parameters: {
      type: 'object',
      properties: {
        locationId: { type: 'string' },
        force: { type: 'boolean' },
      },
      required: ['locationId'],
    },
    action: async (args: { locationId?: string; force?: boolean }) => {
      if (!args.locationId) {
        return { ok: false, message: 'locationId is required.' };
      }
      return automation.moveToLocation(args.locationId, args.force ?? false);
    },
  });
  context.registerFunctionTool({
    name: 'atlas_reveal_location',
    description:
      'Reveal an exact Atlas location id on the active map. Does not return hidden location lists.',
    parameters: {
      type: 'object',
      properties: {
        locationId: { type: 'string' },
      },
      required: ['locationId'],
    },
    action: async (args: { locationId?: string }) => {
      if (!args.locationId) {
        return { ok: false, message: 'locationId is required.' };
      }
      return automation.revealLocation(args.locationId);
    },
  });
  return true;
}

export function unregisterAtlasFunctionTools(): void {
  const context = tryGetContext() as FunctionToolContext | null;
  if (!context || typeof context.unregisterFunctionTool !== 'function') {
    return;
  }
  for (const name of TOOL_NAMES) {
    context.unregisterFunctionTool(name);
  }
}
