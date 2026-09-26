# 圖層類型參考

> 由 `tools/check_project.py --types-md` 從 runtime registry 產生，不要手改。runtime 改版後重新產生。

## 共用屬性（全畫面特效、轉場、音訊以外的圖層都有）

x、y 預設是畫布中心；x、y 是圖層中心點的位置。

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `x` | X | number |  | 可 |  |
| `y` | Y | number |  | 可 |  |
| `scale` | 縮放 | number | `1` | 可 | 最小 0 |
| `rotation` | 旋轉（°） | number | `0` | 可 |  |
| `opacity` | 不透明度 | range | `1` | 可 | 範圍 0 到 1 |
| `blur` | 模糊 | range | `0` | 可 | 範圍 0 到 40 |
| `brightness` | 亮度 | range | `1` | 可 | 範圍 0 到 3 |
| `contrast` | 對比 | range | `1` | 可 | 範圍 0 到 3 |
| `saturate` | 飽和度 | range | `1` | 可 | 範圍 0 到 3 |
| `hue` | 色相（°） | range | `0` | 可 | 範圍 -180 到 180 |

## `shape` 形狀

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `kind` | 形狀 | select | `"rect"` |  | `"rect"` 矩形、`"ellipse"` 圓形、`"triangle"` 三角形、`"star"` 星形、`"polygon"` 多邊形、`"heart"` 愛心、`"ring"` 圓環、`"arc"` 扇形、`"line"` 線條 |
| `w` | 寬 | number | `240` | 可 | 最小 1 |
| `h` | 高 | number | `240` | 可 | 最小 1 |
| `fill` | 填色 | color | `"#ffcc4d"` | 可 |  |
| `gradient` | 漸層 | select | `"none"` |  | `"none"` 無、`"linear"` 線性、`"radial"` 放射 |
| `fill2` | 漸層色 | color | `"#ff6b6b"` | 可 | 條件：`pr.gradient !== 'none'` |
| `stroke` | 外框色 | color | `"#ffffff"` | 可 |  |
| `strokeWeight` | 外框粗細 | number | `0` | 可 | 最小 0 |
| `radius` | 圓角 | number | `24` | 可 | 最小 0；條件：`pr.kind === 'rect'` |
| `points` | 角數 | number | `5` |  | 範圍 3 到 24；條件：`pr.kind === 'star'` |
| `sides` | 邊數 | number | `6` |  | 範圍 3 到 24；條件：`pr.kind === 'polygon'` |
| `inner` | 內徑比例 | range | `0.45` | 可 | 範圍 0.05 到 0.95；條件：`pr.kind === 'star' \|\| pr.kind === 'ring'` |
| `sweep` | 角度（°） | range | `270` | 可 | 範圍 0 到 360；條件：`pr.kind === 'arc'` |
| `glow` | 光暈 | number | `0` | 可 | 最小 0 |
| `glowColor` | 光暈色 | color | `"#ffffff"` | 可 | 條件：`pr.glow > 0` |

## `text` 文字

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `text` | 內容 | textarea | `"輸入文字"` |  |  |
| `font` | 字型 | font | `"Noto Sans TC"` |  |  |
| `weight` | 粗細 | select | `700` |  | `400` 一般、`700` 粗、`900` 特粗 |
| `size` | 字級 | number | `72` | 可 | 最小 4 |
| `fill` | 文字色 | color | `"#ffffff"` | 可 |  |
| `stroke` | 描邊色 | color | `"#000000"` | 可 |  |
| `strokeWeight` | 描邊粗細 | number | `0` | 可 | 最小 0 |
| `align` | 對齊 | select | `"center"` |  | `"left"` 靠左、`"center"` 置中、`"right"` 靠右 |
| `letterSpacing` | 字距 | number | `0` | 可 |  |
| `lineHeight` | 行高 | number | `1.3` |  | 最小 0.5 |
| `glow` | 光暈 | number | `0` | 可 | 最小 0 |
| `glowColor` | 光暈色 | color | `"#ffd27a"` | 可 | 條件：`pr.glow > 0` |

