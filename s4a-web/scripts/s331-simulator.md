# SUTO S331 Device Simulator

A zero-dependency Node.js TCP server that emulates a **SUTO S331 display / data-logger** speaking the SUTO CS-Bus protocol over Ethernet — so the s4a-web desktop app (Tauri) can be exercised end-to-end without real hardware: discovery, system info, online values, logger file list, and screenshot download.

> **中文速览**
> 启动：`npm run sim:s331`（默认 502 端口；macOS 10.14+ 直接可用，Linux 需 `sudo -E env "PATH=$PATH" node scripts/s331-simulator.mjs`，Windows 直接可用；也可 `-- --port 1502` 换非特权端口）。
> App 内：连接 → Ethernet TCP → 主机 `127.0.0.1`（跨电脑用本机局域网 IP）→ 端口默认 502 不用改 → 连接后可用 Online Values / Readout / Screenshots。
> 自检：`npm run sim:s331:test`（45 项）；Rust 引擎端到端：`cd src-tauri && cargo test --test s331_simulator`。

---

## 1. Simulated device

| Property | Value |
|---|---|
| Model | SUTO S331 |
| Identification (discovery) | `0x1065` → app maps it to "SUTO S331", `ds310` logger type |
| Firmware | 1.80 (`0xB4`; ≥ 1.54 ⇒ app uses the transformed `0x0B` channel-settings command) |
| Bus address | 1 |
| **Serial number** | **12344321** |
| Channels | 5 (see §3) |
| Logger sessions | 2 × 7 days @ 60 s (see §4) |
| Screenshots | 3 virtual BMPs (see §5) |

## 2. Run it

```bash
npm run sim:s331                          # default port 502 (the app's default)
npm run sim:s331 -- --port 1502           # unprivileged port
node scripts/s331-simulator.mjs --host 0.0.0.0 --port 502
npm run sim:s331:test                     # 45-check protocol selftest
```

| Option | Env | Default | Meaning |
|---|---|---|---|
| `--port` | `S331_PORT` | `502` | TCP listen port |
| `--host` | — | `0.0.0.0` | Listen address (`0.0.0.0` accepts LAN connections) |
| `--selftest` | — | — | Run the built-in client verification and exit |

**About port 502.** The app's Ethernet dialog defaults to `192.168.1.100:502`. Port 502 matches that default (you only change the IP). Platform rules for ports < 1024:

- **macOS 10.14+** — no restriction, plain `npm run sim:s331` listens on 502.
- **Linux** — needs root. The simulator prints the exact command when it hits `EACCES`:

  ```bash
  sudo -E env "PATH=$PATH" node /path/to/scripts/s331-simulator.mjs
  ```

  (`-E env PATH=…` keeps your nvm/homebrew node visible to root.)
- **Windows** — no restriction.

**Connecting from the app:** Connect dialog → *Ethernet TCP* tab → host `127.0.0.1` (same machine) or the simulator machine's LAN IP (other computers; they must reach that IP and port) → port as above → *Connect via Ethernet TCP*. Every request the simulator answers is logged to its console, e.g. `[14:24:46] ← discovery → 13 B`.

## 3. Channels & online values

Online View polls `[04 01 01 start count]`; values are deterministic sine + noise functions of the wall clock, so they move between polls.

| # | Description | Unit | Resolution | Sensor | Signal |
|---|---|---|---|---|---|
| 1 | Flow | m³/h | 1 | SUTO SFAB | 118 ± 42, ~5 min cycle + noise |
| 2 | Velocity | m/s | 2 | SUTO SFAB | 4.1 ± 1.2, phase-shifted |
| 3 | Consumption | m³ | 0 — **integer** | SUTO SFAB | monotonic counter (~0.033 m³/s) |
| 4 | Temperature | °C | 1 | SUTO ST550 | 23.5 ± 2.8, slow (~30 min) |
| 5 | Pressure | bar | 2 | SUTO SP560 | 6.75 ± 0.5, ~10 min |

Consumption uses a consumption-unit index (24) so the app parses it as `u32`, exactly like a real counter channel. Channels 1–3 share `sensor_id` 1 (one physical flow sensor), temperature and pressure have their own — the app groups channels into sensors by that key.

## 4. Logger sessions (fixed periods)

Anchored to simulator start time (`now`):

