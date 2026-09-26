// Timeline: ruler, camera row, tracks with draggable / trimmable clips, snapping, zoom and context menus
import { store, on, mutate, select, setTime, findClip, findTrack, allKeyTimes, snapToFrame } from './state.js';
import { h, drag, contextMenu } from './ui.js';
import { icon } from './icons.js';
import * as A from './actions.js';
import { seek, stop } from './transport.js';

const P5M = window.P5M;
const HEAD_W = 168;
const SNAP_PX = 8;
const MIN_DUR = 0.1;
const ZOOM_MIN = 8, ZOOM_MAX = 480;
const CAT_ICON = { text: 'text', shape: 'shape', media: 'image', particles: 'sparkles', gen: 'palette', '3d': 'cube', effect: 'wand', transition: 'transition', audio: 'volume', music: 'music', code: 'code' };

let root, scroller, inner, playheadEl, snapEl, zoomInput, snapBtn;
let fileDrop = null;

const pps = () => store.pxPerSec;
const totalSec = () => Math.max(store.project.settings.duration, P5M.contentEnd(store.project)) + 10;
const xToTime = (clientX) => {
  const r = scroller.getBoundingClientRect();
  return Math.max(0, (clientX - r.left + scroller.scrollLeft - HEAD_W) / pps());
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const isBounded = (c) => c.type === 'legacy' || c.type === 'audiofile';
const sourceLen = (c) => { const a = store.project.assets[c.props.asset]; return a && a.duration ? a.duration : Infinity; };

export function catOf(c) {
  if (c.type === 'music') return 'music';
  const d = P5M.types[c.type];
  return d ? d.category : 'effect';
}

export function initTimeline({ onFilesDropped } = {}) {
  fileDrop = onFilesDropped;
  root = document.getElementById('timeline');
  snapBtn = tbBtn('magnet', '吸附：對齊播放頭與片段邊緣（拖曳時按住 Alt 暫停吸附）', () => {
    store.snap = !store.snap;
    snapBtn.classList.toggle('on', store.snap);
  });
  snapBtn.classList.toggle('on', store.snap);
  zoomInput = h('input', { type: 'range', min: 0, max: 1000, step: 1, title: '時間軸縮放（Ctrl+滾輪）', on: { input: () => setZoom(sliderToZoom(+zoomInput.value)) } });
  const bar = h('div.tl-toolbar',
    tbBtn('scissors', '在播放頭分割（S）', () => A.splitAt()),
    tbBtn('trash', '刪除片段（Delete）', () => A.deleteClip()),
    h('span.sep'),
    tbBtn('layers', '新增視覺軌', () => A.addTrack('visual')),
    tbBtn('audioTrack', '新增音訊軌', () => A.addTrack('audio')),
    h('span.sep'),
    snapBtn,
    h('span.grow'),
    tbBtn('minus', '縮小時間軸（-）', () => zoomBy(1 / 1.25)),
    zoomInput,
    tbBtn('plus', '放大時間軸（+）', () => zoomBy(1.25)),
  );
  scroller = h('div.tl-scroll');
  inner = h('div.tl-inner');
  scroller.appendChild(inner);
  root.append(bar, scroller);

  scroller.addEventListener('wheel', onWheel, { passive: false });
  bindLaneDrop();
  on((kind, source) => {
    if (kind === 'load') { fitZoom(); render(); }
    else if (kind === 'project' && source !== 'timeline-drag') render();
    else if (kind === 'select') render();
    else if (kind === 'time') { movePlayhead(); if (source === 'play') follow(); }
  });
}

const tbBtn = (ic, title, fn) => h('button.tb-icon', { title, html: icon(ic), on: { click: fn } });

// ---------- zoom ----------
const zoomToSlider = (z) => Math.round((Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 1000);
const sliderToZoom = (v) => ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, v / 1000);

export function setZoom(z, anchorClientX) {
  const r = scroller.getBoundingClientRect();
  const ax = anchorClientX === undefined ? r.width / 2 : anchorClientX - r.left;
  const tAnchor = (ax + scroller.scrollLeft - HEAD_W) / pps();
  store.pxPerSec = P5M.clamp(z, ZOOM_MIN, ZOOM_MAX);
  zoomInput.value = zoomToSlider(store.pxPerSec);
  render();
  scroller.scrollLeft = Math.max(0, tAnchor * pps() + HEAD_W - ax);
}
export const zoomBy = (f) => setZoom(pps() * f);

function fitZoom() {
  const w = Math.max(200, scroller.clientWidth - HEAD_W - 40);
  store.pxPerSec = P5M.clamp(w / Math.max(5, store.project.settings.duration), ZOOM_MIN, ZOOM_MAX);
  zoomInput.value = zoomToSlider(store.pxPerSec);
  scroller.scrollLeft = 0;
}

function onWheel(e) {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(pps() * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX);
}

// ---------- render ----------
function render() {
  if (!store.project) return;
  const W = totalSec() * pps();
  const kids = [rulerRow(W), cameraRow(W)];
  for (const tr of store.project.tracks) kids.push(trackRow(tr, W));
  const dur = store.project.settings.duration;
  kids.push(h('div.tl-end', { style: { left: HEAD_W + dur * pps() + 'px', width: Math.max(0, W - dur * pps()) + 'px' } }));
  if (!store.project.tracks.some((t) => t.clips.length)) kids.push(h('div.tl-empty-hint', '從左側素材庫點選或拖曳素材到軌道上'));
  playheadEl = h('div.tl-playhead');
  playheadEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); scrub(e); });
  snapEl = h('div.tl-snapline');
  kids.push(playheadEl, snapEl);
  inner.style.width = HEAD_W + W + 'px';
  inner.replaceChildren(...kids);
  movePlayhead();
}

