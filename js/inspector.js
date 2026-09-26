// Inspector: project settings (nothing selected), camera, or the selected clip's props and animations
import { store, on, mutate, findClip, targetTime, writeProp, toggleKey, keyAt, hasKeys, allKeyTimes, snapToFrame } from './state.js';
import { h } from './ui.js';
import { icon } from './icons.js';
import { field } from './fields.js';
import * as A from './actions.js';
import { seek, playRange } from './transport.js';
import { pickAsset } from './library.js';

const P5M = window.P5M;
const KEY_EPS = 1 / 240;
const roundT = (t) => Math.round(t * 1000) / 1000;
const BLENDS = [['source-over', '一般'], ['multiply', '色彩增值'], ['screen', '濾色'], ['overlay', '覆蓋'], ['soft-light', '柔光'], ['lighter', '相加發光'], ['difference', '差異']];
const SIZES = [[1280, 720, '1280×720 橫式 HD'], [1920, 1080, '1920×1080 橫式 Full HD'], [1080, 1920, '1080×1920 直式短影音'], [720, 1280, '720×1280 直式'], [1080, 1080, '1080×1080 方形']];
const CAM_PROPS = [
  { key: 'x', label: '中心 X', type: 'number', step: 1, anim: true },
  { key: 'y', label: '中心 Y', type: 'number', step: 1, anim: true },
  { key: 'zoom', label: '縮放', type: 'number', step: 0.01, min: 0.05, anim: true },
  { key: 'rotation', label: '旋轉', type: 'number', step: 1, unit: '°', anim: true },
  { key: 'shake', label: '震動', type: 'range', min: 0, max: 60, step: 1, anim: true },
];
const GROUP_TITLE = { transform: '位置與變形', filter: '濾鏡' };

let root, titleEl, subEl, body;
let fields = [];   // { update(pr) } refreshed from resolved props
let extra = [];    // (ctx) => void, other live bits (timing, kf bar)
let tab = 'props';
let builtFor = undefined;

export function initInspector() {
  root = document.getElementById('inspector');
  titleEl = h('span');
  subEl = h('span.sub');
  body = h('div.panel-body');
  root.append(h('div.panel-title', titleEl, subEl), body);
  on((kind, source) => {
    if (kind === 'load' || kind === 'select') rebuild();
    else if (kind === 'time') { if (!store.playing) refresh(); }
    else if (kind === 'playing') { if (!store.playing) refresh(); }
    else if (kind === 'project') {
      if (!targetExists()) rebuild();
      else if (['inspector', 'stage', 'timeline-drag'].includes(source) || root.contains(document.activeElement)) refresh();
      else rebuild();
    }
  });
  document.addEventListener('p5m:focus-prop', (e) => focusProp(e.detail && e.detail.key));
}

const targetExists = () => !store.sel || store.sel === 'camera' || !!findClip(store.sel);

function rebuild() {
  if (!store.project) return;
  const keepScroll = builtFor === store.sel ? body.scrollTop : 0;
  fields = [];
  extra = [];
  body.replaceChildren();
  builtFor = store.sel;
  if (store.sel === 'camera') buildCamera();
  else if (store.sel && findClip(store.sel)) buildClip(store.sel);
  else buildProject();
  refresh();
  body.scrollTop = keepScroll;
}

function context() {
  const p = store.project;
  if (store.sel === 'camera') return { target: p.camera, pr: P5M.cameraAt(p, store.time), lt: store.time };
  if (store.sel) {
    const f = findClip(store.sel);
    if (!f) return null;
    const lt = targetTime(f.clip);
    return { target: f.clip, pr: P5M.resolveProps(f.clip, lt, p.settings), lt };
  }
  return { pr: { ...p.settings, title: p.title || '' } };
}

function refresh() {
  if (!store.project) return;
  const ctx = context();
  if (!ctx) return;
  for (const f of fields) f.update(ctx.pr);
  for (const fn of extra) fn(ctx);
}

