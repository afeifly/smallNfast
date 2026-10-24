#!/usr/bin/env node
/**
 * S331 Device Simulator — SUTO CS-Bus over TCP (Ethernet)
 *
 * Simulates a SUTO S331 display/data-logger (identification 0x1065) so the
 * s4a-web desktop app can connect to it via "Connect via Ethernet TCP".
 *
 * Implemented against src-tauri/src/suto/{protocol,commands,mod}.rs:
 *   - Discovery ('A' / 0x41) with address 0 → device info frame (S331, fw 1.80)
 *   - System info (serial 12344321, device id, fw, name, calibration date)
 *   - Channel settings (204-byte DS310 structs, standard 0x02 + transformed 0x0B)
 *   - Online values (7-byte structs, live sine-wave signals)
 *   - Logger status / access code / file list (161-byte entries, fixed periods)
 *   - Screenshots (virtual BMPs, count/info/read/close)
 *
 * Usage:
 *   node scripts/s331-simulator.mjs [--port 502] [--host 0.0.0.0]
 *   node scripts/s331-simulator.mjs --selftest
 *
 * Zero dependencies. Default port 502 matches the app's Ethernet dialog.
 * macOS 10.14+ and Windows can bind it directly; on Linux (or old macOS)
 * ports < 1024 need root — on EACCES the script prints the sudo command,
 * or pass --port 1502 and enter that port in the app's connect dialog.
 *
 * Full documentation: scripts/s331-simulator.md
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
const PORT = Number(getArg('port', process.env.S331_PORT || 502));
const HOST = getArg('host', '0.0.0.0');
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
 * Multi-frame reply (mirror of protocol.rs pack_frames): first frame carries
 * the '>' status byte, all other frames are payload-only. Unlike the Rust
 * helper we guarantee the final frame is < 192 bytes so the client's
 * is_response_complete() fires immediately (a reply ending on a full 192-byte
 * frame would otherwise cost the client ~1.6 s of idle-wait).
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
    idx += take;
    first = false;
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
// Device model — SUTO S331
// ---------------------------------------------------------------------------

const DEV = {
  addr: 1,
  busVersion: 2,
  identification: 0x1065, // S331 (commands.rs DEVICE_TYPE_S331)
  fwByte: 0xb4,           // 180 → fw 1.80 (≥ 1.54 ⇒ transformed channel settings)
  fwString: '1.80',
  hwVersion: '1.0',
  serial: 12344321,
  name: 'SUTO S331',
  caliDate: '2025-06-15',
};

// Unit indices mirror commands.rs lookup_unit():
//  10 = m/s, 14 = m³/h, 24 = m³ (consumption → integer), 1 = °C, 38 = bar
const CHANNELS = [
  { no: 1, desc: 'Flow', unitIdx: 14, unit: 'm³/h', resolution: 1, sensor: 'SUTO SFAB' },
  { no: 2, desc: 'Velocity', unitIdx: 10, unit: 'm/s', resolution: 2, sensor: 'SUTO SFAB' },
  { no: 3, desc: 'Consumption', unitIdx: 24, unit: 'm³', resolution: 0, sensor: 'SUTO SFAB' },
  { no: 4, desc: 'Temperature', unitIdx: 1, unit: '°C', resolution: 1, sensor: 'SUTO ST550' },
  { no: 5, desc: 'Pressure', unitIdx: 38, unit: 'bar', resolution: 2, sensor: 'SUTO SP560' },
];
const CONSUMPTION_UNITS = new Set([24, 25, 26, 27, 28, 47]);

const DAY = 86400;
const LOG_INTERVAL = 60; // seconds per sample
const SESSION_SAMPLES = 7 * DAY / LOG_INTERVAL; // 10080

/** Two fixed logger sessions, computed relative to "now" when the sim boots. */
function buildSessions() {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      name: 'LOG0000',
      firstSample: now - 14 * DAY,
      samples: SESSION_SAMPLES,
      recording: false,
      description: 'Compressed air line A (simulated)',
    },
    {
      name: 'LOG0001',
      firstSample: now - 7 * DAY,
      samples: SESSION_SAMPLES,
      recording: true,
      description: 'Compressed air line A (simulated)',
    },
  ];
}
let SESSIONS = buildSessions();

