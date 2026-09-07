# SOP — Label Template Design 标签模板设计

> Standard Operating Procedure for designing, managing, and maintaining SUTO label
> templates in the https://acbarcode.suto-portal.com web application.
>
> 本程序（SOP）用于说明如何在 https://acbarcode.suto-portal.com 网页应用中设计、管理和维护 SUTO 产品标签模板。
>

---

## 0. Purpose & Scope / 目的与范围

This procedure explains how to design product label templates using the built-in **ST Template Designer**:

- Where templates are managed (Template Manager / template list).
- The basic design elements (text, table, line, image, barcode, QR code, folder).
- How to control each element's position, size, rotation, and ordering.
- How to switch between English (EN) and Chinese (CN) layouts.
- How to preview and export the final label.

本程序说明了如何使用内置的 **ST 标签设计器** 设计产品标签模板：

- 模板的存放位置（模板管理器 / 模板列表）。
- 基础设计元素（文本、表格、线条、图片、条码、二维码、文件夹）。
- 如何控制每个元素的位置、大小、旋转角度和图层顺序。
- 如何在英文（EN）和中文（CN）版式之间切换。
- 如何预览并导出最终的标签。

---

## 1. Roles & Access / 角色与权限

Only the **admin** role sees the **Template Manager** and the **Designer**.

只有 **管理员** 角色可以看到 **模板管理器** 和 **设计器**。


| Role | Can design templates? | Notes |
|------|------|-------|
| User | No | Generate / print labels only. |
| Admin | Yes | Full access to Template Manager + Designer. |


| 角色 | 能否设计模板 | 说明 |
|------|------|-------|
| 用户 | 否 | 仅生成/打印标签。 |
| 管理员 | 是 | 拥有模板管理器和设计器的完整权限。 |

---

## 2. Template List / 模板列表

Open the **Template Manager**. The left pane shows the list of all templates.

打开 **模板管理器**，左侧面板会显示所有模板的列表。

[P1: template list / 模板列表]
<img src="/api/images/525ee78d.jpg" width="600" alt="p1.jpg" />

Each entry shows:

- **Name** — template name.
- **Item Numbers / SKUs** — which product item numbers map to this template.
- **Size & DPI** — e.g. `35×22mm · 300dpi`.
- **Sub count** — number of sub-templates (e.g. `● 1 sub`).
- **Special tag** — pinned system templates (Delivery Template) that cannot be deleted.

每一项显示以下信息：

- **名称** — 模板名称。
- **物料号 / SKU** — 与该模板匹配的产品物料号。
- **尺寸与 DPI** — 例如 `35×22mm · 300dpi`。
- **子模板数量** — 子模板的数量（例如 `● 1 sub`）。
- **特殊标记** — 固定的系统模板（如发货模板），不可删除。

### 2.1 Search templates / 搜索模板

Use the search box at the top of the list to filter by name or item number.

使用列表顶部的搜索框，可按模板名称或物料号进行筛选。

### 2.2 Create a new template / 新建模板

Click **＋ New** (top of the edit pane) to add an empty template. It is created with the default EN/CN element layout and the default `35×22mm @300dpi` canvas.

点击编辑面板顶部的 **＋ New** 新建空模板，系统会自动为其创建默认的 EN/CN 元素布局和默认 `35×22mm @300dpi` 的画布。

### 2.3 Duplicate / Delete / 复制 / 删除

- **📋 Duplicate** — copies the current template (including sub-templates). The copy is always a normal (editable) template.
- **🗑️ Delete** — removes the current template. The system **Special / Delivery** template cannot be deleted, and at least one template must always remain.

- **📋 复制** — 复制当前模板（包括子模板），副本始终是普通（可编辑）模板。
- **🗑️ 删除** — 删除当前模板。系统的 **特殊 / 发货** 模板不可删除，且系统中必须始终保留至少一个模板。

### 2.4 Edit template properties / 编辑模板属性

Select a template in the list, then edit its properties in the right pane:

在列表中选中一个模板，然后在右侧面板编辑其属性：

- **Template Name** — displayed in the designer and on exports.
- **Item Numbers / SKUs** — comma-separated list used for auto-matching.
- **Device Name** — used by the SUTO Protocol QR code (`{{device_name}}`).
- **Label Size & DPI** — `width × height` in mm and 203 / 300 / 600 DPI.
- **Note** — purpose / usage hint, shown in the designer's "Template basic infos".