function movePlayhead() {
  if (playheadEl) playheadEl.style.left = HEAD_W + store.time * pps() + 'px';
}

// Keep the playhead visible while playing
function follow() {
  const x = HEAD_W + store.time * pps();
  const left = scroller.scrollLeft + HEAD_W, right = scroller.scrollLeft + scroller.clientWidth - 30;
  if (x > right || x < left) scroller.scrollLeft = Math.max(0, x - HEAD_W - 40);
}

function niceStep() {
  for (const s of [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s * pps() >= 64) return s;
  return 600;
}
function tickLabel(t, step) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (step < 1 ? s.toFixed(1).padStart(4, '0') : String(Math.round(s)).padStart(2, '0'));
}

function rulerRow(W) {
  const step = niceStep();
  const ruler = h('div.tl-ruler', { style: { width: W + 'px' } });
  const minorPx = (step / 5) * pps();
  ruler.appendChild(h('div.minor', { style: { background: `repeating-linear-gradient(90deg, var(--line-2) 0 1px, transparent 1px ${minorPx}px)` } }));
  for (let t = 0; t <= totalSec(); t += step) ruler.appendChild(h('div.tick', { style: { left: t * pps() + 'px' } }, tickLabel(t, step)));
  ruler.addEventListener('pointerdown', scrub);
  return h('div.tl-ruler-row', h('div.tl-corner', P5M.fmtTime(store.project.settings.duration)), ruler);
}

function scrub(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  if (store.playing) stop();
  setTime(snapToFrame(xToTime(e.clientX)));
  drag(e, (dx, dy, ev) => setTime(snapToFrame(xToTime(ev.clientX))));
}

function cameraRow(W) {
  const cam = store.project.camera;
  const row = h('div.tl-row.camera' + (store.sel === 'camera' ? '.sel' : ''));
  const head = h('div.tl-head', { title: '鏡頭：推近、拉遠、平移、震動', on: { click: () => select('camera') } });
  head.innerHTML = icon('camera');
  head.appendChild(h('span.tname', '鏡頭'));
  const lane = h('div.tl-lane', { style: { width: W + 'px' } });
  for (const kt of allKeyTimes(cam)) {
    lane.appendChild(h('div.cam-key', {
      style: { left: kt * pps() + 'px' }, title: '鏡頭關鍵影格 ' + P5M.fmtTime(kt),
      on: { pointerdown: (e) => { e.stopPropagation(); select('camera'); seek(kt); } },
    }));
  }
  lane.addEventListener('pointerdown', (e) => { if (e.button === 0) { select('camera'); seek(xToTime(e.clientX)); } });
  row.append(head, lane);
  return row;
}

