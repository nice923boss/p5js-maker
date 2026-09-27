"""Mutating commands. Each takes the loaded project plus arguments and returns a short report line."""
import math

from p5m_core import (
    EPS, CliError, coerce, default_props, extend_duration, find_track, kind_of, new_track, next_id, num, parse_pairs,
    pick_track, preset_props, prop_def, read_asset, require_clip, round_t, schema, text_spacing, type_def,
)

KEY_EPS = 1e-3
FILL_FX = {"fx_vignette", "fx_grain", "fx_grade", "fx_tint", "fx_letterbox", "fx_lightLeak", "fx_blur", "fx_glow"}
FX_DUR = {"fx_flash": 0.6, "fx_fade": 1.5}
CLIP_FIELDS = ("start", "duration", "name", "blend", "offset")
TRACK_FIELDS = ("name", "hidden", "muted", "locked", "followCamera")
SETTINGS_FIELDS = ("width", "height", "fps", "duration", "background", "volume")


def _back_out(p):
    c1 = 1.70158
    return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2


def _bounce(p):
    n, d = 7.5625, 2.75
    if p < 1 / d:
        return n * p * p
    if p < 2 / d:
        p -= 1.5 / d
        return n * p * p + 0.75
    if p < 2.5 / d:
        p -= 2.25 / d
        return n * p * p + 0.9375
    p -= 2.625 / d
    return n * p * p + 0.984375


EASE = {
    "linear": lambda p: p,
    "easeIn": lambda p: p ** 3,
    "easeOut": lambda p: 1 - (1 - p) ** 3,
    "easeInOut": lambda p: 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2,
    "sine": lambda p: -(math.cos(math.pi * p) - 1) / 2,
    "backOut": _back_out,
    "backIn": lambda p: 1 - _back_out(1 - p),
    "elastic": lambda p: 0 if p <= 0 else 1 if p >= 1 else 2 ** (-10 * p) * math.sin((p * 10 - 0.75) * (2 * math.pi / 3)) + 1,
    "bounce": _bounce,
    "hold": lambda p: 1 if p >= 1 else 0,
}


def sample(keys: list, t: float):
    """Value of a numeric keyframe list at time t (same as P5M.sampleKeys for numbers)."""
    if t <= keys[0]["t"]:
        return keys[0]["v"]
    if t >= keys[-1]["t"]:
        return keys[-1]["v"]
    i = 0
    while i < len(keys) - 2 and keys[i + 1]["t"] <= t:
        i += 1
    a, b = keys[i], keys[i + 1]
    p = min(1, max(0, (t - a["t"]) / (b["t"] - a["t"]))) if b["t"] > a["t"] else 1
    e = EASE.get(a.get("e"), EASE["easeInOut"])(p)
    if isinstance(a["v"], (int, float)) and isinstance(b["v"], (int, float)):
        return a["v"] + (b["v"] - a["v"]) * e
    return b["v"] if e >= 0.5 else a["v"]


def camera_at(project: dict, t: float) -> dict:
    s = project["settings"]
    out = {"x": s["width"] / 2, "y": s["height"] / 2, "zoom": 1, "rotation": 0, "shake": 0, **project["camera"]["props"]}
    for k, lst in project["camera"]["keys"].items():
        if lst:
            out[k] = sample(lst, t)
    return out


def local_time(clip: dict, t: float) -> float:
    off = clip.get("offset", 0) or 0
    return round_t(min(off + clip["duration"], max(off, off + t - clip["start"])))


def write_prop(target: dict, key: str, val, lt: float, shown=None) -> str:
    arr = (target.get("keys") or {}).get(key)
    if not arr:
        target["props"][key] = val
        return f"{key} = {val!r}"
    hit = next((k for k in arr if abs(k["t"] - lt) < KEY_EPS), None)
    if hit:
        hit["v"] = val
    else:
        arr.append({"t": round_t(lt), "v": val, "e": "easeInOut"})
        arr.sort(key=lambda k: k["t"])
    return f"{key} 在 {num(round_t(lt if shown is None else shown))} 秒的關鍵影格 = {val!r}"


