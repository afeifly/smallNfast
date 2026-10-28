import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkIsTauri,
  checkIsElectron,
  checkIsNative,
  checkIsWeb,
  resolveDeviceTypeName,
} from './platform';

describe('platform detection utilities', () => {
  const originalTauriInternals = window.__TAURI_INTERNALS__;
  const originalTauri = window.__TAURI__;
  const originalDesktopApi = window.desktopApi;
  const originalLocation = window.location;

  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;
    delete window.desktopApi;
    if (originalTauriInternals !== undefined) {
      window.__TAURI_INTERNALS__ = originalTauriInternals;
    }
    if (originalTauri !== undefined) {
      window.__TAURI__ = originalTauri;
    }
    if (originalDesktopApi !== undefined) {
      window.desktopApi = originalDesktopApi;
    }
  });

  it('detects pure web environment by default in browser', () => {
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;
    delete window.desktopApi;

    expect(checkIsNative()).toBe(false);
    expect(checkIsWeb()).toBe(true);
  });

  it('detects native environment when Tauri internals are injected (e.g. Windows/macOS/Android APK)', () => {
    window.__TAURI_INTERNALS__ = {};

    expect(checkIsTauri()).toBe(true);
    expect(checkIsNative()).toBe(true);
    expect(checkIsWeb()).toBe(false);
  });

  it('detects native environment when running under tauri.localhost origin (Tauri Android/Desktop webview)', () => {
    // Delete globals but simulate tauri.localhost hostname
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;
    delete window.desktopApi;

    const savedLocation = window.location;
    delete window.location;
    window.location = { hostname: 'tauri.localhost', protocol: 'http:' };

    expect(checkIsTauri()).toBe(true);
    expect(checkIsNative()).toBe(true);
    expect(checkIsWeb()).toBe(false);

    window.location = savedLocation;
  });

  it('detects native environment when Electron desktopApi is present', () => {
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;
    window.desktopApi = { isDesktop: true };

    expect(checkIsElectron()).toBe(true);
    expect(checkIsNative()).toBe(true);
    expect(checkIsWeb()).toBe(false);
  });

  it('resolves device type name from sysInfo or model', () => {
    expect(resolveDeviceTypeName({ device_id: 0x1065 })).toBe('S331');
    expect(resolveDeviceTypeName({ device_id: 0x1068 })).toBe('S600');
    expect(resolveDeviceTypeName({ device_name: 'Custom-Sensor' })).toBe('Custom-Sensor');
    expect(resolveDeviceTypeName(null, { device: 'S551-P4' })).toBe('S551-P4');
    expect(resolveDeviceTypeName(null, null)).toBe('SUTO Connected Hardware');
  });
});
