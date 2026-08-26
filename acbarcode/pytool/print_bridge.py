import ctypes
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pystray
import win32print
from PIL import Image, ImageDraw

APP_NAME = "Zico Barcode Print Bridge"
DEFAULTS = {
    "host": "127.0.0.1",
    "port": 8799,
    "printer_name": "Godex G530",
    "allowed_origin": "https://odoo.suto-itec.com.cn",
}

CONFIG = dict(DEFAULTS)
server = None
icon = None


def app_base():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def config_path():
    return os.path.join(app_base(), "print_bridge.json")


def log_dir():
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "ZicoPrintBridge")
    os.makedirs(path, exist_ok=True)
    return path


def log(message):
    line = "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), message)
    try:
        with open(
            os.path.join(log_dir(), "print_bridge.log"),
            "a",
            encoding="utf-8",
        ) as handle:
            handle.write(line + "\n")
    except OSError:
        pass
    print(line)


def load_config():
    global CONFIG
    CONFIG = dict(DEFAULTS)
    path = config_path()
    if not os.path.exists(path):
        return
    try:
        with open(path, encoding="utf-8") as handle:
            CONFIG.update(json.load(handle))
    except Exception as error:
        log("Failed to load config %s: %s" % (path, error))


def show_message(title, message):
    try:
        ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)
    except Exception:
        log(message)


def notify(title, message):
    if icon is not None:
        try:
            icon.notify(message, title)
        except Exception as error:
            log("Notification failed: %s" % error)


def raw_print(ezpl, document_name):
    printer = win32print.OpenPrinter(CONFIG["printer_name"])

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


def enum_printers():
    return [
        printer[2]
        for printer in win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL
            | win32print.PRINTER_ENUM_CONNECTIONS
        )
    ]


class PrintBridgeHandler(BaseHTTPRequestHandler):

    def _cors_headers(self):
        origin = self.headers.get("Origin", "")

        if origin == CONFIG["allowed_origin"]:
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

        try:
            printers = enum_printers()
            printer_found = CONFIG["printer_name"] in printers
        except Exception as error:
            printers = []
            printer_found = False
            log("EnumPrinters failed: %s" % error)

        self._send_json(
            200,
            {
                "ok": True,
                "service": "zico_barcode_print_bridge",
                "default_printer": CONFIG["printer_name"],
                "printer_found": printer_found,
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
                    "printer": CONFIG["printer_name"],
                    "job_ids": job_ids,
                },
            )
            log(
                "Printed %d label(s) on %s"
                % (len(job_ids), CONFIG["printer_name"])
            )
            notify(
                "Print job done",
                "Printed %d label(s) on %s"
                % (len(job_ids), CONFIG["printer_name"]),
            )

        except Exception as error:
            log("Print request failed: %s" % error)
            self._send_json(
                500,
                {
                    "ok": False,
                    "error": str(error),
                },
            )

    def log_message(self, format_string, *args):
        log(
            "%s - %s"
            % (
                self.address_string(),
                format_string % args,
            )
        )


def create_icon_image():
    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    m = size // 8
    body_top = m
    body_bottom = size - 2 * m
    draw.rounded_rectangle(
        [m, body_top, size - m, body_bottom],
        radius=max(2, m),
        fill=(40, 120, 200),
        outline=(255, 255, 255),
        width=2,
    )
    draw.rectangle(
        [2 * m, body_top + m, size - 2 * m, body_bottom - m],
        fill=(255, 255, 255),
    )
    paper_top = body_top + m
    paper_bottom = paper_top + (size - 2 * m) // 2
    draw.rectangle(
        [2 * m, paper_top, size - 2 * m, paper_top + (paper_bottom - paper_top) // 2],
        fill=(90, 170, 230),
    )
    draw.rounded_rectangle(
        [int(m * 1.2), body_bottom + m // 2, size - int(m * 1.2), body_bottom + m],
        radius=max(1, m // 3),
        fill=(40, 120, 200),
    )
    return image


def status_action(icon_item, item):
    try:
        printers = enum_printers()
    except Exception as error:
        printers = []
        log("EnumPrinters failed: %s" % error)

    lines = [
        "Service: http://%s:%d" % (CONFIG["host"], CONFIG["port"]),
        "Printer: %s" % CONFIG["printer_name"],
        "Found: %s"
        % ("yes" if CONFIG["printer_name"] in printers else "no"),
        "Config: %s" % config_path(),
        "",
        "Detected printers:",
    ]
    lines.extend(printers or ["(none)"])
    show_message(APP_NAME, "\n".join(lines))


def open_web_action(icon_item, item):
    try:
        os.startfile(
            "http://%s:%d/health" % (CONFIG["host"], CONFIG["port"])
        )
    except Exception as error:
        log("open_web failed: %s" % error)


def exit_action(icon_item, item):
    log("Exiting")
    icon_item.stop()


def main():
    load_config()

    global server, icon

    try:
        server = ThreadingHTTPServer(
            (CONFIG["host"], CONFIG["port"]),
            PrintBridgeHandler,
        )
    except OSError as error:
        show_message(
            APP_NAME,
            "Failed to start server on http://%s:%d\n\n%s"
            % (CONFIG["host"], CONFIG["port"], error),
        )
        log("Failed to start server: %s" % error)
        return

    threading.Thread(
        target=server.serve_forever,
        daemon=True,
    ).start()

    log(
        "Print bridge running at "
        "http://%s:%d" % (CONFIG["host"], CONFIG["port"])
    )
    log("Printer: %s" % CONFIG["printer_name"])

    icon = pystray.Icon(
        APP_NAME,
        create_icon_image(),
        title=APP_NAME,
        menu=pystray.Menu(
            pystray.MenuItem("Status", status_action),
            pystray.MenuItem("Open web page", open_web_action),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", exit_action),
        ),
    )

    try:
        icon.run()
    finally:
        server.server_close()
        log("Print bridge stopped.")


if __name__ == "__main__":
    main()
