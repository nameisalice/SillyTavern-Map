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

    // M7: Active hierarchy stack tracing
    const hierarchy: string[] = [];
    let curr = map;
    const visited = new Set<string>([map.id]);
    while (curr.parentMapId && !visited.has(curr.parentMapId)) {
      const parentId = curr.parentMapId;
      visited.add(parentId);
      const parent = await this.maps.load(parentId);
      if (!parent) {
        break;
      }
      hierarchy.push(parent.name);
      curr = parent;
    }
    hierarchy.reverse();

    const hierarchyLine =
      hierarchy.length > 0
        ? `Map hierarchy: ${hierarchy.map((n) => escapeText(n)).join(' > ')} > ${escapeText(
            map.name,
          )}`
        : undefined;

    // M7: Discovered region containment check
    let regionLine: string | undefined;
    if (map.regions && map.regions.length > 0) {
      const discoveredRegions = new Set(chatState.discoveredRegionIds);
      const insideRegion = map.regions.find(
        (r) =>
          discoveredRegions.has(r.id) &&
          isPointInPolygon(location.coordinates.x, location.coordinates.y, r.polygon),
      );
      if (insideRegion) {
        regionLine = `Region: ${escapeText(insideRegion.name)}`;
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
      const prompt = assemblePrompt({
        heading,
        mapLine,
        locLine,
        reachable: finalReachable,
        travelLine,
        descLine,
        parentLine,
        hierarchyLine,
        regionLine,
      });
      if (prompt.length <= limit) {
        return prompt;
      }
      finalReachable.pop(); // Drop one reachable line to fit budget
    }

    // Try showing bare layout first
    let prompt = assemblePrompt({
      heading,
      mapLine,
      locLine,
      reachable: [],
      travelLine,
      descLine,
      parentLine,
      hierarchyLine,
      regionLine,
    });
    if (prompt.length <= limit) {
      return prompt;
    }

    // Prefer truncating description with a clear ellipsis first
    if (location.description && descLine) {
      const overhead = assemblePrompt({
        heading,
        mapLine,
        locLine,
        reachable: [],
        travelLine,
        descLine: 'Location description: ',
        parentLine,
        hierarchyLine,
        regionLine,
      }).length;
      const remaining = limit - overhead;
      if (remaining > 15) {
        const truncatedDesc =
          Array.from(location.description)
            .slice(0, Math.max(0, remaining - 3))
            .join('') + '...';
        const truncatedDescLine = `Location description: ${escapeText(truncatedDesc)}`;
        prompt = assemblePrompt({
          heading,
          mapLine,
          locLine,
          reachable: [],
          travelLine,
          descLine: truncatedDescLine,
          parentLine,
          hierarchyLine,
          regionLine,
        });
        if (prompt.length <= limit) {
          return prompt;
        }
      }
    }

    // Try without description
    prompt = assemblePrompt({
      heading,
      mapLine,
      locLine,
      reachable: [],
      travelLine,
      parentLine,
      hierarchyLine,
      regionLine,
    });
    if (prompt.length <= limit) {
      return prompt;
    }

    // Try without region line
    prompt = assemblePrompt({
      heading,
      mapLine,
      locLine,
      reachable: [],
      travelLine,
      parentLine,
      hierarchyLine,
    });
    if (prompt.length <= limit) {
      return prompt;
    }

    // Try without parent line and hierarchy line
    prompt = assemblePrompt({
      heading,
      mapLine,
      locLine,
      reachable: [],
      travelLine,
    });
    if (prompt.length <= limit) {
      return prompt;
    }

    // Last resort: line-safe and Unicode-safe hard truncation
    logWarn('Compiled spatial context exceeds size limit; truncating line-safely.');
    const lines = prompt.split('\n');
    const safeLines: string[] = [];
    let currentLength = 0;

    for (const line of lines) {
      const lineChars = Array.from(line).length;
      const addedLen = lineChars + (safeLines.length > 0 ? 1 : 0);
      if (currentLength + addedLen <= limit) {
        safeLines.push(line);
        currentLength += addedLen;
      } else {
        if (safeLines.length === 0) {
          // Unreasonably small limit: do a Unicode-safe crop of the first line
          const truncatedLine =
            Array.from(line)
              .slice(0, Math.max(0, limit - 3))
              .join('') + '...';
          safeLines.push(truncatedLine);
        }
        break;
      }
    }
    return safeLines.join('\n');
  }
}

/** Escapes newlines inside map texts to protect context layout. */
function escapeText(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

/** Helper to join non-empty segments with double-newlines. */
function assemblePrompt(args: {
  heading: string;
  mapLine: string;
  locLine: string;
  reachable: readonly string[];
  travelLine: string;
  descLine?: string;
  parentLine?: string;
  hierarchyLine?: string;
  regionLine?: string;
}): string {
  const segments: string[] = [args.heading, args.mapLine, args.locLine];
  if (args.parentLine) {
    segments.push(args.parentLine);
  }
  if (args.hierarchyLine) {
    segments.push(args.hierarchyLine);
  }
  if (args.regionLine) {
    segments.push(args.regionLine);
  }
  if (args.descLine) {
    segments.push(args.descLine);
  }
  if (args.reachable.length > 0) {
    segments.push(`Nearby known locations:\n${args.reachable.join('\n')}`);
  }
  segments.push(args.travelLine);
  return segments.join('\n\n');
}

/**
 * Pure helper for polygonal containment check: ray-casting algorithm.
 * Normalized coordinates are compared.
 */
export function isPointInPolygon(
  x: number,
  y: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