// --- Live signal generator (deterministic from wall clock) ------------------

function channelValue(ch, t) {
  switch (ch.desc) {
    case 'Flow':
      return 118.4 + 42 * Math.sin(t / 300) + 5.5 * Math.sin(t / 37 + 1.3);
    case 'Velocity':
      return 4.12 + 1.15 * Math.sin(t / 300 + 0.8) + 0.18 * Math.sin(t / 23);
    case 'Consumption':
      return 184320 + (t - SESSIONS[0].firstSample) * 0.0327; // m³, monotonic
    case 'Temperature':
      return 23.5 + 2.8 * Math.sin(t / 1800) + 0.3 * Math.sin(t / 331);
    case 'Pressure':
      return 6.75 + 0.45 * Math.sin(t / 600 + 2.1) + 0.06 * Math.sin(t / 53);
    default:
      return 0;
  }
}

// --- 204-byte DS310 channel struct (commands.rs parse_channel_settings) ------

function putStr(buf, off, len, str) {
  const b = Buffer.from(str, 'utf8');
  b.copy(buf, off, 0, Math.min(len - 1, b.length));
}

function buildChannelStruct(ch) {
  const s = Buffer.alloc(204);
  s[0] = ch.no; // logical channel number
  putStr(s, 1, 21, DEV.name); // device description
  putStr(s, 22, 21, 'MP001'); // sub-device description
  putStr(s, 43, 21, ch.sensor); // sensor description
  putStr(s, 64, 21, ch.desc); // channel description
  s[85] = ch.resolution;
  s[86] = ch.unitIdx;
  s.write('', 87); // unit ASCII stays empty (standard units)
  s.writeInt32LE(1, 99); // device id
  s.writeInt32LE(1, 103); // sub device id
  const sensorId = ch.desc === 'Temperature' ? 2 : ch.desc === 'Pressure' ? 3 : 1;
  s.writeInt32LE(sensorId, 107); // sensor id (flow family shares 1)
  s.writeInt32LE(ch.no, 111); // channel id
  s[115] = 1; // slaver type
  s[116] = 1; // slaver addr
  s[138] = 0; // mb output value type: float (consumption handled via unit idx)
  s[196] = 0; // ch optional config: visible
  return s;
}
const CHANNEL_STRUCTS = CHANNELS.map(buildChannelStruct);

// --- Virtual screenshots (24-bit BMP, 240x160) -------------------------------

const IMG_W = 240;
const IMG_H = 160;
const TRACE_COLORS = [
  [0x4f, 0xc3, 0xf7], // flow (BGR)
  [0x84, 0xc7, 0x81], // velocity
  [0x54, 0xd5, 0xff], // consumption
  [0x65, 0xff, 0xff], // temperature
  [0xc8, 0x68, 0xba], // pressure
];

