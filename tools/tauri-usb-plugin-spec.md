Tauri USB Direct-Driver Implementation Spec
For: AI agent implementing SUTO DS300/DS310 USB communication as a Tauri (Rust) plugin
This document is a complete, self-contained specification. Every numeric constant
below was verified against real hardware via an API hook on the working Java
reference implementation (2026-10-14). Do not guess or "improve" these values.

1. Hard constraints (non-negotiable)
The branded driver cscdc.sys / cscdc_x64.sys must stay untouched.
   No INF changes, no driver replacement (no WinUSB, no Zadig).
The device must keep its independent device-manager status.
   It lives under the custom class CSUsbDevices, NOT as a COM port.
   Therefore: no tauri-plugin-serialport, no Web Serial, no COM-port code paths.
   Those plugins talk to COM ports; this device is not one.
Windows only. The driver is Windows-only. The Tauri plugin must
   #[cfg(target_os = "windows")] the entire USB layer.
No JVM, no Java gateway in the final product. The Java code
   (CSLib/.../USBDS300.java, CSUSB310.java, CSCOMMExtend.java) is the
   reference for protocol behavior only.

2. Hardware / driver reference
Item
Value
Driver files
cscdc.sys / cscdc_x64.sys (Thesycon USBIO family)
Device class
CSUsbDevices
Class GUID (INF)
{9E187E64-AC2E-455D-8725-BF70DB8C8356}
Interface GUID (use this to enumerate)
{325ddf96-938c-11d3-9e34-0080c82727f4}
VID / PID (DS300)
0x16C0 / 0x0640
Bulk OUT endpoint
0x03
Bulk IN endpoint
0x81
Configuration index
0
Interfaces
2
Interface-setting bytes (×2)
00 00 00 00 00 00 01 00 / 01 00 00 00 00 00 01 00 — replicate verbatim, do not reinterpret (§3.2)
PID note: the INF lists PID 0x0646 (DFU 0x0645), but the enumerated
device on the reference PC reports PID 0x0640 — in both its device path
(usb#vid_16c0&pid_0640#…) and the GET_DESCRIPTOR reply. Match the
descriptor, not the INF.
Enumerate with SetupDiGetClassDevsW + SetupDiEnumDeviceInterfaces using the
interface GUID above (not the class GUID). Open with CreateFileW on the
device path, GENERIC_READ | GENERIC_WRITE,
FILE_SHARE_READ | FILE_SHARE_WRITE, OPEN_EXISTING.

3. Layer 1 — USB transport (replaces native/binding.cc)
3.1 IOCTL reference (all verified on hardware)
All use DeviceType 0x8094, METHOD_NEITHER. Values are complete
CTL_CODEs, pass them directly to DeviceIoControl.
Name
Code
Input
Output
Notes
INIT_DEVICE
0x8094206C
none
12 bytes (ignore contents)
Call once per handle, before anything else
GET_DESCRIPTOR
0x80942006
8 bytes: 00 00 00 00 01 00 00 00
18-byte USB device descriptor
Bytes 8-9 = VID (LE), 10-11 = PID (LE). Must start 12 01.
SET_CONFIGURATION
0x80942024
260-byte struct (§3.2)
none
Best-effort: the Java app ignores failure. Do the same.
GET_CONFIG_INFO
0x80942050
none
776 bytes
Read-only; the working implementation (src/usbio.js) issues it after set_configuration — do the same
BIND_PIPE
0x80942078
1 byte = endpoint address
none
0x03 (OUT) / 0x81 (IN) — API-hook confirmed; USBDS300.java's 0x01/0x82 are outdated
Historical note: an earlier reverse-engineering pass guessed 0x809420C8
as the init/acquire IOCTL. The API hook proved the Java app never calls it.
Use 0x8094206C. Do not use 0x809420C8.
3.2 SET_CONFIGURATION struct (260 bytes, little-endian, packed)
⚠️ Do NOT reconstruct this from a {u16, u16, u32} struct guess — the
captured byte pattern does not match that layout (the native
USBIO_IFACE_SETTING layout differs; see the NOTE in
native/usbio_ioctl.h). Replicate the captured bytes verbatim:
// Exact 260-byte SET_CONFIGURATION blob (API-hook capture, 2026-10-14).
// cfg_index = 0, nb_of_interfaces = 2, USBIO_MAX_INTERFACES = 32 entries.
static SET_CONFIGURATION_260: [u8; 260] = {
    let mut b = [0u8; 260];
    b[0] = 0x00; b[1] = 0x00;              // CfgIndex = 0
    b[2] = 0x02; b[3] = 0x00;              // NbOfInterfaces = 2
    // If0: interface 0, alt 0, observed tail 00 00 01 00
    b[4] = 0x00; b[5] = 0x00; b[6] = 0x00; b[7] = 0x00;
    b[8] = 0x00; b[9] = 0x00; b[10] = 0x01; b[11] = 0x00;
    // If1: interface 1, alt 0, observed tail 00 00 01 00
    b[12] = 0x01; b[13] = 0x00; b[14] = 0x00; b[15] = 0x00;
    b[16] = 0x00; b[17] = 0x00; b[18] = 0x01; b[19] = 0x00;
    // [20..260] already zero
    b
};
3.3 Handle flow (this is the critical part — get it exactly right)
There are three handles, not one:
main handle:  CreateFile(device_path)
              → DeviceIoControl(0x8094206C)            // init
              → DeviceIoControl(0x80942006, 8-byte req) // get descriptor (verify VID)
              → DeviceIoControl(0x80942024, 260-byte)   // set config (ignore failure)
              → DeviceIoControl(0x80942050)            // get config info, 776 bytes out (read-only)

OUT pipe:     CreateFile(device_path)   // SEPARATE handle, same path
              → DeviceIoControl(0x8094206C)            // init again on this handle
              → DeviceIoControl(0x80942078, [0x03])    // bind endpoint 0x03 (OUT)

IN pipe:      CreateFile(device_path)   // SEPARATE handle, same path
              → DeviceIoControl(0x8094206C)            // init again on this handle
              → DeviceIoControl(0x80942078, [0x81])    // bind endpoint 0x81 (IN)
Data transfer uses plain ReadFile / WriteFile on the pipe handles
(not IOCTLs). Use overlapped I/O with timeouts:
Write timeout: 100 ms (matches USBDS300.java)
Read timeout: 1000 ms for simple commands, 3000 ms for multi-frame
  protocol commands (matches CSUSB310.RESPONSE_TIME_OUT).
Teardown: CloseHandle on all three handles. (No explicit unbind IOCTL was
observed; the Java app's unbind() maps to handle close.)
3.4 Rust implementation notes
Use the windows crate (windows::Win32::Foundation,
  windows::Win32::Storage::FileSystem, windows::Win32::System::IO).
DeviceIoControl signature: pass the raw codes above as u32.
For METHOD_NEITHER, input/output buffers are plain pointers — no special
  handling needed beyond correct sizes.
Device paths from SetupAPI are wide strings (\\?\usb#vid_...);
  use the U16CString / wide-string APIs.
Wrap the three handles in a struct with a Mutex (Tauri commands are
  async; serialize device access — the device is half-duplex in practice).
Timeouts: use overlapped ReadFile/WriteFile + WaitForSingleObject
CancelIo on timeout, exactly like the C++ reference in
  native/binding.cc (WritePipe/ReadPipe).

4. Layer 2 — CS-Bus packet framing (src/csbus.js → port to Rust)
Every command sent on the OUT pipe is wrapped:
packet[0] = address            // device address byte
packet[1] = total_length       // header + data + tail
packet[2..2+n] = command bytes
packet[len-2] = checksum       // two's complement: ((sum ^ 0xFF) + 1) & 0xFF
                               //   over bytes [0 .. len-3]
packet[len-1] = 0x00
COMM_HEADER_LENGTH = 2, COMM_TAIL_LENGTH = 2.
Simple (single-frame) replies: read until acc.len() >= 2 && acc.len() >= acc[1],
  then verify checksum the same way. (parsePacket in csbus.js.)
Address 0 is the broadcast/discovery address (see §5.1).

5. Layer 3 — DS310 "new protocol" (port of usb-server/server.js)
Java reference: CSLib/src/com/cs/cscomm310/ —
Commands.java, CSCOMMExtend.java, CSUSB310.java,
CSCOMM_DS310_CHANNEL_SETTING.java, CSCOMM_MEASUREMENT_VALUE.java,
CommConstDS310.java. The JS in usb-server/server.js is a faithful,
tested port; use it as the primary reference (it is more compact than the
Java).
5.1 Discovery
Send ASCII "A" framed with address 0 (broadcast).
The reply's byte 0 is the device's real address (observed: 1).
All subsequent commands use that address.
   (Java: Device.address defaults to "0"; CSUSB310 auto-discovers via
   d.setAddress(response[0]).)
5.2 Commands (bytes are literal)
Command
Bytes
Reply payload
GetChCount
[0x04, 0x02, 0x03]
4 bytes; payload[0] = channel count
GetChSetting
[0x04, 0x02, 0x02, start, count]
count × 204-byte channel structs
GetOnlineVal
[0x04, 0x01, 0x01, start, count]
count × 7-byte value structs
start is 1-based. If GetChCount fails, fall back to count = 100
(Java refreshChannelInformation behavior).
5.3 Multi-frame reply transport (critical)
The device answers in 192-byte frames:
frame = [addr][len][data...][checksum][0x00]
len (byte 1) = total frame length including addr/len/checksum/0x00.
Data capacity per full frame: 188 bytes.
Frame 0 layout: [addr][len][0x3E ('>')][payload...][checksum][0x00]
  — the 0x3E is a status byte, not payload. Any other value means a
  device error; abort with the status code.
Continuation frames: [addr][len][payload...][checksum][0x00] (no status).
Checksum: two's complement over frame[0 .. len-3], compared to
  frame[len-2].
Frame count: n = ceil((payload_bytes + 1) / 188), except payloads ≤ 250
  always use 1 frame. (Java calculateTotalNeedReceiveBytes.)
Total raw bytes to read: payload_bytes + n * 4 + 1
  (each frame adds addr+len / checksum+0x00 = 4 bytes overhead, plus the one
  > status byte).
Deframe: strip per-frame headers/trailers and the status byte, verify each
  checksum, concatenate. Reject if compacted length ≠ expected payload bytes.
Read loop (Java readSync(totalNeedReceiveBytes)): accumulate ReadFile
chunks until totalBytes arrive or deadline passes.
Deadline = ceil(totalBytes / 200) ms + 3000 ms
(SPEED_USB = 200 bytes/ms, RESPONSE_TIME_OUT = 3000).
5.4 Channel struct parsing (204 bytes, little-endian)
Port of CSCOMM_DS310_CHANNEL_SETTING.parseByteArray + the filtering in
CSCOMMExtend.refreshChannelInformation:
s[0] = logical channel number. 0 or 0xFF → invalid, skip.
s[115] = slave type, s[118] = measure type.
Drop if slave_type == 3 && measure_type == 119 (MEASURE_TYPE_NA).
Drop the bus-sensor + ext-analogue NA combination (see server.js
    parseChannelSetting for the exact int32 arithmetic).
s[85] = resolution (u8)
s[86] = unit index (u8); s[87..99] = unit ASCII (C string)
Unit string = UNITS[unit_index] unless index is 0 (custom), then use
    the ASCII field. The 154-entry table is CommConst.UNIT_STRING,
    reproduced verbatim in server.js (UNITS array, ° = \u00B0,
    ³ = \u00B3).
Text fields (Latin-1, strip at first 0x00, trim):
s[1..22] device description, s[22..43] sub-device description,
    s[43..64] sensor description, s[64..85] channel description.
s[99..103] device_id (i32), s[103..107] subdevice_id (i32),
  s[107..111] sensor_id (i32), s[111..115] channel_id_in_device (i32),
  s[138] mb_output_value_type (u8).
Positional mapping (important): value struct i belongs to channel slot
i, even if that slot parsed as invalid. Keep the slots array positional;
filter only when presenting. (This matches Java's
retrieveAllMeasurementValues.)
5.5 Measurement value parsing (7 bytes, little-endian)
Port of CSCOMM_MEASUREMENT_VALUE.parseByteArray(packet, mbOutputValueType):
Value decoding depends on the channel's mb_output_value_type:
4 → i32, 6 → u32, otherwise → f32 (bytes 0-3).
v[4] = resolution (u8), v[5] = unit index (u8), v[6] = status (u8).
Status bits: 0x04 = invalid → value is null; 0x08 = overrange.
If mb type is not 4/6/8 → treat as invalid
  (Java DATA_OUTPUT_VALUE_TYPE_INVALID).
5.6 Standard flows
Channel enumeration (refreshChannelInformation):
GetChCount → N
GetChSetting(1, N) → N × 204-byte structs → parse → positional slots
Live values (retrieveAllMeasurementValues):
GetOnlineVal(1, N) → N × 7-byte structs → parse each with its slot's
mb_output_value_type → positional mapping to channel_ids

6. Layer 4 — Tauri plugin shape
Suggested plugin: tauri-plugin-suto-usb (name it as you like).
State
struct UsbState {
    inner: Mutex<UsbDevice>,  // the three handles + dev_addr + channel slots
}
Register with .manage(UsbState { ... }). All commands take
State<'_, UsbState>.
Commands (suggested Tauri #[tauri::command]s)
Command
Args
Returns
Notes
usb_list_devices
—
Vec<String> (device paths)
SetupAPI enumeration
usb_open
path: Option<String>
DeviceInfo { vid, pid }
openDevice + descriptor + set_config + discover address
usb_close
—
()
close all handles
usb_get_channels
—
Vec<Channel>
GetChCount + GetChSetting, cached 30 s
usb_get_values
ids: Option<Vec<u8>>
Vec<LiveValue>
GetOnlineVal; empty ids = all valid channels
usb_send_raw
addr: u8, cmd: Vec<u8>
Vec<u8> (deframed payload)
escape hatch for future commands
Channel mirrors the JS channel object (§5.4 fields the UI needs:
channel_id, descriptions, unit_in_ascii, resolution).
LiveValue = { channel_id, value: Option<f64>, unit, status, resolution }.
Frontend
The existing s4a-web/src/api/UsbAPI.js talks HTTP. For Tauri, add
src/api/TauriUsbAPI.js implementing the same interface
(getChannels, getMeasurementData, refreshChannelValues, …) but calling
invoke('usb_get_channels') etc. instead of fetch. Then
VITE_USE_TAURI_USB=true selects it in TestAPI.js, exactly like the
existing VITE_USE_USB switch. History buffering for charts can live in the
Rust plugin (a VecDeque per channel, same 3600-point cap as the JS server)
or stay in the frontend — your choice, but keep the getMeasurementData
response shape identical:
`[{ channel_id, measurementData: [[v…]], realStartTime: [t],
    pointInterval: [ms], min, max }]`.
Build notes
tauri.conf.json: tauri.bundle.windows — this is Windows-only; no need
  for macOS/Linux bundles of the USB path (gate the plugin #[cfg(windows)]
  and return a clean "unsupported platform" error elsewhere).
No extra link dependencies beyond the windows crate and setupapi.lib
  (add #[link(name = "setupapi")] or use windows crate's generated
  bindings which handle it).
Async: do USB I/O on a blocking thread pool (tokio::task::spawn_blocking)
  — the driver calls are synchronous with timeouts.

7. Verification checklist (do all of these)
cargo build clean, no warnings in the USB module.
Unit tests (no hardware): packet checksum round-trip, numFramesFor /
   totalBytesFor against the table in server.test.js, deframe of a
   synthetic 2-frame reply, channel-struct parse of the captured fixture
   bytes in the side-chat log (S 403 / Flow / m3/h at the documented
   offsets), 7-byte value parse for mb types 4/6/8 + invalid/overrange bits.
Hardware smoke test (on the Windows PC with the device):
usb_list_devices → exactly one path containing vid_16c0&pid_0640.
usb_open → VID 0x16C0, discovery returns address 1.
usb_get_channels → N channels, descriptions readable
     (expect S 403, Flow, unit m3/h on this unit).
usb_get_values → N×7-byte payload replies (e.g. 19 wire bytes for a 2-channel poll = 14 + 4 + 1), finite f32 values.
Unplug/replug → usb_open recovers without process restart.
Confirm the Java cs_monitor app still works afterward (driver state
   must be left clean — we only do what the Java app does).

8. Reference files (in the workspace)
File
What it is
~/workspace/suto_swing_node/native/binding.cc
C++ N-API reference for the exact DeviceIoControl sequences
~/workspace/suto_swing_node/native/usbio_ioctl.h
IOCTL codes + 260-byte struct definition
~/workspace/suto_swing_node/src/csbus.js
packPacket / parsePacket / checksum
~/workspace/suto_swing_node/src/usbio.js
Handle management flow (UsbCsBus)
~/workspace/suto_swing_node/usb-server/server.js
Primary protocol reference — tested JS port of the DS310 new protocol
~/workspace/suto_swing_node/usb-server/server.test.js
Unit-test vectors (frame math, deframe, parsing)
~/workspace/suto_swing_series/CSLib/src/com/cs/cscomm310/
Java reference (Commands, CSCOMMExtend, CSUSB310, channel/value structs)
~/workspace/suto_swing_series/CSLib/src/com/cs/cscomm/USBDS300.java
Legacy framing reference, endpoint constants
9. Out of scope
DFU mode (PID_0645), firmware updates.
The legacy single-char C/D protocol (dead on current UI hardware).
javax.comm → jSerialComm migration (separate track).
Pushing anything to GitHub (ask the user first).