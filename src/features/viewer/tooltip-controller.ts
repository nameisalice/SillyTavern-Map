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
export function buildLocationDetailElement(location: AtlasLocation): HTMLElement {
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
  return root;
}