function focusProp(key) {
  if (!key) return;
  if (tab !== 'props') { tab = 'props'; rebuild(); }
  const f = fields.find((x) => x.key === key);
  if (!f || !f.focusEl) return;
  const d = f.el.closest('details');
  if (d) d.open = true;
  f.focusEl.focus();
  if (f.focusEl.select) f.focusEl.select();
}

const group = (title, open, kids) => h('details.grp', { open }, h('summary', title), h('div.grp-body', kids));
const addField = (pd, io) => { const f = field(pd, io); fields.push(f); return f.el; };

// ---------- project ----------
function buildProject() {
  titleEl.textContent = '專案設定';
  subEl.textContent = '未選取片段';
  const s = () => store.project.settings;
  const setting = (key, fix = (v) => v) => ({
    id: 'project', value: () => s()[key],
    set: (v, merge) => mutate(() => { s()[key] = fix(v); }, { merge, source: 'inspector' }),
  });

  const title = h('input.inp', { placeholder: '未命名專案', spellcheck: 'false' });
  title.addEventListener('input', () => mutate((p) => { p.title = title.value; }, { merge: 'ins:title', source: 'inspector' }));
  extra.push(() => { if (document.activeElement !== title) title.value = store.project.title || ''; });

  const sizeSel = h('select.sel', SIZES.map(([w, hh, l]) => h('option', { value: w + 'x' + hh }, l)), h('option', { value: 'custom' }, '自訂尺寸'));
  const wIn = h('input.inp.num', { type: 'number', min: 16, max: 4096, step: 2 });
  const hIn = h('input.inp.num', { type: 'number', min: 16, max: 4096, step: 2 });
  sizeSel.addEventListener('change', () => { if (sizeSel.value !== 'custom') setSize(...sizeSel.value.split('x').map(Number)); });
  const onWH = () => setSize(+wIn.value, +hIn.value);
  wIn.addEventListener('change', onWH);
  hIn.addEventListener('change', onWH);
  extra.push(() => {
    const { width: w, height: hh } = s();
    sizeSel.value = SIZES.some((x) => x[0] === w && x[1] === hh) ? w + 'x' + hh : 'custom';
    if (document.activeElement !== wIn) wIn.value = w;
    if (document.activeElement !== hIn) hIn.value = hh;
  });

  const trimBtn = h('button.btn', { title: '把影片長度設成最後一個片段的結尾', on: { click: () => {
    const end = P5M.contentEnd(store.project);
    if (end > 0) mutate(() => { s().duration = Math.ceil(end * 10) / 10; }, { source: 'inspector' });
  } } }, '裁到內容長度');

  body.append(
    group('基本', true, [
      h('div.row', h('label', '名稱'), h('div.ctl', title), h('span')),
      h('div.row', h('label', '畫面尺寸'), h('div.ctl', sizeSel), h('span')),
      h('div.row', h('label', '寬 × 高'), h('div.ctl', wIn, h('span.unit', '×'), hIn), h('span')),
      addField({ key: 'fps', label: '影格率', type: 'select', options: [[24, '24 fps 電影感'], [25, '25 fps'], [30, '30 fps 標準'], [60, '60 fps 流暢']] }, setting('fps')),
      addField({ key: 'duration', label: '影片長度', type: 'number', step: 0.1, min: 0.5, unit: '秒' }, setting('duration', (v) => Math.max(0.5, v))),
      h('div.row', h('span'), h('div.ctl', trimBtn), h('span')),
      addField({ key: 'background', label: '背景色', type: 'color' }, setting('background')),
      addField({ key: 'volume', label: '主音量', type: 'range', min: 0, max: 1, step: 0.01 }, setting('volume')),
    ]),
  );
  body.appendChild(h('div.tips', { html:
    '<b>快速上手</b><br>' +
    '1. 點左側素材庫的素材，會加到播放頭位置；也可以直接拖到畫面或時間軸。<br>' +
    '2. 在畫面上拖曳移動，拖四角縮放，拖上方圓點旋轉（Shift 鎖角度）。<br>' +
    '3. 時間軸拖曳片段調整出場時間，拖左右兩端裁切長度。<br>' +
    '4. 屬性右側的 ◇ 是關鍵影格：按下記錄目前數值，移動播放頭再改數值就會產生動畫。<br><br>' +
    '<kbd>Space</kbd> 播放　<kbd>S</kbd> 分割　<kbd>Delete</kbd> 刪除<br>' +
    '<kbd>Ctrl+Z</kbd> 復原　<kbd>Ctrl+D</kbd> 建立副本　<kbd>←</kbd><kbd>→</kbd> 逐格',
  }));
}

