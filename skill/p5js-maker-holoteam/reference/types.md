# P5JS Maker 圖層類型與清單速查

本檔由 reference/schema.json 自動產生，內容等同 `p5m.py types 類型名` 與 `p5m.py catalog 清單名` 的輸出。
屬性名稱就是 `add`、`set`、`key` 指令裡 `屬性=值` 的屬性。

## 類型總表

```
圖層類型（types 類型名 看屬性）：
  shape           形狀（畫面）
  text            文字（畫面）
  image           圖片（畫面）
  code            程式碼（畫面）
  legacy          舊版動畫（畫面）
  particles       粒子（畫面）
  gen             生成藝術（畫面）
  shape3d         3D 物件（畫面）
  fx_vignette     暗角（全畫面）
  fx_grain        底片顆粒（全畫面）
  fx_grade        調色（全畫面）
  fx_blur         畫面模糊（全畫面）
  fx_glow         柔焦光暈（全畫面）
  fx_tint         色彩濾鏡（全畫面）
  fx_lightLeak    漏光（全畫面）
  fx_fade         黑場淡入淡出（全畫面）
  fx_flash        閃白（全畫面）
  fx_letterbox    電影黑邊（全畫面）
  tr_fadeThrough  淡化過場（全畫面）
  tr_wipe         推移擦除（全畫面）
  tr_iris         圓形轉場（全畫面）
  tr_blinds       百葉窗（全畫面）
  tr_zoom         衝擊縮放（全畫面）
  music           配樂（音訊）
  sfx             音效（音訊）
  audiofile       音訊檔（音訊）
```

## shape

```
shape 形狀
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  kind           形狀：select；預設 "rect"；選項 rect(矩形)、ellipse(圓形)、triangle(三角形)、star(星形)、polygon(多邊形)、heart(愛心)、ring(圓環)、arc(扇形)、line(線條)
  w              寬：number；預設 240；範圍 1~；可關鍵影格
  h              高：number；預設 240；範圍 1~；可關鍵影格
  fill           填色：color；預設 "#ffcc4d"；可關鍵影格
  gradient       漸層：select；預設 "none"；選項 none(無)、linear(線性)、radial(放射)
  fill2          漸層色：color；預設 "#ff6b6b"；可關鍵影格；條件 pr.gradient !== 'none'
  stroke         外框色：color；預設 "#ffffff"；可關鍵影格
  strokeWeight   外框粗細：number；預設 0；範圍 0~；可關鍵影格
  radius         圓角：number；預設 24；範圍 0~；可關鍵影格；條件 pr.kind === 'rect'
  points         角數：number；預設 5；範圍 3~24；條件 pr.kind === 'star'
  sides          邊數：number；預設 6；範圍 3~24；條件 pr.kind === 'polygon'
  inner          內徑比例：range；預設 0.45；範圍 0.05~0.95；可關鍵影格；條件 pr.kind === 'star' || pr.kind === 'ring'
  sweep          角度（°）：range；預設 270；範圍 0~360；可關鍵影格；條件 pr.kind === 'arc'
  glow           光暈：number；預設 0；範圍 0~；可關鍵影格
  glowColor      光暈色：color；預設 "#ffffff"；可關鍵影格；條件 pr.glow > 0
```

## text

```
text 文字
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  text           內容：textarea；預設 "輸入文字"
  font           字型：font；預設 "Noto Sans TC"
  weight         粗細：select；預設 700；選項 400(一般)、700(粗)、900(特粗)
  size           字級：number；預設 72；範圍 4~；可關鍵影格
  fill           文字色：color；預設 "#ffffff"；可關鍵影格
  stroke         描邊色：color；預設 "#000000"；可關鍵影格
  strokeWeight   描邊粗細：number；預設 0；範圍 0~；可關鍵影格
  align          對齊：select；預設 "center"；選項 left(靠左)、center(置中)、right(靠右)
  letterSpacing  字距：number；預設 0；可關鍵影格
  lineHeight     行高：number；預設 1.3；範圍 0.5~
  glow           光暈：number；預設 0；範圍 0~；可關鍵影格
  glowColor      光暈色：color；預設 "#ffd27a"；可關鍵影格；條件 pr.glow > 0
```

## image

