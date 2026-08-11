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
On success, the API returns a EZPX file containing the generated labels, ready for download and printing.

Examples (cURL)

1. Default Template:
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d '{"product": "S 695 4120", "serial_numbers": ["2122 3322", "1234 5678"], "options": ["A1007", "A1003"]}' \
  -o label_all.ezpx

2. Custom EZPX XML Template Content (JSON string or raw file read):
curl -X POST https://acbarcode.suto-portal.com/st_label \
  -H "Content-Type: application/json" \
  -d "{\"product\": \"S 695 4120\", \"serial_numbers\": [\"1234 5678\", \"1234 5679\"], \"template_xml\": \"$(cat ref/label_1234_5678_to_1234_5679.ezpx | tr '\n' ' ' | sed 's/"/\\"/g')\"}" \
  -o label_all.ezpx