function setSize(w, hh) {
  const even = (v) => Math.max(16, Math.min(4096, Math.round((+v || 0) / 2) * 2));
  w = even(w);
  hh = even(hh);
  mutate((p) => {
    const s = p.settings, cam = p.camera.props;
    if (cam.x === s.width / 2) cam.x = w / 2;
    if (cam.y === s.height / 2) cam.y = hh / 2;
    s.width = w;
    s.height = hh;
  }, { source: 'inspector' });
}

// ---------- keyframe bar (clip or camera) ----------
// toProject(kt) converts a key time of the target into project time
function kfBar(getTarget, toProject) {
  const info = h('span', { style: { flex: 'none' } });
  const easeSel = h('select.sel', { title: '從這個關鍵影格到下一個的速度曲線' }, Object.entries(P5M.EASE_LABELS).map(([k, l]) => h('option', { value: k }, l)));
  const keysAt = (tg, lt) => {
    const out = [];
    for (const k in tg.keys || {}) for (const x of tg.keys[k]) if (Math.abs(x.t - lt) < KEY_EPS) out.push(x);
    return out;
  };
  easeSel.addEventListener('change', () => mutate(() => {
    const tg = getTarget();
    for (const x of keysAt(tg, targetTime(tg))) x.e = easeSel.value;
  }, { source: 'inspector' }));
  const jump = (dir) => {
    const tg = getTarget(), lt = targetTime(tg);
    const ts = allKeyTimes(tg).filter((t) => (dir < 0 ? t < lt - KEY_EPS : t > lt + KEY_EPS));
    if (ts.length) seek(toProject(dir < 0 ? ts[ts.length - 1] : ts[0]));
  };
  const prev = h('button.btn', { title: '上一個關鍵影格', html: icon('stepBack'), on: { click: () => jump(-1) } });
  const next = h('button.btn', { title: '下一個關鍵影格', html: icon('stepFwd'), on: { click: () => jump(1) } });
  const bar = h('div.kf-bar', info, easeSel, prev, next);
  extra.push(() => {
    const tg = getTarget(), lt = targetTime(tg);
    const all = allKeyTimes(tg);
    const here = keysAt(tg, lt);
    info.textContent = here.length ? `◆ 此處 ${here.length} 個` : all.length ? `◇ 共 ${all.length} 個時間點` : '◇ 尚無關鍵影格';
    easeSel.disabled = !here.length;
    easeSel.style.visibility = here.length ? '' : 'hidden';
    if (here.length) easeSel.value = here[0].e || 'easeInOut';
    prev.disabled = !all.some((t) => t < lt - KEY_EPS);
    next.disabled = !all.some((t) => t > lt + KEY_EPS);
  });
  return bar;
}

