# s4a-web 虚拟设备层设计（草案，待确认后实施）

> 目标（Ethan 2026-10-30）：s4a-web 已有 BLE / Ethernet / USB 等通讯方式，靠设备命令取数据。
> 现在按同样的规则，虚拟出一层“API 包裹的虚拟设备”：把 S332 的 HTTP/WebSocket API（见
> `APIFOX_NEEDED_API.md`）包装成一种新的通讯方式，与既有方式兼容，同样能：
> 获取通道结构（sensor-channel）、刷新 online 数据、recording、读 logger 文件。
> 状态：设计草案，未动代码，等确认。

## 1. 现状分层（新版 s4a-web，克隆 @ 3c1e4f8）

| 层 | 位置 | 内容 |
|---|---|---|
| 传输 | Rust `src-tauri/src/suto/transport.rs` | trait `SutoTransport{write, read, write_and_read}`；驱动：Windows USB(cscdc)、macOS USB、Android USB OTG、TCP、BLE(btleplug) |
| 协议 | Rust `protocol.rs` + `commands.rs` | CS-Bus 成帧/校验/多帧；命令 `[CTY,SCTY,ACT]`：系统 0x01、Logger 0x03、测量 0x04；DS310 命令：发现 `'A'`、`GetChSetting [04 02 02]`（或 0x0B）、`GetOnlineVal [04 01 01]`、`GetMaxChannels [01 FF 23]` |
| 引擎 | Rust `mod.rs` → Tauri 命令 | `suto_connect_usb/tcp/ble`、`suto_get_channels`（204B 通道结构解析）、`suto_get_values`（7B 值）、`suto_get_system_info`、`suto_get_logger_status`、`suto_get_logger_files`、`suto_read_s461_log`、`suto_get_600_csd_files`、`suto_send_command/raw` |
| 前端设备 | JS `src/api/TauriSutoAPI.js` | 按 `activeTransport` 分发：Tauri 引擎，或 Web Bluetooth 的 `BleSutoAPI.js`（在 JS 重写了成帧/通道解析/online 值，接口与 Tauri 版同形） |
| 前端门面 | JS `src/api/TestAPI.js` | Proxy：monitor 模式把 `getChannels/getMeasurementData/getTablePage` 转给 `TauriSutoAPI`，并合成单一 location |
| 消费方 | `util/liveDataSource.js`、`util/liveRecorder.js`、`ReadoutView.jsx` | online：单一轮询器 1.5s 订阅制；recording：订阅轮询本地录 CSV；logger 读取：ReadoutView 直调 TauriSutoAPI，无抽象 |

关键观察：**“虚拟设备”在前端其实已经半成形**——`TauriSutoAPI` 与 `BleSutoAPI` 同形、
`TestAPI` Proxy 只认方法名不认通讯方式。缺的是：(a) 把这套契约显式定义出来；
(b) logger/recording 还直连具体实现；(c) 新增 API 实现时无处安放。

## 2. 设计：三层不变，中间加一层契约

```
UI / 消费方   TestAPI Proxy · liveDataSource · liveRecorder · ReadoutView
                   │  只认 VirtualDevice 契约（方法名 + 归一化数据结构）
虚拟设备层    VirtualDevice（契约 + 注册表 + 当前设备）
                   │  connect / disconnect / getSystemInfo / getChannels
                   │  getMeasurementData / getLoggerStatus / getLoggerFiles
                   │  readLoggerData / exportLogger …
        ┌──────────┼──────────────────┐
命令型实现          API 型实现（新）        文件型实现（已有，不动）
 TauriDevice       ApiDevice            CsdAPI / CsvAPI / MockAPI
  ├ USB/TCP/BLE原生  └ HTTP + WebSocket    （analyze 模式继续走 TestAPI 老路）
  └ BLE Web (BleSutoAPI)  (S332-WebAPI)
        │                   │
 Rust 引擎/驱动        局域网设备 :8080
```

