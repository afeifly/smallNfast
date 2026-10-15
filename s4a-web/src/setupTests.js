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
