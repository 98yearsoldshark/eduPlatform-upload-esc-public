import { StateStorage } from "zustand/middleware";
import { get, set, del, clear } from "idb-keyval";
import * as storageModule from "./storage";

class IndexedDBStorage implements StateStorage {
  public async getItem(name: string): Promise<string | null> {
    try {
      const storageValue = storageModule.getItem(name);
      const value = (await get(name)) || 
                    (storageValue === undefined || storageValue === null ? null : String(storageValue));
      return value;
    } catch (error) {
      const storageValue = storageModule.getItem(name);
      return storageValue === undefined || storageValue === null ? null : String(storageValue);
    }
  }

  public async setItem(name: string, value: string): Promise<void> {
    try {
      const _value = JSON.parse(value);
      if (!_value?.state?._hasHydrated) {
        console.warn("skip setItem", name);
        return;
      }
      await set(name, value);
    } catch (error) {
      storageModule.setItem(name, value);
    }
  }

  public async removeItem(name: string): Promise<void> {
    try {
      await del(name);
    } catch (error) {
      storageModule.removeItem(name);
    }
  }

  public async clear(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      storageModule.clear();
    }
  }
}

export const indexedDBStorage = new IndexedDBStorage();
