import type { StorageNamespace, StorageProvider } from '@/providers/storage';

export class MemoryStorageProvider implements StorageProvider {
  private readonly data = new Map<string, unknown>();

  async save<T>(namespace: StorageNamespace, key: string, value: T): Promise<void> {
    this.data.set(`${namespace}:${key}`, value);
  }

  async load<T>(namespace: StorageNamespace, key: string): Promise<T | null> {
    return (this.data.get(`${namespace}:${key}`) as T | undefined) ?? null;
  }

  async delete(namespace: StorageNamespace, key: string): Promise<void> {
    this.data.delete(`${namespace}:${key}`);
  }

  async list(namespace: StorageNamespace): Promise<readonly string[]> {
    const prefix = `${namespace}:`;
    return [...this.data.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  async exists(namespace: StorageNamespace, key: string): Promise<boolean> {
    return this.data.has(`${namespace}:${key}`);
  }
}
