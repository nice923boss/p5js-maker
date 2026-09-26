"""Build a standalone player HTML from a P5JS Maker project JSON.

Usage:
    python tools/build_player.py project.json -o out.html [--title "My Animation"]

The runtime scripts listed in runtime/manifest.json are inlined, so the output needs only
network access for p5.js (jsDelivr CDN) and Google Fonts.
"""
import argparse
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / "runtime"


def inline_script(code: str) -> str:
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


def check_project(project: dict) -> list:
    """Structural checks only; prop-level checks happen in the browser runtime."""
    errors = []
    settings = project.get("settings", {})
    for key in ("width", "height", "duration"):
        if not isinstance(settings.get(key), (int, float)) or settings.get(key) <= 0:
            errors.append(f"settings.{key} 必須是正數")
    tracks = project.get("tracks")
    if not isinstance(tracks, list) or not tracks:
        errors.append("tracks 必須是非空陣列")
        return errors
    for ti, track in enumerate(tracks):
        for ci, clip in enumerate(track.get("clips", [])):
            where = f"tracks[{ti}].clips[{ci}]"
            if not clip.get("type"):
                errors.append(f"{where} 缺少 type")
            if not isinstance(clip.get("start"), (int, float)):
                errors.append(f"{where}.start 必須是數字")
            if not isinstance(clip.get("duration"), (int, float)) or clip.get("duration") <= 0:
                errors.append(f"{where}.duration 必須是正數")
    return errors


def build(project: dict, title: str) -> str:
    manifest = json.loads((RUNTIME / "manifest.json").read_text(encoding="utf-8"))
    template = (RUNTIME / manifest["template"]).read_text(encoding="utf-8")
    runtime = "\n".join(inline_script((RUNTIME / name).read_text(encoding="utf-8")) for name in manifest["runtime"])
    player = inline_script((RUNTIME / manifest["player"]).read_text(encoding="utf-8"))
    data = json.dumps(project, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    out = template.replace("__P5M_TITLE__", html.escape(title))
    # replace() with plain strings: the payloads may contain backslashes that re.sub would interpret
    out = out.replace("<!--P5M:RUNTIME-->", runtime).replace("<!--P5M:PLAYER-->", player)
    return out.replace("__P5M_PROJECT__", data)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Build a standalone P5JS Maker player HTML")
    ap.add_argument("project", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--title", default=None)
    args = ap.parse_args()

    project = json.loads(args.project.read_text(encoding="utf-8"))
    errors = check_project(project)
    if errors:
        print("專案格式錯誤：")
        for e in errors:
            print("  - " + e)
        return 1
    title = args.title or project.get("title") or args.project.stem
    args.out.write_text(build(project, title), encoding="utf-8")
    print(f"已輸出 {args.out}（{args.out.stat().st_size / 1024:.0f} KB）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
