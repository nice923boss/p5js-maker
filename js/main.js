// Editor entry: boots the stage, wires panels, toolbar and shortcuts, then restores a draft or starts a new project.
import { store, on, emit, loadProject, undo, redo, canUndo, canRedo } from './state.js';
import { setStatus, drag, toast } from './ui.js';
import { hydrateIcons } from './icons.js';
import { initStage, requestRender } from './stage.js';
import { initTransport } from './transport.js';
import { initTimeline } from './timeline.js';
import { initInspector } from './inspector.js';
import { initLibrary, importFiles } from './library.js';
import { importLegacy } from './legacy-import.js';
import { initFileIO, newProject, openProject, openFile, saveProject, takeDraft } from './fileio.js';
import { exportHtml, exportVideo } from './export.js';
import { initShortcuts } from './shortcuts.js';

const P5M = window.P5M;
const TL_MIN = 140, TL_KEY = 'p5maker.tlHeight';

const COMMANDS = {
  new: newProject, open: openProject, save: () => saveProject(),
  undo, redo, exportHtml, exportVideo,
};

// Project files open; images and audio become assets (placed at the drop point when there is one)
function onFilesDropped(files, pos) {
  const project = files.find((f) => /\.(json|html?)$/i.test(f.name));
  if (project) return openFile(project);
  const media = files.filter((f) => /^(image|audio)\//.test(f.type));
  if (!media.length) { toast('只能拖入圖片、音訊或專案檔（.json／.html）', 'error'); return; }
  return importFiles(media, pos && (pos.x !== undefined || pos.time !== undefined) ? pos : null);
}

function initToolbar() {
  hydrateIcons();
  document.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => { btn.blur(); COMMANDS[btn.dataset.cmd](); });
  });
  const undoBtn = document.querySelector('[data-cmd="undo"]');
  const redoBtn = document.querySelector('[data-cmd="redo"]');
  on((kind) => {
    if (kind !== 'project' && kind !== 'load') return;
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
  });
}

function initSplitter() {
  const root = document.documentElement;
  const setH = (px) => {
    const h = Math.round(Math.max(TL_MIN, Math.min(innerHeight - 260, px)));
    root.style.setProperty('--tl-h', h + 'px');
    return h;
  };
  try { const saved = +localStorage.getItem(TL_KEY); if (saved) setH(saved); } catch { /* storage blocked: keep default */ }
  document.getElementById('splitter').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const h0 = document.getElementById('timeline').offsetHeight;
    let h = h0;
    drag(e, (dx, dy) => { h = setH(h0 - dy); }, () => {
      try { localStorage.setItem(TL_KEY, h); } catch { /* storage blocked */ }
    });
  });
}

async function boot() {
  // Panels read store.project while building, so start from an empty project and replace it later
  store.project = P5M.newProject();
  const p = await initStage({ onFilesDropped });
  initTransport();
  initTimeline({ onFilesDropped });
  initInspector();
  initLibrary({ onImportLegacy: importLegacy });
  initFileIO();
  initToolbar();
  initSplitter();
  initShortcuts();
  P5M.assets.onReady = requestRender;
  // Fonts, images, legacy iframes and 3D shaders of a newly opened project; renders progressively meanwhile
  on((kind) => {
    if (kind !== 'load') return;
    setStatus('載入素材中…');
    P5M.prepare(p, store.project)
      .then(() => { requestRender(); setStatus('就緒'); })
      .catch((err) => { console.error('素材載入失敗', err); setStatus('部分素材載入失敗：' + err.message); });
  });

  const draft = await takeDraft();
  if (draft) {
    loadProject(draft.project, { fileName: draft.fileName });
    store.dirty = true;               // restored work is still unsaved
    emit('project', 'draft');
  } else {
    loadProject(P5M.newProject());
  }
}

boot().catch((err) => {
  console.error('編輯器啟動失敗', err);
  setStatus('啟動失敗：' + err.message);
  toast('編輯器啟動失敗：' + err.message, 'error');
});
