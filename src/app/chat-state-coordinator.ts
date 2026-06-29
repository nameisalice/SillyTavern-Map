/**
 * ChatStateCoordinator: coordinates chat state switches and deletes.
 *
 * Listens to SillyTavern events (app_ready, chat_id_changed, chat_created,
 * chat_deleted) and delegates to `TravelService` to reconcile, firing
 * Atlas EventBus refresh events. Focuses entirely on event mapping so
 * TravelService stays focused on state changes.
 */

import type { TravelService } from '@/services/travel-service.types';
import { tryGetContext } from '@/st/context';
import { logInfo } from '@/core/logger';
import type { EventBus } from '@/core/events';
import { loadChatMetadataState } from '@/st/chat-state-bridge';

export class ChatStateCoordinator {
  constructor(
    private readonly travelService: TravelService,
    private readonly eventBus: EventBus,
  ) {}

  /** Wires up host event listeners on bootstrap. */
  initialize(): void {
    const context = tryGetContext();
    if (!context) {
      return;
    }
    const { eventSource, eventTypes } = context;

    eventSource.on(eventTypes.APP_READY, () => void this.onHostChatSwitch('app_ready'));
    eventSource.on(eventTypes.CHAT_CHANGED, () => void this.onHostChatSwitch('chat_changed'));
    eventSource.on(eventTypes.CHAT_CREATED, () => void this.onHostChatSwitch('chat_created'));
    eventSource.on(eventTypes.CHAT_DELETED, () => void this.onHostChatDelete());
  }

  private async onHostChatSwitch(trigger: string): Promise<void> {
    logInfo(`Chat switch triggered by host: ${trigger}.`);
    await this.travelService.reconcileActiveChatState();
    const state = await this.travelService.loadChatState();
    this.eventBus.emit('ChatAtlasStateLoaded', { chatState: state });
  }

  private async onHostChatDelete(): Promise<void> {
    logInfo('Active chat deleted; resetting in-memory references.');
    this.eventBus.emit('ChatAtlasStateLoaded', { chatState: loadChatMetadataState() });
  }
}
