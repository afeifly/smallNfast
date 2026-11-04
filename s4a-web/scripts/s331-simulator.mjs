#!/usr/bin/env node
/**
 * SUTO Multi-Device Simulator — SUTO CS-Bus over TCP (Ethernet)
 *
 * Emulates multiple SUTO display/data-loggers (identification 0x1065, S331 series)
 * over Ethernet TCP so the s4a-web desktop app can connect to multiple hardware
 * devices simultaneously across different ports (502, 503, 504).
 *
 * Devices:
 *   - Device 1 (Port 502): SUTO S331 (SN 12344321, 8 Channels: Flow, Velocity,
 *                          Consumption, Temp, Pressure, Current A·B·C)
 *   - Device 2 (Port 503): SUTO S331 #2 (SN 12344322, 3 Channels: Flow, Temp, Pressure)
 *   - Device 3 (Port 504): SUTO S331 #3 (SN 12344323, 5 Channels: Flow, Velocity,
 *                          Temp, Pressure, Dew Point)
 *
 * Usage:
 *   node scripts/s331-simulator.mjs                 # Starts all 3 devices on 502, 503, 504
 *   node scripts/s331-simulator.mjs --port 1502     # Starts on 1502, 1503, 1504
 *   node scripts/s331-simulator.mjs --single        # Starts only Device 1 on 502
 *   node scripts/s331-simulator.mjs --selftest      # Built-in protocol verification
 *
 * Zero dependencies. Compatible with macOS, Linux, and Windows.
 */

import net from 'node:net';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : undefined;
};
const BASE_PORT = Number(getArg('port', process.env.S331_PORT || 502));
const HOST = getArg('host', '0.0.0.0');
const SINGLE = args.includes('--single');
const SELFTEST = args.includes('--selftest');

// ---------------------------------------------------------------------------
// CS-Bus framing (mirror of src-tauri/src/suto/protocol.rs)
// ---------------------------------------------------------------------------

const COMM_SUCCESSFUL_CHAR = 0x3e; // '>'
const COMM_CHECKSUM_ERROR_BYTE = 0x01;
const COMM_INVALID_COMMAND_BYTE = 0x3f; // '?'
const COMM_FRAME_MAX_LEN = 192;

function checksum(data, length = data.length) {
  let total = 0;
  for (let i = 0; i < Math.min(length, data.length); i++) {
    total = (total + data[i]) & 0xff;
  }
  return ((total ^ 0xff) + 1) & 0xff;
}

/** Single frame: [addr][len][payload...][cksum][0x00] */
function packPacket(addr, payload) {
  const totalLen = payload.length + 4;
  const pkt = Buffer.alloc(totalLen);
  pkt[0] = addr;
  pkt[1] = totalLen;
  payload.copy(pkt, 2);
  pkt[totalLen - 2] = checksum(pkt, totalLen - 2);
  pkt[totalLen - 1] = 0x00;
  return pkt;
}

/**
 * Multi-frame reply: guarantees final frame < 192 bytes so client completes fast.
 */
function packFrames(addr, payload) {
  const out = [];
  let idx = 0;
  let first = true;
  for (;;) {
    const cap = COMM_FRAME_MAX_LEN - 4 - (first ? 1 : 0);
    const remaining = payload.length - idx;
    let take = Math.min(remaining, cap);
    if (remaining - take === 0 && take === cap && take > 1) take -= 1; // force small final frame
    const frameLen = 4 + take + (first ? 1 : 0);
    const frame = Buffer.alloc(frameLen);
    frame[0] = addr;
    frame[1] = frameLen;
    if (first) frame[2] = COMM_SUCCESSFUL_CHAR;
    payload.copy(frame, first ? 3 : 2, idx, idx + take);
    frame[frameLen - 2] = checksum(frame, frameLen - 2);
    frame[frameLen - 1] = 0x00;
    out.push(frame);
    first = false;
    idx += take;
    if (idx >= payload.length) break;
  }
  return Buffer.concat(out);
}

