# P5JS Maker

用時間軸編輯 p5.js 動畫，操作方式參考剪映：拖拉圖層、裁切、分割、關鍵影格，做完匯出影片或獨立播放的 HTML。

線上使用：https://nice923boss.github.io/p5js-maker/

## 功能

- 多軌時間軸：拖拉、裁切、分割、吸附、縮放，關鍵影格菱形
- 舞台直接選取、移動、縮放、旋轉，顯示運動路徑
- 圖層類型 26 種
  - 基本：文字（逐字入場動畫）、形狀、圖片、自訂 p5 程式碼
  - 粒子與天氣 14 種：雪、雨、櫻花、天燈、煙火、彩帶等
  - 生成藝術 12 種：漸層天空、明月、山巒、極光、流場等
  - 3D 物件、全畫面特效（暗角、顆粒、調色、漏光等）、轉場 5 種
  - 音訊：程式生成配樂、音效、匯入音檔
- 鏡頭：推近、平移、旋轉、晃動，可設關鍵影格
- 匯入舊版 p5-comfyui-animation 專案（整段當一個圖層）
- 匯出：即時錄製 MP4 或 WebM（依瀏覽器支援），或獨立播放的 HTML
- 復原／重做、自動暫存、快捷鍵

## 使用方式

| 方式 | 說明 |
|---|---|
| 線上版 | 直接開上面的網址 |
| Windows exe | 到 [Releases](https://github.com/nice923boss/p5js-maker/releases) 下載 `P5JSMaker.exe`，雙擊後會在預設瀏覽器開啟；結束請執行 `stop.bat` |
| 本機原始碼 | clone 後雙擊 `start.bat`（需要 Python 3），或 `python tools/serve.py` |

編輯器必須經 http 開啟，直接雙擊 `index.html` 無法匯出 HTML。

範例專案在 `examples/`：`demo.json`（24 秒示範片）、`smoke.json`（所有圖層類型）。工具列「開啟」選 JSON 即可載入。

## 給 Claude 用的 SKILL

`skill/p5js-maker/` 讓 Claude 產生可在編輯器繼續修改的專案 JSON，並自動檢查。

1. 把 `skill/p5js-maker` 複製到 `~/.claude/skills/`。
2. 把 `SKILL.md` 裡所有 `<ROOT>` 換成本 repo 的實際路徑。
3. 安裝檢查工具需要的套件：
   ```bash
   pip install playwright pillow
   ```
   ```bash
   python -m playwright install chromium
   ```
4. 對 Claude 說「做一支 P5JS Maker 專案」即可觸發。

| 工具 | 用途 |
|---|---|
| `tools/check_project.py` | 驗證專案 JSON、渲染取樣畫面與總覽圖，有錯誤時 exit 1 |
| `tools/embed_assets.py` | 本機圖片與音訊轉成 data URL 寫進專案 |
| `tools/build_player.py` | 專案 JSON 轉成獨立播放 HTML |

## 給 HoloTeam（小模型）用的 SKILL

`skill/p5js-maker-holoteam/` 讓 HoloTeam 搭配開源小模型用打字做動畫：說出主題與片長，一問一答問清內容，內建生圖配插圖，產出專案 JSON；也能用指令修改既有專案。只需要 Python 3.9 以上，不用裝套件。

1. 把 `skill/p5js-maker-holoteam` 整個資料夾複製到 vault 的 `.claude/skills/`，或 `~/.claude/skills/`。
2. HoloTeam 設定開啟 python 工具；要配插圖就在「設定、AI 引擎、生成模型」填入生圖 API Key。
3. 對 HoloTeam 說「幫我做一支動畫」或「修改P5JS動畫」即可觸發。

| 檔案 | 用途 |
|---|---|
| `scripts/p5m.py` | 指令介面：建立、查看、修改、檢查專案，由分鏡產生整支影片 |
| `reference/API.md` | 全部指令說明與編輯器操作對照表（不用 SKILL 也能照這份文件打字改專案） |
| `reference/types.md` | 26 種圖層類型的屬性、預設值、選項 |

## 已知限制

完整清單見 [GAPS.md](GAPS.md)。

- p5.js 與 Google Fonts 走 CDN，離線無法使用。
- 影片是即時錄製：24 秒的片要錄 24 秒，錄製時切到其他分頁會嚴重掉格，片尾約多 0.35 秒。
- 存檔覆寫原檔需要 File System Access API，Firefox 與 Safari 會改成下載新檔。
- Safari 18 以前不支援 Canvas 濾鏡，模糊、亮度等效果無效。
- 複雜畫面（極光加兩個 3D 物件）單格渲染約 34 到 39 ms，可能低於 30 fps。
- exe 沒有程式碼簽章，第一次執行 Windows SmartScreen 可能跳出警告，按「其他資訊」再「仍要執行」。
- 舊專案只能整段移動與裁切，不能拆成個別圖層；`_v1_papercut` 舊格式不支援。

## 授權

[MIT](LICENSE)

製作者：黃政文
