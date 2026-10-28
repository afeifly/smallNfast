import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import LineChart from './LineChart';
import GraphicView from './index';
import ChartController from './ChartController';
import TestAPI from '../../api/TestAPI';

vi.mock('../../api/TestAPI', () => {
  return {
    default: {
      getFileTimeRange: vi.fn(),
      getUserSettings: vi.fn((username, cb) => cb([
        {
          alias_name: 'Admin',
          display_channel_option: [
            {
              channel_id: { channel_id: 1, logic_channel_description: 'Humidity' },
              color: '#00B8D9',
            }
          ]
        }
      ])),
      getChannels: vi.fn((cb) => cb({
        logging_chs: [
          { channel_id: 1, logic_channel_description: 'Humidity', unit_in_ascii: '%' }
        ]
      })),
      getMeasurementData: vi.fn((chId, start, end, interval, way, cb) => cb([])),
      getMode: vi.fn(() => 'history'),
      onFileLoaded: vi.fn(),
    },
  };
});

describe('LineChart - Scale Actions Removal & Landscape Prompt', () => {
  it('does not render .scale-actions or zoom history buttons', () => {
    const cc = new ChartController();
    const { container } = render(<LineChart chartController={cc} />);

    expect(container.querySelector('.scale-actions')).toBeNull();
    expect(container.querySelector('[title="Previous scale"]')).toBeNull();
    expect(container.querySelector('[title="Next scale"]')).toBeNull();
    expect(container.querySelector('[title="Reset"]')).toBeNull();
  });

  it('renders centered landscape prompt with rotation icon and description, without bypass button', () => {
    const cc = new ChartController();
    const { container } = render(<LineChart chartController={cc} />);

    const prompt = container.querySelector('.landscape-prompt');
    expect(prompt).not.toBeNull();
    expect(container.querySelector('.landscape-rotate-icon')).not.toBeNull();
    expect(container.querySelector('.landscape-prompt-title')).not.toBeNull();
    expect(container.querySelector('.landscape-prompt-desc')).not.toBeNull();
    expect(container.querySelector('.landscape-view-anyway-btn')).toBeNull();
  });
});