/** Extract complete request frames from a byte buffer. Returns [frames, rest]. */
function extractFrames(buf) {
  const frames = [];
  let off = 0;
  while (off + 4 <= buf.length) {
    const len = buf[off + 1];
    if (len < 4) throw new Error(`bad frame length ${len} at offset ${off}`);
    if (off + len > buf.length) break;
    frames.push({ addr: buf[off], payload: buf.subarray(off + 2, off + len - 2), raw: buf.subarray(off, off + len) });
    off += len;
  }
  return [frames, buf.subarray(off)];
}

// ---------------------------------------------------------------------------
// Constants & Device Models
// ---------------------------------------------------------------------------

const DAY = 86400;
const LOG_INTERVAL = 60; // seconds per sample
const SESSION_SAMPLES = (7 * DAY) / LOG_INTERVAL; // 10080
const CONSUMPTION_UNITS = new Set([24, 25, 26, 27, 28, 47]);

const CTY_SYS = 0x01;
const CTY_LOGGER = 0x03;
const CTY_MEAS = 0x04;
const CTY_DEVICE = 0x09;
const SUB_NONE = 0xff;
const SCTY_LOG = 0x01;
const ACCESS_CODE = [0x5a, 0xa5];

const str = (s) => Buffer.from(s, 'utf8');
const u32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0, 0);
  return b;
};

function putStr(buf, off, len, strVal) {
  const b = Buffer.from(strVal, 'utf8');
  b.copy(buf, off, 0, Math.min(len - 1, b.length));
}

