import '@testing-library/jest-dom';

// Provide a mock for localStorage in jsdom environment under Node 22+
const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof window !== 'undefined' && (!window.localStorage || typeof window.localStorage.getItem !== 'function')) {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageMock(),
    writable: true,
  });
}

if (typeof globalThis !== 'undefined' && (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function')) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: window?.localStorage || createStorageMock(),
    writable: true,
  });
}

// Default mock for Tauri desktop environment in test runner
if (typeof window !== 'undefined' && !window.__TAURI_INTERNALS__) {
  window.__TAURI_INTERNALS__ = {
    invoke: async () => ({ success: true, channels: [], info: {} }),
  };
}

// Polyfill SVGElement.transform.baseVal for d3 transitions in jsdom
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.transform) {
  Object.defineProperty(SVGElement.prototype, 'transform', {
    get() {
      return {
        baseVal: {
          consolidate: () => null,
          numberOfItems: 0,
          getItem: () => null,
        },
      };
    },
    configurable: true,
  });
}

// Polyfill ResizeObserver in jsdom
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

