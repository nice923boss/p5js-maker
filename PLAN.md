# P5JS Maker 開發計畫

> 目標：讓 p5.js 動畫的製作像剪輯影片一樣，用時間軸拖拉、裁切、套預設動畫完成，不用寫程式。
> 參考：ClickDeckPro（網頁直接編輯 Claude 做的簡報 HTML）。

## 已定案的決策（使用者 2026-09-26 選定）

| 題目 | 決定 |
|---|---|
| 檔案格式 | 新的宣告式專案 JSON 為主；舊 p5-comfyui-animation 專案整段匯入成一個 clip（可移動、裁切、疊加，不可拆解） |
| 操作模式 | 剪映式為主（拖拉、裁切、分割、一鍵入場／出場／循環動畫），關鍵影格當進階 |
| 交付 | 純前端，可部署 GitHub Pages，另可包成 exe |
| v1 範圍 | 核心（畫布、時間軸、形狀／文字／圖片、入出場、關鍵影格、鏡頭、MP4 與 HTML 匯出）＋粒子與天氣、音訊軌、生成藝術與 3D、Claude 專用 SKILL |

## 架構

```
專案 JSON ──► runtime（P5M，classic script）──► p5 instance 畫布
   ▲                 ▲                              │
編輯器（ES modules）  └── 匯出 HTML 時整包內嵌 ──────┘
```

- 每一格畫面是時間 t 的純函式（沿用舊 engine.js 已驗證的做法），所以任意跳轉、拖曳播放頭都能即時算出畫面。
- 存檔 = 自帶播放器的單一 HTML，專案 JSON 放在 `<script type="application/json" id="p5maker-project">`；編輯器可再開啟同一個 HTML 繼續編輯（同 ClickDeckPro 直接編輯 .html 的思路）。
- 圖層類型用 registry 註冊（schema、預設值、draw），檢查器與關鍵影格依 schema 自動產生。
- 舊專案：隱藏的同源 srcdoc iframe 跑原本的 global mode sketch，`noLoop()` 後每格呼叫 `seek(t)`，再 `drawImage` 到主畫布；`SCORE` 讀出後交給本工具的音訊引擎排程。

### 技術選擇與證據等級（R1）

| 選擇 | 理由 | 證據 |
|---|---|---|
| p5.js 1.11.3 CDN | 與 11 支舊專案同版本 | A：舊專案實際在用 |
| 畫面 = f(t) | seek、拖曳播放頭、匯出都靠它 | A：舊 engine.js `seek()` 已在 11 支專案使用 |
| MediaRecorder 即時錄 MP4（Chrome／Edge 130+），不支援時退 WebM | 舊 engine.js 的 exportVideo 同做法 | A：舊專案實際匯出過 |
| 舊專案 iframe 合成 | 舊 sketch 是 global mode，不能直接放進 instance mode | 待 Spike 1 |
| WEBGL `createGraphics` 疊回 2D 畫布 | 3D 圖層 | 待 Spike 2 |
| File System Access API 開檔存檔，不支援時退下載 | Chrome／Edge 可直接覆寫原檔 | B：MDN 文件；Firefox 無此 API |
| IndexedDB 自動暫存 | 當機或誤關可救回 | B：MDN 文件 |
| PyInstaller onefile + 本機 http server | ClickDeckPro 已用同模式打包成功 | A：ClickDeckPro/editor/ClickDeckPro.spec |

## 里程碑

每個交付物標記：[實作] 可用且有真實素材驗收／[Shell] 介面有但實作空殼／[Spike] PoC／[Doc] 文件。

### M0 Spike
- Spike 1：舊專案 iframe 合成（holidays/qixi），量測單格 seek + drawImage 時間，讀出 FILM、SCORE。
- Spike 2：WEBGL 離屏畫布疊到 2D instance 畫布，量測單格時間。
- 通過標準：單格 < 20 ms（30 fps 預算 33 ms 內還要畫其他圖層）；讀得到 `FILM.duration === 24`。

