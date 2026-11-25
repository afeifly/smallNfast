# Logger.db 数据库与 CSV 导出认知文档

> —— 基于 S332 分支 ——

| 项目 | 内容 |
| --- | --- |
| 文档版本 | 1.0 |
| 创建者 | Franklin |
| 修改日期 | 2026-11-23 |
| 适用范围 | 仅 S332 分支（不包含 S600 分支） |
| 目标读者 | 需要基于已导出的 Logger.db 开展分析/对接的工程师 |
| 文档目的 | 帮助读者识别数据库结构、ER 关系、字段含义，以及 CSV 导出内容与签名/认证文件机制 |

> **说明：** 本文档描述的是导出后的数据库文件本身及其数据组织方式，均以 S332 分支的实际产物为准。

---

## 修订记录

| 版本 | 日期 | 修订人 | 说明 |
| --- | --- | --- | --- |
| 1.0 | 2026-11-23 | Franklin | 首次发布：覆盖 S332 分支的 Logger.db 表结构、ER 关系、字段说明、CSV 导出格式与签名/认证文件机制 |

## 目录

1. 文档概述
2. Logger.db 总体结构
3. 表结构与字段说明
4. ER 关系与数据定位方法
5. 采样数据与统计字段
6. CSV 导出机制与文件格式
7. 签名与认证文件（FV.txt）
8. 常见问题与速查
9. 附录：SQL 速查

---

## 1. 文档概述

### 1.1 目的与范围

本文档面向接手 S332 版本 Logger 数据的工程师。交付物是一个已导出的 Logger.db 数据库文件以及随之导出的 CSV 文件。本文档帮助读者：

- 识别库中有哪些表、每张表代表什么业务对象；
- 理解表与表之间的逻辑关联，并能从一个会话文件定位到它的通道定义与采样数据；
- 理解每个字段的含义、来源与取值约定；
- 理解 CSV 导出的内部格式、字段含义、时间戳与数值规则；
- 理解“签名”与认证文件 FV.txt 的真实含义（以实际产物为准，而非旧版文档描述）。

> **说明：** 范围限定：只覆盖 S332 分支，不包含 S600 分支的任何差异内容。

### 1.2 数据资产概览

| 对象 | 说明 |
| --- | --- |
| Logger.db | SQLite 格式的数据库文件，保存会话元数据、通道定义、采样数据、丢点记录、导出任务与版本信息 |
| 会话（Session） | 一次连续记录，在库中对应主表的一行，以及一对按会话生成的通道表与数据表 |
| CSV 文件 | 按指定时间区间从采样数据导出的文本报表，附带字段说明区与可选的文本签名行 |
| FV.txt | 与 CSV 同名的认证文件，保存该 CSV 文件的 SHA-512 完整性校验值 |
| export_tasks | 库中的导出任务记录，保存已生成文件的位置、校验值与签名标志 |

### 1.3 术语表

| 术语 | 含义 |
| --- | --- |
| 会话 / session | 一次连续记录，对应 `FileInformationTable` 的一行和一对动态表 |
| LoggerFileName | 会话的业务文件名，是查询入口；逻辑上相当于会话唯一标识（库中没有 UNIQUE 约束） |
| SpecialID | `FileInformationTable` 中的 JSON 列，形如 `{"file_name":"...","mea_point":"..."}`，用于推导动态表名 |
| Item | `ChannelHeader` 表自增主键；同时决定采样表中列名 `C{Item}` |
| C{Item} | `ChannelData` 表中的动态列，例如 `Item=3` 对应列 `C3`，存放该通道的采样值 |
| FV.txt | File Verification 文件，包含 CSV 的 SHA-512 哈希，用于完整性校验（不是数字签名） |
| 字符签名 | 用户提供的文本，作为一行 `Signature: <内容>` 写入 CSV 内容区 |

---

## 2. Logger.db 总体结构

### 2.1 数据库文件

| 项目 | 内容 |
| --- | --- |
| 文件格式 | SQLite 3 数据库文件 |
| 默认路径 | `/data/Logger.db`（测试环境路径 `./Logger.db`） |
| 数据库版本 | 1.0.1（记录在版本表中） |
| 并发模式 | WAL 模式，会产生 `-wal` / `-shm` 伴随文件；备份时必须整体拷贝，不能只复制 `.db` 文件 |
| 写冲突处理 | 写入繁忙时最长等待 5 秒；主表写入失败会重试 5 次，每次间隔 200 毫秒 |
| 版本升级策略 | 主版本不一致时整库重建，旧库先备份为 `/data/backup/logger/logger_backup_<时间戳>.db` |