## `image` 圖片

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `asset` | 圖片 | asset |  |  | 填 assets 的 id（kind image） |
| `w` | 寬 | number | `400` | 可 | 最小 1 |
| `flipX` | 水平翻轉 | bool | `false` |  |  |
| `radius` | 圓角 | number | `0` | 可 | 最小 0 |
| `glow` | 陰影／光暈 | number | `0` | 可 | 最小 0 |
| `glowColor` | 光暈色 | color | `"#000000aa"` | 可 | 條件：`pr.glow > 0` |

## `code` 程式碼

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `code` | p5 程式碼 | code | （範例程式） |  |  |
| `w` | 範圍寬 | number | `400` |  | 最小 1 |
| `h` | 範圍高 | number | `400` |  | 最小 1 |

## `legacy` 舊版動畫

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `asset` | 來源 | asset |  |  | 填 assets 的 id（kind legacy） |

## `particles` 粒子

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `preset` | 效果 | select | `"snow"` |  | `"snow"` 雪花、`"rain"` 雨、`"sakura"` 櫻花、`"leaves"` 落葉、`"confetti"` 彩色紙花、`"bubbles"` 泡泡、`"embers"` 火星、`"lanterns"` 天燈、`"hearts"` 愛心飄升、`"fireflies"` 螢火蟲、`"dust"` 光塵、`"stars"` 星星閃爍、`"fog"` 霧氣、`"fireworks"` 煙火 |
| `count` | 數量 | number | `180` | 可 | 範圍 0 到 2000 |
| `size` | 大小 | number | `7` | 可 | 最小 0.5 |
| `speed` | 速度 | range | `1` | 可 | 範圍 0 到 4 |
| `wind` | 風向 | range | `0.3` | 可 | 範圍 -3 到 3 |
| `color` | 顏色 1 | color | `"#ffffff"` | 可 |  |
| `color2` | 顏色 2 | color | `"#d6e9ff"` | 可 |  |
| `w` | 範圍寬 | number | 畫布寬 |  | 最小 1 |
| `h` | 範圍高 | number | 畫布高 |  | 最小 1 |
| `seed` | 隨機種子 | number | `1` |  |  |

## `gen` 生成藝術

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `preset` | 樣式 | select | `"gradientSky"` |  | `"gradientSky"` 漸層天空、`"moon"` 明月、`"clouds"` 雲朵、`"mountains"` 層疊山巒、`"waves"` 海浪、`"aurora"` 極光、`"flowfield"` 流場線條、`"mandala"` 萬花筒、`"dotgrid"` 波動點陣、`"ripples"` 漣漪、`"starfield"` 星際穿梭、`"sunburst"` 放射光芒 |
| `color` | 顏色 1 | color | `"#0b1a3a"` | 可 | 只在所選預設用到時有作用（見預設清單的「用到」欄） |
| `color2` | 顏色 2 | color | `"#4a3a78"` | 可 | 只在所選預設用到時有作用（見預設清單的「用到」欄） |
| `color3` | 顏色 3 | color | `"#f29b76"` | 可 | 只在所選預設用到時有作用（見預設清單的「用到」欄） |
| `density` | 密度 | range | `0.5` |  | 範圍 0 到 1；只在所選預設用到時有作用（見預設清單的「用到」欄） |
| `speed` | 速度 | range | `1` | 可 | 範圍 0 到 4 |
| `amount` | 強度 | range | `1` | 可 | 範圍 0 到 2；只在所選預設用到時有作用（見預設清單的「用到」欄） |
| `w` | 範圍寬 | number | 畫布寬 |  | 最小 1 |
| `h` | 範圍高 | number | 畫布高 |  | 最小 1 |
| `seed` | 隨機種子 | number | `1` |  |  |

## `shape3d` 3D 物件

