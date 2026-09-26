// Library panel: tabs of ready-made items (click = add at playhead, drag = drop on stage / timeline),
// plus media import. Exports importFiles(files, pos) and pickAsset(accept) for the stage, timeline and inspector.
import { store, on } from './state.js';
import { h, toast, contextMenu } from './ui.js';
import { icon } from './icons.js';
import * as A from './actions.js';
import { stop as stopPlayback } from './transport.js';
import { paintThumb } from './thumbs.js';

const P5M = window.P5M;
const TABS = [
  ['media', '媒體', 'image'], ['text', '文字', 'text'], ['shape', '形狀', 'shape'], ['particles', '粒子', 'sparkles'],
  ['gen', '生成', 'palette'], ['3d', '3D', 'cube'], ['effect', '特效', 'wand'], ['transition', '轉場', 'transition'],
  ['audio', '音訊', 'music'], ['code', '程式碼', 'code'], ['legacy', '舊專案', 'archive'],
];
const BIG_FILE = 15 * 1024 * 1024;

let tab = 'text';
let rail, body;
let legacyImporter = null; // set by main.js (legacy-import.js) to avoid a hard dependency here

const S = () => store.project.settings;
const unit = () => Math.min(S().width, S().height) / 720;

export function initLibrary({ onImportLegacy } = {}) {
  legacyImporter = onImportLegacy || null;
  const root = document.getElementById('library');
  rail = h('nav.lib-rail');
  body = h('div.lib-body');
  root.append(rail, h('div.lib-main', body));
  for (const [key, label, ic] of TABS) {
    rail.appendChild(h('button.lib-tab', { dataset: { tab: key }, title: label, html: icon(ic), on: { click: () => setTab(key) } }, h('span', label)));
  }
  on((kind, source) => {
    // media / legacy lists show project assets
    if ((tab === 'media' || tab === 'legacy') && (kind === 'load' || (kind === 'project' && source !== 'timeline-drag' && source !== 'stage'))) render();
  });
  setTab(tab);
}