### M1 Runtime
core（緩動、關鍵影格內插、種子亂數）、入出場／循環預設、形狀、文字、圖片、鏡頭、調整圖層、player。

### M2 編輯器
舞台（選取、移動、縮放、旋轉控制點、運動路徑）、多軌時間軸（拖拉、裁切、分割、吸附、縮放、關鍵影格菱形）、檢查器（◆ 關鍵影格切換、預設動畫）、播放控制、復原／重做、開檔存檔、自動暫存、快捷鍵。

### M3 特效
粒子與天氣（雪、雨、櫻花、螢火蟲、星星、彩帶、泡泡、火星、煙火、天燈）、生成藝術（流場、波浪、曼陀羅、點陣、星空、山巒、極光）、3D 圖層、程式碼 clip。

### M4 音訊
sound.js 全部音色、氛圍配樂預設、單次音效 clip、匯入音檔、舊專案 SCORE。

### M5 匯入與匯出
舊專案整段匯入、MP4 錄製、HTML 匯出、`tools/build_player.py`（給 Claude SKILL 用）。

### M6 包裝與 SKILL
exe（server.py + PyInstaller）、start.bat、Claude SKILL（JSON schema 說明、範例、驗證步驟）。

狀態：
- [實作] exe 與 start.bat（驗收見 dev-log「exe 打包」；實機雙擊未驗，見 GAPS G18）。
- [實作] SKILL `~/.claude/skills/p5js-maker/`：SKILL.md、`reference/types.md`（由 registry 產生）。
- [實作] 檢查工具：`tests/check.html`＋`tests/check.js`（屬性驗證、渲染）、`tools/check_project.py`（取樣畫面與總覽圖）、`tools/embed_assets.py`（本機素材轉 data URL）。驗收見 dev-log「Claude SKILL 與檢查工具」；離線與聲音未驗，見 GAPS G20 到 G22。

## DoD（R5 真實素材驗收）

1. 真實素材：Moon Festival 節日動畫資料夾（作者本機）根目錄＋ `holidays/` 10 支，共 11 支舊專案全部匯入，每支取 3 個時間點與 `_preview/f_*.png` 做像素差比對。
2. 新格式：用編輯器實際做一支 24 秒節日短片（文字、圖片素材、粒子、生成背景、3D、音訊、鏡頭推近），匯出 MP4 與 HTML，HTML 在瀏覽器獨立播放。
3. 人類抽檢：使用者開啟編輯器操作並觀看匯出影片（此項需使用者本人，AI 無法代替）。
4. dev-log：`docs/dev-log.md` 記錄時間、檢查項目、樣本路徑、數據。

## Pre-mortem（R6）

| 題目 | 回答 |
|---|---|
| 最可能失敗 | 舊專案合成：`const FILM` 不是 window 屬性、字型載入時序、iframe 與主畫布雙重繪製造成錄影掉格 |
| 失敗機率 | 舊檔合成 25%、3D 合成 10%、複雜專案即時錄影掉格 30%、編輯器互動細節（拖曳、吸附、裁切）首版 bug 多 60% |
| 早期訊號 | Spike 單格 > 20 ms；`cw.eval('FILM')` 取不到；file:// 開匯出 HTML 時 iframe 存取被擋 |
| 對策 | 用 iframe 的 `eval` 在其全域 scope 取 const；`document.fonts.load` 等字型；錄影前先預熱；互動用真實操作逐項驗 |
| 放棄條件 | 舊檔單格 > 40 ms 且無法優化 → 改成匯入時預先算影格序列（記憶體大，只當退路） |
| 替代方案 | 舊檔：影格序列 clip；3D：2D 假 3D（等角投影）；MP4：WebCodecs 離線編碼（見 GAPS） |
| 預估誤差 | 工時 ±50%；互動細節需要使用者試用後再修一輪 |
