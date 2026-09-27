---
name: p5js-maker
description: >
  產出 P5JS Maker（p5.js 時間軸動畫編輯器）的專案 JSON，讓使用者能在編輯器時間軸上繼續修改；
  附驗證工具（檢查屬性、渲染取樣畫面、產生總覽圖）與獨立播放 HTML 匯出。
  觸發：使用者提到 P5JS Maker、p5maker、「做成能在時間軸編輯的動畫」、「產生 P5JS Maker 專案檔」、要把動畫交給編輯器繼續改。
  不觸發：一般「做一支 p5 動畫／節日動畫」且沒提到 P5JS Maker；修改 P5JS Maker 編輯器本身的程式碼。
version: 1.1.0
---

# P5JS Maker 專案產生

專案資料夾：clone 下來的 p5js-maker repo（下稱 `ROOT`）。安裝時把本檔所有 `<ROOT>` 換成實際路徑。

| 用途 | 位置 |
|---|---|
| 圖層類型、屬性、預設值、動畫預設完整參考 | `reference/types.md`（本 SKILL 資料夾內，由 registry 產生） |
| 驗證並渲染取樣畫面 | `ROOT/tools/check_project.py` |
| 本機圖片與音訊轉成內嵌 data URL | `ROOT/tools/embed_assets.py` |
| 匯出獨立播放 HTML | `ROOT/tools/build_player.py` |
| 範例專案 | `ROOT/examples/demo.json`、`ROOT/examples/smoke.json` |

寫 JSON 前先讀 `reference/types.md` 裡會用到的圖層段落，屬性名稱與選項值以該檔為準，不憑記憶。

## 流程

1. 跟使用者確認尺寸、長度、內容段落（沒指定就用 1280x720、30fps）。
2. 寫專案 JSON（UTF-8）。放使用者指定位置，沒指定就放 `ROOT/examples/<英文名>.json`。
3. 有本機圖片或音訊時，`src` 先填檔案路徑，再執行：
   ```bash
   python "<ROOT>/tools/embed_assets.py" 專案.json
   ```
4. 驗證並渲染：
   ```bash
   python "<ROOT>/tools/check_project.py" 專案.json
   ```
   常用參數：`--frames 16`（取樣張數）、`--times 0.5,3,7.2`（指定秒數）、`--out 資料夾`。
5. 用 Read 看輸出最後一行的 `sheet.png`（總覽圖），逐格確認：文字有沒有出界、圖層有沒有被蓋住、進出場時間對不對、有沒有黑畫面。需要細看就 Read 同資料夾的 `f_XX_秒數.png`。
6. 錯誤必修（exit code 1）。警告逐條判斷：重疊、預設值漏帶、超出專案長度這三類通常要修；「X 秒的畫面只有背景色」若剛好是轉場中點或刻意留黑則屬正常。修完回到步驟 4，直到 0 錯誤且總覽圖正確。
7. 交付（見文末）。回報時說明檢查了哪些秒數、剩下哪些警告與原因。

## JSON 骨架

```json
{
  "format": "p5maker", "version": 1, "title": "範例",
  "settings": { "width": 1280, "height": 720, "fps": 30, "duration": 8, "background": "#0b1a3a", "volume": 1 },
  "assets": {},
  "camera": { "props": { "zoom": 1 }, "keys": { "zoom": [ { "t": 0, "v": 1 }, { "t": 8, "v": 1.08, "e": "linear" } ] } },
  "tracks": [
    { "id": "tr_text", "name": "文字", "kind": "visual", "clips": [
      { "id": "c_title", "type": "text", "name": "標題", "start": 0.5, "duration": 7,
        "props": { "text": "中秋快樂", "font": "Noto Serif TC", "weight": 900, "size": 110, "fill": "#fff3c4", "y": 300, "glow": 20, "letterSpacing": 7 },
        "anim": { "in": { "type": "rise", "dur": 1.2 }, "out": { "type": "fade", "dur": 0.8 }, "loop": { "type": "float", "speed": 0.6, "amount": 0.5 } } }
    ] },
    { "id": "tr_fx", "name": "粒子", "kind": "visual", "clips": [
      { "id": "c_lanterns", "type": "particles", "start": 0, "duration": 8,
        "props": { "preset": "lanterns", "count": 24, "size": 26, "speed": 1, "wind": 0.1, "color": "#ffb84d", "color2": "#ff7a2f" } }
    ] },
    { "id": "tr_bg", "name": "背景", "kind": "visual", "clips": [
      { "id": "c_sky", "type": "gen", "start": 0, "duration": 8,
        "props": { "preset": "gradientSky", "color": "#0b1a3a", "color2": "#4a3a78", "color3": "#f29b76", "amount": 0.3 } }
    ] },
    { "id": "tr_audio", "name": "配樂", "kind": "audio", "clips": [
      { "id": "c_music", "type": "music", "start": 0, "duration": 8, "props": { "preset": "calm", "volume": 0.7 } }
    ] }
  ]
}
```

省略的欄位由 runtime 補預設值：軌道的 `hidden`／`muted`／`locked` 為 false、`followCamera` 為 true；圖層的 `offset` 為 0、`blend` 為 `source-over`、`keys`／`anim` 為空。

## 時間與圖層規則