function setTab(key) {
  tab = key;
  rail.querySelectorAll('.lib-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === key));
  render();
}

function render() {
  if (!store.project) return;
  const top = body.scrollTop;
  body.replaceChildren(...(BUILD[tab] || (() => []))().filter(Boolean));
  body.scrollTop = top;
}

// ---------- cards ----------
function add(item) {
  A.addItem(item);
}

// makeItem() is called on click / drag start so sizes follow the current project settings
function card(makeItem, label, { cls = '', thumb = null, extra = null, tip = '' } = {}) {
  const th = thumb || h('div.thumb');
  const el = h('div.lib-card' + cls, {
    draggable: 'true', tabIndex: 0,
    title: (tip ? tip + '\n' : '') + '點一下加到播放頭位置，或拖曳到畫面／時間軸',
  }, th, h('div.name', label), h('span.add', { html: icon('plus') }), extra);
  el.addEventListener('click', (e) => { if (!e.target.closest('.audition')) add(makeItem()); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(makeItem()); });
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/x-p5m-item', JSON.stringify(makeItem()));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return el;
}

function thumbCard(item, label, opts = {}) {
  const th = h('div.thumb');
  paintThumb(th, item);
  return card(() => item, label, { ...opts, thumb: th });
}

const section = (title) => h('div.lib-section', title);
const grid = (cards) => h('div.lib-grid', cards);
const note = (html) => h('div.lib-note', { html });

// ---------- tab contents ----------
const TEXTS = [
  { label: '大標題', font: 'Noto Sans TC', weight: 900, css: 'font-size:22px', item: () => ({ text: '大標題', size: 110 * unit(), weight: 900 }), anim: { in: { type: 'rise', dur: 1.2 }, out: { type: 'fade', dur: 0.6 } } },
  { label: '副標題', font: 'Noto Sans TC', weight: 400, css: 'font-size:15px;color:#dfe6f0', item: () => ({ text: '副標題文字', size: 48 * unit(), weight: 400, fill: '#dfe6f0', y: S().height / 2 + 90 * unit() }), anim: { in: { type: 'fade', dur: 0.8 }, out: { type: 'fade', dur: 0.6 } } },
  { label: '字幕', font: 'Noto Sans TC', weight: 700, css: 'font-size:13px;-webkit-text-stroke:3px #000;paint-order:stroke', item: () => ({ text: '在這裡輸入字幕', size: 40 * unit(), strokeWeight: 6, stroke: '#000000', y: S().height * 0.87 }), anim: { in: { type: 'fade', dur: 0.3 }, out: { type: 'fade', dur: 0.3 } } },
  { label: '發光字', font: 'Noto Sans TC', weight: 900, css: 'font-size:22px;color:#fff7d6;text-shadow:0 0 10px #ffc94d', item: () => ({ text: '閃耀', size: 120 * unit(), weight: 900, fill: '#fff7d6', glow: 40, glowColor: '#ffc94d' }), anim: { in: { type: 'zoomIn', dur: 0.6 }, loop: { type: 'pulse', speed: 1, amount: 1 } } },
  { label: '書法標題', font: 'LXGW WenKai TC', weight: 700, css: 'font-size:20px;color:#ffe3a3', item: () => ({ text: '中秋快樂', font: 'LXGW WenKai TC', size: 120 * unit(), fill: '#ffe3a3' }), anim: { in: { type: 'stamp', dur: 1.4 } } },
  { label: '打字機', font: 'Noto Sans TC', weight: 700, css: 'font-size:13px', item: () => ({ text: '一個字一個字出現', size: 56 * unit() }), anim: { in: { type: 'typewriter', dur: 1.2 } } },
  { label: '逐字彈跳', font: 'Noto Sans TC', weight: 900, css: 'font-size:18px;color:#ffd166', item: () => ({ text: '歡迎光臨', size: 96 * unit(), weight: 900, fill: '#ffd166' }), anim: { in: { type: 'bounceIn', dur: 1.2 }, loop: { type: 'wave', speed: 1, amount: 1 } } },
  { label: '英文標題', font: 'Playfair Display', weight: 700, css: 'font-size:17px', item: () => ({ text: 'Happy Holidays', font: 'Playfair Display', size: 96 * unit() }), anim: { in: { type: 'zoomIn', dur: 0.6 }, out: { type: 'fade', dur: 0.6 } } },
];

const SHAPE_COLORS = ['#ffcc4d', '#5cc8ff', '#7ee081', '#ffd166', '#b48cff', '#ff6b8b', '#2dd4bf', '#ff9f43', '#ffffff'];
const FILL_FX = new Set(['fx_vignette', 'fx_grain', 'fx_grade', 'fx_tint', 'fx_letterbox', 'fx_lightLeak', 'fx_blur', 'fx_glow']);
const FX_DUR = { fx_flash: 0.6, fx_fade: 1.5 };
const MATERIAL_LABEL = { lit: '霧面', specular: '亮面', normal: '彩虹', wireframe: '線框' };
const SHAPES_3D = [['box', 'lit', '#ff8a5c'], ['sphere', 'specular', '#5cc8ff'], ['torus', 'normal', '#ffffff'], ['cone', 'lit', '#7ee081'],
  ['cylinder', 'specular', '#ffd166'], ['ellipsoid', 'normal', '#ffffff'], ['plane', 'lit', '#b48cff'], ['box', 'wireframe', '#2dd4bf']];

const CODE_SNIPPETS = [
  { label: '同心圓脈動', code: null },
  { label: '旋轉方塊', code: [
    '// t = seconds since this clip started',
    'p.rectMode(p.CENTER);', 'p.noFill();', 'p.strokeWeight(3);',
    'for (let i = 0; i < 12; i++) {', '  p.push();', '  p.rotate(t * 0.8 + i * 0.12);',
    '  p.stroke(90 + i * 12, 200, 255 - i * 10);', '  p.rect(0, 0, 60 + i * 24, 60 + i * 24);', '  p.pop();', '}'].join('\n') },
  { label: '正弦波', code: [
    'p.noFill();', 'p.stroke(255, 209, 102);', 'p.strokeWeight(4);', 'p.beginShape();',
    'for (let x = -180; x <= 180; x += 4) {', '  p.vertex(x, Math.sin(x * 0.03 + t * 3) * 60);', '}', 'p.endShape();'].join('\n') },
  { label: '隨機雜訊點', code: [
    '// P5M.noise(x, y) is deterministic, so every frame is reproducible',
    'p.noStroke();',
    'for (let i = 0; i < 300; i++) {', '  const a = i * 2.39996, r = Math.sqrt(i) * 10;',
    '  const s = 4 + P5M.noise(i * 0.1, t * 0.8) * 10;',
    '  p.fill(255, 150 + (i % 100), 200, 200);', '  p.circle(Math.cos(a) * r, Math.sin(a) * r, s);', '}'].join('\n') },
];

const BUILD = {
  media() {
    const drop = h('div.lib-drop', { html: icon('upload') + '<div>拖曳圖片或音訊到這裡<br>或點此選擇檔案</div>' });
    drop.addEventListener('click', () => pickFiles('image/*,audio/*', true).then((fs) => fs.length && importFiles(fs)));
    drop.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); importFiles([...e.dataTransfer.files]); });
    const assets = Object.values(store.project.assets);
    const images = assets.filter((a) => a.kind === 'image');
    const audios = assets.filter((a) => a.kind === 'audio');
    const out = [drop];
    if (!images.length && !audios.length) out.push(h('div.lib-empty', '還沒有匯入素材。也可以直接把檔案拖到畫面或時間軸上。'));
    if (images.length) {
      out.push(section('圖片'), grid(images.map((a) => {
        const th = h('div.thumb', { style: { backgroundImage: `url("${a.src}")`, backgroundSize: 'contain' } });
        return assetCard(a, card(() => ({ type: 'image', name: a.name, props: { asset: a.id, w: fitW(a) } }), a.name, { thumb: th }));
      })));
    }
    if (audios.length) {
      out.push(section('音訊'), grid(audios.map((a) => assetCard(a, audioCard(
        () => ({ type: 'audiofile', name: a.name, props: { asset: a.id } }), a.name, '♪', '', P5M.fmtTime(a.duration || 0))))));
    }
    return out;
  },

  text() {
    P5M.assets.requestFonts([...new Set(TEXTS.map((t) => t.font))]);
    return [section('點一下加入，雙擊畫面上的文字可直接改內容'), grid(TEXTS.map((t) => card(() => {
      const props = t.item();
      if (props.size) props.size = Math.round(props.size);
      return { type: 'text', name: t.label, props, anim: t.anim };
    }, t.label, {
      cls: '.text-card',
      thumb: h('div.thumb', { style: { fontFamily: `"${t.font}", sans-serif`, fontWeight: t.weight }, html: `<span style="${t.css}">${t.label}</span>` }),
    })))];
  },

  shape() {
    const kinds = P5M.types.shape.props.find((p) => p.key === 'kind').options;
    return [grid(kinds.map(([k, label], i) => thumbCard({ type: 'shape', name: label, props: { kind: k, fill: SHAPE_COLORS[i % SHAPE_COLORS.length] } }, label)))];
  },

  particles() {
    return [note('粒子會蓋滿整個畫面，預設長度到影片結尾。'), grid(Object.entries(P5M.particlePresets).map(([k, v]) =>
      thumbCard({ type: 'particles', name: v.label, props: { preset: k, ...v.d }, fill: true, thumbT: k === 'fireworks' ? 1.3 : 4 }, v.label)))];
  },

  gen() {
    const list = Object.entries(P5M.genPresets);
    const bg = list.filter(([, v]) => !(v.d && 'w' in v.d));
    const obj = list.filter(([, v]) => v.d && 'w' in v.d);
    const item = ([k, v], isBg) => ({ type: 'gen', name: v.label, props: { preset: k, ...v.d }, fill: isBg, background: isBg });
    return [
      section('背景（放在最底層，蓋滿畫面）'), grid(bg.map((e) => thumbCard(item(e, true), e[1].label))),
      section('物件'), grid(obj.map((e) => thumbCard(item(e, false), e[1].label))),
    ];
  },

  '3d'() {
    const kinds = Object.fromEntries(P5M.types.shape3d.props.find((p) => p.key === 'kind').options);
    return [grid(SHAPES_3D.map(([k, m, color]) => {
      const label = kinds[k] + '・' + MATERIAL_LABEL[m];
      return thumbCard({ type: 'shape3d', name: kinds[k], props: { kind: k, material: m, color } }, label);
    }))];
  },

  effect() {
    return [note('特效套用在它下方所有軌道的畫面上。'), grid(typesIn('effect').map(([k, def]) =>
      thumbCard({ type: k, name: def.label, fill: FILL_FX.has(k), duration: FX_DUR[k] }, def.label)))];
  },

  transition() {
    return [note('放在兩個片段的交接處，轉場中間（50%）時畫面完全被蓋住。'), grid(typesIn('transition').map(([k, def]) =>
      thumbCard({ type: k, name: def.label }, def.label)))];
  },

  audio() {
    const moods = P5M.types.music.props.find((p) => p.key === 'preset').options.filter(([k]) => k !== 'score');
    const importBtn = h('button.btn', { html: icon('upload'), on: { click: () => pickFiles('audio/*', true).then((fs) => fs.length && importFiles(fs)) } }, '匯入音訊檔');
    return [
      section('配樂（程式合成，不需要版權素材）'),
      grid(moods.map(([k, label]) => audioCard(() => ({ type: 'music', name: '配樂・' + label, props: { preset: k } }), label, '♫', '.music'))),
      section('音效'),
      grid(Object.entries(P5M.sfxCatalog).map(([k, v]) => audioCard(() => ({ type: 'sfx', name: v.label, props: { voice: k } }), v.label, '♪'))),
      h('div.btn-row', importBtn),
    ];
  },

  code() {
    return [
      note('進階：用 p5 語法直接畫。<b>p</b> 是 p5 實例，<b>t</b> 是片段開始後的秒數，以 (0, 0) 為中心繪製。位置、縮放、入場動畫由片段屬性控制。'),
      grid(CODE_SNIPPETS.map((s) => thumbCard({ type: 'code', name: s.label, props: s.code ? { code: s.code } : {} }, s.label))),
    ];
  },

  legacy() {
    const btn = h('button.btn.accent', { html: icon('folder'), on: { click: () => (legacyImporter ? legacyImporter() : toast('舊專案匯入尚未載入', 'error')) } }, '匯入舊專案資料夾…');
    const list = Object.values(store.project.assets).filter((a) => a.kind === 'legacy');
    return [
      note('匯入用 Claude 做的 p5-comfyui-animation 專案（含 engine.js、sketch.js 的資料夾）。匯入後整段當成一個片段，可以移動、裁切、加上文字或特效，但內部元素不能個別編輯。'),
      h('div.btn-row', { style: { marginBottom: '14px' } }, btn),
      list.length ? section('已匯入') : null,
      list.length ? grid(list.map((a) => assetCard(a, card(() => ({ type: 'legacy', name: a.name, props: { asset: a.id }, duration: a.duration }), a.name, {
        thumb: h('div.thumb', { html: icon('film') }), tip: `${a.width}×${a.height}，${P5M.fmtTime(a.duration || 0)}`,
      })))) : null,
    ];
  },
};

