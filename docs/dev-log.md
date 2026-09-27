# 開發紀錄

## 2026-09-26 Runtime 冒煙測試

環境：內建瀏覽器（Chromium），`python -m http.server 38920`，專案 `examples/smoke.json`（8 秒，含 6 軌、14 個 clip）。

| 項目 | 結果 |
|---|---|
| 圖層類型註冊 | 26 種 |
| 單格渲染時間 | t = 0, 0.5, 1, 2.5, 2.8, 3.9, 4.2, 6, 7.9：5.3 到 12.6 ms，第一格動態畫面 21 ms（含 3D 暖機） |
| 點選框 | 每格 6 到 8 個 |
| 轉場 | `tr_wipe` 在 3.9 秒亮度比例掉到 0.039、4.2 秒 0.407，符合覆蓋過程 |
| 截圖檢查 | 發現月亮光暈有方形硬邊（光暈半徑大於 w×h 範圍卻用 fillRect），改成畫圓，重截確認消失 |
| Console | 無錯誤；只有測試頁自己 getImageData 的效能提示 |
| 音訊 | `P5M.audio.play` 排程耗時約 270 到 300 ms，改成排程期間先暫停 AudioContext 時鐘；錄音串流 RMS 0.03 到 0.08（有訊號）；音色與混音未試聽（AI 無法聽） |
| 匯出播放器 | `tools/build_player.py` 產出 130 KB 單檔；無殘留佔位字串 |
| 播放器 `?t=3` | 第一次全黑：canvas 被 JS fit() 設成 0×0（載入當下視窗尺寸為 0）；改用 CSS `object-fit: contain` 後正常 |
| 播放器 UI | 播放鈕、進度條、時間標籤、下載影片鈕、全螢幕鈕都顯示；點播放後時間前進 |
| MP4 錄製 | rAF 驅動時視窗被遮住只錄到 3 格；改計時器驅動後 2 秒錄到 67 格，1280×720 `video/mp4;codecs=avc1.640028,mp4a.40.2`，1.38 MB，畫格間平均差 5.6（有動畫），含音軌 |

未驗證：file:// 開啟匯出 HTML、舊專案匯入（待編輯器完成後做 11 支比對）。

## 2026-09-26 編輯器操作驗收

環境：內建瀏覽器（Browser pane 隱藏狀態，rAF 暫停），`tools/serve.py`。

| 項目 | 結果 |
|---|---|
| 素材庫 | 70 張卡片逐一加入，0 錯誤 |
| 時間軸 | 拖曳移動、右側裁切、重疊自動開新軌、S 分割（anim 與 offset 正確）、Ctrl+Z／Ctrl+Y 與按鈕狀態 |
| 關鍵影格 | 建立與自動寫入正確；畫面拖曳在有／無關鍵影格兩種狀態都正確 |
| 快捷鍵 | Ctrl+D、Ctrl+C、Ctrl+V、Home、方向鍵、Delete |
| 其他 | Splitter 與 localStorage 記憶、草稿還原（IndexedDB） |
| 匯出 HTML | stub 下載，產出內容在 iframe 播放正常 |
| 匯出 MP4 | 9.35 秒（專案 9.0 秒），1280×720，各時間點畫面與專案一致 |

修正：
- 舊專案分頁顯示「nullnull」：原生 `replaceChildren` 會把 null 轉成字串，library.js 加 `filter(Boolean)`；fields.js 同類寫法一併改。
- 連續點卡片時起點錯開（入場動畫把播放頭往後移的副作用）：actions.js 記住 `introSeek`，播放頭沒被使用者移動前，後續加入仍從同一起點。
- Ctrl+C／Ctrl+V 在 `e.code` 為空時無效：shortcuts.js 改用 `e.code` 或 `e.key` 比對，也涵蓋非 QWERTY 鍵盤與中文輸入法。
- 匯出範圍選單寫死「0:00」：改顯示實際片長。
- 分割 sfx 後 B 段會在原起點重播音效：runtime 排程限制在 clip 範圍內。

## 2026-09-26 舊專案匯入驗收（Moon Festival 11 支）