// ---------- camera ----------
function buildCamera() {
  titleEl.textContent = '鏡頭';
  subEl.textContent = '影響所有「跟隨鏡頭」的軌道';
  const cam = () => store.project.camera;
  const io = (pd) => ({
    id: 'camera',
    value: () => P5M.cameraAt(store.project, store.time)[pd.key],
    set: (v, merge) => mutate(() => writeProp(cam(), pd.key, v, store.time), { merge, source: 'inspector' }),
    kf: {
      state: () => (keyAt(cam(), pd.key, store.time) ? 'on' : hasKeys(cam(), pd.key) ? 'has' : 'none'),
      toggle: () => mutate(() => toggleKey(cam(), pd.key, store.time, P5M.cameraAt(store.project, store.time)[pd.key]), { source: 'inspector' }),
    },
  });
  body.appendChild(kfBar(cam, (t) => t));
  body.appendChild(group('鏡頭位置', true, CAM_PROPS.map((pd) => addField(pd, io(pd)))));
  const W = () => store.project.settings.width;
  const presetBtn = (label, title, fn) => h('button.btn', { title, on: { click: fn } }, label);
  body.appendChild(group('一鍵運鏡（從播放頭開始 2 秒）', true, [
    h('div.btn-row',
      presetBtn('推近', '鏡頭慢慢放大 1.35 倍', () => camMove('zoom', (v) => v * 1.35)),
      presetBtn('拉遠', '鏡頭慢慢縮小', () => camMove('zoom', (v) => v / 1.35)),
      presetBtn('左移', '畫面往左平移', () => camMove('x', (v) => v - W() * 0.15)),
      presetBtn('右移', '畫面往右平移', () => camMove('x', (v) => v + W() * 0.15)),
      presetBtn('震動', '短暫的衝擊震動', camShake),
      presetBtn('重設', '清除所有鏡頭動畫，回到置中', camReset),
    ),
  ]));
  body.appendChild(h('div.tips', { html: '鏡頭關鍵影格用專案時間。軌道標頭的相機圖示可以讓某一軌固定在畫面上（例如字幕、浮水印）不受鏡頭影響。' }));
}

function setCamKeys(key, list, t0, t1) {
  const cam = store.project.camera;
  const keep = (cam.keys[key] || []).filter((k) => k.t < t0 - 1e-3 || k.t > t1 + 1e-3);
  cam.keys[key] = [...keep, ...list].sort((a, b) => a.t - b.t);
  const s = store.project.settings;
  if (t1 > s.duration) s.duration = Math.ceil(t1 * 10) / 10;
}

function camMove(key, fn, dur = 2) {
  const t0 = snapToFrame(store.time), t1 = t0 + dur;
  mutate((p) => {
    const from = P5M.cameraAt(p, t0)[key];
    setCamKeys(key, [{ t: roundT(t0), v: from, e: 'easeInOut' }, { t: roundT(t1), v: Math.round(fn(from) * 1000) / 1000, e: 'easeInOut' }], t0, t1);
  }, { source: 'inspector' });
  playRange(t0, t1 + 0.2);
}

function camShake() {
  const t0 = snapToFrame(store.time), t1 = t0 + 0.7;
  mutate(() => setCamKeys('shake', [
    { t: roundT(t0), v: 0, e: 'easeOut' }, { t: roundT(t0 + 0.08), v: 24, e: 'easeOut' }, { t: roundT(t1), v: 0, e: 'easeInOut' },
  ], t0, t1), { source: 'inspector' });
  playRange(t0, t1 + 0.2);
}

function camReset() {
  mutate((p) => {
    p.camera.props = { x: p.settings.width / 2, y: p.settings.height / 2, zoom: 1, rotation: 0, shake: 0 };
    p.camera.keys = {};
  }, { source: 'inspector' });
}

