import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoggerSettings from './LoggerSettings';
import { LanguageProvider } from '../context/LanguageContext';

const mockSetConfigData = vi.fn();
let mockConfigs = {};

vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({
    configData: {
      configs: mockConfigs
    },
    setConfigData: mockSetConfigData
  })
}));

describe('LoggerSettings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs = {
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            Name: 'Sensor 1',
            cfgchannel: [
              {
                ChannelId: 0,
                ChannelDescription: 'Flow Rate',
                UnitInASCII: 'm3/h',
                CreateTime: '10001',
                Logger: false
              },
              {
                ChannelId: 1,
                ChannelDescription: 'Pressure',
                UnitInASCII: 'bar',
                CreateTime: '10002',
                Logger: false
              }
            ]
          }
        ]
      },
      'config/cfglogger.json': {
        logger: {
          mode: 0,
          filename: 'testlog',
          starttime: 1784822400, // 10-digit seconds
          samplerate: 10,
          channels: 1,
          channelArray: [
            { channelid: 0, meapoint: 'Point 1', location: 'Plant' }
          ]
        }
      }
    };
  });

  it('renders logger settings details correctly', () => {
    render(
      <LanguageProvider>
        <LoggerSettings />
      </LanguageProvider>
    );

    expect(screen.getByText('Logger settings')).toBeInTheDocument();
    expect(screen.getByText('testlog')).toBeInTheDocument();
    expect(screen.getAllByText('10s')[0]).toBeInTheDocument();
    expect(screen.getByText('Flow Rate')).toBeInTheDocument();
  });

  it('defaults logger rate to 10s when opening edit drawer with no prior rate', () => {
    mockConfigs['config/cfglogger.json'].logger.samplerate = undefined;

    render(
      <LanguageProvider>
        <LoggerSettings />
      </LanguageProvider>
    );

    const editBtn = document.querySelector('.btn-header-edit');
    fireEvent.click(editBtn);

    expect(screen.getByText('Logger configuration file detail')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10s')).toBeInTheDocument();
  });

  it('converts millisecond timestamps to seconds and syncs channel Logger flags on save', () => {
    render(
      <LanguageProvider>
        <LoggerSettings />
      </LanguageProvider>
    );

    // Open drawer
    const editBtn = document.querySelector('.btn-header-edit');
    fireEvent.click(editBtn);

    // Click Submit in drawer footer
    const saveBtn = screen.getByText('Submit');
    fireEvent.click(saveBtn);

    expect(mockSetConfigData).toHaveBeenCalled();
    const updatedConfigData = mockSetConfigData.mock.calls[0][0];
    const logger = updatedConfigData.configs['config/cfglogger.json'].logger;
    const channels = updatedConfigData.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0].cfgchannel;

    // Verify starttime is in seconds (<= 1e11)
    expect(logger.starttime).toBeLessThan(1e11);
    // Verify channel 0 (which is in channelArray) has Logger: true
    expect(channels[0].Logger).toBe(true);
    // Verify channel 1 (not in channelArray) has Logger: false
    expect(channels[1].Logger).toBe(false);
  });
});
