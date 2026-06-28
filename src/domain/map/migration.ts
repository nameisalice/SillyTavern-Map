/**
 * Map document migration pipeline.
 *
 * Future schema changes must not break old maps. M2 introduces the
 * pipeline with current-version no-op behavior and one legacy shim for
 * M1's temporary `schemaVersion` field.
 */

import type { AtlasMapDocument, UnknownMapDocument } from './map-document';
import { ATLAS_MAP_DOCUMENT_VERSION } from './map-document';
import { assertValidMapDocument } from './validation';

/** Upgrades an unknown document to the current AtlasMapDocument version. */
export function upgradeDocument(document: unknown): AtlasMapDocument {
  const current = normalizeLegacyVersion(document);
  assertValidMapDocument(current);
  return current;
}

/**
 * Converts legacy M1 `{ schemaVersion: 1 }` into canonical
 * `{ version: 1 }`. No other repair is performed.
 */
function normalizeLegacyVersion(document: unknown): UnknownMapDocument {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    return { value: document };
  }
  const record = document as UnknownMapDocument;
  if (record['version'] === ATLAS_MAP_DOCUMENT_VERSION) {
    return record;
  }
  if (record['schemaVersion'] === ATLAS_MAP_DOCUMENT_VERSION) {
    const { schemaVersion: _schemaVersion, ...rest } = record;
    return { ...rest, version: ATLAS_MAP_DOCUMENT_VERSION };
  }
  return record;
}
