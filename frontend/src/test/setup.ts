import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

// jsdom 25.x ships a broken localStorage — provide a simple shim
const localStorageShim = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

beforeAll(() => {
  Object.defineProperty(globalThis, "localStorage", { value: localStorageShim });
});

afterEach(() => {
  cleanup();
  localStorageShim.clear();
});
