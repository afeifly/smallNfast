import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectSessionModal from './SelectSessionModal';
import FileAnalyzeAPI from '../api/FileAnalyzeAPI';

vi.mock('../api/FileAnalyzeAPI', () => ({
  default: {
    selectStdbSession: vi.fn(),
    cancelStdbSession: vi.fn(),
    getStdbSessionDetails: vi.fn(),
    openStdbAppendFile: vi.fn()
  }
}));

vi.mock('react-intl-universal', () => ({ default: { get: () => '' } }));

function showSessions(sessions) {
  act(() => {
    window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
      detail: { file: { name: 'Logger.stdb' }, sessions }
    }));
  });
}

describe('STDB session selection', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preselects the only recording and opens it only after confirmation', async () => {
    const session = { id: 1, loggerFileName: 'Only recording', startTimeStamp: 1000 };
    FileAnalyzeAPI.selectStdbSession.mockResolvedValue();
    render(<SelectSessionModal />);
    showSessions([session]);

    expect(screen.getByRole('radio', { name: 'Only recording' })).toBeChecked();
    expect(FileAnalyzeAPI.selectStdbSession).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open File' })));
    expect(FileAnalyzeAPI.selectStdbSession).toHaveBeenCalledWith(session);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('preselects the first recording and allows choosing an older one', async () => {
    const newest = { id: 2, loggerFileName: 'Newest', startTimeStamp: 2000 };
    const older = { id: 1, loggerFileName: 'Older', startTimeStamp: 1000 };
    FileAnalyzeAPI.selectStdbSession.mockResolvedValue();
    render(<SelectSessionModal />);
    showSessions([newest, older]);
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Newest');
    expect(rows[2]).toHaveTextContent('Older');
    expect(screen.getByRole('radio', { name: 'Newest' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Older' }));
    expect(screen.getByRole('radio', { name: 'Older' })).toBeChecked();
    expect(FileAnalyzeAPI.selectStdbSession).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open File' })));
    expect(FileAnalyzeAPI.selectStdbSession).toHaveBeenCalledWith(older);
  });

  it('cancels without loading a recording and preselects again on reopening', () => {
    render(<SelectSessionModal />);
    showSessions([{ id: 1, loggerFileName: 'First' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(FileAnalyzeAPI.cancelStdbSession).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.selectStdbSession).not.toHaveBeenCalled();
    showSessions([{ id: 2, loggerFileName: 'Next' }]);
    expect(screen.getByRole('radio', { name: 'Next' })).toBeChecked();
  });

  it('offers another STDB and appends the chosen session', async () => {
    FileAnalyzeAPI.selectStdbSession.mockResolvedValue();
    render(<SelectSessionModal />);
    const session = { id: 2, loggerFileName: 'Older' };
    act(() => window.dispatchEvent(new CustomEvent('stdbSessionsAvailable', {
      detail: { file: { name: 'Logger.stdb' }, sessions: [session], mode: 'append' }
    })));
    expect(screen.getByRole('dialog')).toHaveTextContent('Append Recording Session');
    fireEvent.click(screen.getByRole('button', { name: 'Choose STDB File...' }));
    expect(FileAnalyzeAPI.openStdbAppendFile).toHaveBeenCalledOnce();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Append Session' })));
    expect(FileAnalyzeAPI.selectStdbSession).toHaveBeenCalledWith(session);
  });

  it('shows an empty picker without a selection or detail action', async () => {
    FileAnalyzeAPI.getStdbSessionDetails.mockResolvedValue({
      session: { LoggerFileName: 'First' },
      channels: [{ channel_id: 0, logic_channel_description: 'Old channel' }]
    });
    render(<SelectSessionModal />);
    showSessions([{ id: 1, loggerFileName: 'First' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    expect(await screen.findByText('Old channel')).toBeInTheDocument();

    showSessions([]);
    expect(screen.getByText(/No recording sessions found/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Detail/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Old channel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(FileAnalyzeAPI.cancelStdbSession).toHaveBeenCalledOnce();
    expect(FileAnalyzeAPI.selectStdbSession).not.toHaveBeenCalled();
  });

  it('shows selected recording metadata and channels without opening it', async () => {
    const newest = { id: 2, loggerFileName: 'Newest', startTimeStamp: 2000 };
    const older = { id: 1, loggerFileName: 'Older', startTimeStamp: 1000 };
    FileAnalyzeAPI.getStdbSessionDetails.mockResolvedValueOnce({
      session: { LoggerFileName: 'Newest', StartTimeStamp: 2000, EndTimeStamp: 3000 },
      channels: [{ channel_id: 0, logic_channel_description: 'Temperature', sensor_description: 'S040', unit_in_ascii: 'C', resolution: 2, min: 1, max: 5 }]
    }).mockResolvedValueOnce({
      session: { LoggerFileName: 'Older' },
      channels: [{ channel_id: 0, logic_channel_description: 'Pressure' }]
    });
    render(<SelectSessionModal />);
    showSessions([newest, older]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    expect(await screen.findByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('S040')).toBeInTheDocument();
    expect(screen.getByText('1.00~5.00')).toBeInTheDocument();
    expect(FileAnalyzeAPI.getStdbSessionDetails).toHaveBeenCalledWith(2);
    expect(FileAnalyzeAPI.selectStdbSession).not.toHaveBeenCalled();
    const picker = screen.getAllByRole('table')[0];
    expect(within(picker).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Session Name', 'Start Time']);
    expect(screen.getByRole('button', { name: 'Hide Detail' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Older' }));
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
    expect(await screen.findByText('Pressure')).toBeInTheDocument();
    expect(FileAnalyzeAPI.getStdbSessionDetails).toHaveBeenLastCalledWith(1);
    expect(FileAnalyzeAPI.getStdbSessionDetails).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Detail' }));
    expect(screen.queryByText('Pressure')).not.toBeInTheDocument();
    expect(within(picker).getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Show Detail' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('discards a pending detail request if selection changes', async () => {
    let finishFirst;
    let finishSecond;
    FileAnalyzeAPI.getStdbSessionDetails
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
    render(<SelectSessionModal />);
    showSessions([{ id: 2, loggerFileName: 'Newest' }, { id: 1, loggerFileName: 'Older' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Older' }));
    await act(async () => finishSecond({
      session: { LoggerFileName: 'Older' },
      channels: [{ channel_id: 0, logic_channel_description: 'Current channel' }]
    }));
    await act(async () => finishFirst({
      session: { LoggerFileName: 'Newest' },
      channels: [{ channel_id: 0, logic_channel_description: 'Stale channel' }]
    }));
    expect(screen.queryByText('Stale channel')).not.toBeInTheDocument();
    expect(screen.getByText('Current channel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Detail' })).toBeEnabled();
  });

  it('discards a pending request when details are hidden', async () => {
    let finish;
    FileAnalyzeAPI.getStdbSessionDetails.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<SelectSessionModal />);
    showSessions([{ id: 1, loggerFileName: 'Recording' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Detail' }));
    await act(async () => finish({
      session: { LoggerFileName: 'Recording' },
      channels: [{ channel_id: 0, logic_channel_description: 'Hidden channel' }]
    }));
    expect(screen.queryByText('Hidden channel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open File' })).toBeEnabled();
  });

  it('reports detail read errors and keeps the recording picker open', async () => {
    const notify = vi.fn();
    vi.stubGlobal('showAppNotification', notify);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    FileAnalyzeAPI.getStdbSessionDetails.mockRejectedValue(new Error('Missing channel table'));
    render(<SelectSessionModal />);
    showSessions([{ id: 1, loggerFileName: 'Recording' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to read recording details', 'Missing channel table', 'error'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores a detail request failure after cancelling the picker', async () => {
    let fail;
    const notify = vi.fn();
    vi.stubGlobal('showAppNotification', notify);
    FileAnalyzeAPI.getStdbSessionDetails.mockImplementation(() => new Promise((resolve, reject) => { fail = reject; }));
    render(<SelectSessionModal />);
    showSessions([{ id: 1, loggerFileName: 'Recording' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Detail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => fail(new Error('STDB file was closed.')));
    expect(notify).not.toHaveBeenCalled();
    expect(FileAnalyzeAPI.cancelStdbSession).toHaveBeenCalledOnce();
  });
});
