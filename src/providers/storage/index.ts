/**
 * Barrel for the storage provider layer.
 */

export type {
  AssetStore,
  MapDocumentStore,
  StorageNamespace,
  StorageProvider,
  StoredBinary,
} from './storage-provider';
export { LocalForageStorageProvider } from './localforage-storage';
