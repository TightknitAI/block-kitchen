// jsdom implements no `ResizeObserver`, and Radix's popper (under the channel
// combobox's dropdown) constructs one on mount. Nothing in jsdom lays out, so
// a no-op stub is all the observed elements would ever report anyway.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

// jsdom leaves `DOMRect.fromRect` off the constructor; floating-ui calls it
// while positioning the popper.
if (typeof globalThis.DOMRect?.fromRect !== 'function' && globalThis.DOMRect) {
  globalThis.DOMRect.fromRect = (rect?: DOMRectInit): DOMRect =>
    new DOMRect(rect?.x ?? 0, rect?.y ?? 0, rect?.width ?? 0, rect?.height ?? 0);
}

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
