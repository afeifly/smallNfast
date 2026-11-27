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

const configPath = 'config/cfgcommunicatport.json';
const masterTitle = 'Modbus RTU Master';
const slaveTitle = 'Modbus RTU slave';

const TestApp = () => {
  const [configData, setConfigData] = useState({
    configs: {
      [configPath]: {
        rs485m0: { baudrate: 19200, parityFrameIndex: 3, responseTimeout: 10 },
        rs485s0: { baudrate: 9600, parityFrameIndex: 0, address: 7 },
      },
    },
  });
  useConfig.mockReturnValue({ activeConfigId: 'test-config', configData, setConfigData });

  return <App />;
};

const renderPage = (path = '/communication/modbus-rtu') => render(
  <MemoryRouter initialEntries={[path]}>
    <LanguageProvider>
      <TestApp />
    </LanguageProvider>
  </MemoryRouter>
);

describe('Modbus RTU page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows one active menu entry and defaults to the Master configuration', () => {
    renderPage();

    expect(screen.getAllByRole('link', { name: 'Modbus RTU' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Modbus RTU' })).toHaveClass('active');
    expect(screen.queryByRole('link', { name: 'Modbus RTU Master' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Modbus RTU Slave' })).not.toBeInTheDocument();
    const header = screen.getByRole('tablist').closest('header');
    expect(header).toHaveClass('modbus-header');
    expect(within(header).getAllByRole('tab')).toHaveLength(2);
    expect(within(header).getByRole('tab', { name: masterTitle })).toHaveAttribute('aria-selected', 'true');
    expect(within(header).getByRole('tab', { name: slaveTitle })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /Modbus RTU/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: masterTitle })).toHaveTextContent('Response timeout(s)');
    expect(screen.queryByRole('tabpanel', { name: slaveTitle })).not.toBeInTheDocument();
  });

  it.each([
    ['/communication/modbus-rtu?tab=slave', slaveTitle],
    ['/communication/modbus-rtu-master', masterTitle],
    ['/communication/modbus-rtu-slave', slaveTitle],
  ])('opens %s on the %s tab', (path, tab) => {
    renderPage(path);

    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: tab })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Modbus RTU' })).toHaveClass('active');
  });

  it('preserves independent configuration edits when switching tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    const masterPanel = screen.getByRole('tabpanel', { name: masterTitle });
    await user.selectOptions(within(masterPanel).getAllByRole('combobox')[0], '38400');
    await user.click(screen.getByRole('tab', { name: slaveTitle }));

    const slavePanel = screen.getByRole('tabpanel', { name: slaveTitle });
    expect(within(slavePanel).getAllByRole('combobox')[0]).toHaveValue('9600');
    expect(within(slavePanel).getByRole('spinbutton')).toHaveValue(7);
    await user.selectOptions(within(slavePanel).getAllByRole('combobox')[0], '115200');
    await user.clear(within(slavePanel).getByRole('spinbutton'));
    await user.type(within(slavePanel).getByRole('spinbutton'), '12');

    await user.click(screen.getByRole('tab', { name: masterTitle }));
    expect(within(screen.getByRole('tabpanel', { name: masterTitle })).getAllByRole('combobox')[0]).toHaveValue('38400');
    expect(within(screen.getByRole('tabpanel', { name: masterTitle })).getByRole('spinbutton')).toHaveValue(10);

    await user.click(screen.getByRole('tab', { name: slaveTitle }));
    expect(within(screen.getByRole('tabpanel', { name: slaveTitle })).getAllByRole('combobox')[0]).toHaveValue('115200');
    expect(within(screen.getByRole('tabpanel', { name: slaveTitle })).getByRole('spinbutton')).toHaveValue(12);
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

  it('marks out-of-range inputs and range suffixes invalid on Master and Slave tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    const masterPanel = screen.getByRole('tabpanel', { name: masterTitle });
    expect(masterPanel.querySelector('.required')).toBeNull();
    const timeoutInput = within(masterPanel).getByLabelText('Response timeout(s)');
    const timeoutHint = within(masterPanel).getByText('(1~25)');
    expect(timeoutInput).not.toHaveClass('invalid');
    expect(timeoutHint).not.toHaveClass('invalid');

    await user.clear(timeoutInput);
    await user.type(timeoutInput, '30');
    expect(timeoutInput).toHaveClass('invalid');
    expect(timeoutHint).toHaveClass('invalid');

    await user.click(screen.getByRole('tab', { name: slaveTitle }));
    const slavePanel = screen.getByRole('tabpanel', { name: slaveTitle });
    expect(slavePanel.querySelector('.required')).toBeNull();
    const addressInput = within(slavePanel).getByLabelText('Slave address');
    const addressHint = within(slavePanel).getByText('(1~247)');
    await user.clear(addressInput);
    await user.type(addressInput, '300');
    expect(addressInput).toHaveClass('invalid');
    expect(addressHint).toHaveClass('invalid');
  });
});
