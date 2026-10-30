/**
 * src/api/device/index.js
 *
 * Export and initialize the VirtualDevice registry with built-in drivers.
 */

import VirtualDevice from './VirtualDevice';
import TauriDevice from './TauriDevice';
import ApiDevice from './ApiDevice';

// Register built-in device drivers
VirtualDevice.registerDriver('tauri', TauriDevice);
VirtualDevice.registerDriver('usb', TauriDevice);
VirtualDevice.registerDriver('tcp', TauriDevice);
VirtualDevice.registerDriver('ble', TauriDevice);
VirtualDevice.registerDriver('api', ApiDevice);

// Default to TauriDevice if running
VirtualDevice.setActiveDevice(TauriDevice);

export { VirtualDevice, TauriDevice, ApiDevice };
export default VirtualDevice;

