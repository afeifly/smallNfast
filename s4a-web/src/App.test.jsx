import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from './App';
import TestAPI from './api/TestAPI';
import TauriSutoAPI from './api/TauriSutoAPI';
import { clearReadoutCache } from './modules/readout/ReadoutView';

describe('App', () => {
  beforeEach(() => {
    clearReadoutCache();
    if (TestAPI.reset) TestAPI.reset();
    if (TestAPI.setMode) TestAPI.setMode('analyze');
  });
  it('renders Welcome screen with File Analyze Mode and Device Monitor Mode', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('File Analyze Mode')).toBeDefined();
      expect(screen.getByText('Device Monitor Mode')).toBeDefined();
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });
  });

  it('connects to device monitor mode, hides Graphic & Table tabs, and displays Readout', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    const detectBtn = screen.getByText('Detect & Connect Device');
    fireEvent.click(detectBtn);

    const usbBtn = await screen.findByText(/Detect & Connect USB/);
    fireEvent.click(usbBtn);

    await waitFor(() => {
      expect(screen.getByText('Online View')).toBeDefined();
      // Graphic View and Table View should be hidden in monitor mode
      expect(screen.queryByText('Graphic View')).toBeNull();
      expect(screen.queryByText('Table View')).toBeNull();
      // Header Readout button should be visible
      expect(screen.getByText('Readout')).toBeDefined();
      // online-btn-read-logger in device controls must NOT exist
      expect(document.querySelector('.online-btn-read-logger')).toBeNull();
    });
  });

  it('switches to dedicated Readout page and verifies navigation', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Detect & Connect Device'));
    const usbBtn = await screen.findByText(/Detect & Connect USB/);
    fireEvent.click(usbBtn);

    await waitFor(() => {
      expect(screen.getByText('Online View')).toBeDefined();
    });

    // Click Readout tab in header
    const readoutTab = screen.getAllByText('Readout').find((el) => el.classList.contains('tab-btn'));
    fireEvent.click(readoutTab);

    // Dedicated Readout page is now displayed
    await waitFor(() => {
      expect(document.querySelector('.readout-view-container')).toBeDefined();
      expect(document.querySelector('.read-logger-title')?.textContent).toBe('Readout');
    });

    // Return to Online View via the top header tab
    const onlineTab = screen.getByText('Online View');
    fireEvent.click(onlineTab);

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    // Return to Welcome page
    const backBtn = screen.getByTitle('Back to Home');
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText('File Analyze Mode')).toBeDefined();
      expect(screen.getByText('Device Monitor Mode')).toBeDefined();
    });
  });

  it('keeps Connect SUTO Hardware dialog open when overlay is clicked, closing only via device-connect-close', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Detect & Connect Device'));

    await waitFor(() => {
      expect(screen.getByText('Connect SUTO Hardware')).toBeDefined();
    });

    // Clicking overlay should NOT close dialog
    const overlay = document.querySelector('.device-connect-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);

    expect(screen.getByText('Connect SUTO Hardware')).toBeDefined();

    // Clicking device-connect-close button closes it
    const closeBtn = document.querySelector('.device-connect-close');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Connect SUTO Hardware')).toBeNull();
    });
  });

  it('navigates back to Readout View when analyzing from readout, and returns to Home when opened directly', async () => {
    vi.spyOn(TauriSutoAPI, 'getLoggerFiles').mockResolvedValue([
      {
        fileName: 'LOG00086.CSD',
        startTime: '2026-10-20 02:00:00',
        endTime: '2026-10-20 03:00:00',
        channelsCount: 8,
        samplesPerChannel: 10,
        sampleRate: 1,
        description: 'Mock session',
        status: 0,
        isRecording: false,
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    // 1. Connect device and switch to Readout
    fireEvent.click(screen.getByText('Detect & Connect Device'));
    const usbBtn = await screen.findByText(/Detect & Connect USB/);
    fireEvent.click(usbBtn);

    await waitFor(() => {
      expect(screen.getByText('Online View')).toBeDefined();
    });

    const readoutTab = screen.getAllByText('Readout').find((el) => el.classList.contains('tab-btn'));
    fireEvent.click(readoutTab);

    await waitFor(() => {
      expect(document.querySelector('.readout-view-container')).toBeDefined();
    });

    // Wait for the mock file row to appear in the table
    await screen.findByText('LOG00086.CSD');

    // 2. Trigger Read Data
    const readDataBtn = screen.getByText('Read Selected Session to CSV');
    fireEvent.click(readDataBtn);

    // Wait for Analyze in S4A button to appear in the readout completion dialog
    const openInS4aBtn = await screen.findByText(/Analyze in S4A/);
    expect(openInS4aBtn).toBeDefined();

    // 3. Click Open in S4A to transition to Analyze mode
    fireEvent.click(openInS4aBtn);

    // Verify we are in Analyze mode and Graphic View is present
    await waitFor(() => {
      expect(screen.getByText('Graphic View')).toBeDefined();
    });

    // 4. Verify "Back to Readout" title on top-left back button
    const backToReadoutHeaderBtn = screen.getByTitle('Back to Readout');
    expect(backToReadoutHeaderBtn).toBeDefined();

    // 5. Click "Back to Readout" and verify we return to Readout view (not Home!)
    fireEvent.click(backToReadoutHeaderBtn);

    await waitFor(() => {
      expect(document.querySelector('.readout-view-container')).toBeDefined();
      expect(document.querySelector('.read-logger-title')?.textContent).toBe('Readout');
      // Home screen is NOT shown
      expect(screen.queryByText('File Analyze Mode')).toBeNull();
      // Device is still connected
      expect(screen.getByTitle('Back to Home')).toBeDefined();
    });

    // 6. Return to Home from Readout (disconnects monitor session)
    fireEvent.click(screen.getByTitle('Back to Home'));
    await waitFor(() => {
      expect(screen.getByText('File Analyze Mode')).toBeDefined();
    });

    // 7. Load a file directly from Home (simulate user picking a file)
    const validCsvContent = [
      'SUTO Device Raw Data',
      '',
      'Start Date Time,20.Oct 2026 02:00:00',
      'End Date Time,20.Oct 2026 02:00:02',
      'Sample Rate(sec),1',
      'NO.Of Channels,1',
      'NO.Of Records,2',
      '',
      'No.,Channel,Sensor,Unit,Resolution',
      '1,Flow,SUTO,m3/h,0.1',
      '',
      'Date Time,Flow',
      '20-10-2026 02:00:00,10.5',
      '20-10-2026 02:00:01,11.2',
    ].join('\r\n');
    await TestAPI.loadFile(new File([validCsvContent], 'direct_sample.csv', { type: 'text/csv' }));

    await waitFor(() => {
      expect(screen.getByText('Graphic View')).toBeDefined();
    });

    // Header back button must show "Back to Home", NOT "Back to Readout"
    expect(screen.queryByTitle('Back to Readout')).toBeNull();
    expect(screen.queryByText('Back to Readout')).toBeNull();
    const homeBackBtn = screen.getByTitle('Back to Home');
    expect(homeBackBtn).toBeDefined();

    // Clicking it returns to Home screen
    fireEvent.click(homeBackBtn);
    await waitFor(() => {
      expect(screen.getByText('File Analyze Mode')).toBeDefined();
    });
  });
});