- `tracks[0]` 在最上層，越後面越底層。背景放最後一條軌道。
- 圖層顯示區間是 `start` 到 `start + duration`（秒）。`start + duration` 不要超過 `settings.duration`。
- 同一條軌道的圖層時間不可重疊。編輯器自己不會產生重疊，手寫重疊會在時間軸上疊成一團不好點選。同時出現的圖層放不同軌道。
- 圖層關鍵影格 `keys.<屬性>` 的 `t` 是圖層內時間：0 代表圖層開始那一刻，不是專案時間。
- 鏡頭關鍵影格 `camera.keys` 的 `t` 是專案時間。鏡頭屬性：`x`、`y`（畫面中心對準的座標，預設畫布中心）、`zoom`、`rotation`（度）、`shake`（像素）。軌道設 `"followCamera": false` 就不受鏡頭影響（適合字幕、UI）。
- 關鍵影格格式 `{ "t": 秒, "v": 值, "e": 緩動 }`，`e` 是「這一格到下一格」的緩動，省略時是 `easeInOut`。同一屬性的關鍵影格依 `t` 由小到大排。
- 只有 types.md 中「關鍵影格」欄標「可」的屬性能加 keys。
- `props` 與 `keys` 同時存在時，keys 覆蓋 props。第一格之前維持第一格的值，最後一格之後維持最後一格的值。
- 入場／出場時長加總不要超過圖層 `duration`。

## 常見錯誤

| 錯誤寫法 | 正確寫法 |
|---|---|
| `"fill": "white"`、`"gold"` 等顏色名稱 | 只用 `#rrggbb`、`#rrggbbaa`、`rgb()`、`rgba()` |
| 文字不寫 `letterSpacing`（預設 0） | 字是逐字排版，描邊會吃掉字與字的空隙，看起來擠在一起。每個 `text` 圖層都寫字距：`round(size × 0.06 + strokeWeight × 0.5)`，最少 1（字級 30、描邊 6 約 5；字級 110 無描邊約 7） |
| `"weight": "700"`（字串） | `"weight": 700`（數字）。select 屬性的值型別要跟 types.md 完全一致 |
| 粒子或生成藝術只寫 `"preset": "moon"` | 把 types.md「預設值清單」該預設的整組屬性照抄進 `props`。編輯器選預設時會一併帶入這些值，runtime 讀 JSON 時不會，漏抄就會用錯顏色或尺寸 |
| 在 `fx_*`、`tr_*` 寫 `x`、`y`、`scale` | 全畫面特效與轉場沒有位置、縮放與濾鏡屬性，入場／出場只影響透明度 |
| 音訊圖層放在 visual 軌道 | `music`、`sfx`、`audiofile` 放 `"kind": "audio"` 的軌道；畫面圖層不可放 audio 軌道 |
| 音訊圖層加 keys 或 anim | 沒有作用。音量變化用 `volume`、`fadeIn`、`fadeOut` |
| `"src": "C:/pics/a.png"` | 執行 `embed_assets.py` 轉成 data URL，否則瀏覽器載不到 |
| 文字逐字動畫（`typewriter`、`rise`、`wave` 等）用在非文字圖層 | 只限 `text`，其他圖層改用一般入場／循環 |
| `"blend": "add"` | 用編輯器提供的混合模式：`source-over`（一般）、`multiply`、`screen`、`overlay`、`soft-light`、`lighter`（相加發光）、`difference` |
| 寬高寫死成 1280x720 的座標，畫布卻是直式 | 位置依 `settings.width`／`height` 計算，x、y 是圖層中心點 |

## 可用圖層（細節見 reference/types.md）

- 基本：`text` 文字、`shape` 形狀（矩形、圓、星、愛心、圓環等）、`image` 圖片、`code` 自訂 p5 程式碼
- 特效：`particles` 粒子（雪、雨、櫻花、天燈、煙火等 14 種）、`gen` 生成藝術（漸層天空、明月、山巒、極光等 12 種）、`shape3d` 3D 物件
- 全畫面：`fx_vignette`、`fx_grain`、`fx_grade`、`fx_blur`、`fx_glow`、`fx_tint`、`fx_lightLeak`、`fx_fade`、`fx_flash`、`fx_letterbox`
- 轉場：`tr_fadeThrough`、`tr_wipe`、`tr_iris`、`tr_blinds`、`tr_zoom`。轉場在圖層時間的中點完全遮住畫面，所以 `start = 交接秒數 - duration / 2`（時長 0.6 到 1.2 秒），放在最上層軌道
- 音訊：`music` 程式生成配樂、`sfx` 音效、`audiofile` 音訊檔
- `legacy` 是舊版 p5-comfyui-animation 專案，只能在編輯器素材庫「舊專案」匯入，不要手寫

`code` 圖層的程式碼會包成 `function (p, t, env, P5M)`：`p` 是 p5 實例，`t` 是圖層內秒數，`env.W`／`env.H` 是畫布尺寸。以 (0, 0) 為中心繪製，位置、縮放、進出場由圖層屬性處理。畫面必須只由 `t` 決定（不要用 `p.frameCount`、`p.random()` 累積狀態），否則拖動時間軸與匯出影片時畫面會跳。

## 交付

- 在編輯器開啟：執行 `ROOT/start.bat`（需要 Python）、GitHub Releases 的 `P5JSMaker.exe`，或線上版 https://nice923boss.github.io/p5js-maker/，按工具列「開啟」選 JSON。
- 獨立播放檔：
  ```bash
  python "<ROOT>/tools/build_player.py" 專案.json -o 輸出.html
  ```
- 影片由使用者在編輯器「匯出」即時錄製（依瀏覽器支援為 MP4 或 WebM），檢查工具不產生影片。

## 限制

- `check_project.py` 需要網路載入 p5.js（jsDelivr）與 Google Fonts；離線時會回報 runtime 載入失敗。
- 檢查工具只取樣靜態畫面，聲音內容與動作流暢度看不到，交付時要說明未驗證。
- 同軌重疊與預設值漏帶只會警告，不會自動修正。
