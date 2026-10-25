import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import LiveTableView from './LiveTableView';
import * as liveRecorder from '../../util/liveRecorder';
import { setLiveSelection, clearLiveSelection } from '../../util/liveSelection';

// jsdom has no layout: drive scroll purely through scrollTop + scroll events.
function getScrollEl() {
  return document.querySelector('.live-table-scroll');
}

function scrollTo(top) {
  const el = getScrollEl();
  el.scrollTop = top;
  fireEvent.scroll(el);
}

describe('LiveTableView', () => {
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
    vi.useRealTimers();
  });

  it('renders selected samples newest-first and follows live updates', () => {
    setLiveSelection([1]);
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([{ channel_id: 1, current_value: 11, unit: 'm³/h', resolution: 0, status: 'normal' }]);
      liveRecorder.feed([{ channel_id: 1, current_value: 22, unit: 'm³/h', resolution: 0, status: 'normal' }]);
      liveRecorder.feed([{ channel_id: 1, current_value: 33, unit: 'm³/h', resolution: 0, status: 'normal' }]);
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3 samples
    expect(rows[1].textContent).toContain('33'); // newest on top
    expect(rows[3].textContent).toContain('11'); // oldest at the bottom
  });

  it('columns follow the Graphic View selection', () => {
    setLiveSelection([1]);
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: 1, unit: 'm³/h', resolution: 0, status: 'normal' },
        { channel_id: 2, current_value: 2, unit: 'm/s', resolution: 0, status: 'normal' },
      ]);
    });
    expect(screen.getAllByRole('columnheader')).toHaveLength(2); // Date Time + channel 1

    // The graphic view checks channel 2 (and unchecks 1)
    act(() => {
      setLiveSelection([2]);
    });
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[1].textContent).toContain('m/s');
  });

  it('shows a hint when no channel is selected', () => {
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([{ channel_id: 1, current_value: 1, unit: 'm³/h', resolution: 0, status: 'normal' }]);
    });
    expect(screen.getByText(/No channels selected/i)).toBeTruthy();
  });

  it('freezes while scrolled away, shows the pending pill, resumes at top', () => {
    setLiveSelection([1]);
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([{ channel_id: 1, current_value: 1, unit: 'm³/h', resolution: 0, status: 'normal' }]);
    });

    // Scroll away → paused
    act(() => scrollTo(120));

    act(() => {
      liveRecorder.feed([{ channel_id: 1, current_value: 2, unit: 'm³/h', resolution: 0, status: 'normal' }]);
    });

    expect(screen.getAllByRole('row')).toHaveLength(2); // frozen: header + 1 row
    expect(screen.getByText(/1 new row/i)).toBeTruthy();

    // Back to the top → flush and follow again
    act(() => scrollTo(0));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByText(/new row/i)).toBeNull();
  });

  it('shows invalid samples as --.-', () => {
    setLiveSelection([1]);
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: null, unit: 'm³/h', resolution: 1, status: 'invalid' },
      ]);
    });
    const cells = screen.getAllByRole('cell');
    expect(cells[1].textContent).toBe('--.-'); // first data cell after the time cell
  });

  it('shows SUTO sentinel values (-9999 / -8888) as --.-', () => {
    setLiveSelection([1]);
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', intervalSec: 0, getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: -9999, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });
    act(() => {
      liveRecorder.feed([
        { channel_id: 1, current_value: -8888, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });
    act(() => {
      // Other negative values are real data — NOT sentinels
      liveRecorder.feed([
        { channel_id: 1, current_value: -8500, unit: 'm³/h', resolution: 1, status: 'normal' },
      ]);
    });
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('-8500.0'); // newest: plain number
    expect(rows[2].textContent).toContain('--.-'); // -8888
    expect(rows[3].textContent).toContain('--.-'); // -9999
  });
});
