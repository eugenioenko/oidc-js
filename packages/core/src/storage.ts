import type { Storage } from "./types.js";

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

export class BrowserStorage implements Storage {
  constructor(private store: globalThis.Storage = sessionStorage) {}

  get(key: string): string | null {
    return this.store.getItem(key);
  }

  set(key: string, value: string): void {
    this.store.setItem(key, value);
  }

  remove(key: string): void {
    this.store.removeItem(key);
  }
}
