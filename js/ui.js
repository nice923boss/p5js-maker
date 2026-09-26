// Small DOM helpers: element builder, modal, toast, context menu
import { icon } from './icons.js';

// h('div.cls.cls2', {attrs, on: {click}}, ...children)
export function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'icon') el.insertAdjacentHTML('afterbegin', icon(v));
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// ---------- toast ----------
let toastBox = null;
export function toast(msg, kind = '') {
  if (!toastBox) { toastBox = h('div.toasts'); document.body.appendChild(toastBox); }
  const el = h('div.toast' + (kind ? '.' + kind : ''), msg);
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 2800);
}

// ---------- modal ----------
// modal({title, body: Node, actions: [{label, cls, onClick(close) -> false keeps it open}], wide, onClose})
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const back = h('div.modal-back');
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const btns = actions.map((a) => h('button.btn' + (a.cls ? '.' + a.cls : ''), {
    on: { click: () => { if (a.onClick && a.onClick(close) === false) return; if (!a.keep) close(); } },
  }, a.label));
  const box = h('div.modal' + (wide ? '.wide' : ''), h('h3', title), h('div.m-body', body), btns.length ? h('div.m-actions', btns) : null);
  back.appendChild(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  const first = box.querySelector('input,select,textarea,button.accent');
  if (first) setTimeout(() => first.focus(), 0);
  return { close, box };
}

export function confirmDialog(title, text, okLabel = '確定', danger = false) {
  return new Promise((res) => {
    let ok = false;
    modal({
      title, body: h('p', text), onClose: () => res(ok),
      actions: [{ label: '取消' }, { label: okLabel, cls: danger ? 'danger' : 'accent', onClick: () => { ok = true; } }],
    });
  });
}

// ---------- context menu ----------
// items: [{label, kbd, onClick, disabled} | '-']
let openMenu = null;
export function contextMenu(x, y, items) {
  closeMenu();
  const menu = h('div.ctx-menu', items.map((it) => it === '-' ? h('hr') : h('button', {
    disabled: !!it.disabled,
    on: { click: () => { closeMenu(); it.onClick && it.onClick(); } },
  }, h('span', it.label), it.kbd ? h('span.kbd', it.kbd) : null)));
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
  menu.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
  openMenu = menu;
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}
function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
export function closeMenu() {
  if (openMenu) { openMenu.remove(); openMenu = null; }
  document.removeEventListener('mousedown', outside, true);
}

// Pointer drag helper: calls move(dx, dy, e) and up(e); returns false from down to cancel
export function drag(e, move, up) {
  const x0 = e.clientX, y0 = e.clientY;
  const mm = (ev) => move(ev.clientX - x0, ev.clientY - y0, ev);
  const mu = (ev) => {
    removeEventListener('pointermove', mm);
    removeEventListener('pointerup', mu);
    removeEventListener('pointercancel', mu);
    up && up(ev);
  };
  addEventListener('pointermove', mm);
  addEventListener('pointerup', mu);
  addEventListener('pointercancel', mu);
}

export function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export const isTyping = (el = document.activeElement) =>
  !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && !['checkbox', 'range', 'button', 'color'].includes(el.type)) || el.tagName === 'SELECT');
