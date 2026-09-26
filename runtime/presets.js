// In / out / loop animation presets (CapCut-style one-click animations).
// clip.anim = { in: { type, dur }, out: { type, dur }, loop: { type, speed, amount } }
// animState() returns the offsets the renderer applies on top of the (keyframed) props.
(function () {
  const P5M = window.P5M;
  const { ease, seg, hash, noise, clamp } = P5M;

  // Per-glyph stagger: glyph i of n animates inside its own window of progress p
  function glyphP(p, i, n, width = 0.45) {
    const start = n > 1 ? ((1 - width) * i) / (n - 1) : 0;
    return seg(p, start, start + width);
  }

  // Each entry: label, dur (default seconds), text (text-only), apply(state, p, env)
  // p runs 0 -> 1 for "in" (0 = hidden, 1 = settled); "out" presets get p 0 -> 1 as the clip leaves.
  const IN = {
    none: { label: '無', apply() {} },
    fade: { label: '淡入', dur: 0.6, apply: (s, p) => { s.alpha *= ease('easeOut', p); } },
    slideLeft: { label: '左側滑入', dur: 0.7, apply: (s, p, e) => { const q = ease('easeOut', p); s.dx -= (1 - q) * e.W * 0.25; s.alpha *= Math.min(1, p * 2); } },
    slideRight: { label: '右側滑入', dur: 0.7, apply: (s, p, e) => { const q = ease('easeOut', p); s.dx += (1 - q) * e.W * 0.25; s.alpha *= Math.min(1, p * 2); } },
    slideUp: { label: '下方升起', dur: 0.7, apply: (s, p, e) => { const q = ease('easeOut', p); s.dy += (1 - q) * e.H * 0.25; s.alpha *= Math.min(1, p * 2); } },
    slideDown: { label: '上方落下', dur: 0.7, apply: (s, p, e) => { const q = ease('easeOut', p); s.dy -= (1 - q) * e.H * 0.25; s.alpha *= Math.min(1, p * 2); } },
    zoomIn: { label: '放大出現', dur: 0.6, apply: (s, p) => { const q = ease('easeOut', p); s.sx *= q; s.sy *= q; s.alpha *= Math.min(1, p * 3); } },
    zoomOut: { label: '縮小出現', dur: 0.7, apply: (s, p) => { const k = 1 + (1 - ease('easeOut', p)) * 0.8; s.sx *= k; s.sy *= k; s.alpha *= ease('easeOut', p); } },
    pop: { label: '彈出', dur: 0.6, apply: (s, p) => { const q = p <= 0 ? 0 : ease('backOut', p); s.sx *= q; s.sy *= q; } },
    drop: { label: '掉落彈跳', dur: 0.9, apply: (s, p, e) => { s.dy -= (1 - ease('bounce', p)) * e.H * 0.4; s.alpha *= Math.min(1, p * 4); } },
    spin: { label: '旋轉出現', dur: 0.8, apply: (s, p) => { const q = ease('easeOut', p); s.rot -= (1 - q) * 270; s.sx *= q; s.sy *= q; } },
    flip: { label: '翻轉', dur: 0.6, apply: (s, p) => { s.sx *= Math.sin(ease('easeOut', p) * Math.PI / 2); } },
    blur: { label: '模糊淡入', dur: 0.8, apply: (s, p) => { const q = ease('easeOut', p); s.blur += (1 - q) * 24; s.alpha *= q; } },
    wipe: { label: '擦除展開', dur: 0.8, apply: (s, p) => { s.reveal = { dir: 'right', p: ease('easeInOut', p) }; } },
    iris: { label: '圓形展開', dur: 0.8, apply: (s, p) => { s.reveal = { dir: 'iris', p: ease('easeInOut', p) }; } },
    typewriter: { label: '打字機', dur: 1.2, text: true, apply: (s, p) => { s.glyphs.push((g, i, n) => { if (glyphP(p, i, n, 0.02) <= 0) g.alpha = 0; }); } },
    stamp: { label: '逐字蓋章', dur: 1.4, text: true, apply: (s, p) => {
      s.glyphs.push((g, i, n) => { const q = glyphP(p, i, n, 0.35); g.s *= 1 + (1 - ease('easeOut', q)) * 0.6; g.alpha *= Math.min(1, q * 2.5); });
    } },
    rise: { label: '逐字升起', dur: 1.2, text: true, apply: (s, p) => {
      s.glyphs.push((g, i, n) => { const q = glyphP(p, i, n, 0.5); g.dy += (1 - ease('easeOut', q)) * 48; g.alpha *= q; });
    } },
    bounceIn: { label: '逐字彈跳', dur: 1.2, text: true, apply: (s, p) => {
      s.glyphs.push((g, i, n) => { const q = glyphP(p, i, n, 0.4); const k = q <= 0 ? 0 : ease('backOut', q); g.s *= k; });
    } },
  };

  const OUT = {
    none: { label: '無', apply() {} },
    fade: { label: '淡出', dur: 0.6, apply: (s, p) => { s.alpha *= 1 - ease('easeIn', p); } },
    slideLeft: { label: '向左滑出', dur: 0.7, apply: (s, p, e) => { s.dx -= ease('easeIn', p) * e.W * 0.25; s.alpha *= 1 - Math.max(0, p * 2 - 1); } },
    slideRight: { label: '向右滑出', dur: 0.7, apply: (s, p, e) => { s.dx += ease('easeIn', p) * e.W * 0.25; s.alpha *= 1 - Math.max(0, p * 2 - 1); } },
    slideUp: { label: '向上飄走', dur: 0.7, apply: (s, p, e) => { s.dy -= ease('easeIn', p) * e.H * 0.25; s.alpha *= 1 - Math.max(0, p * 2 - 1); } },
    slideDown: { label: '向下落下', dur: 0.7, apply: (s, p, e) => { s.dy += ease('easeIn', p) * e.H * 0.25; s.alpha *= 1 - Math.max(0, p * 2 - 1); } },
    zoomOut: { label: '縮小消失', dur: 0.6, apply: (s, p) => { const q = 1 - ease('easeIn', p); s.sx *= q; s.sy *= q; } },
    zoomIn: { label: '放大消失', dur: 0.6, apply: (s, p) => { const k = 1 + ease('easeIn', p) * 0.8; s.sx *= k; s.sy *= k; s.alpha *= 1 - p; } },
    pop: { label: '收回', dur: 0.5, apply: (s, p) => { const q = p >= 1 ? 0 : ease('backOut', 1 - p); s.sx *= q; s.sy *= q; } },
    spin: { label: '旋轉消失', dur: 0.8, apply: (s, p) => { const q = ease('easeIn', p); s.rot += q * 270; s.sx *= 1 - q; s.sy *= 1 - q; } },
    flip: { label: '翻轉', dur: 0.6, apply: (s, p) => { s.sx *= Math.cos(ease('easeIn', p) * Math.PI / 2); } },
    blur: { label: '模糊淡出', dur: 0.8, apply: (s, p) => { const q = ease('easeIn', p); s.blur += q * 24; s.alpha *= 1 - q; } },
    wipe: { label: '擦除收起', dur: 0.8, apply: (s, p) => { s.reveal = { dir: 'left', p: 1 - ease('easeInOut', p) }; } },
    iris: { label: '圓形收合', dur: 0.8, apply: (s, p) => { s.reveal = { dir: 'iris', p: 1 - ease('easeInOut', p) }; } },
    typewriter: { label: '倒退刪字', dur: 1, text: true, apply: (s, p) => { s.glyphs.push((g, i, n) => { if (glyphP(1 - p, i, n, 0.02) <= 0) g.alpha = 0; }); } },
    fall: { label: '逐字掉落', dur: 1.2, text: true, apply: (s, p) => {
      s.glyphs.push((g, i, n) => { const q = glyphP(p, i, n, 0.5); g.dy += ease('easeIn', q) * 80; g.rot += q * 30; g.alpha *= 1 - q; });
    } },
  };

  // Loop presets run for the whole clip; t = clip content time (seconds since start + offset, so split halves stay continuous)
  const LOOP = {
    none: { label: '無', apply() {} },
    float: { label: '漂浮', apply: (s, t, sp, am) => { s.dy += Math.sin(t * Math.PI * sp) * 12 * am; } },
    pulse: { label: '呼吸', apply: (s, t, sp, am) => { const k = 1 + Math.sin(t * Math.PI * 2 * sp) * 0.05 * am; s.sx *= k; s.sy *= k; } },
    sway: { label: '搖擺', apply: (s, t, sp, am) => { s.rot += Math.sin(t * Math.PI * sp) * 8 * am; } },
    spin: { label: '持續旋轉', apply: (s, t, sp, am) => { s.rot += t * 90 * sp * am; } },
    blink: { label: '閃爍', apply: (s, t, sp, am) => { s.alpha *= 1 - am * 0.5 * (1 - Math.cos(t * Math.PI * 2 * sp)) / 2 * 2; } },
    flicker: { label: '燭光', apply: (s, t, sp, am, seed) => { s.alpha *= 1 - am * 0.35 * noise(t * 6 * sp, 0, 0, seed); } },
    shake: { label: '抖動', apply: (s, t, sp, am, seed) => {
      s.dx += (noise(t * 12 * sp, 1, 0, seed) - 0.5) * 16 * am; s.dy += (noise(t * 12 * sp, 7, 0, seed) - 0.5) * 16 * am;
    } },
    heartbeat: { label: '心跳', apply: (s, t, sp, am) => {
      const ph = (t * sp) % 1;
      const k = 1 + (Math.exp(-Math.pow((ph - 0.1) * 18, 2)) * 0.08 + Math.exp(-Math.pow((ph - 0.3) * 18, 2)) * 0.05) * am;
      s.sx *= k; s.sy *= k;
    } },
    jelly: { label: '果凍', apply: (s, t, sp, am) => { const w = Math.sin(t * Math.PI * 2 * sp) * 0.06 * am; s.sx *= 1 + w; s.sy *= 1 - w; } },
    wave: { label: '逐字波浪', text: true, apply: (s, t, sp, am) => {
      s.glyphs.push((g, i) => { g.dy += Math.sin(t * Math.PI * 2 * sp - i * 0.6) * 8 * am; });
    } },
    glyphPulse: { label: '逐字閃亮', text: true, apply: (s, t, sp, am) => {
      s.glyphs.push((g, i, n) => { const ph = ((t * sp * 0.8 - i / Math.max(1, n)) % 1 + 1) % 1; g.s *= 1 + Math.exp(-ph * 12) * 0.25 * am; });
    } },
  };

  function animState(clip, t, env) {
    const s = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, blur: 0, reveal: null, glyphs: [] };
    const a = clip.anim;
    if (!a) return s;
    const since = t - clip.start;
    const until = clip.start + clip.duration - t;
    if (a.in && a.in.type && a.in.type !== 'none' && IN[a.in.type]) {
      const d = Math.max(0.01, Math.min(a.in.dur ?? IN[a.in.type].dur ?? 0.6, clip.duration));
      if (since < d) IN[a.in.type].apply(s, clamp(since / d, 0, 1), env);
    }
    if (a.out && a.out.type && a.out.type !== 'none' && OUT[a.out.type]) {
      const d = Math.max(0.01, Math.min(a.out.dur ?? OUT[a.out.type].dur ?? 0.6, clip.duration));
      if (until < d) OUT[a.out.type].apply(s, clamp(1 - until / d, 0, 1), env);
    }
    if (a.loop && a.loop.type && a.loop.type !== 'none' && LOOP[a.loop.type]) {
      LOOP[a.loop.type].apply(s, since + (clip.offset || 0), a.loop.speed ?? 1, a.loop.amount ?? 1, hashSeed(clip.id));
    }
    return s;
  }

  const seedCache = new Map();
  function hashSeed(id) {
    let v = seedCache.get(id);
    if (v === undefined) {
      v = 0;
      for (const ch of String(id)) v = (Math.imul(v, 31) + ch.charCodeAt(0)) | 0;
      seedCache.set(id, (v = Math.abs(v) % 100000));
    }
    return v;
  }

  // Default glyph transform and composition of all active glyph effects
  function glyphTransform(s, i, n) {
    const g = { dx: 0, dy: 0, s: 1, rot: 0, alpha: 1 };
    for (const f of s.glyphs) f(g, i, n);
    return g;
  }

  P5M.presets = { IN, OUT, LOOP, glyphP, hash, hashSeed };
  P5M.animState = animState;
  P5M.glyphTransform = glyphTransform;
})();
