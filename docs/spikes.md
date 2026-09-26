# Spike 報告

## Spike 1：舊專案 iframe 合成（2026-09-26）

- 素材：Moon Festival 節日動畫資料夾（作者本機）的 `holidays/qixi`（喵魔人｜鵲橋相會，24 秒）
- 做法：assets.js、engine.js、sound.js、sketch.js 內嵌進 srcdoc iframe，另加一段 boot script 包住 `setup()`，在原本 setup 後呼叫 `noLoop()` 並設 `window.__p5mReady`。主畫布每格呼叫 `cw.seek(t)` 後 `drawImage(iframe 畫布)`。
- 環境：Claude 內建瀏覽器，本機 python http.server，p5.js 1.11.3 CDN。

| 項目 | 結果 |
|---|---|
| iframe 就緒時間 | 314 ms |
| `window.FILM` | `undefined`（top-level `const` 不是 window 屬性） |
| `cw.eval('FILM')` | 取得成功，`duration = 24` |
| `cw.eval('SCORE')` | 取得成功，`bpm = 90`，94 個 cue |
| seek + drawImage（0 到 24 秒每 0.25 秒，97 格） | 中位數 1.6 ms，p95 3.6 ms，最大 5.1 ms |
| 與 `_preview/f_008.0.png` 平均像素差 | 1.79 / 255 |
| 與 `_preview/f_016.5.png` 平均像素差 | 8.81 / 255，原因：這張預覽圖 00:57 產生，sketch.js 00:58 又改過，預覽圖是舊版畫面 |
| 主畫布在舊畫面上疊自己的圖形 | 正常 |

結論：通過。驗收基準改用「原始 index.html 以 `?t=` 直接渲染」的畫面，不用 `_preview/` 圖（可能比 sketch 舊）。

限制：量測的是 JS 呼叫時間，GPU 實際繪製在之後才完成；file:// 開啟匯出 HTML 時 iframe 能否同源存取尚未驗證（M5 驗）。

## Spike 2：WEBGL 離屏畫布疊到 2D 畫布（2026-09-26）

- 做法：instance mode 主畫布 2D，`p.createGraphics(1280, 720, p.WEBGL)` 畫 box 與 torus（ambientLight、directionalLight、specularMaterial），每格 `p.image(g, 0, 0)` 疊回。
- 60 格：中位數 0.1 ms，最大 114.6 ms（第一格編譯 shader）。
- 截圖確認：3D 物件有光影，透明背景正確透出底下的舊專案畫面。

結論：通過。第一次使用 3D 圖層時會卡約 0.1 秒（shader 編譯），可在載入時預熱。