方法：驗收伺服器以同源 `/moon/` 唯讀提供 Moon Festival 節日動畫資料夾（作者本機）；模擬資料夾選取（File 物件加 `webkitRelativePath`），走真正的 `importLegacy()` 流程。原始檔未修改。

| 項目 | 結果 |
|---|---|
| 匯入 | 12 個資料夾：匯入 11 個，略過 `_v1_papercut`（提示「略過 1 個舊版格式資料夾」），3 秒完成，0 錯誤 |
| 片長 | 根目錄 30 秒，holidays/ 10 支各 24 秒，與 FILM.duration 一致 |
| 配樂 | 11 支都帶入 SCORE；卡片加入時間軸時自動多一條「・配樂」music clip（同長度） |
| 素材大小 | 每支 270 到 600 KB（data URL 圖片內嵌），11 支合計約 4.2 MB |
| 草稿 | 含 11 支舊專案的草稿可從 IndexedDB 還原 |

像素比對：同源 iframe 開原始 `index.html` 並 `seek(t)` 當參考，與編輯器 `renderFrame` 完整管線比較，降採樣 160×90，每支取 5 個時間點（0.5、1/4、1/2、3/4、結尾前 0.5 秒）。

| 專案 | 平均絕對差（0 到 255） |
|---|---|
| 9 支（烤肉夜、湯圓、立蛋、水燈、天燈、跨年、清明、鵲橋、迎春） | 全部時間點 0 |
| children 紙飛機 | 5.39、1.17、0.17、0.02、0 |
| national 河畔煙火 | 10.21、2.80、0.69、0.12、0 |

差異來源確認在原始 sketch，不在編輯器：同一個原始 `index.html` 內連續 `seek(0.5)` 兩次，national 就差 10.7、children 差 3.3。同一 t 重繪 4 到 5 次後收斂到 0；原始頁 60fps 與 30fps 逐格播到同一 t 結果完全相同，所以逐格播放與匯出 MP4 與原片一致，只有跳躍式單張預覽與播放狀態差約 1.3 到 1.5（見 GAPS G9）。

修正：切換專案時舊專案 iframe（每個都是完整 p5 頁面）不會釋放，匯入 11 支後開新專案會留下 11 個孤兒 iframe。`P5M.assets.release(keepIds)` 在 `loadProject` 時清掉新專案沒用到的 images、audio、legacy 快取；實測載入中釋放與載入完成後釋放都從 11 個降到 0，0 錯誤。smoke 測試回歸通過（26 種類型，9 個時間點渲染 0.1 到 9.8 ms）。

未驗證：
- 可見面板下的即時播放（本次 Browser pane 隱藏，rAF 暫停）。
- inspector「動畫」分頁。
- 試聽（AI 無法聽）。
- 存檔與開檔（File System Access picker 無法自動化）。

## 2026-09-26 示範片效能修正（examples/demo.json）

環境：內建瀏覽器（Chromium，Browser pane 隱藏），RTX 4050，`tests/smoke.html?project=../examples/demo.json`。

量測方法與限制：
- 上界：每格渲染後讀 1 像素強制 GPU 同步。只要有 GPU 工作就多出約 9 到 10 ms 回讀延遲，偏高。
- 下界：連續渲染 30 格後才讀一次像素，可能被瀏覽器丟棄被覆蓋的繪製，偏低。
- `createImageBitmap` 本身約 10 ms，不能當同步手段。
- pane 隱藏時 rAF 暫停，無法量實際播放 fps（見 GAPS G14）。

修正 1：粒子 sprite 與底片顆粒貼圖變慢。
- 現象：t=20 煙火粒子軌 133 ms，每次 `drawImage(sprite)` 約 7 ms；內容相同的新畫布只要 1.9 ms。
- 對 sprite 做一次 `putImageData` 就恢復，確認是畫布後端狀態，不是繪圖邏輯。
- 處理：`types-particles.js` softDot 與 `types-effects.js` grainTile 的快取畫布改用 `willReadFrequently: true`（CPU 畫布）。每 60 次繪製 16.5 ms 降到 0.2 ms，畫面平均亮度差 0.001 到 0.05／255。
- 觸發條件未查明（見 GAPS G15）。

