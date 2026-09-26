"""Embed local image / audio files referenced by a P5JS Maker project as data URLs.

Usage:
    python tools/embed_assets.py project.json [-o out.json]

Every asset whose `src` is a file path (absolute, or relative to the project file) is read and
replaced by a data URL, the same way the editor stores imported files. Images also get `w` / `h`,
WAV files get `duration`. Assets already using data: or http(s): URLs are left alone.
Without -o the project file is updated in place.
"""
import argparse
import base64
import json
import mimetypes
import sys
import wave
from pathlib import Path

from PIL import Image

BIG_FILE = 20 * 1024 * 1024


def embed(asset: dict, base: Path) -> str | None:
    """Returns a message for the report, or None when the asset needs nothing."""
    src = asset.get("src") or ""
    if asset.get("kind") not in ("image", "audio") or src.startswith(("data:", "http:", "https:")):
        return None
    path = Path(src.removeprefix("file:///"))
    if not path.is_absolute():
        path = base / path
    if not path.is_file():
        raise FileNotFoundError(f"素材 {asset.get('id')} 找不到檔案：{path}")
    mime = mimetypes.guess_type(path.name)[0] or ""
    if not mime.startswith(asset["kind"] + "/"):
        raise ValueError(f"素材 {asset.get('id')} 是 kind {asset['kind']}，但 {path.name} 的類型是 {mime or '未知'}")
    data = path.read_bytes()
    asset["src"] = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
    asset.setdefault("name", path.stem)
    if asset["kind"] == "image":
        with Image.open(path) as im:
            asset["w"], asset["h"] = im.size
    elif path.suffix.lower() == ".wav":
        with wave.open(str(path)) as w:
            asset["duration"] = round(w.getnframes() / w.getframerate(), 3)
    note = "（檔案很大，專案檔與匯出會跟著變大）" if len(data) > BIG_FILE else ""
    return f"{asset.get('id')}：{path.name}，{len(data) / 1024:.0f} KB{note}"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Embed local assets of a P5JS Maker project as data URLs")
    ap.add_argument("project", type=Path)
    ap.add_argument("-o", "--out", type=Path, help="output JSON (default: update the project in place)")
    args = ap.parse_args()

    project = json.loads(args.project.read_text(encoding="utf-8"))
    done = []
    try:
        for asset in (project.get("assets") or {}).values():
            msg = embed(asset, args.project.resolve().parent)
            if msg:
                done.append(msg)
    except (OSError, ValueError) as err:
        print(f"失敗，未寫入任何檔案：{err}")
        return 1
    if not done:
        print("沒有需要內嵌的本機素材")
        return 0
    out = args.out or args.project
    out.write_text(json.dumps(project, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已內嵌 {len(done)} 個素材，寫入 {out}")
    for m in done:
        print("  - " + m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