const typesIn = (cat) => Object.entries(P5M.types).filter(([, d]) => d.category === cat);
const fitW = (a) => Math.round(Math.min(a.w || 400, S().width * 0.6, (S().height * 0.6 * (a.w || 400)) / (a.h || 400)));

// ---------- audio cards with audition ----------
let auditioning = null; // { btn }
function audioCard(makeItem, label, glyph, cls = '', sub = '') {
  const btn = h('button.audition', { title: '試聽', html: icon('play') });
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const was = auditioning && auditioning.btn === btn;
    stopAudition();
    if (was) return;
    if (store.playing) stopPlayback();
    const item = makeItem();
    const clip = A.makeClip(item, store.project, 0);
    clip.duration = Math.min(clip.duration, 10);
    btn.innerHTML = icon('pause');
    auditioning = { btn };
    const eng = await P5M.audio.preview(clip, store.project);
    const ms = clip.duration * 1000 + 200;
    auditioning.timer = setTimeout(() => { if (auditioning && auditioning.btn === btn && P5M.audio.session === eng) stopAudition(); }, ms);
  });
  return card(makeItem, label, { cls: '.audio-card' + cls, thumb: h('div.thumb', glyph, sub ? h('small', { style: { fontSize: '11px', marginLeft: '6px' } }, sub) : null), extra: btn });
}
function stopAudition() {
  if (!auditioning) return;
  clearTimeout(auditioning.timer);
  auditioning.btn.innerHTML = icon('play');
  auditioning = null;
  P5M.audio.stop();
}
on((kind) => { if (kind === 'playing' && store.playing) stopAudition(); });

