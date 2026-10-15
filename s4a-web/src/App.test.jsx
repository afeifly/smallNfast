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

  it('connects to device monitor mode and renders the 3 monitor tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    const detectBtn = screen.getByText('Detect & Connect Device');
    fireEvent.click(detectBtn);

    await waitFor(() => {
      expect(screen.getByText('Online View')).toBeDefined();
      expect(screen.getByText('Graphic View')).toBeDefined();
      expect(screen.getByText('Table View')).toBeDefined();
    });
  });

  it('switches between monitor tabs and returns to welcome page', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detect & Connect Device')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Detect & Connect Device'));

    await waitFor(() => {
      expect(screen.getByText('Online View')).toBeDefined();
    });

    // Switch to Graphic View
    fireEvent.click(screen.getByText('Graphic View'));
    await waitFor(() => {
      expect(screen.getByText('Graphic View').classList.contains('active')).toBe(true);
    });

    // Switch to Table View
    fireEvent.click(screen.getByText('Table View'));
    await waitFor(() => {
      expect(screen.getByText('Table View').classList.contains('active')).toBe(true);
    });

    // Return to Welcome page
    const welcomeBtn = screen.getByText('← Welcome');
    fireEvent.click(welcomeBtn);

    await waitFor(() => {
      expect(screen.getByText('File Analyze Mode')).toBeDefined();
      expect(screen.getByText('Device Monitor Mode')).toBeDefined();
    });
  });
});