# ---------- clips ----------
def is_fill(type_name: str, props: dict) -> bool:
    if type_name == "particles" or type_name in FILL_FX:
        return True
    return type_name == "gen" and "w" not in (schema()["genPresets"].get(props.get("preset"), {}).get("d") or {})


def default_duration(project: dict, type_name: str, props: dict, start: float) -> float:
    dur = project["settings"]["duration"]
    if is_fill(type_name, props):
        return max(4, dur - start)
    if type_name in FX_DUR:
        return FX_DUR[type_name]
    if type_name == "sfx":
        return schema()["sfx"].get(props.get("voice", "pop"), {}).get("dur", 1)
    if type_name == "music":
        return max(8, dur - start)
    if type_name in ("audiofile", "legacy"):
        return project["assets"].get(props.get("asset"), {}).get("duration") or 4
    if type_def(type_name)["category"] == "transition":
        return 1
    return 4


def apply_pairs(clip: dict, pairs: list) -> dict:
    """Parse key=value pairs for a clip type; a preset pick also brings that preset's values, like the editor."""
    vals = {}
    for k, raw in pairs:
        if not prop_def(clip["type"], k):
            keys = "、".join(p["key"] for p in type_def(clip["type"])["props"])
            raise CliError(f"{clip['type']} 沒有 {k} 屬性，可用：{keys}")
        vals[k] = coerce(clip["type"], k, raw)
    if "preset" in vals and clip["type"] in ("particles", "gen"):
        vals = {**preset_props(clip["type"], vals["preset"]), **vals}
    return vals


def add(project, type_name, start, dur=None, track=None, name=None, bg=None, pairs=()):
    tdef = type_def(type_name)
    clip = {"id": "", "type": type_name, "name": name or tdef["label"], "start": num(round_t(max(0, start))), "duration": 0,
            "offset": 0, "props": default_props(type_name, project["settings"]), "keys": {}, "anim": {}, "blend": "source-over"}
    given = apply_pairs(clip, parse_pairs(pairs))
    clip["props"].update(given)
    if type_name == "text" and "letterSpacing" not in given:
        clip["props"]["letterSpacing"] = text_spacing(clip["props"])
    clip["duration"] = num(round_t(dur if dur else default_duration(project, type_name, clip["props"], start)))
    background = bg if bg is not None else (type_name == "gen" and is_fill(type_name, clip["props"]))
    tr = pick_track(project, kind_of(type_name), clip["start"], clip["duration"], track, background)
    clip["id"] = next_id(project, "c")
    tr["clips"].append(clip)
    tr["clips"].sort(key=lambda c: c["start"])
    extend_duration(project)
    return f"已新增 {clip['id']}（{tdef['label']}）於軌道 {tr['id']}「{tr['name']}」，{clip['start']} 秒起，長 {clip['duration']} 秒"


