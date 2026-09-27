"""Read-only commands: info, show, types, catalog. Output is compact so a small model can read it."""
import json

from p5m_core import CliError, find_track, num, require_clip, round_t, schema, type_def

MAIN_PROPS = {
    "text": ("text", "size", "fill"), "image": ("asset", "w"), "shape": ("kind", "w", "h", "fill"),
    "particles": ("preset", "count"), "gen": ("preset",), "shape3d": ("kind", "size"), "music": ("preset", "volume"),
    "sfx": ("voice",), "audiofile": ("asset",), "legacy": ("asset",),
}


def short(v, n=24) -> str:
    s = str(v).replace("\n", "⏎")
    return s if len(s) <= n else s[: n - 1] + "…"


def clip_line(c: dict) -> str:
    end = num(round_t(c["start"] + c["duration"]))
    bits = [f"{k}={short(c['props'][k])}" for k in MAIN_PROPS.get(c["type"], ()) if k in c["props"]]
    extra = []
    if c.get("keys"):
        extra.append("關鍵影格:" + ",".join(c["keys"]))
    anim = {k: v.get("type") for k, v in (c.get("anim") or {}).items() if v and v.get("type")}
    if anim:
        extra.append("動畫:" + ",".join(f"{k}={v}" for k, v in anim.items()))
    return f"  {c['id']:<6} {c['start']:>7}~{end:<7} {c['type']:<14} {short(c.get('name', ''), 12):<12} {' '.join(bits)} {' '.join(extra)}".rstrip()


def info(project: dict) -> str:
    s = project["settings"]
    lines = [f"標題：{project.get('title') or '（未命名）'}　{s['width']}x{s['height']}　{s['fps']}fps　片長 {s['duration']} 秒　背景 {s['background']}"]
    cam = project["camera"]
    ck = "、".join(f"{k}({len(v)})" for k, v in cam["keys"].items() if v) or "無"
    lines.append(f"鏡頭：zoom={cam['props'].get('zoom', 1)}　關鍵影格 {ck}")
    lines.append(f"素材：{'、'.join(a['id'] + '(' + a['kind'] + ')' for a in project['assets'].values()) or '無'}")
    lines.append("軌道（上面的蓋在下面的前面）：")
    for i, tr in enumerate(project["tracks"]):
        flags = [f for f, on in (("隱藏", tr.get("hidden")), ("靜音", tr.get("muted")), ("鎖定", tr.get("locked")),
                                  ("不跟鏡頭", tr.get("followCamera") is False)) if on]
        lines.append(f"[{i}] {tr['id']} 「{tr['name']}」 {tr['kind']} {' '.join(flags)}")
        lines.extend(clip_line(c) for c in tr["clips"])
    return "\n".join(lines)


def strip_data(v):
    if isinstance(v, str) and v.startswith("data:"):
        return v[:40] + f"…（{len(v) // 1024} KB）"
    if isinstance(v, dict):
        return {k: strip_data(x) for k, x in v.items()}
    return v


def show(project: dict, target: str) -> str:
    if target == "settings":
        return json.dumps({"title": project.get("title", ""), **project["settings"]}, ensure_ascii=False, indent=1)
    if target == "camera":
        return json.dumps(project["camera"], ensure_ascii=False, indent=1)
    if target in project["assets"]:
        return json.dumps(strip_data(project["assets"][target]), ensure_ascii=False, indent=1)
    tr = find_track(project, target)
    if tr:
        return json.dumps({k: v for k, v in tr.items() if k != "clips"} | {"clips": [c["id"] for c in tr["clips"]]}, ensure_ascii=False, indent=1)
    clip, tr = require_clip(project, target)
    return f"軌道 {tr['id']}\n" + json.dumps(clip, ensure_ascii=False, indent=1)


def prop_line(pd: dict) -> str:
    bits = [pd["type"]]
    if "default" in pd:
        d = pd["default"]
        bits.append("預設 " + ("畫布寬" if d == "$width" else "畫布高" if d == "$height" else short(json.dumps(d, ensure_ascii=False), 30)))
    if "min" in pd or "max" in pd:
        bits.append(f"範圍 {pd.get('min', '')}~{pd.get('max', '')}")
    if pd.get("options"):
        bits.append("選項 " + "、".join(f"{o['value']}({o['label']})" for o in pd["options"]))
    if pd.get("accept"):
        bits.append(f"填素材 id（{pd['accept']}）")
    if pd.get("anim"):
        bits.append("可關鍵影格")
    if pd.get("when"):
        bits.append("只在所選預設用到時有效" if pd["when"] == "preset-uses" else "條件 " + pd["when"])
    return f"  {pd['key']:<14} {pd['label']}{'（' + pd['unit'] + '）' if pd.get('unit') else ''}：{'；'.join(bits)}"


def types(name=None) -> str:
    sc = schema()
    if not name:
        rows = [f"  {k:<15} {v['label']}（{ {'visual': '畫面', 'screen': '全畫面', 'audio': '音訊'}[v['kind']] }）" for k, v in sc["types"].items()]
        return "圖層類型（types 類型名 看屬性）：\n" + "\n".join(rows)
    t = type_def(name)
    common = [p for p in t["props"] if p["key"] in sc["common"]]
    own = [p for p in t["props"] if p["key"] not in sc["common"]]
    out = [f"{name} {t['label']}"]
    if common:
        out.append("共用屬性：" + "、".join(p["key"] for p in common) + "（x、y 是中心點，預設畫布中央）")
    out.extend(prop_line(p) for p in own)
    return "\n".join(out)


def catalog(kind: str) -> str:
    sc = schema()
    if kind == "anim":
        out = []
        for slot, title in (("in", "入場 in"), ("out", "出場 out"), ("loop", "循環 loop")):
            items = [f"{k}({v['label']}{'，' + str(v['dur']) + '秒' if v['dur'] else ''}{'，限文字' if v['text'] else ''})" for k, v in sc["anim"][slot].items()]
            out.append(f"{title}：" + "、".join(items))
        return "\n".join(out)
    if kind in ("particles", "gen"):
        table = sc["particlePresets" if kind == "particles" else "genPresets"]
        return "\n".join(f"  {k:<12} {v['label']}　{json.dumps(v['d'], ensure_ascii=False) if v['d'] else ''}" for k, v in table.items())
    if kind == "ease":
        return "、".join(f"{k}({v})" for k, v in sc["ease"].items())
    if kind == "fonts":
        return "、".join(f"{f['family']}({f['label']})" for f in sc["fonts"])
    if kind == "blends":
        return "、".join(f"{k}({v})" for k, v in sc["blends"])
    if kind == "sfx":
        return "、".join(f"{k}({v['label']}，{v['dur']}秒)" for k, v in sc["sfx"].items())
    if kind == "music":
        return "、".join(f"{o['value']}({o['label']})" for o in type_def("music")["props"][0]["options"])
    raise CliError("catalog 可查：anim、particles、gen、ease、fonts、blends、music、sfx")
