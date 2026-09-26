// Asset loading: images, audio buffers, web fonts and legacy p5 projects (hidden srcdoc iframe).
// Loads are lazy; when something finishes, P5M.assets.onReady() fires so the host can re-render.
(function () {
  const P5M = window.P5M;

  const FONTS = [
    { family: 'Noto Sans TC', label: '思源黑體', google: 'Noto+Sans+TC:wght@400;700;900' },
    { family: 'Noto Serif TC', label: '思源宋體', google: 'Noto+Serif+TC:wght@400;700;900' },
    { family: 'LXGW WenKai TC', label: '霞鶩文楷', google: 'LXGW+WenKai+TC:wght@400;700' },
    { family: 'Microsoft JhengHei', label: '微軟正黑體（系統）' },
    { family: 'Poppins', label: 'Poppins', google: 'Poppins:wght@400;700;900' },
    { family: 'Playfair Display', label: 'Playfair Display', google: 'Playfair+Display:wght@400;700;900' },
    { family: 'Pacifico', label: 'Pacifico（手寫）', google: 'Pacifico' },
  ];

  const images = new Map();
  const audio = new Map();
  const legacy = new Map();
  const fontsRequested = new Set();
  const fontsLoaded = new Set();
  let decodeCtx = null;

  const api = {
    FONTS,
    onReady: () => {},
    notify() { api.onReady(); },

    image(asset) {
      if (!asset) return null;
      let e = images.get(asset.id);
      if (!e) {
        const img = new Image();
        e = { img, ready: false, error: null };
        images.set(asset.id, e);
        img.onload = () => { e.ready = true; api.notify(); };
        img.onerror = () => { e.error = '圖片載入失敗：' + asset.name; console.error(e.error); api.notify(); };
        img.src = asset.src;
      }
      return e.ready ? e.img : null;
    },

    audioBuffer(asset) {
      if (!asset) return Promise.resolve(null);
      let e = audio.get(asset.id);
      if (!e) {
        decodeCtx = decodeCtx || new OfflineAudioContext(2, 1, 48000);
        e = fetch(asset.src).then((r) => r.arrayBuffer()).then((b) => decodeCtx.decodeAudioData(b))
          .catch((err) => { console.error('音訊解碼失敗', asset.name, err); return null; });
        audio.set(asset.id, e);
      }
      return e;
    },

    // Google Fonts link for the given families (only those not requested yet)
    requestFonts(families) {
      const need = FONTS.filter((f) => f.google && families.includes(f.family) && !fontsRequested.has(f.family));
      if (!need.length) return;
      need.forEach((f) => fontsRequested.add(f.family));
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?' + need.map((f) => 'family=' + f.google).join('&') + '&display=swap';
      document.head.appendChild(link);
    },

    // Ensure glyphs of `text` in `family` are loaded; re-render once they arrive
    font(family, weight, text) {
      const key = family + '|' + weight + '|' + text;
      if (fontsLoaded.has(key)) return;
      fontsLoaded.add(key);
      api.requestFonts([family]);
      document.fonts.load(`${weight} 40px "${family}"`, text || 'A').then(() => api.notify()).catch(() => {});
    },

    legacy(asset) {
      if (!asset) return null;
      let e = legacy.get(asset.id);
      if (!e) { e = buildLegacy(asset); legacy.set(asset.id, e); }
      return e;
    },

    // Drop cached images, decoded audio and legacy iframes (each a full p5 page) whose asset is not in keepIds;
    // the editor calls this when another project opens
    release(keepIds) {
      for (const id of [...images.keys()]) if (!keepIds.has(id)) images.delete(id);
      for (const id of [...audio.keys()]) if (!keepIds.has(id)) audio.delete(id);
      for (const [id, e] of legacy) if (!keepIds.has(id)) { e.frame.remove(); legacy.delete(id); }
    },

    // Wait until everything the project references is loaded (used before export and first play)
    async prepare(project) {
      const jobs = [];
      const used = usedAssetIds(project);
      for (const id of used) {
        const a = project.assets[id];
        if (!a) continue;
        if (a.kind === 'image') { api.image(a); jobs.push(waitFor(() => images.get(a.id).ready || images.get(a.id).error)); }
        if (a.kind === 'audio') jobs.push(api.audioBuffer(a));
        if (a.kind === 'legacy') jobs.push(api.legacy(a).promise);
      }
      const fams = new Map();
      for (const tr of project.tracks) for (const c of tr.clips) {
        if (c.type === 'text') {
          const f = c.props.font || 'Noto Sans TC';
          fams.set(f + '|' + (c.props.weight || 700), (fams.get(f + '|' + (c.props.weight || 700)) || '') + (c.props.text || ''));
        }
      }
      api.requestFonts([...fams.keys()].map((k) => k.split('|')[0]));
      for (const [k, text] of fams) {
        const [f, w] = k.split('|');
        jobs.push(document.fonts.load(`${w} 40px "${f}"`, text).catch(() => {}));
      }
      await Promise.all(jobs);
    },

    usedAssetIds,
  };

  function usedAssetIds(project) {
    const ids = new Set();
    for (const tr of project.tracks) for (const c of tr.clips) for (const k of ['asset', 'texture']) if (c.props && c.props[k]) ids.add(c.props[k]);
    return ids;
  }

  function waitFor(cond, timeout = 15000) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        if (cond() || performance.now() - t0 > timeout) { clearInterval(iv); resolve(); }
      }, 50);
    });
  }

  // Legacy project = p5 global-mode sketch following the p5-comfyui-animation engine.js contract.
  // It runs inside a same-origin srcdoc iframe; each frame we call seek(t) and copy its canvas.
  function buildLegacy(asset) {
    const e = { ready: false, error: null, frame: null, cw: null, canvas: null, film: null, score: null, promise: null };
    const safe = (s) => String(s || '').replace(/<\/script/gi, '<\\/script');
    const f = asset.files || {};
    const boot = 'window.__p5mReady=false;const __p5mSetup=setup;' +
      'setup=function(){__p5mSetup();noLoop();window.__p5mReady=true;};';
    const fontLink = asset.fontHref ? `<link rel="stylesheet" href="${asset.fontHref.replace(/"/g, '&quot;')}">` : '';
    const html = '<!doctype html><html><head><meta charset="utf-8">' + fontLink +
      '<style>html,body{margin:0;background:#000;overflow:hidden}</style>' +
      '<script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"><\/script>' +
      ['assets', 'engine', 'sound', 'sketch'].map((k) => `<script>${safe(f[k])}<\/script>`).join('') +
      `<script>${boot}<\/script></head><body><div id="stage"></div></body></html>`;
    const fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true');
    fr.tabIndex = -1;
    fr.style.cssText = `position:fixed;left:-30000px;top:0;width:${asset.width || 1280}px;height:${asset.height || 720}px;border:0;pointer-events:none`;
    fr.srcdoc = html;
    document.body.appendChild(fr);
    e.frame = fr;
    e.promise = new Promise((resolve) => {
      const t0 = performance.now();
      const iv = setInterval(async () => {
        if (!fr.isConnected) { clearInterval(iv); resolve(e); return; } // released before it finished loading
        let cw = null;
        try { cw = fr.contentWindow; } catch (err) { /* cross-origin (should not happen) */ }
        if (cw && cw.__p5mReady) {
          clearInterval(iv);
          try {
            e.cw = cw;
            e.canvas = cw.document.querySelector('canvas');
            e.film = cw.eval('typeof FILM !== "undefined" ? FILM : null');
            e.score = cw.eval('typeof SCORE !== "undefined" ? SCORE : null');
            if (e.film && e.film.fontSpec) await cw.document.fonts.load(e.film.fontSpec, e.film.fontText || '').catch(() => {});
            e.ready = true;
          } catch (err) {
            e.error = '舊專案初始化失敗：' + err.message;
            console.error(e.error, err);
          }
          api.notify();
          resolve(e);
        } else if (performance.now() - t0 > 30000) {
          clearInterval(iv);
          e.error = '舊專案載入逾時（30 秒）：' + asset.name;
          console.error(e.error);
          api.notify();
          resolve(e);
        }
      }, 60);
    });
    return e;
  }

  // Render the legacy project at local time lt; returns its canvas or null while loading
  api.legacyFrame = function (asset, lt) {
    const e = api.legacy(asset);
    if (!e.ready) return null;
    const dur = (e.film && e.film.duration) || asset.duration || 0;
    e.cw.seek(Math.max(0, Math.min(lt, dur)));
    return e.canvas;
  };

  P5M.assets = api;
})();