畫面圖層（另有上面的共用屬性）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `kind` | 形狀 | select | `"box"` |  | `"box"` 立方體、`"sphere"` 球體、`"torus"` 甜甜圈、`"cone"` 圓錐、`"cylinder"` 圓柱、`"ellipsoid"` 橢球、`"plane"` 平面卡片 |
| `size` | 尺寸 | number | `220` | 可 | 最小 1 |
| `color` | 顏色 | color | `"#ff8a5c"` | 可 |  |
| `material` | 材質 | select | `"lit"` |  | `"lit"` 霧面、`"specular"` 亮面、`"normal"` 彩虹法線、`"wireframe"` 線框 |
| `texture` | 貼圖 | asset |  |  | 填 assets 的 id（kind image）；條件：`pr.material === 'lit'` |
| `ambient` | 環境光 | range | `0.35` | 可 | 範圍 0 到 1 |
| `spinX` | X 自轉（°/秒） | number | `20` | 可 |  |
| `spinY` | Y 自轉（°/秒） | number | `40` | 可 |  |
| `spinZ` | Z 自轉（°/秒） | number | `0` | 可 |  |
| `tiltX` | X 傾斜（°） | number | `-20` | 可 |  |
| `tiltY` | Y 傾斜（°） | number | `30` | 可 |  |
| `tiltZ` | Z 傾斜（°） | number | `0` | 可 |  |
| `detail` | 細緻度 | number | `24` |  | 範圍 6 到 48 |

## `fx_vignette` 暗角

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.55` | 可 | 範圍 0 到 1 |
| `color` | 顏色 | color | `"#000000"` | 可 |  |
| `size` | 範圍 | range | `0.45` | 可 | 範圍 0 到 1 |

## `fx_grain` 底片顆粒

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.3` | 可 | 範圍 0 到 1 |

## `fx_grade` 調色

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `sepia` | 懷舊 | range | `0` | 可 | 範圍 0 到 1 |
| `grayscale` | 黑白 | range | `0` | 可 | 範圍 0 到 1 |

## `fx_blur` 畫面模糊

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 模糊程度 | range | `8` | 可 | 範圍 0 到 40 |

## `fx_glow` 柔焦光暈

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.5` | 可 | 範圍 0 到 1 |
| `radius` | 光暈大小 | range | `18` | 可 | 範圍 1 到 60 |

## `fx_tint` 色彩濾鏡

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.35` | 可 | 範圍 0 到 1 |
| `color` | 顏色 | color | `"#ff9a3c"` | 可 |  |
| `mode` | 混合 | select | `"soft-light"` |  | `"multiply"` 色彩增值、`"screen"` 濾色、`"overlay"` 覆蓋、`"soft-light"` 柔光、`"color"` 顏色、`"source-over"` 一般 |

