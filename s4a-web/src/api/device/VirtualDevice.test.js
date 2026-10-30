import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualDevice, DefaultCapabilities } from './VirtualDevice';

describe('VirtualDevice', () => {
  beforeEach(() => {
    VirtualDevice.setActiveDevice(null);
  });

  it('returns default capabilities when no active device', () => {
    expect(VirtualDevice.getCapabilities()).toEqual(DefaultCapabilities);
    expect(VirtualDevice.getActiveTransport()).toBeNull();
    expect(VirtualDevice.isAvailable()).toBe(false);
  });

  it('registers and retrieves drivers', () => {
    const mockDriver = {
      connect: vi.fn().mockResolvedValue({ transport: 'MOCK' }),
      disconnect: vi.fn().mockResolvedValue(true),
      getCapabilities: () => ({ mock: true }),
    };

    VirtualDevice.registerDriver('mock_kind', mockDriver);
    expect(VirtualDevice.getDriver('mock_kind')).toBe(mockDriver);
    expect(VirtualDevice.getDriver('MOCK_KIND')).toBe(mockDriver);
  });

  it('connects via registered driver and sets active device', async () => {
    const mockDriver = {
      connect: vi.fn().mockResolvedValue({ transport: 'MOCK', name: 'TestDevice' }),
      disconnect: vi.fn().mockResolvedValue(true),
      getCapabilities: () => ({ loggerFiles: true }),
      getActiveTransport: () => 'MOCK',
      isAvailable: () => true,
    };

    VirtualDevice.registerDriver('test_driver', mockDriver);
    const conn = await VirtualDevice.connect({ kind: 'test_driver' });

    expect(mockDriver.connect).toHaveBeenCalledWith({ kind: 'test_driver' });
    expect(conn.name).toBe('TestDevice');
    expect(VirtualDevice.getActiveDevice()).toBe(mockDriver);
    expect(VirtualDevice.getActiveTransport()).toBe('MOCK');
    expect(VirtualDevice.isAvailable()).toBe(true);
    expect(VirtualDevice.getCapabilities().loggerFiles).toBe(true);

    await VirtualDevice.disconnect();
    expect(mockDriver.disconnect).toHaveBeenCalled();
    expect(VirtualDevice.getActiveDevice()).toBeNull();
  });
});