```
image 圖片
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  asset          圖片：asset；填素材 id（image）
  w              寬：number；預設 400；範圍 1~；可關鍵影格
  flipX          水平翻轉：bool；預設 false
  radius         圓角：number；預設 0；範圍 0~；可關鍵影格
  glow           陰影／光暈：number；預設 0；範圍 0~；可關鍵影格
  glowColor      光暈色：color；預設 "#000000aa"；可關鍵影格；條件 pr.glow > 0
```

## code

```
code 程式碼
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  code           p5 程式碼：code；預設 "// p = p5 instance, t = seco…
  w              範圍寬：number；預設 400；範圍 1~
  h              範圍高：number；預設 400；範圍 1~
```

## legacy

```
legacy 舊版動畫
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  asset          來源：asset；填素材 id（legacy）
```

## particles

```
particles 粒子
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  preset         效果：select；預設 "snow"；選項 snow(雪花)、rain(雨)、sakura(櫻花)、leaves(落葉)、confetti(彩色紙花)、bubbles(泡泡)、embers(火星)、lanterns(天燈)、hearts(愛心飄升)、fireflies(螢火蟲)、dust(光塵)、stars(星星閃爍)、fog(霧氣)、fireworks(煙火)
  count          數量：number；預設 180；範圍 0~2000；可關鍵影格
  size           大小：number；預設 7；範圍 0.5~；可關鍵影格
  speed          速度：range；預設 1；範圍 0~4；可關鍵影格
  wind           風向：range；預設 0.3；範圍 -3~3；可關鍵影格
  color          顏色 1：color；預設 "#ffffff"；可關鍵影格
  color2         顏色 2：color；預設 "#d6e9ff"；可關鍵影格
  w              範圍寬：number；預設 畫布寬；範圍 1~
  h              範圍高：number；預設 畫布高；範圍 1~
  seed           隨機種子：number；預設 1
```

## gen

```
gen 生成藝術
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  preset         樣式：select；預設 "gradientSky"；選項 gradientSky(漸層天空)、moon(明月)、clouds(雲朵)、mountains(層疊山巒)、waves(海浪)、aurora(極光)、flowfield(流場線條)、mandala(萬花筒)、dotgrid(波動點陣)、ripples(漣漪)、starfield(星際穿梭)、sunburst(放射光芒)
  color          顏色 1：color；預設 "#0b1a3a"；可關鍵影格；只在所選預設用到時有效
  color2         顏色 2：color；預設 "#4a3a78"；可關鍵影格；只在所選預設用到時有效
  color3         顏色 3：color；預設 "#f29b76"；可關鍵影格；只在所選預設用到時有效
  density        密度：range；預設 0.5；範圍 0~1；只在所選預設用到時有效
  speed          速度：range；預設 1；範圍 0~4；可關鍵影格
  amount         強度：range；預設 1；範圍 0~2；可關鍵影格；只在所選預設用到時有效
  w              範圍寬：number；預設 畫布寬；範圍 1~
  h              範圍高：number；預設 畫布高；範圍 1~
  seed           隨機種子：number；預設 1
```

## shape3d

```
shape3d 3D 物件
共用屬性：x、y、scale、rotation、opacity、blur、brightness、contrast、saturate、hue（x、y 是中心點，預設畫布中央）
  kind           形狀：select；預設 "box"；選項 box(立方體)、sphere(球體)、torus(甜甜圈)、cone(圓錐)、cylinder(圓柱)、ellipsoid(橢球)、plane(平面卡片)
  size           尺寸：number；預設 220；範圍 1~；可關鍵影格
  color          顏色：color；預設 "#ff8a5c"；可關鍵影格
  material       材質：select；預設 "lit"；選項 lit(霧面)、specular(亮面)、normal(彩虹法線)、wireframe(線框)
  texture        貼圖：asset；填素材 id（image）；條件 pr.material === 'lit'
  ambient        環境光：range；預設 0.35；範圍 0~1；可關鍵影格
  spinX          X 自轉（°/秒）：number；預設 20；可關鍵影格
  spinY          Y 自轉（°/秒）：number；預設 40；可關鍵影格
  spinZ          Z 自轉（°/秒）：number；預設 0；可關鍵影格
  tiltX          X 傾斜（°）：number；預設 -20；可關鍵影格
  tiltY          Y 傾斜（°）：number；預設 30；可關鍵影格
  tiltZ          Z 傾斜（°）：number；預設 0；可關鍵影格
  detail         細緻度：number；預設 24；範圍 6~48
```

