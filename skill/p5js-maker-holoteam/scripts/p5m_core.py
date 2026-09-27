"""Shared helpers for the P5JS Maker CLI: schema, project I/O, lookups, track placement, assets.

Standard library only. Mirrors the editor's behaviour (js/actions.js, js/state.js) so a project edited
here opens in P5JS Maker exactly as if the edits were made by hand.
"""
import base64
import json
import struct
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = SKILL_DIR / "reference" / "schema.json"
EPS = 1e-4

_schema = None


class CliError(Exception):
    """A user-facing error: printed as-is, exit code 1."""


def schema() -> dict:
    global _schema
    if _schema is None:
        _schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return _schema


def type_def(name: str) -> dict:
    t = schema()["types"].get(name)
    if not t:
        raise CliError(f"沒有 {name} 這種圖層，可用：{'、'.join(schema()['types'])}")
    return t


def prop_def(type_name: str, key: str):
    return next((p for p in type_def(type_name)["props"] if p["key"] == key), None)


def round_t(t: float) -> float:
    return round(float(t), 3)


def num(v: float):
    """Whole floats become ints so the JSON stays tidy."""
    return int(v) if isinstance(v, float) and v.is_integer() else v


# ---------- project I/O ----------
def new_project(width=1280, height=720, fps=30, duration=10, background="#101018", title="") -> dict:
    return {
        "format": "p5maker", "version": 1, "title": title,
        "settings": {"width": width, "height": height, "fps": fps, "duration": duration, "background": background, "volume": 1},
        "assets": {},
        "camera": {"props": {"x": width / 2, "y": height / 2, "zoom": 1, "rotation": 0, "shake": 0}, "keys": {}},
        "tracks": [
            {"id": "tr1", "name": "軌道 1", "kind": "visual", "hidden": False, "muted": False, "locked": False, "followCamera": True, "clips": []},
            {"id": "tr2", "name": "音訊 1", "kind": "audio", "hidden": False, "muted": False, "locked": False, "followCamera": True, "clips": []},
        ],
    }


def load(path: Path) -> dict:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        raise CliError(f"找不到專案檔：{path}")
    except ValueError as err:
        raise CliError(f"專案檔不是有效的 JSON：{err}")
    if data.get("format") != "p5maker":
        raise CliError("這不是 P5JS Maker 專案檔（format 不是 p5maker）")
    data.setdefault("assets", {})
    data.setdefault("camera", {}).setdefault("props", {})
    data["camera"].setdefault("keys", {})
    data.setdefault("tracks", [])
    for tr in data["tracks"]:
        tr.setdefault("clips", [])
    return data