修正 2：多次繪製的圖層加濾鏡極慢。
- 原因：`ctx.filter` 有值時 Chrome 每次繪製呼叫都付數 ms。
- 加 blur 時單層每格：粒子約 800 ms、煙火 5081 ms、極光 7974 ms、雲 224 ms。
- 處理：`renderer.js` 新增 `drawFiltered`，有濾鏡的圖層先無濾鏡畫進整張暫存畫布，再帶濾鏡與 blend 一次合成。上述圖層降到 10 到 35 ms，與原做法平均差 ≤ 0.64／255。
- 第一版只做文字專用暫存層，整層套透明度，有光暈的標題比原本暗（平均差 2.1 到 2.96）；改成暫存層內逐形狀套透明度後一致，文字專用版已移除。
- 回歸：smoke.json 10 種類型全部加 blur 2，無 console 錯誤、亮度比例一致；code 圖層（p5 API）加 blur 正常，結束後 `drawingContext` 與填色快取已還原；wipe reveal 加 blur 裁切正確。
- 同類掃描：其餘 `ctx.filter` 使用處（fx 模糊、glow、zoom 轉場）都只做一次全畫面 drawImage，不需改。
- 語意差異：走濾鏡路徑時 clip 的 blend 是整層套用，直接路徑是逐形狀套用。同一 clip 自身重疊的部分，在濾鏡開關那一格可能有細微跳動（見 GAPS G16）。

修正 3：字寬快取在字型載入前就寫入。`document.fonts` 的 `loadingdone` 事件清空 widthCache 並通知重繪。

未採用：極光改共用漸層。每條光帶約 214 個 fillRect、4 條約 856 次繪製，瓶頸在 GPU 端，改寫後沒有可量到的差異，已還原。

修正後分段量測（每 0.25 秒取一格）：

| 區段 | 上界中位數／p90（ms） | 下界平均（ms） |
|---|---|---|
| 0 到 8 秒 | 11.7／18.1 | 1.8 |
| 8 到 16 秒（極光＋兩個 3D） | 34 到 38.7／40 到 45 | 9.5 到 13.2 |
| 16 到 24 秒 | 15.4／16.6 | 1.4 |

8 到 16 秒上界超過 30fps 的 33 ms，下界在內；兩次量測有差異，實際播放是否掉格要在可見瀏覽器確認。

## 2026-09-26 示範片播放器

`python tools/build_player.py examples/demo.json -o examples/demo_player.html`，138 KB，無殘留佔位字串。

| 項目 | 結果 |
|---|---|
| 開啟 | 內建瀏覽器以本機檔案開啟（pane 轉成 data: 快照，不經本機伺服器），26 種類型載入，0 console 錯誤 |
| 跳轉 | seek 3、12、20、23.9 秒，時間標籤正確；23.9 秒淡出後亮度 0.29 |
| 與 runtime 比對 | t=12 同一區塊平均色，播放器與 smoke 頁完全相同 |
| 截圖 | 0 秒月亮、天燈、雲；12 秒極光、3D、星形、副標，版面正常 |

修正：截圖發現「亮面」3D 物件顏色錯誤，橘色甜甜圈顯示成藍白色。p5 的 `specularMaterial()` 只設高光色，物體本身顏色來自 `fill()`，原本沒設所以是預設白色。`types-3d.js` 改成 `fill(顏色)` 加白色高光，重截確認甜甜圈為橘色。素材庫兩張「亮面」卡片（藍色球體、黃色圓柱）與 smoke.json 的甜甜圈走同一行，一併修正；`smoke_player.html` 同步重建。

未驗證：斷網狀態（p5.js 與 Google Fonts 仍走 CDN，見 GAPS G4）、可見狀態下的播放流暢度（G14）。

## 2026-09-26 exe 打包

