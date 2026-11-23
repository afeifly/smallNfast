import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getBuildMode,
  isBasicMode,
  isMultiModeEnabled,
  setBuildModeForTesting
} from './buildMode';

describe('buildMode utility', () => {
  beforeEach(() => {
    setBuildModeForTesting(null);
  });

  afterEach(() => {
    setBuildModeForTesting(null);
  });

  it('defaults to full build mode with multi-device enabled', () => {
    expect(getBuildMode()).toBe('full');
    expect(isBasicMode()).toBe(false);
    expect(isMultiModeEnabled()).toBe(true);
  });

  it('correctly reports basic build mode when configured', () => {
    setBuildModeForTesting('basic');
    expect(getBuildMode()).toBe('basic');
    expect(isBasicMode()).toBe(true);
    expect(isMultiModeEnabled()).toBe(false);
  });

  it('handles case-insensitive mode values', () => {
    setBuildModeForTesting('BASIC');
    expect(getBuildMode()).toBe('basic');
    expect(isBasicMode()).toBe(true);
    expect(isMultiModeEnabled()).toBe(false);

    setBuildModeForTesting('FULL');
    expect(getBuildMode()).toBe('full');
    expect(isBasicMode()).toBe(false);
    expect(isMultiModeEnabled()).toBe(true);
  });
});