function trackRow(tr, W) {
  const row = h('div.tl-row.' + tr.kind + (tr.hidden ? '.hidden-track' : '') + (tr.locked ? '.locked' : ''), { dataset: { track: tr.id } });
  const name = h('span.tname', { title: '雙擊重新命名' }, tr.name);
  name.addEventListener('dblclick', () => renameInline(tr, name));
  const btn = (ic, title, cls, fn) => h('button.hb' + cls, { title, html: icon(ic), on: { click: (e) => { e.stopPropagation(); fn(); } } });
  const head = h('div.tl-head', name);
  if (tr.kind === 'visual') {
    head.append(
      btn('camera', tr.followCamera ? '跟隨鏡頭（點擊改為固定在畫面上）' : '固定在畫面上（點擊改為跟隨鏡頭）', tr.followCamera ? '.cam-on' : '', () => A.setTrackFlag(tr.id, 'followCamera', !tr.followCamera)),
      btn(tr.hidden ? 'eyeOff' : 'eye', tr.hidden ? '顯示軌道' : '隱藏軌道', tr.hidden ? '.on' : '', () => A.setTrackFlag(tr.id, 'hidden', !tr.hidden)),
    );
  } else {
    head.append(btn(tr.muted ? 'volumeX' : 'volume', tr.muted ? '取消靜音' : '靜音', tr.muted ? '.on' : '', () => A.setTrackFlag(tr.id, 'muted', !tr.muted)));
  }
  head.append(btn(tr.locked ? 'lock' : 'unlock', tr.locked ? '解除鎖定' : '鎖定軌道（避免誤動）', tr.locked ? '.on' : '', () => A.setTrackFlag(tr.id, 'locked', !tr.locked)));
  head.addEventListener('contextmenu', (e) => { e.preventDefault(); trackMenu(e, tr, name); });

  const lane = h('div.tl-lane', { style: { width: W + 'px' } });
  for (const c of tr.clips) lane.appendChild(clipEl(tr, c));
  lane.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target !== lane) return;
    select(null);
    seek(xToTime(e.clientX));
  });
  lane.addEventListener('contextmenu', (e) => {
    if (e.target !== lane) return;
    e.preventDefault();
    const t = snapToFrame(xToTime(e.clientX));
    contextMenu(e.clientX, e.clientY, [{ label: '貼上到這裡', kbd: 'Ctrl+V', disabled: !store.clipboard, onClick: () => { seek(t); A.paste(); } }]);
  });
  row.append(head, lane);
  return row;
}

function renameInline(tr, nameEl) {
  const input = h('input', { value: tr.name });
  nameEl.replaceChildren(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    if (ok && input.value.trim() && input.value.trim() !== tr.name) A.renameTrack(tr.id, input.value.trim());
    else nameEl.textContent = tr.name;
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function trackMenu(e, tr, nameEl) {
  const i = store.project.tracks.indexOf(tr);
  contextMenu(e.clientX, e.clientY, [
    { label: '上移', disabled: i === 0, onClick: () => A.moveTrack(tr.id, -1) },
    { label: '下移', disabled: i === store.project.tracks.length - 1, onClick: () => A.moveTrack(tr.id, 1) },
    { label: '重新命名', onClick: () => renameInline(tr, nameEl) },
    '-',
    { label: tr.clips.length ? `刪除軌道（含 ${tr.clips.length} 個片段）` : '刪除軌道', onClick: () => A.deleteTrack(tr.id) },
  ]);
}

// ---------- clips ----------
function isMissing(c) {
  const def = P5M.types[c.type];
  if (!def) return true;
  const assetProp = def.props.find((pd) => pd.type === 'asset' && pd.key === 'asset');
  return !!assetProp && !store.project.assets[c.props.asset];
}

function clipEl(tr, c) {
  const def = P5M.types[c.type];
  const cat = catOf(c);
  const el = h('div.clip.cat-' + cat + (store.sel === c.id ? '.sel' : '') + (isMissing(c) ? '.missing' : ''), {
    dataset: { clip: c.id },
    title: (c.name || (def && def.label) || c.type) + '\n' + P5M.fmtTime(c.start) + ' → ' + P5M.fmtTime(c.start + c.duration),
  });
  placeEl(el, c.start, c.duration);
  const a = c.anim || {};
  const animDur = (x, lib) => (x && x.type && x.type !== 'none' ? Math.min(c.duration, x.dur ?? (lib[x.type] && lib[x.type].dur) ?? 0.6) : 0);
  const din = animDur(a.in, P5M.presets.IN), dout = animDur(a.out, P5M.presets.OUT);
  if (din) el.appendChild(h('div.afill.in', { style: { width: din * pps() + 'px' } }));
  if (dout) el.appendChild(h('div.afill.out', { style: { width: dout * pps() + 'px' } }));
  if (a.loop && a.loop.type && a.loop.type !== 'none') el.appendChild(h('div.loopmark'));
  const label = h('div.clabel', { html: icon(CAT_ICON[cat] || 'shape') });
  label.append(c.name || (def && def.label) || c.type);
  el.appendChild(label);
  if (store.sel === c.id) {
    const off = c.offset || 0;
    for (const kt of allKeyTimes(c)) {
      const x = (kt - off) * pps();
      if (kt < off - 1e-6 || kt > off + c.duration + 1e-6) continue;
      el.appendChild(h('div.clip-key', {
        style: { left: x + 'px' }, title: '關鍵影格 ' + P5M.fmtTime(c.start + kt - off),
        on: { pointerdown: (e) => { e.stopPropagation(); seek(c.start + kt - off); } },
      }));
    }
  }
  const tl = h('div.trim.l', { title: '拖曳調整開頭' });
  const trr = h('div.trim.r', { title: '拖曳調整結尾' });
  el.append(tl, trr);
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (store.playing) stop();
    const side = e.target === tl ? 'l' : e.target === trr ? 'r' : null;
    select(c.id); // may re-render the timeline, so look the element up again
    if (tr.locked) return;
    const live = inner.querySelector(`.clip[data-clip="${c.id}"]`) || el;
    if (side) startTrim(e, c.id, side, live);
    else startMove(e, c.id, live);
  });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); select(c.id); clipMenu(e, c); });
  el.addEventListener('dblclick', () => document.dispatchEvent(new CustomEvent('p5m:focus-prop', { detail: { key: c.type === 'text' ? 'text' : null } })));
  return el;
}

