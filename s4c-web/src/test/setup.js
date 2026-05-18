import '@testing-library/jest-dom';

// Always provide a reliable localStorage implementation.
// jsdom resolves bare `localStorage` through window, not globalThis,
// so we must set it on both.
const store = {};
const storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storage, writable: true, configurable: true,
});

// Also set on window if it exists (jsdom environment)
if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'localStorage', {
      value: storage, writable: true, configurable: true,
    });
  } catch (_) { /* ignore if window.localStorage is read-only */ }
}
