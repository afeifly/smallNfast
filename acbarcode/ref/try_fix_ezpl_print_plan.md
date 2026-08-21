# EZPL Graphic Print Plan
## Fixing "File not found" on GoDEX Printer

---

## The Core Problem

When the printer prints "File not found", the flow is:

```
Server → JSON (base64) → Client → QZ Tray → Printer
                                              ↑
                         ~EB stores BMP here ─┘ ← This step FAILS silently
                              ^L
                              Y0,0,LBL0         ← Printer looks up LBL0 → NOT FOUND
```

The `~EB` download failed silently. There are **two reasons** this can happen:

### Reason 1 — Memory Region Mismatch (Firmware Bug / Version Difference)
- GoDEX firmware stores downloaded graphics to **DRAM (`R:` drive)** by default
- But in some firmware versions, `Y0,0,LBL0` looks up **Flash (`F:` drive)** by default
- So the BMP is downloaded to `R:LBL0` but recalled from `F:LBL0` → **File not found**
- **Fix:** Explicitly prefix all references with `R:` → `~MDELG,R:LBL0`, `~EB,R:LBL0,...`, `Y0,0,R:LBL0`

### Reason 2 — Binary Corruption During Transmission
- The BMP inside `~EB` is raw binary (bytes 0x00–0xFF), NOT text
- If it gets encoded as UTF-8 text at any point, bytes > 0x7F become 2-byte sequences
- The byte count changes → printer receives wrong number of bytes → download aborts
- **Fix:** Always transmit as Base64 in JSON, decode to raw bytes on client before sending to printer

Both problems are present. The plan below fixes **both**.

---

## Solution A: `R:` DRAM Prefix + Correct Binary Transmission (Recommended)

---

### Why `R:` Is Needed

| Without `R:` | With `R:` |
|---|---|
| `~MDELG,LBL0` | `~MDELG,R:LBL0` |
| `~EB,LBL0,108398` | `~EB,R:LBL0,108398` |
| `Y0,0,LBL0` | `Y0,0,R:LBL0` |

The `R:` explicitly tells the printer: *"Store this in DRAM, and when printing recall it from DRAM."*  
Without it, firmware ambiguity causes the recall to look in the wrong storage partition.

---

### Server Changes (Small)