function tsName(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.png`;
}

// --- Virtual screenshots (24-bit BMP, 240x160) -------------------------------

const IMG_W = 240;
const IMG_H = 160;
const TRACE_COLORS = [
  [0x4f, 0xc3, 0xf7], // flow (BGR)
  [0x84, 0xc7, 0x81], // velocity
  [0x54, 0xd5, 0xff], // consumption
  [0x65, 0xff, 0xff], // temperature
  [0xc8, 0x68, 0xba], // pressure
  [0x7c, 0xa5, 0xff], // current A / dew point
  [0xd6, 0xa5, 0xa7], // current B
  [0x4f, 0xb7, 0xff], // current C
];

function makeBmp(seed, channels) {
  const rowSize = IMG_W * 3; // 720, 4-byte aligned
  const imgSize = rowSize * IMG_H;
  const buf = Buffer.alloc(54 + imgSize);

  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(54 + imgSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(IMG_W, 18);
  buf.writeInt32LE(IMG_H, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(imgSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);

  const px = (x, y, [b, g, r]) => {
    if (x < 0 || x >= IMG_W || y < 0 || y >= IMG_H) return;
    const off = 54 + (IMG_H - 1 - y) * rowSize + x * 3;
    buf[off] = b;
    buf[off + 1] = g;
    buf[off + 2] = r;
  };

  for (let y = 0; y < IMG_H; y++) {
    for (let x = 0; x < IMG_W; x++) {
      px(x, y, y < 18 ? [0x2a, 0x35, 0x1b] : [0x14, 0x1b, 0x22]);
    }
  }
  for (let y = 18; y < IMG_H; y += 24) for (let x = 0; x < IMG_W; x += 2) px(x, y, [0x33, 0x3d, 0x45]);
  for (let x = 0; x < IMG_W; x += 30) for (let y = 18; y < IMG_H; y += 2) px(x, y, [0x33, 0x3d, 0x45]);

  channels.forEach((ch, i) => {
    const color = TRACE_COLORS[i % TRACE_COLORS.length];
    for (let x = 0; x < IMG_W; x++) {
      const p = x / IMG_W;
      const v = Math.sin(p * Math.PI * 4 + seed + i * 1.1) * 0.5 + Math.sin(p * Math.PI * 17 + seed * 2) * 0.15;
      const y = Math.round(88 + v * 52);
      px(x, y, color);
      if (x % 3 === 0) px(x, y + 1, color);
    }
  });
  return buf;
}

// ---------------------------------------------------------------------------
// Device Definitions
// ---------------------------------------------------------------------------

export const DEVICE_CONFIGS = [
  // Device 1: SUTO S331 (Port 502, 8 Channels)
  {
    portOffset: 0,
    serial: 12344321,
    name: 'SUTO S331',
    seed: 0,
    channels: [
      { no: 1, desc: 'Flow', unitIdx: 14, unit: 'm³/h', resolution: 1, sensor: 'SUTO SFAB' },
      { no: 2, desc: 'Velocity', unitIdx: 10, unit: 'm/s', resolution: 2, sensor: 'SUTO SFAB' },
      { no: 3, desc: 'Consumption', unitIdx: 24, unit: 'm³', resolution: 0, sensor: 'SUTO SFAB' },
      { no: 4, desc: 'Temperature', unitIdx: 1, unit: '°C', resolution: 1, sensor: 'SUTO ST550' },
      { no: 5, desc: 'Pressure', unitIdx: 38, unit: 'bar', resolution: 2, sensor: 'SUTO SP560' },
      { no: 6, desc: 'Current A', unitIdx: 45, unit: 'A', resolution: 1, sensor: 'SUTO SC3' },
      { no: 7, desc: 'Current B', unitIdx: 45, unit: 'A', resolution: 1, sensor: 'SUTO SC3' },
      { no: 8, desc: 'Current C', unitIdx: 45, unit: 'A', resolution: 1, sensor: 'SUTO SC3' },
    ],
  },
  // Device 2: SUTO S331 #2 (Port 503, 3 Channels)
  {
    portOffset: 1,
    serial: 12344322,
    name: 'SUTO S331 #2',
    seed: 2.5,
    channels: [
      { no: 1, desc: 'Flow', unitIdx: 14, unit: 'm³/h', resolution: 1, sensor: 'SUTO S401' },
      { no: 2, desc: 'Temperature', unitIdx: 1, unit: '°C', resolution: 1, sensor: 'SUTO ST550' },
      { no: 3, desc: 'Pressure', unitIdx: 38, unit: 'bar', resolution: 2, sensor: 'SUTO SP560' },
    ],
  },
  // Device 3: SUTO S331 #3 (Port 504, 5 Channels)
  {
    portOffset: 2,
    serial: 12344323,
    name: 'SUTO S331 #3',
    seed: 5.1,
    channels: [
      { no: 1, desc: 'Flow', unitIdx: 14, unit: 'm³/h', resolution: 1, sensor: 'SUTO S520' },
      { no: 2, desc: 'Velocity', unitIdx: 10, unit: 'm/s', resolution: 2, sensor: 'SUTO S520' },
      { no: 3, desc: 'Temperature', unitIdx: 1, unit: '°C', resolution: 1, sensor: 'SUTO ST550' },
      { no: 4, desc: 'Pressure', unitIdx: 38, unit: 'bar', resolution: 2, sensor: 'SUTO SP560' },
      { no: 5, desc: 'Dew Point', unitIdx: 2, unit: '°Ctd', resolution: 1, sensor: 'SUTO S220' },
    ],
  },
];

// Export DEV object matching Device 1 for test backward compatibility
export const DEV = {
  addr: 1,
  busVersion: 2,
  identification: 0x1065,
  fwByte: 0xb4,
  fwString: '1.80',
  hwVersion: '1.0',
  serial: DEVICE_CONFIGS[0].serial,
  name: DEVICE_CONFIGS[0].name,
  caliDate: '2025-06-15',
};

// ---------------------------------------------------------------------------
// Device Simulator Instance Factory
// ---------------------------------------------------------------------------

function buildChannelStruct(ch, devName) {
  const s = Buffer.alloc(204);
  s[0] = ch.no; // logical channel number
  putStr(s, 1, 21, devName); // device description
  putStr(s, 22, 21, 'MP001'); // sub-device description
  putStr(s, 43, 21, ch.sensor); // sensor description
  putStr(s, 64, 21, ch.desc); // channel description
  s[85] = ch.resolution;
  s[86] = ch.unitIdx;
  s.write('', 87);
  s.writeInt32LE(1, 99); // device id
  s.writeInt32LE(1, 103); // sub device id
  const sensorId = ch.desc === 'Temperature' ? 2
    : ch.desc === 'Pressure' ? 3
    : ch.desc === 'Dew Point' ? 5
    : ch.desc.startsWith('Current') ? 4
    : 1;
  s.writeInt32LE(sensorId, 107);
  s.writeInt32LE(ch.no, 111);
  s[115] = 1;
  s[116] = 1;
  s[138] = 0;
  s[196] = 0;
  return s;
}

function buildSessions(channelsCount) {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      name: 'LOG0000',
      firstSample: now - 14 * DAY,
      samples: SESSION_SAMPLES,
      channelsCount,
      recording: false,
      description: 'Compressed air monitoring session 1',
    },
    {
      name: 'LOG0001',
      firstSample: now - 7 * DAY,
      samples: SESSION_SAMPLES,
      channelsCount,
      recording: true,
      description: 'Compressed air monitoring session 2',
    },
  ];
}

export function createDeviceHandler(config) {
  const dev = {
    addr: 1,
    busVersion: 2,
    identification: 0x1065,
    fwByte: 0xb4,
    fwString: '1.80',
    hwVersion: '1.0',
    serial: config.serial,
    name: config.name,
    caliDate: '2025-06-15',
  };

  const channels = config.channels;
  const channelStructs = channels.map((ch) => buildChannelStruct(ch, dev.name));
  const sessions = buildSessions(channels.length);
  const screenshots = [2 * DAY, 1 * DAY, 2 * 3600].map((age, i) => {
    const bytes = makeBmp(i * 1.7 + config.seed, channels);
    return { name: tsName(new Date(Date.now() - age * 1000)), bytes, size: bytes.length };
  });

  function channelValue(ch, t) {
    const s = config.seed;
    switch (ch.desc) {
      case 'Flow':
        return (config.serial === 12344321 ? 118.4 : (config.serial === 12344322 ? 84.5 : 235.0))
          + 35 * Math.sin(t / 300 + s) + 4.5 * Math.sin(t / 37 + s * 1.3);
      case 'Velocity':
        return (config.serial === 12344321 ? 4.12 : 14.8)
          + 1.15 * Math.sin(t / 300 + s + 0.8) + 0.18 * Math.sin(t / 23);
      case 'Consumption':
        return 184320 + (t - sessions[0].firstSample) * 0.0327;
      case 'Temperature':
        return (config.serial === 12344321 ? 23.5 : (config.serial === 12344322 ? 21.2 : 26.8))
          + 2.5 * Math.sin(t / 1800 + s) + 0.3 * Math.sin(t / 331);
      case 'Pressure':
        return (config.serial === 12344321 ? 6.75 : (config.serial === 12344322 ? 7.35 : 6.15))
          + 0.45 * Math.sin(t / 600 + s + 2.1) + 0.05 * Math.sin(t / 53);
      case 'Dew Point':
        return -42.5 + 4.5 * Math.sin(t / 900 + s);
      case 'Current A':
        return 11.5 + 2.8 * Math.sin(t / 240) + 0.4 * Math.sin(t / 17);
      case 'Current B':
        return 11.2 + 2.6 * Math.sin(t / 240 + (2 * Math.PI) / 3) + 0.3 * Math.sin(t / 19);
      case 'Current C':
        return 11.4 + 2.7 * Math.sin(t / 240 + (4 * Math.PI) / 3) + 0.35 * Math.sin(t / 23);
      default:
        return 0;
    }
  }

  function sysInfoReply(act) {
    switch (act) {
      case 0x03: return u32(dev.serial);
      case 0x07: { const b = Buffer.alloc(2); b.writeUInt16LE(dev.identification, 0); return b; }
      case 0x09: return str(dev.hwVersion);
      case 0x0b: return str(dev.caliDate);
      case 0x23: return Buffer.from([channels.length]);
      case 0x39: return str(dev.fwString);
      case 0x51: return str(dev.name);
      default: return null;
    }
  }

  function onlineValues(start, count) {
    const t = Date.now() / 1000;
    const out = Buffer.alloc(count * 7);
    for (let i = 0; i < count; i++) {
      const no = start + i;
      const ch = channels.find((c) => c.no === no);
      const off = i * 7;
      if (!ch) {
        out[off + 6] = 0x04; // invalid
        continue;
      }
      const v = channelValue(ch, t);
      if (CONSUMPTION_UNITS.has(ch.unitIdx)) {
        out.writeUInt32LE(Math.max(0, Math.floor(v)), off);
      } else {
        out.writeFloatLE(v, off);
      }
      out[off + 4] = ch.resolution;
      out[off + 5] = ch.unitIdx;
      out[off + 6] = 0x00; // normal
    }
    return out;
  }

  function channelSettings(start, count) {
    const parts = [];
    for (let no = start; no < start + count; no++) {
      const idx = channels.findIndex((c) => c.no === no);
      if (idx >= 0) parts.push(channelStructs[idx]);
      else {
        const empty = Buffer.alloc(204);
        empty[0] = 0xff;
        parts.push(empty);
      }
    }
    return Buffer.concat(parts);
  }

  function fileList(ctrl) {
    const sess = ctrl === 0 ? sessions : sessions.slice(10);
    const entries = sess.map((s) => {
      const e = Buffer.alloc(161);
      putStr(e, 0, 12, s.name);
      e.writeBigInt64LE(BigInt(s.firstSample), 12);
      e.writeUInt32LE(s.samples, 20);
      e[24] = channels.length;
      e.writeUInt32LE(s.recording ? 1 : 0, 25);
      e.writeUInt32LE(LOG_INTERVAL, 29);
      putStr(e, 33, 128, s.description);
      return e;
    });
    return Buffer.concat([Buffer.from([entries.length]), ...entries]);
  }

  function findScreenshot(rawName) {
    let name = String(rawName).replace(/\0+$/, '').trim();
    if (name.toLowerCase().endsWith('.png.bmp')) name = name.slice(0, -4);
    let hit = screenshots.find((s) => s.name === name);
    if (!hit && name.toLowerCase().endsWith('.bmp')) {
      const stripped = name.slice(0, -4);
      hit = screenshots.find((s) => s.name === stripped);
    }
    return hit;
  }

  function handlePayload(p) {
    // Discovery: payload 'A' (0x41)
    if (p.length === 1 && p[0] === 0x41) {
      return Buffer.concat([
        Buffer.from([dev.busVersion, dev.identification & 0xff, dev.identification >> 8, dev.fwByte]),
        u32(dev.serial),
      ]);
    }

    if (p[0] === CTY_SYS && p[1] === SUB_NONE) {
      const r = sysInfoReply(p[2]);
      if (r) return r;
    }

    // Channel settings: 0x02 standard + 0x0B transformed
    if (p[0] === CTY_MEAS && p[1] === 0x02 && (p[2] === 0x02 || p[2] === 0x0b) && p.length >= 5) {
      return channelSettings(p[3], p[4]);
    }

    // Online values: [04 01 01 start count]
    if (p[0] === CTY_MEAS && p[1] === 0x01 && p[2] === 0x01 && p.length >= 5) {
      return onlineValues(p[3], p[4]);
    }

    // Logger status [03 01 act]
    if (p[0] === CTY_LOGGER && p[1] === SCTY_LOG) {
      const cur = sessions[sessions.length - 1];
      switch (p[2]) {
        case 0x01: return Buffer.from([1]);
        case 0x02: return u32(cur.samples);
        case 0x03: return Buffer.concat([u32(cur.firstSample), u32(cur.firstSample + (cur.samples - 1) * LOG_INTERVAL)]);
        case 0x0c: return u32(LOG_INTERVAL);
      }
    }

    // Logger file access [03 FF act ...]
    if (p[0] === CTY_LOGGER && p[1] === SUB_NONE) {
      if (p[2] === 0x04) return Buffer.from(ACCESS_CODE);
      if (p[2] === 0x12) return u32(sessions.length);
      if (p[2] === 0x07 && p.length >= 8) return fileList(p[5]);
      if (p[2] === 0x0c) return Buffer.alloc(0);
    }

    // Device screenshots [09 08 act ...]
    if (p[0] === CTY_DEVICE && p[1] === 0x08) {
      switch (p[2]) {
        case 0x0d: return u32(screenshots.length);
        case 0x0e: {
          const startIdx = p.readUInt32LE(3);
          const batch = p.readUInt32LE(7);
          const items = screenshots.slice(startIdx, startIdx + batch);
          return Buffer.concat(items.map((s) => {
            const e = Buffer.alloc(59);
            e.writeUInt32LE(s.size, 0);
            putStr(e, 4, 55, s.name);
            return e;
          }));
        }
        case 0x0f: {
          const nameRaw = p.subarray(11, 11 + 55);
          const hit = findScreenshot(nameRaw);
          if (!hit) return { error: COMM_INVALID_COMMAND_BYTE };
          const off = p.readUInt32LE(3);
          return hit.bytes.subarray(off);
        }
        case 0x11: return Buffer.alloc(0);
      }
    }

    return { error: COMM_INVALID_COMMAND_BYTE };
  }

  return { dev, channels, sessions, screenshots, handlePayload };
}

function describe(p) {
  const h = (b) => (b ?? 0).toString(16).padStart(2, '0');
  if (p.length === 1 && p[0] === 0x41) return 'discovery';
  if (p.length < 3) return `raw ${[...p].map(h).join(' ')}`;
  const names = {
    '0103': 'sys/serial', '0107': 'sys/device-id', '0109': 'sys/hw', '010b': 'sys/cali',
    '0123': 'sys/max-channels', '0139': 'sys/fw', '0151': 'sys/name',
    '0402': `ch-settings(0x${h(p[2])}) ${p[3] ?? '?'}..${(p[3] ?? 0) + (p[4] ?? 0) - 1}`,
    '0401': `online-values ${p[3] ?? '?'}..${(p[3] ?? 0) + (p[4] ?? 0) - 1}`,
    '0301': `log-status/0x${h(p[2])}`,
    '0304': 'log/access-code', '0312': 'log/file-count',
    '0307': 'log/file-list', '030c': 'log/finished',
    '090d': 'img/count', '090e': 'img/info', '090f': 'img/read', '0911': 'img/close',
  };
  return names[`${h(p[0])}${h(p[1])}`] || 'unknown';
}

// ---------------------------------------------------------------------------
// TCP Server Creation
// ---------------------------------------------------------------------------

function startDeviceServer(deviceHandler, port, host, log = () => {}) {
  const { dev, handlePayload } = deviceHandler;

  const server = net.createServer((socket) => {
    let rest = Buffer.alloc(0);
    log(`[${dev.name}:${port}] client connected ${socket.remoteAddress}`);

    socket.on('data', (chunk) => {
      rest = Buffer.concat([rest, chunk]);
      let frames;
      try {
        [frames, rest] = extractFrames(rest);
      } catch (e) {
        log(`[${dev.name}:${port}] frame error: ${e.message}`);
        socket.write(packPacket(dev.addr, Buffer.from([COMM_CHECKSUM_ERROR_BYTE])));
        rest = Buffer.alloc(0);
        return;
      }
      for (const f of frames) {
        const expect = checksum(f.raw, f.raw.length - 2);
        if (f.raw[f.raw.length - 2] !== expect) {
          log(`[${dev.name}:${port}] checksum mismatch`);
          socket.write(packPacket(dev.addr, Buffer.from([COMM_CHECKSUM_ERROR_BYTE])));
          continue;
        }
        const label = describe(f.payload);
        const result = handlePayload(f.payload);
        if (result && result.error !== undefined) {
          log(`[${dev.name}:${port}] ← ${label}  → error 0x${result.error.toString(16)}`);
          socket.write(packPacket(dev.addr, Buffer.from([result.error])));
        } else {
          const reply = packFrames(dev.addr, result || Buffer.alloc(0));
          log(`[${dev.name}:${port}] ← ${label}  → ${reply.length} B`);
          socket.write(reply);
        }
      }
    });

    socket.on('error', (e) => log(`[${dev.name}:${port}] client error: ${e.message}`));
    socket.on('close', () => log(`[${dev.name}:${port}] client disconnected`));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      server.on('error', (e) => log(`[${dev.name}:${port}] server error: ${e.message}`));
      resolve(server);
    });
  });
}

// ---------------------------------------------------------------------------
// Main Multi-Device Launcher & Banner
// ---------------------------------------------------------------------------

function printMultiBanner(servers) {
  console.log(`
  ┌────────────────────────────────────────────────────────────────────────┐
  │  SUTO Multi-Device Simulator (3 Simulators Active)                      │
  ├────────────────────────────────────────────────────────────────────────┤`);
  servers.forEach(({ dev, port, channels }) => {
    const chNames = channels.map((c) => c.desc).join(', ');
    console.log(`  │  Port ${String(port).padEnd(5)}: ${dev.name.padEnd(16)} (SN ${dev.serial}) · ${channels.length} Channels      │`);
    console.log(`  │         Channels: ${chNames.slice(0, 52).padEnd(52)} │`);
  });
  console.log(`  ├────────────────────────────────────────────────────────────────────────┤
  │  Host: ${HOST}                                                        │
  │  In Sensor Manager: Click '+ Connect Device' → 'Ethernet TCP'           │
  │  Enter 127.0.0.1 and port 502, 503, or 504 to connect each simulator!   │
  └────────────────────────────────────────────────────────────────────────┘
  Press Ctrl+C to stop all simulator servers.
`);
}

if (!SELFTEST) {
  const logFn = (msg) => {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}] ${msg}`);
  };

  const devicesToStart = SINGLE ? [DEVICE_CONFIGS[0]] : DEVICE_CONFIGS;

  Promise.all(
    devicesToStart.map((cfg) => {
      const port = BASE_PORT + cfg.portOffset;
      const handler = createDeviceHandler(cfg);
      return startDeviceServer(handler, port, HOST, logFn).then((srv) => ({
        server: srv,
        dev: handler.dev,
        port,
        channels: handler.channels,
      }));
    })
  )
    .then((runningServers) => {
      printMultiBanner(runningServers);
    })
    .catch((e) => {
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        const script = fileURLToPath(import.meta.url);
        console.error(`
  ✗ Cannot bind ports below 1024:
    To listen on 502, 503, 504 without root on Linux, run with sudo or use --port 1502:
        sudo -E env "PATH=$PATH" ${process.execPath} ${script}
        npm run sim:s331 -- --port 1502
`);
      } else if (e.code === 'EADDRINUSE') {
        console.error(`
  ✗ Port is already in use. Stop the other process or pass --port <port>:
        npm run sim:s331 -- --port 1502
`);
      } else {
        console.error(`  ✗ Simulator failed to start: ${e.message}`);
      }
      process.exit(1);
    });
}

