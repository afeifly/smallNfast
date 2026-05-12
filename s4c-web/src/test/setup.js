import '@testing-library/jest-dom';

// Always provide a reliable localStorage implementation.
// jsdom's built-in localStorage can be incomplete in some environments.
const store = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  },
  writable: true,
  configurable: true,
});
