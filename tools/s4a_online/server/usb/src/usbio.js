/**
 * usbio.js — CS-Bus over the branded cscdc.sys driver, via the N-API addon.
 *
 * Flow mirrors the observed Java app (API hook, 2026-10-14):
 *   main handle: openDevice -> getDeviceDescriptor -> setConfiguration
 *   pipe handles: openPipe(path, ep) for OUT (0x01) and IN (0x82)
 *   I/O: writePipe / readPipe on the pipe handles.
 *
 * Same API shape as csbus.js (serial version), so upper layers don't care
 * which transport is underneath:
 *
 *   const { UsbCsBus } = require('./src/usbio');
 *   const bus = new UsbCsBus();
 *   await bus.open();                        // first USBIO device
 *   const payload = await bus.getDeviceInformation(1);
 *   await bus.close();
 *
 * Requires: npm install  (builds native/binding.cc via node-gyp, Windows only)
 */
const { packPacket, parsePacket, COMM_RETRY_COUNT, DEFAULT_TIMEOUT_MS } = require('./csbus');

const PIPEOUT_ADDRESS = 0x03;  // confirmed by API hook (USBDS300.java says 0x01, outdated)
const PIPEIN_ADDRESS = 0x81;   // confirmed by API hook (USBDS300.java says 0x82, outdated)

function loadAddon() {
  try {
    return require('../build/Release/usbio.node');
  } catch (e) {
    throw new Error(
      'usbio native addon not built. On Windows: npm install (needs VS Build Tools). ' +
      'Original error: ' + e.message
    );
  }
}

class UsbCsBus {
  constructor() {
    this.native = null;
    this.dev = null;      // main device handle id
    this.pipeOut = null;  // OUT pipe handle id
    this.pipeIn = null;   // IN pipe handle id
  }

  /** List USBIO device paths (interface GUID {325ddf96-...}). */
  static listDevices() {
    return loadAddon().createDeviceList();
  }

  /** Open device by path (default: first found), configure + bind bulk pipes.
   *  Returns the device descriptor { idVendor, idProduct, ... }. */
  async open(devicePath) {
    const native = loadAddon();
    this.native = native;
    const devs = native.createDeviceList();
    if (!devs.length) throw new Error('No USBIO devices found. Is cscdc.sys installed?');
    const path = devicePath || devs[0];
    const dev = native.openDevice(path);
    this.dev = dev;
    let desc;
    try {
      desc = native.getDeviceDescriptor(dev);
      if (desc.idVendor !== 0x16c0) {
        throw new Error(
          `Unexpected device: VID=0x${desc.idVendor.toString(16)} PID=0x${desc.idProduct.toString(16)}`
        );
      }
      const sc = native.setConfiguration(dev);
      const gci = native.getConfigurationInfo(dev);
      // NOTE: DS300 hardware uses endpoints 0x03 (OUT) / 0x81 (IN),
      // confirmed by API hook. USBDS300.java says 0x01/0x82 (outdated).
      this.pipeIn = native.openPipe(path, 0x81);
      this.pipeOut = native.openPipe(path, 0x03);
    } catch (e) {
      this.close();
      throw e;
    }
    return desc;
  }

  async close() {
    if (!this.native) return;
    for (const k of ['pipeOut', 'pipeIn', 'dev']) {
      if (this[k] !== null) {
        try { this.native.close(this[k]); } catch (_) {}
        this[k] = null;
      }
    }
  }

  get isOpen() {
    return this.pipeOut !== null && this.pipeIn !== null;
  }

  /**
   * Send a command frame, read the response, parse it.
   * Mirrors USBDS300.sendBytes: writeSync then readSync with timeout, retries.
   */
  async sendCommand(address, command, { timeout = DEFAULT_TIMEOUT_MS, retries = COMM_RETRY_COUNT } = {}) {
    if (!this.isOpen) throw new Error('device not open');
    const packet = packPacket(address, command);
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.native.writePipe(this.pipeOut, packet, 100);
        // Response framing: first 2 bytes give total length (frame[1]),
        // same rule as the Java version (numBytesReceived == cache[1]).
        let acc = Buffer.alloc(0);
        const deadline = Date.now() + timeout;
        while (acc.length < 2 || acc.length < acc[1]) {
          const rest = Math.max(0, deadline - Date.now());
          if (rest <= 0) {
            const e = new Error(`response timeout after ${timeout}ms`);
            e.code = 'TIMEOUT';
            throw e;
          }
          const chunk = this.native.readPipe(this.pipeIn, 1024, rest);
          if (!chunk.length) {
            const e = new Error(`response timeout after ${timeout}ms`);
            e.code = 'TIMEOUT';
            throw e;
          }
          acc = Buffer.concat([acc, chunk]);
        }
        return parsePacket(acc.subarray(0, acc[1]));
      } catch (err) {
        lastErr = err;
        if (err.code === 'TIMEOUT' && attempt < retries) continue;
        throw err;
      }
    }
    throw lastErr;
  }

  /** "A" command — retrieve device information (1000ms like the Java version). */
  async getDeviceInformation(address, timeout = 1000) {
    return this.sendCommand(address, Buffer.from('A', 'ascii'), { timeout });
  }
}

module.exports = { UsbCsBus };
