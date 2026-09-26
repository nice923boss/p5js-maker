// Preview stage: p5 canvas scaled to fit, plus an SVG overlay for picking, moving, scaling and rotating clips
import { store, on, mutate, select, findClip, writeProp, targetTime } from './state.js';
import { addItem } from './actions.js';
import { drag } from './ui.js';

const P5M = window.P5M;
const SVG = 'http://www.w3.org/2000/svg';
const SNAP_PX = 8;

let p5i = null;
let wrap, frame, svg, hint;
let hits = [];
let viewScale = 1;          // screen px per project px
let rafId = 0;
let hoverId = null;
let guides = [];
let dropHandler = null;

export const getP5 = () => p5i;
export const stageCanvas = () => p5i && p5i.canvas;

// Resolves once the p5 instance exists
export function initStage({ onFilesDropped } = {}) {
  dropHandler = onFilesDropped;
  wrap = document.getElementById('stage-wrap');
  frame = document.getElementById('stage-frame');
  svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'stage-overlay');
  svg.setAttribute('preserveAspectRatio', 'none');
  hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '從左側素材庫點選或拖曳素材到畫面';

  new ResizeObserver(fit).observe(wrap);
  bindPointer();
  bindDrop();
  on((kind) => {
    if (kind === 'load') { resizeCanvas(); fit(); }
    if (kind === 'select') drawOverlay();
    if (kind === 'load' || kind === 'project' || kind === 'time') requestRender();
  });

  return new Promise((resolve) => {
    new p5((p) => {
      p.setup = () => {
        const s = store.project ? store.project.settings : { width: 1280, height: 720 };
        p.pixelDensity(1);
        p.createCanvas(s.width, s.height).parent(frame);
        p.noLoop();
        p5i = p;
        frame.appendChild(svg);
        frame.appendChild(hint);
        fit();
        requestRender();
        resolve(p);
      };
      p.draw = () => {};
    });
  });
}

function resizeCanvas() {
  if (!p5i || !store.project) return;
  const { width: W, height: H } = store.project.settings;
  if (p5i.width !== W || p5i.height !== H) p5i.resizeCanvas(W, H, true);
}

function fit() {
  if (!store.project) return;
  const { width: W, height: H } = store.project.settings;
  const aw = Math.max(40, wrap.clientWidth - 28), ah = Math.max(40, wrap.clientHeight - 28);
  viewScale = Math.min(aw / W, ah / H);
  frame.style.width = Math.round(W * viewScale) + 'px';
  frame.style.height = Math.round(H * viewScale) + 'px';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  drawOverlay();
}

export function requestRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => { rafId = 0; renderNow(); });
}

function renderNow() {
  if (!p5i || !store.project || store.exporting) return;
  resizeCanvas();
  if (svg.getAttribute('viewBox') !== `0 0 ${store.project.settings.width} ${store.project.settings.height}`) fit();
  hits = P5M.renderFrame(p5i, store.project, store.time);
  hint.style.display = store.project.tracks.some((t) => t.clips.length) ? 'none' : '';
  drawOverlay();
}

// ---------- overlay ----------
function el(tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
const corners = (hit) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => hit.m.transformPoint(new DOMPoint((sx * hit.w) / 2, (sy * hit.h) / 2)));
const polyPts = (pts) => pts.map((q) => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');

function drawOverlay() {
  if (!svg) return;
  svg.replaceChildren();
  const px = 1 / viewScale;
  const line = { 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1.5 };
  const hov = hoverId && hoverId !== store.sel && hits.find((x) => x.clipId === hoverId);
  if (hov) svg.appendChild(el('polygon', { class: 'hover-box', points: polyPts(corners(hov)), ...line }));
  for (const g of guides) {
    svg.appendChild(g.axis === 'x'
      ? el('line', { class: 'guide', x1: g.v, y1: 0, x2: g.v, y2: store.project.settings.height, ...line })
      : el('line', { class: 'guide', x1: 0, y1: g.v, x2: store.project.settings.width, y2: g.v, ...line }));
  }
  const hit = store.sel && hits.find((x) => x.clipId === store.sel);
  if (!hit) return;
  const c = corners(hit);
  svg.appendChild(el('polygon', { class: 'sel-box', points: polyPts(c), ...line }));
  const center = hit.m.transformPoint(new DOMPoint(0, 0));
  const top = new DOMPoint((c[0].x + c[1].x) / 2, (c[0].y + c[1].y) / 2);
  let ux = top.x - center.x, uy = top.y - center.y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len; uy /= len;
  const rot = { x: top.x + ux * 28 * px, y: top.y + uy * 28 * px };
  svg.appendChild(el('line', { class: 'rot-line', x1: top.x, y1: top.y, x2: rot.x, y2: rot.y, ...line }));
  svg.appendChild(el('circle', { class: 'rot-handle', 'data-h': 'rot', cx: rot.x, cy: rot.y, r: 6 * px, ...line, style: 'cursor:grab' }));
  const s = 9 * px;
  for (const q of c) svg.appendChild(el('rect', { class: 'handle', 'data-h': 'scale', x: q.x - s / 2, y: q.y - s / 2, width: s, height: s, ...line, style: 'cursor:nwse-resize' }));
}

// ---------- picking and gestures ----------
function toStage(e) {
  const r = svg.getBoundingClientRect();
  const { width: W, height: H } = store.project.settings;
  return new DOMPoint(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
}

function pick(pt) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    const tr = store.project.tracks.find((t) => t.id === hit.trackId);
    if (!tr || tr.locked) continue;
    const q = hit.m.inverse().transformPoint(pt);
    if (Math.abs(q.x) <= hit.w / 2 && Math.abs(q.y) <= hit.h / 2) return hit;
  }
  return null;
}

