// Global keyboard shortcuts (ignored while typing in a field or when a dialog is open)
import { store, undo, redo, select } from './state.js';
import { isTyping, closeMenu } from './ui.js';
import * as A from './actions.js';
import { toggle, step, seek } from './transport.js';
import { zoomBy } from './timeline.js';
import { saveProject, openProject } from './fileio.js';

// Letter match by physical key (works while a Chinese IME reports key 'Process') or by character (other layouts)
const is = (e, L) => e.code === 'Key' + L || e.key.toUpperCase() === L;

// [key test, handler]; ctrl = Ctrl or Cmd
const KEYS = [
  [(e, c) => c && !e.shiftKey && is(e, 'Z'), () => undo()],
  [(e, c) => c && (is(e, 'Y') || (e.shiftKey && is(e, 'Z'))), () => redo()],
  [(e, c) => c && is(e, 'S'), (e) => saveProject({ as: e.shiftKey })],
  [(e, c) => c && is(e, 'O'), () => openProject()],
  [(e, c) => c && is(e, 'C'), () => A.copy()],
  [(e, c) => c && is(e, 'V'), () => A.paste()],
  [(e, c) => c && is(e, 'D'), () => A.duplicate()],
  [(e, c) => c && is(e, 'B'), () => A.splitAt()],
  [(e, c) => !c && e.code === 'Space', () => toggle()],
  [(e, c) => !c && is(e, 'S'), () => A.splitAt()],
  [(e, c) => !c && (e.key === 'Delete' || e.key === 'Backspace'), () => A.deleteClip()],
  [(e, c) => !c && e.key === 'ArrowLeft', (e) => (e.shiftKey ? seek(store.time - 1) : step(-1))],
  [(e, c) => !c && e.key === 'ArrowRight', (e) => (e.shiftKey ? seek(store.time + 1) : step(1))],
  [(e, c) => !c && e.key === 'Home', () => seek(0)],
  [(e, c) => !c && e.key === 'End', () => seek(store.project.settings.duration)],
  [(e, c) => !c && e.key === 'Escape', () => { closeMenu(); select(null); }],
  [(e, c) => !c && (e.key === '+' || e.key === '='), () => zoomBy(1.25)],
  [(e, c) => !c && (e.key === '-' || e.key === '_'), () => zoomBy(0.8)],
];

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (!store.project || e.altKey || (e.repeat && !e.key.startsWith('Arrow'))) return;
    if (isTyping() || document.querySelector('.modal-back')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const hit = KEYS.find(([test]) => test(e, ctrl));
    if (!hit) return;
    e.preventDefault();
    // a focused toolbar button would otherwise also react to Space / Enter
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    hit[1](e);
  });
}
