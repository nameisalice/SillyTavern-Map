/**
 * Controlled model-driven automation service.
 *
 * Validates exact structured commands and function-tool style requests
 * against the active map before changing chat state.
 */

import type { MapRepository } from '@/repositories';
import type { TravelService } from './travel-service.types';
import type { AtlasStructuredCommand } from './structured-location-parser';

export interface AutomationResult {
  readonly ok: boolean;
  readonly message: string;
}

export class AtlasAutomationService {
  constructor(
    private readonly maps: MapRepository,
    private readonly travel: TravelService,
  ) {}

  async execute(command: AtlasStructuredCommand): Promise<AutomationResult> {
    switch (command.type) {
      case 'travel':
        return this.moveToLocation(command.locationId);
      case 'reveal':
        return this.revealLocation(command.locationId);
      case 'hide':
        return this.hideLocation(command.locationId);
    }
  }

  async moveToLocation(locationId: string, force = false): Promise<AutomationResult> {
    const map = await this.activeMap();
    if (!map.locations.some((location) => location.id === locationId)) {
      return { ok: false, message: `Unknown location id "${locationId}".` };
    }
    const result = await this.travel.travelTo(locationId, 'tool', force);
    if (!result.success) {
      if (result.requiresOverride) {
        return { ok: false, message: 'Route validation failed.' };
      }
      return { ok: false, message: result.error ?? 'Travel failed.' };
    }
    return { ok: true, message: `Moved to location "${locationId}".` };
  }

  async revealLocation(locationId: string): Promise<AutomationResult> {
    const map = await this.activeMap();
    if (!map.locations.some((location) => location.id === locationId)) {
      return { ok: false, message: `Unknown location id "${locationId}".` };
    }
    await this.travel.discoverLocation(locationId);
    return { ok: true, message: `Location revealed: ${locationId}` };
  }

  async hideLocation(locationId: string): Promise<AutomationResult> {
    const state = await this.travel.loadChatState();
    const map = await this.activeMap();
    if (!map.locations.some((location) => location.id === locationId)) {
      return { ok: false, message: `Unknown location id "${locationId}".` };
    }
    const updated = {
      ...state,
      discoveredLocationIds: state.discoveredLocationIds.filter((id) => id !== locationId),
    };
    if (updated.discoveredLocationIds.length === state.discoveredLocationIds.length) {
      return { ok: true, message: `Location already hidden: ${locationId}` };
    }
    await this.travel.hideLocation(locationId);
    return { ok: true, message: `Location hidden: ${locationId}` };
  }

  private async activeMap() {
    const mapId = this.travel.getActiveMapId();
    if (!mapId) {
      throw new Error('No active map set.');
    }
    const map = await this.maps.load(mapId);
    if (!map) {
      throw new Error(`Active map "${mapId}" was not found.`);
    }
    return map;
  }
}