`python -m PyInstaller tools/P5JSMaker.spec --distpath dist --workpath build --noconfirm`，產出 `dist/P5JSMaker.exe` 單檔 9.1 MB（視窗模式，無主控台）。入口是 `tools/serve.py`，與 `start.bat` 共用：凍結狀態下從 `sys._MEIPASS` 提供內嵌的 index.html、css、js、runtime，輸出寫到 exe 旁的 `P5JSMaker.log`，啟動後一律開瀏覽器。

測試時以 `BROWSER` 環境變數指向記錄用 bat，不開使用者真正的瀏覽器，只記錄被開啟的網址。

| 項目 | 結果 |
|---|---|
| 啟動 | 監聽 127.0.0.1:38920，開瀏覽器網址記錄正確 |
| MIME 與快取 | `main.js` 回 `text/javascript`，全部回應帶 `Cache-Control: no-cache` |
| 重複啟動 | 第二次執行偵測到已在執行（比對 `<title>`），exit 0，只開瀏覽器不再綁埠 |
| 連接埠被佔用 | 非本程式佔用時綁埠失敗 WinError 10048，exit 1；關掉 `allow_reuse_address` 後不會與其他程式共用連接埠 |
| stop.bat | 依 netstat 找到監聽 PID 並結束，連接埠釋放 |
| log | 請求紀錄與「P5JS Maker 已在執行」中文訊息正確寫入（Git Bash 管線顯示亂碼只是 CP950 顯示問題） |
| 編輯器 | 從 exe 伺服器載入，26 種類型，footer 顯示製作者 |
| 匯出 HTML | stub 下載，133,240 bytes，無殘留佔位字串，含 3D 修正 |

未驗證：
- `start.bat` 在真實主控台視窗執行（只在 Bash 下測 `serve.py`）。
- 連接埠衝突時的 MessageBox（視窗模式下才會出現，測試時只確認 exit code 與 log）。
- 斷網（G4）。

## 2026-09-26 Claude SKILL 與檢查工具

SKILL 位置 `~/.claude/skills/p5js-maker/`：`SKILL.md`（7 步流程、JSON 骨架、時間與圖層規則、常見錯誤表、交付方式、限制）與 `reference/types.md`（`python tools/check_project.py --types-md` 由 runtime registry 產生，屬性名稱與選項跟程式碼同步）。

工具：

| 檔案 | 用途 |
|---|---|
| `tests/check.html`、`tests/check.js` | 載入 runtime，驗證專案 JSON（型別、選項、顏色、關鍵影格排序、軌道種類、同軌重疊、預設值漏帶），並渲染指定秒數 |
| `tools/check_project.py` | Playwright 開檢查頁，輸出錯誤／警告、取樣畫面 `f_XX_秒數.png` 與總覽圖 `sheet.png`；有錯誤時 exit 1 |
| `tools/embed_assets.py` | 把 `src` 為本機路徑的圖片與音訊轉成 data URL，補上 `w`、`h`、`duration` |

| 測試 | 結果 |
|---|---|
| 故意寫錯的 `bad.json` | 14 錯誤、18 警告，全部對應植入的錯誤（顏色名稱、字串 weight、不存在的類型／緩動／混合模式、重複 id、本機路徑、音訊放錯軌道、屬性不存在、超出片長、同軌重疊、預設值漏帶等） |
| SKILL.md 內的 JSON 骨架 | 0 錯誤 0 警告，總覽圖正常 |
| 生日片 `birthday.json`（10 軌：轉場、固定字幕、特效、文字、物件、程式碼、粒子、背景、配樂、音效） | 內嵌前 exit 1，正確指出本機路徑；`embed_assets.py` 後 0 錯誤 0 警告，12 格總覽圖逐格確認（放射背景、愛心、蓋章標題、彩帶、圓形轉場、星空、蛋糕圖片、程式碼圓環、3D 甜甜圈、打字機字幕不隨鏡頭移動），無異常；`build_player.py` 輸出 202 KB |
| 同一片素材拿掉 `w`、`h` | 蛋糕圖片維持正圓（修正前會被拉成 4:3） |
| `examples/demo.json` | 0 錯誤 0 警告，12 格總覽圖正常 |
| `examples/smoke.json` | 0 錯誤 10 警告；4.00 秒只有背景色是 `tr_wipe` 中點，屬正常 |