> **说明：** WAL 模式下 `-wal` / `-shm` 文件与主 `.db` 文件属于同一个数据库，单独拷贝 `.db` 可能得到不完整的快照。

### 2.2 表清单总览

库中共有 6 类表：4 张固定表 + 2 类按会话动态生成的表。动态表在每个会话建立时创建，表名带会话标识后缀。

| 表名 | 类型 | 粒度 | 主键 | 说明 |
| --- | --- | --- | --- | --- |
| FileInformationTable | 固定 | 全局共享 | ID | 会话主表：一次记录一行，是查找其它表的入口 |
| ChannelHeader_{id} | 动态 | 每会话一张 | Item | 通道定义表：每个通道一行，含描述、单位、分辨率、统计值等 |
| ChannelData_{id} | 动态 | 每会话一张 | ID | 采样数据表：每行一个采样时刻，列为 TimeStamp + C1..Cn |
| LostData | 固定 | 全局共享 | ID | 掉电/丢点区间记录，LostInfo 为 JSON 数组 |
| export_tasks | 固定 | 全局共享 | id | CSV 导出任务记录，含文件路径、哈希、签名标志 |
| VersionControl | 固定 | 全局共享 | （无） | 单行存放数据库 schema 版本字符串 |

### 2.3 版本管理与结构升级

| 机制 | 触发条件 | 行为 |
| --- | --- | --- |
| 主版本校验 | 版本表不存在 / 为空 / 版本非法 / 主版本号与预期不同 | 整库重建：先备份旧库，再删除、重建并写入版本 |
| 次版本升级 | 存储版本低于预期版本（按 major.minor.patch 比较） | 非破坏性加法升级：补齐会话主表列、枚举通道表并补列，最后写回版本 |
| 元数据列补齐 | 每次打开数据库 | 幂等补齐会话主表的 15 个测量任务元数据列，不升版本号 |
| 统计列补齐 | 统计计算前 / 版本升级时 | 幂等补齐通道表中的统计与分类列 |

> **说明：** 所有新增列均不带默认值，因此历史行的新列值为 NULL。

---

## 3. 表结构与字段说明

### 3.1 FileInformationTable（会话主表）

每张会话在此表有一条记录。`Descriptions` 通常固定为 `RecordFile`。`MeasurementType` 列记录该会话的启动方式。后 16 个元数据列为后续S600加入。

| 列名 | 类型 | 约束/默认 | 说明与来源 |
| --- | --- | --- | --- |
| ID | int64 | PK, AUTOINCR | 自增主键 |
| Descriptions | string | - | 描述，实际写入 `RecordFile` |
| LoggerFileName | string | NOT NULL | 记录文件名，业务主键/查询入口 |
| ChangeFileName | string | - | 改名后的文件名，用于兼容旧名查询 |
| SpecialID | string | - | JSON：`{"file_name":...,"mea_point":...}`，推导动态表名 |
| StartTime | string | - | 开始时间文本 |
| StartTimeStamp | int64 | - | 开始时间戳（毫秒 epoch） |
| EndTime | string | - | 结束时间文本；记录中初始为空，停止时回填 |
| EndTimeStamp | int64 | - | 结束时间戳；0 表示未正常结束 |
| SampleRate | int | NOT NULL | 采样率（秒） |
| ChannelCount | int | - | 通道数 |
| PointInfo | string | - | 测点信息 |
| UserInfo | string | - | UserInfo JSON，见 3.7 |
| Other | string | - | 预留 |
| Status | int | DEFAULT 0 | 会话状态（开始 / 停止） |
| MeasurementType | int | - | 启动方式：0=手动立即启动；1=定时启停；2=仅定时停止 |
| GasType | string | - | 来自 Logger 配置 |
| ParModel | int | - | 来自 Logger 配置 |
| TotalFlow | float64 | - | 来自 Logger 配置（保留字段） |
| OEM | string | - | 来自 Logger 配置 |
| TargetClasses | string | - | JSON：`{ClassParticle,ClassDewPoint,ClassOil,ClassHumidity}` |
| CalibrationDate | string | - | 来自 `meta_data.last_calibration` |
| MeasurementPoint | string | - | 来自 `meta_data.measurement_point` |
| Location | string | - | 来自 `meta_data.location` |
| Telephone | string | - | 来自 `meta_data.telephone` |
| Email | string | - | 来自 `meta_data.e_mail` |
| CustomerCompany | string | - | 来自 `meta_data.customer_company` |
| CalibrationDue | string | - | 来自 `meta_data.calibration_due` |
| CustomerName | string | - | 来自 `meta_data.customer_name` |
| CalibrationDateStamp | int64 | - | `last_calibration` 原始 epoch 毫秒 |
| CalibrationDueStamp | int64 | - | `calibration_due` 原始 epoch 毫秒 |

