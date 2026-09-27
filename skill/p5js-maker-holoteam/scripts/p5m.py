"""P5JS Maker command line: edit a .json project by typing, validate it, or build a whole video from a storyboard.

Usage: python p5m.py <command> ...   (python p5m.py -h lists every command; reference/API.md explains them)
Standard library only, Python 3.9+.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import p5m_build  # noqa: E402
import p5m_edit as ed  # noqa: E402
import p5m_view as view  # noqa: E402
from p5m_core import CliError, load, new_project, save  # noqa: E402
from p5m_validate import validate  # noqa: E402


def report_validation(project: dict) -> int:
    errors, warnings = validate(project)
    for w in warnings:
        print(f"警告：{w}")
    for e in errors:
        print(f"錯誤：{e}")
    print(f"檢查結果：{len(errors)} 個錯誤，{len(warnings)} 個警告" if errors or warnings else "檢查通過：0 錯誤 0 警告")
    return 1 if errors else 0


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="p5m", description="P5JS Maker 專案命令列（說明見 reference/API.md）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("new", help="建立空白專案")
    p.add_argument("file")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--duration", type=float, default=10)
    p.add_argument("--background", default="#101018")
    p.add_argument("--title", default="")

    for name, h in (("info", "列出軌道與圖層"), ("validate", "檢查專案")):
        sub.add_parser(name, help=h).add_argument("file")
    p = sub.add_parser("show", help="看某個圖層、軌道、素材、settings 或 camera 的完整內容")
    p.add_argument("file")
    p.add_argument("target")
    p = sub.add_parser("types", help="列出圖層類型，或某類型的屬性")
    p.add_argument("name", nargs="?")
    p = sub.add_parser("catalog", help="查清單：anim、particles、gen、ease、fonts、blends、music、sfx")
    p.add_argument("kind")

    p = sub.add_parser("add", help="新增圖層：add 檔案 類型 屬性=值 ...")
    p.add_argument("file")
    p.add_argument("type")
    p.add_argument("pairs", nargs="*")
    p.add_argument("--start", type=float, default=0)
    p.add_argument("--dur", type=float)
    p.add_argument("--track")
    p.add_argument("--name")
    p.add_argument("--bg", action="store_true", help="放到最底層（背景）")

    p = sub.add_parser("set", help="改屬性：set 檔案 目標 屬性=值 ...（目標可為圖層 id、軌道 id、settings、camera）")
    p.add_argument("file")
    p.add_argument("target")
    p.add_argument("pairs", nargs="+")
    p.add_argument("--at", type=float, help="屬性有關鍵影格時，要改的時間點（秒）")

    p = sub.add_parser("key", help="加關鍵影格：key 檔案 目標 屬性 秒 值")
    p.add_argument("file")
    p.add_argument("target")
    p.add_argument("prop")
    p.add_argument("t", type=float)
    p.add_argument("value")
    p.add_argument("--ease", default="easeInOut")

    p = sub.add_parser("unkey", help="刪關鍵影格：unkey 檔案 目標 屬性 [秒]（不給秒數就全刪）")
    p.add_argument("file")
    p.add_argument("target")
    p.add_argument("prop")
    p.add_argument("t", type=float, nargs="?")

    p = sub.add_parser("anim", help="設動畫：anim 檔案 圖層 in|out|loop 類型（none 移除）")
    p.add_argument("file")
    p.add_argument("clip")
    p.add_argument("slot", choices=("in", "out", "loop"))
    p.add_argument("type")
    p.add_argument("--dur", type=float)
    p.add_argument("--speed", type=float)
    p.add_argument("--amount", type=float)

    p = sub.add_parser("move", help="移動圖層：move 檔案 圖層 --start 秒 --track 軌道id|new")
    p.add_argument("file")
    p.add_argument("clip")
    p.add_argument("--start", type=float)
    p.add_argument("--track")

    p = sub.add_parser("split", help="在某秒切開圖層")
    p.add_argument("file")
    p.add_argument("clip")
    p.add_argument("t", type=float)
    p = sub.add_parser("delete", help="刪除圖層或空軌道")
    p.add_argument("file")
    p.add_argument("target")
    p = sub.add_parser("dup", help="複製圖層（預設接在後面）")
    p.add_argument("file")
    p.add_argument("clip")
    p.add_argument("--start", type=float)

    p = sub.add_parser("track", help="軌道：track add 檔案 visual|audio [--name] [--index] ／ track move 檔案 軌道id up|down|層數")
    tsub = p.add_subparsers(dest="action", required=True)
    q = tsub.add_parser("add")
    q.add_argument("file")
    q.add_argument("kind", choices=("visual", "audio"))
    q.add_argument("--name")
    q.add_argument("--index", type=int)
    q = tsub.add_parser("move")
    q.add_argument("file")
    q.add_argument("track")
    q.add_argument("where")

    p = sub.add_parser("camera", help="運鏡預設：camera 檔案 pushIn|pullOut|panLeft|panRight|shake|reset --at 秒")
    p.add_argument("file")
    p.add_argument("preset")
    p.add_argument("--at", type=float, default=0)
    p.add_argument("--dur", type=float, default=2.0)

    p = sub.add_parser("asset", help="素材：asset add 檔案 圖檔 [--id] [--name] ／ asset list 檔案 ／ asset delete 檔案 素材id")
    asub = p.add_subparsers(dest="action", required=True)
    q = asub.add_parser("add")
    q.add_argument("file")
    q.add_argument("path")
    q.add_argument("--id")
    q.add_argument("--name")
    asub.add_parser("list").add_argument("file")
    q = asub.add_parser("delete")
    q.add_argument("file")
    q.add_argument("id")

    p = sub.add_parser("plan", help="依片長建議場景數與字幕量")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--minutes", type=float)
    g.add_argument("--seconds", type=float)
    p.add_argument("--aspect", default="16:9", choices=tuple(p5m_build.SIZES))

    p = sub.add_parser("build", help="由分鏡 JSON 產生完整專案：build 分鏡.json -o 專案.json")
    p.add_argument("storyboard")
    p.add_argument("-o", "--out", required=True)
    return ap


def run(a) -> int:
    if a.cmd == "new":
        save(new_project(a.width, a.height, a.fps, a.duration, a.background, a.title), a.file)
        print(f"已建立 {a.file}（{a.width}x{a.height}，{a.duration:g} 秒）")
        return 0
    if a.cmd == "types":
        print(view.types(a.name))
        return 0
    if a.cmd == "catalog":
        print(view.catalog(a.kind))
        return 0
    if a.cmd == "plan":
        print(p5m_build.plan(a.minutes * 60 if a.minutes else a.seconds, a.aspect))
        return 0
    if a.cmd == "build":
        project, rows, warnings = p5m_build.build(Path(a.storyboard), Path(a.out))
        save(project, a.out)
        print(f"已產生 {a.out}：{project['settings']['width']}x{project['settings']['height']}，{project['settings']['duration']} 秒，"
              f"{sum(len(t['clips']) for t in project['tracks'])} 個圖層")
        print("\n".join(rows))
        for w in warnings:
            print(f"提醒：{w}")
        return report_validation(project)

    project = load(a.file)
    if a.cmd == "info":
        print(view.info(project))
        return 0
    if a.cmd == "show":
        print(view.show(project, a.target))
        return 0
    if a.cmd == "validate":
        return report_validation(project)
    if a.cmd == "asset" and a.action == "list":
        print("\n".join(f"{x['id']} {x['kind']} {x.get('name', '')} {str(x.get('w', '')) + 'x' + str(x.get('h', '')) if x['kind'] == 'image' else ''}"
                        for x in project["assets"].values()) or "沒有素材")
        return 0

    if a.cmd == "add":
        msg = ed.add(project, a.type, a.start, a.dur, a.track, a.name, True if a.bg else None, a.pairs)
    elif a.cmd == "set":
        msg = ed.set_values(project, a.target, a.pairs, a.at)
    elif a.cmd == "key":
        msg = ed.key(project, a.target, a.prop, a.t, a.value, a.ease)
    elif a.cmd == "unkey":
        msg = ed.unkey(project, a.target, a.prop, a.t)
    elif a.cmd == "anim":
        msg = ed.anim(project, a.clip, a.slot, a.type, a.dur, a.speed, a.amount)
    elif a.cmd == "move":
        msg = ed.move(project, a.clip, a.start, a.track)
    elif a.cmd == "split":
        msg = ed.split(project, a.clip, a.t)
    elif a.cmd == "delete":
        msg = ed.delete(project, a.target)
    elif a.cmd == "dup":
        msg = ed.dup(project, a.clip, a.start)
    elif a.cmd == "track":
        msg = ed.track_add(project, a.kind, a.name, a.index) if a.action == "add" else ed.track_move(project, a.track, a.where)
    elif a.cmd == "camera":
        msg = ed.camera_preset(project, a.preset, a.at, a.dur)
    elif a.cmd == "asset":
        msg = ed.asset_add(project, a.path, a.id, a.name) if a.action == "add" else ed.asset_delete(project, a.id)
    else:
        raise CliError(f"未知指令 {a.cmd}")
    save(project, a.file)
    print(msg)
    errors, _ = validate(project)
    if errors:
        print(f"注意：存檔後檢查有 {len(errors)} 個錯誤，第一個：{errors[0]}")
    return 0


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    try:
        return run(parser().parse_args(argv))
    except CliError as err:
        print(f"錯誤：{err}")
        return 1


def cli(args: list) -> int:
    """Run one command from Python code, e.g. p5m.cli(["info", "proj.json"]); argparse errors do not exit."""
    try:
        return main([str(a) for a in args])
    except SystemExit as err:
        return err.code if isinstance(err.code, int) else 1


if __name__ == "__main__":
    sys.exit(main())
