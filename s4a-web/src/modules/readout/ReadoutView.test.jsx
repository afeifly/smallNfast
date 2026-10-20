import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReadoutView, { resolveLoggerType, clearReadoutCache } from './ReadoutView';
import TauriSutoAPI from '../../api/TauriSutoAPI';

describe('ReadoutView Dedicated Page Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearReadoutCache();
  });

  it('correctly resolves logger type for various SUTO hardware families', () => {
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
});

