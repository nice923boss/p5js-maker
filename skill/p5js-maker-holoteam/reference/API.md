# P5JS Maker 指令介面文件（p5m）

這份文件讓模型不開編輯器、只用打字，就能建立與修改 P5JS Maker 的時間軸專案（.json）。
編輯器裡的每一個操作，都對應到下面的一個指令，或專案 JSON 裡的一個欄位。

- 指令程式：`scripts/p5m.py`（只用 Python 標準庫，Python 3.9 以上）
- 圖層類型與屬性速查：`reference/types.md`（每個類型有哪些屬性、預設值、選項）
- 完整機器可讀規格：`reference/schema.json`
- 產出的 .json 用 P5JS Maker 開啟（網頁版 https://nice923boss.github.io/p5js-maker/ 或桌面版 P5JSMaker.exe），按「開啟」選檔即可播放、微調、匯出影片。

## 1. 怎麼呼叫

以下 `<SKILL>` 代表本 SKILL 資料夾的完整路徑（HoloTeam 會在對話裡給「SKILL 基準資料夾：」這一行，照抄那個路徑）。

方法 A，用終端機工具（bash 或 PowerShell 都可以）：

```
python "<SKILL>/scripts/p5m.py" info "D:/vault/輸出/動畫/我的動畫.json"
```

方法 B，用 python 工具（參數一個一個放進串列，不用處理引號）：

```python
import sys
sys.path.insert(0, r"<SKILL>/scripts")
import p5m
p5m.cli(["info", r"D:/vault/輸出/動畫/我的動畫.json"])
```

規則：

- 每個指令都會印出一行結果。開頭是「錯誤：」代表沒有執行，照訊息修正後重下一次。
- 會改檔的指令（add、set、key 等）執行後立刻存檔，不需要另外存。
- 路徑含空白或中文時，方法 A 要用雙引號包起來；方法 B 用 `r"..."`。
- 數字用半形，時間單位一律是秒，可以有小數（例 2.5）。
- `屬性=值` 的值含空白時整組加引號，例：`"text=早安 世界"`。文字要換行寫 `\n`，例：`"text=第一行\n第二行"`。

## 2. 基本觀念

| 名詞 | 意思 | 在 JSON 裡 |
|---|---|---|
| 專案 | 一支影片，一個 .json 檔 | 最外層 |
| 軌道 | 時間軸上的一列。上面的軌道蓋在下面的前面 | `tracks[]`，索引 0 是最上層 |
| 圖層（片段） | 軌道上的一段內容，例如一行字、一張圖、一段配樂 | `tracks[].clips[]` |
| 屬性 | 圖層的外觀數值，例如位置 x、y、字級 size、顏色 fill | `clip.props` |
| 關鍵影格 | 讓屬性隨時間變化的時間點 | `clip.keys` |
| 動畫 | 入場 in、出場 out、循環 loop 效果 | `clip.anim` |
| 鏡頭 | 整個畫面的推近、平移、旋轉、震動 | `camera` |
| 素材 | 匯入的圖片或音訊，內嵌在專案檔 | `assets` |

座標：畫面左上角是 (0, 0)，x 往右、y 往下。x、y 是物件的中心點。1280x720 的畫面正中央是 x=640 y=360。

id 規則：圖層 id 是 c1、c2…，軌道 id 是 tr1、tr2…，素材 id 是 a1、a2…（分鏡產生的圖片是 img1、img2…）。改東西之前先用 `info` 查 id，不要猜。

時間規則（很重要）：

- 指令裡的秒數一律是「專案時間」（從影片開頭算起）。
- JSON 裡圖層關鍵影格的 `t` 是「圖層內時間」（從該圖層開始算起）；鏡頭關鍵影格的 `t` 是專案時間。用指令改就不用自己換算。

## 3. 指令總表