測試中發現並修正：
- runtime `normalizeProject`：手寫素材沒有 `name` 時，錯誤訊息顯示「圖片載入失敗：undefined」、素材庫名稱空白。改為預設用素材 id。
- runtime `image` 圖層：素材沒有 `w`、`h`（網址圖片或手寫）時一律當 4:3。改為讀圖片實際比例。
- 同軌重疊檢查原本只比相鄰兩個圖層，一個長圖層蓋住後面多個圖層時會漏報。改為跟「目前最晚結束的圖層」比對；smoke 警告從 9 項變 10 項，新增的 c_box 與 c_code 重疊確實存在。
- `demo.json` 是 SKILL 指定的範例，原本特效軌有重疊、粒子缺編輯器預設帶入的 `speed`、`wind`。特效拆成特效、漏光、暗角三軌並補值，改為 0 錯誤 0 警告。
- SKILL.md 初稿寫影片匯出為 WebM、混合模式清單與編輯器不同，已改成「MP4 或 WebM（依瀏覽器）」與編輯器實際清單。

重建：`examples/demo_player.html`（139 KB）、`examples/smoke_player.html`（134 KB）、`dist/P5JSMaker.exe`（9,098,266 bytes）。exe 以 `BROWSER` 指向記錄用 bat 重新啟動，提供的 `renderer.js`、`types-basic.js` 含新程式碼，首頁 200，結束後連接埠 38920 釋放、無殘留程序。

未驗證：
- 離線執行檢查工具（G20）。
- 生日片與示範片的聲音內容（G8、G22）。
- 由另一個 Claude 對話實際觸發 SKILL（本次在同一對話內照 SKILL.md 步驟執行）。

## 2026-09-26 發布到 GitHub Pages

repo `nice923boss/p5js-maker`（公開、MIT），Pages 從 `main` 根目錄提供：https://nice923boss.github.io/p5js-maker/ 。exe 與 `stop.bat` 放在 Release v1.0.0，不進 git。`skill/p5js-maker/` 是 SKILL 公開版，本機路徑改成 `<ROOT>`。文件中的本機路徑改成文字描述。

| 項目 | 結果 |
|---|---|
| 線上版 | 首頁 200，26 種類型載入，footer 顯示製作者，載入過程無 console 錯誤 |
| 開啟 demo.json | 19 軌，標題正確，12 秒預覽畫面正常 |
| 匯出 HTML | stub 下載，142,916 bytes（Pages 上 fetch runtime 正常） |
| Release | `P5JSMaker.exe` 9,098,266 bytes、`stop.bat` 386 bytes |

未驗證：線上版錄製影片、手機與 Firefox／Safari 開啟、其他人照 README 安裝 SKILL。

## 2026-09-27 使用說明頁

導覽列新增「使用說明」連結，開啟 `help.html`（15 個章節，各區塊操作步驟）。`tools/P5JSMaker.spec` 已把 `help.html` 加入打包清單，exe 已重建（9,109,158 bytes）：以 `BROWSER` 指向記錄用 bat 啟動，`index.html`、`help.html` 皆 200 且大小與原始檔相同，stop.bat 結束後連接埠 38920 釋放、無殘留程序。Release v1.0.0 上的 exe 仍是舊版，沒有這一頁。

## 2026-09-27 HoloTeam 版 SKILL 與指令介面

判定：原本的 `skill/p5js-maker` 不能直接給 HoloTeam 小模型用。它要求手寫整份專案 JSON、用 Playwright 渲染取樣畫面、再由模型看圖判斷，小模型寫長 JSON 易出錯、也不一定能讀圖。

新增 `skill/p5js-maker-holoteam/`：

