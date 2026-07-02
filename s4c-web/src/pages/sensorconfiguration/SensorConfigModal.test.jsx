import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SensorConfigModal from './SensorConfigModal';
import { LanguageProvider } from '../../context/LanguageContext';

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

describe('SensorConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs = {
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: []
      }
    };
  });

  it('renders modal and sets default data types for new channels to FLOAT_L (8)', async () => {
    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={null}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    // Click "Add Channel"
    const addChannelBtn = screen.getByText(/Add channel/i);
    fireEvent.click(addChannelBtn);

    // Verify a new channel row is created
    expect(screen.getByText('New Channel')).toBeInTheDocument();

    // Confirm the new channel in EditChannelModal first
    const editConfirmBtn = document.querySelector('.btn-edit-confirm');
    fireEvent.click(editConfirmBtn);

    // Confirm the sensor list changes in SensorConfigModal
    const sensorConfirmBtn = document.querySelector('.btn-confirm');
    fireEvent.click(sensorConfirmBtn);

    expect(mockSetConfigData).toHaveBeenCalled();
    const updatedConfig = mockSetConfigData.mock.calls[0][0];
    const newSensor = updatedConfig.configs['config/SUTO-SensorList.sutolist'].cfgsensor[0];
    expect(newSensor.cfgchannel[0].InDataType).toBe(8);
    expect(newSensor.cfgchannel[0].OutDataType).toBe(8);
  });

  it('validates and blocks save if multiple channels share the same address', async () => {
    const existingSensor = {
      Index: 0,
      SensorID: 1,
      Name: '3rd Party Sensor',
      Description: 'Desc',
      isSuto: false,
      cfgchannel: [
        {
          ChannelId: 1,
          ChannelDescription: 'Ch 1',
          Address: '10',
          InDataType: 8,
          OutDataType: 8,
          CreateTime: '1111'
        },
        {
          ChannelId: 2,
          ChannelDescription: 'Ch 2',
          Address: '10', // duplicate address!
          InDataType: 8,
          OutDataType: 8,
          CreateTime: '2222'
        }
      ]
    };

    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={existingSensor}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    const confirmBtn = document.querySelector('.btn-confirm');
    fireEvent.click(confirmBtn);

    // Should display restricted/duplicate warning dialog
    await waitFor(() => {
      expect(screen.getByText('Duplicate Channel Address')).toBeInTheDocument();
      expect(screen.getByText(/Multiple channels use the same value address "10"/)).toBeInTheDocument();
    });

    expect(mockSetConfigData).not.toHaveBeenCalled();
  });

  it('blocks saving an edited channel if its address is already in use by another channel', async () => {
    const existingSensor = {
      Index: 0,
      SensorID: 1,
      Name: '3rd Party Sensor',
      Description: 'Desc',
      isSuto: false,
      cfgchannel: [
        {
          ChannelId: 1,
          ChannelDescription: 'Ch 1',
          Address: '10',
          InDataType: 8,
          OutDataType: 8,
          CreateTime: '1111'
        },
        {
          ChannelId: 2,
          ChannelDescription: 'Ch 2',
          Address: '20',
          InDataType: 8,
          OutDataType: 8,
          CreateTime: '2222'
        }
      ]
    };

    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={existingSensor}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    // Edit Ch 2 (second row index 1)
    const editBtns = screen.getAllByTitle('Edit');
    fireEvent.click(editBtns[1]);

    // Change Address to '10' in EditChannelModal
    const inputs = document.querySelectorAll('input.edit-form-input');
    const addressInput = inputs[2];
    fireEvent.change(addressInput, { target: { value: '10' } });

    const editConfirmBtn = document.querySelector('.btn-edit-confirm');
    fireEvent.click(editConfirmBtn);

    // Should display restricted/duplicate warning dialog
    await waitFor(() => {
      expect(screen.getByText('Duplicate Channel Address')).toBeInTheDocument();
      expect(screen.getByText(/Multiple channels use the same value address "10"/)).toBeInTheDocument();
    });
  });

  it('validates duplicate Modbus address only for Modbus/RTU sensors', async () => {
    mockConfigs = {
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            Name: 'Other RTU',
            ConnectType: 4, // Modbus/RTU
            Addr: 5,
            isSuto: false,
            cfgchannel: []
          }
        ]
      }
    };

    const editingRtuSensor = {
      Index: 1,
      SensorID: 2,
      Name: 'My RTU Sensor',
      ConnectType: 4,
      Addr: 5, // duplicate address with Other RTU!
      cfgchannel: []
    };

    const { unmount } = render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={editingRtuSensor}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    // Confirm should block saving and show duplicate address warning
    const confirmBtn = document.querySelector('.btn-confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Duplicate Address')).toBeInTheDocument();
      expect(screen.getByText(/The Modbus Address "5" is already in use by another Modbus\/RTU/)).toBeInTheDocument();
    });

    unmount();

    // Now if it is a Modbus/TCP sensor with same address, it should not conflict!
    const editingTcpSensor = {
      Index: 1,
      SensorID: 2,
      Name: 'My TCP Sensor',
      ConnectType: 9,
      Addr: 5, // same address, but TCP!
      IpAddr: '192.168.1.10',
      cfgchannel: []
    };

    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={editingTcpSensor}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    const tcpConfirmBtn = document.querySelector('.btn-confirm');
    fireEvent.click(tcpConfirmBtn);

    // Should call setConfigData successfully
    expect(mockSetConfigData).toHaveBeenCalled();
  });

  it('validates duplicate IP address only for Modbus/TCP sensors', async () => {
    mockConfigs = {
      'config/SUTO-SensorList.sutolist': {
        cfgsensor: [
          {
            Name: 'Other TCP',
            ConnectType: 9, // Modbus/TCP
            IpAddr: '192.168.1.200',
            isSuto: false,
            cfgchannel: []
          }
        ]
      }
    };

    const editingTcpSensor = {
      Index: 1,
      SensorID: 2,
      Name: 'My TCP Sensor',
      ConnectType: 9,
      IpAddr: '192.168.1.200', // duplicate IP!
      cfgchannel: []
    };

    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={editingTcpSensor}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    const confirmBtn = document.querySelector('.btn-confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Duplicate IP Address')).toBeInTheDocument();
      expect(screen.getByText(/The IP Address "192.168.1.200" is already in use by another Modbus\/TCP/)).toBeInTheDocument();
    });
  });

  it('defaults protocol to Modbus RTU (4) for both SUTO and third-party sensors', async () => {
    // 1. Third Party
    const { unmount } = render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={null}
          isSuto={false}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    // Protocol select element should default to 4 (RTU)
    const selectElem = document.querySelector('.form-select-hidden');
    expect(selectElem.value).toBe('4');

    unmount();

    // 2. SUTO
    render(
      <LanguageProvider>
        <SensorConfigModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={null}
          isSuto={true}
          selectedSensor=""
        />
      </LanguageProvider>
    );

    const selectElemSuto = document.querySelectorAll('.form-select-hidden')[0];
    expect(selectElemSuto.value).toBe('4');
  });
});