### 3.2 ChannelHeader_{id}（会话通道定义表）

表名规则：`ChannelHeader_<会话标识>`，其中会话标识来自主表 `SpecialID` 中的 `file_name` 与 `mea_point`（字符串经清洗，只保留字母、数字、下划线）；标识为空时为 `ChannelHeader_default`。S332 分支只使用 `file_name`，因此实际表名通常是 `ChannelHeader_<清洗后的文件名>`。后 4 个元数据列为 S600 加入。

| 列名 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| Item | int | PK, AUTOINCR | 通道主键；同时是采样列名 `C{Item}` 的来源 |
| ChannelDescription | string | NOT NULL | 通道描述（CSV 中作为 Channel 列） |
| DeviceDescription | string | - | 设备描述 |
| SubDeviceDescriptions | string | - | 子设备描述 |
| SensorDescription | string | - | 传感器描述（CSV 中作为 Sensor 列） |
| Unit | string | NOT NULL | 单位（CSV 中作为 Unit 列） |
| Resolution | int | NOT NULL | 分辨率/小数位数，决定数值格式化 |
| Location | string | - | 位置 |
| MeasurementPoint | string | - | 测点 |
| ChannelID | int | - | 通道业务 ID，与传感器配置关联；会话建立时对应到 Item |
| DeviceID | int | - | 设备 ID |
| SubDeviceID | int | - | 子设备 ID |
| SensorID | int | - | 传感器 ID |
| ChannelConfig | int | - | 通道配置 |
| SlaveAddress | int | - | 从站地址 |
| DeviceType | int | - | 设备类型 |
| Flag | int | DEFAULT 0 | 标志 |
| Other | string | - | 预留 |
| Average | float64 (REAL) | - | 统计均值，由聚合计算回写 |
| Max | float64 (REAL) | - | 统计最大值 |
| Min | float64 (REAL) | - | 统计最小值 |
| AlarmValue | string (TEXT) | - | 告警配置 JSON，会话建立时获取；统计计算不修改 |
| LimitValue | float64 (REAL) | - | 露点/油分限值 |
| LimitType | int | DEFAULT 0 | 0=ISO 标准限值；1=用户配置限值 |
| ChannelType | int | DEFAULT 0 | 0=Unknown, 1=Particle, 2=DewPoint, 3=Oil, 4=Pressure, 5=Temperature, 6=Humidity, 7=Flow |
| OrderID | int | DEFAULT -1 | 同类型内排序；-1=按数据库/主键顺序 |

### 3.3 ChannelData_{id}（会话采样数据表）

表名规则同上：`ChannelData_<会话标识>`。表的列由固定列与按通道数动态生成的列组成：

| 列名 | 类型 | 约束/索引 | 说明 |
| --- | --- | --- | --- |
| ID | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键；也是丢点记录中 `data_id` 指向的对象 |
| TimeStamp | INTEGER | 索引 `idx_{会话标识}_timestamp` | 采样时刻，毫秒 epoch |
| C{Item} | REAL | DEFAULT NULL | 动态列：每个通道一列，列名 = `C` + `ChannelHeader.Item` |

映射链路：通道业务编号 `ChannelID` 在会话建立时对应到 `Item`，`Item` 决定列名 `C{Item}`，该列存放该通道的采样值。反向规则为 `C123` → `Item=123`。会话建立时会按全部通道预建列，因此后续即使只有部分通道上报数据也不会缺列。

### 3.4 LostData（丢点记录表）

