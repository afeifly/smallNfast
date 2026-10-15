/**
 * Detect whether the application is running inside a desktop runtime
 * (Tauri or Electron) or as a pure web browser application.
 */

// Tauri v2 injects `__TAURI_INTERNALS__` into the window object
export const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

// Electron preload bridges usually expose `window.desktopApi` or `window.electron`
export const isElectron =
  typeof window !== 'undefined' &&
  Boolean(window.desktopApi?.isDesktop || window.electron || window.process?.type === 'renderer');

export const isDesktop = isTauri || isElectron;
export const isWeb = !isDesktop;

/**
 * Get human-readable runtime target name
 * @returns {'desktop-tauri' | 'desktop-electron' | 'web'}
 */
export const getRuntimePlatform = () => {
  if (isTauri) return 'desktop-tauri';
  if (isElectron) return 'desktop-electron';
  return 'web';
};
