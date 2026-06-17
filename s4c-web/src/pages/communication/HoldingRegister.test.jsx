import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HoldingRegister from './HoldingRegister';

const mockConfigData = {
  configs: {
    'SUTO-SensorList.sutolist': {
      cfgsensor: [
        {
          Name: 'SUTO Sensor 1',
          Description: 'SUTO Desc',
          isSuto: true,
          cfgchannel: [
            {
              CreateTime: '1001',
              ChannelDescription: 'SUTO Chan 1',
              ValueType: 8,
              UnitInASCII: 'm3/h',
              Resolution: 1,
              rw: 0
            }
          ]
        },
        {
          Name: '3-Party Sensor 1',
          Description: '3-Party Desc',
          isSuto: false,
          isVirtualSensor: false,
          cfgchannel: [
            {
              CreateTime: '1002',
              ChannelDescription: '3-Party Chan 1',
              ValueType: 1,
              UnitInASCII: 'bar',
              Resolution: 2,
              rw: 0
            }
          ]
        },
        {
          Name: 'Virtual Sensor',
          Description: 'Virtual Sensor',
          isVirtualSensor: true,
          cfgchannel: [
            {
              CreateTime: '1004',
              ChannelDescription: 'Virtual Chan 1',
              ValueType: 8,
              UnitInASCII: 'kW',
              Resolution: 0,
              rw: 0
            }
          ]
        }
      ]
    },
    'cfgOptionBoard.json': {
      cfgOptionBoard: [
        {
          CreateTime: '1003',
          SensorDescription: 'Option Board Analog',
          ChannelDescription: 'Analog Chan 1',
          PreDefineUnit: 'V',
          Resolution: 3,
          rw: 0,
          ValueType: 8
        }
      ]
    },
    'cfgLocation.json': {
      Locations: [
        {
          meapoints: [
            {
              location: 'LocA',
              meapoint: 'PointA',
              channels: ['1001']
            },
            {
              location: 'LocB',
              meapoint: 'PointB',
              channels: ['1002']
            },
            {
              location: 'LocC',
              meapoint: 'PointC',
              channels: ['1003']
            },
            {
              location: 'LocD',
              meapoint: 'PointD',
              channels: ['1004']
            }
          ]
        }
      ]
    }
  }
};

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({
    configData: mockConfigData
  })
}));

describe('HoldingRegister', () => {
  it('renders the holding register table in the correct order', () => {
    render(<HoldingRegister />);
    
    expect(screen.getByText('Holding register table')).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    // Header row is index 0
    // SUTO row is index 1
    // 3-Party row is index 2
    // Analog row is index 3
    // Virtual row is index 4

    // Verify ordering and register values (0, 2, 4, 6)
    // SUTO Chan 1 row
    const cells1 = rows[1].querySelectorAll('td');
    expect(cells1[0].textContent).toBe('LocA/PointA');
    expect(cells1[1].textContent).toBe('SUTO Desc');
    expect(cells1[2].textContent).toBe('SUTO Chan 1');
    expect(cells1[3].textContent).toBe('0'); // 2 * 0

    // 3-Party Chan 1 row
    const cells2 = rows[2].querySelectorAll('td');
    expect(cells2[0].textContent).toBe('LocB/PointB');
    expect(cells2[1].textContent).toBe('3-Party Desc');
    expect(cells2[2].textContent).toBe('3-Party Chan 1');
    expect(cells2[3].textContent).toBe('2'); // 2 * 1

    // Analog Chan 1 row
    const cells3 = rows[3].querySelectorAll('td');
    expect(cells3[0].textContent).toBe('LocC/PointC');
    expect(cells3[1].textContent).toBe('Option Board Analog');
    expect(cells3[2].textContent).toBe('Analog Chan 1');
    expect(cells3[3].textContent).toBe('4'); // 2 * 2

    // Virtual Chan 1 row
    const cells4 = rows[4].querySelectorAll('td');
    expect(cells4[0].textContent).toBe('LocD/PointD');
    expect(cells4[1].textContent).toBe('Virtual Sensor');
    expect(cells4[2].textContent).toBe('Virtual Chan 1');
    expect(cells4[3].textContent).toBe('6'); // 2 * 3
  });
});