| 列名 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| ID | int64 | PK, AUTOINCR | 自增主键 |
| LoggerFileName | string | NOT NULL | 逻辑关联 `FileInformationTable.LoggerFileName` |
| LostInfo | string | NOT NULL | JSON：`{"lost_info":[ ... ]}`，见下表 |

`LostInfo` JSON 数组元素结构：

| JSON 键 | 类型 | 说明 |
| --- | --- | --- |
| index | int | 序号 |
| data_id | int64 | 指向 `ChannelData.ID`，标记丢点发生位置 |
| power_off_time | int64 | 断电时间戳（毫秒） |
| power_on_time | int64 | 恢复上电时间戳（毫秒） |
| sample_rate | int32 | 当时的采样率 |
| lost_nums | int64 | 丢失的采样点数 |

### 3.5 export_tasks（导出任务表）

| 列名 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| id | int64 | PK, AUTOINCR | 自增主键 |
| user_id | string | NOT NULL | 用户 ID |
| export_type | string | NOT NULL | 导出类型；CSV 导出写入 `logger_records_csv` |
| export_format | string | NOT NULL | 格式；CSV 导出写入 `csv` |
| status | string | NOT NULL DEFAULT 'pending' | 任务状态；正常完成写入 `finished` |
| file_path | string | - | 导出文件完整路径 |
| file_hash | string | - | 文件 SHA-512 哈希（小写 hex，128 字符） |
| hash_algorithm | string | - | 算法名；当前设备配置固定为 `SHA512` |
| document_password | string | - | 文档密码；CSV 导出固定写空字符串 |
| is_signed | bool | DEFAULT false | 仅表示 CSV 内含字符签名行，不表示 FV.txt 存在 |
| total_records | int | - | 总记录数 |
| processed_records | int | DEFAULT 0 | 已处理记录数 |
| start_time | time.Time | NOT NULL, created | 创建时间，写入时自动填充 |
| end_time | time.Time | - | 结束时间 |
| error_message | string | - | 错误信息 |

### 3.6 VersionControl（版本表）

| 列名 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| Version | string | NOT NULL | 当前 schema 版本字符串；约定单行存储，无显式主键 |

### 3.7 嵌入列中的 JSON 结构

以下结构不是独立表，而是序列化后存入上述表的文本列：

| 结构名 | 所在列 | 字段 |
| --- | --- | --- |
| SpecialID | `FileInformationTable.SpecialID` | file_name(string), mea_point(string) |
| UserInfo | `FileInformationTable.UserInfo` | deviceId, description, testerName, companyName, companyShortAddress, serviceCompanyName, serviceCompanyShortAddress, deviceName, numOfDevices, logVersion, sampleRateFactor |
| TargetClasses | `FileInformationTable.TargetClasses` | ClassParticle, ClassDewPoint, ClassOil, ClassHumidity |
| AlarmValue | `ChannelHeader_{id}.AlarmValue` | 告警配置 JSON |
| LostInfo | `LostData.LostInfo` | lost_info[]，元素见 3.4 |

---

## 4. ER 关系与数据定位方法

### 4.1 ER 关系总览

![Logger.db ER 关系总览](er_diagram.png)

*图 4-1  Logger.db 表关系图。实线表示会话与其动态表的关联，虚线表示逻辑关联。*

### 4.2 关系说明

| 关系 | 起点 | 终点 | 说明 |
| --- | --- | --- | --- |
| 会话 → 动态表 | `FileInformationTable.SpecialID` | `ChannelHeader_{id}` / `ChannelData_{id}` | 解析 SpecialID 的 JSON 得到会话标识，拼出两张表名；这是定位会话数据的关键 |
| 通道 → 数据列 | `ChannelHeader.Item` | `ChannelData.C{Item}` | Item 是通道主键，同时决定采样列名，每个通道唯一一列 |
| 业务通道 → Item | `ChannelHeader.ChannelID` | `ChannelHeader.Item` | 会话建立时确定，该映射未落库 |
| 丢点 → 会话 | `LostData.LoggerFileName` | `FileInformationTable.LoggerFileName` | 字符串相等匹配 |
| 丢点 → 采样行 | `LostInfo[].data_id` | `ChannelData.ID` | 嵌套在 JSON 内，非数据库外键 |

> **说明：** 以上全部为逻辑关联，数据库中没有外键约束，也没有 UNIQUE 约束，数据一致性由写入方维护。

