"""Check a P5JS Maker project JSON the way the runtime sees it, and render sample frames.

Usage:
    python tools/check_project.py project.json [--out DIR] [--frames 12] [--times 0.5,3,7.2]
    python tools/check_project.py --types-md reference/types.md

Validation runs in headless Chromium against the live type registry (tests/check.js), so it
always matches the runtime. Output: errors and warnings, f_*.png frames and a contact sheet
(sheet.png). Exit code 1 when there are errors (bad values, page errors, failed layers).
Needs Playwright + Chromium, Pillow, and network access for p5.js (jsDelivr) and Google Fonts.
"""
import argparse
import base64
import functools
import json
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from build_player import check_project  # noqa: E402
from serve import Handler, Server  # noqa: E402

EMPTY_RATIO = 0.002  # below this share of non-background pixels a frame counts as empty
SHEET_COLS, THUMB_W = 4, 360


class QuietHandler(Handler):
    def log_message(self, *args) -> None:
        pass


def start_server() -> tuple[Server, str]:
    server = Server(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def frame_times(duration: float, count: int, times: str | None) -> list[float]:
    if times:
        return [float(x) for x in times.split(",") if x.strip()]
    return [round(duration * (i + 0.5) / count, 3) for i in range(count)]


def contact_sheet(frames: list[tuple[float, Path]], out: Path) -> None:
    thumbs = []
    for t, path in frames:
        im = Image.open(path).convert("RGB")
        im = im.resize((THUMB_W, round(im.height * THUMB_W / im.width)))
        ImageDraw.Draw(im).text((6, 4), f"{t:.2f}s", fill=(255, 255, 0))
        thumbs.append(im)
    cols = min(SHEET_COLS, len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    th = thumbs[0].height
    sheet = Image.new("RGB", (cols * THUMB_W + (cols - 1) * 4, rows * th + (rows - 1) * 4), (40, 40, 40))
    for i, im in enumerate(thumbs):
        sheet.paste(im, ((i % cols) * (THUMB_W + 4), (i // cols) * (th + 4)))
    sheet.save(out)


def run(args: argparse.Namespace) -> int:
    project = None
    if args.project:
        try:
            project = json.loads(args.project.read_text(encoding="utf-8"))
        except (OSError, ValueError) as err:
            print(f"無法讀取專案 JSON：{err}")
            return 1
        structural = check_project(project)
        if structural:
            print("專案結構錯誤，無法繼續：")
            for e in structural:
                print("  - " + e)
            return 1

    errors: list[str] = []
    warnings: list[str] = []
    server, base = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--enable-unsafe-swiftshader"])
            page = browser.new_page(viewport={"width": 1400, "height": 900})
            page.set_default_timeout(90_000)

            def on_console(msg) -> None:
                if msg.type != "error":
                    return
                text = msg.text
                (warnings if text.startswith("Failed to load resource") else errors).append("瀏覽器主控台：" + text)

            page.on("console", on_console)
            page.on("pageerror", lambda err: errors.append(f"頁面錯誤：{err}"))
            page.goto(f"{base}/tests/check.html")
            try:
                page.evaluate("window.__checkReady")
            except PlaywrightError as err:
                print(f"runtime 載入失敗（需要網路載入 p5.js）：{err}")
                return 1

            if args.types_md:
                args.types_md.parent.mkdir(parents=True, exist_ok=True)
                args.types_md.write_text(page.evaluate("CHECK.typesMarkdown()"), encoding="utf-8")
                print(f"已輸出類型參考 {args.types_md}")
            if project is None:
                return 0

            result = page.evaluate("(p) => CHECK.validate(p)", project)
            errors[:0] = result["errors"]
            warnings[:0] = result["warnings"]

            out = args.out or Path(tempfile.gettempdir()) / "p5maker_check" / args.project.stem
            out.mkdir(parents=True, exist_ok=True)
            for old in [*out.glob("f_*.png"), out / "sheet.png"]:
                old.unlink(missing_ok=True)
            frames: list[tuple[float, Path]] = []
            page.evaluate("(p) => CHECK.load(p)", project)
            for i, t in enumerate(frame_times(project["settings"]["duration"], args.frames, args.times)):
                shot = page.evaluate("(t) => CHECK.frame(t)", t)
                path = out / f"f_{i:02d}_{t:.2f}s.png"
                path.write_bytes(base64.b64decode(shot["png"].split(",", 1)[1]))
                frames.append((t, path))
                if shot["contentRatio"] < EMPTY_RATIO:
                    warnings.append(f"{t:.2f} 秒的畫面只有背景色")
            contact_sheet(frames, out / "sheet.png")
            browser.close()
    finally:
        server.shutdown()

    print(f"錯誤 {len(errors)} 項")
    for e in errors:
        print("  ✗ " + e)
    print(f"警告 {len(warnings)} 項")
    for w in warnings:
        print("  ! " + w)
    print(f"畫面 {len(frames)} 張：{out}")
    print(f"總覽圖：{out / 'sheet.png'}")
    return 1 if errors else 0


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Validate a P5JS Maker project and render sample frames")
    ap.add_argument("project", type=Path, nargs="?")
    ap.add_argument("--out", type=Path, help="frame folder (default: %%TEMP%%/p5maker_check/<name>)")
    ap.add_argument("--frames", type=int, default=12, help="evenly spaced frames to render")
    ap.add_argument("--times", help="comma-separated seconds to render instead of --frames")
    ap.add_argument("--types-md", type=Path, help="write the type reference Markdown here")
    args = ap.parse_args()
    if not args.project and not args.types_md:
        ap.error("請指定專案 JSON 或 --types-md")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
