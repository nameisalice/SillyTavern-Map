/**
 * Barrel for shared event types.
 *
 * The canonical event map lives in `@/core/events` (alongside the
 * EventBus). It is re-exported here so consumers that prefer to import
 * from `@/types` have a single types entry point.
 */

export type {
  AtlasEventHandler,
  AtlasEventMap,
  AtlasEventName,
  AtlasEventPayload,
  AtlasSubscription,
} from '@/core/events';