function makeBmp(seed) {
  const rowSize = IMG_W * 3; // 720, already 4-byte aligned
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
    const off = 54 + (IMG_H - 1 - y) * rowSize + x * 3; // bottom-up
    buf[off] = b;
    buf[off + 1] = g;
    buf[off + 2] = r;
  };

  // background + title bar
  for (let y = 0; y < IMG_H; y++) {
    for (let x = 0; x < IMG_W; x++) {
      px(x, y, y < 18 ? [0x2a, 0x35, 0x1b] : [0x14, 0x1b, 0x22]);
    }
  }
  // grid
  for (let y = 18; y < IMG_H; y += 24) for (let x = 0; x < IMG_W; x += 2) px(x, y, [0x33, 0x3d, 0x45]);
  for (let x = 0; x < IMG_W; x += 30) for (let y = 18; y < IMG_H; y += 2) px(x, y, [0x33, 0x3d, 0x45]);
  // five traces, one per channel (seed shifts phase)
  CHANNELS.forEach((ch, i) => {
    const color = TRACE_COLORS[i];
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

function tsName(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.png`;
}

const SCREENSHOTS = [2 * DAY, 1 * DAY, 2 * 3600].map((age, i) => {
  const bytes = makeBmp(i * 1.7);
  return { name: tsName(new Date(Date.now() - age * 1000)), bytes, size: bytes.length };
});

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

const CTY_SYS = 0x01, CTY_LOGGER = 0x03, CTY_MEAS = 0x04, CTY_DEVICE = 0x09;
const SUB_NONE = 0xff, SCTY_LOG = 0x01;
const ACCESS_CODE = [0x5a, 0xa5];

const str = (s) => Buffer.from(s, 'utf8');
const u32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0, 0);
  return b;
};
const i32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(v | 0, 0);
  return b;
};

function sysInfoReply(act) {
  switch (act) {
    case 0x03: return u32(DEV.serial);              // serial number
    case 0x07: { const b = Buffer.alloc(2); b.writeUInt16LE(DEV.identification, 0); return b; }
    case 0x09: return str(DEV.hwVersion);
    case 0x0b: return str(DEV.caliDate);
    case 0x23: return Buffer.from([CHANNELS.length]); // max channel count
    case 0x39: return str(DEV.fwString);
    case 0x51: return str(DEV.name);
    default: return null;
  }
}

function onlineValues(start, count) {
  const t = Date.now() / 1000;
  const out = Buffer.alloc(count * 7);
  for (let i = 0; i < count; i++) {
    const no = start + i;
    const ch = CHANNELS.find((c) => c.no === no);
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
    const idx = CHANNELS.findIndex((c) => c.no === no);
    if (idx >= 0) parts.push(CHANNEL_STRUCTS[idx]);
    else {
      const empty = Buffer.alloc(204);
      empty[0] = 0xff; // unconfigured slot
      parts.push(empty);
    }
  }
  return Buffer.concat(parts);
}

function fileCount() { return SESSIONS.length; }

function fileList(ctrl) {
  // ctrl 0 = start from beginning; with ≤2 sessions a single batch covers all
  const sessions = ctrl === 0 ? SESSIONS : SESSIONS.slice(10);
  const entries = sessions.map((s) => {
    const e = Buffer.alloc(161);
    putStr(e, 0, 12, s.name);
    e.writeBigInt64LE(BigInt(s.firstSample), 12);
    e.writeUInt32LE(s.samples, 20);
    e[24] = CHANNELS.length;
    e.writeUInt32LE(s.recording ? 1 : 0, 25);
    e.writeUInt32LE(LOG_INTERVAL, 29);
    putStr(e, 33, 128, s.description);
    return e;
  });
  return Buffer.concat([Buffer.from([entries.length]), ...entries]);
}

function findScreenshot(rawName) {
  let name = String(rawName).replace(/\0+$/, '').trim();
  if (name.toLowerCase().endsWith('.png.bmp')) name = name.slice(0, -4); // mirror Rust trim
  let hit = SCREENSHOTS.find((s) => s.name === name);
  if (!hit && name.toLowerCase().endsWith('.bmp')) {
    const stripped = name.slice(0, -4);
    hit = SCREENSHOTS.find((s) => s.name === stripped);
  }
  return hit;
}

/**
 * Handle one request frame's payload. Returns reply payload Buffer, or
 * { error: byte } for protocol error statuses.
 */
function handlePayload(p) {
  // Discovery: payload is just 'A' (0x41), any address
  if (p.length === 1 && p[0] === 0x41) {
    return Buffer.concat([
      Buffer.from([DEV.busVersion, DEV.identification & 0xff, DEV.identification >> 8, DEV.fwByte]),
      u32(DEV.serial),
    ]);
  }

  if (p[0] === CTY_SYS && p[1] === SUB_NONE) {
    const r = sysInfoReply(p[2]);
    if (r) return r;
  }

  // Channel settings: standard 0x02 + transformed 0x0B (S331 fw ≥ 1.54 uses 0x0B)
  if (p[0] === CTY_MEAS && p[1] === 0x02 && (p[2] === 0x02 || p[2] === 0x0b) && p.length >= 5) {
    return channelSettings(p[3], p[4]);
  }

  // Online values: [04 01 01 start count]
  if (p[0] === CTY_MEAS && p[1] === 0x01 && p[2] === 0x01 && p.length >= 5) {
    return onlineValues(p[3], p[4]);
  }

  // Logger status [03 01 act]
  if (p[0] === CTY_LOGGER && p[1] === SCTY_LOG) {
    const cur = SESSIONS[SESSIONS.length - 1];
    switch (p[2]) {
      case 0x01: return Buffer.from([1]); // logging enabled
      case 0x02: return u32(cur.samples); // recorded count
      case 0x03: return Buffer.concat([u32(cur.firstSample), u32(cur.firstSample + (cur.samples - 1) * LOG_INTERVAL)]);
      case 0x0c: return u32(LOG_INTERVAL); // package interval (seconds)
    }
  }

  // Logger file access [03 FF act ...]
  if (p[0] === CTY_LOGGER && p[1] === SUB_NONE) {
    if (p[2] === 0x04) return Buffer.from(ACCESS_CODE); // request access code
    if (p[2] === 0x12) return u32(fileCount());          // file number
    if (p[2] === 0x07 && p.length >= 8) return fileList(p[5]); // get file list
    if (p[2] === 0x0c) return Buffer.alloc(0);           // reading finished
  }

  // Device-related: screenshots [09 08 act ...]
  if (p[0] === CTY_DEVICE && p[1] === 0x08) {
    switch (p[2]) {
      case 0x0d: return u32(SCREENSHOTS.length); // image count
      case 0x0e: { // image info list: [idx u32][batch u32]
        const startIdx = p.readUInt32LE(3);
        const batch = p.readUInt32LE(7);
        const items = SCREENSHOTS.slice(startIdx, startIdx + batch);
        return Buffer.concat(items.map((s) => {
          const e = Buffer.alloc(59);
          e.writeUInt32LE(s.size, 0);
          putStr(e, 4, 55, s.name);
          return e;
        }));
      }
      case 0x0f: { // read image: [off u32][size u32][name 55]
        const nameRaw = p.subarray(11, 11 + 55);
        const hit = findScreenshot(nameRaw);
        if (!hit) return { error: COMM_INVALID_COMMAND_BYTE };
        const off = p.readUInt32LE(3);
        return hit.bytes.subarray(off); // single-shot read at offset 0
      }
      case 0x11: return Buffer.alloc(0); // close image file
    }
  }

  return { error: COMM_INVALID_COMMAND_BYTE };
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
// TCP server
// ---------------------------------------------------------------------------

function startServer(port, host, log = () => {}) {
  const server = net.createServer((socket) => {
    let rest = Buffer.alloc(0);
    log(`client connected ${socket.remoteAddress}`);

    socket.on('data', (chunk) => {
      rest = Buffer.concat([rest, chunk]);
      let frames;
      try {
        [frames, rest] = extractFrames(rest);
      } catch (e) {
        log(`frame error: ${e.message}`);
        socket.write(packPacket(DEV.addr, Buffer.from([COMM_CHECKSUM_ERROR_BYTE])));
        rest = Buffer.alloc(0);
        return;
      }
      for (const f of frames) {
        const expect = checksum(f.raw, f.raw.length - 2);
        if (f.raw[f.raw.length - 2] !== expect) {
          log(`checksum mismatch from client (got 0x${f.raw[f.raw.length - 2].toString(16)}, want 0x${expect.toString(16)})`);
          socket.write(packPacket(DEV.addr, Buffer.from([COMM_CHECKSUM_ERROR_BYTE])));
          continue;
        }
        const label = describe(f.payload);
        const result = handlePayload(f.payload);
        if (result && result.error !== undefined) {
          log(`← ${label}  → error status 0x${result.error.toString(16)}`);
          socket.write(packPacket(DEV.addr, Buffer.from([result.error])));
        } else {
          const reply = packFrames(DEV.addr, result || Buffer.alloc(0));
          log(`← ${label}  → ${reply.length} B`);
          socket.write(reply);
        }
      }
    });

    socket.on('error', (e) => log(`client error: ${e.message}`));
    socket.on('close', () => log(`client disconnected ${socket.remoteAddress}`));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      server.on('error', (e) => log(`server error: ${e.message}`));
      resolve(server);
    });
  });
}

function banner(server) {
  const addr = server.address();
  const portHint = Number(addr.port) === 502
    ? 'port 502 is already the app default — only change the IP.'
    : `enter port ${addr.port} in the app's port field (app default is 502).`;
  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │  SUTO S331 Simulator                                 │
  ├─────────────────────────────────────────────────────┤
  │  Device    : SUTO S331 (id 0x1065, fw ${DEV.fwString})            │
  │  Serial    : ${DEV.serial}                          │
  │  Channels  : Flow / Velocity / Consumption /        │
  │              Temperature / Pressure                 │
  │  Logger    : 2 sessions × 7 days @ ${LOG_INTERVAL}s          │
  │  Screens   : ${SCREENSHOTS.length} virtual BMP (${SCREENSHOTS[0].size} B each)        │
  ├─────────────────────────────────────────────────────┤
  │  Listening : ${addr.address}:${addr.port}                  │
  └─────────────────────────────────────────────────────┘

  In the app: Connect → Ethernet TCP → host 127.0.0.1 (or this machine's
  LAN IP for other computers); ${portHint}
  Then use Online View / Readout / Screenshots. Ctrl+C to stop.
`);
}

if (!SELFTEST) {
  const logFn = (msg) => {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}] ${msg}`);
  };
  startServer(PORT, HOST, logFn)
    .then(banner)
    .catch((e) => {
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        const script = fileURLToPath(import.meta.url);
        console.error(`
  ✗ Cannot bind port ${PORT}: ports below 1024 require root on Linux and
    older macOS (macOS 10.14+ and Windows allow it without privileges).

    To listen on ${PORT} — the app's default — run:

        sudo -E env "PATH=$PATH" ${process.execPath} ${script}

    (The app's Ethernet dialog then only needs the IP changed, e.g. 127.0.0.1.)

    Alternative — unprivileged port, entered manually in the app dialog:

        npm run sim:s331 -- --port 1502
`);
      } else if (e.code === 'EADDRINUSE') {
        console.error(`
  ✗ Port ${PORT} is already in use (another simulator or a real gateway?).
    Stop the other process, or pick another port:
        npm run sim:s331 -- --port 1502
`);
      } else {
        console.error(`
  ✗ Failed to listen on ${HOST}:${PORT} — ${e.message}
`);
      }
      process.exit(1);
    });
}

