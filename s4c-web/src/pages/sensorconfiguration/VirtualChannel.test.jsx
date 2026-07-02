import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VirtualChannel from './VirtualChannel';
import { LanguageProvider } from '../../context/LanguageContext';
import * as remarshalUtils from '../../util/remarshalUtils';

// Mock the context and utilities
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

describe('VirtualChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs = {
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            isVirtualSensor: true,
            CreateTime: 'vs-sensor-id',
            cfgchannel: [
              {
                ChannelId: 0,
                ChannelDescription: 'Virtual CH 1',
                Formula: '1+1',
                UnitInASCII: 'kW',
                Resolution: 1,
                Logger: true,
                isVirtualSensor: true,
                CreateTime: 'vc-create-time-1'
              }
            ]
          }
        ]
      }
    };
  });

  it('renders virtual channel page and displays existing channels', () => {
    render(
      <LanguageProvider>
        <VirtualChannel />
      </LanguageProvider>
    );

    expect(screen.getByText('Virtual channel list')).toBeInTheDocument();
    expect(screen.getByText('Virtual CH 1')).toBeInTheDocument();
    expect(screen.getByText('1+1')).toBeInTheDocument();
  });

  it('displays restricted dialog when deleting a channel used in logger/alarm/layout', async () => {
    // Mock isChannelUsedInLogger to return true
    vi.spyOn(remarshalUtils, 'isChannelUsedInLogger').mockReturnValue(true);
    vi.spyOn(remarshalUtils, 'isChannelUsedInAlarm').mockResolvedValue(false);
    vi.spyOn(remarshalUtils, 'isChannelUsedInLayout').mockReturnValue(false);

    render(
      <LanguageProvider>
        <VirtualChannel />
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
        <VirtualChannel />
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
    const updatedConfig = mockSetConfigData.mock.calls[0][0];
    const updatedChannels = updatedConfig.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0].cfgchannel;
    expect(updatedChannels.length).toBe(0);
  });
});
