import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import LiveGraphicView from './LiveGraphicView';
import * as liveRecorder from '../../util/liveRecorder';

// jsdom lacks SVGElement.getBBox (used by the chart legend layout); every
// real browser / webview implements it, so polyfill a fixed box for tests.
beforeAll(() => {
  if (!window.SVGElement.prototype.getBBox) {
    window.SVGElement.prototype.getBBox = function getBBox() {
      return { x: 0, y: 0, width: 120, height: 20 };
    };
  }
});

describe('LiveGraphicView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
  });

  afterEach(() => {
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
    vi.useRealTimers();
  });

  it('mounts, consumes recorder samples and shows the toolbar', () => {
    render(<LiveGraphicView />);

    // Recording starts while the view is already mounted (auto-switch case is
    // the reverse — both paths must work without crashing).
    act(() => {
      liveRecorder.start({ deviceName: 'SUTO S331', getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: 42.5, unit: 'm³/h', resolution: 1, status: 'normal' },
        { channel_id: 2, current_value: 4.1, unit: 'm/s', resolution: 2, status: 'normal' },
      ]);
    });

    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('60 min')).toBeTruthy();

    // More samples keep flowing — no crash, counter updates.
    act(() => {
      liveRecorder.feed([
        { channel_id: 1, current_value: 43.0, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });
    expect(screen.getByText(/samples/)).toBeTruthy();
  });

  it('renders an empty state before any samples arrive', () => {
    render(<LiveGraphicView />);
    act(() => {
      liveRecorder.start({ deviceName: 'SUTO S331', getChannels: () => [] });
    });
    expect(screen.getByText('Recording')).toBeTruthy();
  });
});