// Right-click on an asset card: remove it from the project when no clip uses it
function assetCard(asset, el) {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const used = P5M.assets.usedAssetIds(store.project).has(asset.id);
    contextMenu(e.clientX, e.clientY, [{
      label: used ? '使用中，無法移除' : '從專案移除素材', disabled: used,
      onClick: () => A.editAssets((as) => { delete as[asset.id]; }),
    }]);
  });
  return el;
}

// ---------- import ----------
function pickFiles(accept, multiple) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, multiple: !!multiple, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

const readDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

const imageSize = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = () => reject(new Error('無法解碼圖片'));
  img.src = src;
});

const audioDuration = (src) => new Promise((resolve, reject) => {
  const a = new Audio();
  a.preload = 'metadata';
  a.onloadedmetadata = () => resolve(a.duration);
  a.onerror = () => reject(new Error('無法解碼音訊'));
  a.src = src;
});

async function readAsset(file) {
  const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : null;
  if (!kind) return null;
  if (file.size > BIG_FILE) toast(`「${file.name}」有 ${(file.size / 1048576).toFixed(0)} MB，會內嵌在專案檔裡，存檔與匯出會變大`);
  const src = await readDataURL(file);
  const asset = { id: P5M.uid('a'), kind, name: file.name.replace(/\.[^.]+$/, ''), src };
  if (kind === 'image') Object.assign(asset, await imageSize(src));
  else asset.duration = Math.round((await audioDuration(src)) * 1000) / 1000;
  return asset;
}