| 指令 | 用途 | 範例 |
|---|---|---|
| new | 建立空白專案 | `new 專案.json --width 1280 --height 720 --duration 30 --title 我的動畫` |
| info | 列出設定、軌道與所有圖層 | `info 專案.json` |
| show | 看某個圖層、軌道、素材、settings 或 camera 的完整內容 | `show 專案.json c3` |
| validate | 檢查專案有沒有錯 | `validate 專案.json` |
| types | 列出圖層類型，或某類型的全部屬性 | `types text` |
| catalog | 查清單 | `catalog anim` |
| add | 新增圖層 | `add 專案.json text "text=你好" size=96 --start 2 --dur 4` |
| set | 改屬性、時間、名稱、軌道開關、專案設定、鏡頭 | `set 專案.json c3 fill=#ffcc00` |
| key | 加或改關鍵影格 | `key 專案.json c3 x 2 200` |
| unkey | 刪關鍵影格 | `unkey 專案.json c3 x 2` |
| anim | 設入場、出場、循環動畫 | `anim 專案.json c3 in pop --dur 0.8` |
| move | 移動圖層的時間或軌道 | `move 專案.json c3 --start 5 --track tr2` |
| split | 在某秒把圖層切成兩段 | `split 專案.json c3 6` |
| dup | 複製圖層 | `dup 專案.json c3 --start 10` |
| delete | 刪除圖層或空軌道 | `delete 專案.json c3` |
| track add | 新增軌道 | `track add 專案.json visual --name 字幕` |
| track move | 調整軌道上下順序 | `track move 專案.json tr4 up` |
| camera | 一鍵運鏡 | `camera 專案.json pushIn --at 3 --dur 2` |
| asset add | 匯入圖片或音訊 | `asset add 專案.json "D:/圖/貓.png" --name 貓` |
| asset list | 列出素材 | `asset list 專案.json` |
| asset delete | 刪除沒被使用的素材 | `asset delete 專案.json a2` |
| plan | 依片長建議場景數與字幕量 | `plan --minutes 3 --aspect 16:9` |
| build | 由分鏡檔產生整支影片專案 | `build 分鏡.json -o 專案.json` |

以下範例省略前面的 `python "<SKILL>/scripts/p5m.py"`。

## 4. 指令詳解

### 4.1 new：建立空白專案

```
new 檔案 [--width 1280] [--height 720] [--fps 30] [--duration 10] [--background #101018] [--title 名稱]
```

新專案有一條視覺軌 tr1 與一條音訊軌 tr2。常用尺寸：1280x720（橫式）、1920x1080（橫式高畫質）、720x1280 或 1080x1920（直式短影音）、1080x1080（方形）。

### 4.2 info、show、validate：查看與檢查

- `info 檔案`：第一行是標題、尺寸、fps、片長、背景色；接著列鏡頭、素材、每條軌道（[0] 最上層）與軌道上的圖層。每個圖層一行：id、開始~結束秒數、類型、名稱、主要屬性、有哪些關鍵影格與動畫。
- `show 檔案 目標`：目標可以是圖層 id、軌道 id、素材 id、`settings`、`camera`，印出完整 JSON（素材內嵌資料會縮短顯示）。
- `validate 檔案`：印出錯誤與警告。「錯誤」會讓編輯器開不起來或畫面壞掉，一定要修；「警告」是建議。最後一行是「檢查通過：0 錯誤 0 警告」或「檢查結果：N 個錯誤，M 個警告」。

### 4.3 types、catalog：查規格

- `types`：列出 26 種圖層類型。
- `types 類型名`：列出該類型每個屬性的名稱、中文、型別、預設值、範圍、選項，以及能不能設關鍵影格。
- `catalog 清單名`：`anim`（動畫）、`particles`（粒子預設）、`gen`（生成藝術預設）、`ease`（緩動）、`fonts`（字型）、`blends`（混合模式）、`music`（配樂曲風）、`sfx`（音效）。

內容都整理在 `reference/types.md`，可以直接讀那份檔。

### 4.4 add：新增圖層

```
add 檔案 類型 [屬性=值 ...] [--start 秒] [--dur 秒] [--track 軌道id] [--name 名稱] [--bg]
```

- 沒給的屬性用預設值；x、y 預設畫面中央。
- `--start` 預設 0。`--dur` 不給時：粒子、全畫面生成藝術、全畫面特效、配樂是「從開始到片尾」；轉場 1 秒；fx_flash 0.6 秒；fx_fade 1.5 秒；音效依音效長度；其他 4 秒。
- 軌道自動挑：從最上層找第一條同種類（視覺或音訊）、該時段沒被占用、沒鎖定的軌道；都被占用就在最上層新增一條。`--bg` 或全畫面的生成藝術會從最底層往上找，適合當背景。
- `--track 軌道id` 指定軌道；該時段被占用時會自動改放別條。
- 選粒子或生成藝術的 `preset` 時，會一併帶入該預設的參數（和編輯器點卡片一樣）。
- 圖層超過片長時，片長自動延長。