// ---------------------------------------------------------------------------
// Selftest Client (Protocol Verification)
// ---------------------------------------------------------------------------

export function deframe(raw) {
  if (raw.length < 5) throw new Error('too short');
  const firstLen = raw[1];
  if (raw.length === firstLen) {
    const ck = checksum(raw, firstLen - 2);
    if (raw[firstLen - 2] !== ck) throw new Error('single-frame checksum mismatch');
    if (raw[2] !== COMM_SUCCESSFUL_CHAR) throw new Error(`bad status 0x${raw[2].toString(16)}`);
    return { payload: raw.subarray(3, firstLen - 2), lastFrameLen: firstLen };
  }
  let out = Buffer.alloc(0);
  let off = 0;
  let lastLen = 0;
  let idx = 0;
  while (off < raw.length) {
    const len = raw[off + 1];
    if (len < 4) throw new Error(`bad frame len ${len}`);
    if (off + len > raw.length) throw new Error('truncated frame');
    const frame = raw.subarray(off, off + len);
    if (frame[len - 2] !== checksum(frame, len - 2)) throw new Error(`frame ${idx} checksum mismatch`);
    if (idx === 0) {
      if (frame[2] !== COMM_SUCCESSFUL_CHAR) throw new Error('first frame status not >');
      out = Buffer.concat([out, frame.subarray(3, len - 2)]);
    } else {
      out = Buffer.concat([out, frame.subarray(2, len - 2)]);
    }
    lastLen = len;
    off += len;
    idx++;
  }
  return { payload: out, lastFrameLen: lastLen };
}

