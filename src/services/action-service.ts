/**
 * Safe declarative action execution service.
 *
 * The service validates permission-sensitive actions before delegating
 * host-specific work to an injected adapter. It never imports host
 * internals directly and never evaluates script content.
 */

import type { AtlasAction } from '@/domain/actions';

export interface ActionServiceSettings {
  readonly allowAdvancedScripts: boolean;
  readonly confirmImportedScripts: boolean;
}

export interface ActionExecutionAdapter {
  readonly confirm: (message: string) => Promise<boolean>;
  readonly setLocation: (locationId: string) => Promise<void>;
  readonly openMap: (mapId: string, locationId?: string) => Promise<void>;
  readonly setBackground: (backgroundName: string) => Promise<void>;
  readonly sendSystemNote: (text: string) => Promise<void>;
  readonly runQuickReply: (setName: string, label: string) => Promise<void>;
  readonly runStscript: (script: string) => Promise<void>;
}

export interface ActionExecutionResult {
  readonly ok: boolean;
  readonly blocked?: boolean;
  readonly message: string;
}

const DEFAULT_SETTINGS: ActionServiceSettings = {
  allowAdvancedScripts: false,
  confirmImportedScripts: true,
};

export class ActionService {
  constructor(
    private readonly adapter: ActionExecutionAdapter,
    private readonly readSettings: () => Partial<ActionServiceSettings> = () => DEFAULT_SETTINGS,
  ) {}

  async execute(action: AtlasAction): Promise<ActionExecutionResult> {
    const settings = { ...DEFAULT_SETTINGS, ...this.readSettings() };
    try {
      switch (action.type) {
        case 'set_location':
          await this.adapter.setLocation(action.locationId);
          return { ok: true, message: `Location set: ${action.locationId}` };
        case 'open_map':
          await this.adapter.openMap(action.mapId, action.locationId);
          return { ok: true, message: `Map opened: ${action.mapId}` };
        case 'set_background':
          await this.adapter.setBackground(action.backgroundName);
          return { ok: true, message: `Background set: ${action.backgroundName}` };
        case 'send_system_note':
          await this.adapter.sendSystemNote(action.text);
          return { ok: true, message: 'System note sent.' };
        case 'run_quick_reply':
          await this.adapter.runQuickReply(action.setName, action.label);
          return { ok: true, message: `Quick Reply executed: ${action.label}` };
        case 'run_stscript':
          return this.executeStscript(action, settings);
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeStscript(
    action: Extract<AtlasAction, { type: 'run_stscript' }>,
    settings: ActionServiceSettings,
  ): Promise<ActionExecutionResult> {
    if (!settings.allowAdvancedScripts) {
      return {
        ok: false,
        blocked: true,
        message: 'Advanced scripts are disabled.',
      };
    }

    const needsConfirmation = action.requiresConfirmation || !action.trusted;
    if (needsConfirmation && settings.confirmImportedScripts) {
      const confirmed = await this.adapter.confirm('Run this advanced Atlas script?');
      if (!confirmed) {
        return { ok: false, blocked: true, message: 'Script action cancelled.' };
      }
    }

    await this.adapter.runStscript(action.script);
    return { ok: true, message: 'Advanced script executed.' };
  }
}
