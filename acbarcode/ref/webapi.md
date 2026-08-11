Generates printable labels as a downloadable Print file.

Endpoint
POST https://acbarcode.suto-portal.com/st_label

Request
Content-Type: application/json

{
  "product": "S 695 4120",
  "serial_numbers": ["2122 3322", "1234 5678"],
  "options": ["A1007", "A1003"]
}
Parameters
Field	Type	Required	Description
product	string	Yes	Product name or code
serial_numbers	array of strings	Yes	Serial numbers; one label per number
options	array of strings	No	Additional options / attributes for the labels
Response
On success, the API returns a EZPX file containing the generated labels, ready for download and printing.

Example (cURL)
curl -X POST https://acbarcode.suto-portal.com/st_label -H "Content-Type: application/json" -d '{"product": "S 695 4120", "serial_numbers": ["2122 3322", "1234 5678"], "options": ["A1007", "A1003"]}' -o label_all.ezpx