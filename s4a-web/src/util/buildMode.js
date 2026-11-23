/**
 * Application Build Mode: 'full' (default) or 'basic'
 * - 'full': All features enabled (File Analyze, Single Device monitor, Multi Device / ProcessScape)
 * - 'basic': Lightweight build (File Analyze and Single Device monitor only; excludes Multi Device / ProcessScape)
 */

let _testOverrideMode = null;

export function setBuildModeForTesting(mode) {
  _testOverrideMode = mode;
}

export function getBuildMode() {
  if (_testOverrideMode !== null) {
    return String(_testOverrideMode).toLowerCase() === 'basic' ? 'basic' : 'full';
  }
  const raw = (
    (typeof __BUILD_MODE__ !== 'undefined' ? __BUILD_MODE__ : '') ||
    (typeof import.meta !== 'undefined' && import.meta.env && (
      import.meta.env.VITE_BUILD_MODE ||
      import.meta.env.BUILD_MODE ||
      (import.meta.env.MODE === 'basic' ? 'basic' : '')
    )) ||
    'full'
  );
  return String(raw).toLowerCase() === 'basic' ? 'basic' : 'full';
}

export const BUILD_MODE = getBuildMode();

export function isBasicMode() {
  return getBuildMode() === 'basic';
}

export function isMultiModeEnabled() {
  return getBuildMode() !== 'basic';
}
