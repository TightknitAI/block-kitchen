// Node.js 22 exposes an experimental `localStorage` global that is `undefined`
// when `--localstorage-file` is not provided. This shadows jsdom's working
// implementation and causes `globalThis.localStorage?.getItem(...)` to silently
// no-op. Replace it with a simple in-memory implementation so unit tests that
// exercise localStorage-backed utilities work correctly.
if (!globalThis.localStorage) {
  let store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string): string | null => store[key] ?? null,
      setItem: (key: string, value: string): void => {
        store[key] = String(value);
      },
      removeItem: (key: string): void => {
        delete store[key];
      },
      clear: (): void => {
        store = {};
      },
      get length(): number {
        return Object.keys(store).length;
      },
      key: (index: number): string | null => Object.keys(store)[index] ?? null
    },
    writable: true
  });
}