**Files to modify:**
- [`server/serverGraphicCompiler.js`](file:///Users/ex/project/smallNfast/acbarcode/server/serverGraphicCompiler.js) — server-side EZPL generator
- [`src/utils/stEzplGraphicCompiler.js`](file:///Users/ex/project/smallNfast/acbarcode/src/utils/stEzplGraphicCompiler.js) — client-side EZPL generator

**Change in `compileCanvasToGraphicBuffer()`:**

```diff
- const headerText =
-   `~MDELG,${name}\r\n` +
-   `~EB,${name},${bmpBytes.length}\r\n`;
-
- const footerText =
-   `...
-   Y0,0,${name}\r\n
-   E\r\n`;

+ const ramName = `R:${name}`;   // ← only this line added
+ const headerText =
+   `~MDELG,${ramName}\r\n` +
+   `~EB,${ramName},${bmpBytes.length}\r\n`;
+
+ const footerText =
+   `...
+   Y0,0,${ramName}\r\n
+   E\r\n`;
```

That is the **only code change**. The JSON API response format stays exactly the same.

**Server API response stays unchanged:**
```json
{
  "items": [{ 
    "serial": "3726 0001",
    "ezpl_base64": "fk1ERUxHLFI6TEJMM..."
  }],
  "all_ezpl_base64": "fk1ERUxHLFI6TEJMM..."
}
```

---

### Client Changes (How to Print Correctly)

The client must decode Base64 and send **raw binary** to the printer. Never print the Base64 string as text.

#### Option 1: QZ Tray (browser → USB/Network printer)

```js
// Step 1: Call server API
const res = await fetch('/api/st_label', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serials: ['3726 0001'] })
});
const data = await res.json();

// Step 2: Get base64 from JSON
const base64 = data.all_ezpl_base64;

// Step 3: Send to printer via QZ Tray — use format:'base64', NOT format:'plain'
const config = qz.configs.create('GODEX_PRINTER_NAME');
await qz.print(config, [{
  type: 'raw',
  format: 'base64',   // ← QZ decodes this to bytes internally, sends binary correctly
  data: base64
}]);
```

> ⚠️ **NEVER do this** — it corrupts binary:
> ```js
> // WRONG — atob() → string → QZ as text → UTF-8 corrupts binary bytes > 0x7F
> data: atob(base64)
> ```

#### Option 2: Node.js / Electron (write to USB or TCP socket)

```js
const buf = Buffer.from(base64, 'base64');  // ← correct binary
const net = require('net');
const socket = new net.Socket();
socket.connect(9100, '192.168.1.100', () => {
  socket.write(buf);  // ← raw binary bytes to printer port 9100
  socket.destroy();
});
```

#### Option 3: Android / Flutter (from another app)

```dart
final bytes = base64Decode(ezplBase64);     // ← Uint8List binary
await socket.add(bytes);                    // ← send raw to printer IP:9100
```

---

### Benefits of Solution A

| Benefit | Detail |
|---|---|
| ✅ Fixes firmware mismatch | `R:` ensures store and recall use same partition |
| ✅ Fixes binary corruption | Base64 JSON → QZ `format:'base64'` preserves bytes |
| ✅ Zero API change | JSON structure stays same, only internal EZPL bytes change |
| ✅ Tiny code change | 1 line in each compiler file |
| ✅ Works with existing print client | No changes if already using QZ Tray `format:'base64'` |

---

## Solution B: Switch to Native EZPL Commands (Alternative — No Binary BMP)

Instead of rasterizing the whole label to a BMP image, generate pure-text EZPL commands for each element.

### How It Works

```
Text element  → AH command   (native font, crisp)
Barcode       → BA command   (native barcode, scannable)
QR Code       → W command    (native QR, scannable)
Lines         → LE command   (native line)
Logo image    → ~EB once at setup, then Y command every print
```

**Example output (whole label, ~800 bytes vs ~108,000 bytes):**
```
^Q22,3
^W35
^H10
^S4
^L
Y1,1,R:LOGO          ← reuse pre-uploaded logo
AH20,30,1,1,0,0,www.suto-itec.com
AH1,45,1,1,0,0,Model: S403
AH1,65,1,1,0,0,Serial No.: 3726 0001
BA22,80,2,3,60,0,0,1,3726 0001
E
```

### Comparison

| | Solution A (Raster BMP) | Solution B (Native EZPL) |
|---|---|---|
| File size per label | ~108 KB | ~1 KB |
| Transmission time | ~1–3 sec | < 0.1 sec |
| Barcode scan quality | Medium (rasterized) | **Best** (native) |
| Text quality | Medium | **Best** (printer font) |
| Complex graphics (logo, BMP) | ✅ Supported | Partial (logo pre-uploaded) |
| Code change required | Small | Large (full rewrite of compiler) |
| Printer compatibility | Any that supports `~EB` | Any EZPL printer |

### When to Choose Solution B
- If print speed matters (e.g., printing 50+ labels at once)
- If barcode scan reliability is important
- If label is mostly text + barcode + standard logo

---

## Recommended Decision

```
Does the label have complex custom graphics (gradients, background fills, etc.)?
    ├── YES → Use Solution A (fix R: + Base64 binary)
    └── NO  → Use Solution B (native EZPL, much faster, better quality)

For current SUTO-iTEC label (logo + text + barcode):
    → Solution B is ideal long-term
    → Solution A is the quick fix you can do today (2 lines of code)
```

---

## Implementation Priority

| Step | Action | Effort | Impact |
|---|---|---|---|
| 1 | Add `R:` prefix to serverGraphicCompiler.js | 5 min | Fixes firmware mismatch |
| 2 | Add `R:` prefix to stEzplGraphicCompiler.js | 5 min | Fixes client-side too |
| 3 | Verify QZ Tray uses `format:'base64'` | Review | Fixes binary corruption |
| 4 (future) | Migrate to native EZPL compiler | 1–2 days | 100x smaller, better quality |
