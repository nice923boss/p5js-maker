"""plan and build: turn a short storyboard JSON into a complete, timed P5JS Maker project.

The small model only writes words and picks from menus; every time, size and position is computed here.
"""
import json
import re
from pathlib import Path

from p5m_core import CliError, default_props, new_project, num, preset_props, read_asset, round_t, schema, text_spacing

SIZES = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (1080, 1080)}
THEMES = {
    "warm": {"label": "溫暖", "sky": ("#2b1640", "#7a3b69", "#f2a65a"), "title_font": "Noto Serif TC", "text": "#fff3c4",
             "glow": "#ffb347", "shadow": "#000000cc", "overlays": ("sunburst", "clouds", "ripples", "flowfield"),
             "music": "warm", "particles": "dust", "cut": "#1a0e24"},
    "night": {"label": "夜空", "sky": ("#050a1f", "#1a2a5a", "#3a4a8a"), "title_font": "Noto Serif TC", "text": "#e8f0ff",
              "glow": "#8ab4ff", "shadow": "#000000cc", "overlays": ("moon", "aurora", "mountains", "starfield"),
              "music": "calm", "particles": "stars", "cut": "#02040c"},
    "fresh": {"label": "清新", "sky": ("#bfe9ff", "#e8f7ff", "#fff7d6"), "title_font": "Noto Sans TC", "text": "#1f3a2e",
              "glow": "#ffffff", "shadow": "#ffffffdd", "overlays": ("clouds", "waves", "sunburst", "ripples"),
              "music": "happy", "particles": "bubbles", "cut": "#ffffff"},
    "tech": {"label": "科技", "sky": ("#05060f", "#0d1030", "#1b0b3a"), "title_font": "Noto Sans TC", "text": "#e0fbff",
             "glow": "#4cc9f0", "shadow": "#000000cc", "overlays": ("flowfield", "dotgrid", "starfield", "ripples"),
             "music": "mystery", "particles": "dust", "cut": "#000000"},
    "romantic": {"label": "浪漫", "sky": ("#3a1030", "#8a3a6a", "#ffb3c6"), "title_font": "LXGW WenKai TC", "text": "#fff0f5",
                 "glow": "#ff8fb1", "shadow": "#000000cc", "overlays": ("sunburst", "clouds", "ripples", "mandala"),
                 "music": "romantic", "particles": "sakura", "cut": "#2a0820"},
    "festive": {"label": "喜慶", "sky": ("#3a0505", "#8a1010", "#e0a030"), "title_font": "LXGW WenKai TC", "text": "#ffe08a",
                "glow": "#ff9a3c", "shadow": "#000000cc", "overlays": ("sunburst", "mandala", "flowfield", "ripples"),
                "music": "festive", "particles": "lanterns", "cut": "#1a0202"},
}
LAYOUTS = ("cover", "caption", "side")
CAMERAS = ("pushIn", "pullOut", "still")
TRANSITIONS = ("fadeThrough", "wipe", "iris", "blinds", "zoom", "none")
TRACK_ORDER = (("transition", "轉場"), ("caption", "字幕"), ("subtitle", "副標"), ("title", "標題"), ("fx", "特效"), ("particles", "粒子"),
               ("image", "插圖"), ("background", "背景"), ("sky", "天空"))


# ---------- plan ----------
def plan(seconds: float, aspect: str = "16:9") -> str:
    if seconds < 15:
        raise CliError("影片至少 15 秒")
    scenes = max(3, min(24, round(seconds / 15)))
    per = seconds / scenes
    lines = max(1, round((per - 2) / 4.5))
    chars = "15 到 22" if aspect != "9:16" else "12 到 16"
    return "\n".join([
        f"總長 {num(round_t(seconds))} 秒（約 {seconds / 60:.1f} 分鐘），比例 {aspect}",
        f"建議場景數：{scenes} 場，每場約 {per:.1f} 秒",
        "第 1 場用 cover（片名），最後 1 場用 cover（結語），中間用 caption 或 side",
        f"中間每場字幕：{lines} 句，每句 {chars} 個字，一句約停留 4 到 5 秒",
        f"全片字幕約 {lines * max(1, scenes - 2)} 句",
    ])


