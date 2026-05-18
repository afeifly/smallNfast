import { describe, it, expect } from 'vitest';

describe('CI environment check', () => {
  it('has localStorage with expected methods', () => {
    expect(typeof localStorage).toBe('object');
    expect(typeof localStorage.getItem).toBe('function');
    expect(typeof localStorage.setItem).toBe('function');
    expect(typeof localStorage.removeItem).toBe('function');
    expect(typeof localStorage.clear).toBe('function');
  });

  it('can read/write localStorage', () => {
    localStorage.setItem('test-key', 'test-value');
    expect(localStorage.getItem('test-key')).toBe('test-value');
    localStorage.removeItem('test-key');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('has a working document (jsdom)', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).toBeTruthy();
  });

  it('has a working window', () => {
    expect(typeof window).toBe('object');
  });
});
