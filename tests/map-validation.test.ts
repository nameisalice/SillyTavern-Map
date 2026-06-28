import { describe, expect, it } from 'vitest';
import { validateMapDocument, upgradeDocument } from '@/domain/map';
import { SOUTHERN_MARCHES } from '@/examples/southern-marches';

function clone() {
  return JSON.parse(JSON.stringify(SOUTHERN_MARCHES)) as typeof SOUTHERN_MARCHES;
}

describe('map validation', () => {
  it('accepts the bundled canonical document', () => {
    expect(validateMapDocument(SOUTHERN_MARCHES).ok).toBe(true);
  });

  it('rejects duplicate location ids', () => {
    const base = clone();
    const doc = { ...base, locations: [base.locations[0], base.locations[0]] };
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate location'))).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    const base = clone();
    const doc = {
      ...base,
      locations: [{ ...base.locations[0], coordinates: { x: 101, y: 0 } }],
    };
    expect(validateMapDocument(doc).ok).toBe(false);
  });

  it('rejects broken route endpoints', () => {
    const base = clone();
    const doc = { ...base, routes: [{ ...base.routes[0], toLocationId: 'missing' }] };
    const result = validateMapDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path.includes('toLocationId'))).toBe(true);
  });

  it('rejects missing asset references', () => {
    const base = clone();
    const doc = { ...base, image: { ...base.image, assetId: '' } };
    expect(validateMapDocument(doc).ok).toBe(false);
  });
});

describe('map migration', () => {
  it('upgrades legacy schemaVersion 1 into canonical version 1', () => {
    const legacy = { ...clone(), schemaVersion: 1 } as Record<string, unknown>;
    delete legacy['version'];
    const upgraded = upgradeDocument(legacy);
    expect(upgraded.version).toBe(1);
    expect(upgraded.id).toBe(SOUTHERN_MARCHES.id);
  });
});
