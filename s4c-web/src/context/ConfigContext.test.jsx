import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider, useConfig } from './ConfigContext';

// Mock fileMapStorage
vi.mock('../util/fileMapStorage', () => ({
  saveFileMap: vi.fn(() => Promise.resolve()),
  loadFileMap: vi.fn(() => Promise.resolve({})),
  clearFileMap: vi.fn(() => Promise.resolve()),
}));

// Consumer component to expose context values for testing
function TestConsumer() {
  const ctx = useConfig();
  return (
    <div>
      <span data-testid="activeConfigId">{ctx.activeConfigId || 'null'}</span>
      <span data-testid="configListLength">{ctx.configList.length}</span>
      <span data-testid="configData">{ctx.configData ? 'present' : 'null'}</span>
      <button
        data-testid="add-config"
        onClick={() =>
          ctx.addConfig({ name: 'test-config', configs: { 'test.json': {} } })
        }
      >
        Add Config
      </button>
      <button data-testid="set-active" onClick={() => ctx.setActiveConfigId('custom-id')}>
        Set Active
      </button>
      <button
        data-testid="delete-active"
        onClick={() => {
          if (ctx.activeConfigId) ctx.deleteConfig(ctx.activeConfigId);
        }}
      >
        Delete Active
      </button>
      <button
        data-testid="set-config-data"
        onClick={() => ctx.setConfigData({ name: 'updated' })}
      >
        Set Config Data
      </button>
      <button
        data-testid="set-config-list"
        onClick={() => ctx.setConfigList([{ id: 'new-1', name: 'replaced' }])}
      >
        Set Config List
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ConfigProvider>
      <TestConsumer />
    </ConfigProvider>
  );
}

describe('ConfigContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with null activeConfigId and empty configList', () => {
    renderWithProvider();
    expect(screen.getByTestId('activeConfigId').textContent).toBe('null');
    expect(screen.getByTestId('configListLength').textContent).toBe('0');
    expect(screen.getByTestId('configData').textContent).toBe('null');
  });

  it('addConfig creates a new config and sets it as active', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));

    expect(screen.getByTestId('configListLength').textContent).toBe('1');
    expect(screen.getByTestId('activeConfigId').textContent).not.toBe('null');
    expect(screen.getByTestId('configData').textContent).toBe('present');
  });

  it('setActiveConfigId changes the active config', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('set-active'));

    expect(screen.getByTestId('activeConfigId').textContent).toBe('custom-id');
    expect(screen.getByTestId('configData').textContent).toBe('null');
  });

  it('deleteConfig removes config and updates active', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));
    expect(screen.getByTestId('configListLength').textContent).toBe('1');

    await user.click(screen.getByTestId('delete-active'));

    expect(screen.getByTestId('configListLength').textContent).toBe('0');
    expect(screen.getByTestId('activeConfigId').textContent).toBe('null');
  });

  it('setConfigData updates the active config', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));
    await user.click(screen.getByTestId('set-config-data'));

    expect(screen.getByTestId('configData').textContent).toBe('present');
  });

  it('setConfigData creates a new config when no active config exists', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('set-config-data'));

    expect(screen.getByTestId('configListLength').textContent).toBe('1');
    expect(screen.getByTestId('activeConfigId').textContent).not.toBe('null');
  });

  it('setConfigList replaces the entire config list', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));
    await user.click(screen.getByTestId('add-config'));
    expect(screen.getByTestId('configListLength').textContent).toBe('2');

    await user.click(screen.getByTestId('set-config-list'));
    expect(screen.getByTestId('configListLength').textContent).toBe('1');
  });

  it('persists state to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));

    const saved = localStorage.getItem('s4c_config_manager_state');
    expect(saved).toBeTruthy();

    const parsed = JSON.parse(saved);
    expect(parsed.configList.length).toBe(1);
    expect(parsed.activeConfigId).toBeTruthy();
    expect(parsed.configList[0].fileMap).toBeUndefined();
  });

  it('restores state from localStorage on init', () => {
    localStorage.setItem(
      's4c_config_manager_state',
      JSON.stringify({
        activeConfigId: 'stored-id',
        configList: [{ id: 'stored-id', name: 'stored-config' }],
      })
    );

    renderWithProvider();

    expect(screen.getByTestId('activeConfigId').textContent).toBe('stored-id');
    expect(screen.getByTestId('configListLength').textContent).toBe('1');
    expect(screen.getByTestId('configData').textContent).toBe('present');
  });

  it('migrates legacy s4c_config_data key', () => {
    localStorage.setItem(
      's4c_config_data',
      JSON.stringify({ name: 'legacy-config', someData: true })
    );

    renderWithProvider();

    expect(screen.getByTestId('configListLength').textContent).toBe('1');
    expect(screen.getByTestId('activeConfigId').textContent).toMatch(/^legacy-/);
    expect(screen.getByTestId('configData').textContent).toBe('present');
  });

  it('deleteConfig handles deleting the only config', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId('add-config'));
    await user.click(screen.getByTestId('delete-active'));

    expect(screen.getByTestId('configListLength').textContent).toBe('0');
    expect(screen.getByTestId('activeConfigId').textContent).toBe('null');
  });
});