### 4.3 从一个会话名定位全部数据

```sql
-- 1) 查会话主记录
SELECT ID, LoggerFileName, SpecialID, StartTime, EndTime,
       StartTimeStamp, EndTimeStamp, SampleRate, ChannelCount, Status
FROM FileInformationTable WHERE LoggerFileName = '<会话名>';

-- 2) 解析 SpecialID 的 JSON 得到 file_name / mea_point，例如 file_name='X'、mea_point=''：
--    动态表名 = ChannelHeader_X / ChannelData_X（字符串经清洗）

-- 3) 查通道定义（按 Item 排序，Item 即为数据列编号）
SELECT Item, ChannelDescription, SensorDescription, Unit, Resolution, Location, MeasurementPoint
FROM ChannelHeader_X ORDER BY Item;

-- 4) 查采样数据（C1 对应 Item=1 的通道）
SELECT ID, TimeStamp, C1, C2, C3 FROM ChannelData_X ORDER BY TimeStamp LIMIT 10;

-- 5) 查该会话的掉电丢点记录
SELECT * FROM LostData WHERE LoggerFileName = '<会话名>';
```

> **说明：** EndTimeStamp = 0 或 EndTime 为空说明会话未正常结束（可能掉电）。拼接表名前请务必对会话标识做清洗与校验。

---

## 5. 采样数据与统计字段

### 5.1 数据记录规则

- 每条采样记录对应一个采样时刻，`TimeStamp` 为毫秒 epoch 时间；
- 每个通道对应采样表中的一个 `C{Item}` 列，列值为浮点数；
- 采样间隔由会话主表的 `SampleRate` 字段（秒）决定；
- 会话未正常结束时 `EndTimeStamp` 为 0，掉电期间的丢点信息记录在 `LostData` 表中。

### 5.2 无效值与丢点哨兵

| 配置项 | 值 | 用途 |
| --- | --- | --- |
| PowerOffLostData | -9999 | 掉电丢点填充哨兵值 |
| InvalidValues | [-9999] | 统计计算时排除的无效值列表 |

> **说明：** 这些值仅用于统计计算与丢点补齐。CSV 导出不做无效值过滤，也不做丢点补齐。

### 5.3 统计列回填规则

系统会按通道计算采样列的平均值、最大值与最小值，排除配置的无效值后写入通道表的 `Average` / `Max` / `Min` 列。`AlarmValue` 列保存告警配置，不受该计算影响。

---

## 6. CSV 导出机制与文件格式

### 6.1 导出能力

| 操作 | 说明 |
| --- | --- |
| 按时间区间导出 CSV | 指定会话与起止时间，生成 CSV 文件及 FV.txt 认证文件 |
| 复制导出文件 | 将已导出的 CSV（及可选的 FV.txt）复制到外部目录 |
| 列出 / 删除导出文件 | 管理已生成的导出文件，删除时一并清理 FV.txt |
| 数据库文件导出 | 单独导出 Logger.db 文件；导出前会完成 WAL 检查点，确保数据落盘 |

> **说明：** 导出、复制、删除操作互斥串行执行，避免并发写冲突。

### 6.2 文件命名与目录

| 项目 | 规则 |
| --- | --- |
| CSV 文件名 | 会话文件名（或目标文件名） + 起始日期 + 结束日期 + `.csv`，日期格式 `MMDDYYYY` |
| 示例 | `sensor_log_03032026_04032026.csv` |
| 导出目录 | `/data/export/loggerFile` |
| 复制目标 | `/root/udisk/<目标路径>` |
| 重名处理（复制） | 在扩展名前加 `(n)`：`foo.csv` → `foo(1).csv`；`fooFV.txt` → `fooFV(1).txt` |

```text
/data/export/loggerFile/
|-- sensor_log_03032026_04032026.csv
`-- sensor_log_03032026_04032026FV.txt

/root/udisk/<目标路径>/
|-- sensor_log_03032026_04032026.csv
`-- sensor_log_03032026_04032026FV.txt
```

### 6.3 CSV 内部格式

CSV 文件使用 UTF-8 编码（无 BOM），字段以英文逗号分隔，换行符为 `\n`（非 CRLF），引号与转义遵循标准 CSV 规则。固定标签文案为英文。每一“行”都是一条 CSV 记录；空行写作一个空字段。

完整结构示例（启用字符签名时）：

