/**
 * csbus.js — CS-Bus device communication for Node.js
 *
 * Faithful port of CSLib's CSBus/CSComm (Java) transport + framing layer.
 * Uses the `serialport` npm package instead of javax.comm.
 *
 * Frame format: [addr][len][data...][checksum][0x00]
 *   - byte 0 : device address
 *   - byte 1 : total frame length (= data bytes + 4)
 *   - bytes 2..n+1 : net data (byte 2 of a RESPONSE is the status char)
 *   - byte n+2 : checksum = two's complement of sum(bytes[0..n+1])
 *   - byte n+3 : always 0x00
 *
 * A response is complete when receivedBytes == frame[1].
 * Response status byte: '>' (0x3E) = OK, 0x01 = our checksum was bad,
 * '?' (0x3F) = invalid command.
 *
 * NOTE: this talks to the device in SERIAL (COM port) mode, e.g. with the
 * WHQL-signed comport.inf driver. It cannot reach the branded direct-USB
 * (CSUsbDevices) driver — browsers and Node.js cannot open proprietary
 * kernel-driver interfaces.
 */

const COMM_SUCCESSFUL_CHAR = 0x3E; // '>'
const COMM_CHECKSUM_ERROR_BYTE = 0x01;
const COMM_INVALID_COMMAND_BYTE = 0x3F; // '?'
const COMM_HEADER_LENGTH = 2;
const COMM_TAIL_LENGTH = 2;
const COMM_RETRY_COUNT = 2;
const DEFAULT_TIMEOUT_MS = 800;
const DEFAULT_PORT_OPTS = { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'none' };
// matches Java: CS_BUS_PORT_OPEN_FORMAT_ARGUMENT = "COM%d,19200,8,1,0"

/** Two's complement checksum over the first `length` bytes. */
function checksum(buf, length) {
  let total = 0;
  for (let i = 0; i < length; i++) total += buf[i];
  return (((total ^ 0xFF) + 1) & 0xFF);
}

/** Build a send frame from device address + net-data bytes. */
function packPacket(address, netData) {
  const data = Buffer.from(netData);
  const byteTotal = data.length + COMM_HEADER_LENGTH + COMM_TAIL_LENGTH;
  const packet = Buffer.alloc(byteTotal);
  packet[0] = address & 0xFF;
  packet[1] = byteTotal & 0xFF;
  data.copy(packet, COMM_HEADER_LENGTH);
  packet[byteTotal - COMM_TAIL_LENGTH] = checksum(packet, byteTotal - COMM_TAIL_LENGTH);
  packet[byteTotal - 1] = 0x00;
  return packet;
}

/**
 * Verify a received frame; returns the payload (bytes after the status byte,
 * without checksum/tail). Throws on checksum error / device error status.
 */
function parsePacket(frame) {
  const length = frame[1];
  if (frame.length < length) {
    const e = new Error(`incomplete frame: got ${frame.length}, want ${length}`);
    e.code = 'INCOMPLETE';
    throw e;
  }
  const want = checksum(frame, length - COMM_TAIL_LENGTH);
  if (want !== frame[length - COMM_TAIL_LENGTH]) {
    const e = new Error('response checksum error');
    e.code = 'CHECKSUM';
    throw e;
  }
  const status = frame[COMM_HEADER_LENGTH];
  if (status === COMM_CHECKSUM_ERROR_BYTE) {
    const e = new Error('device reports our checksum was bad');
    e.code = 'SEND_CHECKSUM';
    throw e;
  }
  if (status === COMM_INVALID_COMMAND_BYTE) {
    const e = new Error('device reports invalid command');
    e.code = 'INVALID_CMD';
    throw e;
  }
  if (status !== COMM_SUCCESSFUL_CHAR) {
    const e = new Error(`device error, status=0x${status.toString(16)}`);
    e.code = 'DEVICE';
    throw e;
  }
  return frame.subarray(COMM_HEADER_LENGTH + 1, length - COMM_TAIL_LENGTH);
}

class CSBus {
  constructor() {
    this.port = null;
    this.rxBuf = Buffer.alloc(0);
    this.pending = null; // { resolve, reject } for the in-flight command
  }

  /** List available serial ports (name + description). */
  static async listPorts() {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer || '',
      description: p.friendlyName || '',
    }));
  }

  /** Open a COM port, e.g. open('COM5') or open('/dev/ttyUSB0'). */
  async open(path, opts = {}) {
    const { SerialPort } = require('serialport');
    const o = { ...DEFAULT_PORT_OPTS, ...opts };
    this.port = new SerialPort({ path, ...o, autoOpen: false });
    this.port.on('data', (chunk) => this._onData(chunk));
    this.port.on('error', (err) => {
      if (this.pending) this.pending.reject(err);
    });
    await new Promise((resolve, reject) => {
      this.port.open((err) => (err ? reject(err) : resolve()));
    });
  }

  async close() {
    if (this.port && this.port.isOpen) {
      await new Promise((resolve) => this.port.close(() => resolve()));
    }
    this.port = null;
    this.pending = null;
    this.rxBuf = Buffer.alloc(0);
  }

  get isOpen() {
    return !!(this.port && this.port.isOpen);
  }

  _onData(chunk) {
    if (!this.pending) return; // discard unexpected bytes (same as Java version)
    this.rxBuf = Buffer.concat([this.rxBuf, chunk]);
    if (this.rxBuf.length >= 2) {
      const want = this.rxBuf[1];
      if (want >= 4 && this.rxBuf.length >= want) {
        const frame = this.rxBuf.subarray(0, want);
        this.rxBuf = this.rxBuf.subarray(want);
        const p = this.pending;
        this.pending = null;
        p.resolve(frame);
      }
    }
  }

  _transact(packet, timeout) {
    return new Promise((resolve, reject) => {
      if (!this.isOpen) return reject(new Error('port not open'));
      if (this.pending) return reject(new Error('another command already in flight'));
      const timer = setTimeout(() => {
        this.pending = null;
        this.rxBuf = Buffer.alloc(0);
        const e = new Error(`response timeout after ${timeout}ms`);
        e.code = 'TIMEOUT';
        reject(e);
      }, timeout);
      this.pending = {
        resolve: (frame) => {
          clearTimeout(timer);
          resolve(frame);
        },
        reject: (err) => {
          clearTimeout(timer);
          this.pending = null;
          reject(err);
        },
      };
      this.rxBuf = Buffer.alloc(0);
      this.port.write(packet, (err) => {
        if (err && this.pending) this.pending.reject(err);
      });
    });
  }

  /**
   * Send a command and return the parsed payload.
   * Retries on timeout (COMM_RETRY_COUNT), like the Java version.
   */
  async sendCommand(address, command, { timeout = DEFAULT_TIMEOUT_MS, retries = COMM_RETRY_COUNT } = {}) {
    const packet = packPacket(address, command);
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const frame = await this._transact(packet, timeout);
        return parsePacket(frame);
      } catch (err) {
        lastErr = err;
        if (err.code === 'TIMEOUT' && attempt < retries) continue;
        throw err;
      }
    }
    throw lastErr;
  }

  /** "A" command — retrieve device information (1000ms timeout like Java). */
  async getDeviceInformation(address, timeout = 1000) {
    return this.sendCommand(address, Buffer.from('A', 'ascii'), { timeout });
  }
}

module.exports = {
  CSBus,
  packPacket,
  parsePacket,
  checksum,
  COMM_RETRY_COUNT,
  DEFAULT_TIMEOUT_MS,
};
