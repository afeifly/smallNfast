import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OnlineView, { clearOnlineCache } from './OnlineView';
import TauriSutoAPI from '../../api/TauriSutoAPI';

describe('OnlineView Component', () => {
  beforeEach(() => {
    clearOnlineCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOnlineCache();
  });

  it('displays clean loading state initially without showing premature device panel or fallback names', async () => {
    let resolveChannels;
    let resolveSysInfo;

    const channelsPromise = new Promise((resolve) => {
      resolveChannels = resolve;
    });
    const sysInfoPromise = new Promise((resolve) => {
      resolveSysInfo = resolve;
    });

    vi.spyOn(TauriSutoAPI, 'getChannels').mockImplementation(() => channelsPromise);
    vi.spyOn(TauriSutoAPI, 'getLayoutInfo').mockResolvedValue([]);
    vi.spyOn(TauriSutoAPI, 'getSystemInfo').mockImplementation(() => sysInfoPromise);

    const onDisconnect = vi.fn();
    const deviceInfo = {
      transport: 'BLE',
      device: 'S403-12345678',
      name: 'S403-12345678',
      deviceId: 2, // Would previously trigger SUTO_MODEL_TYPES[2] -> 'FA 300'
    };

    const { container } = render(
      <OnlineView deviceInfo={deviceInfo} onDisconnect={onDisconnect} />
    );

    // 1. Initial State: clean loading screen is visible
    expect(container.querySelector('.online-loading-state')).not.toBeNull();
    expect(container.querySelector('.online-loading-spinner')).not.toBeNull();
    expect(screen.getByText('Connecting and reading device information...')).toBeDefined();

    // The top device panel and any premature fallback names (e.g. FA 300) are NOT displayed
    expect(container.querySelector('.online-top-panel')).toBeNull();
    expect(screen.queryByText('FA 300')).toBeNull();

    // 2. Resolve data from device
    resolveChannels([
      { channel_id: 1, channel_name: 'Flow', current_value: 12.5, unit: 'm³/h' }
    ]);
    resolveSysInfo({
      device_id: 0x1230,
      device_name: 'S403',
      serial_number: '12345678',
      firmware_version: 'v1.2',
    });

    // 3. Device panel is now revealed with true device name
    await waitFor(() => {
      expect(container.querySelector('.online-loading-state')).toBeNull();
      expect(container.querySelector('.online-top-panel')).not.toBeNull();
    });

    expect(screen.getByText('S403')).toBeDefined();
    expect(screen.queryByText('FA 300')).toBeNull();
    expect(screen.getByText('Flow')).toBeDefined();
    expect(screen.getByText('12.5')).toBeDefined();
  });
});