def set_values(project, target_id, pairs, at=None):
    pairs = parse_pairs(pairs)
    out = []
    if target_id == "settings":
        for k, raw in pairs:
            if k == "title":
                project["title"] = raw
            elif k in SETTINGS_FIELDS:
                project["settings"][k] = raw if k == "background" else num(float(raw))
            else:
                raise CliError(f"settings 沒有 {k}，可用：title、{'、'.join(SETTINGS_FIELDS)}")
            out.append(f"{k} = {raw}")
        return "；".join(out)
    if target_id == "camera":
        cam = project["camera"]
        for k, raw in pairs:
            if k not in ("x", "y", "zoom", "rotation", "shake"):
                raise CliError(f"鏡頭沒有 {k}，可用：x、y、zoom、rotation、shake")
            if cam["keys"].get(k) and at is None:
                raise CliError(f"鏡頭的 {k} 有關鍵影格，請加 --at 秒數 指定改哪一個時間點")
            out.append(write_prop(cam, k, num(float(raw)), at if at is not None else 0))
        return "；".join(out)
    tr = find_track(project, target_id)
    if tr:
        for k, raw in pairs:
            if k not in TRACK_FIELDS:
                raise CliError(f"軌道可設定：{'、'.join(TRACK_FIELDS)}")
            tr[k] = raw if k == "name" else raw.lower() in ("true", "1", "是")
            out.append(f"{k} = {tr[k]}")
        return "；".join(out)
    clip, track = require_clip(project, target_id)
    fields = [(k, v) for k, v in pairs if k in CLIP_FIELDS]
    props = [(k, v) for k, v in pairs if k not in CLIP_FIELDS]
    for k, raw in fields:
        clip[k] = raw if k in ("name", "blend") else num(round_t(float(raw)))
        out.append(f"{k} = {clip[k]}")
    if fields:
        others = [c for c in track["clips"] if c is not clip]
        if any(c["start"] < clip["start"] + clip["duration"] - EPS and c["start"] + c["duration"] > clip["start"] + EPS for c in others):
            out.append(f"注意：與同軌其他圖層重疊，建議用 move {clip['id']} --track new")
        track["clips"].sort(key=lambda c: c["start"])
        extend_duration(project)
    for k, v in apply_pairs(clip, props).items():
        if clip.get("keys", {}).get(k) and at is None:
            raise CliError(f"{clip['id']} 的 {k} 有關鍵影格，請加 --at 秒數（專案時間），或先 unkey {clip['id']} {k}")
        out.append(write_prop(clip, k, v, local_time(clip, at) if at is not None else 0, at))
    return "；".join(out)


def key(project, target_id, prop, t, raw, ease="easeInOut"):
    if ease not in schema()["ease"]:
        raise CliError(f"沒有 {ease} 緩動，可用：{'、'.join(schema()['ease'])}")
    if target_id == "camera":
        target, lt, val = project["camera"], round_t(t), num(float(raw))
        if prop not in ("x", "y", "zoom", "rotation", "shake"):
            raise CliError("鏡頭可設關鍵影格的屬性：x、y、zoom、rotation、shake")
    else:
        target, _ = require_clip(project, target_id)
        pd = prop_def(target["type"], prop)
        if not pd or not pd.get("anim"):
            ok = "、".join(p["key"] for p in type_def(target["type"])["props"] if p.get("anim"))
            raise CliError(f"{target['type']} 的 {prop} 不能設關鍵影格，可以的有：{ok}")
        if not (target["start"] - EPS <= t <= target["start"] + target["duration"] + EPS):
            raise CliError(f"{t} 秒不在 {target_id} 的範圍（{target['start']} 到 {num(round_t(target['start'] + target['duration']))} 秒）")
        lt, val = local_time(target, t), coerce(target["type"], prop, raw)
    arr = target.setdefault("keys", {}).setdefault(prop, [])
    hit = next((k for k in arr if abs(k["t"] - lt) < KEY_EPS), None)
    if hit:
        hit.update(v=val, e=ease)
    else:
        arr.append({"t": num(lt), "v": val, "e": ease})
        arr.sort(key=lambda k: k["t"])
    if target_id == "camera":
        extend_duration_to(project, t)
    return f"{target_id}.{prop} 關鍵影格：{len(arr)} 個"


def extend_duration_to(project, t):
    if t > project["settings"]["duration"]:
        project["settings"]["duration"] = num(math.ceil(t * 10) / 10)


def unkey(project, target_id, prop, t=None):
    target = project["camera"] if target_id == "camera" else require_clip(project, target_id)[0]
    arr = (target.get("keys") or {}).get(prop)
    if not arr:
        raise CliError(f"{target_id} 的 {prop} 沒有關鍵影格")
    if t is None:
        target["props"][prop] = arr[0]["v"]
        del target["keys"][prop]
        return f"已清除 {prop} 全部關鍵影格，固定為 {arr[0]['v']!r}"
    lt = round_t(t) if target_id == "camera" else local_time(target, t)
    i = next((i for i, k in enumerate(arr) if abs(k["t"] - lt) < KEY_EPS), None)
    if i is None:
        raise CliError(f"{prop} 在 {t} 秒沒有關鍵影格，現有：{'、'.join(str(k['t']) for k in arr)}（圖層內時間）")
    removed = arr.pop(i)
    if not arr:
        del target["keys"][prop]
        target["props"][prop] = removed["v"]
    return f"已刪除 {prop} 在 {num(t)} 秒的關鍵影格，剩 {len(arr)} 個"