def save(project: dict, path: Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(project, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# ---------- ids and lookups ----------
def all_ids(project: dict) -> set:
    ids = {tr.get("id") for tr in project["tracks"]}
    ids |= {c.get("id") for tr in project["tracks"] for c in tr["clips"]}
    return ids


def next_id(project: dict, prefix: str) -> str:
    used = all_ids(project) | set(project["assets"])
    n = 1
    while f"{prefix}{n}" in used:
        n += 1
    return f"{prefix}{n}"


def find_clip(project: dict, clip_id: str):
    for tr in project["tracks"]:
        for c in tr["clips"]:
            if c.get("id") == clip_id:
                return c, tr
    return None, None


def find_track(project: dict, track_id: str):
    return next((tr for tr in project["tracks"] if tr.get("id") == track_id), None)


def require_clip(project: dict, clip_id: str):
    clip, tr = find_clip(project, clip_id)
    if not clip:
        raise CliError(f"找不到圖層 {clip_id}，先用 info 查 id")
    return clip, tr


def kind_of(type_name: str) -> str:
    return "audio" if type_def(type_name)["kind"] == "audio" else "visual"


# ---------- track placement (same rules as the editor) ----------
def fits(track: dict, start: float, dur: float, ignore_id=None) -> bool:
    return all(
        c.get("id") == ignore_id or c["start"] + c["duration"] <= start + EPS or c["start"] >= start + dur - EPS
        for c in track["clips"]
    )


def new_track(project: dict, kind: str, index=None, name=None) -> dict:
    n = len([t for t in project["tracks"] if t["kind"] == kind]) + 1
    tr = {
        "id": next_id(project, "tr"), "name": name or (("音訊 " if kind == "audio" else "軌道 ") + str(n)), "kind": kind,
        "hidden": False, "muted": False, "locked": False, "followCamera": True, "clips": [],
    }
    if index is None:
        index = len(project["tracks"]) if kind == "audio" else 0
    project["tracks"].insert(index, tr)
    return tr


def pick_track(project: dict, kind: str, start: float, dur: float, track_id=None, background=False) -> dict:
    want = track_id and find_track(project, track_id)
    if track_id and not want:
        raise CliError(f"找不到軌道 {track_id}")
    if want and want["kind"] == kind and not want.get("locked") and fits(want, start, dur):
        return want
    pool = [t for t in project["tracks"] if t["kind"] == kind and not t.get("locked")]
    if background:
        pool.reverse()
    hit = next((t for t in pool if fits(t, start, dur)), None)
    if hit:
        return hit
    if kind == "audio":
        return new_track(project, "audio")
    if background:
        kinds = [t["kind"] for t in project["tracks"]]
        last_visual = len(kinds) - 1 - kinds[::-1].index("visual") if "visual" in kinds else -1
        return new_track(project, "visual", last_visual + 1)
    return new_track(project, "visual", 0)


def extend_duration(project: dict) -> None:
    end = max((c["start"] + c["duration"] for tr in project["tracks"] for c in tr["clips"]), default=0)
    if end > project["settings"]["duration"]:
        project["settings"]["duration"] = num(-(-end * 10 // 1) / 10)


def default_props(type_name: str, settings: dict) -> dict:
    out = {}
    for pd in type_def(type_name)["props"]:
        if pd["key"] == "x":
            out["x"] = num(settings["width"] / 2)
        elif pd["key"] == "y":
            out["y"] = num(settings["height"] / 2)
        elif "default" in pd:
            d = pd["default"]
            out[pd["key"]] = settings["width"] if d == "$width" else settings["height"] if d == "$height" else d
    return out


def preset_props(type_name: str, preset: str) -> dict:
    """The values the editor copies into props when a particle or gen preset is picked."""
    table = schema()["particlePresets"] if type_name == "particles" else schema()["genPresets"] if type_name == "gen" else None
    if not table:
        return {}
    if preset not in table:
        raise CliError(f"{type_name} 沒有 {preset} 這個預設，可用：{'、'.join(table)}")
    return dict(table[preset]["d"] or {})


# ---------- value parsing ----------
def coerce(type_name, key: str, raw: str):
    """Turn a command-line string into the value type the schema expects."""
    pd = prop_def(type_name, key) if type_name else None
    if pd is None:
        try:
            return json.loads(raw)
        except ValueError:
            return raw
    t = pd["type"]
    if t in ("number", "range"):
        try:
            return num(float(raw))
        except ValueError:
            raise CliError(f"{key} 必須是數字，收到 {raw!r}")
    if t == "bool":
        if raw.lower() in ("true", "1", "yes", "是"):
            return True
        if raw.lower() in ("false", "0", "no", "否"):
            return False
        raise CliError(f"{key} 必須是 true 或 false，收到 {raw!r}")
    if t == "select":
        for o in pd["options"]:
            if str(o["value"]) == raw or o["label"] == raw:
                return o["value"]
        raise CliError(f"{key} 沒有 {raw!r} 這個選項，可用：{'、'.join(str(o['value']) + '（' + o['label'] + '）' for o in pd['options'])}")
    if t in ("text", "textarea", "code"):
        return raw.replace("\\n", "\n")
    return raw


def parse_pairs(pairs: list) -> list:
    out = []
    for p in pairs:
        if "=" not in p:
            raise CliError(f"參數 {p!r} 格式錯誤，請寫成 屬性=值，例如 fill=#ffcc00")
        k, v = p.split("=", 1)
        out.append((k.strip(), v))
    return out


# ---------- assets ----------
MIME = {b"\x89PNG": "image/png", b"\xff\xd8": "image/jpeg", b"GIF8": "image/gif", b"RIFF": None}
AUDIO_EXT = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4"}


def image_size(data: bytes):
    if data[:4] == b"\x89PNG":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"GIF8":
        return struct.unpack("<HH", data[6:10])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk = data[12:16]
        if chunk == b"VP8X":
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
        if chunk == b"VP8 ":
            w, h = struct.unpack("<HH", data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if chunk == b"VP8L":
            b = int.from_bytes(data[21:25], "little")
            return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None


def read_asset(path: Path, asset_id: str, name=None) -> dict:
    path = Path(path)
    if not path.is_file():
        raise CliError(f"找不到素材檔：{path}")
    data = path.read_bytes()
    size = image_size(data)
    if size:
        mime = "image/webp" if data[:4] == b"RIFF" else next(m for sig, m in MIME.items() if data.startswith(sig))
        asset = {"id": asset_id, "kind": "image", "name": name or path.stem, "w": size[0], "h": size[1]}
    elif path.suffix.lower() in AUDIO_EXT:
        mime = AUDIO_EXT[path.suffix.lower()]
        asset = {"id": asset_id, "kind": "audio", "name": name or path.stem}
    else:
        raise CliError(f"不支援 {path.name}：圖片請用 PNG、JPEG、GIF、WebP，音訊請用 MP3、WAV、OGG、M4A")
    asset["src"] = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
    return asset
