# S332-WebAPI — s4a-web 需要的接口清单（精简版）

> 来源：Apifox 项目 6813503「S332-WebAPI」（默认模块 / main 分支），2026-10-30 只读盘点。
> 范围：只保留虚拟设备层需要的接口——通道、online、logger、recording、必要的设备信息。
> 其余接口分组未盘点。Apifox 里没有定义响应字段的地方，本文明确标注“未定义”，不猜测。
> 设备目标型号：S332（通道示例传感器为 S401）。

## 连接与鉴权

- 无公网地址，全部是局域网设备地址。Apifox 环境（真实设备，非 mock）：
  - 本地测试2：`http://192.168.5.130:8080`
  - 本地测试3：`http://192.168.5.131:8080`
  - Linda Test：`http://192.168.5.217:8080`
- WebSocket 的 Base URL 在各环境均为空，WS 地址在各接口 URL 里写死主机
  （出现过 192.168.5.130 / .131 / .122、192.168.1.197、192.168.5.43，均为 `:8080`）。
- 鉴权：读取类接口均为 Inherit → **No Auth**。
  唯一例外：`PUT /logger/switch` 标了 Bearer Token 覆盖，但 Apifox 里**没有给出 token 的值和来源**——实现前必须另行确认。
- ⚠️ 两套响应信封并存，不要假设统一：
  - 信封 A：`apiname / data / msg / status / time`（通道列表、实时流）
  - 信封 B：`code / status(boolean) / message`（logger 读取、通道文件列表等）

## 1. 通道操作

| 方法 | 路径 | 名称 | 状态 |
|---|---|---|---|
| GET | `/channel/list` | 获取通道列表 | Released |
| GET | `/channel/history` | 获取历史通道信息 | Released（响应字段未定义） |
| GET | `/channel/file-list` | 获取通道文件列表 | Released（信封 B，`data` 为 string 数组） |

`GET /channel/list`：无参数。响应信封 A，`data.classchannel` 为 sensor-channel 数组。

### sensor-channel 记录结构（通道列表与实时流共用）

字段（原样）：`channelid`、`deviceid`、`SensorID`、`channeldescription`（例 "Velocity"）、
`sensordescription`（例 "S401"）、`Unitascii`（例 "m/s"）、`Unitindex`、`ValueType`（例 8）、
`Resolution`、`Minimum`、`Maximum`、`useMinMax`、`DValue`（数值型现值，例 -9999）、
`SValue`（字符串型现值）、`Status`（通道状态，例 4）、`ErrorValue`、`useErrorValue`、
`Show`、`logger`（是否可记录）、`location`、`meapoint`、`formula`、`funcode`、
`holdingregaddr`、`MBValueLength`、`MBValueByteOrder`、`rw`、
`ChannelCreateTime`、`SensorCreateTime`。

要点：现值取 `DValue`（或 `SValue`）；通道状态取 `Status`。

## 2. Online 数据（实时值）

- **没有**可用的 HTTP 现值接口。实时值只有 WebSocket：
  - WS `ws://192.168.5.130:8080/ws/data` — 获取实时数据 — **Deprecated**（维护人 Limity）
  - 无请求消息定义；服务端推送信封 A，`data.classchannel[]` 结构同上。
- 结论：online 刷新 = 订阅该 WS 并缓存最新一帧；断线重连即“刷新”。实现时需注意它已标 Deprecated。

## 3. Logger 操作

### 状态与配置

| 方法 | 路径 | 名称 | 说明 |
|---|---|---|---|
| GET | `/logger/status-sub` | 订阅日志状态 | Released。正式 schema 只有 `object`，真实字段在接口描述里：`mode`(0 手动/1 定时)、`log_state`、`disk_available_mb`、`sampling_count`、`system_time`、`status` |
| GET | `/logger/configuration` | 获取日志配置信息 | Released。返回 `logger_config_info{file_name, start_time, stop_time, status, sample_rate, record_channels[], type_distinguish}`；status：0x00 正常关闭 / 0x01 正常开启 / 0x10 定时未开始 / 0x11 定时已开始 |
| GET | `/logger/active-service` | Logger 激活功能状态查询 | Released。返回 `data{hash, machine_code}`——是“功能是否激活”，不是“是否在记录” |
| WS | `ws://192.168.5.130/ws/logger/status` | 实时日志状态 | Deprecated，无请求消息定义（注意：此 URL 无 :8080 端口，原样记录） |

`log_state` 取值：0 已停止 / 1 记录中 / 2 定时等待开始 / 3 磁盘不足（≤500MB 不可启动）。
判定优先级：磁盘不足 > 定时等待 > 记录中 > 已停止。

