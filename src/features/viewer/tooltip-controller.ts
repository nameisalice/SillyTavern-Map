/**
 * Tooltip / detail builder for the Atlas map viewer.
 *
 * Builds a concise, safe detail element for a selected location. All
 * user-provided text (location name, description) is rendered with
 * `textContent`, never `innerHTML`, so a malicious map pack cannot
 * inject markup (plan §30 security checklist).
 *
 * This module is pure: it builds DOM but does not call host APIs.
 * Showing the detail (host Popup) is the service layer's job, keeping
 * this feature free of host-adapter imports.
 */

import type { AtlasLocation } from '@/domain/location';

import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';

/** The lines of detail text for a location, in display order. */
export interface LocationDetail {
  readonly title: string;
  readonly lines: readonly string[];
}

/**
 * Builds the plain-text detail for a location. Pure function so it can
 * be unit-tested without the host Popup API.
 */
export function buildLocationDetail(location: AtlasLocation): LocationDetail {
  const lines: string[] = [];
  if (location.description) {
    lines.push(location.description);
  }
  if (typeof location.dangerLevel === 'number' && location.dangerLevel > 0) {
    lines.push(`Danger level: ${location.dangerLevel} / 5`);
  }
  if (location.category) {
    lines.push(`Category: ${location.category}`);
  }
  return { title: location.name, lines };
}

/**
 * Builds a safe DOM fragment for a location detail. Uses `textContent`
 * for all dynamic values to prevent HTML injection.
 */
export function buildLocationDetailElement(
  location: AtlasLocation,
  isCurrent?: boolean,
  onTravelClick?: () => void,
  onChildMapClick?: () => void,
): HTMLElement {
  const { title, lines } = buildLocationDetail(location);
  const root = document.createElement('div');
  root.className = 'st-atlas__location-detail';

  const heading = document.createElement('div');
  heading.className = 'st-atlas__location-detail-title';
  heading.textContent = title;
  root.append(heading);

  for (const line of lines) {
    const p = document.createElement('div');
    p.className = 'st-atlas__location-detail-line';
    p.textContent = line;
    root.append(p);
  }

  const btnContainer = document.createElement('div');
  btnContainer.className = 'st-atlas__location-detail-actions';

  if (onTravelClick && !isCurrent) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'st-atlas__travel-btn menu_button';
    btn.textContent = 'Travel Here';
    btn.addEventListener('click', onTravelClick);
    btnContainer.append(btn);
  }

  if (onChildMapClick && location.childMapId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'st-atlas__child-map-btn menu_button';
    btn.textContent = 'Open Map';
    btn.addEventListener('click', onChildMapClick);
    btnContainer.append(btn);
  }

  if (btnContainer.childNodes.length > 0) {
    root.append(btnContainer);
  }

  return root;
}

/** Builds safe DOM detail block for a region. textContent only. */
export function buildRegionDetailElement(region: AtlasRegion): HTMLElement {
  const root = document.createElement('div');
  root.className = 'st-atlas__location-detail st-atlas__region-detail';

  const heading = document.createElement('div');
  heading.className = 'st-atlas__location-detail-title';
  heading.textContent = `Region: ${region.name}`;
  root.append(heading);

  if (region.description) {
    const desc = document.createElement('div');
    desc.className = 'st-atlas__location-detail-line';
    desc.textContent = region.description;
    root.append(desc);
  }

  return root;
}

/** Builds safe DOM detail block for a route. textContent only. */
export function buildRouteDetailElement(
  route: AtlasRoute,
  locations: readonly AtlasLocation[],
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'st-atlas__location-detail st-atlas__route-detail';

  const heading = document.createElement('div');
  heading.className = 'st-atlas__location-detail-title';
  heading.textContent = `Route: ${route.name}`;
  root.append(heading);

  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const fromName = locMap.get(route.fromLocationId) ?? route.fromLocationId;
  const toName = locMap.get(route.toLocationId) ?? route.toLocationId;

  const pathLine = document.createElement('div');
  pathLine.className = 'st-atlas__location-detail-line';
  pathLine.textContent = `${fromName} ${route.bidirectional ? '↔' : '→'} ${toName}`;
  root.append(pathLine);

  if (route.distance !== undefined) {
    const dist = document.createElement('div');
    dist.className = 'st-atlas__location-detail-line';
    dist.textContent = `Distance: ${route.distance} ${route.distanceUnit ?? 'km'}`;
    root.append(dist);
  }

  if (route.travelTime !== undefined) {
    const time = document.createElement('div');
    time.className = 'st-atlas__location-detail-line';
    time.textContent = `Travel Time: ${route.travelTime} ${route.travelTimeUnit ?? 'hour'}`;
    root.append(time);
  }

  if (route.dangerLevel !== undefined && route.dangerLevel > 0) {
    const danger = document.createElement('div');
    danger.className = 'st-atlas__location-detail-line';
    danger.textContent = `Danger Rating: ${route.dangerLevel}/5`;
    root.append(danger);
  }

  if (route.requirements && route.requirements.length > 0) {
    const req = document.createElement('div');
    req.className = 'st-atlas__location-detail-line';
    req.textContent = `Requirements: ${route.requirements.join(', ')}`;
    root.append(req);
  }

  if (route.locked) {
    const lock = document.createElement('div');
    lock.className = 'st-atlas__location-detail-line';
    lock.textContent = 'Status: Locked';
    root.append(lock);
  }

  return root;
}
