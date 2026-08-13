Generates printable labels as a downloadable Print file.

Endpoint
POST https://acbarcode.suto-portal.com/st_label

Request
Content-Type: application/json

{
  "product": "S 695 4120",
  "serial_numbers": ["2122 3322", "1234 5678"],
  "options": ["A1007", "A1003"],
  "template_xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>..."
}

Parameters
Field	Type	Required	Description
product	string	Yes	Product name or code
serial_numbers	array of strings	Yes	Serial numbers; one label per number
options	array of strings	No	Additional options / attributes for the labels
template_xml	string	No	EZPX XML template text content (if omitted, uses default template)

Response
On success, the API returns a ZIP package (`label_all.zip`) containing:

- `label_all.ezpx` — the GoLabel label file. It is configured as a CSV database print job:
  - `<DataBaseFormat>Text_CommaDelimited</DataBaseFormat>`
  - `<DataBaseFilePath>data.csv</DataBaseFilePath>` (relative — run `print_labels.bat` to rewrite it to the absolute path)
  - `<DataBaseSelection>SELECT  * from `data#csv` ;</DataBaseSelection>`
  - serial fields use `^F00` (database field reference), one label printed per CSV row.
- `data.csv` — header row `sn`, one serial number per line (the `serial_numbers` from the request).
- `print_labels.bat` — Windows helper: finds GoLabel.exe, rewrites `<DataBaseFilePath>` to the absolute `data.csv` path, creates `schema.ini` if missing, and launches GoLabel with the label open.

Workflow: download `label_all.zip` → extract to a folder → run `print_labels.bat` → GoLabel opens the label with the CSV connected, print all labels in one run.

Examples (cURL)

1. Default Template:
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d '{"product": "S 695 4120", "serial_numbers": ["2122 3322", "1234 5678"], "options": ["A1007", "A1003"]}' \
  -o label_all.zip

2. Custom EZPX XML Template Content (JSON string or raw file read):
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d "{\"product\": \"S 695 4120\", \"serial_numbers\": [\"1234 5678\", \"1234 5679\"], \"template_xml\": \"$(cat ref/label_1234_5678_to_1234_5679.ezpx | tr '\n' ' ' | sed 's/"/\\"/g')\"}" \
  -o label_all.zip