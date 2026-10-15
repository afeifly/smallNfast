#!/usr/bin/env node
/**
 * CLI test tool for the CS-Bus Node.js library.
 *
 *   node src/cli.js list
 *     -> list available serial ports
 *
 *   node src/cli.js info --port COM5 --addr 1
 *     -> open the port, send "A" (retrieve device information), print raw reply
 *
 *   node src/cli.js raw --port COM5 --addr 1 --cmd "A"
 *     -> send an arbitrary ASCII command, print raw reply bytes
 */
const { CSBus } = require('./csbus');

function args() {
  const out = {};
  const raw = process.argv.slice(3);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) out[raw[i].slice(2)] = raw[i + 1];
  }
  return out;
}

function hex(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'list') {
    const ports = await CSBus.listPorts();
    if (!ports.length) {
      console.log('No serial ports found.');
      return;
    }
    for (const p of ports) console.log(`${p.path}\t${p.manufacturer}\t${p.description}`);
    return;
  }

  if (cmd === 'usbio-list') {
    // Direct driver path: enumerate USBIO devices (no Node build needed for list? -- yes it does)
    const { UsbCsBus } = require('./usbio');
    const devs = UsbCsBus.listDevices();
    if (!devs.length) {
      console.log('No USBIO devices found. Is cscdc.sys installed?');
      return;
    }
    for (const d of devs) console.log(d);
    return;
  }

  if (cmd === 'usbio-info' || cmd === 'usbio-raw') {
    // Direct driver path via N-API addon (Windows only)
    const { UsbCsBus } = require('./usbio');
    const { addr = '1', cmd: cmdStr = 'A' } = args();
    const address = parseInt(addr, 10);
    const bus = new UsbCsBus();
    try {
      const desc = await bus.open();
      console.log(`Device open: VID=0x${desc.idVendor.toString(16)} PID=0x${desc.idProduct.toString(16)}`);
      const payload =
        cmd === 'usbio-info'
          ? await bus.getDeviceInformation(address)
          : await bus.sendCommand(address, Buffer.from(cmdStr, 'ascii'));
      console.log('Reply payload bytes:', hex(payload));
      console.log('Reply as ASCII     :', payload.toString('ascii').replace(/[^\x20-\x7e]/g, '.'));
    } catch (err) {
      console.error('FAILED:', err.message);
      process.exit(1);
    } finally {
      await bus.close();
    }
    return;
  }

  if (cmd === 'info' || cmd === 'raw') {
    const { port, addr = '1', cmd: cmdStr = 'A' } = args();
    if (!port) {
      console.error('Missing --port. Example: node src/cli.js info --port COM5 --addr 1');
      process.exit(1);
    }
    const address = parseInt(addr, 10);
    const bus = new CSBus();
    try {
      await bus.open(port);
      console.log(`Port ${port} open @19200 8N1`);
      const payload =
        cmd === 'info'
          ? await bus.getDeviceInformation(address)
          : await bus.sendCommand(address, Buffer.from(cmdStr, 'ascii'));
      console.log('Reply payload bytes:', hex(payload));
      console.log('Reply as ASCII     :', payload.toString('ascii').replace(/[^\x20-\x7e]/g, '.'));
    } catch (err) {
      console.error('FAILED:', err.message, err.code ? `(${err.code})` : '');
      process.exit(1);
    } finally {
      await bus.close();
    }
    return;
  }

  console.log('Usage:');
  console.log('  --- serial-port transport (COM mode) ---');
  console.log('  node src/cli.js list');
  console.log('  node src/cli.js info --port COM5 --addr 1');
  console.log('  node src/cli.js raw  --port COM5 --addr 1 --cmd "A"');
  console.log('  --- direct-driver transport (cscdc.sys, Windows only) ---');
  console.log('  node src/cli.js usbio-list');
  console.log('  node src/cli.js usbio-info --addr 1');
  console.log('  node src/cli.js usbio-raw  --addr 1 --cmd "A"');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
