import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { useConfig } from '../../context/ConfigContext';
import { LanguageProvider } from '../../context/LanguageContext';

vi.mock('../../context/ConfigContext', () => ({
  useConfig: vi.fn(),
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    appName: 'SUTO',
    appLogo: '/logos/suto_logo.png',
    logoHeight: 32,
    isOriginal: true,
  }),
}));

const configPath = 'system/cfgcommunicatport.json';
const masterTitle = 'Modbus/TCP Master';
const slaveTitle = 'Modbus/TCP Slave';

const TestApp = () => {
  const [configData, setConfigData] = useState({
    configs: {
      [configPath]: {
        retcp: {
          connectTimeout: 250,
          readWriteTimeout: 260,
          port: 502,
          errorvalue: 9999,
          responseTimeout: 10,
        },
      },
    },
  });
  useConfig.mockReturnValue({ activeConfigId: 'test-config', configData, setConfigData });

  return <App />;
};

const renderPage = (path = '/communication/modbus-tcp') => render(
  <MemoryRouter initialEntries={[path]}>
    <LanguageProvider>
      <TestApp />
    </LanguageProvider>
  </MemoryRouter>
);

describe('Modbus TCP page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the active Modbus TCP menu entry and defaults to the Master tab', () => {
    renderPage();

    expect(screen.getAllByRole('link', { name: 'Modbus TCP' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Modbus TCP' })).toHaveClass('active');

    const header = screen.getByRole('tablist').closest('header');
    expect(header).toHaveClass('modbus-header');
    expect(within(header).getAllByRole('tab')).toHaveLength(2);
    expect(within(header).getByRole('tab', { name: masterTitle })).toHaveAttribute('aria-selected', 'true');
    expect(within(header).getByRole('tab', { name: slaveTitle })).toBeVisible();

    const masterPanel = screen.getByRole('tabpanel', { name: masterTitle });
    expect(masterPanel).toHaveTextContent('TCP');
    expect(within(masterPanel).getByLabelText(/Connect Timeout/)).toHaveValue(250);
    expect(within(masterPanel).getByLabelText(/Read\/Write Timeout/)).toHaveValue(260);
    expect(within(masterPanel).getAllByText('ms (100 - 3000)')).toHaveLength(2);
    expect(screen.queryByRole('tabpanel', { name: slaveTitle })).not.toBeInTheDocument();
  });

  it('opens on the Slave tab when tab=slave and renders expected fields', () => {
    renderPage('/communication/modbus-tcp?tab=slave');

    expect(screen.getByRole('tab', { name: slaveTitle })).toHaveAttribute('aria-selected', 'true');
    const slavePanel = screen.getByRole('tabpanel', { name: slaveTitle });
    expect(slavePanel).toBeVisible();
    expect(slavePanel).toHaveTextContent('TCP');
    expect(within(slavePanel).getByLabelText(/Port/)).toHaveValue(502);
    expect(within(slavePanel).getByText('(1 - 65535)')).toBeVisible();
    expect(within(slavePanel).getByLabelText(/Error Value/)).toHaveValue('9999');
    expect(within(slavePanel).getByText('1000')).toBeVisible();
    expect(within(slavePanel).getByText('ms')).toBeVisible();
  });

  it('preserves edits across Master and Slave tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    const masterPanel = screen.getByRole('tabpanel', { name: masterTitle });
    const connectInput = within(masterPanel).getByLabelText(/Connect Timeout/);
    const rwInput = within(masterPanel).getByLabelText(/Read\/Write Timeout/);
    await user.clear(connectInput);
    await user.type(connectInput, '500');
    await user.clear(rwInput);
    await user.type(rwInput, '800');

    await user.click(screen.getByRole('tab', { name: slaveTitle }));
    const slavePanel = screen.getByRole('tabpanel', { name: slaveTitle });
    const portInput = within(slavePanel).getByLabelText(/Port/);
    const errorInput = within(slavePanel).getByLabelText(/Error Value/);
    await user.clear(portInput);
    await user.type(portInput, '1502');
    await user.clear(errorInput);
    await user.type(errorInput, '-1');

    await user.click(screen.getByRole('tab', { name: masterTitle }));
    const masterPanelAgain = screen.getByRole('tabpanel', { name: masterTitle });
    expect(within(masterPanelAgain).getByLabelText(/Connect Timeout/)).toHaveValue(500);
    expect(within(masterPanelAgain).getByLabelText(/Read\/Write Timeout/)).toHaveValue(800);

    await user.click(screen.getByRole('tab', { name: slaveTitle }));
    const slavePanelAgain = screen.getByRole('tabpanel', { name: slaveTitle });
    expect(within(slavePanelAgain).getByLabelText(/Port/)).toHaveValue(1502);
    expect(within(slavePanelAgain).getByLabelText(/Error Value/)).toHaveValue('-1');
  });

  it('supports keyboard navigation between tabs', async () => {
    const user = userEvent.setup();
    renderPage();
    screen.getByRole('tab', { name: masterTitle }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: slaveTitle })).toHaveFocus();
    expect(screen.getByRole('tab', { name: slaveTitle })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: masterTitle })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: masterTitle })).toBeVisible();
  });

  it('marks out-of-range inputs and suffixes invalid on Master and Slave tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    const masterPanel = screen.getByRole('tabpanel', { name: masterTitle });
    expect(masterPanel.querySelector('.required')).toBeNull();
    const connectInput = within(masterPanel).getByLabelText('Connect Timeout');
    const rwInput = within(masterPanel).getByLabelText('Read/Write Timeout');
    const [connectSuffix, rwSuffix] = within(masterPanel).getAllByText('ms (100 - 3000)');

    await user.clear(connectInput);
    await user.type(connectInput, '10');
    expect(connectInput).toHaveClass('invalid');
    expect(connectSuffix).toHaveClass('invalid');
    expect(rwInput).not.toHaveClass('invalid');
    expect(rwSuffix).not.toHaveClass('invalid');

    await user.clear(rwInput);
    await user.type(rwInput, '4000');
    expect(rwInput).toHaveClass('invalid');
    expect(rwSuffix).toHaveClass('invalid');

    await user.click(screen.getByRole('tab', { name: slaveTitle }));
    const slavePanel = screen.getByRole('tabpanel', { name: slaveTitle });
    expect(slavePanel.querySelector('.required')).toBeNull();
    const portInput = within(slavePanel).getByLabelText('Port');
    const portSuffix = within(slavePanel).getByText('(1 - 65535)');
    await user.clear(portInput);
    await user.type(portInput, '0');
    expect(portInput).toHaveClass('invalid');
    expect(portSuffix).toHaveClass('invalid');
  });
});
