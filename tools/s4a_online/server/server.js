/**
 * suto_swing_web — working version.
 * Uses new-protocol commands with 7-byte value structs.
 */
const express = require('express');
const cors = require('cors');
const { UsbCsBus } = require('./usb/src/usbio');
const { packPacket } = require('./usb/src/csbus');

const PORT = 3001;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const app = express();
app.use(cors());
app.use(express.json());

let bus = null, devAddr = 1;
let channels = [];

const UNITS = {0:'°C',1:'°F',2:'K',3:'%rH',13:'m³/h',14:'m³/min',15:'l/min',30:'%',31:'ppm'};

async function ensureOpen() {
  if (bus && bus.isOpen) return bus;
  bus = new UsbCsBus();
  await bus.open();
  await new Promise(r => setTimeout(r, 200));
  return bus;
}

function writeRead(pkt, timeout = 4000) {
  return new Promise((resolve) => {
    bus.native.writePipe(bus.pipeOut, pkt, 100);
    let acc = Buffer.alloc(0);
    let idle = 0;
    const dl = Date.now() + timeout;
    const tick = () => {
      if (Date.now() >= dl || idle >= 10) return resolve(acc);
      const c = bus.native.readPipe(bus.pipeIn, 8192, 300);
      if (c.length) { acc = Buffer.concat([acc, c]); idle = 0; }
      else idle++;
      setImmediate(tick);
    };
    tick();
  });
}

// Parse 7-byte value struct: float32 LE, u8 res, u8 unit, u8 status
function parseValue(buf, off) {
  const value = buf.readFloatLE(off);
  const resolution = buf[off + 4];
  const unitIndex = buf[off + 5];
  const status = buf[off + 6];
  return {
    value, resolution, unitIndex,
    unit: UNITS[unitIndex] || `u${unitIndex}`,
    status: (status & 0x04) ? 'invalid' : (status & 0x08) ? 'overrange' : 'normal',
  };
}

app.post('/api/detect', async (req, res) => {
  log('=== DETECT ===');
  try {
    await ensureOpen();
    // Discovery
    let pkt = packPacket(0, Buffer.from('A', 'ascii'));
    let acc = await writeRead(pkt, 3000);
    if (acc.length < 3 || acc[2] !== 0x3E) throw new Error('A failed');
    devAddr = acc[0];
    log(`devAddr=${devAddr}`);
    await new Promise(r => setTimeout(r, 200));

    // Get channel settings to find valid channel IDs
    // Try start=1, count=8; parse for valid LogicalChannelNo
    pkt = packPacket(devAddr, Buffer.from([0x04, 0x02, 0x02, 0x01, 0x08]));
    acc = await writeRead(pkt, 5000);
    log(`GetChSetting: ${acc.length}b`);
    
    // Simple: scan raw bytes for 204-byte struct pattern
    // LogicalChannelNo at struct start, followed by "S 403" or similar
    const ids = new Set();
    // Look for the pattern in the raw acc (not deframed, to avoid alignment issues)
    // Channel structs contain "S 403" (device desc). Find those, backtrack 21+1 bytes to LogicalChannelNo.
    const marker = Buffer.from('S 403');
    let idx = 0;
    while ((idx = acc.indexOf(marker, idx)) !== -1) {
      // LogicalChannelNo is 22 bytes before the marker (1 byte LC + 21 bytes devDesc, marker at start of devDesc)
      // Actually: struct[0]=LC, struct[1..21]=devDesc. Marker "S 403" at struct[1].
      const lcOff = idx - 1;
      if (lcOff >= 0) {
        const lc = acc[lcOff];
        if (lc >= 1 && lc <= 32) ids.add(lc);
      }
      idx += marker.length;
    }
    log(`found channel IDs: ${[...ids].join(', ')}`);
    
    // If no IDs found, fallback to 1..4
    const idList = ids.size ? [...ids].sort((a,b) => a-b) : [1,2,3,4];
    
    // Get one value reading to confirm and get units
    const start = Math.min(...idList);
    const count = idList.length;
    pkt = packPacket(devAddr, Buffer.from([0x04, 0x01, 0x01, start, count]));
    acc = await writeRead(pkt, 5000);
    log(`GetOnlineVal: ${acc.length}b`);
    
    channels = [];
    if (acc.length >= 3 && acc[2] === 0x3E) {
      // Data starts at offset 3, 7 bytes per channel
      const dataLen = acc[1] - 5; // len - header(3) - tail(2)
      const nVals = Math.floor(dataLen / 7);
      for (let i = 0; i < nVals && i < idList.length; i++) {
        const v = parseValue(acc, 3 + i * 7);
        channels.push({
          id: idList[i],
          description: `CH${idList[i]}`,
          unit: v.unit,
          unitIndex: v.unitIndex,
          resolution: v.resolution,
          value: v.status === 'normal' ? v.value : null,
          status: v.status,
        });
      }
    }
    log(`channels: ${channels.map(c => `${c.id}=${c.value}${c.unit}`).join(', ')}`);
    res.json({ ok: true, devAddr, channels });
  } catch (e) {
    log('DETECT failed:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/values', async (req, res) => {
  try {
    if (!channels.length) throw new Error('no channels');
    await ensureOpen();
    const ids = channels.map(c => c.id).sort((a,b) => a-b);
    const start = ids[0];
    const count = ids.length;
    const pkt = packPacket(devAddr, Buffer.from([0x04, 0x01, 0x01, start, count]));
    const acc = await writeRead(pkt, 4000);
    const values = [];
    if (acc.length >= 3 && acc[2] === 0x3E) {
      const nVals = Math.floor((acc[1] - 5) / 7);
      for (let i = 0; i < nVals && i < ids.length; i++) {
        const v = parseValue(acc, 3 + i * 7);
        values.push({
          id: ids[i],
          value: v.status === 'invalid' ? null : v.value,
          status: v.status,
          unit: v.unit,
        });
      }
    }
    res.json({ ok: true, values });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ ok: true, busOpen: !!(bus && bus.isOpen), devAddr, channels: channels.length });
});

app.listen(PORT, () => log(`API on http://localhost:${PORT}`));
