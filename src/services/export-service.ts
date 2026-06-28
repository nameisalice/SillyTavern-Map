/**
 * ExportService boundary.
 *
 * Exports map packs for portability between browsers and devices.
 * Exports never include provider credentials. Concrete implementation
 * arrives in a later milestone.
 */

/** Map export coordination contract. */
export interface ExportService {
  /** Exports a map pack for the given map id. */
  exportMap(mapId: string): Promise<Blob>;
}
