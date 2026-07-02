import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalogDigitalInput from './AnalogDigitalInput';
import { LanguageProvider } from '../../context/LanguageContext';
import * as remarshalUtils from '../../util/remarshalUtils';

// Mock context and utilities
const mockSetConfigData = vi.fn();
let mockConfigs = {};

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({
    configData: {
      configs: mockConfigs,
      fileMap: new Map()
    },
    setConfigData: mockSetConfigData
  })
}));

describe('AnalogDigitalInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs = {
      'config/cfgOptionBoard.json': {
        cfgOptionBoard: [
          {
            ChannelId: 2009,
            ChannelDescription: 'Analog Input 1',
            OptionBoardType: 0,
            TerminalNo: 9,
            Resolution: 1,
            CreateTime: 'ab-create-time-1'
          }
        ]
      },
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: []
      }
    };
  });

  it('renders Analog & Digital Input list and displays existing channels', () => {
    render(
      <LanguageProvider>
        <AnalogDigitalInput />
      </LanguageProvider>
    );

    expect(screen.getByText('Analog & digital input list')).toBeInTheDocument();
    expect(screen.getByText('Analog Input 1')).toBeInTheDocument();
  });

  it('displays restricted dialog when deleting a channel used in logger/alarm/layout', async () => {
    vi.spyOn(remarshalUtils, 'isChannelUsedInLogger').mockReturnValue(true);
    vi.spyOn(remarshalUtils, 'isChannelUsedInAlarm').mockResolvedValue(false);
    vi.spyOn(remarshalUtils, 'isChannelUsedInLayout').mockReturnValue(false);

    render(
      <LanguageProvider>
        <AnalogDigitalInput />
      </LanguageProvider>
    );

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete Restricted')).toBeInTheDocument();
      expect(screen.getByText(/currently used in Logger settings/)).toBeInTheDocument();
    });
  });

  it('displays confirmation dialog and triggers deletion if unused', async () => {
    vi.spyOn(remarshalUtils, 'isChannelUsedInLogger').mockReturnValue(false);
    vi.spyOn(remarshalUtils, 'isChannelUsedInAlarm').mockResolvedValue(false);
    vi.spyOn(remarshalUtils, 'isChannelUsedInLayout').mockReturnValue(false);

    render(
      <LanguageProvider>
        <AnalogDigitalInput />
      </LanguageProvider>
    );

    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Delete Confirmation')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);

    expect(mockSetConfigData).toHaveBeenCalled();
  });
});
