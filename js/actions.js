// Project edit operations shared by library, stage, timeline, inspector and shortcuts
import { store, mutate, emit, select, setTime, findClip, findTrack, snapToFrame } from './state.js';
import { toast } from './ui.js';

const P5M = window.P5M;
const { types, defaultProps, uid } = P5M;

const EPS = 1e-4;
const clone = (o) => JSON.parse(JSON.stringify(o));
export const isAudioType = (type) => !!(types[type] && types[type].audio);
export const kindOf = (type) => (isAudioType(type) ? 'audio' : 'visual');
export const categoryOf = (type) => (types[type] ? types[type].category : 'code');

// No clip on track overlaps [start, start + dur)
export function fits(track, start, dur, ignoreId) {
  return track.clips.every((c) => c.id === ignoreId || c.start + c.duration <= start + EPS || c.start >= start + dur - EPS);
}

export function newTrack(project, kind, index) {
  const n = project.tracks.filter((t) => t.kind === kind).length + 1;
  const tr = { id: uid('tr'), name: (kind === 'audio' ? '音訊 ' : '軌道 ') + n, kind, hidden: false, muted: false, locked: false, followCamera: true, clips: [] };
  project.tracks.splice(index ?? (kind === 'audio' ? project.tracks.length : 0), 0, tr);
  return tr;
}

export function extendDuration(project) {
  const end = P5M.contentEnd(project);
  if (end > project.settings.duration) project.settings.duration = Math.ceil(end * 10) / 10;
}

export function defaultDuration(item, project, start) {
  if (item.duration) return item.duration;
  if (item.fill) return Math.max(4, project.settings.duration - start); // whole-video layers (backgrounds, vignette)
  const def = types[item.type];
  const pr = item.props || {};
  if (item.type === 'sfx') return (P5M.sfxCatalog[pr.voice || 'pop'] || {}).dur || 1;
  if (item.type === 'music') return Math.max(8, project.settings.duration - start);
  if (item.type === 'legacy' || item.type === 'audiofile') {
    const a = project.assets[pr.asset];
    return (a && a.duration) || 4;
  }
  if (def.category === 'transition') return 1;
  return 4;
}

// Where a new clip of this kind lands: requested track, else first free track (background items go low)
function pickTrack(project, kind, start, dur, { trackId, background }) {
  const want = trackId && findTrack(trackId);
  if (want && want.kind === kind && !want.locked && fits(want, start, dur)) return want;
  const list = project.tracks.filter((t) => t.kind === kind && !t.locked);
  if (background) list.reverse();
  const hit = list.find((t) => fits(t, start, dur));
  if (hit) return hit;
  if (kind === 'audio') return newTrack(project, 'audio');
  if (background) {
    const lastVisual = project.tracks.map((t) => t.kind).lastIndexOf('visual');
    return newTrack(project, 'visual', lastVisual + 1);
  }
  return newTrack(project, 'visual', 0);
}

export function makeClip(item, project, start) {
  const def = types[item.type];
  return {
    id: uid('c'), type: item.type, name: item.name || def.label, start, duration: defaultDuration(item, project, start), offset: 0,
    props: { ...defaultProps(item.type, project.settings), ...clone(item.props || {}) },
    keys: {}, anim: item.anim ? clone(item.anim) : {}, blend: 'source-over',
  };
}

// addItem may move the playhead past an intro; until the user moves it, later adds still start where the first one did
let introSeek = null; // { from, to }
const insertTime = () => (introSeek && Math.abs(store.time - introSeek.to) < EPS ? introSeek.from : store.time);

// item = { type, name, props, anim?, duration?, background? } from the library
export function addItem(item, { time = insertTime(), trackId = null, x, y } = {}) {
  const def = types[item.type];
  if (!def) { toast('找不到圖層類型：' + item.type, 'error'); return null; }
  let clip = null;
  mutate((project) => {
    clip = makeClip(item, project, snapToFrame(Math.max(0, time)));
    if (x !== undefined && !def.screen && !def.audio) { clip.props.x = Math.round(x); clip.props.y = Math.round(y); }
    const tr = pickTrack(project, kindOf(item.type), clip.start, clip.duration, { trackId, background: item.background });
    tr.clips.push(clip);
    tr.clips.sort((a, b) => a.start - b.start);
    if (item.type === 'legacy') addLegacyScore(project, clip);
    extendDuration(project);
  });
  select(clip.id);
  // With an intro animation the first frame is empty; show the finished look instead of a blank selection box
  const intro = clip.anim.in && P5M.presets.IN[clip.anim.in.type];
  if (intro && !store.playing && store.time < clip.start + 0.01) {
    setTime(snapToFrame(clip.start + Math.min(clip.duration / 2, clip.anim.in.dur ?? intro.dur)));
    introSeek = { from: clip.start, to: store.time };
  }
  return clip;
}

