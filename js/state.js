// Editor store: current project, selection, playhead, undo history and keyframe write helpers.
// Events: 'load' (new project), 'project' (data changed), 'time' (playhead), 'select', 'saved'
const { clamp, localTime } = window.P5M;

export const store = {
  project: null,
  sel: null,          // clip id | 'camera' | null
  time: 0,
  playing: false,
  pxPerSec: 60,
  snap: true,
  dirty: false,
  fileHandle: null,
  fileName: '',
  clipboard: null,
};

const listeners = new Set();
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(kind, source) {
  for (const fn of listeners) {
    try { fn(kind, source); } catch (err) { console.error('事件處理失敗', kind, err); }
  }
}

// ---------- undo ----------
const UNDO_MAX = 200;
let undoStack = [];
let redoStack = [];
let lastMerge = null;
let lastMergeAt = 0;

const snapshot = () => {
  const { title, settings, camera, tracks } = store.project;
  return JSON.stringify({ title, settings, camera, tracks });
};

// Apply fn(project) as one undo step. Same `merge` key within 1 s joins the previous step (typing, sliders);
// keys starting with 'g:' are per-gesture (one drag) and always join while the key stays the same.
export function mutate(fn, { merge = null, source = null } = {}) {
  const now = performance.now();
  const joins = merge && merge === lastMerge && (merge.startsWith('g:') || now - lastMergeAt < 1000);
  if (!joins) {
    undoStack.push(snapshot());
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
  }
  lastMerge = merge;
  lastMergeAt = now;
  fn(store.project);
  store.dirty = true;
  emit('project', source);
}

function restore(json) {
  Object.assign(store.project, JSON.parse(json));
  lastMerge = null;
  store.dirty = true;
  if (store.sel && store.sel !== 'camera' && !findClip(store.sel)) { store.sel = null; emit('select'); }
  emit('project', 'history');
}
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  return true;
}
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  return true;
}

export function loadProject(project, { fileHandle = null, fileName = '' } = {}) {
  store.project = project;
  store.sel = null;
  store.time = 0;
  store.dirty = false;
  store.fileHandle = fileHandle;
  store.fileName = fileName;
  undoStack = [];
  redoStack = [];
  lastMerge = null;
  window.P5M.assets.release(new Set(Object.keys(project.assets)));
  emit('load');
}

export function markSaved() { store.dirty = false; emit('saved'); }

// ---------- selection and time ----------
export function select(id) {
  if (store.sel === id) return;
  store.sel = id;
  emit('select');
}
export function setTime(t, source) {
  store.time = Math.max(0, t);
  emit('time', source);
}
export const frameDur = () => 1 / (store.project.settings.fps || 30);
export const snapToFrame = (t) => Math.round(t / frameDur()) * frameDur();

export function findClip(id) {
  for (const track of store.project.tracks) {
    const index = track.clips.findIndex((c) => c.id === id);
    if (index >= 0) return { track, clip: track.clips[index], index };
  }
  return null;
}
export const findTrack = (id) => store.project.tracks.find((t) => t.id === id);
export function selectedClip() {
  return store.sel && store.sel !== 'camera' ? findClip(store.sel) : null;
}

// ---------- keyframes ----------
// target = clip (keys in clip-local seconds) or project.camera (keys in project seconds)
const KEY_EPS = 1 / 240;
const roundT = (t) => Math.round(t * 1000) / 1000;

export const hasKeys = (target, key) => !!(target.keys && target.keys[key] && target.keys[key].length);
export const keyAt = (target, key, lt) => (hasKeys(target, key) ? target.keys[key].find((k) => Math.abs(k.t - lt) < KEY_EPS) : null);

// Time used for keyframes on target at the current playhead
export function targetTime(target) {
  if (target === store.project.camera) return store.time;
  const off = target.offset || 0;
  return clamp(localTime(target, store.time), off, off + target.duration);
}

// Animated prop -> add or update the key at lt; otherwise set the static value
export function writeProp(target, key, val, lt) {
  if (!hasKeys(target, key)) { target.props[key] = val; return; }
  const arr = target.keys[key];
  const k = arr.find((x) => Math.abs(x.t - lt) < KEY_EPS);
  if (k) k.v = val;
  else { arr.push({ t: roundT(lt), v: val, e: 'easeInOut' }); arr.sort((a, b) => a.t - b.t); }
}

// Add a key with the current value, or remove the key at lt (removing the last key bakes the value into props)
export function toggleKey(target, key, lt, cur) {
  target.keys = target.keys || {};
  const arr = target.keys[key] || (target.keys[key] = []);
  const i = arr.findIndex((x) => Math.abs(x.t - lt) < KEY_EPS);
  if (i < 0) { arr.push({ t: roundT(lt), v: cur, e: 'easeInOut' }); arr.sort((a, b) => a.t - b.t); return; }
  arr.splice(i, 1);
  if (!arr.length) { delete target.keys[key]; target.props[key] = cur; }
}

// All key times of a target (sorted, unique)
export function allKeyTimes(target) {
  const ts = [];
  for (const k in target.keys || {}) for (const x of target.keys[k]) if (!ts.some((t) => Math.abs(t - x.t) < KEY_EPS)) ts.push(x.t);
  return ts.sort((a, b) => a - b);
}