| 檔案 | 內容 |
|---|---|
| `scripts/p5m.py` 與 `p5m_*.py` | 只用標準庫的指令介面：new、info、show、validate、types、catalog、add、set、key、unkey、anim、move、split、dup、delete、track、camera、asset、plan、build；python 工具可用 `p5m.cli([...])` 呼叫 |
| `reference/API.md` | 指令說明、編輯器操作對照表、分鏡格式、常見錯誤 |
| `reference/types.md`、`schema.json` | 26 種圖層類型屬性，由 `tools/export_schema.js` 從 runtime 匯出 |
| `templates/storyboard_example.json` | 分鏡範例 |
| `SKILL.md` | 骨架 A：開場、6 題訪談、plan 排場景、generate_image 配圖、寫分鏡並 build、交付、修改模式 |

| 測試 | 結果 |
|---|---|
| 驗證器與 `tests/check.js` 對照 | 同一批錯誤專案，錯誤與警告一致 |
| build：16:9 warm、9:16 fresh 3 分鐘、1:1 night | 皆 0 錯誤 0 警告，渲染取樣畫面人工檢視無異常 |
| API.md 每個範例指令 | 輸出與文件一致，預期的錯誤訊息正確出現 |
| 模擬 HoloTeam 流程（假 vault、工作目錄在 vault 根、相對路徑） | plan、build 0 錯誤 0 警告；階段 6 修改表 21 個指令全部成功，最後 validate 0 錯誤 0 警告 |
| `holoteam-skill-writer/scripts/check_skill.py SKILL.md A` | 必查 8 項通過，提醒 0 項 |

測試中發現並修正：匯入音樂不給 `--dur` 只放 4 秒（腳本讀不出音訊長度），SKILL 與 API.md 改為要求一律帶 `--dur`（G25）；分鏡範例原本 5 場與 1 分鐘 plan 建議的 4 場不一致，改成 4 場。

未驗證：HoloTeam 小模型實際觸發與對話（G23）、FLUX.2 klein 生圖（G24）。

## 2026-09-27 文字預設字距

文字是逐字排版，描邊會吃掉字與字的空隙，字距 0 時字幕看起來擠在一起。新增文字時改為依字級與描邊帶入字距：`round(size × 0.06 + strokeWeight × 0.5)`，最少 1。屬性預設值仍是 0，沒寫字距的舊專案開啟後外觀不變。

| 位置 | 改動 |
|---|---|
| `js/library.js` | 文字面板加入的圖層帶入字距（大標題 7、英文標題 6、字幕 5） |
| `skill/p5js-maker-holoteam/scripts` | `p5m_core.text_spacing`，build 與 `add text` 沒指定字距時帶入 |
| `skill/p5js-maker/SKILL.md` | 骨架範例加字距，常見錯誤表加一列，版本 1.1.0 |

驗證：編輯器從原始碼載入，加入字幕、大標題、英文標題，讀回字距 5、7、6，畫面無異常；`p5m add text size=64 strokeWeight=4` 得 6；`p5m build templates/storyboard_example.json` 字幕 3、標題 7，檢查 0 錯誤 0 警告。exe 已重建（9,111,365 bytes），未實際啟動（38920 連接埠被使用中的編輯器佔用）。Release v1.0.0 的 exe 仍是舊版。

## 2026-09-27 修正：圖片還在載入時開啟另一個專案，主控台無限報錯

開啟專案時 `prepare()` 每 50 毫秒輪詢圖片是否載好。圖片還沒載完就開另一個專案，`release()` 會刪掉舊專案的圖片快取，輪詢讀到不存在的項目丟出 TypeError；錯誤發生在清除計時器之前，所以每 50 毫秒重複一次，永不停止。只開一個專案不會發生。

| 位置 | 改動 |
|---|---|
| `runtime/assets.js` | `prepare()` 的圖片等待條件改為項目不存在就視為結束 |

驗證（編輯器從原始碼載入，瀏覽器窗格）：舊版 prepare 後立刻 release，1.5 秒內 30 個錯誤；修正版同一操作 0 錯誤，prepare 62 毫秒結束。用 `openFile` 連續開啟 5 個含大圖的專案，4 秒內 0 錯誤，最後停在第 5 個專案。正常路徑：3000×3000 圖片 prepare 結束時已可取得圖片。exe 已重建（9,111,340 bytes），未實際啟動。