原则：
1. **遵守现有规则**：新实现的方法签名、回调风格、归一化输出结构与 `TauriSutoAPI` 完全一致；
   上层（liveDataSource/liveRecorder/ReadoutView/TestAPI Proxy）零改动或最小改动。
2. **归一化在实现层做**：每种通讯方式的原始字段（204B 结构 / classchannel / logger 文件结构）
   在各自实现里映射成同一套“标准通道 / 标准值 / 标准 logger 文件”结构，UI 永远不见原始字段。
3. **能力声明**：每种实现带 `capabilities`（如 `loggerFiles, loggerSwitch, screenshots, report600`），
   UI 按能力显隐（沿用 ReadoutView 已有的按设备类型显隐选项的做法），不再按 transport 硬编码判断。
4. **连接即设备**：连接参数统一为 `{kind:'usb'|'tcp'|'ble'|'api', ...}`；
   API 型为 `{kind:'api', host, port=8080}`（对应现有 Ethernet 的 host/port 输入习惯，地址不写死）。

## 3. VirtualDevice 契约（归一化结构）

方法（Promise + 可选 callback，与现行一致）：

| 方法 | 命令型实现（现有来源） | API 型实现（S332-WebAPI） |
|---|---|---|
| `connect(opts)` / `disconnect()` | connectUsb/Tcp/Ble + 发现 `'A'` | 探活 `GET /channel/list`（或 device-info），建立 WS `/ws/data` |
| `getSystemInfo()` | `suto_get_system_info`（一组 0x01 命令） | `GET /system/device-info`（**响应未定义，需真机抓取**；抓到前返回由 channel/list 推导的最小信息并标 `partial`） |
| `getChannels()` → 标准通道[] | `suto_get_channels` / Ble `getChannels` | `GET /channel/list` 的 `data.classchannel[]` 映射 |
| `getMeasurementData()` → 标准值[] | `suto_get_values` / Ble online 值 | WS 最新帧缓存（见 §4） |
| `getLoggerStatus()` → 标准状态 | `suto_get_logger_status`（enabled/recorded_count/start/end/interval） | `GET /logger/status-sub` + `/logger/configuration` 合并映射 |
| `setLoggerSwitch(on, config)`（可选，不做） | 现前端无此功能 | `PUT /logger/switch`——见 §5，仅预留，不纳入本次范围 |
| `getLoggerFiles()` → 标准文件[] | `suto_get_logger_files` | `GET /logger/all-records` 的 `files[]` 映射 |
| `readLoggerData(file, opts)` → `{meta, rows[]}` | `readS461Log` / S600 CSD 路径 | `GET /logger/data-get-by-page`（300/页循环）或 `records-by-nums` / `records-precision` |
| `exportLoggerCsv(file, range)` | 现有 CSV 导出（本地生成） | `POST /logger/export-csv-by-duration`（设备端导出）或用 readLoggerData 本地生成，二选一待定 |
| `sendCommand/raw` | `suto_send_command/raw` | API 型：`capabilities.rawCommand=false`，调用即抛“不支持” |

标准通道（以现行 `TauriSutoAPI.getChannels` 输出为准）：
`{channel_id, location_id:1, channel_name, logic_channel_description, full_channel_name,
unit, unit_in_ascii, unit_index, resolution, device_description, sensor_description,
sensor_id, sensor_channel_id, sensor_key, device_id, sub_device_id, slaver_type,
slaver_addr, active, selected}`

API 型映射（classchannel → 标准通道）：
`channelid→channel_id/sensor_channel_id`，`channeldescription→channel_name/logic/full`，
`sensordescription→sensor_description/device_description`，`SensorID→sensor_id`，
`deviceid→device_id`，`Unitascii→unit/unit_in_ascii`，`Unitindex→unit_index`，
`Resolution→resolution`（缺失时走现有 `resolveChannelResolution`），
另保留原始字段到 `raw` 以备查（Minimum/Maximum/Status/logger 等不丢）。