# ---------- text layout ----------
def char_w(ch: str) -> float:
    if ch == " ":
        return 0.3
    return 0.55 if ord(ch) < 0x2E80 else 1.0


NO_START = set("，。、！？；：」』）》,.!?;:)")
WORD = re.compile(r"[A-Za-z0-9'’%.\-]+|.")


def wrap(text: str, size: float, max_w: float) -> list:
    """Greedy wrap by estimated glyph widths; keeps closing punctuation off the start of a line."""
    out = []
    for para in str(text).split("\n"):
        line, w = "", 0.0
        for tok in WORD.findall(para):  # latin words stay whole, CJK breaks per character
            cw = sum(char_w(ch) for ch in tok) * size
            if line and w + cw > max_w and tok[0] not in NO_START:
                out.append(line.rstrip())
                line, w = "", 0.0
                if tok == " ":
                    continue
            line += tok
            w += cw
        out.append(line)
    return out


def fit_text(text: str, size: float, max_w: float, max_lines: int, min_size: float):
    while True:
        lines = wrap(text, size, max_w)
        if len(lines) <= max_lines or size <= min_size:
            if len(lines) > 1 and "\n" not in str(text):
                # balance line lengths so the last line is not a lone character
                even = sum(char_w(ch) for ch in str(text)) * size / len(lines)
                for f in range(100, 160, 5):
                    balanced = wrap(text, size, min(max_w, even * f / 100))
                    if len(balanced) == len(lines):
                        lines = balanced
                        break
            return "\n".join(lines), num(round(size)), len(lines)
        size = max(min_size, size * 0.88)


