// Play / pause / step controls. Playback follows the audio clock (P5M.audio session) so picture and sound stay in sync.
import { store, on, emit, setTime, frameDur, snapToFrame } from './state.js';
import { h } from './ui.js';
import { icon } from './icons.js';

const P5M = window.P5M;
let session = null;
let rafId = 0;
let range = null;          // silent range preview: { end, returnTo }
let playBtn, timeEl, token = 0;

export function initTransport() {
  const root = document.getElementById('transport');
  playBtn = h('button.tp-btn.tp-play', { title: '播放／暫停（空白鍵）', html: icon('play'), on: { click: toggle } });
  timeEl = h('div.tp-time');
  root.append(
    timeEl,
    h('button.tp-btn', { title: '回到開頭（Home）', html: icon('toStart'), on: { click: () => seek(0) } }),
    h('button.tp-btn', { title: '上一格（←）', html: icon('stepBack'), on: { click: () => step(-1) } }),
    playBtn,
    h('button.tp-btn', { title: '下一格（→）', html: icon('stepFwd'), on: { click: () => step(1) } }),
    h('button.tp-btn', { title: '到結尾（End）', html: icon('toEnd'), on: { click: () => seek(store.project.settings.duration) } }),
  );
  on((kind) => { if (kind === 'time' || kind === 'load' || kind === 'project') showTime(); });
}

function showTime() {
  const s = store.project.settings;
  timeEl.innerHTML = '';
  timeEl.append(h('b', P5M.fmtTime(store.time)), ' / ' + P5M.fmtTime(s.duration));
}

export function seek(t) {
  if (store.playing) stop();
  setTime(snapToFrame(Math.max(0, t)));
}
export function step(frames) { seek(store.time + frames * frameDur()); }
export const toggle = () => (store.playing ? stop() : play());

function setPlaying(v) {
  store.playing = v;
  playBtn.innerHTML = icon(v ? 'pause' : 'play');
  emit('playing');
}

export async function play() {
  if (store.playing) return;
  const end = store.project.settings.duration;
  if (store.time >= end - 0.01) setTime(0);
  const my = ++token;
  setPlaying(true);
  const fromT = store.time;
  let eng;
  try {
    eng = await P5M.audio.play(store.project, fromT);
  } catch (err) {
    console.error('音訊啟動失敗', err);
    eng = null;
  }
  if (my !== token) { if (eng && P5M.audio.session === eng) P5M.audio.stop(); return; }
  session = eng;
  const perf0 = performance.now();
  const now = () => (session ? session.now() : fromT + (performance.now() - perf0) / 1000);
  const tick = () => {
    if (my !== token) return;
    const t = now();
    const stopAt = range ? range.end : store.project.settings.duration;
    if (t >= stopAt) {
      const back = range ? range.returnTo : null;
      stop();
      setTime(back ?? stopAt);
      return;
    }
    setTime(t, 'play');
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

export function stop() {
  token++;
  cancelAnimationFrame(rafId);
  P5M.audio.stop();
  session = null;
  const r = range;
  range = null;
  if (store.playing) setPlaying(false);
  if (r) setTime(r.returnTo);
}

// Silent preview of [from, to) that returns the playhead where it was (animation preset preview)
export function playRange(from, to) {
  const returnTo = store.time;
  stop();
  const my = ++token;
  setTime(from);
  range = { end: to, returnTo };
  setPlaying(true);
  const perf0 = performance.now();
  const tick = () => {
    if (my !== token) return;
    const t = from + (performance.now() - perf0) / 1000;
    if (t >= to) { stop(); return; }
    setTime(t, 'play');
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}