标准 logger 状态：`{enabled, recording, state:'stopped|recording|timed_waiting|disk_insufficient|unknown',
mode, recorded_count/sampling_count, start_time, end_time, sample_rate/package_interval, disk_available_mb}`
——命令型的 LoggerStatus 与 API 的 status-sub/configuration 都映射到它，ReadoutView 只认它。

标准 logger 文件：沿用现行 `getLoggerFiles` 输出
`{fileName, startTime, endTime, channelsCount, samplesPerChannel, sampleRate, description, status, isRecording}`；
API 的 all-records 缺 `samplesPerChannel/description` 时置 null，不编造。

记录数据行：`record_data[]{timestamp, datas[]{channel_index, value}}` 归一化为
`{timestamp, values:{[channel_id]: value}}`（channel_index → channel_id 按 meta_data.channel_info 的顺序/索引映射，
正对应清单里“按顺序映射”的注意事项），与 liveRecorder/表格视图的行形状对齐。

## 4. Online 刷新（API 型）

- ApiDevice 内部维护 WS 连接与最新帧缓存 + 历史缓冲（复刻 Tauri 版 `historyBuffer` 的 3600 点逻辑，
  或抽成共享工具供两种实现共用）。
- `liveDataSource` 的 1.5s 轮询模型**不变**：轮询 ApiDevice 时只是读缓存，不产生网络流量；
  WS 断线自动重连，重连成功后第一帧即刷新。这与命令型的“轮询即查询”在上层完全同形。
- 兜底：WS 已标 Deprecated。若 WS 不可用，降级为轮询 `GET /channel/list`（其 classchannel 同样带 DValue），
  在能力里标 `onlineSource:'ws'|'poll'`。是否接受这个兜底，待确认。

## 5. Recording（两个含义分开处理）

1. **本地 recording（已有）**：liveRecorder 订阅 liveDataSource——ApiDevice 接入后自动可用，零改动。
2. **设备端 recording（本次不做）**：指从 app 远程命令设备开始/停止其内置 logger
   （`PUT /logger/switch`）。现有 s4a-web 没有这个功能——它只读 logger 状态、列文件、读文件，
   记录的启停发生在设备本机/设备自己的配置里。虚拟层只预留 `setLoggerSwitch` 能力位，
   默认不实现；其 Bearer Token 来源未定义的问题也随之搁置，不阻塞本次工作。

## 6. 落地步骤（确认后执行，每步可独立验证）

1. `src/api/device/VirtualDevice.js`：契约注释 + 注册表 + 当前设备单例（先只注册现有实现，行为不变）。
2. `src/api/device/TauriDevice.js`：薄包装现有 `TauriSutoAPI`（含 BLE Web 分发），TestAPI Proxy 改为认 VirtualDevice；跑现有测试回归。
3. `src/api/device/ApiDevice.js`：HTTP（channel/list、logger 系列）+ WS 缓存；字段映射与两套信封处理；配 Mock 服务器测试（仿 `scripts/s331-simulator.mjs` 做一个 S332-API 模拟器，用清单里的示例数据）。
4. `DeviceConnectModal` 增加第四个页签 “API (S332)”：输入 host/port → `connect({kind:'api'})`。
5. ReadoutView 的 logger 调用改走 VirtualDevice（按 capabilities 显隐），ApiDevice 下验证文件列表 + 分页读数 + 导出。
6. 真机联调（192.168.5.x 设备）：抓 `device-info` 真实响应、验证 WS 帧率与重连。

## 7. 待 Ethan 确认

1. 虚拟层落点：按上面在 `src/api/device/` 新建，还是直接在 `TauriSutoAPI.js` 里加 `API` transport 分支（改动小、但文件继续膨胀）？**推荐前者**。
2. Online 兜底轮询 `/channel/list` 是否接受？
3. `exportLoggerCsv` 走设备端导出还是本地生成？