describe('GraphicView - Curve Paging (< and > buttons)', () => {
  const fileStart = 1700000000000;
  const fileStop  = 1700003600000; // 1 hour span

  beforeEach(() => {
    vi.clearAllMocks();
    TestAPI.getFileTimeRange.mockReturnValue({
      start: fileStart,
      stop: fileStop,
    });
  });

  it('hides both < and > buttons when viewing the full curve range', async () => {
    let componentRef;
    render(<GraphicView ref={(r) => { componentRef = r; }} />);

    // Full range: start = fileStart, end = fileStop
    await act(async () => {
      componentRef.chartController.selectedChannels = [{ id: 1 }];
      componentRef.chartController.timePeriod = {
        start: new Date(fileStart),
        end: new Date(fileStop),
      };
      componentRef.setState({ noLoggingChannels: false });
      componentRef.checkPagingState();
    });

    const prevBtn = document.querySelector('button[aria-label="previous page"]');
    const nextBtn = document.querySelector('button[aria-label="next page"]');
    expect(prevBtn).toBeNull();
    expect(nextBtn).toBeNull();
  });

  it('shows both < and > buttons when zoomed into the middle of the curve', async () => {
    let componentRef;
    render(<GraphicView ref={(r) => { componentRef = r; }} />);

    // Zoom into 1000s window in the middle: fileStart + 1000s to fileStart + 2000s
    await act(async () => {
      componentRef.chartController.selectedChannels = [{ id: 1 }];
      componentRef.chartController.timePeriod = {
        start: new Date(fileStart + 1000000),
        end: new Date(fileStart + 2000000),
      };
      componentRef.setState({ noLoggingChannels: false });
      componentRef.checkPagingState();
    });

    const prevBtn = document.querySelector('button[aria-label="previous page"]');
    const nextBtn = document.querySelector('button[aria-label="next page"]');
    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
  });

  it('shows only > when at the start of the curve, and only < when at the end of the curve', async () => {
    let componentRef;
    render(<GraphicView ref={(r) => { componentRef = r; }} />);

    // At the start: fileStart to fileStart + 1000s
    await act(async () => {
      componentRef.chartController.selectedChannels = [{ id: 1 }];
      componentRef.chartController.timePeriod = {
        start: new Date(fileStart),
        end: new Date(fileStart + 1000000),
      };
      componentRef.setState({ noLoggingChannels: false });
      componentRef.checkPagingState();
    });

    expect(document.querySelector('button[aria-label="previous page"]')).toBeNull();
    expect(document.querySelector('button[aria-label="next page"]')).not.toBeNull();

    // At the end: fileStop - 1000s to fileStop
    await act(async () => {
      componentRef.chartController.timePeriod = {
        start: new Date(fileStop - 1000000),
        end: new Date(fileStop),
      };
      componentRef.checkPagingState();
    });

    expect(document.querySelector('button[aria-label="previous page"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="next page"]')).toBeNull();
  });

  it('moves previous and next page properly and clamps to bounds', async () => {
    let componentRef;
    render(<GraphicView ref={(r) => { componentRef = r; }} />);

    // Middle window: 1000s to 2000s (duration 1000s)
    await act(async () => {
      componentRef.chartController.selectedChannels = [{ id: 1 }];
      componentRef.chartController.timePeriod = {
        start: new Date(fileStart + 1000000),
        end: new Date(fileStart + 2000000),
      };
      componentRef.setState({ noLoggingChannels: false });
      componentRef.checkPagingState();
    });

    // Move prev
    await act(async () => {
      componentRef.movePrevPage();
    });

    expect(componentRef.chartController.timePeriod.start.getTime()).toBe(fileStart);
    expect(componentRef.chartController.timePeriod.end.getTime()).toBe(fileStart + 1000000);
    expect(document.querySelector('button[aria-label="previous page"]')).toBeNull();
    expect(document.querySelector('button[aria-label="next page"]')).not.toBeNull();

    // Move next twice
    await act(async () => {
      componentRef.moveNextPage();
    });
    expect(componentRef.chartController.timePeriod.start.getTime()).toBe(fileStart + 1000000);
    expect(componentRef.chartController.timePeriod.end.getTime()).toBe(fileStart + 2000000);

    await act(async () => {
      componentRef.moveNextPage();
    });
    expect(componentRef.chartController.timePeriod.start.getTime()).toBe(fileStart + 2000000);
    expect(componentRef.chartController.timePeriod.end.getTime()).toBe(fileStart + 3000000);
  });
});

describe('HeaderLegend & Landscape Space Optimization', () => {
  it('renders HeaderLegend inside .graphic-view .app-window-title to the left of .window-title-right-area', async () => {
    let componentRef;
    render(<GraphicView ref={(ref) => { componentRef = ref; }} />);

    const channels = [
      { id: 1, name: 'Pressure', unit: 'bar', color: '#00ac86', visible: true },
      { id: 2, name: 'Temperature', unit: '℃', color: '#ff5722', visible: true }
    ];

    await act(async () => {
      componentRef.chartController.selectedChannels = channels;
      componentRef.changeSelectedChannelsHandler();
    });

    const windowTitle = document.querySelector('.graphic-view .app-window-title');
    expect(windowTitle).not.toBeNull();

    const headerLegend = windowTitle.querySelector('.header-legend-wrapper');
    expect(headerLegend).not.toBeNull();

    const items = headerLegend.querySelectorAll('.header-legend-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Pressure (bar)');
    expect(items[1].textContent).toContain('Temperature (℃)');

    // Ensure it is positioned before .window-title-right-area
    const rightArea = windowTitle.querySelector('.window-title-right-area');
    expect(headerLegend.compareDocumentPosition(rightArea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('correctly detects small-screen landscape mode to save curve space', async () => {
    const { isSmallLandscapeMode } = await import('./LineChart');

    // Case 1: Normal desktop mode (matchMedia returns false)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(isSmallLandscapeMode()).toBe(false);

    // Case 2: iPhone 16 Landscape mode (matchMedia returns true)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('max-height') || query.includes('landscape'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(isSmallLandscapeMode()).toBe(true);
  });
});

