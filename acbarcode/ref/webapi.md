Generates printable labels as either a downloadable GoLabel ZIP package or structured JSON containing EZPL print streams for Odoo direct printing.

## Endpoint
`POST https://acbarcode.suto-portal.com/st_label` (or `/api/st_label`)

---

## 1. Request Parameters

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `product` | string | **Yes** | Product item number / code (e.g. `"S695 4035"`) |
| `serial_numbers` | array of strings | **Yes** | Array of serial number strings (e.g. `["12345678", "12345679"]`) |
| `options` | array of strings | No | Optional variant codes (e.g. `["A1410", "A1404"]`) |
| `format` | string | No | `"json"` for direct EZPL streams (Odoo mode), or `"zip"` (default) |
| `template_xml` | string | No | Custom EZPX XML template override |

---

## 2. JSON Response Mode (`format: "json"`)

Designed for **Odoo / automated print agents**. Returns the compiled EZPL commands grouped by template type (Main label and Sub-templates).

### Request Example (JSON Mode)
```bash
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d '{
    "product": "S695 4035",
    "serial_numbers": ["12345678", "12345679"],
    "options": ["A1410"],
    "format": "json"
  }'
```

### JSON Response Structure
```json
{
  "product": "S695 4035",
  "options": "A1410",
  "device_name": "S403",
  "total_serials": 2,
  "templates": [
    {
      "id": "main",
      "name": "Standard Flow Sensor",
      "type": "main",
      "config": { "widthMm": 35, "heightMm": 22, "dpi": 300 },
      "total_labels": 2,
      "all_ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n^Q22,3\n...",
      "items": [
        {
          "serial": "12345678",
          "ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n"
        },
        {
          "serial": "12345679",
          "ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n"
        }
      ]
    },
    {
      "id": "sub_1",
      "name": "Cable Sub-Label",
      "type": "sub",
      "config": { "widthMm": 22, "heightMm": 22, "dpi": 300 },
      "total_labels": 2,
      "all_ezpl": "^Q22,3\n...",
      "items": [
        { "serial": "12345678", "ezpl": "..." },
        { "serial": "12345679", "ezpl": "..." }
      ]
    }
  ]
}
```

* **`all_ezpl`**: Complete concatenated EZPL stream for 1-click **"Print All"** in Odoo.
* **`items[].ezpl`**: Individual EZPL streams per serial number for **"Print Selected" / "Reprint"** in Odoo.

---

## 3. ZIP / GoLabel Batch Mode (Default)

When `format` is omitted or set to `"zip"`, the API returns `label_all.zip` containing `.ezpx` template files, `data.csv`, and `0_start.bat` for GoLabel on Windows.