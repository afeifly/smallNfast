# S4A Online — DS300 Web Monitor

React frontend + Node.js backend talking directly to `cscdc.sys` (no Java, no COM port, no driver change).

## Layout

```
s4a_online/
├── server/           # Express backend (port 3001)
│   ├── server.js
│   ├── package.json
│   └── usb/          # N-API addon source (builds to usb/build/Release/usbio.node)
│       ├── src/      # usbio.js, csbus.js, cli.js
│       ├── native/   # binding.cc, usbio_ioctl.h
│       ├── binding.gyp
│       └── package.json
└── client/           # React frontend (Vite, port 5173)
    ├── src/
    ├── index.html
    └── package.json
```

## First-time setup (Windows)

Requires: Node.js 20+, Python 3, Visual Studio Build Tools (Desktop C++).

```powershell
# 1. Build the USB addon
cd s4a_online\server\usb
npm install

# 2. Install server deps
cd ..\..
cd server
npm install

# 3. Install client deps
cd ..\client
npm install
```

## Run

Terminal 1:
```powershell
cd s4a_online\server
node server.js
```

Terminal 2:
```powershell
cd s4a_online\client
npm run dev
```

Open http://localhost:5173 → click **Detect Devices**.

## Protocol notes

- Transport: `CreateFile` + `DeviceIoControl` on `cscdc.sys` via N-API (`usbio.node`).
  IOCTLs (from API hook on working Java app): `0x8094206C` init, `0x80942006`
  descriptor, `0x80942024` set-config (260 B), `0x80942050` config-info,
  `0x80942078` bind-pipe. Pipes: OUT `0x03`, IN `0x81`.
- CS-Bus framing: `[addr][len][data...][checksum][0x00]`, checksum = two's complement.
- Discovery: `'A'` at addr 0 (broadcast) → `resp[0]` = device address (1).
- App protocol is the **new** `CSCOMMExtend` protocol (S4ABase), not legacy `CSComm`:
  - `GetMaxCh` = `[01 FF 23]`
  - `GetChSetting` = `[04 02 02 startCh count]` → 204-byte `CSCOMM_DS310_CHANNEL_SETTING` structs
  - `GetOnlineVal` = `[04 01 01 startCh count]` → 7-byte value structs (float32 LE, res, unit, status)
- Legacy single-char `C`/`D` and `XC 04` get no reply on this firmware; `A` still works for discovery.
