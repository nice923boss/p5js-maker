// Export: standalone player HTML (same output as tools/build_player.py) and real-time video recording.
import { store } from './state.js';
import { h, modal, toast, setStatus } from './ui.js';
import { stop as stopPlayback } from './transport.js';
import { getP5, requestRender } from './stage.js';
import { safeName } from './fileio.js';

const P5M = window.P5M;
const title = () => store.project.title || '未命名專案';
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inlineScript = (code) => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>';

async function fetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`讀取 ${path} 失敗（HTTP ${res.status}）`);
  return res.text();
}

// Project copy without assets no clip uses (keeps exports small)
function exportProject() {
  const used = P5M.assets.usedAssetIds(store.project);
  const assets = {};
  for (const [id, a] of Object.entries(store.project.assets)) if (used.has(id)) assets[id] = a;
  return { ...store.project, assets };
}

export async function buildPlayerHtml(project = exportProject()) {
  const manifest = JSON.parse(await fetchText('runtime/manifest.json'));
  const [template, player, ...runtime] = await Promise.all([
    fetchText('runtime/' + manifest.template), fetchText('runtime/' + manifest.player),
    ...manifest.runtime.map((f) => fetchText('runtime/' + f)),
  ]);
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  // split/join instead of replace(): payloads contain '$' sequences that replace() would interpret
  return template
    .split('__P5M_TITLE__').join(escapeHtml(project.title || title()))
    .split('<!--P5M:RUNTIME-->').join(runtime.map(inlineScript).join('\n'))
    .split('<!--P5M:PLAYER-->').join(inlineScript(player))
    .split('__P5M_PROJECT__').join(data);
}

export async function exportHtml() {
  if (location.protocol === 'file:') {
    toast('匯出 HTML 需要用 start.bat 或網址開啟編輯器（直接雙擊 index.html 時瀏覽器會擋住讀取 runtime 檔案）', 'error');
    return;
  }
  setStatus('正在產生 HTML…');
  try {
    const html = await buildPlayerHtml();
    const name = safeName(title()) + '.html';
    P5M.recorder.downloadBlob(new Blob([html], { type: 'text/html' }), name);
    setStatus(`已匯出「${name}」（${(html.length / 1048576).toFixed(1)} MB），可直接用瀏覽器開啟播放`);
  } catch (err) {
    console.error('匯出 HTML 失敗', err);
    toast('匯出 HTML 失敗：' + err.message, 'error');
    setStatus('匯出失敗');
  }
}

// ---------- video ----------
export function exportVideo() {
  const type = P5M.recorder.pickType();
  if (!type) { toast('此瀏覽器不支援影片錄製，請改用 Chrome 或 Edge', 'error'); return; }
  stopPlayback();
  const s = store.project.settings;
  const end = Math.min(s.duration, Math.max(0.5, P5M.contentEnd(store.project) || s.duration));
  const fmt = type.startsWith('video/mp4') ? 'MP4' : 'WebM';
  const rangeSel = h('select',
    h('option', { value: 'all' }, `整部影片（${P5M.fmtTime(s.duration)}）`),
    end < s.duration - 0.05 ? h('option', { value: 'content' }, `到最後一個片段結束（${P5M.fmtTime(end)}）`) : null);
  const body = h('div',
    h('p', `格式 ${fmt}，${s.width}×${s.height}，${s.fps} fps。錄製是即時進行的，需要和影片一樣長的時間。`),
    h('div.row', h('label', '範圍'), h('div.ctl', rangeSel)),
    h('p.lib-note', '錄製期間請讓這個分頁保持在前景，不要切換分頁或最小化視窗。'),
  );
  modal({
    title: '匯出影片', body,
    actions: [{ label: '取消' }, { label: '開始錄製', cls: 'accent', onClick: () => { record(rangeSel.value === 'content' ? end : s.duration); } }],
  });
}

async function record(to) {
  const ctrl = new AbortController();
  const bar = h('div');
  const label = h('div.unit', '準備中…');
  // Esc / backdrop click also closes the dialog, so closing always means cancel
  const dlg = modal({
    title: '錄製中', body: h('div', h('div.progress', bar), label),
    actions: [{ label: '取消錄製', onClick: () => ctrl.abort() }],
    onClose: () => ctrl.abort(),
  });
  const p = getP5();
  store.exporting = true;
  document.body.classList.add('busy');
  try {
    await P5M.prepare(p, store.project);
    const res = await P5M.recorder.recordVideo({
      canvas: p.canvas, project: store.project, from: 0, to, signal: ctrl.signal,
      render: (t) => P5M.renderFrame(p, store.project, t),
      onProgress: (k) => {
        bar.style.width = Math.round(k * 100) + '%';
        label.textContent = `${Math.round(k * 100)}%（${P5M.fmtTime(k * to)} / ${P5M.fmtTime(to)}）`;
      },
    });
    if (res) {
      const name = safeName(title()) + '.' + res.ext;
      P5M.recorder.downloadBlob(res.blob, name);
      setStatus(`已匯出「${name}」（${(res.blob.size / 1048576).toFixed(1)} MB）`);
    } else {
      setStatus('已取消錄製');
    }
  } catch (err) {
    console.error('匯出影片失敗', err);
    toast('匯出影片失敗：' + err.message, 'error');
  } finally {
    store.exporting = false;
    document.body.classList.remove('busy');
    dlg.close();
    requestRender();
  }
}