```csv
S332 Raw Data

Start Date Time,18.Jul 2023 15:30
End Date Time,18.Jul 2023 16:30
Sample Rate(sec),1
NO.Of Channels,2

Signature: <用户签名内容>

No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point
1,Channel A,Sensor A,°C,0.01,Room/Point1
2,Channel B,Sensor B,%RH,0.1,Room/Point2

Date Time,Channel A - °C,Channel B - %RH
18-07-2023 15:30:00,23.45,56.7
18-07-2023 15:30:01,23.46,56.8
```

逐区说明：

| 区块 | 内容 | 字段来源 |
| --- | --- | --- |
| 标题行 | 单列：标题模板，其中 `{device_type}` 替换为设备类型；默认模板为 `{device_type} Raw Data` | 配置标题模板 + 设备类型 |
| 空行 | 1 个空字段记录 | 固定 |
| 元数据 4 行 | Start Date Time / End Date Time / Sample Rate(sec) / NO.Of Channels | 会话主表：StartTimeStamp、EndTimeStamp、SampleRate、ChannelCount |
| 签名区 | 启用字符签名：空行 + `Signature: <内容>` + 空行；未启用：仅 1 个空行 | 签名选项 / 会话元数据中的签名开关 |
| 通道信息表头 | No.,Channel,Sensor,Unit,Resolution,Location/Measurement Point | 固定英文标签 |
| 通道信息行 | 每通道一行：序号(从1)、通道描述、传感器描述、单位、分辨率字符串、位置/测点 | 通道定义表对应字段 |
| 空行 | 1 个空字段记录 | 固定 |
| 数据表头 | Date Time + 每通道一列 `<通道描述> - <单位>`；单位为空时写 Unknown | 通道定义表的通道描述与单位 |
| 数据行 | Date Time + 各通道按分辨率格式化的采样值字符串 | 采样数据表的 TimeStamp 与 C{Item} |

### 6.4 时间与数值格式化

| 数据 | 格式 | 示例 |
| --- | --- | --- |
| 元数据起止时间 | DD.Mon YYYY HH:MM（本地时区，无秒/毫秒） | 18.Jul 2023 15:30 |
| 数据行 Date Time | DD-MM-YYYY HH:MM:SS（本地时区，字符串；不是毫秒时间戳） | 18-07-2023 15:30:00 |
| 采样值 | 按 Resolution 四舍五入并格式化为定点小数字符串 | Resolution=2 → 23.45；=0 → 23 |
| 分辨率显示 | 1→`1`；2→`0.01`；3→`0.001` | 通道信息表的 Resolution 列 |
| 缺失数据 | 缺少对应通道值时写空字符串 `""` | - |
| 解析失败 | 异常值按 0 处理，最终写 `0` / `0.00` | - |

### 6.5 导出格式说明

当前仅支持 CSV 作为表格导出格式。历史文档中提到的 Excel/xlsx 定义已不再使用；旧文档中“.fv”后缀的描述也与实际情况不符，实际后缀为 `FV.txt`。

---

## 7. 签名与认证文件（FV.txt）

### 7.1 体系总览

系统未使用数字证书签名机制。所谓“签名”实际是两件独立的事：

| 机制 | 是什么 | 存放位置 | 是否数字签名 |
| --- | --- | --- | --- |
| 字符签名 | 用户提供的文本，按 `Signature: <content>` 单行写入 CSV 内容 | CSV 文件内部 | 否 |
| FV.txt 完整性文件 | 整个 CSV 文件的 SHA-512 哈希 + 算法说明 | 同名 `.csv` 旁的 `<basename>FV.txt` | 否（仅完整性校验） |

### 7.2 字符签名细节

- 签名选项包含：是否启用、签名类型、签名内容；当前仅支持文本类型；
- 每条会话记录可单独指定是否带签名，其设置优先于全局设置；
- 启用时，CSV 中写入一行 `Signature: <内容>`，前后各留一个空行；
- 导出任务记录中的 `is_signed` 仅表示 CSV 内含该签名行，与 FV.txt 无关。

### 7.3 FV.txt 生成流程

- CSV 内容写入完毕后，对完整文件计算 SHA-512（以 8 MB 缓冲流式读取）；
- 哈希输出为 128 位小写十六进制字符串；
- 正常导出总会生成 FV.txt，与字符签名开关无关；
- 同一个哈希值与算法名写入导出任务记录的 `file_hash` / `hash_algorithm` 字段。