def anim(project, clip_id, slot, anim_type, dur=None, speed=None, amount=None):
    clip, _ = require_clip(project, clip_id)
    table = schema()["anim"].get(slot)
    if table is None:
        raise CliError("動畫欄位只能是 in、out、loop")
    if anim_type == "none":
        clip.setdefault("anim", {}).pop(slot, None)
        return f"已移除 {clip_id} 的 {slot} 動畫"
    if anim_type not in table:
        raise CliError(f"{slot} 沒有 {anim_type}，可用：{'、'.join(table)}")
    if table[anim_type]["text"] and clip["type"] != "text":
        raise CliError(f"{anim_type} 只能用在文字圖層")
    a = {"type": anim_type}
    if slot == "loop":
        a.update(speed=speed or 1, amount=amount or 1)
    else:
        a["dur"] = dur or table[anim_type]["dur"] or 0.6
    clip.setdefault("anim", {})[slot] = a
    return f"{clip_id}.anim.{slot} = {a}"


def move(project, clip_id, start=None, track=None):
    clip, tr = require_clip(project, clip_id)
    if start is not None:
        clip["start"] = num(round_t(max(0, start)))
    tr["clips"].remove(clip)
    if track == "new":
        dest = new_track(project, kind_of(clip["type"]))
    else:
        dest = pick_track(project, kind_of(clip["type"]), clip["start"], clip["duration"], track or tr["id"])
    dest["clips"].append(clip)
    dest["clips"].sort(key=lambda c: c["start"])
    extend_duration(project)
    return f"{clip_id} 在軌道 {dest['id']}「{dest['name']}」，{clip['start']} 秒起"


def split(project, clip_id, t):
    clip, tr = require_clip(project, clip_id)
    if t <= clip["start"] + 0.05 or t >= clip["start"] + clip["duration"] - 0.05:
        raise CliError(f"分割點要在 {clip['start']} 到 {num(round_t(clip['start'] + clip['duration']))} 秒之間")
    cut = round_t(t - clip["start"])
    b = {**clip, "props": dict(clip["props"]), "keys": {k: [dict(x) for x in v] for k, v in clip.get("keys", {}).items()},
         "anim": {k: dict(v) for k, v in clip.get("anim", {}).items() if k != "in"}}
    b.update(id=next_id(project, "c"), start=num(round_t(t)), offset=num(round_t((clip.get("offset") or 0) + cut)),
             duration=num(round_t(clip["duration"] - cut)))
    clip["duration"] = num(cut)
    clip.get("anim", {}).pop("out", None)
    tr["clips"].insert(tr["clips"].index(clip) + 1, b)
    return f"已分割：{clip_id}（前段）與 {b['id']}（後段，{b['start']} 秒起）"


def delete(project, target_id):
    tr = find_track(project, target_id)
    if tr:
        if tr["clips"]:
            raise CliError(f"軌道 {target_id} 還有 {len(tr['clips'])} 個圖層，先刪除或移走它們")
        project["tracks"].remove(tr)
        return f"已刪除軌道 {target_id}"
    clip, tr = require_clip(project, target_id)
    tr["clips"].remove(clip)
    return f"已刪除 {target_id}"


def dup(project, clip_id, start=None):
    clip, tr = require_clip(project, clip_id)
    c = {**clip, "props": dict(clip["props"]), "keys": {k: [dict(x) for x in v] for k, v in clip.get("keys", {}).items()},
         "anim": {k: dict(v) for k, v in clip.get("anim", {}).items()}}
    c["start"] = num(round_t(start if start is not None else clip["start"] + clip["duration"]))
    dest = pick_track(project, kind_of(c["type"]), c["start"], c["duration"], tr["id"])
    c["id"] = next_id(project, "c")
    dest["clips"].append(c)
    dest["clips"].sort(key=lambda x: x["start"])
    extend_duration(project)
    return f"已複製為 {c['id']}，軌道 {dest['id']}，{c['start']} 秒起"


