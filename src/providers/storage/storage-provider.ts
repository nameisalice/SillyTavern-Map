/**
 * Storage provider contracts.
 *
 * Repositories own persistence and depend only on these interfaces. No
 * repository knows whether data is backed by localforage, IndexedDB, a
 * file, or a future server adapter.
 */

/** Namespace used by the storage provider. */
export type StorageNamespace = 'maps' | 'assets' | 'thumbnails' | 'viewer-state' | 'metadata';

/** Generic versioned storage provider. */
export interface StorageProvider {
  save<T>(namespace: StorageNamespace, key: string, value: T): Promise<void>;
  load<T>(namespace: StorageNamespace, key: string): Promise<T | null>;
  delete(namespace: StorageNamespace, key: string): Promise<void>;
  list(namespace: StorageNamespace): Promise<readonly string[]>;
  exists(namespace: StorageNamespace, key: string): Promise<boolean>;
}

/** Stored binary payload. */
export interface StoredBinary {
  readonly data: Uint8Array;
  readonly mime: string;
}

/** A binary asset store for large local data. */
export interface AssetStore {
  put(assetId: string, blob: Uint8Array, mimeType: string): Promise<void>;
  get(assetId: string): Promise<StoredBinary | null>;
  delete(assetId: string): Promise<void>;
  has(assetId: string): Promise<boolean>;
}

/** Versioned map document store. */
export interface MapDocumentStore {
  save(mapId: string, document: unknown): Promise<void>;
  load(mapId: string): Promise<unknown | null>;
  delete(mapId: string): Promise<void>;
  list(): Promise<readonly string[]>;
}