- **模板名称** — 显示在设计器和导出文件中。
- **物料号 / SKU** — 以逗号分隔的列表，用于自动匹配。
- **设备名称** — 用于 SUTO 协议二维码（`{{device_name}}`）。
- **标签尺寸与 DPI** — 宽 × 高（毫米）以及 203 / 300 / 600 DPI。
- **备注** — 用途 / 使用提示，显示在设计器的“模板基本信息”中。

### 2.5 Sub-templates / 子模板

A template may contain one or more **sub-templates** (extra label designs for the same product, e.g. a smaller 22×22mm variant). Manage them in the **Sub-Templates** card:

- **＋ Add Sub-Template** — create a new empty sub-template.
- Edit its **name**, **note**, and **size / DPI**.
- Remove with **✕**.

The sub-template appears as an option in the designer's **Label:** dropdown.

一个模板可以包含一个或多个 **子模板**（同一产品的其他标签设计，例如更小的 22×22mm 变体），在 **子模板（Sub-Templates）** 卡片中管理：

- **＋ 添加子模板** — 创建一个新的空子模板。
- 编辑其 **名称**、**备注** 和 **尺寸 / DPI**。
- 使用 **✕** 移除。

子模板会出现在设计器的 **Label（标签）：** 下拉框中供选择。

---

## 3. Opening the Designer / 打开设计器

Select a template (or sub-template) and click **Open in Designer →**, or use the **← Templates** button to return. The designer is divided into:

选中一个模板（或子模板）并点击 **在设计中打开 →（Open in Designer →）**，或使用 **← 模板（Templates）** 按钮返回。设计器分为以下几个区域：


| Area | Purpose |
|------|---------|
| Top bar | Serial range, options, product, template / label selector. |
| Left panel | **🎨 Elements** — the layer tree of all elements. |
| Right panel | Template basic infos + **👁️ Live Canvas Preview** + export toolbar. |


| 区域 | 用途 |
|------|---------|
| 顶部工具栏 | 序列号范围、选项、产品、模板/标签选择。 |
| 左侧面板 | **🎨 元素** — 所有元素的图层树。 |
| 右侧面板 | 模板基本信息 + **👁️ 实时画布预览** + 导出工具栏。 |

[P2: designer overview / 设计器总览]
<img src="/api/images/90fa2be8.jpg" width="600" alt="p2.jpg" />

---

## 4. Basic Design Elements / 基础设计元素

The **🎨 Elements** panel lists every element of the current label. Click **＋ Folder / Text / Table / Image / Line / Barcode / QR Code** to add elements. Elements can be grouped inside **folders** (logical containers that do not print).

**🎨 元素** 面板列出了当前标签的所有元素。点击 **＋ 文件夹 / 文本 / 表格 / 图片 / 线条 / 条码 / 二维码** 即可添加元素。元素可以分组到 **文件夹** 中（文件夹只是逻辑容器，不会被打印）。

[P3: elements panel with add buttons / 元素面板及添加按钮]
<img src="/api/images/b9b1d2e2.jpg" width="600" alt="p3.jpg" />

| Element | Type | What it does |
|---------|------|--------------|
| 📁 Folder | `folder` | Groups elements for organisation. Not printed. |
| 📝 Text | `text` | Static or variable text. |
| ▦ Table | `table` | A grid of rows/columns drawn as lines. |
| 🖼️ Image | `image` | Logo / picture (uploaded file). |
| ― Line | `hline` / `vline` | Horizontal or vertical separator line. |
| ▮ Barcode | `barcode` | CODE128 barcode (e.g. serial number). |
| ◼ QR Code | `qrcode` | Standard QR or SUTO Sensor Protocol QR. |


| 元素 | 类型 | 作用 |
|---------|------|--------------|
| 📁 文件夹 | `folder` | 对元素进行分组管理，不参与打印。 |
| 📝 文本 | `text` | 静态或可变文本。 |
| ▦ 表格 | `table` | 由横竖线条构成的网格。 |
| 🖼️ 图片 | `image` | 徽标 / 图片（上传的文件）。 |
| ― 线条 | `hline` / `vline` | 水平或垂直分隔线。 |
| ▮ 条码 | `barcode` | CODE128 条码（例如序列号）。 |
| ◼ 二维码 | `qrcode` | 标准二维码或 SUTO 传感器协议二维码。 |