範例：

```
add 專案.json text "text=歡迎光臨" size=96 fill=#ffe08a y=200 --start 1 --dur 5
add 專案.json shape kind=heart w=200 h=200 fill=#ff6b8a --start 2
add 專案.json particles preset=snow
add 專案.json gen preset=aurora --bg
add 專案.json image asset=a1 w=600 --start 3 --dur 6
add 專案.json music preset=calm volume=0.6
add 專案.json sfx voice=chime --start 4.5
add 專案.json tr_iris color=#000000 --start 9.5
add 專案.json fx_fade mode=in --start 0
```

### 4.5 set：改東西

```
set 檔案 目標 屬性=值 [屬性=值 ...] [--at 秒]
```

目標有四種：

| 目標 | 可以改 | 範例 |
|---|---|---|
| 圖層 id | 所有屬性，以及 start、duration、name、blend、offset | `set 專案.json c3 "text=新的字" size=80 start=2 duration=5` |
| 軌道 id | name、hidden、muted、locked、followCamera（true 或 false） | `set 專案.json tr2 hidden=true` |
| settings | title、width、height、fps、duration、background、volume | `set 專案.json settings duration=45 background=#000000` |
| camera | x、y、zoom、rotation、shake | `set 專案.json camera zoom=1.2` |

- 選項類屬性可以寫英文值或中文名稱，例 `weight=900` 或 `weight=特粗`。
- 顏色寫 `#rrggbb` 或含透明度的 `#rrggbbaa`。
- 屬性已經有關鍵影格時，必須加 `--at 秒` 指定改哪個時間點（沒有那個時間點就新增一個）；或先 `unkey` 清掉再改。
- 改 start 或 duration 造成同軌重疊時會提醒，照提示用 `move 圖層 --track new` 移到新軌道。

### 4.6 key、unkey：關鍵影格

```
key 檔案 目標 屬性 秒 值 [--ease easeInOut]
unkey 檔案 目標 屬性 [秒]
```

- 目標是圖層 id 或 `camera`。秒數是專案時間，必須落在圖層的時間範圍內。
- 同一個時間點已有關鍵影格就改值與緩動，沒有就新增。
- 只有標「可關鍵影格」的屬性能設（查 `types 類型名`）。
- `--ease` 決定「從這個點到下一個點」怎麼變化：linear、easeIn、easeOut、easeInOut、sine、backOut、backIn、elastic、bounce、hold（停住後瞬間跳）。
- `unkey` 不給秒數就清掉該屬性全部關鍵影格，屬性固定為第一個值。

範例：文字從左邊滑到中間（2 到 4 秒）。

```
key 專案.json c3 x 2 -200 --ease easeOut
key 專案.json c3 x 4 640
```

### 4.7 anim：入場、出場、循環動畫

```
anim 檔案 圖層id in|out|loop 類型 [--dur 秒] [--speed 倍數] [--amount 強度]
```

- in、out 用 `--dur` 設長度，不給用預設長度；loop 用 `--speed` 與 `--amount`（預設 1）。
- 類型寫 `none` 移除。
- 標「限文字」的效果只能用在 text 圖層（逐字效果）。
- 清單用 `catalog anim` 查，常用：入場 fade、slideUp、zoomIn、pop、rise、typewriter；出場 fade、slideUp、zoomOut；循環 float、pulse、sway、wave。

### 4.8 move、split、dup、delete：編輯片段

- `move 檔案 圖層 --start 秒`：改開始時間（長度不變）。
- `move 檔案 圖層 --track 軌道id`：換軌道，只能換到同種類（視覺或音訊）的軌道；`--track new` 開一條新軌道放它。
- `split 檔案 圖層 秒`：在該秒切開。前段保留原 id 與入場動畫，後段是新 id 並保留出場與循環動畫。兩段都會複製原本的關鍵影格（和編輯器一樣），所以 split 後 `validate` 可能出現「關鍵影格超出圖層範圍」的警告，不影響播放；要清掉就對該段用 `unkey`。
- `dup 檔案 圖層 [--start 秒]`：複製一份，預設接在原圖層後面。
- `delete 檔案 圖層id`：刪圖層。`delete 檔案 軌道id`：刪軌道，軌道必須是空的。