function bindPointer() {
  svg.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    const hit = pick(toStage(e));
    const id = hit ? hit.clipId : null;
    svg.style.cursor = hit ? 'move' : '';
    if (id !== hoverId) { hoverId = id; drawOverlay(); }
  });
  svg.addEventListener('pointerleave', () => { if (hoverId) { hoverId = null; drawOverlay(); } });
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || store.playing) return;
    e.preventDefault();
    const pt = toStage(e);
    const mode = e.target.getAttribute && e.target.getAttribute('data-h');
    if (mode) return startTransform(e, mode, pt);
    const hit = pick(pt);
    if (!hit) { select(null); return; }
    select(hit.clipId);
    startMove(e, hit, pt);
  });
  svg.addEventListener('dblclick', (e) => {
    const f = store.sel && findClip(store.sel);
    if (f && f.clip.type === 'text') document.dispatchEvent(new CustomEvent('p5m:focus-prop', { detail: { key: 'text' } }));
    else if (f && f.clip.type === 'code') document.dispatchEvent(new CustomEvent('p5m:focus-prop', { detail: { key: 'code' } }));
    e.preventDefault();
  });
}

function gestureContext(clipId) {
  const f = findClip(clipId);
  const lt = targetTime(f.clip);
  const pr = P5M.resolveProps(f.clip, lt, store.project.settings);
  const base = f.track.followCamera === false ? new DOMMatrix() : P5M.cameraMatrix(store.project, store.time);
  return { ...f, lt, pr, base, inv: base.inverse(), key: 'g:' + clipId + ':' + performance.now() };
}

function startMove(e, hit, p0) {
  const g = gestureContext(hit.clipId);
  const q0 = g.inv.transformPoint(p0);
  const { width: W, height: H } = store.project.settings;
  drag(e, (dx, dy, ev) => {
    const q = g.inv.transformPoint(toStage(ev));
    let nx = g.pr.x + (q.x - q0.x), ny = g.pr.y + (q.y - q0.y);
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ny = g.pr.y; else nx = g.pr.x; }
    const c = g.base.transformPoint(new DOMPoint(nx, ny));
    const th = SNAP_PX / viewScale;
    guides = [];
    if (Math.abs(c.x - W / 2) < th) { c.x = W / 2; guides.push({ axis: 'x', v: W / 2 }); }
    if (Math.abs(c.y - H / 2) < th) { c.y = H / 2; guides.push({ axis: 'y', v: H / 2 }); }
    if (guides.length) { const b = g.inv.transformPoint(c); nx = b.x; ny = b.y; }
    nx = Math.round(nx); ny = Math.round(ny);
    mutate(() => { writeProp(g.clip, 'x', nx, g.lt); writeProp(g.clip, 'y', ny, g.lt); }, { merge: g.key, source: 'stage' });
  }, () => { guides = []; drawOverlay(); });
}

function startTransform(e, mode, p0) {
  const hit = hits.find((x) => x.clipId === store.sel);
  if (!hit) return;
  const g = gestureContext(hit.clipId);
  const center = hit.m.transformPoint(new DOMPoint(0, 0));
  const d0 = Math.max(1, Math.hypot(p0.x - center.x, p0.y - center.y));
  const a0 = Math.atan2(p0.y - center.y, p0.x - center.x);
  drag(e, (dx, dy, ev) => {
    const p = toStage(ev);
    if (mode === 'scale') {
      const s = Math.max(0.01, (g.pr.scale ?? 1) * (Math.hypot(p.x - center.x, p.y - center.y) / d0));
      mutate(() => writeProp(g.clip, 'scale', Math.round(s * 1000) / 1000, g.lt), { merge: g.key, source: 'stage' });
    } else {
      let r = (g.pr.rotation || 0) + ((Math.atan2(p.y - center.y, p.x - center.x) - a0) * 180) / Math.PI;
      r = ev.shiftKey ? Math.round(r / 15) * 15 : Math.round(r * 10) / 10;
      mutate(() => writeProp(g.clip, 'rotation', r, g.lt), { merge: g.key, source: 'stage' });
    }
  });
}

// ---------- drag and drop from the library or the file system ----------
function bindDrop() {
  const accepts = (e) => e.dataTransfer && [...e.dataTransfer.types].some((t) => t === 'application/x-p5m-item' || t === 'Files');
  wrap.addEventListener('dragover', (e) => {
    if (!accepts(e)) return;
    e.preventDefault();
    frame.classList.add('stage-drop');
  });
  wrap.addEventListener('dragleave', (e) => { if (!wrap.contains(e.relatedTarget)) frame.classList.remove('stage-drop'); });
  wrap.addEventListener('drop', (e) => {
    frame.classList.remove('stage-drop');
    if (!accepts(e)) return;
    e.preventDefault();
    const pt = toStage(e);
    const { width: W, height: H } = store.project.settings;
    const inside = pt.x >= 0 && pt.y >= 0 && pt.x <= W && pt.y <= H;
    const cam = P5M.cameraMatrix(store.project, store.time).inverse().transformPoint(pt);
    const pos = inside ? { x: cam.x, y: cam.y } : {};
    const raw = e.dataTransfer.getData('application/x-p5m-item');
    if (raw) addItem(JSON.parse(raw), pos);
    else if (e.dataTransfer.files.length && dropHandler) dropHandler([...e.dataTransfer.files], pos);
  });
}
