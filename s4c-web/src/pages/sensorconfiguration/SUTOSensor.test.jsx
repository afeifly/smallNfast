import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SUTOSensor from './SUTOSensor';

let mockIsOemAC = false;

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({
    configData: {
      configs: {
        'config/SUTO-SensorList.sutolist': {
          cfgsensor: []
        }
      }
    },
    setConfigData: vi.fn()
  })
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key) => key,
    language: 'en'
  })
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    appName: 'S4C-Web',
    appLogo: '/logos/suto_logo.png',
    logoHeight: '16px',
    isOemAC: mockIsOemAC
  })
}));

describe('SUTOSensor OEM AC support', () => {
  it('renders SUTO sensor list header and button by default when isOemAC is false', () => {
    mockIsOemAC = false;
    render(<SUTOSensor />);
    expect(screen.getByText('SUTO sensor list')).toBeDefined();
    expect(screen.getByText('Add SUTO Sensor')).toBeDefined();
  });

  it('renders Preset sensor list header and button when isOemAC is true', () => {
    mockIsOemAC = true;
    render(<SUTOSensor />);
    expect(screen.getByText('Preset sensor list')).toBeDefined();
    expect(screen.getByText('Add Preset Sensor')).toBeDefined();
  });
});