function placeEl(el, start, dur) {
  el.style.left = start * pps() + 'px';
  el.style.width = Math.max(3, dur * pps()) + 'px';
}

function clipMenu(e, c) {
  const inside = store.time > c.start + 0.05 && store.time < c.start + c.duration - 0.05;
  contextMenu(e.clientX, e.clientY, [
    { label: '在播放頭分割', kbd: 'S', disabled: !inside, onClick: () => A.splitAt(c.id) },
    { label: '複製', kbd: 'Ctrl+C', onClick: () => A.copy(c.id) },
    { label: '貼上', kbd: 'Ctrl+V', disabled: !store.clipboard, onClick: () => A.paste() },
    { label: '建立副本', kbd: 'Ctrl+D', onClick: () => A.duplicate(c.id) },
    '-',
    { label: '刪除', kbd: 'Delete', onClick: () => A.deleteClip(c.id) },
  ]);
}

// Snap candidates in seconds: 0, playhead, project end and every other clip edge
function snapTargets(exceptId) {
  const pts = [0, store.time, store.project.settings.duration];
  for (const tr of store.project.tracks) for (const c of tr.clips) if (c.id !== exceptId) pts.push(c.start, c.start + c.duration);
  return pts;
}
// Returns the correction (seconds) that snaps the nearest of `edges` to a target, or 0
function snapDelta(edges, pts, ev) {
  snapEl.style.display = 'none';
  if (!store.snap || ev.altKey) return 0;
  let best = null;
  for (const e of edges) for (const p of pts) {
    const d = p - e;
    if (Math.abs(d) * pps() < SNAP_PX && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, p };
  }
  if (!best) return 0;
  snapEl.style.display = 'block';
  snapEl.style.left = HEAD_W + best.p * pps() + 'px';
  return best.d;
}

function trackUnder(ev, kind) {
  const hit = document.elementFromPoint(ev.clientX, ev.clientY);
  const row = hit && hit.closest && hit.closest('.tl-row[data-track]');
  const tr = row && findTrack(row.dataset.track);
  return tr && tr.kind === kind && !tr.locked ? { tr, row } : null;
}

