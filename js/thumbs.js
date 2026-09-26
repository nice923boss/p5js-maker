// Library thumbnails: render one library item with the real runtime on a hidden p5 canvas, cache as a small JPEG.
// Effects and transitions are drawn over a sample scene so their result is visible.
const P5M = window.P5M;
const W = 1280, H = 720, TW = 192, TH = 108;

let pInst = null;
let ready = null;
const cache = new Map();
const queue = [];
let busy = false;

function boot() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    new p5((p) => {
      p.setup = () => {
        p.pixelDensity(1);
        p.createCanvas(W, H);
        p.noLoop();
        pInst = p;
        resolve(p);
      };
    }, host);
  });
  return ready;
}

const clipOf = (item, settings, i) => ({
  id: 'th' + i, type: item.type, name: '', start: 0, duration: 10, offset: 0,
  props: { ...P5M.defaultProps(item.type, settings), ...(item.props || {}) }, keys: {}, anim: {}, blend: 'source-over',
});

// Sample scene for effects / transitions
const BACKDROP = [
  { type: 'gen', props: { preset: 'mountains' } },
  { type: 'shape', props: { kind: 'star', w: 220, h: 220, fill: '#ffd166', y: 250 } },
];

function sceneFor(item) {
  const settings = { width: W, height: H, fps: 30, duration: 10, background: '#141821', volume: 1 };
  const def = P5M.types[item.type];
  const cat = def && def.category;
  const withBack = cat === 'effect' || cat === 'transition';
  const clips = [item, ...(withBack ? BACKDROP : [])].map((it, i) => clipOf(it, settings, i));
  let t = item.thumbT ?? 2.5;
  if (cat === 'transition') { clips[0].duration = 1; t = 0.4; }
  const project = {
    settings, assets: {}, camera: { props: { x: W / 2, y: H / 2, zoom: 1, rotation: 0, shake: 0 }, keys: {} },
    tracks: clips.map((c, i) => ({ id: 'tr' + i, kind: 'visual', followCamera: true, clips: [c] })),
  };
  return { project, t };
}

function renderOne(item) {
  const { project, t } = sceneFor(item);
  P5M.renderFrame(pInst, project, t);
  const out = document.createElement('canvas');
  out.width = TW;
  out.height = TH;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(pInst.canvas, 0, 0, TW, TH);
  return out.toDataURL('image/jpeg', 0.82);
}

async function pump() {
  if (busy) return;
  busy = true;
  await boot();
  while (queue.length) {
    const { key, item, resolve } = queue.shift();
    let url = cache.get(key);
    if (url === undefined) {
      try { url = renderOne(item); } catch (err) { console.error('縮圖產生失敗', item.type, err); url = ''; }
      cache.set(key, url);
    }
    resolve(url);
    await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive between thumbnails
  }
  busy = false;
}

// Promise<dataURL | ''>
export function thumb(item) {
  const key = JSON.stringify([item.type, item.props || {}, item.thumbT]);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => { queue.push({ key, item, resolve }); pump(); });
}

// Fill el's background with the thumbnail once it is ready
export function paintThumb(el, item) {
  thumb(item).then((url) => { if (url) el.style.backgroundImage = `url("${url}")`; });
}