| File | Period | Samples | Rate | Channels | Status |
|---|---|---|---|---|---|
| LOG0000 | now−14d → now−7d | 10080 | 60 s | 5 | closed |
| LOG0001 | now−7d → now | 10080 | 60 s | 5 | recording (bit 0 set) |

S331 resolves to the app's `ds310` readout path: the file list above comes from the device, and the CSV is generated client-side from the entry's period / sample count plus the channel table from §3. So what you select in *Readout → Logger data* is exactly what this table says. The logger-status commands report the LOG0001 window (enabled, ~7-day span, 60 s package interval).

## 5. Virtual screenshots

Three generated 24-bit BMPs, 240×160 px (115,254 B each): dark background, grid, one colored trace per channel, distinct phase per image. Names embed a timestamp the app can parse for its "taken X ago" column: `2026-10-24_10-30-00.png` (2 days, 1 day, 2 hours before boot). Count / info / read / close commands are all implemented; downloads carry the `.png` name and `image/bmp` magic the app detects.

## 6. Supported protocol commands

Framing is CS-Bus: `[addr][len][payload…][cksum][0x00]`, two's-complement checksum; multi-frame replies use 192-byte frames (first frame carries the `>` status byte, the last frame is always < 192 bytes so the client's `is_response_complete` fires immediately).

| Command payload | Serves |
|---|---|
| `41` ('A') | Discovery → bus id, identification `0x1065`, fw byte, serial |
| `01 FF 03 / 07 / 09 / 0B / 39 / 51` | Serial number, device id, HW version, calibration date, firmware, device name |
| `01 FF 23` | Max channel count (5) |
| `04 02 02\|0B start cnt` | Channel settings — `cnt` × 204-byte DS310 structs (standard **and** transformed prefix) |
| `04 01 01 start cnt` | Online values — `cnt` × 7-byte structs |
| `03 01 01 / 02 / 03 / 0C` | Logger status: enabled, recorded count, start/end time, package interval |
| `03 FF 04` | Logger access code |
| `03 FF 12` | Logger file count |
| `03 FF 07 lenLo lenHi ctrl ac0 ac1` | Logger file list — `[n] + n × 161-byte entries` |
| `03 FF 0C …` | Logger reading finished |
| `09 08 0D` | Screenshot count |
| `09 08 0E idx cnt` | Screenshot info — `cnt` × 59-byte entries (`[u32 size][55B name]`) |
| `09 08 0F off size name55` | Read screenshot bytes (BMP) |
| `09 08 11` | Close screenshot file |
| anything else | Error status `0x3F` ('?'), like a real device |

Checksum errors in requests are answered with status `0x01`.

## 7. Tests

```bash
npm run sim:s331:test                    # JS: 45 protocol checks via a real TCP client
cd src-tauri && cargo test --test s331_simulator
```

The Rust test spawns the simulator, then drives it through the **production engine** — the same `TcpTransport::write_and_read`, `pack_packet`, `deframe_multi_frame`, `parse_channel_settings`, `parse_measurement_values` code the Tauri commands use — asserting discovery, channel table, values (incl. integer consumption), file list fields, and BMP download. Run it after any change to either side.

## 8. Tweaking the simulation

All knobs are at the top of `scripts/s331-simulator.mjs`:

- **Identity**: `DEV` (serial, identification, firmware, name, calibration date)
- **Channels**: `CHANNELS` array (add a 6th channel — raise the `0x23` reply and `CHANNELS.length`-driven file entries follow automatically); signal functions in `channelValue()`
- **Sessions**: `buildSessions()` (count, span, interval, names)
- **Screenshots**: `SCREENSHOTS` list and `makeBmp()` painter

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `EACCES` on start | Linux / old macOS: low ports need root — run the printed sudo command, or `--port 1502` and enter 1502 in the app |
| `EADDRINUSE` | Another process owns the port (real Modbus gateway? previous simulator?) — stop it or change port |
| App can't connect | Simulator banner shows the actual `address:port`; from another computer use the LAN IP, check the firewall allows inbound TCP on that port |
| Connects but no channels/values | Watch the simulator console — every command it answers is logged; if nothing appears, the app is talking to something else |
| Screenshot preview empty | Sizes/names come from `09 08 0E`; the download uses the name echoed back — both verified by the selftests |