认证文件名：`<basename>FV.txt`（basename 不含 `.csv`，FV 前没有点）。文件内容恰好三行，UTF-8 无 BOM，行间 `\n`，无末尾换行，文件权限为 `0600`：

```text
Used For: File Integrity Verification
Hash Algorithm: SHA512
File Hash: <128 位小写十六进制 SHA-512 值>
```

校验方式（外部工程师可自行验证）：

```bash
sha512sum sensor_log_03032026_04032026.csv
# 将输出值与 FV.txt 的 File Hash 行比对（应为 128 位小写 hex）
```

> **说明：** 文件中声明的算法名来自设备配置（当前为 SHA512）；若配置变更而计算方式未同步，声明可能与实际不符。

### 7.4 FV.txt 在其它流程中的处理

| 流程 | 行为 | 注意 |
| --- | --- | --- |
| 列出导出文件 | 对所有 CSV 任务检查 FV 文件是否存在；缺失则标记文件不存在 | 未先判断 `is_signed`，可能造成未签名任务也被判为不存在 |
| 复制到外部目录 | 仅当请求指定“带认证文件”时才复制 FV.txt | 复制请求中的签名选项不会被读取 |
| 删除导出文件 | 同时删除 FV.txt | 路径按配置的导出目录拼接，而非任务记录中的路径 |
| 审计记录 | 导出完成后把 FV 文件名追加进审计信息 | - |

### 7.5 已知注意事项

- 导出任务记录中的 `document_password` 字段存在，但 CSV 导出固定写空字符串；配置中也没有导出密码项。
- 复制导出时按文件名前缀取第一条任务，没有显式排序，同名前缀多条任务时依赖数据库返回顺序。

---

## 8. 常见问题与速查

| 问题 | 判断/处理 |
| --- | --- |
| 如何知道某会话是否正常结束？ | 看会话主表的 `EndTimeStamp` 是否为 0（或 `EndTime` 为空）；为 0 表示未正常结束 |
| 如何找到会话的数据表？ | 解析 SpecialID JSON → 得出会话标识 → 拼 `ChannelHeader_<id>` / `ChannelData_<id>` |
| CSV 中某列为什么全是 0？ | 数据库值缺失或解析异常时按 0 处理；另检查通道定义中的 `Resolution` |
| CSV 中的 -9999 是什么？ | 掉电丢点/无效值哨兵；CSV 导出不过滤它，只在统计和丢点补齐路径使用 |
| FV.txt 是不是数字签名？ | 不是。它只是文件 SHA-512 完整性校验文件；字符签名是写在 CSV 内的一句话 |
| 如何校验 CSV 未被篡改？ | 用 `sha512sum` 计算 CSV 哈希，与 FV.txt 的 `File Hash` 比对 |
| 库里有外键吗？ | 没有。全部是逻辑关联，删除/改名前需自行检查引用 |

---

## 附录：SQL 速查

```sql
-- 列出所有会话
SELECT ID, LoggerFileName, SpecialID, StartTime, EndTime, SampleRate, ChannelCount
FROM FileInformationTable ORDER BY StartTimeStamp;

-- 列出所有会话动态表
SELECT name FROM sqlite_master WHERE type='table'
  AND (name LIKE 'ChannelHeader_%' OR name LIKE 'ChannelData_%');

-- 查看某会话通道定义
SELECT Item, ChannelDescription, Unit, Resolution, Average, Max, Min
FROM ChannelHeader_<id> ORDER BY Item;

-- 查看某会话数据统计范围
SELECT COUNT(*) AS samples,
       datetime(MIN(TimeStamp)/1000, 'unixepoch') AS first_utc,
       datetime(MAX(TimeStamp)/1000, 'unixepoch') AS last_utc
FROM ChannelData_<id>;

-- 查看导出任务与校验值
SELECT id, file_name, file_path, file_hash, hash_algorithm, is_signed, status
FROM export_tasks ORDER BY start_time DESC;

-- 当前数据库版本
SELECT Version FROM VersionControl;
```

> **说明：** 附录中的 `<id>` 需替换为从 SpecialID JSON 推导出的实际会话标识（仅保留字母、数字、下划线，必要时带 `_mea_point` 后缀）。
