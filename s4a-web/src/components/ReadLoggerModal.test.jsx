import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ReadLoggerModal, { resolveLoggerType } from './ReadLoggerModal';
import TauriSutoAPI from '../api/TauriSutoAPI';

describe('ReadLoggerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly resolves logger type from device model', () => {
    expect(resolveLoggerType({ device: 'SUTO S418-DN25' }, null)).toBe('s418');
    expect(resolveLoggerType({ device: 'SUTO S419' }, null)).toBe('s418');
    expect(resolveLoggerType({ device: 'S461 Flow Meter' }, null)).toBe('s461');
    expect(resolveLoggerType({ device: 'S463 Ultrasonic' }, null)).toBe('s461');
    expect(resolveLoggerType({ device: 'SUTO S600 Purity Analyzer' }, null)).toBe('s600');
    expect(resolveLoggerType({ device: 'SUTO S605' }, null)).toBe('s605');
    expect(resolveLoggerType({ device: 'SUTO S606' }, null)).toBe('s606');
    expect(resolveLoggerType({ device: 'SUTO S331 Main' }, null)).toBe('ds310');
    expect(resolveLoggerType({ device: 'DS310' }, null)).toBe('ds310');
  });

  it('renders S418 readout UI when connected to an S418 device', async () => {
    vi.spyOn(TauriSutoAPI, 'getLoggerStatus').mockResolvedValue({
      enabled: true,
      recorded_count: 1440,
      start_time: 1710489600,
      end_time: 1710576000,
    });

    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={vi.fn()}
        deviceInfo={{ device: 'SUTO S418 Compact Flow Meter' }}
        onAnalyzeCsv={vi.fn()}
      />
    );

    // Header displays the readout title
    expect(screen.getByText('Readout')).toBeDefined();

    // S418 stat cards
    await waitFor(() => {
      expect(screen.getByText('Rec. Numbers')).toBeDefined();
      expect(screen.getByText('1440')).toBeDefined();
      expect(screen.getByText('Read to CSV')).toBeDefined();
    });
  });

  it('renders S331 readout options: Read Logger files & Read screenshots', async () => {
    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={vi.fn()}
        deviceInfo={{ device: 'SUTO S331 Data Logger' }}
        onAnalyzeCsv={vi.fn()}
      />
    );

    expect(screen.getByText('Readout')).toBeDefined();

    // Verify S331 options
    expect(screen.getByText(/Read Logger files \(CSV\)/)).toBeDefined();
    expect(screen.getByText(/Read screenshots/)).toBeDefined();
    expect(screen.queryByText(/Export report/)).toBeNull();

    // Switch to screenshots
    fireEvent.click(screen.getByText(/Read screenshots/));
    await waitFor(() => {
      expect(screen.getByText(/No Screenshot Images Found in Device/)).toBeDefined();
    });
  });

  it('renders S600 readout options including Export report', async () => {
    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={vi.fn()}
        deviceInfo={{ device: 'SUTO S600' }}
        onAnalyzeCsv={vi.fn()}
      />
    );

    expect(screen.getByText('Readout')).toBeDefined();
    expect(screen.getByText(/Read Logger files \(CSV\)/)).toBeDefined();
    expect(screen.getByText(/Read screenshots/)).toBeDefined();
    expect(screen.getByText(/Export report/)).toBeDefined();
    expect(screen.queryByText(/Export alarm history/)).toBeNull();
  });

  it('renders S606 readout options including calibration and alarm history', async () => {
    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={vi.fn()}
        deviceInfo={{ device: 'SUTO S606 Stationary Analyzer' }}
        onAnalyzeCsv={vi.fn()}
      />
    );

    expect(screen.getByText('Readout')).toBeDefined();
    expect(screen.getByText(/Read Logger files \(CSV\)/)).toBeDefined();
    expect(screen.getByText(/Read screenshots/)).toBeDefined();
    expect(screen.getByText(/Export user calibration history/)).toBeDefined();
    expect(screen.getByText(/Export alarm history/)).toBeDefined();
  });

  it('executes read to CSV for S418 and calls onAnalyzeCsv', async () => {
    vi.spyOn(TauriSutoAPI, 'getLoggerStatus').mockResolvedValue({
      enabled: true,
      recorded_count: 500,
      start_time: 1710489600,
      end_time: 1710576000,
    });
    vi.spyOn(TauriSutoAPI, 'getChannels').mockResolvedValue([
      { channel_name: 'Flow', unit: 'm³/h', resolution: 2 },
      { channel_name: 'Pressure', unit: 'bar', resolution: 2 },
    ]);

    const handleAnalyze = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={handleClose}
        deviceInfo={{ device: 'SUTO S418' }}
        onAnalyzeCsv={handleAnalyze}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Read to CSV')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Read to CSV'));

    await waitFor(() => {
      expect(screen.getByText('Readout Completed Successfully!')).toBeDefined();
      expect(screen.getByText('Analyze in S4A (Graphic & Table)')).toBeDefined();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Analyze in S4A (Graphic & Table)'));
    expect(handleAnalyze).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('fetches and displays screenshot list from device memory and triggers download', async () => {
    vi.spyOn(TauriSutoAPI, 'getScreenshots').mockResolvedValue([
      { name: '12_30_05.BMP', size: 153600, index: 0 },
      { name: '14_15_22.BMP', size: 153600, index: 1 },
    ]);
    const readSpy = vi.spyOn(TauriSutoAPI, 'readScreenshot').mockResolvedValue(new Uint8Array([0x42, 0x4D, 0x00, 0x00]));

    render(
      <ReadLoggerModal
        isOpen={true}
        onClose={vi.fn()}
        deviceInfo={{ device: 'SUTO S331' }}
        onAnalyzeCsv={vi.fn()}
      />
    );

    // Switch to screenshots tab
    fireEvent.click(screen.getByText(/Read screenshots/));

    await waitFor(() => {
      expect(screen.getByText(/12_30_05\.BMP/)).toBeDefined();
      expect(screen.getByText(/14_15_22\.BMP/)).toBeDefined();
      expect(screen.getAllByText('Preview & download').length).toBe(2);
    });

    // Click preview & download on first item
    const actionBtns = screen.getAllByText('Preview & download');
    fireEvent.click(actionBtns[0]);
    expect(readSpy).toHaveBeenCalledWith('12_30_05.BMP', 153600);
  });
});