def track_add(project, kind, name=None, index=None):
    tr = new_track(project, kind, index, name)
    return f"已新增軌道 {tr['id']}「{tr['name']}」在第 {project['tracks'].index(tr)} 層（0 是最上層）"


def track_move(project, track_id, where):
    tr = find_track(project, track_id)
    if not tr:
        raise CliError(f"找不到軌道 {track_id}")
    i = project["tracks"].index(tr)
    j = i - 1 if where == "up" else i + 1 if where == "down" else int(where)
    j = max(0, min(len(project["tracks"]) - 1, j))
    project["tracks"].insert(j, project["tracks"].pop(i))
    return f"軌道 {track_id} 移到第 {j} 層（0 是最上層，越上面越蓋在前面）"


def camera_preset(project, preset, at, dur=2.0):
    cam, w = project["camera"], project["settings"]["width"]

    def set_keys(k, lst, t0, t1):
        keep = [x for x in cam["keys"].get(k, []) if x["t"] < t0 - 1e-3 or x["t"] > t1 + 1e-3]
        cam["keys"][k] = sorted(keep + lst, key=lambda x: x["t"])
        extend_duration_to(project, t1)

    t0 = num(round_t(at))
    if preset == "reset":
        s = project["settings"]
        cam["props"] = {"x": num(s["width"] / 2), "y": num(s["height"] / 2), "zoom": 1, "rotation": 0, "shake": 0}
        cam["keys"] = {}
        return "鏡頭已重設（清除所有運鏡）"
    if preset == "shake":
        t1 = num(round_t(t0 + 0.7))
        set_keys("shake", [{"t": t0, "v": 0, "e": "easeOut"}, {"t": round_t(t0 + 0.08), "v": 24, "e": "easeOut"}, {"t": t1, "v": 0, "e": "easeInOut"}], t0, t1)
        return f"已在 {t0} 秒加入震動"
    moves = {"pushIn": ("zoom", lambda v: v * 1.35), "pullOut": ("zoom", lambda v: v / 1.35),
             "panLeft": ("x", lambda v: v - w * 0.15), "panRight": ("x", lambda v: v + w * 0.15)}
    if preset not in moves:
        raise CliError("運鏡預設可用：pushIn、pullOut、panLeft、panRight、shake、reset")
    k, fn = moves[preset]
    t1 = num(round_t(t0 + dur))
    v0 = round(camera_at(project, t0)[k], 3)
    set_keys(k, [{"t": t0, "v": num(v0), "e": "easeInOut"}, {"t": t1, "v": num(round(fn(v0), 3)), "e": "easeInOut"}], t0, t1)
    return f"已加入 {preset}：{t0} 到 {t1} 秒，{k} 從 {num(v0)} 到 {num(round(fn(v0), 3))}"


# ---------- assets ----------
def asset_add(project, path, asset_id=None, name=None):
    aid = asset_id or next_id(project, "a")
    if aid in project["assets"]:
        raise CliError(f"素材 id {aid} 已存在")
    project["assets"][aid] = read_asset(path, aid, name)
    a = project["assets"][aid]
    size = f"{a['w']}x{a['h']}" if a["kind"] == "image" else "音訊"
    return f"已加入素材 {aid}（{a['kind']}，{size}，{len(a['src']) // 1024} KB）"


def asset_delete(project, asset_id):
    if asset_id not in project["assets"]:
        raise CliError(f"找不到素材 {asset_id}")
    users = [c["id"] for tr in project["tracks"] for c in tr["clips"] if c["props"].get("asset") == asset_id]
    if users:
        raise CliError(f"素材 {asset_id} 還被 {'、'.join(users)} 使用，先刪除這些圖層或改用其他素材")
    del project["assets"][asset_id]
    return f"已刪除素材 {asset_id}"
