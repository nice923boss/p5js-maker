"""Serve the editor over http://127.0.0.1 (needed for Export HTML, which fetches runtime/*.js).

Usage:
    python tools/serve.py [--port 38920] [--open]

Responses carry Cache-Control: no-cache so edited files show up on a normal reload.
Also the entry point of the PyInstaller exe (tools/P5JSMaker.spec): frozen, it serves the bundled files,
writes its output to P5JSMaker.log next to the exe and always opens the browser.
The port stays fixed because drafts (IndexedDB) and layout (localStorage) are stored per origin.
"""
import argparse
import functools
import http.server
import os
import sys
import urllib.request
import webbrowser
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
ROOT = Path(sys._MEIPASS) if FROZEN else Path(__file__).resolve().parent.parent  # type: ignore[attr-defined]

# A windowed exe has no console: sys.stdout/stderr are None and the request log would crash each request
if sys.stdout is None or sys.stderr is None:
    _log = open(os.path.join(os.path.dirname(os.path.abspath(sys.executable)), "P5JSMaker.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows registry can map .js to text/plain, which breaks ES modules
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # On Windows SO_REUSEADDR lets a second process bind the same port and silently share requests
    allow_reuse_address = False


def already_running(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as res:
            return b"<title>P5JS Maker</title>" in res.read(2048)
    except OSError:
        return False


def fail(msg: str) -> int:
    print(msg, file=sys.stderr, flush=True)
    if FROZEN:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, msg, "P5JS Maker", 0x10)
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Serve P5JS Maker locally")
    ap.add_argument("--port", type=int, default=38920)
    ap.add_argument("--open", action="store_true", help="open the editor in the default browser")
    args = ap.parse_args()
    url = f"http://127.0.0.1:{args.port}/index.html"
    if already_running(url):
        print(f"P5JS Maker 已在執行：{url}", flush=True)
        webbrowser.open(url)
        return 0
    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        server = Server(("127.0.0.1", args.port), handler)
    except OSError as err:
        return fail(f"無法使用連接埠 {args.port}（{err}）。請先關閉占用此連接埠的程式，或執行 stop.bat。")
    print(f"P5JS Maker: {url}", flush=True)
    if args.open or FROZEN:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
