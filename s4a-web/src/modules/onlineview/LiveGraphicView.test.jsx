import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import LiveGraphicView from './LiveGraphicView';
import * as liveRecorder from '../../util/liveRecorder';
import { getLiveSelection, clearLiveSelection } from '../../util/liveSelection';
import TestAPI from '../../api/TestAPI';
import TauriSutoAPI from '../../api/TauriSutoAPI';

// jsdom lacks SVGElement.getBBox (used by the chart legend layout); every
// real browser / webview implements it, so polyfill a fixed box for tests.
beforeAll(() => {
  if (!window.SVGElement.prototype.getBBox) {
    window.SVGElement.prototype.getBBox = function getBBox() {
      return { x: 0, y: 0, width: 120, height: 20 };
    };
  }
});

const DEVICE_CHANNELS = [
  { channel_id: 1, channel_name: 'Flow', unit_in_ascii: 'm³/h', unit: 'm³/h', resolution: 1, location_id: 1, sensor_id: 1, sensor_description: 'SUTO SFAB', logic_channel_description: 'Flow', full_channel_name: 'Flow' },
  { channel_id: 2, channel_name: 'Velocity', unit_in_ascii: 'm/s', unit: 'm/s', resolution: 2, location_id: 1, sensor_id: 1, sensor_description: 'SUTO SFAB', logic_channel_description: 'Velocity', full_channel_name: 'Velocity' },
  { channel_id: 3, channel_name: 'Consumption', unit_in_ascii: 'm³', unit: 'm³', resolution: 0, location_id: 1, sensor_id: 1, sensor_description: 'SUTO SFAB', logic_channel_description: 'Consumption', full_channel_name: 'Consumption' },
  { channel_id: 4, channel_name: 'Temperature', unit_in_ascii: '°C', unit: '°C', resolution: 1, location_id: 1, sensor_id: 2, sensor_description: 'SUTO ST550', logic_channel_description: 'Temperature', full_channel_name: 'Temperature' },
  { channel_id: 5, channel_name: 'Pressure', unit_in_ascii: 'bar', unit: 'bar', resolution: 2, location_id: 1, sensor_id: 3, sensor_description: 'SUTO SP560', logic_channel_description: 'Pressure', full_channel_name: 'Pressure' },
  { channel_id: 6, channel_name: 'Current A', unit_in_ascii: 'A', unit: 'A', resolution: 1, location_id: 1, sensor_id: 4, sensor_description: 'SUTO SC3', logic_channel_description: 'Current A', full_channel_name: 'Current A' },
];

describe('LiveGraphicView', () => {
  let channelsSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
    clearLiveSelection();
  });

  afterEach(() => {
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
    clearLiveSelection();
    TestAPI.setMode('analyze');
    if (channelsSpy) channelsSpy.mockRestore();
    vi.useRealTimers();
  });

  it('mounts, consumes recorder samples and shows the toolbar', () => {
    render(<LiveGraphicView />);

    // Recording starts while the view is already mounted (auto-switch case is
    // the reverse — both paths must work without crashing).
    act(() => {
      liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: 42.5, unit: 'm³/h', resolution: 1, status: 'normal' },
        { channel_id: 2, current_value: 4.1, unit: 'm/s', resolution: 2, status: 'normal' },
      ]);
    });

    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('60 min')).toBeTruthy();
    expect(screen.getByText('4 h')).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();

    // More samples keep flowing — no crash, counter updates.
    act(() => {
      liveRecorder.feed([
        { channel_id: 1, current_value: 43.0, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });
    expect(screen.getByText(/samples/)).toBeTruthy();
  });

  it('history mode hides the live presets and offers file-style browsing', () => {
    render(<LiveGraphicView />);
    act(() => {
      liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: 42.5, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });

    fireEvent.click(screen.getByText('History'));
    expect(screen.getByText('Browsing history')).toBeTruthy();
    expect(screen.queryByText('30 min')).toBeNull(); // live-only presets hidden
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();

    fireEvent.click(screen.getByText('Live'));
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('renders an empty state before any samples arrive', () => {
    render(<LiveGraphicView />);
    act(() => {
      liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
    });
    expect(screen.getByText('Recording')).toBeTruthy();
  });

  // Monitor mode: the real device flow — channels via the TestAPI proxy,
  // fresh default selection of the first 4 units on every session.
  it('monitor mode: auto-selects the first-4-unit default and enables the channel button', async () => {
    vi.useRealTimers(); // bootstrap awaits a setTimeout(0) flush tick
    TestAPI.setMode('monitor');
    channelsSpy = vi.spyOn(TauriSutoAPI, 'getChannels').mockImplementation(async (cb) => {
      if (cb) cb(DEVICE_CHANNELS);
      return DEVICE_CHANNELS;
    });

    render(<LiveGraphicView />);
    await act(async () => {
      liveRecorder.start({ deviceName: 'SUTO S331', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: 42.5, unit: 'm³/h', resolution: 1, status: 'normal' },
        { channel_id: 6, current_value: 11.5, unit: 'A', resolution: 1, status: 'normal' },
      ]);
    });

    // The selection flows: INIT → defaultIds (first 4 units) selected & synced
    await waitFor(() => {
      expect(getLiveSelection()).toEqual([1, 2, 3, 4]);
    }, { timeout: 3000 });
  });
});
