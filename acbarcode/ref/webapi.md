Generates printable labels as either a downloadable GoLabel ZIP package or structured JSON containing EZPL print streams for Odoo direct printing.

## Endpoints
* **Standard Label**: `POST https://acbarcode.suto-portal.com/st_label` (or `/api/st_label`)
  * Matches template automatically by product Item Number.
* **Delivery Label**: `POST https://acbarcode.suto-portal.com/st_label_delivery` (or `/api/st_label_delivery`)
  * Directly uses the special **Delivery Template**, regardless of product Item Number.

---

## 1. Request Parameters

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `product` | string | **Yes** | Product item number / code (e.g. `"S695 4035"`) |
| `serial_numbers` | array of strings | **Yes** | Array of serial number strings (e.g. `["12345678", "12345679"]`) |
| `lang` | string | No | Language for template elements: `"cn"` (Chinese) or `"en"` (English). Defaults to `"en"` |
| `options` | array of strings | No | Optional variant codes (e.g. `["A1410", "A1404"]`) |
| `preview` | boolean | No | Include PNG preview image (`data:image/png;base64,...`) per item. Defaults to `true` |
| `format` | string | No | Response format: `"json"` (default, JSON wrapping EZPL for direct printing) or `"zip"` (GoLabel ZIP package) |
| `template_xml` | string | No | Custom EZPX XML template override |

---

## 2. JSON Response Mode (`format: "json"`)

Designed for **Odoo / automated print agents**. Returns the compiled EZPL commands and visual preview images grouped by template type (Main label and Sub-templates).

### Request Example (JSON Mode)
```bash
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d '{
    "product": "S695 4035",
    "serial_numbers": ["12345678", "12345679"],
    "options": ["A1410"],
    "format": "json",
    "preview": true
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
      "all_ezpl_base64": "XlEyMiwzCl5XMzUK...",
      "all_ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n^Q22,3\n...",
      "items": [
        {
          "serial": "12345678",
          "preview_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "ezpl_base64": "XlEyMiwzCl5XMzUK...",
          "ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n"
        },
        {
          "serial": "12345679",
          "preview_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "ezpl_base64": "XlEyMiwzCl5XMzUK...",
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

## 3. Delivery Template API (`POST /st_label_delivery`)

Designed for **Odoo Delivery / Picking Orders**. Always uses the special **Delivery Template** regardless of product code, and supports multi-product batches where `origin` (e.g. Sales Order / Picking number) is shared across all labels while `categ`, `product`, `options_text`, and `serial_numbers` vary per line item.

### Request Example (Multi-Product Delivery Batch)
```bash
curl -X POST https://acbarcode.suto-portal.com/st_label_delivery \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "CH-SO-2608-25623",
    "lang": "cn",
    "products": [
      {
        "categ": "S401",
        "product": "S695 4100",
        "serial_numbers": [
          "3025 0001",
          "3025 0002",
          "3025 0003"
        ],
        "options_text": "1-1.6,A1007,A1008"
      },
      {
        "categ": "SXXX",
        "product": "Model-B",
        "serial_numbers": [
          "SN-101",
          "SN-102"
        ],
        "options_text": "2-2.6,A1101,A1102"
      }
    ]
  }'
```

### JSON Response Structure
```json
{
  "origin": "CH-SO-2608-25623",
  "lang": "cn",
  "total_products": 2,
  "total_labels": 5,
  "templates": [
    {
      "id": "main",
      "name": "Delivery Template",
      "type": "main",
      "config": { "widthMm": 35, "heightMm": 22, "dpi": 300 },
      "total_labels": 5,
      "all_ezpl": "^Q22,3\n^W35\n...\nE\n^Q22,3\n...",
      "items": [
        {
          "origin": "CH-SO-2608-25623",
          "categ": "S401",
          "product": "S695 4100",
          "serial": "3025 0001",
          "options": "1-1.6,A1007,A1008",
          "preview_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "ezpl_base64": "XlEyMiwz...",
          "ezpl": "^Q22,3\n^W35\n^H10\n^S4\n^L\n...\nE\n"
        },
        {
          "origin": "CH-SO-2608-25623",
          "categ": "S401",
          "product": "S695 4100",
          "serial": "3025 0002",
          "options": "1-1.6,A1007,A1008",
          "preview_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          "ezpl_base64": "XlEyMiwz...",
          "ezpl": "^Q22,3\n...\n"
        }
      ]
    }
  ]
}
```

### Supported Dynamic Placeholders in Delivery Templates:
* `{{origin}}` / `{{order}}`: Shared origin / delivery order number (e.g. `CH-SO-2608-25623`)
* `{{categ}}` / `{{device_name}}`: Product category / model title (e.g. `S401`)
* `{{product}}` / `{{item_no}}`: Product item number (e.g. `S695 4100`)
* `{{serial}}` / `{{sn}}`: Individual serial number (e.g. `3025 0001`)
* `{{options}}`: Option code list / options string (and translated by element option mappings)

---

## 4. ZIP / GoLabel Batch Mode (Optional)

When `format: "zip"` is explicitly provided, the standard endpoint returns `label_all.zip` containing `.ezpx` template files, `data.csv`, and `0_start.bat` for GoLabel on Windows.