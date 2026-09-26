// Basic visual layer types: shape, text, image, code, legacy.
// draw(p, pr, env) paints around the local origin; the renderer already applied position, rotation, scale, opacity.
// bounds(pr, env) returns the local box { w, h } centered on the origin (hit testing, handles, wipe reveal).
(function () {
  const P5M = window.P5M;
  const { registerType, rgba, rad } = P5M;

  // ---------- shape ----------
  function shapePath(kind, w, h, pr) {
    const path = new Path2D();
    const hw = w / 2, hh = h / 2;
    if (kind === 'rect') {
      const r = Math.min(pr.radius || 0, hw, hh);
      if (path.roundRect) path.roundRect(-hw, -hh, w, h, r); else path.rect(-hw, -hh, w, h);
    } else if (kind === 'ellipse') {
      path.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    } else if (kind === 'ring') {
      const k = Math.max(0.05, Math.min(0.95, pr.inner ?? 0.7));
      path.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      path.ellipse(0, 0, hw * k, hh * k, 0, Math.PI * 2, 0, true);
    } else if (kind === 'arc') {
      const sweep = rad(Math.max(0, Math.min(360, pr.sweep ?? 270)));
      path.moveTo(0, 0);
      path.ellipse(0, 0, hw, hh, 0, -Math.PI / 2, -Math.PI / 2 + sweep);
      path.closePath();
    } else if (kind === 'triangle') {
      path.moveTo(0, -hh); path.lineTo(hw, hh); path.lineTo(-hw, hh); path.closePath();
    } else if (kind === 'star' || kind === 'polygon') {
      const n = Math.max(3, Math.round(kind === 'star' ? pr.points || 5 : pr.sides || 6));
      const steps = kind === 'star' ? n * 2 : n;
      const inner = kind === 'star' ? Math.max(0.1, Math.min(1, pr.inner ?? 0.45)) : 1;
      for (let i = 0; i < steps; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / steps;
        const k = kind === 'star' && i % 2 ? inner : 1;
        const x = Math.cos(a) * hw * k, y = Math.sin(a) * hh * k;
        if (i) path.lineTo(x, y); else path.moveTo(x, y);
      }
      path.closePath();
    } else if (kind === 'heart') {
      path.moveTo(0, hh);
      path.bezierCurveTo(-hw * 1.35, -hh * 0.1, -hw * 0.55, -hh * 1.25, 0, -hh * 0.45);
      path.bezierCurveTo(hw * 0.55, -hh * 1.25, hw * 1.35, -hh * 0.1, 0, hh);
      path.closePath();
    } else if (kind === 'line') {
      path.moveTo(-hw, 0); path.lineTo(hw, 0);
    }
    return path;
  }

  function paintFill(ctx, pr, w, h) {
    if (pr.gradient === 'linear') {
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, rgba(pr.fill)); g.addColorStop(1, rgba(pr.fill2));
      return g;
    }
    if (pr.gradient === 'radial') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
      g.addColorStop(0, rgba(pr.fill)); g.addColorStop(1, rgba(pr.fill2));
      return g;
    }
    return rgba(pr.fill);
  }

  function applyGlow(ctx, pr) {
    if (pr.glow > 0) { ctx.shadowBlur = pr.glow; ctx.shadowColor = rgba(pr.glowColor || '#ffffff'); }
  }

  registerType('shape', {
    label: '形狀', category: 'shape',
    props: [
      { key: 'kind', label: '形狀', type: 'select', default: 'rect', group: 'main', options: [
        ['rect', '矩形'], ['ellipse', '圓形'], ['triangle', '三角形'], ['star', '星形'], ['polygon', '多邊形'],
        ['heart', '愛心'], ['ring', '圓環'], ['arc', '扇形'], ['line', '線條']] },
      { key: 'w', label: '寬', type: 'number', min: 1, step: 1, default: 240, group: 'main', anim: true },
      { key: 'h', label: '高', type: 'number', min: 1, step: 1, default: 240, group: 'main', anim: true },
      { key: 'fill', label: '填色', type: 'color', default: '#ffcc4d', group: 'main', anim: true },
      { key: 'gradient', label: '漸層', type: 'select', default: 'none', group: 'main', options: [['none', '無'], ['linear', '線性'], ['radial', '放射']] },
      { key: 'fill2', label: '漸層色', type: 'color', default: '#ff6b6b', group: 'main', anim: true, when: (pr) => pr.gradient !== 'none' },
      { key: 'stroke', label: '外框色', type: 'color', default: '#ffffff', group: 'main', anim: true },
      { key: 'strokeWeight', label: '外框粗細', type: 'number', min: 0, step: 0.5, default: 0, group: 'main', anim: true },
      { key: 'radius', label: '圓角', type: 'number', min: 0, step: 1, default: 24, group: 'main', anim: true, when: (pr) => pr.kind === 'rect' },
      { key: 'points', label: '角數', type: 'number', min: 3, max: 24, step: 1, default: 5, group: 'main', when: (pr) => pr.kind === 'star' },
      { key: 'sides', label: '邊數', type: 'number', min: 3, max: 24, step: 1, default: 6, group: 'main', when: (pr) => pr.kind === 'polygon' },
      { key: 'inner', label: '內徑比例', type: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.45, group: 'main', anim: true, when: (pr) => pr.kind === 'star' || pr.kind === 'ring' },
      { key: 'sweep', label: '角度', type: 'range', min: 0, max: 360, step: 1, default: 270, unit: '°', group: 'main', anim: true, when: (pr) => pr.kind === 'arc' },
      { key: 'glow', label: '光暈', type: 'number', min: 0, step: 1, default: 0, group: 'main', anim: true },
      { key: 'glowColor', label: '光暈色', type: 'color', default: '#ffffff', group: 'main', anim: true, when: (pr) => pr.glow > 0 },
    ],
    draw(p, pr) {
      const ctx = p.drawingContext;
      const path = shapePath(pr.kind, pr.w, pr.h, pr);
      applyGlow(ctx, pr);
      if (pr.kind === 'line') {
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, pr.strokeWeight || 6);
        ctx.strokeStyle = rgba(pr.strokeWeight > 0 ? pr.stroke : pr.fill);
        ctx.stroke(path);
        return;
      }
      ctx.fillStyle = paintFill(ctx, pr, pr.w, pr.h);
      ctx.fill(path, 'evenodd');
      if (pr.strokeWeight > 0) {
        ctx.shadowBlur = 0;
        ctx.lineJoin = 'round';
        ctx.lineWidth = pr.strokeWeight;
        ctx.strokeStyle = rgba(pr.stroke);
        ctx.stroke(path);
      }
    },
    bounds: (pr) => ({ w: pr.w, h: pr.kind === 'line' ? Math.max(pr.strokeWeight || 6, 12) : pr.h }),
  });

  // ---------- text ----------
  const measureCtx = document.createElement('canvas').getContext('2d');
  const widthCache = new Map();
  // Widths measured before a web font arrives are fallback-font widths; drop them and repaint once it loads
  document.fonts.addEventListener('loadingdone', () => { widthCache.clear(); P5M.assets.notify(); });
  const fontString = (pr) => `${pr.weight || 700} ${pr.size}px "${pr.font}", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;

  function layoutText(pr) {
    const font = fontString(pr);
    measureCtx.font = font;
    const lines = String(pr.text ?? '').split('\n').map((line) => [...line]);
    const spacing = pr.letterSpacing || 0;
    const lh = pr.size * (pr.lineHeight || 1.25);
    const measured = lines.map((chars) => chars.map((ch) => {
      const key = font + '|' + ch;
      let w = widthCache.get(key);
      if (w === undefined) { w = measureCtx.measureText(ch).width; widthCache.set(key, w); }
      return w;
    }));
    const lineW = measured.map((ws) => ws.reduce((a, b) => a + b, 0) + Math.max(0, ws.length - 1) * spacing);
    const maxW = Math.max(1, ...lineW);
    const glyphs = [];
    lines.forEach((chars, li) => {
      let x = pr.align === 'left' ? -maxW / 2 : pr.align === 'right' ? maxW / 2 - lineW[li] : -lineW[li] / 2;
      const y = -((lines.length - 1) * lh) / 2 + li * lh;
      chars.forEach((ch, ci) => {
        const w = measured[li][ci];
        glyphs.push({ ch, x: x + w / 2, y });
        x += w + spacing;
      });
    });
    return { font, glyphs, w: maxW, h: lines.length * lh };
  }

  registerType('text', {
    label: '文字', category: 'text',
    props: [
      { key: 'text', label: '內容', type: 'textarea', default: '輸入文字', group: 'main' },
      { key: 'font', label: '字型', type: 'font', default: 'Noto Sans TC', group: 'main' },
      { key: 'weight', label: '粗細', type: 'select', default: 700, group: 'main', options: [[400, '一般'], [700, '粗'], [900, '特粗']] },
      { key: 'size', label: '字級', type: 'number', min: 4, step: 1, default: 72, group: 'main', anim: true },
      { key: 'fill', label: '文字色', type: 'color', default: '#ffffff', group: 'main', anim: true },
      { key: 'stroke', label: '描邊色', type: 'color', default: '#000000', group: 'main', anim: true },
      { key: 'strokeWeight', label: '描邊粗細', type: 'number', min: 0, step: 0.5, default: 0, group: 'main', anim: true },
      { key: 'align', label: '對齊', type: 'select', default: 'center', group: 'main', options: [['left', '靠左'], ['center', '置中'], ['right', '靠右']] },
      { key: 'letterSpacing', label: '字距', type: 'number', step: 1, default: 0, group: 'main', anim: true },
      { key: 'lineHeight', label: '行高', type: 'number', min: 0.5, step: 0.05, default: 1.3, group: 'main' },
      { key: 'glow', label: '光暈', type: 'number', min: 0, step: 1, default: 0, group: 'main', anim: true },
      { key: 'glowColor', label: '光暈色', type: 'color', default: '#ffd27a', group: 'main', anim: true, when: (pr) => pr.glow > 0 },
    ],
    draw(p, pr, env) {
      const ctx = p.drawingContext;
      P5M.assets.font(pr.font, pr.weight || 700, pr.text);
      const L = layoutText(pr);
      ctx.font = L.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      applyGlow(ctx, pr);
      const fill = rgba(pr.fill), stroke = rgba(pr.stroke);
      const n = L.glyphs.length;
      const base = ctx.globalAlpha;
      L.glyphs.forEach((gl, i) => {
        const g = env.st.glyphs.length ? P5M.glyphTransform(env.st, i, n) : null;
        if (g && (g.alpha <= 0.001 || g.s === 0)) return;
        ctx.save();
        ctx.translate(gl.x + (g ? g.dx : 0), gl.y + (g ? g.dy : 0));
        if (g) { if (g.rot) ctx.rotate(rad(g.rot)); if (g.s !== 1) ctx.scale(g.s, g.s); ctx.globalAlpha = base * Math.min(1, g.alpha); }
        if (pr.strokeWeight > 0) { ctx.lineWidth = pr.strokeWeight * 2; ctx.strokeStyle = stroke; ctx.strokeText(gl.ch, 0, 0); }
        ctx.fillStyle = fill;
        ctx.fillText(gl.ch, 0, 0);
        ctx.restore();
      });
    },
    bounds(pr) { const L = layoutText(pr); return { w: L.w, h: L.h }; },
  });

  // ---------- image ----------
  registerType('image', {
    label: '圖片', category: 'media',
    props: [
      { key: 'asset', label: '圖片', type: 'asset', accept: 'image', group: 'main' },
      { key: 'w', label: '寬', type: 'number', min: 1, step: 1, default: 400, group: 'main', anim: true },
      { key: 'flipX', label: '水平翻轉', type: 'bool', default: false, group: 'main' },
      { key: 'radius', label: '圓角', type: 'number', min: 0, step: 1, default: 0, group: 'main', anim: true },
      { key: 'glow', label: '陰影／光暈', type: 'number', min: 0, step: 1, default: 0, group: 'main', anim: true },
      { key: 'glowColor', label: '光暈色', type: 'color', default: '#000000aa', group: 'main', anim: true, when: (pr) => pr.glow > 0 },
    ],
    draw(p, pr, env) {
      const asset = env.project.assets[pr.asset];
      const img = P5M.assets.image(asset);
      const b = this.bounds(pr, env);
      const ctx = p.drawingContext;
      if (!img) {
        ctx.fillStyle = 'rgba(128,128,128,0.35)';
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        return;
      }
      if (pr.flipX) ctx.scale(-1, 1);
      applyGlow(ctx, pr);
      if (pr.radius > 0) {
        const path = new Path2D();
        if (path.roundRect) path.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, pr.radius); else path.rect(-b.w / 2, -b.h / 2, b.w, b.h);
        if (pr.glow > 0) { ctx.fillStyle = '#000'; ctx.fill(path); ctx.shadowBlur = 0; }
        ctx.clip(path);
      }
      ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
    },
    bounds(pr, env) {
      const a = env && env.project.assets[pr.asset];
      const img = a && !a.w ? P5M.assets.image(a) : null; // hand-written assets may lack w / h
      const ratio = a && a.w ? a.h / a.w : img ? img.naturalHeight / img.naturalWidth : 0.75;
      return { w: pr.w, h: pr.w * ratio };
    },
  });

  // ---------- code (escape hatch: raw p5 drawing) ----------
  const DEFAULT_CODE = [
    '// p = p5 instance, t = seconds since this clip started, env.W / env.H = canvas size',
    '// Draw around (0, 0). Position, scale and in/out animations come from the clip.',
    'p.noFill();',
    'p.strokeWeight(4);',
    'for (let i = 0; i < 10; i++) {',
    '  p.stroke(255, 180 + i * 7, 80, 220 - i * 18);',
    '  const r = 40 + i * 16 + Math.sin(t * 2 + i * 0.6) * 10;',
    '  p.circle(0, 0, r * 2);',
    '}',
  ].join('\n');
  const compiled = new Map();
  function compile(code) {
    let e = compiled.get(code);
    if (!e) {
      try { e = { fn: new Function('p', 't', 'env', 'P5M', code), error: null }; } catch (err) { e = { fn: null, error: err.message }; }
      compiled.set(code, e);
    }
    return e;
  }
  function drawError(ctx, w, h, msg) {
    ctx.fillStyle = 'rgba(180,30,40,0.55)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('程式碼錯誤：' + String(msg).slice(0, 60), 0, 0);
  }

  registerType('code', {
    label: '程式碼', category: 'code',
    props: [
      { key: 'code', label: 'p5 程式碼', type: 'code', default: DEFAULT_CODE, group: 'main' },
      { key: 'w', label: '範圍寬', type: 'number', min: 1, step: 1, default: 400, group: 'main' },
      { key: 'h', label: '範圍高', type: 'number', min: 1, step: 1, default: 400, group: 'main' },
    ],
    draw(p, pr, env) {
      const c = compile(pr.code || '');
      if (c.error) { drawError(p.drawingContext, pr.w, pr.h, c.error); return; }
      p.push();
      try { c.fn(p, env.lt, env, P5M); } catch (err) {
        if (!c.warned) { console.error('程式碼 clip 執行錯誤', err); c.warned = true; }
        p.pop(); p.push();
        drawError(p.drawingContext, pr.w, pr.h, err.message);
      }
      p.pop();
    },
    bounds: (pr) => ({ w: pr.w, h: pr.h }),
  });

  // ---------- legacy p5-comfyui-animation project (whole clip) ----------
  registerType('legacy', {
    label: '舊版動畫', category: 'media',
    props: [{ key: 'asset', label: '來源', type: 'asset', accept: 'legacy', group: 'main' }],
    draw(p, pr, env) {
      const asset = env.project.assets[pr.asset];
      const b = this.bounds(pr, env);
      const ctx = p.drawingContext;
      const cv = asset ? P5M.assets.legacyFrame(asset, env.lt) : null;
      if (cv) { ctx.drawImage(cv, -b.w / 2, -b.h / 2, b.w, b.h); return; }
      const e = asset && P5M.assets.legacy(asset);
      ctx.fillStyle = '#1d1a2b';
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.fillStyle = e && e.error ? '#ff8a8a' : '#b9b3d6';
      ctx.font = '28px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e && e.error ? e.error : '舊版動畫載入中…', 0, 0);
    },
    bounds(pr, env) {
      const a = env && env.project.assets[pr.asset];
      return { w: (a && a.width) || 1280, h: (a && a.height) || 720 };
    },
  });

  P5M.shapePath = shapePath;
  P5M.layoutText = layoutText;
})();
