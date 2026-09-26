// Particle and weather layers. Stateless: every particle position is a pure function of (index, seed, time),
// so scrubbing, seeking and export all give identical frames without simulation state.
(function () {
  const P5M = window.P5M;
  const { registerType, hash, noise, rgba, parseColor, mixColor } = P5M;
  const TAU = Math.PI * 2;

  // Cached soft round sprite per color (radial gradient), drawn with drawImage for speed
  const spriteCache = new Map();
  function softDot(color) {
    let c = spriteCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    // CPU-backed on purpose: GPU-backed sprites were measured at ~7 ms per drawImage once Chrome's canvas
    // state degraded (300-particle fireworks frame took 1.7 s); CPU sprites stayed ~0.002 ms per draw
    const g = c.getContext('2d', { willReadFrequently: true });
    const [r, gg, b] = parseColor(color);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    spriteCache.set(color, c);
    return c;
  }
  function sprite(ctx, color, x, y, d, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(softDot(color), x - d / 2, y - d / 2, d, d);
  }
  function petal(ctx, x, y, s, rot, flip) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flip);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.6, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.9, -s * 0.6, 0, -s);
    ctx.fill();
    ctx.restore();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
    ctx.fill();
  }

  // motion: fall / rise (wrap vertically), drift (wrap horizontally), wander (noise), static, burst (fireworks)
  const PRESETS = {
    snow: { label: '雪花', motion: 'fall', vy: 60, sway: 18, d: { count: 180, size: 7, speed: 1, wind: 0.3, color: '#ffffff', color2: '#d6e9ff' },
      draw: (ctx, q, pr) => sprite(ctx, q.color, q.x, q.y, q.s * 2.2, q.a * 0.95) },
    rain: { label: '雨', motion: 'fall', vy: 900, sway: 0, d: { count: 220, size: 2, speed: 1, wind: 0.15, color: '#b8d4ff', color2: '#7fa8e0' },
      draw: (ctx, q, pr) => {
        const len = q.s * 9;
        ctx.globalAlpha = q.a * 0.6; ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, q.s * 0.6);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - pr.wind * len * 0.8, q.y - len); ctx.stroke();
      } },
    sakura: { label: '櫻花', motion: 'fall', vy: 55, sway: 50, d: { count: 70, size: 10, speed: 1, wind: 0.6, color: '#ffc4d6', color2: '#ff9ab8' },
      draw: (ctx, q) => { ctx.globalAlpha = q.a; ctx.fillStyle = q.color; petal(ctx, q.x, q.y, q.s, q.spin, Math.cos(q.spin * 1.7)); } },
    leaves: { label: '落葉', motion: 'fall', vy: 70, sway: 60, d: { count: 45, size: 14, speed: 1, wind: 0.5, color: '#e8923a', color2: '#c0392b' },
      draw: (ctx, q) => {
        ctx.globalAlpha = q.a; ctx.fillStyle = q.color; petal(ctx, q.x, q.y, q.s, q.spin, Math.cos(q.spin * 1.3) * 0.6);
        ctx.strokeStyle = 'rgba(80,40,10,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(q.x - Math.sin(q.spin) * q.s, q.y + Math.cos(q.spin) * q.s * 0.2); ctx.lineTo(q.x + Math.sin(q.spin) * q.s, q.y); ctx.stroke();
      } },
    confetti: { label: '彩色紙花', motion: 'fall', vy: 160, sway: 30, palette: true, d: { count: 160, size: 9, speed: 1, wind: 0.2, color: '#ffd166', color2: '#ef476f' },
      draw: (ctx, q) => {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.spin); ctx.scale(1, Math.cos(q.spin * 2.3));
        ctx.globalAlpha = q.a; ctx.fillStyle = q.color; ctx.fillRect(-q.s / 2, -q.s * 0.3, q.s, q.s * 0.6); ctx.restore();
      } },
    bubbles: { label: '泡泡', motion: 'rise', vy: 70, sway: 25, d: { count: 40, size: 22, speed: 1, wind: 0, color: '#bfefff', color2: '#ffffff' },
      draw: (ctx, q) => {
        ctx.globalAlpha = q.a * 0.8; ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, q.s * 0.08);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, TAU); ctx.stroke();
        ctx.globalAlpha = q.a * 0.6; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(q.x - q.s * 0.35, q.y - q.s * 0.35, q.s * 0.18, 0, TAU); ctx.fill();
      } },
    embers: { label: '火星', motion: 'rise', vy: 90, sway: 30, life: true, d: { count: 90, size: 5, speed: 1, wind: 0.1, color: '#ffb347', color2: '#ff4e1a' },
      draw: (ctx, q) => sprite(ctx, q.color, q.x, q.y, q.s * 3, q.a) },
    lanterns: { label: '天燈', motion: 'rise', vy: 28, sway: 14, d: { count: 24, size: 26, speed: 1, wind: 0.1, color: '#ffb84d', color2: '#ff7a2f' },
      draw: (ctx, q) => {
        sprite(ctx, q.color, q.x, q.y, q.s * 4, q.a * 0.45);
        ctx.globalAlpha = q.a;
        const w = q.s, h = q.s * 1.25;
        const g = ctx.createLinearGradient(0, q.y - h / 2, 0, q.y + h / 2);
        g.addColorStop(0, rgba(q.color2)); g.addColorStop(1, rgba(mixColor(q.color, '#fff6c8', 0.5)));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(q.x - w * 0.42, q.y - h / 2); ctx.lineTo(q.x + w * 0.42, q.y - h / 2);
        ctx.lineTo(q.x + w * 0.32, q.y + h / 2); ctx.lineTo(q.x - w * 0.32, q.y + h / 2); ctx.closePath(); ctx.fill();
      } },
    hearts: { label: '愛心飄升', motion: 'rise', vy: 60, sway: 30, d: { count: 36, size: 14, speed: 1, wind: 0, color: '#ff6b8b', color2: '#ffb3c6' },
      draw: (ctx, q) => { ctx.globalAlpha = q.a; ctx.fillStyle = q.color; heart(ctx, q.x, q.y, q.s); } },
    fireflies: { label: '螢火蟲', motion: 'wander', d: { count: 50, size: 6, speed: 1, wind: 0, color: '#d9ff7a', color2: '#fff3a0' },
      draw: (ctx, q) => { const b = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(q.t * 2.2 * q.r5 + q.r6 * TAU), 2); sprite(ctx, q.color, q.x, q.y, q.s * 4, q.a * b); } },
    dust: { label: '光塵', motion: 'wander', d: { count: 120, size: 3, speed: 0.5, wind: 0, color: '#fff2cc', color2: '#ffffff' },
      draw: (ctx, q) => sprite(ctx, q.color, q.x, q.y, q.s * 3, q.a * (0.3 + 0.5 * q.r5)) },
    stars: { label: '星星閃爍', motion: 'static', d: { count: 160, size: 3, speed: 1, wind: 0, color: '#ffffff', color2: '#ffe9a8' },
      draw: (ctx, q) => {
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(q.t * (1 + q.r5 * 3) + q.r6 * TAU));
        sprite(ctx, q.color, q.x, q.y, q.s * 3, q.a * tw);
        if (q.r7 > 0.93) {
          ctx.globalAlpha = q.a * tw * 0.7; ctx.strokeStyle = q.color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(q.x - q.s * 4, q.y); ctx.lineTo(q.x + q.s * 4, q.y); ctx.moveTo(q.x, q.y - q.s * 4); ctx.lineTo(q.x, q.y + q.s * 4); ctx.stroke();
        }
      } },
    fog: { label: '霧氣', motion: 'drift', vx: 18, d: { count: 26, size: 220, speed: 1, wind: 1, color: '#ffffff', color2: '#dde6f0' },
      draw: (ctx, q) => sprite(ctx, q.color, q.x, q.y, q.s * 2, q.a * 0.14) },
    fireworks: { label: '煙火', motion: 'burst', d: { count: 240, size: 4, speed: 1, wind: 0, color: '#ffd166', color2: '#ff5d8f' } },
  };

  // Burst fireworks: `bursts` shells each own count/bursts sparks; each shell re-launches every `period` seconds
  function drawFireworks(ctx, pr, t, W, H, A) {
    const seed = pr.seed | 0;
    const bursts = Math.max(1, Math.round(pr.count / 60));
    const per = Math.max(8, Math.floor(pr.count / bursts));
    const period = 2.6 / Math.max(0.05, pr.speed);
    for (let b = 0; b < bursts; b++) {
      const phase = hash(b * 13 + 1, seed) * period;
      const cycle = Math.floor((t + phase) / period);
      const age = (t + phase) / period - cycle; // 0..1 inside one launch
      const k = b * 1000 + cycle;
      const cx = (hash(k, seed + 3) - 0.5) * W * 0.8;
      const cy = (hash(k, seed + 5) - 0.5) * H * 0.5 - H * 0.12;
      const color = hash(k, seed + 7) < 0.5 ? pr.color : pr.color2;
      const launch = 0.22;
      if (age < launch) { // rising shell
        const q = age / launch;
        const y = H / 2 - (H / 2 - cy) * (1 - Math.pow(1 - q, 2));
        sprite(ctx, color, cx, y, pr.size * 3, 0.9 * A);
        continue;
      }
      const e = (age - launch) / (1 - launch);
      const radius = Math.min(W, H) * 0.22 * (0.7 + hash(k, seed + 11) * 0.6);
      const fadeA = Math.pow(1 - e, 1.6) * A;
      for (let j = 0; j < per; j++) {
        const ang = (j / per) * TAU + hash(j, k) * 0.3;
        const sp = 0.65 + hash(j + 99, k) * 0.35;
        const dist = radius * sp * (1 - Math.pow(1 - e, 3));
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist + e * e * radius * 0.5;
        const tail = radius * sp * 0.12 * (1 - e);
        ctx.globalAlpha = fadeA * 0.6; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, pr.size * 0.4);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * tail, y - Math.sin(ang) * tail); ctx.stroke();
        sprite(ctx, color, x, y, pr.size * 2.5, fadeA);
      }
    }
  }

  function palette(pr) { return [pr.color, pr.color2, '#ffd166', '#06d6a0', '#4cc9f0', '#f72585']; }

  function draw(p, pr, env) {
    const ctx = p.drawingContext;
    const preset = PRESETS[pr.preset] || PRESETS.snow;
    const W = pr.w, H = pr.h, t = env.lt;
    const seed = pr.seed | 0;
    const baseAlpha = ctx.globalAlpha;
    if (preset.motion === 'burst') { ctx.globalCompositeOperation = 'lighter'; drawFireworks(ctx, pr, t, W, H, baseAlpha); ctx.globalAlpha = baseAlpha; return; }
    const n = Math.max(0, Math.min(2000, Math.round(pr.count)));
    const sp = pr.speed;
    const m = pr.size * 4 + 20; // wrap margin so particles leave fully before reappearing
    const pal = preset.palette ? palette(pr) : null;
    for (let i = 0; i < n; i++) {
      const r = (k) => hash(i * 16 + k, seed);
      const q = { t, r5: r(5), r6: r(6), r7: r(7), a: baseAlpha, s: pr.size * (0.5 + r(2)) };
      q.color = pal ? pal[Math.floor(r(4) * pal.length)] : r(4) < 0.5 ? pr.color : pr.color2;
      const depth = 0.55 + r(3) * 0.9; // parallax: bigger particles move faster
      if (preset.motion === 'fall' || preset.motion === 'rise') {
        const span = H + 2 * m, spanX = W + 2 * m;
        const travel = preset.vy * sp * depth * t;
        let y = (((r(1) * span + travel) % span) + span) % span;
        if (preset.motion === 'rise') y = span - y;
        const sway = Math.sin(t * sp * (0.6 + r(8)) + r(9) * TAU) * (preset.sway || 0) * depth;
        const x = ((((r(0) * spanX + pr.wind * 80 * sp * depth * t + sway) % spanX) + spanX) % spanX);
        q.x = x - m - W / 2; q.y = y - m - H / 2;
        q.spin = r(10) * TAU + t * sp * (r(11) - 0.5) * 4;
        if (preset.life) q.a *= Math.sin(Math.PI * Math.min(1, y / span));
      } else if (preset.motion === 'drift') {
        const spanX = W + 2 * m;
        const x = (((r(0) * spanX + preset.vx * pr.wind * sp * depth * t) % spanX) + spanX) % spanX;
        q.x = x - m - W / 2;
        q.y = (r(1) - 0.5) * H + Math.sin(t * 0.3 * sp + r(9) * TAU) * 20;
      } else if (preset.motion === 'wander') {
        const f = 0.12 * sp;
        q.x = (r(0) - 0.5) * W + (noise(t * f + r(8) * 50, i * 0.37, 0, seed) - 0.5) * W * 0.35;
        q.y = (r(1) - 0.5) * H + (noise(t * f + r(9) * 50, i * 0.37, 7, seed) - 0.5) * H * 0.35;
      } else {
        q.x = (r(0) - 0.5) * W; q.y = (r(1) - 0.5) * H;
      }
      preset.draw(ctx, q, pr);
    }
    ctx.globalAlpha = baseAlpha;
  }

  registerType('particles', {
    label: '粒子', category: 'particles',
    props: [
      { key: 'preset', label: '效果', type: 'select', default: 'snow', group: 'main', options: Object.entries(PRESETS).map(([k, v]) => [k, v.label]) },
      { key: 'count', label: '數量', type: 'number', min: 0, max: 2000, step: 1, default: 180, group: 'main', anim: true },
      { key: 'size', label: '大小', type: 'number', min: 0.5, step: 0.5, default: 7, group: 'main', anim: true },
      { key: 'speed', label: '速度', type: 'range', min: 0, max: 4, step: 0.05, default: 1, group: 'main', anim: true },
      { key: 'wind', label: '風向', type: 'range', min: -3, max: 3, step: 0.05, default: 0.3, group: 'main', anim: true },
      { key: 'color', label: '顏色 1', type: 'color', default: '#ffffff', group: 'main', anim: true },
      { key: 'color2', label: '顏色 2', type: 'color', default: '#d6e9ff', group: 'main', anim: true },
      { key: 'w', label: '範圍寬', type: 'number', min: 1, step: 1, default: (s) => s.width, group: 'main' },
      { key: 'h', label: '範圍高', type: 'number', min: 1, step: 1, default: (s) => s.height, group: 'main' },
      { key: 'seed', label: '隨機種子', type: 'number', step: 1, default: 1, group: 'main' },
    ],
    draw,
    bounds: (pr) => ({ w: pr.w, h: pr.h }),
  });

  P5M.particlePresets = PRESETS;
})();
