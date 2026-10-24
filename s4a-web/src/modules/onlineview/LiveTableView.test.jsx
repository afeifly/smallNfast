import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import LiveTableView from './LiveTableView';
import * as liveRecorder from '../../util/liveRecorder';

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
  });

  afterEach(() => {
    if (liveRecorder.getRecorderState().recording) liveRecorder.stop();
    liveRecorder.clearSession();
    vi.useRealTimers();
  });

  it('renders samples newest-first and follows live updates', () => {
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', getChannels: () => [] });
      liveRecorder.feed([{ channel_id: 1, current_value: 11, unit: 'm³/h', resolution: 0, status: 'normal' }]);
      liveRecorder.feed([{ channel_id: 1, current_value: 22, unit: 'm³/h', resolution: 0, status: 'normal' }]);
      liveRecorder.feed([{ channel_id: 1, current_value: 33, unit: 'm³/h', resolution: 0, status: 'normal' }]);
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3 samples
    expect(rows[1].textContent).toContain('33'); // newest on top
    expect(rows[3].textContent).toContain('11'); // oldest at the bottom
  });

  it('freezes while scrolled away, shows the pending pill, resumes at top', () => {
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', getChannels: () => [] });
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

  it('shows invalid samples as empty cells', () => {
    render(<LiveTableView />);
    act(() => {
      liveRecorder.start({ deviceName: 'T', getChannels: () => [] });
      liveRecorder.feed([
        { channel_id: 1, current_value: null, unit: 'm³/h', resolution: 1, status: 'invalid' },
      ]);
    });
    const cells = screen.getAllByRole('cell');
    expect(cells[1].textContent).toBe(''); // first data cell after the time cell
  });
});
