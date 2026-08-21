import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import win32print


HOST = "127.0.0.1"
PORT = 8799
PRINTER_NAME = "Godex G530"
ALLOWED_ORIGIN = "https://odoo.suto-itec.com.cn"


def raw_print(ezpl, document_name):
    printer = win32print.OpenPrinter(PRINTER_NAME)

    try:
        job_id = win32print.StartDocPrinter(
            printer,
            1,
            (document_name, None, "RAW"),
        )

        try:
            win32print.StartPagePrinter(printer)

            if isinstance(ezpl, str):
                raw_data = ezpl.encode("latin-1")
            else:
                raw_data = ezpl

            win32print.WritePrinter(printer, raw_data)
            win32print.EndPagePrinter(printer)
        finally:
            win32print.EndDocPrinter(printer)

        return job_id
    finally:
        win32print.ClosePrinter(printer)


class PrintBridgeHandler(BaseHTTPRequestHandler):

    def _cors_headers(self):
        origin = self.headers.get("Origin", "")

        if origin == ALLOWED_ORIGIN:
            self.send_header(
                "Access-Control-Allow-Origin",
                origin,
            )

        self.send_header(
            "Vary",
            "Origin",
        )
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )
        self.send_header(
            "Access-Control-Allow-Private-Network",
            "true",
        )
        self.send_header(
            "Access-Control-Max-Age",
            "600",
        )

    def _send_json(self, status_code, data):
        content = json.dumps(
            data,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status_code)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(content)),
        )
        self._cors_headers()
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self._send_json(
                404,
                {
                    "ok": False,
                    "error": "Not found",
                },
            )
            return

        printers = [
            printer[2]
            for printer in win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL
                | win32print.PRINTER_ENUM_CONNECTIONS
            )
        ]

        self._send_json(
            200,
            {
                "ok": True,
                "service": "zico_barcode_print_bridge",
                "default_printer": PRINTER_NAME,
                "printer_found": PRINTER_NAME in printers,
                "printers": printers,
            },
        )

    def do_POST(self):
        if self.path != "/print":
            self._send_json(
                404,
                {
                    "ok": False,
                    "error": "Not found",
                },
            )
            return

        try:
            content_length = int(
                self.headers.get("Content-Length", "0")
            )
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            ezpl_list = data.get("ezpl_list")

            if not isinstance(ezpl_list, list) or not ezpl_list:
                raise ValueError(
                    "ezpl_list must be a non-empty list"
                )

            job_ids = []

            for index, ezpl in enumerate(ezpl_list, start=1):
                if not isinstance(ezpl, str) or not ezpl.strip():
                    raise ValueError(
                        f"EZPL item {index} is empty"
                    )

                job_id = raw_print(
                    ezpl,
                    f"Odoo ST Label {index}",
                )
                job_ids.append(job_id)

            self._send_json(
                200,
                {
                    "ok": True,
                    "printed": len(job_ids),
                    "printer": PRINTER_NAME,
                    "job_ids": job_ids,
                },
            )

        except Exception as error:
            self._send_json(
                500,
                {
                    "ok": False,
                    "error": str(error),
                },
            )

    def log_message(self, format_string, *args):
        print(
            "%s - %s"
            % (
                self.address_string(),
                format_string % args,
            )
        )


if __name__ == "__main__":
    print(
        f"Print bridge running at "
        f"http://{HOST}:{PORT}"
    )
    print(f"Printer: {PRINTER_NAME}")

    server = ThreadingHTTPServer(
        (HOST, PORT),
        PrintBridgeHandler,
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Print bridge stopped.")
    finally:
        server.server_close()