// ---------------------------------------------------------------------------
// Selftest — independent client that re-verifies framing/parsing the same way
// the Rust engine does (deframe_multi_frame + struct parsers).
// ---------------------------------------------------------------------------

export function deframe(raw) {
  if (raw.length < 5) throw new Error('too short');
  const firstLen = raw[1];
  if (raw.length === firstLen) {
    // single frame
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

  const server = await startServer(0, '127.0.0.1', () => {});
  const { port } = server.address();
  const sock = net.connect(port, '127.0.0.1');
  await new Promise((r) => sock.once('connect', r));
  let rxBuf = Buffer.alloc(0);
  const pending = [];
  sock.on('data', (c) => {
    rxBuf = Buffer.concat([rxBuf, c]);
    // Mirror of transport.rs is_response_complete: all full frames are 192
    // bytes and the final frame is strictly smaller.
    let off = 0;
    while (off + 2 <= rxBuf.length) {
      const len = rxBuf[off + 1];
      if (len < 4 || rxBuf.length < off + len) return; // incomplete — wait for more
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
    return deframe(raw); // throws on checksum/framing errors
  };

  console.log('\nS331 simulator selftest\n=======================');

  // 1. Discovery
  {
    const { payload, lastFrameLen } = await cmd(Buffer.from([0x41]), 0);
    const frameLen = lastFrameLen;
    ok('discovery: frame ≥ 11 bytes', frameLen >= 11, `got ${frameLen}`);
    ok('discovery: bus version', payload[0] === DEV.busVersion);
    ok('discovery: identification = 0x1065 (S331)', payload.readUInt16LE(1) === 0x1065, `got 0x${payload.readUInt16LE(1).toString(16)}`);
    ok('discovery: fw byte 1.80', payload[3] === 0xb4);
    ok('discovery: serial in frame', payload.readUInt32LE(4) === DEV.serial);
  }

  // 2. System info
  {
    const { payload } = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x03]));
    ok('serial = 12344321', payload.readUInt32LE(0) === 12344321, `got ${payload.readUInt32LE(0)}`);
    const id = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x07]));
    ok('device id = 0x1065', id.payload.readUInt16LE(0) === 0x1065);
    const fw = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x39]));
    ok('fw string "1.80"', fw.payload.toString().trim() === '1.80', `got "${fw.payload.toString().trim()}"`);
    const nm = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x51]));
    ok('device name "SUTO S331"', nm.payload.toString().trim() === 'SUTO S331');
  }

  // 3. Channels
  {
    const mc = await cmd(Buffer.from([CTY_SYS, SUB_NONE, 0x23]));
    ok('max channel count = 5', mc.payload[0] === 5, `got ${mc.payload[0]}`);
    for (const prefix of [0x02, 0x0b]) {
      const { payload, lastFrameLen } = await cmd(Buffer.from([CTY_MEAS, 0x02, prefix, 1, 5]));
      ok(`ch-settings(0x${prefix.toString(16)}): 5×204 bytes`, payload.length === 1020, `got ${payload.length}`);
      ok(`ch-settings(0x${prefix.toString(16)}): last frame < 192`, lastFrameLen < 192, `got ${lastFrameLen}`);
      const units = [14, 10, 24, 1, 38];
      const valid = [1, 2, 3, 4, 5].every((no, i) => {
        const s = payload.subarray(i * 204, (i + 1) * 204);
        return s[0] === no && s[86] === units[i];
      });
      ok(`ch-settings(0x${prefix.toString(16)}): channel numbers & unit indices`, valid);
    }
  }

  // 4. Online values
  {
    const { payload } = await cmd(Buffer.from([CTY_MEAS, 0x01, 0x01, 1, 5]));
    ok('online values: 5×7 bytes', payload.length === 35, `got ${payload.length}`);
    const allNormal = [0, 1, 2, 3, 4].every((i) => payload[i * 7 + 6] === 0);
    ok('online values: all status normal', allNormal);
    const flow = payload.readFloatLE(0);
    const cons = payload.readUInt32LE(2 * 7); // consumption is integer u32
    ok(`online values: flow plausible (${flow.toFixed(1)} m³/h)`, flow > 60 && flow < 200);
    ok(`online values: consumption integer (${cons} m³)`, Number.isInteger(cons) && cons > 0);
    const temp = payload.readFloatLE(3 * 7);
    const press = payload.readFloatLE(4 * 7);
    ok(`online values: temperature plausible (${temp.toFixed(1)} °C)`, temp > 15 && temp < 32);
    ok(`online values: pressure plausible (${press.toFixed(2)} bar)`, press > 5 && press < 8);
    // values change over time
    await new Promise((r) => setTimeout(r, 300));
    const again = await cmd(Buffer.from([CTY_MEAS, 0x01, 0x01, 1, 5]));
    ok('online values: change between polls', again.payload.readFloatLE(0) !== flow);
  }

  // 5. Logger status & files
  {
    const en = await cmd(Buffer.from([CTY_LOGGER, SCTY_LOG, 0x01]));
    ok('logging enabled', en.payload[0] === 1);
    const se = await cmd(Buffer.from([CTY_LOGGER, SCTY_LOG, 0x03]));
    const start = se.payload.readUInt32LE(0);
    const end = se.payload.readUInt32LE(4);
    ok('logger window spans ~7 days', end - start > 6.9 * DAY && end - start < 7.1 * DAY);
    const iv = await cmd(Buffer.from([CTY_LOGGER, SCTY_LOG, 0x0c]));
    ok('package interval 60 s', iv.payload.readUInt32LE(0) === 60);

    const ac = await cmd(Buffer.from([CTY_LOGGER, SUB_NONE, 0x04]));
    ok('access code 2 bytes', ac.payload.length === 2);
    const fc = await cmd(Buffer.from([CTY_LOGGER, SUB_NONE, 0x12]));
    ok('file count = 2', fc.payload.readUInt32LE(0) === 2, `got ${fc.payload.readUInt32LE(0)}`);

    const listCmd = Buffer.concat([
      Buffer.from([CTY_LOGGER, SUB_NONE, 0x07]),
      Buffer.from([0x43, 0x01, 0x00]), // len=323, control=0
      Buffer.from(ACCESS_CODE),
    ]);
    const fl = await cmd(listCmd);
    ok('file list: payload = 1 + 2×161', fl.payload.length === 323, `got ${fl.payload.length}`);
    ok('file list: reports 2 files', fl.payload[0] === 2);
    const e1 = fl.payload.subarray(1 + 161, 1 + 162 + 161);
    const name1 = e1.subarray(0, 12).toString().replace(/\0.*$/, '');
    ok(`file list: names LOG0000/LOG0001 (got ${name1})`, name1 === 'LOG0001');
    ok('file list: 10080 samples', e1.readUInt32LE(20) === 10080);
    ok('file list: 5 channels', e1[24] === 5);
    ok('file list: sample rate 60 s', e1.readUInt32LE(29) === 60);
    ok('file list: current session recording', (e1.readUInt32LE(25) & 1) === 1);
    const fin = await cmd(Buffer.concat([Buffer.from([CTY_LOGGER, SUB_NONE, 0x0c]), Buffer.from(ACCESS_CODE)]));
    ok('reading-finished ok', fin.payload.length === 0);
  }

  // 6. Screenshots
  {
    const cnt = await cmd(Buffer.from([CTY_DEVICE, 0x08, 0x0d]));
    ok('screenshot count = 3', cnt.payload.readUInt32LE(0) === 3);
    const info = await cmd(Buffer.concat([Buffer.from([CTY_DEVICE, 0x08, 0x0e]), u32(0), u32(3)]));
    ok('screenshot info: 3×59 bytes', info.payload.length === 177, `got ${info.payload.length}`);
    const size0 = info.payload.readUInt32LE(0);
    const name0 = info.payload.subarray(4, 59).toString().replace(/\0.*$/, '').trim();
    ok(`screenshot info: BMP size (${size0} B)`, size0 === 54 + IMG_W * IMG_H * 3);
    ok(`screenshot info: name has .png (got "${name0}")`, name0.endsWith('.png'));

    const readCmd = Buffer.alloc(3 + 4 + 4 + 55);
    readCmd[0] = CTY_DEVICE; readCmd[1] = 0x08; readCmd[2] = 0x0f;
    readCmd.writeUInt32LE(0, 3);
    readCmd.writeUInt32LE(size0, 7);
    putStr(readCmd, 11, 55, name0);
    const img = await cmd(readCmd);
    ok('screenshot read: exact size', img.payload.length === size0, `got ${img.payload.length}`);
    ok('screenshot read: BMP magic', img.payload[0] === 0x42 && img.payload[1] === 0x4d);
    ok('screenshot read: last frame < 192 (client completes fast)', img.lastFrameLen < 192, `got ${img.lastFrameLen}`);
    const close = await cmd(Buffer.from([CTY_DEVICE, 0x08, 0x11]));
    ok('img close ok', close.payload.length === 0);
  }

  // 7. Unknown command → '?'
  {
    const raw = await new Promise(async (resolve) => {
      pending.push(resolve);
      sock.write(packPacket(DEV.addr, Buffer.from([0x42])));
    });
    ok('unknown cmd → status 0x3F', raw[2] === COMM_INVALID_COMMAND_BYTE, `got 0x${raw[2].toString(16)}`);
  }

  sock.destroy();
  server.close();
  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

if (SELFTEST) runSelftest().catch((e) => {
  console.error('selftest crashed:', e);
  process.exitCode = 1;
});