export async function runSelftest() {
  let pass = 0;
  let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) {
      pass++;
      console.log(`  ✓ ${name}`);
    } else {
      fail++;
      console.error(`  ✗ ${name} ${detail}`);
    }
  };

  const handler = createDeviceHandler(DEVICE_CONFIGS[0]);
  const server = await startDeviceServer(handler, 0, '127.0.0.1', () => {});
  const { port } = server.address();
  const sock = net.connect(port, '127.0.0.1');
  await new Promise((r) => sock.once('connect', r));
  let rxBuf = Buffer.alloc(0);
  const pending = [];
  sock.on('data', (c) => {
    rxBuf = Buffer.concat([rxBuf, c]);
    let off = 0;
    while (off + 2 <= rxBuf.length) {
      const len = rxBuf[off + 1];
      if (len < 4 || rxBuf.length < off + len) return;
      if (len < 192) {
        const data = rxBuf;
        rxBuf = Buffer.alloc(0);
        pending.shift()?.(data);
        return;
      }
      off += len;
    }
  });

  const cmd = async (payload, addr = DEV.addr) => {
    sock.write(packPacket(addr, payload));
    const raw = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      pending.push((data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
    return deframe(raw);
  };

  console.log('\nSUTO Multi-Device Simulator Selftest\n===================================');

  // 1. Discovery
  {
    const { payload, lastFrameLen } = await cmd(Buffer.from([0x41]), 0);
    ok('discovery: frame ≥ 11 bytes', lastFrameLen >= 11);
    ok('discovery: bus version', payload[0] === DEV.busVersion);
    ok('discovery: identification = 0x1065', payload.readUInt16LE(1) === 0x1065);
    ok('discovery: serial in frame', payload.readUInt32LE(4) === DEV.serial);
  }

  // 2. System info
  {
    const { payload } = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x03]));
    ok('serial = 12344321', payload.readUInt32LE(0) === 12344321);
    const nm = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x51]));
    ok('device name = "SUTO S331"', nm.payload.toString().trim() === 'SUTO S331');
  }

  // 3. Channels
  {
    const mc = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x23]));
    ok('max channel count = 8', mc.payload[0] === 8);
  }

  sock.destroy();
  server.close();
  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

if (SELFTEST) {
  runSelftest().catch((e) => {
    console.error('selftest crashed:', e);
    process.exitCode = 1;
  });
}