## fx_vignette

```
fx_vignette 暗角
  amount         強度：range；預設 0.55；範圍 0~1；可關鍵影格
  color          顏色：color；預設 "#000000"；可關鍵影格
  size           範圍：range；預設 0.45；範圍 0~1；可關鍵影格
```

## fx_grain

```
fx_grain 底片顆粒
  amount         強度：range；預設 0.3；範圍 0~1；可關鍵影格
```

## fx_grade

```
fx_grade 調色
  sepia          懷舊：range；預設 0；範圍 0~1；可關鍵影格
  grayscale      黑白：range；預設 0；範圍 0~1；可關鍵影格
```

## fx_blur

```
fx_blur 畫面模糊
  amount         模糊程度：range；預設 8；範圍 0~40；可關鍵影格
```

## fx_glow

```
fx_glow 柔焦光暈
  amount         強度：range；預設 0.5；範圍 0~1；可關鍵影格
  radius         光暈大小：range；預設 18；範圍 1~60；可關鍵影格
```

## fx_tint

```
fx_tint 色彩濾鏡
  amount         強度：range；預設 0.35；範圍 0~1；可關鍵影格
  color          顏色：color；預設 "#ff9a3c"；可關鍵影格
  mode           混合：select；預設 "soft-light"；選項 multiply(色彩增值)、screen(濾色)、overlay(覆蓋)、soft-light(柔光)、color(顏色)、source-over(一般)
```

## fx_lightLeak

```
fx_lightLeak 漏光
  amount         強度：range；預設 0.5；範圍 0~1；可關鍵影格
  color          顏色 1：color；預設 "#ff7a3c"；可關鍵影格
  color2         顏色 2：color；預設 "#ffd36b"；可關鍵影格
  speed          速度：range；預設 1；範圍 0~3
```

## fx_fade

```
fx_fade 黑場淡入淡出
  color          顏色：color；預設 "#000000"；可關鍵影格
  mode           方向：select；預設 "out"；選項 out(畫面漸漸變成顏色)、in(由顏色漸漸出現)
```

## fx_flash

```
fx_flash 閃白
  amount         強度：range；預設 1；範圍 0~1；可關鍵影格
  color          顏色：color；預設 "#ffffff"；可關鍵影格
```

## fx_letterbox

```
fx_letterbox 電影黑邊
  ratio          畫面比例：select；預設 2.35；選項 2.35(2.35：1)、2(2：1)、1.85(1.85：1)
  color          顏色：color；預設 "#000000"
```

## tr_fadeThrough

```
tr_fadeThrough 淡化過場
  color          顏色：color；預設 "#000000"
```

## tr_wipe

```
tr_wipe 推移擦除
  color          顏色：color；預設 "#111111"
  dir            方向：select；預設 "right"；選項 right(向右)、left(向左)、down(向下)、up(向上)
```

## tr_iris

```
tr_iris 圓形轉場
  color          顏色：color；預設 "#000000"
```

## tr_blinds

```
tr_blinds 百葉窗
  color          顏色：color；預設 "#000000"
  count          葉片數：number；預設 10；範圍 2~40
```

## tr_zoom

```
tr_zoom 衝擊縮放
  amount         強度：range；預設 0.5；範圍 0~1
```

## music

```
music 配樂
  preset         曲風：select；預設 "warm"；選項 warm(溫馨)、festive(喜慶)、calm(寧靜)、romantic(浪漫)、happy(歡樂)、mystery(神秘)、score(匯入的樂譜)
  seed           旋律變化：number；預設 1；條件 pr.preset !== 'score'
  volume         音量：range；預設 0.8；範圍 0~2
  fadeIn         淡入（秒）：number；預設 0；範圍 0~
  fadeOut        淡出（秒）：number；預設 1.5；範圍 0~
```

## sfx

