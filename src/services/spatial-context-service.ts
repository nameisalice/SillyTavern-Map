/**
 * SpatialContextService implementation.
 *
 * Compiles a concise spatial context block from the active chat state
 * (active map, current location, discoveries, routes) and injects it
 * into SillyTavern using `injectSpatialPrompt`. Clears the prompt if
 * disabled or invalid.
 */

import type { SpatialContextService } from './spatial-context-service.types';
import type { MapRepository } from '@/repositories';
import type { TravelService } from './travel-service.types';
import { loadSettings } from '@/st/settings-bridge';
import { injectSpatialPrompt, clearSpatialPrompt } from '@/st/prompt-bridge';
import { logError, logWarn } from '@/core/logger';

const CHARS_PER_TOKEN = 5;

export class AtlasSpatialContextService implements SpatialContextService {
  constructor(
    private readonly maps: MapRepository,
    private readonly travel: TravelService,
  ) {}

  async rebuildContext(): Promise<void> {
    try {
      const settings = loadSettings();
      if (!settings.enabled || !settings.promptInjectionEnabled) {
        clearSpatialPrompt();
        return;
      }

      const promptText = await this.compilePromptText();
      if (!promptText) {
        clearSpatialPrompt();
        return;
      }

      // Inject the prompt using settings position/depth
      injectSpatialPrompt({
        text: promptText,
        position: settings.promptPosition,
        depth: settings.promptDepth,
        scanWI: false,
        role: 0, // SYSTEM role (0) is safe default
      });
    } catch (error) {
      logError('Failed to rebuild spatial prompt context.', error);
      clearSpatialPrompt(); // Ensure stale content is cleared on failure
    }
  }

  async previewContext(): Promise<string> {
    try {
      const settings = loadSettings();
      if (!settings.enabled || !settings.promptInjectionEnabled) {
        return '';
      }
      return (await this.compilePromptText()) ?? '';
    } catch {
      return '';
    }
  }

  /** Compiles prompt segments and enforces the budget limits. */
  private async compilePromptText(): Promise<string | null> {
    const chatState = await this.travel.loadChatState();
    const mapId = chatState.activeMapId;
    const locationId = chatState.activeLocationId;

    if (!mapId || !locationId) {
      return null;
    }

    const map = await this.maps.load(mapId);
    if (!map) {
      return null;
    }

    const location = map.locations.find((l) => l.id === locationId);
    if (!location) {
      return null;
    }

    const heading = '[Atlas Spatial Context]';
    const mapLine = `Map: ${escapeText(map.name)} (${map.type})`;
    const locLine = `Current location: ${escapeText(location.name)}`;

    const descLine = location.description
      ? `Location description: ${escapeText(location.description)}`
      : undefined;

    let parentLine: string | undefined;
    if (map.parentMapId) {
      const parentMap = await this.maps.load(map.parentMapId);
      if (parentMap) {
        parentLine = `Parent region: ${escapeText(parentMap.name)}`;
      }
    }

    const travelLine = `Travel continuity: Characters are currently inside the ${escapeText(
      location.name,
    )}. A scene at another destination requires explicit travel or a justified transition.`;

    const settings = loadSettings();
    const discoveredIds = new Set(chatState.discoveredLocationIds);
    const reachableLines: string[] = [];

    if (map.routes && map.routes.length > 0) {
      const connected = map.routes.filter(
        (r) =>
          r.fromLocationId === location.id || (r.bidirectional && r.toLocationId === location.id),
      );

      for (const route of connected) {
        const destId =
          route.fromLocationId === location.id ? route.toLocationId : route.fromLocationId;
        const dest = map.locations.find((l) => l.id === destId);
        // Skip hidden undiscovered locations
        if (!dest || (dest.hiddenUntilDiscovered && !discoveredIds.has(destId))) {
          continue;
        }

        let routeDetails = '';
        if (settings.includeDistances) {
          if (typeof route.distance === 'number') {
            routeDetails += ` — ${route.distance} ${route.distanceUnit ?? 'km'}`;
          }
          if (typeof route.travelTime === 'number') {
            routeDetails += ` (${route.travelTime} ${route.travelTimeUnit ?? 'hour'})`;
          }
        }
        if (settings.includeDangerInfo && typeof route.dangerLevel === 'number') {
          routeDetails += `; danger level ${route.dangerLevel}/5`;
        }
        if (settings.includeRouteRestrictions) {
          if (route.locked) {
            routeDetails += '; restricted: locked';
          }
          if (route.requirements && route.requirements.length > 0) {
            routeDetails += `; requires: ${route.requirements.join(', ')}`;
          }
        }

        routeDetails += '; reachable';
        reachableLines.push(`- ${escapeText(dest.name)}${routeDetails}`);
      }
    }

    // Limit nearby locations by settings limit
    const activeReachable = reachableLines.slice(0, settings.maxNearbyLocations);

    // Enforce character budget limit
    const limit = settings.contextSizeLimit * CHARS_PER_TOKEN;
    const finalReachable = [...activeReachable];

    while (finalReachable.length > 0) {
      const prompt = assemblePrompt(
        heading,
        mapLine,
        locLine,
        finalReachable,
        travelLine,
        descLine,
        parentLine,
      );
      if (prompt.length <= limit) {
        return prompt;
      }
      finalReachable.pop(); // Drop one reachable line to fit budget
    }

    // If still too long, skip description and parent line
    let prompt = assemblePrompt(heading, mapLine, locLine, [], travelLine, undefined, undefined);
    if (prompt.length > limit) {
      logWarn('Compiled spatial context exceeds size limit; truncating text.');
      prompt = prompt.slice(0, limit); // Hard truncation as last resort
    }
    return prompt;
  }
}

/** Escapes newlines inside map texts to protect context layout. */
function escapeText(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

/** Helper to join non-empty segments with double-newlines. */
function assemblePrompt(
  heading: string,
  mapLine: string,
  locLine: string,
  reachable: readonly string[],
  travelLine: string,
  descLine?: string,
  parentLine?: string,
): string {
  const segments: string[] = [heading, mapLine, locLine];
  if (parentLine) {
    segments.push(parentLine);
  }
  if (descLine) {
    segments.push(descLine);
  }
  if (reachable.length > 0) {
    segments.push(`Nearby known locations:\n${reachable.join('\n')}`);
  }
  segments.push(travelLine);
  return segments.join('\n\n');
}
