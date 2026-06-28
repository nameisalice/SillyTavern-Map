/**
 * ImportService boundary.
 *
 * Imports map packs and legacy `PNG + JSON` pairs. Imported scripts are
 * never executed automatically; raw STScript is marked untrusted.
 * Concrete implementation arrives in a later milestone.
 */

/** Map import coordination contract. */
export interface ImportService {
  /** Imports a map pack from a JSON file (and optional image). */
  importFromFile(file: File): Promise<{ readonly mapId: string }>;
}
