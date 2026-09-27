"""Project validator: a standard-library port of tests/check.js (same rules, same messages)."""
import json
import math
import re

from p5m_core import schema

CAMERA = ("x", "y", "zoom", "rotation", "shake")
ASSET_KINDS = ("image", "audio", "legacy")
HIDDEN_PROPS = {"music": ["score"]}
BLENDS = {
    "source-over", "source-in", "source-out", "source-atop", "destination-over", "destination-in", "destination-out",
    "destination-atop", "lighter", "copy", "xor", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge",
    "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
}
HEX = re.compile(r"^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
RGB = re.compile(r"^rgba?\(\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*(,\s*[-\d.]+\s*)?\)$", re.I)


def js(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def is_color(v) -> bool:
    return isinstance(v, str) and bool(HEX.match(v.strip()) or RGB.match(v.strip()))


def is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def check_value(pd: dict, v, project: dict):
    t = pd["type"]
    if t in ("number", "range"):
        if not is_num(v):
            return "error", f"必須是數字，目前是 {js(v)}"
        if "min" in pd and v < pd["min"]:
            return "warn", f"{v} 小於最小值 {pd['min']}"
        if "max" in pd and v > pd["max"]:
            return "warn", f"{v} 大於最大值 {pd['max']}"
        return None
    if t == "select":
        values = [o["value"] for o in pd.get("options", [])]
        ok = any(v == o and isinstance(v, str) == isinstance(o, str) and isinstance(v, bool) == isinstance(o, bool) for o in values)
        return None if ok else ("error", f"{js(v)} 不是可用選項，可用：{'、'.join(js(o) for o in values)}")
    if t == "color":
        return None if is_color(v) else ("error", f"{js(v)} 不是顏色，請用 #rrggbb、#rrggbbaa 或 rgba(r,g,b,a)")
    if t == "bool":
        return None if isinstance(v, bool) else ("error", f"必須是 true 或 false，目前是 {js(v)}")
    if t == "asset":
        if v in ("", None):
            return "warn", "尚未指定素材，這個圖層不會顯示內容"
        a = project["assets"].get(v) if isinstance(v, str) else None
        if not a:
            return "error", f"找不到素材 {js(v)}（assets 裡沒有這個 id）"
        return None if a.get("kind") == pd.get("accept") else ("error", f"素材 {v} 的 kind 是 {a.get('kind')}，這裡需要 {pd.get('accept')}")
    if t == "font":
        if not isinstance(v, str):
            return "error", "必須是字型名稱字串"
        known = any(f["family"] == v for f in schema()["fonts"])
        return None if known else ("warn", f"字型 {js(v)} 不在內建清單，其他電腦可能沒有")
    return None if isinstance(v, str) else ("error", f"必須是字串，目前是 {js(v)}")


def check_keys(keys, lookup, project, t_min, t_max, where, add):
    for k, lst in (keys or {}).items():
        pd = lookup(k)
        at = f"{where}.keys.{k}"
        if not pd:
            add("error", at, "沒有這個屬性，無法設關鍵影格")
            continue
        if not pd.get("anim"):
            add("warn", at, "這個屬性不支援關鍵影格，編輯器不會顯示")
        if not isinstance(lst, list) or not lst:
            add("error", at, "必須是非空陣列 [{ t, v, e }]")
            continue
        for i, key in enumerate(lst):
            t = key.get("t")
            if not is_num(t):
                add("error", f"{at}[{i}].t", "必須是數字（秒）")
            elif t < t_min - 1e-6 or t > t_max + 1e-6:
                add("warn", f"{at}[{i}].t", f"{num_str(t)} 超出 {num_str(t_min)} 到 {num_str(t_max)} 秒，這段不會播到")
            if i > 0 and is_num(t) and is_num(lst[i - 1].get("t")) and t < lst[i - 1]["t"]:
                add("error", f"{at}[{i}].t", "關鍵影格必須依 t 由小到大排列")
            bad = check_value(pd, key.get("v"), project)
            if bad:
                add(bad[0], f"{at}[{i}].v", bad[1])
            if "e" in key and key["e"] not in schema()["ease"]:
                add("error", f"{at}[{i}].e", f"沒有 {js(key['e'])} 這種緩動，可用：{'、'.join(schema()['ease'])}")


def num_str(v) -> str:
    return str(int(v)) if float(v).is_integer() else str(round(v, 3))


def check_anim(clip, tdef, where, add):
    tables = schema()["anim"]
    used = 0.0
    for slot, a in (clip.get("anim") or {}).items():
        at = f"{where}.anim.{slot}"
        if slot not in tables:
            add("error", at, "anim 只能有 in、out、loop")
            continue
        if not a or not a.get("type") or a["type"] == "none":
            continue
        preset = tables[slot].get(a["type"])
        if not preset:
            add("error", at + ".type", f"沒有 {js(a['type'])}，可用：{'、'.join(tables[slot])}")
            continue
        if preset["text"] and clip.get("type") != "text":
            add("warn", at + ".type", f"{a['type']} 只對文字圖層有效")
        for k in ("dur", "speed", "amount"):
            if k in a and not (is_num(a[k]) and a[k] > 0):
                add("error", f"{at}.{k}", "必須是正數")
        if slot != "loop":
            d = a.get("dur")
            used += d if is_num(d) else preset["dur"] if preset["dur"] is not None else 0.6
    if tdef["kind"] == "audio" and used:
        add("warn", where + ".anim", "音訊圖層不會套用動畫")
    if is_num(clip.get("duration")) and used > clip["duration"] + 1e-6:
        add("warn", where + ".anim", f"入場加出場共 {used:.2f} 秒，超過圖層長度 {num_str(clip['duration'])} 秒")


def type_defaults(type_name: str) -> dict:
    return {pd["key"]: pd["default"] for pd in schema()["types"][type_name]["props"] if "default" in pd}


def validate(src: dict):
    """Returns (errors, warnings) as lists of 'path：message' strings."""
    errors, warnings = [], []

    def add(level, at, msg):
        (errors if level == "error" else warnings).append(f"{at}：{msg}")

    types = schema()["types"]
    s = src.get("settings") or {}
    for k in ("width", "height", "duration"):
        if not (is_num(s.get(k)) and s[k] > 0):
            add("error", "settings." + k, "必須是正數")
    bg = s.get("background")
    if bg is not None and bg != "transparent" and not is_color(bg):
        add("error", "settings.background", '必須是顏色或 "transparent"')
    dur = s.get("duration") if is_num(s.get("duration")) else 10
    project = {"assets": src.get("assets") or {}}

    for aid, a in project["assets"].items():
        at = f"assets.{aid}"
        if a.get("id") != aid:
            add("error", at + ".id", "id 必須與 assets 的鍵相同")
        if a.get("kind") not in ASSET_KINDS:
            add("error", at + ".kind", f"必須是 {'、'.join(ASSET_KINDS)}")
        if not isinstance(a.get("src"), str) and a.get("kind") != "legacy":
            add("error", at + ".src", "缺少 src")
        elif a.get("kind") != "legacy" and not re.match(r"^(data:|https?:)", a["src"]):
            add("error", at + ".src", "本機路徑無法載入，請用 p5m.py asset add 轉成內嵌資料")

    cam = src.get("camera") or {}
    for k, v in (cam.get("props") or {}).items():
        if k not in CAMERA:
            add("warn", "camera.props." + k, f"鏡頭沒有這個屬性，可用：{'、'.join(CAMERA)}")
        elif not is_num(v):
            add("error", "camera.props." + k, "必須是數字")
    cam_lookup = lambda k: {"key": k, "type": "number", "anim": True} if k in CAMERA else None  # noqa: E731
    check_keys(cam.get("keys"), cam_lookup, project, 0, dur, "camera", add)

    ids = set()

    def dupe(i, at):
        if i in ids:
            add("error", at, f"id {js(i)} 重複")
        ids.add(i)

    for ti, tr in enumerate(src.get("tracks") or []):
        tw = f"tracks[{ti}]"
        if tr.get("id"):
            dupe(tr["id"], tw + ".id")
        if tr.get("kind") not in ("visual", "audio"):
            add("error", tw + ".kind", '必須是 "visual" 或 "audio"')
        clips = tr.get("clips") or []
        for ci, c in enumerate(clips):
            where = f"{tw}.clips[{ci}]"
            if c.get("id"):
                dupe(c["id"], where + ".id")
            tdef = types.get(c.get("type"))
            if not tdef:
                add("error", where + ".type", f"沒有 {js(c.get('type'))} 這種圖層，可用：{'、'.join(types)}")
                continue
            is_audio = tdef["kind"] == "audio"
            if is_audio != (tr.get("kind") == "audio"):
                add("error", where + ".type", "音訊圖層必須放在 kind \"audio\" 的軌道，否則不會播放" if is_audio else "畫面圖層放在音訊軌道上不會顯示")
            start, cdur = c.get("start"), c.get("duration")
            if not (is_num(start) and start >= 0):
                add("error", where + ".start", "必須是 0 以上的數字")
            if not (is_num(cdur) and cdur > 0):
                add("error", where + ".duration", "必須是正數")
            elif is_num(start) and start >= dur:
                add("warn", where + ".start", f"在片長 {num_str(dur)} 秒之後，不會出現")
            elif is_num(start) and start + cdur > dur + 1e-6:
                add("warn", where + ".duration", f"結束於 {num_str(start + cdur)} 秒，超過片長 {num_str(dur)} 秒的部分不會播放")
            if "blend" in c and c["blend"] not in BLENDS:
                add("error", where + ".blend", f"{js(c['blend'])} 不是有效的混合模式")

            by_key = {pd["key"]: pd for pd in tdef["props"]}
            props = c.get("props") or {}
            for k, v in props.items():
                pd = by_key.get(k)
                if not pd and k in HIDDEN_PROPS.get(c["type"], []):
                    continue
                if not pd:
                    extra = "（全畫面特效、轉場與音訊沒有位置與濾鏡屬性）" if k in schema()["common"] else ""
                    add("warn", f"{where}.props.{k}", f"{c['type']} 沒有這個屬性，會被忽略{extra}")
                    continue
                bad = check_value(pd, v, project)
                if bad:
                    add(bad[0], f"{where}.props.{k}", bad[1])
            table = schema()["particlePresets"] if c["type"] == "particles" else schema()["genPresets"] if c["type"] == "gen" else None
            if table:
                name = props.get("preset", by_key["preset"].get("default"))
                preset = table.get(name)
                if preset and preset["d"]:
                    tdefaults = type_defaults(c["type"])
                    keys = c.get("keys") or {}
                    missing = [k for k, v in preset["d"].items() if k not in props and not keys.get(k) and v != tdefaults.get(k)]
                    if missing:
                        pairs = ", ".join(f'"{k}": {js(preset["d"][k])}' for k in missing)
                        add("warn", where + ".props", f"預設 {name} 在編輯器會一併帶入 {pairs}；沒寫時會用類型預設值，外觀可能不同")
            off = c.get("offset") if is_num(c.get("offset")) else 0
            check_keys(c.get("keys"), by_key.get, project, off, off + (cdur if is_num(cdur) else 0), where, add)
            if is_audio and c.get("keys"):
                add("warn", where + ".keys", "音訊圖層只取開始時的值，關鍵影格沒有作用")
            check_anim(c, tdef, where, add)

        ok = sorted((c for c in clips if is_num(c.get("start")) and is_num(c.get("duration")) and c["duration"] > 0), key=lambda c: c["start"])
        a = ok[0] if ok else None
        for b in ok[1:]:
            if b["start"] < a["start"] + a["duration"] - 1e-6:
                add("warn", tw, f"{a.get('id') or a['type']} 與 {b.get('id') or b['type']} 在同一軌時間重疊，建議放到不同軌道")
            if b["start"] + b["duration"] > a["start"] + a["duration"]:
                a = b
    return errors, warnings
