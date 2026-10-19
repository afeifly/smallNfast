import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from './App';
import TestAPI from './api/TestAPI';

describe('App', () => {
  beforeEach(() => {
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

  it('opens Readout modal and verifies pausing polling and navigation', async () => {
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

    // Click Readout button in header
    const readoutBtn = screen.getByText('Readout');
    fireEvent.click(readoutBtn);

    // Modal should be open (Readout)
    await waitFor(() => {
      expect(document.querySelector('.read-logger-title')?.textContent).toBe('Readout');
    });

    // Close modal
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);

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
});