// A legacy project's SCORE (the music its sound.js played) comes along as a music clip starting with it.
// Its own SCORE.fadeOut is applied by the audio engine, so the clip fades stay at 0.
function addLegacyScore(project, clip) {
  const a = project.assets[clip.props.asset];
  if (!a || !a.score) return;
  const m = makeClip({
    type: 'music', name: a.name + '・配樂', duration: clip.duration,
    props: { preset: 'score', score: a.score, volume: 1, fadeIn: 0, fadeOut: 0 },
  }, project, clip.start);
  const tr = pickTrack(project, 'audio', m.start, m.duration, {});
  tr.clips.push(m);
  tr.clips.sort((x, y) => x.start - y.start);
}

// Assets are not part of undo history (undo snapshots skip them), so they are edited directly
export function editAssets(fn) {
  fn(store.project.assets);
  store.dirty = true;
  emit('project', 'assets');
}

// A clip dropped on top of another one moves to a new track right above
export function resolveOverlap(project, track, clip) {
  if (fits(track, clip.start, clip.duration, clip.id)) { track.clips.sort((a, b) => a.start - b.start); return track; }
  track.clips.splice(track.clips.indexOf(clip), 1);
  const idx = project.tracks.indexOf(track);
  const tr = newTrack(project, track.kind, track.kind === 'audio' ? idx + 1 : idx);
  tr.followCamera = track.followCamera;
  tr.clips.push(clip);
  return tr;
}

export function splitAt(id = store.sel, t = store.time) {
  const f = id && findClip(id);
  if (!f) { toast('先選取要分割的片段'); return false; }
  const { clip } = f;
  if (t <= clip.start + 0.05 || t >= clip.start + clip.duration - 0.05) { toast('播放頭要在片段範圍內才能分割'); return false; }
  let bId = null;
  mutate(() => {
    const { track } = findClip(id);
    const cut = t - clip.start;
    const b = clone(clip);
    b.id = uid('c');
    b.start = t;
    b.offset = (clip.offset || 0) + cut;
    b.duration = clip.duration - cut;
    if (b.anim) delete b.anim.in;
    clip.duration = cut;
    if (clip.anim) delete clip.anim.out;
    track.clips.splice(track.clips.indexOf(clip) + 1, 0, b);
    bId = b.id;
  });
  select(bId);
  return true;
}

export function deleteClip(id = store.sel) {
  if (id === 'camera' || !id || !findClip(id)) return false;
  if (findClip(id).track.locked) { toast('軌道已鎖定'); return false; }
  mutate(() => {
    const { track, index } = findClip(id);
    track.clips.splice(index, 1);
  });
  select(null);
  return true;
}

function placeCopy(src, start, preferTrack) {
  let id = null;
  mutate((project) => {
    const c = clone(src);
    c.id = uid('c');
    c.start = Math.max(0, start);
    const tr = pickTrack(project, kindOf(c.type), c.start, c.duration, { trackId: preferTrack && preferTrack.id });
    tr.clips.push(c);
    tr.clips.sort((a, b) => a.start - b.start);
    extendDuration(project);
    id = c.id;
  });
  select(id);
}

export function duplicate(id = store.sel) {
  const f = id && findClip(id);
  if (!f) return false;
  placeCopy(f.clip, f.clip.start + f.clip.duration, f.track);
  return true;
}

export function copy(id = store.sel) {
  const f = id && findClip(id);
  if (!f) return false;
  store.clipboard = clone(f.clip);
  toast('已複製「' + (f.clip.name || types[f.clip.type].label) + '」');
  return true;
}

export function paste() {
  if (!store.clipboard) { toast('剪貼簿是空的'); return false; }
  const cur = store.sel && findClip(store.sel);
  placeCopy(store.clipboard, snapToFrame(store.time), cur && cur.track);
  return true;
}

// ---------- tracks ----------
export function addTrack(kind) {
  mutate((project) => {
    if (kind === 'audio') newTrack(project, 'audio');
    else newTrack(project, 'visual', 0);
  });
}

export function deleteTrack(id) {
  mutate((project) => {
    const i = project.tracks.findIndex((t) => t.id === id);
    if (i >= 0) project.tracks.splice(i, 1);
  });
  if (store.sel && store.sel !== 'camera' && !findClip(store.sel)) select(null);
}

export function moveTrack(id, dir) {
  mutate((project) => {
    const i = project.tracks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= project.tracks.length) return;
    [project.tracks[i], project.tracks[j]] = [project.tracks[j], project.tracks[i]];
  });
}

export function setTrackFlag(id, flag, value) {
  mutate(() => { findTrack(id)[flag] = value; }, { source: 'track' });
}

export function renameTrack(id, name) {
  mutate(() => { findTrack(id).name = name || findTrack(id).name; });
}
