import ctypes
import hashlib
import json
import os
import queue
import sys
import threading
import time
import tkinter as tk
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pystray
import win32print
from PIL import Image, ImageDraw, ImageTk

APP_NAME = "Zico Barcode Print Bridge"
DEFAULTS = {
    "host": "127.0.0.1",
    "port": 8799,
    "printer_name": "Godex G530",
    "allowed_origin": "https://odoo.suto-itec.com.cn",
    "auto_start": True,
}
AUTOSTART_NAME = "ZicoPrintBridge"
DEDUP_WINDOW = 1.5
MAX_LOG_ROWS = 100
TAG_COLORS = {
    "GET": "#0b5394",
    "POST": "#0b5394",
    "DATA": "#674ea7",
    "PRINT": "#38761d",
    "INFO": "#000000",
    "DUP": "#b45f06",
    "ERROR": "#cc0000",
    "HTTP": "#555555",
}

CONFIG = dict(DEFAULTS)
server = None
icon = None
PRINTER_FOUND = False
STATS = {
    "requests": 0,
    "printed": 0,
    "duplicates": 0,
    "errors": 0,
}
STATS_LOCK = threading.Lock()
DEDUP_LOCK = threading.Lock()
LOG_LOCK = threading.Lock()
EVENT_QUEUE = queue.Queue()
LAST_REQUEST = [None, 0.0]


def app_base():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def config_path():
    return os.path.join(app_base(), "print_bridge.json")


def fallback_log_dir():
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "ZicoPrintBridge")
    os.makedirs(path, exist_ok=True)
    return path


def write_log_file(line):
    with LOG_LOCK:
        try:
            path = os.path.join(app_base(), "print_bridge.log")
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(line + "\n")
            return
        except OSError:
            pass
        try:
            path = os.path.join(fallback_log_dir(), "print_bridge.log")
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except OSError:
            pass


def record(kind, message):
    short_ts = time.strftime("%H:%M:%S")
    full_ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = "[%s] [%s] %s" % (full_ts, kind, message)
    write_log_file(line)
    EVENT_QUEUE.put((short_ts, kind, message))


def sanitize(text):
    return " ".join(text.split())


def preview(text, limit=100):
    text = sanitize(text)
    if len(text) > limit:
        return text[:limit] + "..."
    return text


def show_message(title, message):
    try:
        ctypes.windll.user32.MessageBoxW(0, message, title, 0x40)
    except Exception:
        record("ERROR", message)


def notify(title, message):
    if icon is not None:
        try:
            icon.notify(message, title)
        except Exception as error:
            record("ERROR", "Notification failed: %s" % error)


def load_config():
    global CONFIG
    CONFIG = dict(DEFAULTS)
    path = config_path()
    if not os.path.exists(path):
        save_config()
        record("INFO", "Created default config at %s" % path)
        return
    try:
        with open(path, encoding="utf-8") as handle:
            CONFIG.update(json.load(handle))
    except Exception as error:
        record("ERROR", "Failed to load config %s: %s" % (path, error))


def save_config():
    try:
        with open(config_path(), "w", encoding="utf-8") as handle:
            json.dump(
                CONFIG,
                handle,
                ensure_ascii=False,
                indent=2,
            )
    except OSError as error:
        record(
            "ERROR",
            "Failed to write config %s: %s"
            % (config_path(), error),
        )


def run_key_path():
    return r"Software\Microsoft\Windows\CurrentVersion\Run"


def autostart_command():
    if not getattr(sys, "frozen", False):
        return None
    return '"%s" --autostart' % sys.executable


def get_autostart_enabled():
    try:
        import winreg
    except ImportError:
        return False
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            run_key_path(),
            0,
            winreg.KEY_READ,
        ) as key:
            try:
                winreg.QueryValueEx(key, AUTOSTART_NAME)
                return True
            except FileNotFoundError:
                return False
    except OSError:
        return False


def set_autostart(enabled):
    command = autostart_command()
    if command is None:
        return False
    try:
        import winreg
    except ImportError:
        return False
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            run_key_path(),
            0,
            winreg.KEY_SET_VALUE,
        ) as key:
            if enabled:
                winreg.SetValueEx(
                    key,
                    AUTOSTART_NAME,
                    0,
                    winreg.REG_SZ,
                    command,
                )
            else:
                try:
                    winreg.DeleteValue(key, AUTOSTART_NAME)
                except FileNotFoundError:
                    pass
        return True
    except OSError as error:
        record("ERROR", "Set autostart failed: %s" % error)
        return False