### 文件列表

| 方法 | 路径 | 名称 | 说明 |
|---|---|---|---|
| GET | `/logger/all-records` | 查询已有记录信息 | Released，**用这个**。返回 `files[]{name, start_time, end_time, start_time_stamp, end_time_stamp, sample_rate, channels[]{description, unit, resolution, device_id, channel_id, location, measurement_point}}` |
| GET | `/logger/exported-files` | 查询已导出的表格文件 | Obsolete，不用 |
| GET | `/logger/metadata` | 查询单个日志记录信息 | Deprecated，被 all-records 取代 |

### 读取 logger 数据（三者同一结果形状）

结果形状：`record_data[]{timestamp, datas[]{channel_index, value}}` + `meta_data{channel_info[], ...}`。

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/logger/records-by-nums` | `file_name`(必填)、`nums`(必填)、`start_time`、`end_time` | 按条数取 |
| GET | `/logger/data-get-by-page` | `file_name`(必填)、`page_index`(必填)、`start_time`、`end_time` | 分页取，**每页固定 300 条**，meta 带 `current_page/total_pages` |
| GET | `/logger/records-precision` | `file_name`、`start_timestamp`、`end_timestamp` | 按时间段精确取，最多 300 条 |
| GET | `/logger/records-lose` | `file_names[]`(必填) | 查数据丢失情况（响应未细盘） |

### 导出

| 方法 | 路径 | Body 要点 |
|---|---|---|
| POST | `/logger/export-csv-by-duration` | `record_meta_datas[]{file_name, target_file_name, start_time_stamp, end_time_stamp, signature_enabled}` |
| POST | `/logger/records-duration` | `record_meta_datas[]{file_name, target_file_name, start_time_stamp, end_time_stamp}` |
| POST | `/logger/copy-file-to-target-path` | `file_info[]{file_name, with_authorization}`（导出 CSV 到 U 盘） |
| POST | `/logger/stream-record-data` | Developing：`{file_name, channel_index, nums, batch_size, start_time, end_time}`；停止用 POST `/logger/stop-stream-record-data?stream_id=` |
| POST | `/logger/verify-reactive` | 激活 logger 功能，body 只有 `activation_code`（值不在本文记录） |

## 4. Recording（设备端记录开关）

- PUT `/logger/switch` — 开启日志记录 — Released。**Bearer Token（值/来源未定义，待确认）**。
  Body：`{switch: boolean, logger_config:{start_time, stop_time, type, type_distinguish, sample_rate, logger_file_name, record_channel_ids:[{channelid, meapoint, location}]}}`
  - `type`：0 手动 / 1 定时启停 / 2 只定时停
  - `type_distinguish`：1 手动启手动停(type=0) / 2 手动启定时停(type=2) / 3 定时启手动停(type=1) / 4 定时启定时停(type=1) / 0 未设置（兼容旧版）
  - 200 响应字段未定义。
- S600 专属变体（仅 S600，与 S332 无关，备查）：PUT `/logger/s600/switch`、POST `/logger/s600/file-infos`（Developing，结构未完全解析）。

注意区分两个“recording”：
1. **设备端 recording** = 上面的 `/logger/switch`（设备自己把数据记进 logger 文件）；
2. **本地 recording** = s4a-web 现有的 `liveRecorder`（订阅 online 轮询、本地导出 CSV），不依赖设备端开关。

## 5. 设备信息

- GET `/system/device-info` — 获取设备信息 — Released。**响应 schema 未定义**，字段名无从取——
  虚拟设备层的设备身份信息不能指望这个接口，需真机抓一次实际响应再定。

## 命名不一致（实现时必须做映射，不能按名直连）

| 概念 | 通道/实时侧 | Logger 侧 | 记录数据侧 |
|---|---|---|---|
| 通道 id | `channelid` | `channel_id` | `channel_index`（+ `value`） |
| 测点 | `meapoint` | `measurement_point` | — |
| 通道名 | `channeldescription` | `description` | — |
| 单位 | `Unitascii` / `Unitindex` | `unit` / `unit_ascii` | — |

跨侧引用同一通道时优先按**顺序/索引**对应，再辅以 id 校验。

## 待确认（实现前）

1. `PUT /logger/switch` 的 Bearer Token 从哪来？
2. `GET /system/device-info` 的真实响应结构（需真机或抓包）。
3. WS `/ws/data` 已 Deprecated——是否有替代的实时通道（项目内未见），还是就用它 + `GET /channel/list` 轮询兜底？
4. 设备地址不固定（.130/.131/.217…）——连接时由用户输入 host（同现有 Ethernet TCP 的做法），不写死。