### 4.9 track：軌道

- `track add 檔案 visual|audio [--name 名稱] [--index 位置]`：視覺軌預設加在最上層（0），音訊軌加在最下面。
- `track move 檔案 軌道id up|down|數字`：往上一層、往下一層，或移到指定位置（0 是最上層）。越上面越蓋在前面。
- 軌道開關用 set：`hidden`（隱藏）、`muted`（靜音）、`locked`（鎖定，鎖定的軌道不會被自動放新圖層）、`followCamera`（false 表示不跟著鏡頭動，字幕軌常用）。

### 4.10 camera：一鍵運鏡

```
camera 檔案 pushIn|pullOut|panLeft|panRight|shake|reset [--at 秒] [--dur 2]
```

- pushIn 推近（放大 1.35 倍）、pullOut 拉遠、panLeft 左移、panRight 右移（各移動畫面寬 15%），從 `--at` 秒開始持續 `--dur` 秒。
- shake 在 `--at` 秒震動 0.7 秒。
- reset 清除所有鏡頭動畫，回到置中。
- 要自己控制鏡頭，用 `key 檔案 camera zoom 秒 值`（x、y、zoom、rotation、shake 都可以）。

### 4.11 asset：素材

- `asset add 檔案 圖檔路徑 [--id a1] [--name 名稱]`：圖片支援 PNG、JPEG、GIF、WebP；音訊支援 MP3、WAV、OGG、M4A。檔案內容會內嵌進專案（專案檔會變大，一張 1024 的 JPEG 約 100 到 300 KB）。
- 匯入後用 `add 檔案 image asset=素材id w=寬` 放到畫面上；音訊用 `add 檔案 audiofile asset=素材id --dur 秒數`。腳本讀不出音訊長度，不給 `--dur` 只會放 4 秒，要整首播完就給歌曲長度或片長。
- `asset list 檔案`、`asset delete 檔案 素材id`（還被圖層使用時不能刪）。

### 4.12 plan、build：用分鏡一次做完整支影片

- `plan --minutes 分鐘 [--aspect 16:9]`（或 `--seconds 秒`）：印出建議的場景數、每場秒數、每場字幕句數與每句字數。
- `build 分鏡.json -o 專案.json`：讀分鏡檔，自動算好每場時間、字的大小與位置、換行、背景、粒子、鏡頭、轉場、配樂，寫出完整專案並自動檢查。最後一行是檢查結果；「提醒：」開頭的行是需要處理的問題（例如找不到圖片、字幕太長）。

分鏡檔格式見第 6 節。

## 5. 編輯器操作對照表

| 編輯器裡的操作 | 用指令做 |
|---|---|
| 專案設定：名稱 | `set 檔案 settings title=新名稱` |
| 專案設定：畫面尺寸 | `set 檔案 settings width=1080 height=1920`（既有圖層位置不會自動調整） |
| 專案設定：影格率 | `set 檔案 settings fps=30` |
| 專案設定：影片長度 | `set 檔案 settings duration=60` |
| 專案設定：裁到內容長度 | 用 `info` 找最後一個圖層的結束秒數，再 `set 檔案 settings duration=該秒數` |
| 專案設定：背景色、主音量 | `set 檔案 settings background=#000000 volume=0.8` |
| 素材庫點卡片（形狀、文字、粒子、生成、3D、特效、轉場、音訊） | `add 檔案 類型 [preset=… 或 kind=…] --start 秒` |
| 素材庫拖到舞台某位置 | `add 檔案 類型 x=… y=…` |
| 素材庫拖到時間軸某軌道 | `add 檔案 類型 --start 秒 --track 軌道id` |
| 拖入圖片或音訊檔 | `asset add` 之後 `add … image asset=…` 或 `add … audiofile asset=… --dur 秒數` |
| 舞台上拖曳物件 | `set 檔案 圖層 x=… y=…` |
| 舞台上縮放、旋轉 | `set 檔案 圖層 scale=1.5 rotation=15` |
| 雙擊文字改內容 | `set 檔案 圖層 "text=新內容"` |
| 右側面板改任何屬性 | `set 檔案 圖層 屬性=值` |
| 片段名稱、開始、長度、素材起點、混合模式 | `set 檔案 圖層 name=… start=… duration=… offset=… blend=multiply` |
| 按 ◇ 加關鍵影格 | `key 檔案 圖層 屬性 秒 值` |
| 關鍵影格速度曲線 | `key 檔案 圖層 屬性 秒 值 --ease 緩動`（同一時間點重下一次就是改） |
| 刪除關鍵影格 | `unkey 檔案 圖層 屬性 秒` |
| 動畫分頁：入場、循環、出場 | `anim 檔案 圖層 in|loop|out 類型` |
| 鏡頭列：鏡頭位置 | `set 檔案 camera …` 或 `key 檔案 camera 屬性 秒 值` |
| 鏡頭列：一鍵運鏡、重設 | `camera 檔案 預設 --at 秒` |
| 時間軸拖曳片段左右 | `move 檔案 圖層 --start 秒` |
| 時間軸拖曳片段到別條軌道 | `move 檔案 圖層 --track 軌道id` |
| 拖曳片段邊緣改長度 | `set 檔案 圖層 start=… duration=…` |
| 分割 | `split 檔案 圖層 秒` |
| 複製、貼上、建立副本 | `dup 檔案 圖層 --start 秒` |
| 刪除片段 | `delete 檔案 圖層` |
| 新增軌道 | `track add 檔案 visual|audio` |
| 軌道上移、下移 | `track move 檔案 軌道 up|down` |
| 軌道眼睛、喇叭、鎖頭、跟隨鏡頭 | `set 檔案 軌道 hidden=… muted=… locked=… followCamera=…` |
| 刪除空軌道 | `delete 檔案 軌道` |
| 開新專案、另存 | `new 檔案`；另存就是複製 .json 檔 |
| 開啟範例專案 | 不需要指令，直接複製 P5JS Maker 的 examples 資料夾內的 .json |