// ---------- clip ----------
function buildClip(id) {
  const cur = () => findClip(id).clip;
  const { clip, track } = findClip(id);
  const def = P5M.types[clip.type];
  titleEl.textContent = def ? def.label : clip.type;
  subEl.textContent = track.name;
  if (!def) {
    body.appendChild(h('div.ins-empty', '找不到圖層類型「' + clip.type + '」，這個片段無法編輯。'));
    return;
  }
  const hasAnim = !def.audio && def.category !== 'transition';
  if (!hasAnim) tab = 'props';

  const name = h('input.inp', { placeholder: def.label, spellcheck: 'false' });
  name.addEventListener('input', () => mutate(() => { cur().name = name.value; }, { merge: 'ins:name:' + id, source: 'inspector' }));
  extra.push(() => { if (document.activeElement !== name) name.value = cur().name || ''; });

  const bounded = clip.type === 'legacy' || clip.type === 'audiofile';
  const srcLen = () => { const a = store.project.assets[cur().props.asset]; return (bounded && a && a.duration) || Infinity; };
  const timing = (key, label, title) => {
    const f = field({ key, label, type: 'number', step: 0.01, min: 0, unit: '秒' }, {
      id, value: () => cur()[key],
      set: (v, merge) => mutate((p) => {
        const { track: tr, clip: c } = findClip(id);
        v = Math.max(0, snapToFrame(v));
        if (key === 'duration') v = Math.min(Math.max(0.1, v), srcLen() - (c.offset || 0));
        if (key === 'offset') v = Math.min(v, Math.max(0, srcLen() - c.duration));
        c[key] = v;
        A.resolveOverlap(p, tr, c);
        A.extendDuration(p);
      }, { merge, source: 'inspector' }),
    });
    f.el.title = title;
    extra.push(() => f.update(cur()));
    return f.el;
  };
  const head = [
    h('div.row', h('label', '名稱'), h('div.ctl', name), h('span')),
    timing('start', '開始', '片段在影片中出現的時間'),
    timing('duration', '長度', '片段持續多久'),
    timing('offset', '素材起點', '片段從素材的第幾秒開始播放（裁切左端會自動調整）'),
  ];
  if (!def.audio && !def.screen) {
    const f = field({ key: 'blend', label: '混合模式', type: 'select', options: BLENDS }, {
      id, value: () => cur().blend, set: (v) => mutate(() => { cur().blend = v; }, { source: 'inspector' }),
    });
    extra.push(() => f.update({ blend: cur().blend || 'source-over' }));
    head.push(f.el);
  }
  body.appendChild(h('div.grp-body', { style: { paddingTop: '12px' } }, head));

  if (hasAnim) {
    const tabBtn = (key, label) => h('button.ins-tab' + (tab === key ? '.on' : ''), { on: { click: () => { if (tab !== key) { tab = key; rebuild(); } } } }, label);
    body.appendChild(h('div.ins-tabs', tabBtn('props', '屬性'), tabBtn('anim', '動畫')));
  }
  if (tab === 'anim' && hasAnim) buildAnim(id);
  else buildProps(id, def);

  body.appendChild(h('div.btn-row', { style: { padding: '12px 14px' } },
    h('button.btn', { title: '在播放頭位置分割（S）', html: icon('scissors'), on: { click: () => A.splitAt(id) } }, '分割'),
    h('button.btn', { title: '建立副本（Ctrl+D）', html: icon('copy'), on: { click: () => A.duplicate(id) } }, '副本'),
    h('button.btn.danger', { title: '刪除（Delete）', html: icon('trash'), on: { click: () => A.deleteClip(id) } }, '刪除'),
  ));
}

function propIO(id, pd) {
  const cur = () => findClip(id).clip;
  const at = (c) => targetTime(c);
  return {
    id,
    value: () => { const c = cur(); return P5M.resolveProps(c, at(c), store.project.settings)[pd.key]; },
    set: (v, merge) => mutate(() => {
      const c = cur();
      writeProp(c, pd.key, v, at(c));
      // switching snow -> rain should also bring rain's colour / size / speed, except props the user animated
      const table = pd.key === 'preset' && (c.type === 'particles' ? P5M.particlePresets : c.type === 'gen' ? P5M.genPresets : null);
      const d = table && table[v] && table[v].d;
      if (d) for (const [k, val] of Object.entries(d)) if (!hasKeys(c, k)) c.props[k] = val;
    }, { merge, source: 'inspector' }),
    assets: () => store.project.assets,
    importAsset: (accept) => pickAsset(accept),
    kf: pd.anim ? {
      state: () => { const c = cur(); return keyAt(c, pd.key, at(c)) ? 'on' : hasKeys(c, pd.key) ? 'has' : 'none'; },
      toggle: () => mutate(() => {
        const c = cur(), lt = at(c);
        toggleKey(c, pd.key, lt, P5M.resolveProps(c, lt, store.project.settings)[pd.key]);
      }, { source: 'inspector' }),
    } : null,
  };
}

