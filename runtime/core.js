// P5M core: math, easing, colors, seeded random/noise, keyframes, clip timing and the type registry.
// Shared by the editor and the exported player. Classic script; everything hangs off window.P5M.
(function () {
  const P5M = (window.P5M = window.P5M || {});

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
  const rad = (deg) => (deg * Math.PI) / 180;

  // ---------- easing ----------
  const backOut = (p) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const bounceOut = (p) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  };
  const EASE = {
    linear: (p) => p,
    easeIn: (p) => p * p * p,
    easeOut: (p) => 1 - Math.pow(1 - p, 3),
    easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    backOut,
    backIn: (p) => 1 - backOut(1 - p),
    elastic: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    bounce: bounceOut,
    hold: (p) => (p >= 1 ? 1 : 0),
  };
  const EASE_LABELS = {
    linear: '線性', easeIn: '漸快', easeOut: '漸慢', easeInOut: '慢快慢', sine: '柔和',
    backOut: '回彈', backIn: '蓄力', elastic: '彈簧', bounce: '落地彈跳', hold: '瞬間切換',
  };
  const ease = (name, p) => (EASE[name] || EASE.easeInOut)(clamp(p, 0, 1));

  // ---------- colors ----------
  const colorCache = new Map();
  function parseColor(c) {
    if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]];
    const key = String(c || '#000000');
    const hit = colorCache.get(key);
    if (hit) return hit;
    let out = [0, 0, 0, 1];
    const s = key.trim();
    if (s[0] === '#') {
      const h = s.length === 4 || s.length === 5 ? [...s.slice(1)].map((x) => x + x).join('') : s.slice(1);
      out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
        h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    } else {
      const m = s.match(/rgba?\(([^)]+)\)/i);
      if (m) {
        const v = m[1].split(',').map((x) => parseFloat(x));
        out = [v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]];
      }
    }
    colorCache.set(key, out);
    return out;
  }
  const rgba = (c, alphaMul = 1) => {
    const [r, g, b, a] = parseColor(c);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+(a * alphaMul).toFixed(4)})`;
  };
  const hex2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  function toHex(c) {
    const [r, g, b, a] = parseColor(c);
    return '#' + hex2(r) + hex2(g) + hex2(b) + (a < 1 ? hex2(a * 255) : '');
  }
  function mixColor(a, b, p) {
    const x = parseColor(a), y = parseColor(b);
    return toHex([lerp(x[0], y[0], p), lerp(x[1], y[1], p), lerp(x[2], y[2], p), lerp(x[3], y[3], p)]);
  }
  const isColor = (v) => typeof v === 'string' && (v[0] === '#' || v.startsWith('rgb'));

  // ---------- seeded random and noise ----------
  // Stateless hash: same (n, seed) always gives the same number in [0, 1)
  function hash(n, seed = 0) {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x632be5ab, 0xc2b2ae35);
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  // Sequential generator for setup-time lists (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 3D gradient noise in [0, 1], seeded, independent of p5's global noiseSeed
  const permCache = new Map();
  function perm(seed) {
    let p = permCache.get(seed);
    if (p) return p;
    const r = rng(seed * 7919 + 17);
    const base = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
    p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    permCache.set(seed, p);
    return p;
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y, z) {
    const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise(x, y = 0, z = 0, seed = 0) {
    const p = perm(seed);
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const n = lerp(
      lerp(lerp(grad(p[AA] & 15, x, y, z), grad(p[BA] & 15, x - 1, y, z), u),
        lerp(grad(p[AB] & 15, x, y - 1, z), grad(p[BB] & 15, x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1] & 15, x, y, z - 1), grad(p[BA + 1] & 15, x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1] & 15, x, y - 1, z - 1), grad(p[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
    return clamp(n * 0.5 + 0.5, 0, 1);
  }

  // ---------- keyframes ----------
  // keys: [{ t, v, e }] sorted by t (clip-local seconds); e = easing from this key to the next
  function mixValue(a, b, p) {
    if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, p);
    if (isColor(a) && isColor(b)) return mixColor(a, b, p);
    return p < 1 ? a : b;
  }
  function sampleKeys(keys, t) {
    if (t <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1];
    if (t >= last.t) return last.v;
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1];
    return mixValue(a.v, b.v, ease(a.e, seg(t, a.t, b.t)));
  }

  // ---------- type registry ----------
  // def = { label, category, icon, screen?, audio?, props: [{ key, label, type, default, ... }], draw, bounds }
  const types = {};
  const COMMON_VISUAL = [
    { key: 'x', label: 'X', type: 'number', step: 1, group: 'transform', anim: true },
    { key: 'y', label: 'Y', type: 'number', step: 1, group: 'transform', anim: true },
    { key: 'scale', label: '縮放', type: 'number', step: 0.01, min: 0, default: 1, group: 'transform', anim: true },
    { key: 'rotation', label: '旋轉', type: 'number', step: 1, default: 0, unit: '°', group: 'transform', anim: true },
    { key: 'opacity', label: '不透明度', type: 'range', min: 0, max: 1, step: 0.01, default: 1, group: 'transform', anim: true },
  ];
  const FILTER_PROPS = [
    { key: 'blur', label: '模糊', type: 'range', min: 0, max: 40, step: 0.5, default: 0, group: 'filter', anim: true },
    { key: 'brightness', label: '亮度', type: 'range', min: 0, max: 3, step: 0.01, default: 1, group: 'filter', anim: true },
    { key: 'contrast', label: '對比', type: 'range', min: 0, max: 3, step: 0.01, default: 1, group: 'filter', anim: true },
    { key: 'saturate', label: '飽和度', type: 'range', min: 0, max: 3, step: 0.01, default: 1, group: 'filter', anim: true },
    { key: 'hue', label: '色相', type: 'range', min: -180, max: 180, step: 1, default: 0, unit: '°', group: 'filter', anim: true },
  ];
  function registerType(name, def) {
    const props = def.screen || def.audio ? def.props || [] : [...COMMON_VISUAL, ...(def.props || []), ...FILTER_PROPS];
    types[name] = { name, ...def, props };
  }
  function defaultProps(type, settings) {
    const def = types[type];
    const out = {};
    for (const pd of def.props) {
      if (pd.key === 'x') out.x = settings.width / 2;
      else if (pd.key === 'y') out.y = settings.height / 2;
      else if (pd.default !== undefined) out[pd.key] = typeof pd.default === 'function' ? pd.default(settings) : pd.default;
    }
    return out;
  }

  // ---------- clip timing ----------
  const clipEnd = (c) => c.start + c.duration;
  const isActive = (c, t) => t >= c.start && t < c.start + c.duration;
  const localTime = (c, t) => t - c.start + (c.offset || 0);

  // Resolved props at clip-local time lt: defaults <- props <- keyframes
  function resolveProps(clip, lt, settings) {
    const def = types[clip.type];
    const out = {};
    if (def) for (const pd of def.props) if (pd.default !== undefined) out[pd.key] = typeof pd.default === 'function' ? pd.default(settings) : pd.default;
    if (def && !def.screen && !def.audio) { out.x = settings.width / 2; out.y = settings.height / 2; }
    Object.assign(out, clip.props);
    if (clip.keys) for (const k in clip.keys) if (clip.keys[k] && clip.keys[k].length) out[k] = sampleKeys(clip.keys[k], lt);
    return out;
  }

  const fmtTime = (s) => {
    const neg = s < 0; s = Math.abs(s);
    const m = Math.floor(s / 60), sec = s - m * 60;
    return (neg ? '-' : '') + String(m).padStart(2, '0') + ':' + sec.toFixed(2).padStart(5, '0');
  };
  const uid = (prefix = 'id') => prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

  Object.assign(P5M, {
    VERSION: 1, clamp, lerp, seg, rad, EASE, EASE_LABELS, ease,
    parseColor, rgba, toHex, mixColor, isColor, hash, rng, noise,
    mixValue, sampleKeys, types, registerType, defaultProps,
    clipEnd, isActive, localTime, resolveProps, fmtTime, uid,
  });
})();
