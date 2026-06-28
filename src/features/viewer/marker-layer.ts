/**
 * Marker layer for the Atlas map viewer.
 *
 * Renders `AtlasLocation` entries as Leaflet markers, manages selection,
 * highlights the current location distinctly, and filters out hidden
 * locations that have not been discovered.
 *
 * Layer logic that does not need a live Leaflet instance (filtering,
 * marker data construction, current-location selection) is split into
 * pure helpers so it can be unit-tested under jsdom.
 */

import L from 'leaflet';
import type { AtlasLocation } from '@/domain/location';
import type { AtlasMapDocument } from '@/domain/map';
import { normalizedToLatLng } from './map-viewer';

/** A marker ready to be placed on the Leaflet map. */
export interface MarkerData {
  readonly locationId: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly hidden: boolean;
  readonly current: boolean;
}

/**
 * Builds marker data from a document, marking the current location and
 * filtering out undiscovered hidden locations. Locations with
 * `hiddenUntilDiscovered` are only shown when they appear in the
 * discovered set.
 */
export function buildMarkerData(
  document: AtlasMapDocument,
  currentLocationId: string | null,
  discoveredLocationIds: ReadonlySet<string>,
): MarkerData[] {
  const { width, height } = document.image;
  const result: MarkerData[] = [];
  for (const location of document.locations) {
    const isCurrent = location.id === currentLocationId;
    const isHidden = location.hiddenUntilDiscovered === true;
    const isDiscovered = discoveredLocationIds.has(location.id);
    // Hidden-and-undiscovered locations are never rendered.
    if (isHidden && !isDiscovered && !isCurrent) {
      continue;
    }
    const [lat, lng] = normalizedToLatLng(
      location.coordinates.x,
      location.coordinates.y,
      width,
      height,
    );
    result.push({
      locationId: location.id,
      name: location.name,
      lat,
      lng,
      hidden: isHidden,
      current: isCurrent,
    });
  }
  return result;
}

/**
 * The marker layer. Created once per viewer/editor session and disposed
 * with it. In edit mode the editor enables marker dragging via
 * `setDraggable`.
 */
export class MarkerLayer {
  private readonly markers = new Map<string, L.Marker>();
  private readonly group: L.LayerGroup;
  private readonly map: L.Map;
  private dragHandler: ((id: string, lat: number, lng: number) => void) | null = null;

  constructor(
    map: L.Map,
    // Dimensions are accepted for future re-projection hooks but not
    // stored yet; marker coordinates are already pre-projected by the
    // caller via `buildMarkerData`.
    _dimensions: { width: number; height: number },
    private readonly onSelect: (locationId: string) => void,
  ) {
    this.map = map;
    this.group = L.layerGroup().addTo(map);
  }

  /**
   * Renders the given marker data, replacing any previous markers.
   * The current location uses a distinct icon class. Drag is enabled on
   * every marker iff a drag handler is currently set.
   */
  render(markers: readonly MarkerData[]): void {
    this.clear();
    const draggable = this.dragHandler !== null;
    for (const data of markers) {
      const icon = this.createIcon(data.current, data.hidden);
      const marker = L.marker([data.lat, data.lng], {
        icon,
        title: data.name,
        alt: data.name,
        draggable,
      });
      marker.on('click', () => {
        this.select(data.locationId);
        this.onSelect(data.locationId);
      });
      if (this.dragHandler) {
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          this.dragHandler?.(data.locationId, lat, lng);
        });
      }
      marker.addTo(this.group);
      this.markers.set(data.locationId, marker);
    }
  }

  /**
   * Enables or disables marker dragging. When enabled, the handler is
   * called once per completed drag with the marker id and new lat/lng.
   * Re-renders existing markers so their drag state updates.
   */
  setDraggable(enabled: boolean, handler?: (id: string, lat: number, lng: number) => void): void {
    this.dragHandler = enabled && handler ? handler : null;
    // Re-render to apply the draggable flag to existing markers.
    for (const [id, marker] of this.markers) {
      marker.dragging?.disable();
      if (this.dragHandler) {
        marker.dragging?.enable();
        marker.off('dragend');
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          this.dragHandler?.(id, lat, lng);
        });
      }
    }
  }

  /** Marks a location as selected (visually) without firing onSelect. */
  select(locationId: string): void {
    for (const [id, marker] of this.markers) {
      const element = marker.getElement();
      if (!element) {
        continue;
      }
      element.classList.toggle('st-atlas__marker--selected', id === locationId);
    }
  }

  /** Clears the selected highlight. */
  clearSelection(): void {
    for (const marker of this.markers.values()) {
      marker.getElement()?.classList.remove('st-atlas__marker--selected');
    }
  }

  /** Removes all markers from the layer. */
  clear(): void {
    this.group.clearLayers();
    this.markers.clear();
  }

  /** Centers the map on a marker by location id. */
  focusLocation(locationId: string): void {
    const marker = this.markers.get(locationId);
    if (marker) {
      this.map.panTo(marker.getLatLng());
    }
  }

  /** Disposes the layer. */
  dispose(): void {
    this.clear();
    this.group.remove();
  }

  /**
   * Builds the Leaflet divIcon for a marker. The current location gets
   * an accent ring; hidden-but-shown locations get a dashed outline.
   */
  private createIcon(current: boolean, hidden: boolean): L.DivIcon {
    const classes = ['st-atlas__marker'];
    if (current) {
      classes.push('st-atlas__marker--current');
    }
    if (hidden) {
      classes.push('st-atlas__marker--hidden');
    }
    return L.divIcon({
      className: classes.join(' '),
      html: '<span class="st-atlas__marker-dot" aria-hidden="true"></span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
}

export type { AtlasLocation };