```
sfx 音效
  voice          音效：select；預設 "pop"；選項 pop(啵)、thud(咚（敲擊）)、chime(叮（鈴聲）)、glissando(上行琶音)、shimmer(閃亮音)、pluck(撥弦單音)、whoosh(咻（風聲）)、strike(擦火柴)、meow(貓叫)、purr(呼嚕)、sniff(嗅聞)、crickets(蟲鳴)、sizzle(滋滋聲)、crackle(劈啪（鞭炮）)、roll(滾動隆隆)
  pitch          音高：range；預設 1；範圍 0.4~2.5；條件 pr.voice === 'meow' || pr.voice === 'thud'
  note           音符（MIDI）：number；預設 72；範圍 24~108；條件 pr.voice === 'pluck'
  up             上升：bool；預設 true；條件 pr.voice === 'whoosh'
  count          次數：number；預設 3；範圍 1~12；條件 pr.voice === 'sniff'
  density        密度（次/秒）：number；預設 6；範圍 0.5~40；條件 pr.voice === 'crackle'
  volume         音量：range；預設 1；範圍 0~2
```

## audiofile

```
audiofile 音訊檔
  asset          音訊：asset；填素材 id（audio）
  volume         音量：range；預設 1；範圍 0~2
  fadeIn         淡入（秒）：number；預設 0；範圍 0~
  fadeOut        淡出（秒）：number；預設 0；範圍 0~
```

## 清單：anim（入場、出場、循環動畫）

```
入場 in：none(無)、fade(淡入，0.6秒)、slideLeft(左側滑入，0.7秒)、slideRight(右側滑入，0.7秒)、slideUp(下方升起，0.7秒)、slideDown(上方落下，0.7秒)、zoomIn(放大出現，0.6秒)、zoomOut(縮小出現，0.7秒)、pop(彈出，0.6秒)、drop(掉落彈跳，0.9秒)、spin(旋轉出現，0.8秒)、flip(翻轉，0.6秒)、blur(模糊淡入，0.8秒)、wipe(擦除展開，0.8秒)、iris(圓形展開，0.8秒)、typewriter(打字機，1.2秒，限文字)、stamp(逐字蓋章，1.4秒，限文字)、rise(逐字升起，1.2秒，限文字)、bounceIn(逐字彈跳，1.2秒，限文字)
出場 out：none(無)、fade(淡出，0.6秒)、slideLeft(向左滑出，0.7秒)、slideRight(向右滑出，0.7秒)、slideUp(向上飄走，0.7秒)、slideDown(向下落下，0.7秒)、zoomOut(縮小消失，0.6秒)、zoomIn(放大消失，0.6秒)、pop(收回，0.5秒)、spin(旋轉消失，0.8秒)、flip(翻轉，0.6秒)、blur(模糊淡出，0.8秒)、wipe(擦除收起，0.8秒)、iris(圓形收合，0.8秒)、typewriter(倒退刪字，1秒，限文字)、fall(逐字掉落，1.2秒，限文字)
循環 loop：none(無)、float(漂浮)、pulse(呼吸)、sway(搖擺)、spin(持續旋轉)、blink(閃爍)、flicker(燭光)、shake(抖動)、heartbeat(心跳)、jelly(果凍)、wave(逐字波浪，限文字)、glyphPulse(逐字閃亮，限文字)
```

## 清單：particles（粒子預設（particles 的 preset））

```
  snow         雪花　{"count": 180, "size": 7, "speed": 1, "wind": 0.3, "color": "#ffffff", "color2": "#d6e9ff"}
  rain         雨　{"count": 220, "size": 2, "speed": 1, "wind": 0.15, "color": "#b8d4ff", "color2": "#7fa8e0"}
  sakura       櫻花　{"count": 70, "size": 10, "speed": 1, "wind": 0.6, "color": "#ffc4d6", "color2": "#ff9ab8"}
  leaves       落葉　{"count": 45, "size": 14, "speed": 1, "wind": 0.5, "color": "#e8923a", "color2": "#c0392b"}
  confetti     彩色紙花　{"count": 160, "size": 9, "speed": 1, "wind": 0.2, "color": "#ffd166", "color2": "#ef476f"}
  bubbles      泡泡　{"count": 40, "size": 22, "speed": 1, "wind": 0, "color": "#bfefff", "color2": "#ffffff"}
  embers       火星　{"count": 90, "size": 5, "speed": 1, "wind": 0.1, "color": "#ffb347", "color2": "#ff4e1a"}
  lanterns     天燈　{"count": 24, "size": 26, "speed": 1, "wind": 0.1, "color": "#ffb84d", "color2": "#ff7a2f"}
  hearts       愛心飄升　{"count": 36, "size": 14, "speed": 1, "wind": 0, "color": "#ff6b8b", "color2": "#ffb3c6"}
  fireflies    螢火蟲　{"count": 50, "size": 6, "speed": 1, "wind": 0, "color": "#d9ff7a", "color2": "#fff3a0"}
  dust         光塵　{"count": 120, "size": 3, "speed": 0.5, "wind": 0, "color": "#fff2cc", "color2": "#ffffff"}
  stars        星星閃爍　{"count": 160, "size": 3, "speed": 1, "wind": 0, "color": "#ffffff", "color2": "#ffe9a8"}
  fog          霧氣　{"count": 26, "size": 220, "speed": 1, "wind": 1, "color": "#ffffff", "color2": "#dde6f0"}
  fireworks    煙火　{"count": 240, "size": 4, "speed": 1, "wind": 0, "color": "#ffd166", "color2": "#ff5d8f"}
```

