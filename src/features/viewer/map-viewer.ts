/**
 * Leaflet adapter for the Atlas map viewer.
 *
 * Owns a single `L.Map` instance with `CRS.Simple` so the map image is
 * treated as a flat coordinate plane rather than a geographic projection.
 * Normalized document coordinates in the [0, 100] range are mapped into
 * the image's pixel space.
 *
 * The adapter knows nothing about markers, popups, or UI chrome — those
 * live in sibling modules. It only manages the map surface: image
 * overlay, pan, zoom, and disposal.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AtlasMapDocument, MapImageMimeType } from '@/domain/map';
import { logError } from '@/core/logger';

/**
 * The normalized coordinate range used by map documents ([0, 100]).
 * The viewer maps this onto the image pixel extent.
 */
const NORMALIZED_MAX = 100;

/** A MIME type resolvable as an image URL by the browser. */
type ResolvableMimeType = Extract<
  MapImageMimeType,
  'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml'
>;

/**
 * Resolves the background image URL for a document. Bundled documents
 * carry a `url`; stored documents (Milestone 2+) will resolve `assetId`
 * via the asset store. For now only `url` is supported.
 */
function resolveImageUrl(document: AtlasMapDocument): string {
  const { image } = document;
  if (image.url) {
    return image.url;
  }
  // assetId-backed resolution arrives with storage in Milestone 2.
  throw new Error(
    `Map "${document.id}" has no resolvable image URL; asset-store-backed images are not supported until Milestone 2.`,
  );
}

/**
 * Maps a normalized [0, 100] coordinate to an unprojected lat/lng pair
 * inside the image extent. Leaflet's `CRS.Simple` uses y-down semantics
 * for image maps, so we invert y to keep document y growing downward
 * (north = small y) consistent with the image.
 */
export function normalizedToLatLng(
  x: number,
  y: number,
  width: number,
  height: number,
): L.LatLngTuple {
  const lng = (x / NORMALIZED_MAX) * width;
  const lat = height - (y / NORMALIZED_MAX) * height;
  return [lat, lng];
}

/** The Leaflet-backed map viewer. */
export class MapViewer {
  private map: L.Map | null = null;
  private imageOverlay: L.ImageOverlay | null = null;
  private readonly container: HTMLElement;
  private readonly document: AtlasMapDocument;
  private readonly width: number;
  private readonly height: number;

  constructor(container: HTMLElement, document: AtlasMapDocument) {
    this.container = container;
    this.document = document;
    this.width = document.image.width;
    this.height = document.image.height;
  }

  /**
   * Initializes the Leaflet map and image overlay. Must be called once
   * before any other method. Safe to call after `dispose` only on a new
   * instance.
   */
  init(): void {
    if (this.map) {
      return;
    }

    const bounds = this.bounds();
    const map = L.map(this.container, {
      crs: L.CRS.Simple,
      minZoom: this.document.view.minZoom,
      maxZoom: this.document.view.maxZoom,
      zoom: this.document.view.initialZoom,
      center: normalizedToLatLng(
        this.document.view.initialCenter[0],
        this.document.view.initialCenter[1],
        this.width,
        this.height,
      ),
      zoomControl: false,
      attributionControl: false,
      maxBounds: bounds.pad(0.2),
      maxBoundsViscosity: 0.8,
    });

    let imageUrl: string;
    try {
      imageUrl = resolveImageUrl(this.document);
    } catch (error) {
      logError('Failed to resolve map background image.', error);
      this.map = map;
      return;
    }

    this.imageOverlay = L.imageOverlay(imageUrl, bounds, {
      crossOrigin: true,
    });
    this.imageOverlay.addTo(map);

    this.map = map;
  }

  /** The pixel-space bounds of the image: [[0, 0], [height, width]]. */
  private bounds(): L.LatLngBounds {
    return L.latLngBounds([0, 0] as L.LatLngTuple, [this.height, this.width] as L.LatLngTuple);
  }

  /** Recomputes the map size. Call after the container is shown/resized. */
  invalidateSize(): void {
    this.map?.invalidateSize();
  }

  /** Fits the image to the viewport with padding. */
  fitToViewport(): void {
    if (!this.map) {
      return;
    }
    this.map.fitBounds(this.bounds(), { padding: [16, 16] });
  }

  /** Centers on a normalized [x, y] coordinate at the current zoom. */
  centerOnNormalized(x: number, y: number): void {
    if (!this.map) {
      return;
    }
    this.map.panTo(normalizedToLatLng(x, y, this.width, this.height));
  }

  /** Zooms in by one step. */
  zoomIn(): void {
    this.map?.zoomIn();
  }

  /** Zooms out by one step. */
  zoomOut(): void {
    this.map?.zoomOut();
  }

  /**
   * Returns the underlying Leaflet map so layer modules can add
   * markers/polygons. `null` before `init` or after `dispose`.
   */
  getLeafletMap(): L.Map | null {
    return this.map;
  }

  /** Returns the document pixel dimensions for coordinate mapping. */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Destroys the Leaflet instance and releases listeners. The container
   * is left in the DOM but emptied. Must be called when the panel is
   * destroyed to avoid listener leaks (plan §17).
   */
  dispose(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.imageOverlay = null;
    }
  }
}

export type { ResolvableMimeType };