只能在編輯器裡做的事（指令做不到）：

- 預覽播放、看畫面：用 P5JS Maker 開啟 .json。
- 匯出影片（MP4 或 WebM）：編輯器右上「匯出影片」。
- 匯出 HTML 播放檔：編輯器右上「匯出 HTML」。
- 復原、重做：指令沒有復原功能，重要修改前先複製一份 .json 備份。

## 6. 分鏡檔格式（build 用）

分鏡檔是一個 .json，模型只寫文字與選項，時間、位置、大小都由 build 算。

```json
{
  "title": "秋日小旅行",
  "minutes": 1,
  "aspect": "16:9",
  "style": "warm",
  "music": "warm",
  "scenes": [
    {"layout": "cover", "title": "秋日小旅行", "subtitle": "一個人的山城散步", "image": "images/scene1.jpg"},
    {"layout": "caption", "title": "清晨出發", "lines": ["天還沒亮就搭上第一班公車", "窗外的山慢慢被陽光染成金色"], "image": "images/scene2.jpg"},
    {"layout": "side", "title": "老街午後", "lines": ["石板路兩旁是百年的木造房子"], "image": "images/scene3.jpg"},
    {"layout": "cover", "title": "下次見", "subtitle": "謝謝收看"}
  ]
}
```

最外層欄位：

| 欄位 | 必填 | 說明 |
|---|---|---|
| title | 否 | 影片名稱 |
| minutes 或 seconds | 是 | 總長，至少 15 秒 |
| aspect | 否 | 16:9（1280x720，預設）、9:16（720x1280 直式）、1:1（1080x1080） |
| style | 否 | 風格主題，見下表，預設 warm |
| music | 否 | 配樂曲風：warm、festive、calm、romantic、happy、mystery、none（不要配樂）；不寫用主題預設 |
| particles | 否 | 全片粒子預設（`catalog particles`），none 表示不要；不寫用主題預設 |
| scenes | 是 | 場景陣列，照播放順序 |

場景欄位（全部選填，但至少要有 title 或 lines）：

