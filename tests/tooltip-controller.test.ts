/**
 * Tests for the tooltip / detail controller.
 *
 * Verifies the detail text is built correctly and — importantly for the
 * security checklist — that user-provided text never reaches the DOM as
 * raw HTML (no injection).
 */

import { describe, expect, it } from 'vitest';

import {
  buildLocationDetail,
  buildLocationDetailElement,
} from '@/features/viewer/tooltip-controller';
import type { AtlasLocation } from '@/domain/location';

function makeLocation(over: Partial<AtlasLocation> = {}): AtlasLocation {
  return {
    id: 'l',
    name: 'Camp',
    coordinates: { x: 0, y: 0 },
    ...over,
  } as AtlasLocation;
}

describe('buildLocationDetail', () => {
  it('includes the name as title and description as a line', () => {
    const detail = buildLocationDetail(
      makeLocation({ name: 'Stone Gorge', description: 'A narrow road.' }),
    );
    expect(detail.title).toBe('Stone Gorge');
    expect(detail.lines).toContain('A narrow road.');
  });

  it('includes the danger level when above zero', () => {
    const detail = buildLocationDetail(makeLocation({ dangerLevel: 3 }));
    expect(detail.lines.some((l) => l.includes('3'))).toBe(true);
  });

  it('omits the danger line when zero or absent', () => {
    const detail = buildLocationDetail(makeLocation({ dangerLevel: 0 }));
    expect(detail.lines.some((l) => l.includes('Danger'))).toBe(false);
  });
});

describe('buildLocationDetailElement (HTML safety)', () => {
  it('renders dynamic text via textContent, not innerHTML', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const element = buildLocationDetailElement(makeLocation({ name: evil, description: evil }));
    // The raw HTML must not be parsed; it must appear as literal text.
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain(evil);
  });

  it('exposes the title in a dedicated element', () => {
    const element = buildLocationDetailElement(makeLocation({ name: 'Vael-Tor' }));
    const title = element.querySelector('.st-atlas__location-detail-title');
    expect(title?.textContent).toBe('Vael-Tor');
  });
});
