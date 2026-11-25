import { describe, expect, it } from 'vitest';
import { selectArtifacts } from './sync-builds.mjs';

const artifacts = ['Windows-EXE', 'macOS-DMG', 'Android-APK'].flatMap(platform =>
  ['full', 'basic'].map(flavor => ({ name: `S4A-${platform}-${flavor}` }))
);

describe('sync artifact selection', () => {
  it('maps all six workflow artifacts to distinct download names', () => {
    expect(selectArtifacts(artifacts, 'all', 'all').map(item => item.filename).sort()).toEqual([
      's4a_android.zip',
      's4a_basic_android.zip',
      's4a_basic_mac.zip',
      's4a_basic_window.zip',
      's4a_mac.zip',
      's4a_window.zip',
    ]);
  });

  it('uses the same names when filtering by flavor and platform aliases', () => {
    expect(selectArtifacts(artifacts, 'basic', 'apk').map(item => item.filename))
      .toEqual(['s4a_basic_android.zip']);
    expect(selectArtifacts(artifacts, 'full', 'mac').map(item => item.filename))
      .toEqual(['s4a_mac.zip']);
    expect(selectArtifacts(artifacts, 'basic', 'win').map(item => item.filename))
      .toEqual(['s4a_basic_window.zip']);
  });

  it('reports missing or expired requested artifacts', () => {
    const missing = artifacts.filter(artifact => artifact.name !== 'S4A-Android-APK-basic');
    expect(() => selectArtifacts(missing, 'all', 'all')).toThrow('s4a_basic_android.zip');
    expect(() => selectArtifacts([{ name: 'S4A-Android-APK-basic', expired: true }], 'basic', 'android'))
      .toThrow('s4a_basic_android.zip');
  });
});
