/**
 * RouteLayer: renders routes (paths) between locations.
 *
 * Support straight lines or custom path coordinates. Styles locked,
 * dangerous, and unidirectional routes distinctly.
 */

import L from 'leaflet';
import type { AtlasRoute } from '@/domain/route';
import type { AtlasLocation } from '@/domain/location';
import { normalizedToLatLng } from './map-viewer';

export class RouteLayer {
  private readonly lines = new Map<string, L.Polyline>();
  private readonly group: L.LayerGroup;
  private readonly map: L.Map;

  constructor(
    map: L.Map,
    private readonly dimensions: { width: number; height: number },
    private readonly onSelect: (routeId: string) => void,
  ) {
    this.map = map;
    this.group = L.layerGroup().addTo(map);
  }

  /** Toggles layer group visibility in the Leaflet map. */
  setVisible(visible: boolean): void {
    if (visible) {
      this.group.addTo(this.map);
    } else {
      this.group.remove();
    }
  }

  /** Renders routes, matching their endpoints. */
  render(routes: readonly AtlasRoute[], locations: readonly AtlasLocation[]): void {
    this.clear();
    const { width, height } = this.dimensions;
    const locMap = new Map(locations.map((loc) => [loc.id, loc]));

    for (const route of routes) {
      const fromLoc = locMap.get(route.fromLocationId);
      const toLoc = locMap.get(route.toLocationId);
      if (!fromLoc || !toLoc) {
        continue; // Skip invalid endpoints (will block editor save but keep viewer safe)
      }

      // Gather path vertices
      const path: L.LatLngTuple[] = [];
      path.push(
        normalizedToLatLng(fromLoc.coordinates.x, fromLoc.coordinates.y, width, height),
      );

      if (route.points && route.points.length > 0) {
        for (const [px, py] of route.points) {
          path.push(normalizedToLatLng(px, py, width, height));
        }
      }

      path.push(normalizedToLatLng(toLoc.coordinates.x, toLoc.coordinates.y, width, height));

      // Style determination
      let color = '#7f8c8d'; // neutral gray
      let dashArray: string | undefined;
      const weight = 3;

      if (route.dangerLevel && route.dangerLevel >= 4) {
        color = '#d35400'; // dangerous orange/red
      }
      if (route.locked) {
        color = '#c0392b'; // locked red
        dashArray = '6, 6';
      } else if (!route.bidirectional) {
        dashArray = '2, 5'; // unidirectional dots
      }

      const line = L.polyline(path, {
        color,
        weight,
        dashArray,
        opacity: 0.7,
        className: 'st-atlas__route',
      });

      line.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        this.select(route.id);
        this.onSelect(route.id);
      });

      line.addTo(this.group);
      this.lines.set(route.id, line);
    }
  }

  select(routeId: string): void {
    for (const [id, line] of this.lines) {
      if (id === routeId) {
        line.setStyle({ weight: 5, opacity: 1.0 });
      } else {
        const opts = line.options;
        line.setStyle({
          weight: 3,
          opacity: opts.opacity ?? 0.7,
        });
      }
    }
  }

  clearSelection(): void {
    for (const line of this.lines.values()) {
      line.setStyle({ weight: 3, opacity: line.options.opacity ?? 0.7 });
    }
  }

  clear(): void {
    this.group.clearLayers();
    this.lines.clear();
  }

  dispose(): void {
    this.clear();
    this.group.remove();
  }
}
