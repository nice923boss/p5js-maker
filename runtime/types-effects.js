// Screen-space layers: adjustment effects apply to everything already drawn below them (lower tracks),
// transitions cover the cut between clips. The renderer calls draw() with an identity transform.
// Intensity k = animState alpha, so in/out fade presets ramp an effect in and out.
(function () {
  const P5M = window.P5M;
  const { registerType, rgba, hash, ease, clamp } = P5M;

  let tmp = null;
  function snapshot(ctx, W, H) {
    if (!tmp) tmp = document.createElement('canvas');
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
    const tc = tmp.getContext('2d');
    tc.globalCompositeOperation = 'copy';
    tc.drawImage(ctx.canvas, 0, 0);
    return tmp;
  }
  // Redraw the current frame through a CSS filter string, mixed in with strength k
  function refilter(ctx, W, H, filter, k) {
    if (k <= 0.001 || !filter) return;
    const src = snapshot(ctx, W, H);
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.filter = filter;
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }

  const grainTiles = [];
  function grainTile(i) {
    if (!grainTiles[i]) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d', { willReadFrequently: true }); // CPU-backed, same reason as particle sprites
      const img = g.createImageData(256, 256);
      for (let j = 0; j < 256 * 256; j++) {
        const v = 128 + (hash(j, i * 31 + 5) - 0.5) * 255;
        img.data[j * 4] = img.data[j * 4 + 1] = img.data[j * 4 + 2] = v;
        img.data[j * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainTiles[i] = c;
    }
    return grainTiles[i];
  }

  const BLENDS = [['multiply', '色彩增值'], ['screen', '濾色'], ['overlay', '覆蓋'], ['soft-light', '柔光'], ['color', '顏色'], ['source-over', '一般']];
  const amountProp = (def = 0.5, max = 1) => ({ key: 'amount', label: '強度', type: 'range', min: 0, max, step: 0.01, default: def, group: 'main', anim: true });

  const EFFECTS = {
    vignette: {
      label: '暗角', props: [amountProp(0.55), { key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main', anim: true },
        { key: 'size', label: '範圍', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45, group: 'main', anim: true }],
      draw(ctx, pr, W, H, k) {
        const R = Math.hypot(W, H) / 2;
        const g = ctx.createRadialGradient(W / 2, H / 2, R * pr.size * 0.9, W / 2, H / 2, R);
        g.addColorStop(0, rgba(pr.color, 0)); g.addColorStop(1, rgba(pr.color, clamp(pr.amount * k, 0, 1)));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      },
    },
    grain: {
      label: '底片顆粒', props: [amountProp(0.3)],
      draw(ctx, pr, W, H, k, lt) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = clamp(pr.amount * k, 0, 1);
        ctx.fillStyle = ctx.createPattern(grainTile(Math.floor(lt * 12) % 4), 'repeat');
        ctx.fillRect(0, 0, W, H);
      },
    },
    grade: {
      label: '調色', props: [
        { key: 'brightness', label: '亮度', type: 'range', min: 0, max: 2, step: 0.01, default: 1, group: 'main', anim: true },
        { key: 'contrast', label: '對比', type: 'range', min: 0, max: 2, step: 0.01, default: 1.1, group: 'main', anim: true },
        { key: 'saturate', label: '飽和度', type: 'range', min: 0, max: 3, step: 0.01, default: 1.2, group: 'main', anim: true },
        { key: 'hue', label: '色相', type: 'range', min: -180, max: 180, step: 1, default: 0, unit: '°', group: 'main', anim: true },
        { key: 'sepia', label: '懷舊', type: 'range', min: 0, max: 1, step: 0.01, default: 0, group: 'main', anim: true },
        { key: 'grayscale', label: '黑白', type: 'range', min: 0, max: 1, step: 0.01, default: 0, group: 'main', anim: true }],
      draw(ctx, pr, W, H, k) {
        refilter(ctx, W, H, `brightness(${pr.brightness}) contrast(${pr.contrast}) saturate(${pr.saturate}) hue-rotate(${pr.hue}deg) sepia(${pr.sepia}) grayscale(${pr.grayscale})`, k);
      },
    },
    blur: {
      label: '畫面模糊', props: [{ key: 'amount', label: '模糊程度', type: 'range', min: 0, max: 40, step: 0.5, default: 8, group: 'main', anim: true }],
      draw(ctx, pr, W, H, k) { refilter(ctx, W, H, `blur(${pr.amount * k}px)`, 1); },
    },
    glow: {
      label: '柔焦光暈', props: [amountProp(0.5), { key: 'radius', label: '光暈大小', type: 'range', min: 1, max: 60, step: 1, default: 18, group: 'main', anim: true }],
      draw(ctx, pr, W, H, k) {
        const src = snapshot(ctx, W, H);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = clamp(pr.amount * k, 0, 1);
        ctx.filter = `blur(${pr.radius}px)`;
        ctx.drawImage(src, 0, 0);
      },
    },
    tint: {
      label: '色彩濾鏡', props: [amountProp(0.35), { key: 'color', label: '顏色', type: 'color', default: '#ff9a3c', group: 'main', anim: true },
        { key: 'mode', label: '混合', type: 'select', default: 'soft-light', group: 'main', options: BLENDS }],
      draw(ctx, pr, W, H, k) {
        ctx.globalCompositeOperation = pr.mode;
        ctx.globalAlpha = clamp(pr.amount * k, 0, 1);
        ctx.fillStyle = rgba(pr.color); ctx.fillRect(0, 0, W, H);
      },
    },
    lightLeak: {
      label: '漏光', props: [amountProp(0.5), { key: 'color', label: '顏色 1', type: 'color', default: '#ff7a3c', group: 'main', anim: true },
        { key: 'color2', label: '顏色 2', type: 'color', default: '#ffd36b', group: 'main', anim: true },
        { key: 'speed', label: '速度', type: 'range', min: 0, max: 3, step: 0.05, default: 1, group: 'main' }],
      draw(ctx, pr, W, H, k, lt) {
        ctx.globalCompositeOperation = 'screen';
        [[pr.color, 0], [pr.color2, 1]].forEach(([c, i]) => {
          const x = W * (0.5 + 0.6 * Math.sin(lt * 0.35 * pr.speed + i * 2.2)), y = H * (0.5 + 0.5 * Math.cos(lt * 0.27 * pr.speed + i * 1.3));
          const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.55);
          g.addColorStop(0, rgba(c, clamp(pr.amount * k, 0, 1))); g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });
      },
    },
    fade: {
      label: '黑場淡入淡出', props: [{ key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main', anim: true },
        { key: 'mode', label: '方向', type: 'select', default: 'out', group: 'main', options: [['out', '畫面漸漸變成顏色'], ['in', '由顏色漸漸出現']] }],
      draw(ctx, pr, W, H, k, lt, dur, since) {
        const p = ease('sine', dur > 0 ? since / dur : 1);
        ctx.globalAlpha = clamp((pr.mode === 'in' ? 1 - p : p) * k, 0, 1);
        ctx.fillStyle = rgba(pr.color); ctx.fillRect(0, 0, W, H);
      },
    },
    flash: {
      label: '閃白', props: [amountProp(1), { key: 'color', label: '顏色', type: 'color', default: '#ffffff', group: 'main', anim: true }],
      draw(ctx, pr, W, H, k, lt, dur, since) {
        ctx.globalAlpha = clamp(pr.amount * k * Math.pow(1 - clamp(since / Math.max(0.01, dur), 0, 1), 2), 0, 1);
        ctx.fillStyle = rgba(pr.color); ctx.fillRect(0, 0, W, H);
      },
    },
    letterbox: {
      label: '電影黑邊', props: [{ key: 'ratio', label: '畫面比例', type: 'select', default: 2.35, group: 'main', options: [[2.35, '2.35：1'], [2, '2：1'], [1.85, '1.85：1']] },
        { key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main' }],
      draw(ctx, pr, W, H, k) {
        const bar = Math.max(0, (H - W / pr.ratio) / 2) * clamp(k, 0, 1);
        ctx.fillStyle = rgba(pr.color);
        ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      },
    },
  };

  // Transitions: progress p = 0..1 across the clip, fully covered at p = 0.5
  const TRANSITIONS = {
    fadeThrough: {
      label: '淡化過場', props: [{ key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main' }],
      draw(ctx, pr, W, H, p) {
        ctx.globalAlpha = ease('sine', 1 - Math.abs(2 * p - 1));
        ctx.fillStyle = rgba(pr.color); ctx.fillRect(0, 0, W, H);
      },
    },
    wipe: {
      label: '推移擦除', props: [{ key: 'color', label: '顏色', type: 'color', default: '#111111', group: 'main' },
        { key: 'dir', label: '方向', type: 'select', default: 'right', group: 'main', options: [['right', '向右'], ['left', '向左'], ['down', '向下'], ['up', '向上']] }],
      draw(ctx, pr, W, H, p) {
        const a = ease('easeInOut', clamp(p * 2, 0, 1)), b = ease('easeInOut', clamp(p * 2 - 1, 0, 1));
        const horiz = pr.dir === 'right' || pr.dir === 'left';
        const L = horiz ? W : H;
        let s = b * L, e = a * L;
        if (pr.dir === 'left' || pr.dir === 'up') { const s2 = L - e; e = L - s; s = s2; }
        ctx.fillStyle = rgba(pr.color);
        if (horiz) ctx.fillRect(s, 0, e - s, H); else ctx.fillRect(0, s, W, e - s);
      },
    },
    iris: {
      label: '圓形轉場', props: [{ key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main' }],
      draw(ctx, pr, W, H, p) {
        const r = Math.hypot(W, H) / 2 * ease('easeInOut', Math.abs(2 * p - 1));
        ctx.fillStyle = rgba(pr.color);
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fill();
      },
    },
    blinds: {
      label: '百葉窗', props: [{ key: 'color', label: '顏色', type: 'color', default: '#000000', group: 'main' },
        { key: 'count', label: '葉片數', type: 'number', min: 2, max: 40, step: 1, default: 10, group: 'main' }],
      draw(ctx, pr, W, H, p) {
        const k = ease('easeInOut', 1 - Math.abs(2 * p - 1));
        const n = Math.max(2, Math.round(pr.count)), band = H / n;
        ctx.fillStyle = rgba(pr.color);
        for (let i = 0; i < n; i++) ctx.fillRect(0, i * band, W, band * k + 0.5);
      },
    },
    zoom: {
      label: '衝擊縮放', props: [{ key: 'amount', label: '強度', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5, group: 'main' }],
      draw(ctx, pr, W, H, p) {
        const k = Math.sin(Math.PI * p);
        if (k < 0.001) return;
        const src = snapshot(ctx, W, H), s = 1 + k * 0.4 * pr.amount;
        ctx.filter = `blur(${k * 14 * pr.amount}px)`;
        ctx.drawImage(src, W / 2 - (W * s) / 2, H / 2 - (H * s) / 2, W * s, H * s);
        ctx.filter = 'none';
        ctx.globalAlpha = k * 0.6 * pr.amount; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      },
    },
  };

  for (const [name, fx] of Object.entries(EFFECTS)) {
    registerType('fx_' + name, {
      label: fx.label, category: 'effect', screen: true, props: fx.props,
      draw(p, pr, env) { fx.draw(p.drawingContext, pr, env.W, env.H, env.st.alpha, env.lt, env.clip.duration, env.t - env.clip.start); },
    });
  }
  for (const [name, tr] of Object.entries(TRANSITIONS)) {
    registerType('tr_' + name, {
      label: tr.label, category: 'transition', screen: true, props: tr.props,
      draw(p, pr, env) { tr.draw(p.drawingContext, pr, env.W, env.H, clamp((env.t - env.clip.start) / Math.max(0.01, env.clip.duration), 0, 1)); },
    });
  }
})();