def sync_autostart():
    if autostart_command() is None:
        record(
            "INFO",
            "Auto start only available when packaged as exe",
        )
        return
    if get_autostart_enabled() != bool(CONFIG.get("auto_start")):
        set_autostart(bool(CONFIG.get("auto_start")))


def enum_printers():
    return [
        printer[2]
        for printer in win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL
            | win32print.PRINTER_ENUM_CONNECTIONS
        )
    ]


def raw_print(ezpl, document_name):
    record("PRINT", "OpenPrinter(%s)" % CONFIG["printer_name"])
    printer = win32print.OpenPrinter(CONFIG["printer_name"])

    try:
        record("PRINT", "StartDocPrinter(%s)" % document_name)
        job_id = win32print.StartDocPrinter(
            printer,
            1,
            (document_name, None, "RAW"),
        )

        try:
            win32print.StartPagePrinter(printer)
            record("PRINT", "StartPagePrinter job %d" % job_id)

            if isinstance(ezpl, str):
                raw_data = ezpl.encode("latin-1")
            else:
                raw_data = ezpl

            record(
                "PRINT",
                "WritePrinter %d bytes -> job %d"
                % (len(raw_data), job_id),
            )
            win32print.WritePrinter(printer, raw_data)
            win32print.EndPagePrinter(printer)
            record("PRINT", "EndPagePrinter job %d" % job_id)
        finally:
            win32print.EndDocPrinter(printer)
            record("PRINT", "EndDocPrinter job %d" % job_id)

        return job_id
    finally:
        win32print.ClosePrinter(printer)
        record("PRINT", "ClosePrinter")


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

        global PRINTER_FOUND

        try:
            printers = enum_printers()
            PRINTER_FOUND = CONFIG["printer_name"] in printers
        except Exception as error:
            printers = []
            PRINTER_FOUND = False
            record("ERROR", "EnumPrinters failed: %s" % error)

        record(
            "GET",
            "GET /health from %s" % self.client_address[0],
        )

        self._send_json(
            200,
            {
                "ok": True,
                "service": "zico_barcode_print_bridge",
                "default_printer": CONFIG["printer_name"],
                "printer_found": PRINTER_FOUND,
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

        client = self.client_address[0]

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

            fingerprint = hashlib.sha256(
                json.dumps(
                    data,
                    sort_keys=True,
                    ensure_ascii=False,
                ).encode("utf-8")
            ).hexdigest()
            short_fp = fingerprint[:12]
            now = time.time()

            with STATS_LOCK:
                STATS["requests"] += 1

            with DEDUP_LOCK:
                duplicate = (
                    fingerprint == LAST_REQUEST[0]
                    and (now - LAST_REQUEST[1]) <= DEDUP_WINDOW
                )

                if duplicate:
                    record(
                        "DUP",
                        "Identical request from %s ignored "
                        "(%d labels, fp %s)"
                        % (client, len(ezpl_list), short_fp),
                    )
                    notify(
                        "Duplicate request skipped",
                        "Same request came again within %.1fs "
                        "of the last one — not printed."
                        % DEDUP_WINDOW,
                    )
                    with STATS_LOCK:
                        STATS["duplicates"] += 1
                    self._send_json(
                        200,
                        {
                            "ok": True,
                            "printed": 0,
                            "printer": CONFIG["printer_name"],
                            "job_ids": [],
                            "duplicate": True,
                        },
                    )
                    return

                LAST_REQUEST[0] = fingerprint
                LAST_REQUEST[1] = now

            record(
                "POST",
                "POST /print from %s: %d label(s), %d bytes, "
                "fp %s"
                % (
                    client,
                    len(ezpl_list),
                    content_length,
                    short_fp,
                ),
            )

            for index, ezpl in enumerate(ezpl_list, start=1):
                if not isinstance(ezpl, str) or not ezpl.strip():
                    raise ValueError(
                        "EZPL item %d is empty" % index
                    )
                record(
                    "DATA",
                    "Item %d: %d chars, preview: %s"
                    % (index, len(ezpl), preview(ezpl)),
                )

            job_ids = []

            for index, ezpl in enumerate(ezpl_list, start=1):
                job_id = raw_print(
                    ezpl,
                    "Odoo ST Label %d" % index,
                )
                job_ids.append(job_id)

            with STATS_LOCK:
                STATS["printed"] += len(job_ids)

            self._send_json(
                200,
                {
                    "ok": True,
                    "printed": len(job_ids),
                    "printer": CONFIG["printer_name"],
                    "job_ids": job_ids,
                },
            )
            record(
                "INFO",
                "Printed %d label(s) on %s"
                % (len(job_ids), CONFIG["printer_name"]),
            )
            notify(
                "Print job done",
                "Printed %d label(s) on %s"
                % (len(job_ids), CONFIG["printer_name"]),
            )

        except Exception as error:
            with STATS_LOCK:
                STATS["errors"] += 1
            record("ERROR", "Print request failed: %s" % error)
            self._send_json(
                500,
                {
                    "ok": False,
                    "error": str(error),
                },
            )

    def log_message(self, format_string, *args):
        record(
            "HTTP",
            "%s - %s"
            % (
                self.address_string(),
                format_string % args,
            ),
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


def show_window_action(icon_item, item):
    EVENT_QUEUE.put(("CMD", "show"))


def toggle_autostart_action(icon_item, item):
    enabled = not get_autostart_enabled()
    if set_autostart(enabled):
        CONFIG["auto_start"] = enabled
        save_config()
        notify(
            "Auto start",
            "Start with Windows: %s" % ("on" if enabled else "off"),
        )
    else:
        notify(
            "Auto start",
            "Only works when running the packaged exe.",
        )


def exit_action(icon_item, item):
    EVENT_QUEUE.put(("CMD", "exit"))


class StatusWindow:

    def __init__(self):
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("760x540")
        self.root.minsize(600, 420)
        self.root.protocol("WM_DELETE_WINDOW", self.hide_to_tray)
        self.last_printer_check = 0.0
        self.build_ui()
        self.refresh_printers()
        self.refresh_status()
        self.root.after(100, self.poll)

    def build_ui(self):
        self._photo = ImageTk.PhotoImage(
            create_icon_image().resize((32, 32))
        )
        self.root.iconphoto(True, self._photo)

        header = tk.Frame(self.root, padx=12, pady=10)
        header.pack(side=tk.TOP, fill=tk.X)

        tk.Label(
            header,
            text=APP_NAME,
            font=("Segoe UI", 12, "bold"),
        ).pack(anchor=tk.W)

        info = tk.Frame(header)
        info.pack(anchor=tk.W, pady=(6, 0))

        tk.Label(
            info,
            text="Service:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=0, column=0, sticky=tk.W, padx=(0, 4))
        self.lbl_service = tk.Label(info, font=("Consolas", 9))
        self.lbl_service.grid(row=0, column=1, sticky=tk.W, padx=(0, 16))

        tk.Label(
            info,
            text="Printer:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=0, column=2, sticky=tk.W, padx=(0, 4))
        self.lbl_printer = tk.Label(info, font=("Consolas", 9))
        self.lbl_printer.grid(row=0, column=3, sticky=tk.W, padx=(0, 16))

        tk.Label(
            info,
            text="Found:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=0, column=4, sticky=tk.W, padx=(0, 4))
        self.lbl_found = tk.Label(info, font=("Consolas", 9))
        self.lbl_found.grid(row=0, column=5, sticky=tk.W)

        self.lbl_counts = tk.Label(
            header,
            font=("Consolas", 9),
            fg="#333333",
        )
        self.lbl_counts.pack(anchor=tk.W, pady=(6, 0))

        tk.Label(
            header,
            text="Log file: %s"
            % os.path.join(app_base(), "print_bridge.log"),
            font=("Consolas", 8),
            fg="#888888",
        ).pack(anchor=tk.W, pady=(2, 0))

        log_frame = tk.Frame(self.root, padx=12, pady=(0, 8))
        log_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(log_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.log_text = tk.Text(
            log_frame,
            font=("Consolas", 9),
            wrap=tk.NONE,
            state=tk.DISABLED,
            yscrollcommand=scrollbar.set,
            background="#f7f7f7",
            relief=tk.SUNKEN,
            borderwidth=1,
        )
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.log_text.yview)

        self.log_text.tag_configure("time", foreground="#888888")
        self.log_text.tag_configure("msg", foreground="#111111")
        for kind, color in TAG_COLORS.items():
            self.log_text.tag_configure(kind, foreground=color)

        buttons = tk.Frame(self.root, padx=12, pady=10)
        buttons.pack(side=tk.TOP, fill=tk.X)

        tk.Button(
            buttons,
            text="Refresh printer",
            command=self.refresh_printers,
        ).pack(side=tk.LEFT)
        tk.Button(
            buttons,
            text="Exit",
            command=self.request_exit,
        ).pack(side=tk.RIGHT)

    def refresh_printers(self):
        global PRINTER_FOUND
        try:
            printers = enum_printers()
            PRINTER_FOUND = CONFIG["printer_name"] in printers
            record(
                "INFO",
                "Printer check: %s found, %d printer(s) detected"
                % (
                    CONFIG["printer_name"],
                    len(printers),
                ),
            )
        except Exception as error:
            PRINTER_FOUND = False
            record("ERROR", "EnumPrinters failed: %s" % error)
        self.last_printer_check = time.time()
        self.refresh_status()

    def refresh_status(self):
        self.lbl_service.config(
            text="http://%s:%d" % (CONFIG["host"], CONFIG["port"])
        )
        self.lbl_printer.config(text=CONFIG["printer_name"])
        self.lbl_found.config(
            text="yes" if PRINTER_FOUND else "no",
            fg="#38761d" if PRINTER_FOUND else "#cc0000",
        )
        with STATS_LOCK:
            counts = (
                "Requests: %(requests)d   "
                "Printed: %(printed)d   "
                "Duplicates skipped: %(duplicates)d   "
                "Errors: %(errors)d"
                % STATS
            )
        self.lbl_counts.config(text=counts)

    def add_event(self, ts, kind, message):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, "%-8s " % ts, ("time",))
        self.log_text.insert(tk.END, "[%-5s] " % kind, (kind,))
        self.log_text.insert(tk.END, message + "\n", ("msg",))

        if self.log_text.index("end-1c").split(".")[0] > str(MAX_LOG_ROWS):
            self.log_text.delete("1.0", "2.0")

        self.log_text.configure(state=tk.DISABLED)
        self.log_text.see(tk.END)

    def poll(self):
        try:
            while True:
                item = EVENT_QUEUE.get_nowait()
                if item[0] == "CMD":
                    self.handle_command(item[1])
                else:
                    ts, kind, message = item
                    self.add_event(ts, kind, message)
        except queue.Empty:
            pass

        now = time.time()
        if now - self.last_printer_check >= 5:
            self.refresh_printers()
        else:
            self.refresh_status()

        self.root.after(100, self.poll)

    def handle_command(self, command):
        if command == "show":
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()
        elif command == "exit":
            self.root.destroy()

    def hide_to_tray(self):
        self.root.withdraw()
        notify(
            "Still running",
            "Zico Print Bridge is running in the system tray.",
        )

    def request_exit(self):
        self.root.destroy()


def main():
    load_config()
    sync_autostart()

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
        record("ERROR", "Failed to start server: %s" % error)
        return

    threading.Thread(
        target=server.serve_forever,
        daemon=True,
    ).start()

    record(
        "INFO",
        "Print bridge running at "
        "http://%s:%d" % (CONFIG["host"], CONFIG["port"]),
    )
    record("INFO", "Printer: %s" % CONFIG["printer_name"])

    window = StatusWindow()

    icon = pystray.Icon(
        APP_NAME,
        create_icon_image(),
        title=APP_NAME,
        menu=pystray.Menu(
            pystray.MenuItem("Show window", show_window_action),
            pystray.MenuItem(
                "Start with Windows",
                toggle_autostart_action,
                checked=lambda item: get_autostart_enabled(),
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Exit", exit_action),
        ),
    )
    icon.run_detached()

    if "--autostart" in sys.argv:
        window.root.withdraw()
        notify(
            "Auto started",
            "Zico Print Bridge is running in the system tray.",
        )

    try:
        window.root.mainloop()
    finally:
        server.shutdown()
        server.server_close()
        icon.stop()
        record("INFO", "Print bridge stopped.")


if __name__ == "__main__":
    main()