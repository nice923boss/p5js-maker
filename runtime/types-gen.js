// Generative art layers. Each preset is a pure function of time; `uses` lists which generic params it reads
// so the inspector can hide the rest.
(function () {
  const P5M = window.P5M;
  const { registerType, hash, noise, rgba, mixColor } = P5M;
  const TAU = Math.PI * 2;

  const PRESETS = {
    gradientSky: {
      label: '漸層天空', uses: ['color', 'color2', 'color3', 'amount'],
      d: { color: '#0b1a3a', color2: '#4a3a78', color3: '#f29b76', amount: 0.3 },
      draw(ctx, pr, t, W, H) {
        const shift = Math.sin(t * 0.2 * pr.speed) * 0.08 * pr.amount;
        const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
        g.addColorStop(0, rgba(pr.color)); g.addColorStop(Math.max(0.05, Math.min(0.95, 0.55 + shift)), rgba(pr.color2)); g.addColorStop(1, rgba(pr.color3));
        ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2, W, H);
      },
    },
    moon: {
      label: '明月', uses: ['color', 'color2', 'amount', 'density'],
      d: { color: '#fff6d8', color2: '#ffd98a', amount: 1, density: 0.5, w: 360, h: 360 },
      draw(ctx, pr, t, W, H) {
        const R = Math.min(W, H) * 0.32;
        const HR = R * (1.6 + pr.amount * 0.8);
        const halo = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, HR);
        halo.addColorStop(0, rgba(pr.color2, 0.55 * pr.amount)); halo.addColorStop(1, rgba(pr.color2, 0));
        // fill a disc, not the W x H box: the halo is wider than the box and a rect would show hard edges
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, HR, 0, TAU); ctx.fill();
        const body = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
        body.addColorStop(0, rgba(mixColor(pr.color, '#ffffff', 0.5))); body.addColorStop(1, rgba(pr.color2));
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        ctx.save(); ctx.clip();
        const n = Math.round(4 + pr.density * 14);
        for (let i = 0; i < n; i++) {
          const a = hash(i, pr.seed) * TAU, d = Math.sqrt(hash(i + 50, pr.seed)) * R * 0.85, r = R * (0.05 + hash(i + 90, pr.seed) * 0.16);
          ctx.fillStyle = rgba(pr.color2, 0.28);
          ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); ctx.fill();
        }
        ctx.restore();
      },
    },
    clouds: {
      label: '雲朵', uses: ['color', 'color2', 'density', 'speed'],
      d: { color: '#ffffff', color2: '#dfe7f2', density: 0.5, speed: 1 },
      draw(ctx, pr, t, W, H) {
        const n = Math.round(3 + pr.density * 9);
        for (let i = 0; i < n; i++) {
          const sz = (0.12 + hash(i, pr.seed) * 0.16) * W;
          const span = W + sz * 3;
          const x = ((((hash(i + 7, pr.seed) * span + t * pr.speed * (12 + hash(i + 3, pr.seed) * 20)) % span) + span) % span) - span / 2;
          const y = (hash(i + 11, pr.seed) - 0.5) * H * 0.8;
          for (let k = 0; k < 6; k++) {
            const bx = x + (k - 2.5) * sz * 0.32, by = y - Math.sin((k / 5) * Math.PI) * sz * 0.28;
            const r = sz * (0.22 + 0.14 * Math.sin((k / 5) * Math.PI));
            ctx.fillStyle = rgba(k % 2 ? pr.color : pr.color2, 0.9);
            ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
          }
        }
      },
    },
    mountains: {
      label: '層疊山巒', uses: ['color', 'color2', 'density', 'speed', 'amount'],
      d: { color: '#2d3b5c', color2: '#0c1222', density: 0.5, speed: 0.3, amount: 1 },
      draw(ctx, pr, t, W, H) {
        const layers = Math.round(3 + pr.density * 4);
        for (let l = 0; l < layers; l++) {
          const k = layers > 1 ? l / (layers - 1) : 1;
          const base = -H * 0.1 + k * H * 0.35;
          const amp = H * (0.1 + 0.15 * pr.amount) * (1 - k * 0.3);
          const scroll = t * pr.speed * (20 + k * 60);
          ctx.fillStyle = rgba(mixColor(pr.color, pr.color2, k));
          ctx.beginPath(); ctx.moveTo(-W / 2, H / 2);
          for (let x = -W / 2; x <= W / 2 + 8; x += 8) {
            const n1 = noise((x + scroll) * 0.0025, l * 3.1, 0, pr.seed), n2 = noise((x + scroll) * 0.012, l * 5.3, 1, pr.seed);
            ctx.lineTo(x, base - (n1 * 0.8 + n2 * 0.2) * amp);
          }
          ctx.lineTo(W / 2, H / 2); ctx.closePath(); ctx.fill();
        }
      },
    },
    waves: {
      label: '海浪', uses: ['color', 'color2', 'density', 'speed', 'amount'],
      d: { color: '#4cc9f0', color2: '#123a6b', density: 0.5, speed: 1, amount: 1 },
      draw(ctx, pr, t, W, H) {
        const layers = Math.round(3 + pr.density * 5);
        for (let l = 0; l < layers; l++) {
          const k = layers > 1 ? l / (layers - 1) : 1;
          const base = k * H * 0.4 - H * 0.05;
          const amp = (10 + 30 * pr.amount) * (0.5 + k);
          ctx.fillStyle = rgba(mixColor(pr.color, pr.color2, k), 0.85);
          ctx.beginPath(); ctx.moveTo(-W / 2, H / 2);
          for (let x = -W / 2; x <= W / 2 + 8; x += 8) {
            const y = base + Math.sin(x * 0.008 + t * pr.speed * (1 + k) + l * 1.7) * amp + Math.sin(x * 0.021 - t * pr.speed * 1.3 + l) * amp * 0.35;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W / 2, H / 2); ctx.closePath(); ctx.fill();
        }
      },
    },
    aurora: {
      label: '極光', uses: ['color', 'color2', 'density', 'speed', 'amount'],
      d: { color: '#3ef0a0', color2: '#8a5cff', density: 0.5, speed: 1, amount: 1 },
      draw(ctx, pr, t, W, H) {
        ctx.globalCompositeOperation = 'lighter';
        const bands = Math.round(2 + pr.density * 3);
        const base = ctx.globalAlpha;
        for (let b = 0; b < bands; b++) {
          const col = b % 2 ? pr.color2 : pr.color;
          for (let x = -W / 2; x <= W / 2; x += 6) {
            const n = noise(x * 0.003 + b * 10, t * 0.15 * pr.speed, b, pr.seed);
            const top = -H * 0.35 + n * H * 0.35 + b * 20;
            const len = H * (0.15 + 0.35 * noise(x * 0.006, t * 0.3 * pr.speed, b + 5, pr.seed)) * pr.amount;
            const g = ctx.createLinearGradient(0, top, 0, top + len);
            g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.3, rgba(col, 0.16)); g.addColorStop(1, rgba(col, 0));
            ctx.globalAlpha = base; ctx.fillStyle = g; ctx.fillRect(x, top, 7, len);
          }
        }
      },
    },
    flowfield: {
      label: '流場線條', uses: ['color', 'color2', 'density', 'speed', 'amount'],
      d: { color: '#ffd166', color2: '#4cc9f0', density: 0.5, speed: 1, amount: 1 },
      draw(ctx, pr, t, W, H) {
        const n = Math.round(80 + pr.density * 520);
        const steps = 26, stepLen = 7;
        ctx.lineWidth = 1.2 + pr.amount; ctx.lineCap = 'round';
        for (const [ci, col] of [[0, pr.color], [1, pr.color2]]) {
          ctx.strokeStyle = rgba(col, 0.55); ctx.beginPath();
          for (let i = ci; i < n; i += 2) {
            let x = (hash(i, pr.seed) - 0.5) * W, y = (hash(i + 5000, pr.seed) - 0.5) * H;
            ctx.moveTo(x, y);
            for (let s = 0; s < steps; s++) {
              const a = noise(x * 0.0022, y * 0.0022, t * 0.12 * pr.speed, pr.seed) * TAU * 2;
              x += Math.cos(a) * stepLen; y += Math.sin(a) * stepLen;
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      },
    },
    mandala: {
      label: '萬花筒', uses: ['color', 'color2', 'color3', 'density', 'speed', 'amount'],
      d: { color: '#ffd166', color2: '#ef476f', color3: '#118ab2', density: 0.5, speed: 1, amount: 1, w: 640, h: 640 },
      draw(ctx, pr, t, W, H) {
        const folds = Math.round(6 + pr.density * 12);
        const R = Math.min(W, H) * 0.46;
        const cols = [pr.color, pr.color2, pr.color3];
        for (let ring = 0; ring < 4; ring++) {
          const rr = R * (1 - ring * 0.22);
          const rot = t * pr.speed * 0.3 * (ring % 2 ? -1 : 1);
          const petal = rr * (0.28 + 0.06 * Math.sin(t * pr.speed * 1.5 + ring) * pr.amount);
          ctx.fillStyle = rgba(cols[ring % 3], 0.75);
          for (let f = 0; f < folds; f++) {
            ctx.save(); ctx.rotate(rot + (f / folds) * TAU);
            ctx.beginPath(); ctx.moveTo(0, -rr + petal * 2);
            ctx.quadraticCurveTo(petal * 0.6, -rr + petal, 0, -rr);
            ctx.quadraticCurveTo(-petal * 0.6, -rr + petal, 0, -rr + petal * 2);
            ctx.fill(); ctx.restore();
          }
        }
        ctx.fillStyle = rgba(pr.color); ctx.beginPath(); ctx.arc(0, 0, R * 0.08, 0, TAU); ctx.fill();
      },
    },
    dotgrid: {
      label: '波動點陣', uses: ['color', 'color2', 'density', 'speed', 'amount'],
      d: { color: '#ffffff', color2: '#4cc9f0', density: 0.5, speed: 1, amount: 1 },
      draw(ctx, pr, t, W, H) {
        const gap = 70 - pr.density * 50;
        for (let y = -H / 2 + gap / 2; y < H / 2; y += gap) for (let x = -W / 2 + gap / 2; x < W / 2; x += gap) {
          const d = Math.hypot(x, y);
          const w = 0.5 + 0.5 * Math.sin(d * 0.02 - t * pr.speed * 2.5);
          ctx.fillStyle = rgba(mixColor(pr.color2, pr.color, w));
          ctx.beginPath(); ctx.arc(x, y, gap * 0.08 + gap * 0.28 * w * pr.amount, 0, TAU); ctx.fill();
        }
      },
    },
    ripples: {
      label: '漣漪', uses: ['color', 'density', 'speed', 'amount'],
      d: { color: '#bfefff', density: 0.4, speed: 1, amount: 1 },
      draw(ctx, pr, t, W, H) {
        const n = Math.round(2 + pr.density * 10);
        const period = 3 / Math.max(0.05, pr.speed);
        ctx.strokeStyle = rgba(pr.color); ctx.lineWidth = 2;
        const base = ctx.globalAlpha;
        for (let i = 0; i < n; i++) {
          const ph = hash(i, pr.seed) * period;
          const cyc = Math.floor((t + ph) / period), age = (t + ph) / period - cyc;
          const k = i * 997 + cyc;
          const x = (hash(k, pr.seed + 1) - 0.5) * W, y = (hash(k, pr.seed + 2) - 0.5) * H;
          for (let r = 0; r < 3; r++) {
            const a = age - r * 0.12;
            if (a <= 0) continue;
            ctx.globalAlpha = base * (1 - a) * 0.8;
            ctx.beginPath(); ctx.ellipse(x, y, a * 160 * pr.amount, a * 60 * pr.amount, 0, 0, TAU); ctx.stroke();
          }
        }
        ctx.globalAlpha = base;
      },
    },
    starfield: {
      label: '星際穿梭', uses: ['color', 'density', 'speed'],
      d: { color: '#ffffff', density: 0.5, speed: 1 },
      draw(ctx, pr, t, W, H) {
        const n = Math.round(100 + pr.density * 700);
        ctx.strokeStyle = rgba(pr.color); ctx.lineCap = 'round';
        const base = ctx.globalAlpha;
        for (let i = 0; i < n; i++) {
          const z = 1 - ((((hash(i, pr.seed) + t * 0.25 * pr.speed) % 1) + 1) % 1);
          const z2 = Math.min(1, z + 0.03 * pr.speed);
          const ax = (hash(i + 7000, pr.seed) - 0.5) * W, ay = (hash(i + 9000, pr.seed) - 0.5) * H;
          const f = 0.15;
          const x1 = (ax * f) / Math.max(0.01, z), y1 = (ay * f) / Math.max(0.01, z);
          const x2 = (ax * f) / z2, y2 = (ay * f) / z2;
          ctx.globalAlpha = base * Math.min(1, (1 - z) * 1.5);
          ctx.lineWidth = Math.max(0.5, (1 - z) * 3);
          ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.globalAlpha = base;
      },
    },
    sunburst: {
      label: '放射光芒', uses: ['color', 'color2', 'density', 'speed'],
      d: { color: '#ffe08a', color2: '#ffb347', density: 0.5, speed: 1 },
      draw(ctx, pr, t, W, H) {
        const rays = Math.round(8 + pr.density * 28);
        const R = Math.hypot(W, H);
        const rot = t * pr.speed * 0.15;
        ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip();
        for (let i = 0; i < rays; i++) {
          const a0 = rot + (i / rays) * TAU, a1 = a0 + TAU / rays;
          ctx.fillStyle = rgba(i % 2 ? pr.color : pr.color2);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
    },
  };

  const has = (key) => (pr) => (PRESETS[pr.preset] || PRESETS.gradientSky).uses.includes(key);

  registerType('gen', {
    label: '生成藝術', category: 'gen',
    props: [
      { key: 'preset', label: '樣式', type: 'select', default: 'gradientSky', group: 'main', options: Object.entries(PRESETS).map(([k, v]) => [k, v.label]) },
      { key: 'color', label: '顏色 1', type: 'color', default: '#0b1a3a', group: 'main', anim: true, when: has('color') },
      { key: 'color2', label: '顏色 2', type: 'color', default: '#4a3a78', group: 'main', anim: true, when: has('color2') },
      { key: 'color3', label: '顏色 3', type: 'color', default: '#f29b76', group: 'main', anim: true, when: has('color3') },
      { key: 'density', label: '密度', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5, group: 'main', when: has('density') },
      { key: 'speed', label: '速度', type: 'range', min: 0, max: 4, step: 0.05, default: 1, group: 'main', anim: true },
      { key: 'amount', label: '強度', type: 'range', min: 0, max: 2, step: 0.01, default: 1, group: 'main', anim: true, when: has('amount') },
      { key: 'w', label: '範圍寬', type: 'number', min: 1, step: 1, default: (s) => s.width, group: 'main' },
      { key: 'h', label: '範圍高', type: 'number', min: 1, step: 1, default: (s) => s.height, group: 'main' },
      { key: 'seed', label: '隨機種子', type: 'number', step: 1, default: 1, group: 'main' },
    ],
    draw(p, pr, env) {
      const ctx = p.drawingContext;
      (PRESETS[pr.preset] || PRESETS.gradientSky).draw(ctx, pr, env.lt, pr.w, pr.h);
    },
    bounds: (pr) => ({ w: pr.w, h: pr.h }),
  });

  P5M.genPresets = PRESETS;
})();
