// Import p5-comfyui-animation project folders (engine.js + sketch.js contract, see runtime/assets.js buildLegacy)
// as legacy assets. Picking a parent folder imports every project inside it.
import { store } from './state.js';
import { toast, setStatus } from './ui.js';
import * as A from './actions.js';

const P5M = window.P5M;
const WANTED = /^(assets|engine|sound|sketch)\.js$|^index\.html$/;

function pickFolder() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.webkitdirectory = true;
    inp.style.display = 'none';
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

// { dir: { 'sketch.js': File, ... } } for folders that look like projects
function groupByFolder(files) {
  const dirs = new Map();
  for (const f of files) {
    const parts = (f.webkitRelativePath || f.name).split('/');
    const name = parts.pop();
    if (!WANTED.test(name)) continue;
    const dir = parts.join('/');
    if (!dirs.has(dir)) dirs.set(dir, {});
    dirs.get(dir)[name] = f;
  }
  const projects = [], unsupported = [];
  for (const [dir, fs] of dirs) {
    if (fs['engine.js'] && fs['sketch.js']) projects.push([dir, fs]);
    else if (fs['sketch.js']) unsupported.push(dir);
  }
  projects.sort((a, b) => a[0].localeCompare(b[0]));
  return { projects, unsupported };
}

async function readProject(dir, fs) {
  const text = (name) => (fs[name] ? fs[name].text() : Promise.resolve(''));
  const files = {};
  for (const k of ['assets', 'engine', 'sound', 'sketch']) files[k] = await text(k + '.js');
  const html = await text('index.html');
  const title = ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim() || dir.split('/').pop() || '舊專案';
  const font = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/i);
  const size = files.engine.match(/const\s+W\s*=\s*(\d+)\s*,\s*H\s*=\s*(\d+)/);
  const dur = files.sketch.match(/FILM\s*=\s*\{[\s\S]*?duration\s*:\s*([\d.]+)/);
  const asset = {
    id: P5M.uid('a'), kind: 'legacy', name: title, files,
    fontHref: font ? font[1].replace(/&amp;/g, '&') : null,
    width: size ? +size[1] : 1280, height: size ? +size[2] : 720, duration: dur ? +dur[1] : 10,
  };
  // Boot it once (the runtime keeps this iframe for playback) to read FILM and SCORE exactly as it runs them
  const e = await P5M.assets.legacy(asset).promise;
  if (e.error) throw new Error(e.error);
  if (e.film && e.film.duration) asset.duration = e.film.duration;
  if (e.score) asset.score = JSON.parse(JSON.stringify(e.score));
  return asset;
}

export async function importLegacy() {
  const files = await pickFolder();
  if (!files.length) return;
  const { projects, unsupported } = groupByFolder(files);
  if (!projects.length) {
    toast(unsupported.length
      ? '這個資料夾是舊版格式（沒有 engine.js），目前不支援匯入'
      : '資料夾裡找不到舊專案：需要同一層有 engine.js 與 sketch.js', 'error');
    return;
  }
  const added = [];
  for (const [i, [dir, fs]] of projects.entries()) {
    setStatus(`匯入舊專案 ${i + 1}／${projects.length}：${dir}`);
    try {
      added.push(await readProject(dir, fs));
    } catch (err) {
      console.error('舊專案匯入失敗', dir, err);
      toast(`「${dir}」匯入失敗：${err.message}`, 'error');
    }
  }
  setStatus('就緒');
  if (!added.length) return;
  A.editAssets((as) => { for (const a of added) as[a.id] = a; });
  if (unsupported.length) toast(`略過 ${unsupported.length} 個舊版格式資料夾：${unsupported.join('、')}`);
  if (added.length === 1) {
    const a = added[0];
    A.addItem({ type: 'legacy', name: a.name, props: { asset: a.id }, duration: a.duration }, { time: store.time });
    toast(`已匯入「${a.name}」（${P5M.fmtTime(a.duration)}），配樂一起放在音訊軌`);
  } else {
    toast(`已匯入 ${added.length} 個舊專案，從素材庫「舊專案」分頁拖進時間軸`);
  }
}
