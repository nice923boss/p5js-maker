// New / open / save project files, title field, unsaved-change guard and crash-recovery draft (IndexedDB).
// Open accepts a project .json or an exported player .html (the project JSON is embedded in it).
import { store, on, mutate, loadProject, markSaved } from './state.js';
import { toast, confirmDialog, setStatus } from './ui.js';

const P5M = window.P5M;
const DRAFT_DB = 'p5maker', DRAFT_STORE = 'drafts', DRAFT_KEY = 'current';
const DRAFT_DELAY = 4000;
const FILE_TYPES = [{ description: 'P5JS Maker 專案', accept: { 'application/json': ['.json'] } }];

export function initFileIO() {
  const titleEl = document.getElementById('project-title');
  titleEl.addEventListener('input', () => mutate((p) => { p.title = titleEl.value; }, { merge: 'title', source: 'title' }));
  titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleEl.blur(); });
  on((kind, source) => {
    if (!store.project || kind === 'time' || kind === 'select' || kind === 'playing') return;
    if (source !== 'title' && document.activeElement !== titleEl) titleEl.value = store.project.title || '';
    document.body.classList.toggle('dirty', store.dirty);
    document.title = (store.dirty ? '• ' : '') + (store.project.title || '未命名專案') + ' | P5JS Maker';
    if (kind === 'project') scheduleDraft();
    if (kind === 'saved' || kind === 'load') clearDraft();
  });
  addEventListener('beforeunload', (e) => {
    if (!store.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

// ---------- commands ----------
async function confirmDiscard() {
  return !store.dirty || confirmDialog('尚未儲存', '目前的專案有未儲存的變更，確定要放棄嗎？', '放棄變更', true);
}

export async function newProject() {
  if (!(await confirmDiscard())) return;
  loadProject(P5M.newProject());
  setStatus('已建立新專案');
}

export async function openProject() {
  if (!(await confirmDiscard())) return;
  let file = null, handle = null;
  try {
    if (window.showOpenFilePicker) {
      [handle] = await showOpenFilePicker({
        types: [{ description: 'P5JS Maker 專案或匯出的 HTML', accept: { 'application/json': ['.json'], 'text/html': ['.html', '.htm'] } }],
      });
      file = await handle.getFile();
    } else {
      file = await pickFile('.json,.html,.htm');
    }
  } catch (err) {
    if (err.name !== 'AbortError') { console.error('開啟檔案失敗', err); toast('開啟失敗：' + err.message, 'error'); }
    return;
  }
  if (file) await openFile(file, /\.json$/i.test(file.name) ? handle : null);
}

// Also used when a project file is dropped onto the window
export async function openFile(file, handle = null) {
  try {
    const project = parseProject(await file.text(), file.name);
    loadProject(project, { fileHandle: handle, fileName: handle ? file.name : '' });
    setStatus(`已開啟「${file.name}」`);
  } catch (err) {
    console.error('讀取專案失敗', file.name, err);
    toast(`無法開啟「${file.name}」：${err.message}`, 'error');
  }
}

export function parseProject(text, name = '') {
  let json = text;
  if (/\.html?$/i.test(name) || /^\s*</.test(text)) {
    const m = text.match(/<script type="application\/json" id="p5maker-project">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('這個 HTML 不是 P5JS Maker 匯出的檔案；舊版動畫請用素材庫的「舊專案」匯入');
    json = m[1];
  }
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.tracks) || !data.settings) throw new Error('檔案內容不是 P5JS Maker 專案');
  return P5M.normalizeProject(data);
}

export async function saveProject({ as = false } = {}) {
  const text = JSON.stringify(store.project);
  const suggested = safeName(store.project.title || '未命名專案') + '.json';
  try {
    if (window.showSaveFilePicker) {
      let handle = !as && store.fileHandle;
      if (!handle) handle = await showSaveFilePicker({ suggestedName: store.fileName || suggested, types: FILE_TYPES });
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      store.fileHandle = handle;
      store.fileName = handle.name;
    } else {
      P5M.recorder.downloadBlob(new Blob([text], { type: 'application/json' }), suggested);
      store.fileName = suggested;
    }
  } catch (err) {
    if (err.name !== 'AbortError') { console.error('儲存失敗', err); toast('儲存失敗：' + err.message, 'error'); }
    return false;
  }
  markSaved();
  setStatus(`已儲存「${store.fileName}」（${(text.length / 1048576).toFixed(1)} MB）`);
  return true;
}

export const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'animation';

function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.display = 'none';
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve(null); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

// ---------- crash-recovery draft ----------
let draftTimer = 0;
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DRAFT_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DRAFT_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function draftOp(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(DRAFT_STORE, mode);
    const req = fn(tx.objectStore(DRAFT_STORE));
    tx.oncomplete = () => { d.close(); resolve(req.result); };
    tx.onerror = () => { d.close(); reject(tx.error); };
  });
}

function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (!store.dirty) return;
    const draft = { savedAt: Date.now(), fileName: store.fileName, project: JSON.stringify(store.project) };
    draftOp('readwrite', (s) => s.put(draft, DRAFT_KEY)).catch((err) => console.error('草稿暫存失敗', err));
  }, DRAFT_DELAY);
}

function clearDraft() {
  clearTimeout(draftTimer);
  draftOp('readwrite', (s) => s.delete(DRAFT_KEY)).catch((err) => console.error('清除草稿失敗', err));
}

// Called once at startup: returns a project to restore, or null
export async function takeDraft() {
  let draft = null;
  try { draft = await draftOp('readonly', (s) => s.get(DRAFT_KEY)); } catch (err) { console.error('讀取草稿失敗', err); return null; }
  if (!draft) return null;
  const when = new Date(draft.savedAt).toLocaleString('zh-TW', { hour12: false });
  const ok = await confirmDialog('找到未儲存的草稿', `上次編輯到一半的專案（${when}）還沒有儲存，要還原嗎？`, '還原草稿');
  if (!ok) { clearDraft(); return null; }
  try {
    return { project: P5M.normalizeProject(JSON.parse(draft.project)), fileName: draft.fileName || '' };
  } catch (err) {
    console.error('草稿內容損壞', err);
    toast('草稿內容損壞，無法還原', 'error');
    clearDraft();
    return null;
  }
}