# ---------- build ----------
class Builder:
    def __init__(self, board: dict, base_dir: Path):
        self.board, self.base_dir, self.warnings = board, base_dir, []
        self.theme = THEMES.get(board.get("style", "warm"))
        if not self.theme:
            names = "、".join(k + "（" + v["label"] + "）" for k, v in THEMES.items())
            raise CliError(f"style 只能是：{names}")
        aspect = board.get("aspect", "16:9")
        if aspect not in SIZES:
            raise CliError("aspect 只能是 16:9、9:16、1:1")
        self.W, self.H = SIZES[aspect]
        self.portrait = self.H > self.W
        self.base = min(self.W, self.H)
        total = board.get("seconds") or (board.get("minutes") or 0) * 60
        if not total or total < 15:
            raise CliError("請在分鏡寫 minutes（分鐘）或 seconds（秒），至少 15 秒")
        self.total = round_t(total)
        scenes = board.get("scenes") or []
        if not scenes:
            raise CliError("scenes 是空的，至少要 1 場")
        self.scenes = scenes
        self.p = new_project(self.W, self.H, 30, num(self.total), self.theme["sky"][0], board.get("title", ""))
        self.p["tracks"] = []
        self.tracks = {}
        for key, name in TRACK_ORDER + (("music", "配樂"),):
            tr = {"id": f"tr{len(self.p['tracks']) + 1}", "name": name, "kind": "audio" if key == "music" else "visual",
                  "hidden": False, "muted": False, "locked": False, "followCamera": key not in ("caption", "subtitle", "title"), "clips": []}
            self.p["tracks"].append(tr)
            self.tracks[key] = tr
        self.n = 0
        self.on_image = False

    def clip(self, track: str, type_name: str, start: float, dur: float, name: str, props=None, anim=None) -> dict:
        self.n += 1
        c = {"id": f"c{self.n}", "type": type_name, "name": name, "start": num(round_t(start)), "duration": num(round_t(dur)),
             "offset": 0, "props": {**default_props(type_name, self.p["settings"]), **(props or {})}, "keys": {}, "anim": anim or {},
             "blend": "source-over"}
        if type_name == "text" and "letterSpacing" not in (props or {}):
            c["props"]["letterSpacing"] = text_spacing(c["props"])
        self.tracks[track]["clips"].append(c)
        return c

    def warn(self, msg: str):
        self.warnings.append(msg)

    def timings(self) -> list:
        weights = []
        for sc in self.scenes:
            w = sc.get("weight")
            weights.append(float(w) if isinstance(w, (int, float)) and w > 0 else 1.5 + len(sc.get("lines") or []))
        total_w = sum(weights)
        out, t = [], 0.0
        for i, w in enumerate(weights):
            end = self.total if i == len(weights) - 1 else round(t + self.total * w / total_w, 1)
            out.append((round_t(t), round_t(end)))
            t = end
        for i, (s, e) in enumerate(out):
            if e - s < 3:
                self.warn(f"第 {i + 1} 場只有 {e - s:.1f} 秒，太短，建議減少場景或加長影片")
        return out

    def text_props(self, text, size, max_w, max_lines, role) -> dict:
        # text over a full-screen picture is always light with a dark edge, whatever the theme
        th = {**self.theme, "text": "#ffffff", "shadow": "#000000cc"} if self.on_image else self.theme
        wrapped, fs, n = fit_text(text, size, max_w, max_lines, size * 0.6)
        props = {"text": wrapped, "size": fs, "fill": th["text"], "weight": 700, "font": "Noto Sans TC",
                 "stroke": th["shadow"], "strokeWeight": max(1.5, round(fs * 0.035, 1))}
        if role == "title":
            props.update(font=th["title_font"], weight=900 if th["title_font"] == "Noto Sans TC" else 700, glow=28, glowColor=th["glow"])
        else:
            props.update(glow=18, glowColor=th["shadow"])
        return props, n

    def add_image(self, sc: dict, idx: int, s: float, e: float, layout: str) -> bool:
        path = sc.get("image")
        if not path:
            return False
        p = Path(path)
        if not p.is_absolute():
            p = self.base_dir / p
        if not p.is_file():
            self.warn(f"第 {idx + 1} 場找不到圖片 {path}，改用生成背景")
            return False
        aid = f"img{idx + 1}"
        asset = read_asset(p, aid, sc.get("title") or f"場景{idx + 1}")
        if asset["kind"] != "image":
            self.warn(f"第 {idx + 1} 場的 {path} 不是圖片，改用生成背景")
            return False
        self.p["assets"][aid] = asset
        ratio = asset["w"] / asset["h"]
        if layout == "side":
            w = self.W * (0.8 if self.portrait else 0.4)
            x, y = (self.W / 2, self.H * 0.33) if self.portrait else (self.W * 0.3, self.H / 2)
            props = {"asset": aid, "w": num(round(w)), "x": num(round(x)), "y": num(round(y)), "radius": 24, "glow": 30, "glowColor": "#000000aa"}
            anim = {"in": {"type": "zoomIn", "dur": 0.8}, "out": {"type": "fade", "dur": 0.6}}
        else:
            w = max(self.W, self.H * ratio) * 1.02
            props = {"asset": aid, "w": num(round(w)), "brightness": 0.78 if layout == "caption" or sc.get("lines") else 0.9}
            anim = {}
        self.clip("image", "image", s, e - s, f"插圖 {idx + 1}", props, anim)
        return True

    def add_background(self, sc: dict, idx: int, s: float, e: float):
        preset = sc.get("background") or self.theme["overlays"][idx % len(self.theme["overlays"])]
        if preset == "none":
            return
        if preset not in schema()["genPresets"] or preset == "gradientSky":
            self.warn(f"第 {idx + 1} 場的 background {preset} 不存在，改用 {self.theme['overlays'][0]}")
            preset = self.theme["overlays"][0]
        props = {"preset": preset, **preset_props("gen", preset), "opacity": 0.45 if preset in ("sunburst", "clouds") else 0.7}
        if preset == "moon":
            props.update(x=num(round(self.W * 0.76)), y=num(round(self.H * 0.28)))
        if preset == "mandala":
            props.update(opacity=0.35)
        self.clip("background", "gen", s, e - s, f"背景 {idx + 1}", props, {"in": {"type": "fade", "dur": 0.8}})

    def add_texts(self, sc: dict, idx: int, s: float, e: float, layout: str):
        W, H, b = self.W, self.H, self.base
        title, subtitle, lines = sc.get("title", ""), sc.get("subtitle", ""), [x for x in (sc.get("lines") or []) if str(x).strip()]
        if layout == "side":
            col_w, cx = (W * 0.86, W / 2) if self.portrait else (W * 0.46, W * 0.73)
            head_y, cap_y = (H * 0.66, H * 0.8) if self.portrait else (H * 0.3, H * 0.56)
        else:
            col_w, cx = W * (0.86 if self.portrait else 0.84), W / 2
            head_y, cap_y = H * 0.14, H * (0.78 if self.portrait else 0.8)
        centered = layout == "cover" or not lines
        if title:
            size = b * (0.12 if centered else 0.07)
            props, n = self.text_props(title, size, col_w if not centered else W * 0.86, 2 if centered else 1, "title")
            y = H * (0.4 if subtitle else 0.46) if centered else head_y
            props.update(x=num(round(cx if not centered else W / 2)), y=num(round(y)))
            end_pad = 0.4
            self.clip("title", "text", s + 0.3, e - s - 0.3 - end_pad, f"標題 {idx + 1}", props,
                      {"in": {"type": "rise", "dur": 1.2}, "out": {"type": "fade", "dur": 0.6}})
            if subtitle:
                sp, _ = self.text_props(subtitle, b * 0.05, W * 0.8, 2, "body")
                sp.update(x=num(round(W / 2)), y=num(round(y + props["size"] * (1.3 * n / 2 + 0.9))), weight=400)
                self.clip("subtitle", "text", s + 1.0, e - s - 1.0 - end_pad, f"副標 {idx + 1}", sp,
                          {"in": {"type": "fade", "dur": 0.8}, "out": {"type": "fade", "dur": 0.6}})
        elif subtitle:
            self.warn(f"第 {idx + 1} 場只有 subtitle 沒有 title，副標已略過")
        if not lines:
            return
        t0, t1 = s + (1.2 if title else 0.4), e - 0.4
        slot = (t1 - t0) / len(lines)
        if slot < 2.5:
            self.warn(f"第 {idx + 1} 場字幕太多（每句只有 {slot:.1f} 秒），建議刪句或加長")
        for i, line in enumerate(lines):
            props, n = self.text_props(line, b * 0.055, col_w, 3, "body")
            if n > 2:
                self.warn(f"第 {idx + 1} 場第 {i + 1} 句太長，排成 {n} 行，建議縮短")
            props.update(x=num(round(cx)), y=num(round(cap_y)))
            a, z = round(t0 + i * slot, 1), round(t0 + (i + 1) * slot - 0.15, 1)
            self.clip("caption", "text", a, z - a, f"字幕 {idx + 1}-{i + 1}", props,
                      {"in": {"type": "fade", "dur": 0.4}, "out": {"type": "fade", "dur": 0.4}})

    def add_camera(self, sc: dict, idx: int, s: float, e: float):
        mode = sc.get("camera", "pushIn" if idx % 2 == 0 else "pullOut")
        if mode not in CAMERAS:
            self.warn(f"第 {idx + 1} 場的 camera {mode} 不存在，改用 still")
            mode = "still"
        a, b = {"pushIn": (1, 1.08), "pullOut": (1.08, 1), "still": (1, 1)}[mode]
        keys = self.p["camera"]["keys"].setdefault("zoom", [])
        keys.append({"t": num(round_t(s)), "v": a, "e": "sine"})
        keys.append({"t": num(round_t(max(s + 0.1, e - 0.05))), "v": b, "e": "hold"})

    def add_transition(self, sc: dict, idx: int, cut: float):
        kind = sc.get("transition", "fadeThrough")
        if kind == "none":
            return
        if kind not in TRANSITIONS:
            self.warn(f"第 {idx + 1} 場的 transition {kind} 不存在，改用 fadeThrough")
            kind = "fadeThrough"
        props = {} if kind == "zoom" else {"color": self.theme["cut"]}
        self.clip("transition", f"tr_{kind}", cut - 0.5, 1.0, f"轉場 {idx + 1}", props)

    def add_particles(self, spans: list):
        default = self.board.get("particles", self.theme["particles"])
        runs = []
        for (s, e), sc in zip(spans, self.scenes):
            pr = sc.get("particles", default) or "none"
            if pr != "none" and pr not in schema()["particlePresets"]:
                self.warn(f"粒子 {pr} 不存在，已略過，可用：{'、'.join(schema()['particlePresets'])}")
                pr = "none"
            if runs and runs[-1][0] == pr:
                runs[-1][2] = e
            else:
                runs.append([pr, s, e])
        for pr, s, e in runs:
            if pr != "none":
                self.clip("particles", "particles", s, e - s, f"粒子 {pr}", {"preset": pr, **preset_props("particles", pr), "opacity": 0.85},
                          {"in": {"type": "fade", "dur": 1.0}, "out": {"type": "fade", "dur": 1.0}})

    def build(self) -> dict:
        th, T = self.theme, self.total
        spans = self.timings()
        sky = {"preset": "gradientSky", **preset_props("gen", "gradientSky")}
        sky.update(color=th["sky"][0], color2=th["sky"][1], color3=th["sky"][2])
        self.clip("sky", "gen", 0, T, "天空", sky)
        self.clip("fx", "fx_vignette", 0, T, "暗角", {"amount": 0.4 if th["text"] != "#1f3a2e" else 0.2})
        for i, (sc, (s, e)) in enumerate(zip(self.scenes, spans)):
            layout = sc.get("layout") or ("cover" if i in (0, len(self.scenes) - 1) else "caption")
            if layout not in LAYOUTS:
                self.warn(f"第 {i + 1} 場的 layout {layout} 不存在，改用 caption")
                layout = "caption"
            has_img = self.add_image(sc, i, s, e, layout)
            if layout == "side" and not has_img:
                layout = "caption"
            self.on_image = has_img and layout != "side"
            if not has_img or layout == "side":
                self.add_background(sc, i, s, e)
            self.add_texts(sc, i, s, e, layout)
            self.add_camera(sc, i, s, e)
            if i < len(self.scenes) - 1:
                self.add_transition(sc, i, e)
        self.add_particles(spans)
        self.clip("transition", "fx_fade", 0, 1.0, "開場淡入", {"mode": "in", "color": "#000000"})
        self.clip("transition", "fx_fade", T - 2, 2.0, "結尾淡出", {"mode": "out", "color": "#000000"})
        music = self.board.get("music", th["music"])
        if music and music != "none":
            options = [o["value"] for o in schema()["types"]["music"]["props"][0]["options"] if o["value"] != "score"]
            if music not in options:
                self.warn(f"music {music} 不存在，改用 {th['music']}")
                music = th["music"]
            self.clip("music", "music", 0, T, "配樂", {"preset": music, "volume": 0.7, "fadeIn": 1, "fadeOut": 3})
        for tr in self.p["tracks"]:
            tr["clips"].sort(key=lambda c: c["start"])
        self.p["tracks"] = [tr for tr in self.p["tracks"] if tr["clips"]]
        self.spans = spans
        return self.p


def build(board_path: Path, out_path: Path):
    try:
        board = json.loads(Path(board_path).read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        raise CliError(f"找不到分鏡檔：{board_path}")
    except ValueError as err:
        raise CliError(f"分鏡檔不是有效的 JSON：{err}")
    b = Builder(board, Path(board_path).resolve().parent)
    project = b.build()
    rows = [f"  第 {i + 1} 場 {s:>6.1f}~{e:<6.1f} 秒　{(sc.get('title') or (sc.get('lines') or [''])[0])[:16]}" for i, (sc, (s, e)) in enumerate(zip(b.scenes, b.spans))]
    return project, rows, b.warnings