## `fx_lightLeak` 漏光

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.5` | 可 | 範圍 0 到 1 |
| `color` | 顏色 1 | color | `"#ff7a3c"` | 可 |  |
| `color2` | 顏色 2 | color | `"#ffd36b"` | 可 |  |
| `speed` | 速度 | range | `1` |  | 範圍 0 到 3 |

## `fx_fade` 黑場淡入淡出

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `color` | 顏色 | color | `"#000000"` | 可 |  |
| `mode` | 方向 | select | `"out"` |  | `"out"` 畫面漸漸變成顏色、`"in"` 由顏色漸漸出現 |

## `fx_flash` 閃白

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `1` | 可 | 範圍 0 到 1 |
| `color` | 顏色 | color | `"#ffffff"` | 可 |  |

## `fx_letterbox` 電影黑邊

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `ratio` | 畫面比例 | select | `2.35` |  | `2.35` 2.35：1、`2` 2：1、`1.85` 1.85：1 |
| `color` | 顏色 | color | `"#000000"` |  |  |

## `tr_fadeThrough` 淡化過場

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `color` | 顏色 | color | `"#000000"` |  |  |

## `tr_wipe` 推移擦除

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `color` | 顏色 | color | `"#111111"` |  |  |
| `dir` | 方向 | select | `"right"` |  | `"right"` 向右、`"left"` 向左、`"down"` 向下、`"up"` 向上 |

## `tr_iris` 圓形轉場

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `color` | 顏色 | color | `"#000000"` |  |  |

## `tr_blinds` 百葉窗

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `color` | 顏色 | color | `"#000000"` |  |  |
| `count` | 葉片數 | number | `10` |  | 範圍 2 到 40 |

## `tr_zoom` 衝擊縮放

全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `amount` | 強度 | range | `0.5` |  | 範圍 0 到 1 |

## `music` 配樂

音訊（放在 kind "audio" 的軌道）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `preset` | 曲風 | select | `"warm"` |  | `"warm"` 溫馨、`"festive"` 喜慶、`"calm"` 寧靜、`"romantic"` 浪漫、`"happy"` 歡樂、`"mystery"` 神秘、`"score"` 匯入的樂譜 |
| `seed` | 旋律變化 | number | `1` |  | 條件：`pr.preset !== 'score'` |
| `volume` | 音量 | range | `0.8` |  | 範圍 0 到 2 |
| `fadeIn` | 淡入（秒） | number | `0` |  | 最小 0 |
| `fadeOut` | 淡出（秒） | number | `1.5` |  | 最小 0 |

## `sfx` 音效

音訊（放在 kind "audio" 的軌道）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `voice` | 音效 | select | `"pop"` |  | `"pop"` 啵、`"thud"` 咚（敲擊）、`"chime"` 叮（鈴聲）、`"glissando"` 上行琶音、`"shimmer"` 閃亮音、`"pluck"` 撥弦單音、`"whoosh"` 咻（風聲）、`"strike"` 擦火柴、`"meow"` 貓叫、`"purr"` 呼嚕、`"sniff"` 嗅聞、`"crickets"` 蟲鳴、`"sizzle"` 滋滋聲、`"crackle"` 劈啪（鞭炮）、`"roll"` 滾動隆隆 |
| `pitch` | 音高 | range | `1` |  | 範圍 0.4 到 2.5；條件：`pr.voice === 'meow' \|\| pr.voice === 'thud'` |
| `note` | 音符（MIDI） | number | `72` |  | 範圍 24 到 108；條件：`pr.voice === 'pluck'` |
| `up` | 上升 | bool | `true` |  | 條件：`pr.voice === 'whoosh'` |
| `count` | 次數 | number | `3` |  | 範圍 1 到 12；條件：`pr.voice === 'sniff'` |
| `density` | 密度（次/秒） | number | `6` |  | 範圍 0.5 到 40；條件：`pr.voice === 'crackle'` |
| `volume` | 音量 | range | `1` |  | 範圍 0 到 2 |

## `audiofile` 音訊檔

音訊（放在 kind "audio" 的軌道）

| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |
|---|---|---|---|---|---|
| `asset` | 音訊 | asset |  |  | 填 assets 的 id（kind audio） |
| `volume` | 音量 | range | `1` |  | 範圍 0 到 2 |
| `fadeIn` | 淡入（秒） | number | `0` |  | 最小 0 |
| `fadeOut` | 淡出（秒） | number | `0` |  | 最小 0 |

## 預設值清單

### 粒子 `particles.preset`

| 值 | 名稱 | 用到 | 編輯器會一併帶入的屬性（手寫 JSON 請照抄） |
|---|---|---|---|
| `snow` | 雪花 |  | `{"count":180,"size":7,"speed":1,"wind":0.3,"color":"#ffffff","color2":"#d6e9ff"}` |
| `rain` | 雨 |  | `{"count":220,"size":2,"speed":1,"wind":0.15,"color":"#b8d4ff","color2":"#7fa8e0"}` |
| `sakura` | 櫻花 |  | `{"count":70,"size":10,"speed":1,"wind":0.6,"color":"#ffc4d6","color2":"#ff9ab8"}` |
| `leaves` | 落葉 |  | `{"count":45,"size":14,"speed":1,"wind":0.5,"color":"#e8923a","color2":"#c0392b"}` |
| `confetti` | 彩色紙花 |  | `{"count":160,"size":9,"speed":1,"wind":0.2,"color":"#ffd166","color2":"#ef476f"}` |
| `bubbles` | 泡泡 |  | `{"count":40,"size":22,"speed":1,"wind":0,"color":"#bfefff","color2":"#ffffff"}` |
| `embers` | 火星 |  | `{"count":90,"size":5,"speed":1,"wind":0.1,"color":"#ffb347","color2":"#ff4e1a"}` |
| `lanterns` | 天燈 |  | `{"count":24,"size":26,"speed":1,"wind":0.1,"color":"#ffb84d","color2":"#ff7a2f"}` |
| `hearts` | 愛心飄升 |  | `{"count":36,"size":14,"speed":1,"wind":0,"color":"#ff6b8b","color2":"#ffb3c6"}` |
| `fireflies` | 螢火蟲 |  | `{"count":50,"size":6,"speed":1,"wind":0,"color":"#d9ff7a","color2":"#fff3a0"}` |
| `dust` | 光塵 |  | `{"count":120,"size":3,"speed":0.5,"wind":0,"color":"#fff2cc","color2":"#ffffff"}` |
| `stars` | 星星閃爍 |  | `{"count":160,"size":3,"speed":1,"wind":0,"color":"#ffffff","color2":"#ffe9a8"}` |
| `fog` | 霧氣 |  | `{"count":26,"size":220,"speed":1,"wind":1,"color":"#ffffff","color2":"#dde6f0"}` |
| `fireworks` | 煙火 |  | `{"count":240,"size":4,"speed":1,"wind":0,"color":"#ffd166","color2":"#ff5d8f"}` |

### 生成藝術 `gen.preset`

| 值 | 名稱 | 用到 | 編輯器會一併帶入的屬性（手寫 JSON 請照抄） |
|---|---|---|---|
| `gradientSky` | 漸層天空 | color、color2、color3、amount | `{"color":"#0b1a3a","color2":"#4a3a78","color3":"#f29b76","amount":0.3}` |
| `moon` | 明月 | color、color2、amount、density | `{"color":"#fff6d8","color2":"#ffd98a","amount":1,"density":0.5,"w":360,"h":360}` |
| `clouds` | 雲朵 | color、color2、density、speed | `{"color":"#ffffff","color2":"#dfe7f2","density":0.5,"speed":1}` |
| `mountains` | 層疊山巒 | color、color2、density、speed、amount | `{"color":"#2d3b5c","color2":"#0c1222","density":0.5,"speed":0.3,"amount":1}` |
| `waves` | 海浪 | color、color2、density、speed、amount | `{"color":"#4cc9f0","color2":"#123a6b","density":0.5,"speed":1,"amount":1}` |
| `aurora` | 極光 | color、color2、density、speed、amount | `{"color":"#3ef0a0","color2":"#8a5cff","density":0.5,"speed":1,"amount":1}` |
| `flowfield` | 流場線條 | color、color2、density、speed、amount | `{"color":"#ffd166","color2":"#4cc9f0","density":0.5,"speed":1,"amount":1}` |
| `mandala` | 萬花筒 | color、color2、color3、density、speed、amount | `{"color":"#ffd166","color2":"#ef476f","color3":"#118ab2","density":0.5,"speed":1,"amount":1,"w":640,"h":640}` |
| `dotgrid` | 波動點陣 | color、color2、density、speed、amount | `{"color":"#ffffff","color2":"#4cc9f0","density":0.5,"speed":1,"amount":1}` |
| `ripples` | 漣漪 | color、density、speed、amount | `{"color":"#bfefff","density":0.4,"speed":1,"amount":1}` |
| `starfield` | 星際穿梭 | color、density、speed | `{"color":"#ffffff","density":0.5,"speed":1}` |
| `sunburst` | 放射光芒 | color、color2、density、speed | `{"color":"#ffe08a","color2":"#ffb347","density":0.5,"speed":1}` |

## 動畫預設（clip.anim）

### 入場 `anim.in.type`

| type | 名稱 | 預設秒數 | 備註 |
|---|---|---|---|
| `none` | 無 |  |  |
| `fade` | 淡入 | 0.6 |  |
| `slideLeft` | 左側滑入 | 0.7 |  |
| `slideRight` | 右側滑入 | 0.7 |  |
| `slideUp` | 下方升起 | 0.7 |  |
| `slideDown` | 上方落下 | 0.7 |  |
| `zoomIn` | 放大出現 | 0.6 |  |
| `zoomOut` | 縮小出現 | 0.7 |  |
| `pop` | 彈出 | 0.6 |  |
| `drop` | 掉落彈跳 | 0.9 |  |
| `spin` | 旋轉出現 | 0.8 |  |
| `flip` | 翻轉 | 0.6 |  |
| `blur` | 模糊淡入 | 0.8 |  |
| `wipe` | 擦除展開 | 0.8 |  |
| `iris` | 圓形展開 | 0.8 |  |
| `typewriter` | 打字機 | 1.2 | 只限文字 |
| `stamp` | 逐字蓋章 | 1.4 | 只限文字 |
| `rise` | 逐字升起 | 1.2 | 只限文字 |
| `bounceIn` | 逐字彈跳 | 1.2 | 只限文字 |

### 出場 `anim.out.type`

| type | 名稱 | 預設秒數 | 備註 |
|---|---|---|---|
| `none` | 無 |  |  |
| `fade` | 淡出 | 0.6 |  |
| `slideLeft` | 向左滑出 | 0.7 |  |
| `slideRight` | 向右滑出 | 0.7 |  |
| `slideUp` | 向上飄走 | 0.7 |  |
| `slideDown` | 向下落下 | 0.7 |  |
| `zoomOut` | 縮小消失 | 0.6 |  |
| `zoomIn` | 放大消失 | 0.6 |  |
| `pop` | 收回 | 0.5 |  |
| `spin` | 旋轉消失 | 0.8 |  |
| `flip` | 翻轉 | 0.6 |  |
| `blur` | 模糊淡出 | 0.8 |  |
| `wipe` | 擦除收起 | 0.8 |  |
| `iris` | 圓形收合 | 0.8 |  |
| `typewriter` | 倒退刪字 | 1 | 只限文字 |
| `fall` | 逐字掉落 | 1.2 | 只限文字 |

### 循環 `anim.loop.type`（另可設 speed、amount，預設 1）

| type | 名稱 | 預設秒數 | 備註 |
|---|---|---|---|
| `none` | 無 |  |  |
| `float` | 漂浮 |  |  |
| `pulse` | 呼吸 |  |  |
| `sway` | 搖擺 |  |  |
| `spin` | 持續旋轉 |  |  |
| `blink` | 閃爍 |  |  |
| `flicker` | 燭光 |  |  |
| `shake` | 抖動 |  |  |
| `heartbeat` | 心跳 |  |  |
| `jelly` | 果凍 |  |  |
| `wave` | 逐字波浪 |  | 只限文字 |
| `glyphPulse` | 逐字閃亮 |  | 只限文字 |

## 緩動（keys[].e）

`linear` 線性、`easeIn` 漸快、`easeOut` 漸慢、`easeInOut` 慢快慢、`sine` 柔和、`backOut` 回彈、`backIn` 蓄力、`elastic` 彈簧、`bounce` 落地彈跳、`hold` 瞬間切換

## 內建字型（text.font）

`Noto Sans TC` 思源黑體、`Noto Serif TC` 思源宋體、`LXGW WenKai TC` 霞鶩文楷、`Microsoft JhengHei` 微軟正黑體（系統）、`Poppins` Poppins、`Playfair Display` Playfair Display、`Pacifico` Pacifico（手寫）