// Import image / audio files. pos = { time?, trackId?, x?, y? } also places them as clips (stage / timeline drop).
export async function importFiles(files, pos = null) {
  const added = [];
  for (const f of files) {
    try {
      const a = await readAsset(f);
      if (a) added.push(a);
      else toast(`不支援「${f.name}」：請用圖片或音訊檔；專案檔請按上方「開啟」`, 'error');
    } catch (err) {
      console.error('匯入失敗', f.name, err);
      toast(`匯入「${f.name}」失敗：${err.message}`, 'error');
    }
  }
  if (!added.length) return [];
  A.editAssets((as) => { for (const a of added) as[a.id] = a; });
  if (pos) {
    for (const a of added) {
      if (a.kind === 'image') A.addItem({ type: 'image', name: a.name, props: { asset: a.id, w: fitW(a) } }, pos);
      else A.addItem({ type: 'audiofile', name: a.name, props: { asset: a.id } }, { time: pos.time });
    }
  } else {
    toast(`已匯入 ${added.length} 個素材`);
    if (tab !== 'media') setTab('media');
  }
  return added;
}

// Inspector "匯入檔案…": returns the new asset id or null
export async function pickAsset(accept) {
  const files = await pickFiles(accept === 'audio' ? 'audio/*' : 'image/*', false);
  if (!files.length) return null;
  const added = await importFiles(files);
  return added.length ? added[0].id : null;
}