function buildProps(id, def) {
  const cur = () => findClip(id).clip;
  if (def.props.some((pd) => pd.anim)) {
    body.appendChild(kfBar(cur, (kt) => { const c = cur(); return c.start + kt - (c.offset || 0); }));
    const warn = h('div.tips', { style: { margin: '8px 14px 0' } }, '播放頭不在這個片段內，改數值會套用在片段最近的一端。');
    extra.push(() => { const c = cur(); warn.style.display = P5M.isActive(c, store.time) ? 'none' : ''; });
    body.appendChild(warn);
  }
  const groups = { transform: [], main: [], filter: [] };
  for (const pd of def.props) (groups[pd.group] || groups.main).push(addField(pd, propIO(id, pd)));
  if (groups.transform.length) body.appendChild(group(GROUP_TITLE.transform, true, groups.transform));
  if (groups.main.length) body.appendChild(group(def.label + '設定', true, groups.main));
  if (groups.filter.length) body.appendChild(group(GROUP_TITLE.filter, false, groups.filter));
}

// ---------- animation presets ----------
function buildAnim(id) {
  const cur = () => findClip(id).clip;
  const { IN, OUT, LOOP } = P5M.presets;
  const isText = cur().type === 'text';

  const section = (title, slot, lib) => {
    const a = (cur().anim || {})[slot] || {};
    const on = a.type && lib[a.type] ? a.type : 'none';
    const grid = h('div.anim-grid');
    for (const [name, pre] of Object.entries(lib)) {
      if (pre.text && !isText) continue;
      grid.appendChild(h('button.anim-btn' + (on === name ? '.on' : '') + (pre.text ? '.text-only' : ''), {
        title: pre.text ? pre.label + '（文字專用，逐字效果）' : pre.label,
        on: { click: () => pickAnim(id, slot, name, lib) },
      }, pre.label || '無'));
    }
    const kids = [grid];
    const slider = (key, label, min, max, dflt) => {
      const f = field({ key, label, type: 'range', min, max, step: 0.05, unit: key === 'dur' ? '秒' : '' }, {
        id,
        value: () => ((cur().anim || {})[slot] || {})[key] ?? dflt,
        set: (v, merge) => mutate(() => { const c = cur(); if (c.anim && c.anim[slot]) c.anim[slot][key] = v; }, { merge, source: 'inspector' }),
      });
      extra.push(() => f.update({ [key]: ((cur().anim || {})[slot] || {})[key] ?? dflt }));
      return f.el;
    };
    if (on !== 'none' && slot !== 'loop') kids.push(slider('dur', '長度', 0.1, Math.max(0.2, Math.min(5, cur().duration)), lib[on].dur ?? 0.6));
    if (on !== 'none' && slot === 'loop') kids.push(slider('speed', '速度', 0.1, 4, 1), slider('amount', '幅度', 0, 3, 1));
    return group(title, true, kids);
  };
  body.append(section('入場', 'in', IN), section('循環（整段持續）', 'loop', LOOP), section('出場', 'out', OUT));
  body.appendChild(h('div.tips', { html: '點選效果會自動預覽一次。標示「字」的是文字專用的逐字效果。入場與出場的淡色區塊會顯示在時間軸片段上。' }));
}

function pickAnim(id, slot, name, lib) {
  mutate(() => {
    const c = findClip(id).clip;
    c.anim = c.anim || {};
    const prev = c.anim[slot] || {};
    if (name === 'none') delete c.anim[slot];
    else if (slot === 'loop') c.anim.loop = { type: name, speed: prev.speed ?? 1, amount: prev.amount ?? 1 };
    else c.anim[slot] = { type: name, dur: lib[name].dur ?? 0.6 };
  }, { source: 'inspector' });
  rebuild();
  if (name === 'none') return;
  const c = findClip(id).clip, end = c.start + c.duration;
  const d = Math.min(c.duration, (c.anim[slot] && c.anim[slot].dur) || 0.6);
  if (slot === 'in') playRange(c.start, Math.min(end - 0.001, c.start + d + 0.4));
  else if (slot === 'out') playRange(Math.max(c.start, end - d - 0.4), end - 0.001);
  else {
    const from = Math.min(Math.max(store.time, c.start), Math.max(c.start, end - 0.1));
    playRange(from, Math.min(end - 0.001, from + 2.5));
  }
}