function startMove(e, id, el) {
  const f = findClip(id);
  const orig = { start: f.clip.start, track: f.track };
  const pts = snapTargets(id);
  const key = 'g:tl:' + id + ':' + performance.now();
  let moved = false, target = f.track, lastRow = null;
  drag(e, (dx, dy, ev) => {
    if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    moved = true;
    el.classList.add('dragging');
    const dur = f.clip.duration;
    let ns = Math.max(0, orig.start + dx / pps());
    ns += snapDelta([ns, ns + dur], pts, ev);
    ns = Math.max(0, snapToFrame(ns));
    const under = trackUnder(ev, orig.track.kind);
    if (lastRow) lastRow.classList.remove('drop-target');
    if (under) {
      target = under.tr;
      lastRow = under.row;
      if (target !== orig.track) lastRow.classList.add('drop-target');
      const lane = under.row.querySelector('.tl-lane');
      if (el.parentNode !== lane) lane.appendChild(el);
    }
    placeEl(el, ns, dur);
    mutate(() => {
      const cur = findClip(id);
      cur.clip.start = ns;
      if (cur.track !== target) {
        cur.track.clips.splice(cur.index, 1);
        target.clips.push(cur.clip);
      }
    }, { merge: key, source: 'timeline-drag' });
  }, () => {
    snapEl.style.display = 'none';
    if (lastRow) lastRow.classList.remove('drop-target');
    if (!moved) return;
    mutate((project) => {
      const cur = findClip(id);
      A.resolveOverlap(project, cur.track, cur.clip);
      A.extendDuration(project);
    }, { merge: key, source: 'timeline' });
  });
}

function startTrim(e, id, side, el) {
  const { clip } = findClip(id);
  const o = clone(clip);
  const pts = snapTargets(id);
  const key = 'g:trim:' + id + ':' + performance.now();
  const bounded = isBounded(clip);
  const srcLen = bounded ? sourceLen(clip) : Infinity;
  let moved = false;
  drag(e, (dx, dy, ev) => {
    moved = true;
    let d = dx / pps();
    if (side === 'l') {
      d += snapDelta([o.start + d], pts, ev);
      d = snapToFrame(o.start + d) - o.start;
      d = Math.max(d, -o.start);
      d = Math.min(d, o.duration - MIN_DUR);
      if (bounded) d = Math.max(d, -(o.offset || 0));
      const off = (o.offset || 0) + d;
      const shift = off < 0 ? -off : 0;
      placeEl(el, o.start + d, o.duration - d);
      mutate(() => {
        const c = findClip(id).clip;
        c.start = o.start + d;
        c.duration = o.duration - d;
        c.offset = off + shift;
        c.keys = clone(o.keys || {});
        if (shift) for (const k in c.keys) for (const kf of c.keys[k]) kf.t = Math.round((kf.t + shift) * 1000) / 1000;
      }, { merge: key, source: 'timeline-drag' });
    } else {
      let nd = o.duration + d;
      nd += snapDelta([o.start + nd], pts, ev);
      nd = snapToFrame(o.start + nd) - o.start;
      nd = Math.max(MIN_DUR, nd);
      if (bounded) nd = Math.min(nd, srcLen - (o.offset || 0));
      placeEl(el, o.start, nd);
      mutate(() => { findClip(id).clip.duration = nd; }, { merge: key, source: 'timeline-drag' });
    }
  }, () => {
    snapEl.style.display = 'none';
    if (!moved) return;
    mutate((project) => {
      const cur = findClip(id);
      A.resolveOverlap(project, cur.track, cur.clip);
      A.extendDuration(project);
    }, { merge: key, source: 'timeline' });
  });
}

// ---------- drop from the library ----------
function bindLaneDrop() {
  let lastRow = null;
  const clear = () => { if (lastRow) lastRow.classList.remove('drop-target'); lastRow = null; };
  scroller.addEventListener('dragover', (e) => {
    const types = [...e.dataTransfer.types];
    if (!types.includes('application/x-p5m-item') && !types.includes('Files')) return;
    e.preventDefault();
    const row = e.target.closest && e.target.closest('.tl-row[data-track]');
    if (row !== lastRow) { clear(); lastRow = row; if (row) row.classList.add('drop-target'); }
  });
  scroller.addEventListener('dragleave', (e) => { if (!scroller.contains(e.relatedTarget)) clear(); });
  scroller.addEventListener('drop', (e) => {
    const row = e.target.closest && e.target.closest('.tl-row[data-track]');
    clear();
    const raw = e.dataTransfer.getData('application/x-p5m-item');
    if (!raw && !e.dataTransfer.files.length) return;
    e.preventDefault();
    const opts = { time: snapToFrame(xToTime(e.clientX)), trackId: row ? row.dataset.track : null };
    if (raw) A.addItem(JSON.parse(raw), opts);
    else if (fileDrop) fileDrop([...e.dataTransfer.files], opts);
  });
}