### 4.1 Text / 文本

[P4: text element settings / 文本元素设置]
<img src="/api/images/29b75447.jpg" width="600" alt="p4.jpg" />

- **Text** — content; supports placeholders like `{{serial}}`, `{{product}}`, `{{device_name}}`, `{{options}}`.
- **Text Type** — three modes:
  - **📝 Normal Text** — plain text with placeholders.
  - **🔀 Option Code** — translate option codes (e.g. `A1410`) into display text via rules (`code → text`, supports wildcards like `A13X2`).
  - **📦 Product Type** — map product / item numbers to a display text.
- **Position** — `X mm`, `End X mm`, `Y mm`.
- **Font** — `Size pt` (2–36) and **Bold**.
- **Rotation** — see [5.3 Rotation](#53-rotation).

- **文本** — 内容；支持占位符，如 `{{serial}}`、`{{product}}`、`{{device_name}}`、`{{options}}`。
- **文本类型** — 三种模式：
  - **📝 普通文本** — 含占位符的纯文本。
  - **🔀 选项代码** — 通过规则（`代码 → 文本`，支持 `A13X2` 等通配符）将选项代码（例如 `A1410`）转换为显示文本。
  - **📦 产品类型** — 将产品 / 物料号映射为显示文本。
- **位置** — `X mm`、`End X mm`、`Y mm`。
- **字体** — `Size pt`（2–36）和 **加粗（Bold）**。
- **旋转** — 见 [5.3 旋转](#53-旋转)。

### 4.2 Table / 表格

[P5: table element settings / 表格元素设置]
<img src="/api/images/d786b8eb.jpg" width="600" alt="p5.jpg" />

- **Position & Size** — `X mm`, `Y mm`, `Width mm`, `Height mm`.
- **Grid** — number of **Columns** and **Rows** (1–20), and **Line Width (dots)**.
- **Custom spacing (optional)** — comma-separated column widths or row heights in mm.
- **✂️ Unpack Table to Lines** — converts the table into a folder of individual `hline` / `vline` elements for fine-grained editing.

- **位置与尺寸** — `X mm`、`Y mm`、`Width mm`、`Height mm`。
- **网格** — **列数** 和 **行数**（1–20），以及 **线条宽度（单位：点）**。
- **自定义间距（可选）** — 以逗号分隔的列宽或行高（毫米）。
- **✂️ 将表格拆解为线条** — 将表格转换为包含多个 `hline` / `vline` 元素的文件夹，以便进行精细编辑。

### 4.3 Line / 线条

[P6: line element settings / 线条元素设置]
<img src="/api/images/c2d5bd5b.jpg" width="500" alt="p6.jpg" />

- **Shape** — **Horizontal** or **Vertical**.
- **Position** — start `X mm` / `Y mm` and end point (`End X` for horizontal, `End Y` for vertical).
- **Thick** — line thickness in dots (1–30).

- **形状** — **水平** 或 **垂直**。
- **位置** — 起点 `X mm` / `Y mm` 和终点（水平线为 `End X`，垂直线为 `End Y`）。
- **粗细** — 线条粗细，单位为点（1–30）。

### 4.4 Image / 图片

[P7: image element settings / 图片元素设置]
<img src="/api/images/1f30b93b.jpg" width="600" alt="p7.jpg" />

- **Image** — upload a file (PNG/JPG); a thumbnail preview is shown.
- **Position & Size** — `X mm`, `Y mm`, `W mm`.
- **Stored** — stored image name used on the printer (e.g. `LOGO`).
- **Align Bottom-Right** — automatically anchors the image to the bottom-right corner of the label (position inputs are disabled).

- **图片** — 上传文件（PNG/JPG），会显示缩略图预览。
- **位置与尺寸** — `X mm`、`Y mm`、`W mm`。
- **存储名** — 打印机使用的图片存储名称（例如 `LOGO`）。
- **右下角对齐** — 自动将图片固定到标签右下角（此时位置输入框不可用）。

### 4.5 Barcode / 条码

[P8: barcode element settings / 条码元素设置]

<img src="/api/images/78b3bb81.jpg" width="600" alt="p8.jpg" />

- **Barcode Data** — content; typically `{{serial}}`.
- **Position & Size** — `X mm`, `Y mm`, `W mm`, `H mm`.
- **Text** — show/hide the human-readable number below the bars, plus **Bold** and **Font pt**.
- **Border** — draw a frame around the barcode.

- **条码数据** — 内容；通常为 `{{serial}}`。
- **位置与尺寸** — `X mm`、`Y mm`、`W mm`、`H mm`。
- **文本** — 显示/隐藏条码下方的可读数字，并可设置 **加粗（Bold）** 和 **字号（Font pt）**。
- **边框** — 在条码周围绘制外框。

### 4.6 QR Code / 二维码

[P9: qrcode element settings / 二维码元素设置]
<img src="/api/images/af852c5d.jpg" width="600" alt="p9.jpg" />

Two **QR Mode** options:

- **📝 Standard QR** — free data / URL, supports placeholders.
- **🔒 SUTO Protocol** — generates a signed sensor-license QR:
  - **Device / Product Name** — e.g. `{{device_name}}`.
  - **QR Prefix** — e.g. `sensor`.
  - Format: `/sensor/{device}/{serial}/{md5_hash}` (MD5 salt: `this_is_sensor_salt`).
- **Position** — `X mm`, `Y mm`.
- **Size** — module multiplier `mul` (1–20).

两种 **二维码模式（QR Mode）**：

- **📝 标准二维码** — 自定义数据 / URL，支持占位符。
- **🔒 SUTO 协议** — 生成带签名的传感器授权二维码：
  - **设备 / 产品名称** — 例如 `{{device_name}}`。
  - **二维码前缀** — 例如 `sensor`。
  - 格式：`/sensor/{设备}/{序列号}/{md5_hash}`（MD5 加盐值：`this_is_sensor_salt`）。
- **位置** — `X mm`、`Y mm`。
- **尺寸** — 模块倍数 `mul`（1–20）。

---

## 5. Controlling Position, Rotation & Ordering / 控制位置、旋转与顺序

### 5.1 Position / 位置

Every element has millimetre-accurate **X** / **Y** coordinates relative to the top-left corner of the label canvas. Open an element to edit its position, size, and type-specific properties.

每个元素都有以标签画布左上角为原点的、精确到毫米的 **X** / **Y** 坐标。展开元素即可编辑其位置、尺寸及类型相关属性。

### 5.2 Layer order (z-order) / 图层顺序（z 轴顺序）

Each row in the element tree has ▲ / ▼ buttons to move the element **up or down** within its folder (or at root). Elements drawn later appear on top. Folders can also be reordered as a whole.

元素树中的每一行都有 ▲ / ▼ 按钮，用于在文件夹内（或根目录下）将元素 **上移 / 下移**。后绘制的元素会显示在上方。文件夹也可以整体调整顺序。

### 5.3 Rotation / 旋转

Two ways to rotate an element by 90° steps:

- The 🔄 button on the element row (rotates 90° clockwise).
- Inside the element form, the **Rotation** row with preset buttons `0° / 90° / 180° / 270°` and a **🔄 +90°** button.

The current rotation angle is shown as a badge on the element row.

旋转元素的方式有两种，均按 90° 步进：

- 元素行上的 🔄 按钮（顺时针旋转 90°）。
- 在元素表单中，**旋转（Rotation）** 行提供预设按钮 `0° / 90° / 180° / 270°` 以及 **🔄 +90°** 按钮。

当前旋转角度会以角标的形式显示在元素行上。

### 5.4 Duplicate & delete / 复制与删除

- **📋 Duplicate** — copies the element (X/Y offset by +1mm).
- **✕ Delete** — removes the element (with confirmation).
- Deleting a **folder** keeps its children; they are moved back to the root.

- **📋 复制** — 复制元素（X/Y 坐标偏移 +1mm）。
- **✕ 删除** — 删除元素（需确认）。
- 删除 **文件夹** 时，其子元素会保留，并被移回根目录。

---

## 6. EN / CN Layouts / 中英文版式

Each label has two independent layouts: **EN** and **CN**. Use the **🇬🇧 EN / 🇨🇳 CN** toggle in "Template basic infos" to switch which layout is being edited. When the CN tab is active, the **📋 Copy from EN** button clones the current EN layout into the CN layout (after confirmation).

每个标签都有两个相互独立的版式：**EN（英文）** 和 **CN（中文）**。在“模板基本信息”中使用 **🇬🇧 EN / 🇨🇳 CN** 切换按钮，选择正在编辑的版式。当 CN 页签激活时，**📋 从英文复制（Copy from EN）** 按钮可将当前英文版式克隆到中文版式（需确认）。

[P10: EN/CN toggle / 中英文切换]
<img src="/api/images/4a0bc161.jpg" width="550" alt="p10.jpg" />

---

## 7. Live Preview & Exports / 实时预览与导出

### 7.1 Preview / 预览

[P11: live canvas preview / 实时画布预览]
<img src="/api/images/54ac3064.jpg" width="550" alt="p11.jpg" />

- Enter a **SN** (serial start), optional **End**, **Opt** (option codes), and **Prod** (product) in the top bar.
- The **Live Canvas Preview** re-renders the label in real time.
- When a serial range exists, use ◀ / ▶ to page through each label.
- **Shift + Download PDF** produces an option-scenario verification matrix.

- 在顶部工具栏输入 **SN**（序列号起始值）、可选的 **End**（结束值）、**Opt**（选项代码）和 **Prod**（产品）。
- **实时画布预览** 会实时重新渲染标签。
- 存在序列号范围时，可使用 ◀ / ▶ 逐个翻页查看每张标签。
- 按住 **Shift 键并点击下载 PDF**，可生成选项场景验证矩阵。

### 7.2 Export / 导出

[P12: export toolbar / 导出工具栏]
<img src="/api/images/34e1ae03.jpg" width="550" alt="p12.jpg" />

| Action | Output |
|--------|--------|
| **Export → .ezpx Package** | GoLabel batch ZIP (`.ezpx` + `data.csv` + start script). |
| **Export → .ezpl Print File** | Graphic EZPL stream for GoDEX printers. |
| **Export → .json Template** | Full template design as JSON (for backup/sharing). |
| **📥 Import JSON** | Load a template design from JSON into the current label. |
| **📄 Download PDF** | Multi-page PDF of all labels in the serial range. |


| 操作 | 输出 |
|--------|--------|
| **导出 → .ezpx 包** | GoLabel 批量 ZIP 包（`.ezpx` + `data.csv` + 启动脚本）。 |
| **导出 → .ezpl 打印文件** | 面向 GoDEX 打印机的图形 EZPL 指令流。 |
| **导出 → .json 模板** | 完整的模板设计 JSON（用于备份/共享）。 |
| **📥 导入 JSON** | 将 JSON 模板设计导入当前标签。 |
| **📄 下载 PDF** | 序列号范围内所有标签的多页 PDF。 |

---

## 8. Do's & Don'ts / 注意事项

- Keep all elements within the label width/height (in mm).
- Use `{{serial}}`/`{{product}}` placeholders instead of hard-coding variable data.
- Upload logos/images and reference them by **Stored** name for printer compatibility.
- Prefer the SUTO Protocol QR mode for anti-counterfeit serial verification.
- The **Special / Delivery** template is protected — duplicate it before editing.
- After editing, always check the **Live Canvas Preview** for layout overflow before exporting.

- 所有元素应保持在标签的宽/高（毫米）范围内。
- 尽量使用 `{{serial}}`/`{{product}}` 占位符，不要硬编码可变数据。
- **特殊 / 发货** 模板受保护——不能删除。
- 编辑完成后，导出前务必检查 **实时画布预览**，确认没有布局溢出。

---

## Appendix A — Placeholders / 占位符


| Placeholder | Replaced with |
|-------------|---------------|
| `{{serial}}` | Current serial number. |
| `{{product}}` | Selected product / item number. |
| `{{device_name}}` | Template's Device Name. |
| `{{options}}` | Active option codes joined by ", ". |
| `{{categ}}` | Category / device name. |
| `{{order_id}}` / `{{origin}}` | Order / delivery reference (when provided). |


| 占位符 | 替换为 |
|-------------|---------------|
| `{{serial}}` | 当前序列号。 |
| `{{product}}` | 选中的产品 / 物料号。 |
| `{{device_name}}` | 模板的设备名称。 |
| `{{options}}` | 当前选中的选项代码，以", "连接。 |
| `{{categ}}` | 类别 / 设备名称。 |
| `{{order_id}}` / `{{origin}}` | 订单 / 发货单号（当提供时）。 |

---