| 欄位 | 說明 |
|---|---|
| layout | cover：大標題置中（片頭、片尾、章節頁）；caption：上方小標題、下方字幕；side：左邊圖、右邊字（直式時上圖下字）。不寫時第一場與最後一場是 cover，其他是 caption |
| title | 場景標題。cover 用大字，其他版面用小標題 |
| subtitle | 副標，接在標題下方（cover 版面最適合） |
| lines | 字幕陣列，依序出現，每句一個字串。16:9 每句 15 到 22 字、9:16 每句 12 到 16 字最好讀 |
| image | 圖片路徑，相對於分鏡檔所在資料夾，或完整路徑。有圖時 cover、caption 把圖鋪滿全畫面並自動調暗、文字變白；side 把圖放左邊。找不到圖會改用生成背景並提醒 |
| background | 沒有圖片時的生成背景（`catalog gen` 的名稱，例 aurora、starfield、waves）；none 表示只留天空底色；不寫依主題輪流 |
| particles | 這一場的粒子，覆蓋全片設定 |
| camera | pushIn（慢慢推近）、pullOut（慢慢拉遠）、still（不動）；不寫就推近拉遠交替 |
| transition | 這一場結束時換到下一場的轉場：fadeThrough（預設）、wipe、iris、blinds、zoom、none |
| weight | 時間比重。預設是 1.5 加字幕句數，數字越大這場越長 |

風格主題：

| style | 名稱 | 底色 | 標題字型 | 預設背景 | 預設粒子 | 預設配樂 |
|---|---|---|---|---|---|---|
| warm | 溫暖 | 紫到橘的黃昏漸層 | 思源宋體 | sunburst、clouds、ripples、flowfield | dust | warm |
| night | 夜空 | 深藍夜空 | 思源宋體 | moon、aurora、mountains、starfield | stars | calm |
| fresh | 清新 | 淡藍到奶油色 | 思源黑體 | clouds、waves、sunburst、ripples | bubbles | happy |
| tech | 科技 | 黑藍紫 | 思源黑體 | flowfield、dotgrid、starfield、ripples | dust | mystery |
| romantic | 浪漫 | 酒紅到粉紅 | 霞鶩文楷 | sunburst、clouds、ripples、mandala | sakura | romantic |
| festive | 喜慶 | 深紅到金 | 霞鶩文楷 | sunburst、mandala、flowfield、ripples | lanterns | festive |

build 產生的軌道（由上到下）：轉場、字幕、副標、標題、特效、粒子、插圖、背景、天空、配樂。字幕、副標、標題三條軌道不跟鏡頭移動，所以運鏡時字不會晃。片頭 1 秒自動淡入，片尾 2 秒自動淡出。

build 之後還想微調，就用第 4 節的指令改產出的專案檔（先 `info` 查 id）。注意：重新 build 會覆蓋整個專案檔，手動微調會消失。要重 build 就改分鏡檔，不要改專案檔。

## 7. 直接改 JSON 的規則

優先用指令。真的要手動改 .json 時，遵守：

- 最外層必須有 `"format": "p5maker"`、`"version": 1`、`settings`、`assets`、`camera`、`tracks`。
- 每個圖層必須有 id（全專案唯一）、type、start、duration（大於 0）、props、keys、anim。
- 同一條軌道上的圖層時間不能重疊。
- 音訊圖層（music、sfx、audiofile）只能放在 kind 為 audio 的軌道，其他放 visual 軌道。
- 圖層關鍵影格格式 `{"t": 圖層內秒數, "v": 值, "e": "easeInOut"}`，依 t 由小到大排列。
- image 與 audiofile 的 asset 必須是 assets 裡存在的 id。
- 改完一定跑 `validate`，0 錯誤才交給使用者。

## 8. 常見錯誤訊息

| 訊息 | 原因 | 怎麼辦 |
|---|---|---|
| 找不到圖層 cX，先用 info 查 id | id 打錯或已刪除 | 跑 `info` 看正確 id |
| X 沒有 Y 屬性，可用：… | 屬性名稱打錯 | 從訊息列出的名稱挑一個 |
| Y 沒有 Z 這個選項，可用：… | 選項值不存在 | 從訊息列出的選項挑一個 |
| … 有關鍵影格，請加 --at 秒數 | 屬性有動畫 | 加 `--at 秒`，或先 `unkey` |
| … 不在 cX 的範圍 | 關鍵影格時間超出圖層 | 改秒數，或先把圖層加長 |
| 軌道 trX 還有 N 個圖層 | 刪的軌道不是空的 | 先刪或移走裡面的圖層 |
| 素材 aX 還被 … 使用 | 刪的素材有圖層在用 | 先刪那些圖層 |
| 分鏡檔不是有效的 JSON | 分鏡少逗號、引號或括號 | 修正格式後重新 build |
| 注意：存檔後檢查有 N 個錯誤 | 這次修改讓專案出錯 | 照錯誤訊息修，或跑 `validate` 看全部 |
