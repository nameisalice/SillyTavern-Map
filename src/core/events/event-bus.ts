/**
 * A lightweight, strongly-typed application EventBus.
 *
 * No external dependency. Each known event type is mapped to a payload
 * shape via the `AtlasEventMap` interface; `emit` and `subscribe` are
 * typed against that map so a typo in an event name or a wrong payload
 * shape is a compile error.
 *
 * Only the infrastructure is provided here. No Atlas events are emitted
 * by this milestone; the `AtlasEventMap` declares the event names that
 * later milestones will use so the typing surface is stable from day one.
 */

/**
 * The canonical map of Atlas application events to their payload shapes.
 *
 * Later milestones will populate these. Declared now so subscribers and
 * emitters share one typed contract. When a milestone adds a real event,
 * it adds the payload type here and starts emitting it; the typing does
 * not change shape, only gains entries.
 */
export interface AtlasEventMap {
  /** Fired when the player's current location changes. */
  LocationChanged: { readonly mapId: string; readonly locationId: string };
  /** Fired when a map is opened in the viewer. */
  MapOpened: { readonly mapId: string };
  /** Fired when the viewer is closed. */
  MapClosed: Record<string, never>;
  /** Fired when travel between locations begins. */
  TravelStarted: {
    readonly fromLocationId: string | null;
    readonly toLocationId: string;
  };
  /** Fired when travel between locations completes. */
  TravelFinished: { readonly toLocationId: string };
  /** Fired when a marker is selected in the viewer. */
  MarkerSelected: { readonly locationId: string };
  /** Fired when a region is selected in the viewer. */
  RegionSelected: { readonly regionId: string };
  /** Fired when AI-assisted map generation begins. */
  GenerationStarted: { readonly presetId: string };
  /** Fired when AI-assisted map generation completes. */
  GenerationFinished: { readonly mapId: string };
}

/** Any event name in the map. */
export type AtlasEventName = keyof AtlasEventMap;

/** Payload for a given event name. */
export type AtlasEventPayload<E extends AtlasEventName> = AtlasEventMap[E];

/** Handler signature for a given event name. */
export type AtlasEventHandler<E extends AtlasEventName> = (payload: AtlasEventPayload<E>) => void;

/**
 * Subscription token returned by `subscribe`. Pass it to `unsubscribe`
 * to remove the handler. Opaque to callers by design — only the bus
 * interprets its contents.
 */
export interface AtlasSubscription {
  /**
   * Internal id used to match a handler for unsubscription. Also records
   * the event name so `unsubscribe` is O(1) instead of scanning.
   */
  readonly eventName: AtlasEventName;
  readonly id: number;
}

/** Internal handler record. */
interface HandlerRecord {
  readonly id: number;
  readonly handler: (payload: unknown) => void;
}

let nextHandlerId = 1;

/**
 * The application EventBus. Construct one instance (the container owns
 * it as a singleton) and pass it to any module that needs to publish or
 * subscribe. Handlers are invoked synchronously on emit.
 */
export class EventBus {
  private readonly handlers = new Map<AtlasEventName, HandlerRecord[]>();

  /**
   * Subscribes a handler to an event. Returns a subscription token.
   * The same handler can be subscribed more than once; each registration
   * is independent and must be removed separately.
   */
  subscribe<E extends AtlasEventName>(
    eventName: E,
    handler: AtlasEventHandler<E>,
  ): AtlasSubscription {
    const record: HandlerRecord = {
      id: nextHandlerId++,
      handler: handler as (payload: unknown) => void,
    };
    const list = this.handlers.get(eventName);
    if (list) {
      list.push(record);
    } else {
      this.handlers.set(eventName, [record]);
    }
    return { eventName, id: record.id };
  }

  /**
   * Removes a previously-registered subscription. No-op if the token
   * does not match a current handler (e.g. already removed).
   */
  unsubscribe(token: AtlasSubscription): void {
    const list = this.handlers.get(token.eventName);
    if (!list) {
      return;
    }
    const idx = list.findIndex((r) => r.id === token.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.handlers.delete(token.eventName);
    }
  }

  /**
   * Emits an event, invoking every subscribed handler synchronously
   * with the payload. Handlers are isolated: a throw from one handler
   * is caught and logged so it cannot break the remaining handlers.
   *
   * `emit` is generic in `E` so the payload is typed against the map.
   */
  emit<E extends AtlasEventName>(eventName: E, payload: AtlasEventPayload<E>): void {
    const list = this.handlers.get(eventName);
    if (!list || list.length === 0) {
      return;
    }
    // Copy the list so a handler that unsubscribes itself does not
    // mutate the iteration.
    const snapshot = list.slice();
    for (const record of snapshot) {
      try {
        record.handler(payload);
      } catch (error) {
        // Swallow but surface in the console; the bus must stay usable.
        // eslint-disable-next-line no-console
        console.error('[SillyTavern Atlas] Event handler threw.', error);
      }
    }
  }

  /** Removes every subscription. Mainly for tests. */
  clear(): void {
    this.handlers.clear();
  }

  /** Returns the number of active subscriptions for an event. */
  listenerCount<E extends AtlasEventName>(eventName: E): number {
    return this.handlers.get(eventName)?.length ?? 0;
  }
}
