import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import TableView from './TableView';
import TestAPI from '../../api/TestAPI';

vi.mock('../../api/TestAPI', () => {
  return {
    default: {
      getChannels: vi.fn(),
      getFileTimeRange: vi.fn(),
      getTablePage: vi.fn(),
    },
  };
});

describe('TableView - Columns Toggle Controls', () => {
  const mockChannels = [
    { channel_id: 1, logic_channel_description: 'Flow Rate', sensor_description: 'Flow Sensor', unit_in_ascii: 'm³/h' },
    { channel_id: 2, logic_channel_description: 'Pressure', sensor_description: 'Pressure Sensor', unit_in_ascii: 'bar' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    TestAPI.getChannels.mockImplementation((cb) => {
      cb({ logging_chs: mockChannels });
    });
    TestAPI.getFileTimeRange.mockReturnValue({
      start: 1700000000000,
      stop: 1700003600000,
    });
    TestAPI.getTablePage.mockImplementation((pageIndex, pageSize, selectedChannelIds, cb) => {
      cb({
        rows: [
          { index: 0, timestampMs: 1700000000000, values: { 1: 12.34, 2: 5.6 } },
        ],
        total: 10,
        startTimeMs: 1700000000000,
        stopTimeMs: 1700003600000,
        sampleRate: 1,
      });
    });
  });

  it('renders icon toggle button in toolbar and toggles sidebar expansion', () => {
    render(<TableView />);

    // Toggle button should be present in toolbar as compact icon button
    const toggleBtn = document.querySelector('.toggle-columns-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-label', 'Hide Columns');
    expect(toggleBtn).toHaveAttribute('title', 'Hide Columns');

    // By default on desktop (window.innerWidth defaults to 1024 in jsdom), sidebar is expanded
    const sidebar = document.querySelector('.table-sidebar');
    expect(sidebar).toHaveClass('expanded');
    expect(sidebar).not.toHaveClass('collapsed');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Click toggle button -> collapses sidebar
    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveClass('collapsed');
    expect(sidebar).not.toHaveClass('expanded');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show Columns');

    // Click toggle button again -> re-expands sidebar
    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveClass('expanded');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses sidebar when close button in sidebar header is clicked', () => {
    render(<TableView />);

    const sidebar = document.querySelector('.table-sidebar');
    expect(sidebar).toHaveClass('expanded');

    const closeBtn = screen.getByRole('button', { name: /close columns panel/i });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(sidebar).toHaveClass('collapsed');
  });

  it('collapses sidebar when mobile Apply & Close button is clicked', () => {
    render(<TableView />);

    const sidebar = document.querySelector('.table-sidebar');
    expect(sidebar).toHaveClass('expanded');

    const doneBtn = screen.getByRole('button', { name: /apply & close/i });
    expect(doneBtn).toBeInTheDocument();

    fireEvent.click(doneBtn);
    expect(sidebar).toHaveClass('collapsed');
  });

  it('collapses sidebar when backdrop is clicked', () => {
    render(<TableView />);

    const sidebar = document.querySelector('.table-sidebar');
    expect(sidebar).toHaveClass('expanded');

    const backdrop = document.querySelector('.table-sidebar-backdrop');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop);
    expect(sidebar).toHaveClass('collapsed');
  });
});
