/**
 * localforage-backed StorageProvider implementation.
 *
 * All keys are namespaced and versioned so future storage migrations can
 * coexist with old data. Repositories use this through the generic
 * StorageProvider interface only.
 */

import type { StorageNamespace, StorageProvider } from './storage-provider';
import { getLocalForage } from '@/st/localforage-adapter';

const STORAGE_PREFIX = 'atlas:v1';

function storageKey(namespace: StorageNamespace, key: string): string {
  return `${STORAGE_PREFIX}:${namespace}:${key}`;
}

function namespacePrefix(namespace: StorageNamespace): string {
  return `${STORAGE_PREFIX}:${namespace}:`;
}

export class LocalForageStorageProvider implements StorageProvider {
  async save<T>(namespace: StorageNamespace, key: string, value: T): Promise<void> {
    await getLocalForage().setItem(storageKey(namespace, key), value);
  }

  async load<T>(namespace: StorageNamespace, key: string): Promise<T | null> {
    return getLocalForage().getItem<T>(storageKey(namespace, key));
  }

  async delete(namespace: StorageNamespace, key: string): Promise<void> {
    await getLocalForage().removeItem(storageKey(namespace, key));
  }

  async list(namespace: StorageNamespace): Promise<readonly string[]> {
    const prefix = namespacePrefix(namespace);
    const keys = await getLocalForage().keys();
    return keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }

  async exists(namespace: StorageNamespace, key: string): Promise<boolean> {
    const value = await this.load<unknown>(namespace, key);
    return value !== null;
  }
}
