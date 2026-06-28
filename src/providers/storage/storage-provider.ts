/**
 * Storage provider contracts.
 *
 * These abstract the persistence backends described in the development
 * plan (§8): localforage for large binary assets, and a versioned map
 * repository for map documents. The host-backed `extensionSettings`
 * and `chatMetadata` adapters are not modeled here because they are
 * reached through `getContext()` directly; only the localforage-style
 * blob store and the map document repository are abstracted behind
 * providers, so that an optional server-storage adapter (§8.4) can
 * replace them later without touching domain code.
 *
 * Only interfaces are declared here. The localforage implementation
 * arrives in a later milestone.
 */

/**
 * A binary asset store for large local data (map images, thumbnails,
 * imported map-pack assets). Never stores anything in extension
 * settings.
 */
export interface AssetStore {
  /** Stores a binary blob under an asset id. */
  put(assetId: string, blob: Uint8Array, mimeType: string): Promise<void>;

  /** Retrieves a binary blob by asset id, or `null` if absent. */
  get(assetId: string): Promise<{ data: Uint8Array; mimeType: string } | null>;

  /** Deletes a binary blob by asset id. No-op if absent. */
  delete(assetId: string): Promise<void>;

  /** Returns true if an asset exists. */
  has(assetId: string): Promise<boolean>;
}

/**
 * A versioned map document repository. Stores the structured map
 * document (not the image) keyed by map id.
 */
export interface MapDocumentStore {
  /** Saves a map document. */
  save(mapId: string, document: unknown): Promise<void>;

  /** Loads a map document by id, or `null` if absent. */
  load(mapId: string): Promise<unknown | null>;

  /** Deletes a map document by id. No-op if absent. */
  delete(mapId: string): Promise<void>;

  /** Returns the ids of all stored map documents. */
  list(): Promise<readonly string[]>;
}
