import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReadoutView from './ReadoutView';
import { resolveLoggerType, clearReadoutCache } from './readoutSession';
import TauriSutoAPI from '../../api/TauriSutoAPI';

describe('ReadoutView Dedicated Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearReadoutCache();
  });

  it('correctly resolves logger type for various SUTO hardware families including S332 variants', () => {
    expect(resolveLoggerType({ device: 'S332' }, null)).toBe('s332');
    expect(resolveLoggerType({ device: 'DL G2' }, null)).toBe('s332');
    expect(resolveLoggerType(null, { device_id: 0x108f })).toBe('s332');
    expect(resolveLoggerType({ transport: 'API' }, null)).toBe('s332');

    // All S332 variants (0x1088 - 0x108F)
    expect(resolveLoggerType(null, { device_id: 0x1088 })).toBe('s332'); // S332+A3001
    expect(resolveLoggerType(null, { device_id: 0x1089 })).toBe('s332'); // S332+A3002
    expect(resolveLoggerType(null, { device_id: '0x108a' })).toBe('s332'); // S332-OPT-Relay2ch
    expect(resolveLoggerType(null, { device_id: '0x108A' })).toBe('s332');
    expect(resolveLoggerType(null, { device_id: '0x108b' })).toBe('s332'); // S332-OPT-Current
    expect(resolveLoggerType(null, { device_id: '0x108B' })).toBe('s332');
    expect(resolveLoggerType(null, { device_id: 'Ox108C' })).toBe('s332'); // S332-OPT-Voltage
    expect(resolveLoggerType(null, { device_id: 'Ox108D' })).toBe('s332'); // S332-OPT-Digital input
    expect(resolveLoggerType(null, { device_id: 'Ox108E' })).toBe('s332'); // S332-OPT-Relay4ch
    expect(resolveLoggerType(null, { device_id: 0x108f })).toBe('s332'); // DL G2
    expect(resolveLoggerType({ device: 'S332-OPT-Relay2ch' }, null)).toBe('s332');
    expect(resolveLoggerType({ device: 'S332-OPT-Current' }, null)).toBe('s332');

    expect(resolveLoggerType({ device: 'SUTO S418-DN25' }, null)).toBe('s418');
    expect(resolveLoggerType({ device: 'S419 Compact' }, null)).toBe('s418');
    expect(resolveLoggerType({ device: 'S461 Flow Meter' }, null)).toBe('s461');
    expect(resolveLoggerType({ device: 'S463 Ultrasonic' }, null)).toBe('s461');
    expect(resolveLoggerType({ device: 'SUTO S600' }, null)).toBe('s600');
    expect(resolveLoggerType(null, { device_id: 0x1068 })).toBe('s600');
    expect(resolveLoggerType({ deviceId: 0x1069 }, null)).toBe('s600');
    expect(resolveLoggerType(null, { device_id: 0x106f })).toBe('s600');
    expect(resolveLoggerType({ device: 'SUTO S605' }, null)).toBe('s605');
    expect(resolveLoggerType(null, { device_id: 0x121e })).toBe('s605');
    expect(resolveLoggerType({ device: 'SUTO S606' }, null)).toBe('s606');
    expect(resolveLoggerType(null, { device_id: 0x1220 })).toBe('s606');
    expect(resolveLoggerType({ device: 'DS310 Chart Recorder' }, null)).toBe('ds310');
    expect(resolveLoggerType({ device: 'SUTO S331 Main' }, null)).toBe('ds310');
  });

  it('renders dedicated page header and sub-tab refresh button', async () => {
    render(
      <ReadoutView
        deviceInfo={{ device: 'SUTO S331 Data Logger' }}
      />
    );

    expect(screen.getByText('Readout')).toBeDefined();
    await waitFor(() => {
      expect(screen.getAllByText('🔄 Refresh Files').length).toBeGreaterThan(0);
    });
  });

  it('renders real S418 stats and sub-tab refresh without mock fallbacks', async () => {
    vi.spyOn(TauriSutoAPI, 'getLoggerStatus').mockResolvedValue({
      enabled: true,
      recorded_count: 2880,
      start_time: 1710489600,
      end_time: 1710576000,
    });

    render(
      <ReadoutView
        deviceInfo={{ device: 'SUTO S418 Compact Flow Meter' }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Rec. Numbers')).toBeDefined();
      expect(screen.getByText('2880')).toBeDefined();
      expect(screen.getByText('Read to CSV')).toBeDefined();
      expect(screen.getByText('🔄 Refresh Status')).toBeDefined();
    });
  });

  it('switches between Read files and Read screenshots on DS310/S331', async () => {
    vi.spyOn(TauriSutoAPI, 'getScreenshots').mockResolvedValue([
      { name: 'Screenshot_01.png', size: 153600, timestamp: 1710489600 },
    ]);

    render(
      <ReadoutView
        deviceInfo={{ device: 'SUTO S331 Data Logger' }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Read Logger files \(CSV\)/)).toBeDefined();
      expect(screen.getByText(/Read screenshots/)).toBeDefined();
    });

    // Switch to screenshots
    fireEvent.click(screen.getByText(/Read screenshots/));

    await waitFor(() => {
      expect(screen.getByText(/Screenshot_01\.png/)).toBeDefined();
      expect(screen.getByText('Preview & download')).toBeDefined();
      expect(screen.getByText('🔄 Refresh List')).toBeDefined();
    });
  });

  it('shows report export tab with sub-tab refresh for S600 devices by name or device_id', async () => {
    vi.spyOn(TauriSutoAPI, 'getSystemInfo').mockResolvedValue({
      device_id: 0x1068,
      serial_number: '12345678',
    });
    vi.spyOn(TauriSutoAPI, 'get600CsdFiles').mockResolvedValue([
      { id: 1, name: 'LOG00001.CSD', size: 2048, date: 1710489600, date_str: '2026-03-15 10:00:00' },
    ]);

    render(
      <ReadoutView
        deviceInfo={{ transport: 'USB' }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Export report/)).toBeDefined();
      expect(screen.getByText(/Read Logger files \(CSV\)/)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Export report/));
    await waitFor(() => {
      expect(screen.getByText('🔄 Refresh Sessions')).toBeDefined();
      expect(screen.getByText(/Export Device Audit Report \(PDF\)/)).toBeDefined();
      expect(screen.getByText(/LOG00001\.CSD/)).toBeDefined();
      expect(screen.getByText('Generate & Download PDF Report')).toBeDefined();
    });
  });

  it('ensures active logger badge and static tip are removed', async () => {
    vi.spyOn(TauriSutoAPI, 'getLoggerFiles').mockResolvedValue([
      {
        fileName: 'LOG00085.CSD',
        startTime: '2026-10-18 10:00:00',
        endTime: '2026-10-18 11:00:00',
        samplesPerChannel: 194,
        isRecording: false,
        status: 0,
      },
    ]);

    render(
      <ReadoutView
        deviceInfo={{ device: 'DS310 Chart Recorder' }}
      />
    );

    await waitFor(() => {
      // Badge is completely removed
      expect(screen.queryByText(/Logger Active/)).toBeNull();
      expect(screen.queryByText(/Logger Idle/)).toBeNull();
      // Static tip is removed
      expect(screen.queryByText(/Tip: Reads the selected session and outputs a standard CSV file/)).toBeNull();
    });
  });

  it('renders dedicated S332 log files page with storage indicator and without screenshots tab', async () => {
    vi.spyOn(TauriSutoAPI, 'getActiveTransport').mockReturnValue('API');
    vi.spyOn(TauriSutoAPI, 'getSystemInfo').mockResolvedValue({
      device_id: '0x108F',
      device_name: 'S332',
      serial_number: '12341234',
      firmware_version: '1.0.3-Atlas11',
    });
    vi.spyOn(TauriSutoAPI, 'getDiskCapacity').mockResolvedValue({
      total: 11969748992,
      free: 11833544704,
      used: 136204288,
      percentUsed: '1.1',
    });
    vi.spyOn(TauriSutoAPI, 'getLoggerFiles').mockResolvedValue([
      {
        fileName: 'DL_G2_log',
        startTime: '2026-09-10 09:50:33',
        endTime: '2026-09-10 10:01:43',
        startTimeStamp: 1789005033589,
        endTimeStamp: 1789005703514,
        sampleRate: 10,
        channelsCount: 14,
        channels: [{ description: 'Lin0' }, { description: 'Dew point' }],
      },
    ]);

    const screenshotSpy = vi.spyOn(TauriSutoAPI, 'getScreenshots');

    render(
      <ReadoutView
        deviceInfo={{ device: 'S332', transport: 'API', host: '192.168.5.28', port: 8080 }}
      />
    );

    await waitFor(() => {
      // Header and dedicated S332 section
      expect(screen.getByText('S332 Recorded Log Files')).toBeDefined();
      // getScreenshots is never called for S332
      expect(screenshotSpy).not.toHaveBeenCalled();
      // Only log files, no screenshots or report tabs
      expect(screen.queryByText('Read screenshots')).toBeNull();
      expect(screen.queryByText('Export report')).toBeNull();
      // Correct SN and FW
      expect(screen.getByText('12341234')).toBeDefined();
      expect(screen.getByText('1.0.3-Atlas11')).toBeDefined();
      // Clean Ethernet badge without 8080 or Network API (8080)
      expect(screen.queryByText(/Network API/)).toBeNull();
      expect(screen.queryByText(/8080/)).toBeNull();
      expect(screen.getByText('Ethernet (192.168.5.28)')).toBeDefined();
      // Storage bar
      expect(screen.getByText(/S332 Internal Logger Storage/)).toBeDefined();
      // Log file listed in table
      expect(screen.getAllByText('DL_G2_log').length).toBeGreaterThan(0);
      // No Logged Channels column
      expect(screen.queryByText('Logged Channels')).toBeNull();
      // No readout-bottom-bar in S332 view
      expect(document.querySelector('.readout-bottom-bar')).toBeNull();
      expect(screen.queryByText('Read Selected Log to CSV')).toBeNull();
      // Per-row action button
      expect(screen.getByText('Read to CSV')).toBeDefined();
    });
  });
});

