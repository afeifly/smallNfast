import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { LanguageProvider } from '../context/LanguageContext';

let mockConfigData = null;

vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({
    configData: mockConfigData
  })
}));

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders option board channel descriptions correctly when configured in layout', () => {
    mockConfigData = {
      configs: {
        'config/cfgLayout.json': {
          LayoutList: [
            {
              location: 'Main Plant',
              meapoint: 'Compressor 1',
              channels: ['1784861267677'],
              index: 0
            }
          ]
        },
        'config/SUTO-SensorList.sutolist': {
          cfgsensor: []
        },
        'config/cfgOptionBoard.json': {
          cfgOptionBoard: [
            {
              CreateTime: '1784861267677',
              ChannelDescription: 'Analog Input 1',
              PreDefineUnit: 'bar'
            }
          ]
        }
      }
    };

    render(
      <MemoryRouter>
        <LanguageProvider>
          <Home />
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Analog Input 1')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('CH 1784861267677')).not.toBeInTheDocument();
  });
});
