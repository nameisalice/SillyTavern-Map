/**
 * RegionLayer: renders polygonal regions on the map.
 *
 * Uses Leaflet's `L.polygon` mapping normalized document coordinates to
 * pixel space. Respects fill color, border color, opacity, and filters out
 * undiscovered hidden regions.
 */

import L from 'leaflet';
import type { AtlasRegion } from '@/domain/region';
import { normalizedToLatLng } from './map-viewer';

export class RegionLayer {
  private readonly polygons = new Map<string, L.Polygon>();
  private readonly group: L.LayerGroup;
  private readonly map: L.Map;

  constructor(
    map: L.Map,
    private readonly dimensions: { width: number; height: number },
    private readonly onSelect: (regionId: string) => void,
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

  /** Renders regions, excluding undiscovered hidden regions. */
  render(regions: readonly AtlasRegion[], discoveredIds: ReadonlySet<string>): void {
    this.clear();
    const { width, height } = this.dimensions;

    for (const region of regions) {
      if (region.hiddenUntilDiscovered && !discoveredIds.has(region.id)) {
        continue;
      }

      // Convert coordinates
      const latLngs = region.polygon.map(([x, y]) =>
        normalizedToLatLng(x, y, width, height),
      );

      const poly = L.polygon(latLngs, {
        fillColor: region.fillColor ?? '#3498db',
        color: region.borderColor ?? '#2980b9',
        weight: 2,
        fillOpacity: region.opacity ?? 0.3,
        opacity: region.opacity ?? 0.8,
        className: 'st-atlas__region',
      });

      poly.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        this.select(region.id);
        this.onSelect(region.id);
      });

      poly.addTo(this.group);
      this.polygons.set(region.id, poly);
    }
  }

  /** Highlights selected region. */
  select(regionId: string): void {
    for (const [id, poly] of this.polygons) {
      if (id === regionId) {
        poly.setStyle({ weight: 4, fillOpacity: 0.5 });
      } else {
        // Reset to original from options
        const opts = poly.options;
        poly.setStyle({
          weight: 2,
          fillOpacity: opts.fillOpacity ?? 0.3,
        });
      }
    }
  }

  /** Clears selection highlight. */
  clearSelection(): void {
    for (const poly of this.polygons.values()) {
      poly.setStyle({ weight: 2, fillOpacity: poly.options.fillOpacity ?? 0.3 });
    }
  }

  clear(): void {
    this.group.clearLayers();
    this.polygons.clear();
  }

  dispose(): void {
    this.clear();
    this.group.remove();
  }
}