## 清單：gen（生成藝術預設（gen 的 preset））

```
  gradientSky  漸層天空　{"color": "#0b1a3a", "color2": "#4a3a78", "color3": "#f29b76", "amount": 0.3}
  moon         明月　{"color": "#fff6d8", "color2": "#ffd98a", "amount": 1, "density": 0.5, "w": 360, "h": 360}
  clouds       雲朵　{"color": "#ffffff", "color2": "#dfe7f2", "density": 0.5, "speed": 1}
  mountains    層疊山巒　{"color": "#2d3b5c", "color2": "#0c1222", "density": 0.5, "speed": 0.3, "amount": 1}
  waves        海浪　{"color": "#4cc9f0", "color2": "#123a6b", "density": 0.5, "speed": 1, "amount": 1}
  aurora       極光　{"color": "#3ef0a0", "color2": "#8a5cff", "density": 0.5, "speed": 1, "amount": 1}
  flowfield    流場線條　{"color": "#ffd166", "color2": "#4cc9f0", "density": 0.5, "speed": 1, "amount": 1}
  mandala      萬花筒　{"color": "#ffd166", "color2": "#ef476f", "color3": "#118ab2", "density": 0.5, "speed": 1, "amount": 1, "w": 640, "h": 640}
  dotgrid      波動點陣　{"color": "#ffffff", "color2": "#4cc9f0", "density": 0.5, "speed": 1, "amount": 1}
  ripples      漣漪　{"color": "#bfefff", "density": 0.4, "speed": 1, "amount": 1}
  starfield    星際穿梭　{"color": "#ffffff", "density": 0.5, "speed": 1}
  sunburst     放射光芒　{"color": "#ffe08a", "color2": "#ffb347", "density": 0.5, "speed": 1}
```

## 清單：ease（關鍵影格緩動）

```
linear(線性)、easeIn(漸快)、easeOut(漸慢)、easeInOut(慢快慢)、sine(柔和)、backOut(回彈)、backIn(蓄力)、elastic(彈簧)、bounce(落地彈跳)、hold(瞬間切換)
```

## 清單：fonts（字型）

```
Noto Sans TC(思源黑體)、Noto Serif TC(思源宋體)、LXGW WenKai TC(霞鶩文楷)、Microsoft JhengHei(微軟正黑體（系統）)、Poppins(Poppins)、Playfair Display(Playfair Display)、Pacifico(Pacifico（手寫）)
```

## 清單：blends（混合模式（圖層 blend））

```
source-over(一般)、multiply(色彩增值)、screen(濾色)、overlay(覆蓋)、soft-light(柔光)、lighter(相加發光)、difference(差異)
```

## 清單：music（配樂預設（music 的 preset））

```
warm(溫馨)、festive(喜慶)、calm(寧靜)、romantic(浪漫)、happy(歡樂)、mystery(神秘)、score(匯入的樂譜)
```

## 清單：sfx（音效（sfx 的 voice））

```
pop(啵，0.3秒)、thud(咚（敲擊），0.4秒)、chime(叮（鈴聲），2.5秒)、glissando(上行琶音，1秒)、shimmer(閃亮音，2秒)、pluck(撥弦單音，1.5秒)、whoosh(咻（風聲），0.6秒)、strike(擦火柴，0.4秒)、meow(貓叫，0.8秒)、purr(呼嚕，3秒)、sniff(嗅聞，0.6秒)、crickets(蟲鳴，6秒)、sizzle(滋滋聲，4秒)、crackle(劈啪（鞭炮），3秒)、roll(滾動隆隆，1.5秒)
```
