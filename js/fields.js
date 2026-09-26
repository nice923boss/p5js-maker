// Inspector field controls. field(pd, io) builds one row for a prop definition:
//   io = { id, value(), set(v, mergeKey|null), assets(), importAsset(accept) -> Promise<id|null>, kf: { state(), toggle() } | null }
// Returns { el, key, update(pr) } where update refreshes the control from resolved props without rebuilding.
import { h, drag } from './ui.js';

const P5M = window.P5M;

const decimals = (step) => { const s = String(step ?? 1); return s.includes('.') ? s.split('.')[1].length : 0; };
export const roundTo = (v, step) => +(+v || 0).toFixed(Math.min(4, decimals(step)));
const clampPd = (v, pd) => Math.min(pd.max ?? Infinity, Math.max(pd.min ?? -Infinity, v));
const active = (el) => document.activeElement === el;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function field(pd, io) {
  const merge = 'ins:' + io.id + ':' + pd.key;
  const set = (v, m = merge) => io.set(v, m);
  const label = h('label', { title: pd.label }, pd.label);
  const build = BUILDERS[pd.type] || BUILDERS.number;
  const { ctl, update, wide, focusEl } = build(pd, io, set, label);
  const kfBtn = pd.anim && io.kf ? h('button.kf', { title: '關鍵影格：在目前時間加入／移除', on: { click: () => io.kf.toggle() } }) : h('span');
  const row = h('div.row' + (wide ? '.wide' : ''), { dataset: { key: pd.key } }, label, ctl, wide ? null : kfBtn);
  return {
    el: row, key: pd.key, focusEl,
    update(pr) {
      update(pr[pd.key]);
      if (pd.when) row.classList.toggle('hidden', !pd.when(pr));
      if (kfBtn.tagName === 'BUTTON') {
        const st = io.kf.state();
        kfBtn.classList.toggle('has', st !== 'none');
        kfBtn.classList.toggle('on', st === 'on');
        kfBtn.title = st === 'on' ? '移除此時間點的關鍵影格' : st === 'has' ? '在目前時間加入關鍵影格（此屬性已有動畫）' : '開啟關鍵影格動畫：在目前時間記下數值';
      }
    },
  };
}

function numberInput(pd, set, cls = '') {
  const inp = h('input.inp.num' + cls, { type: 'number', step: pd.step ?? 1, min: pd.min, max: pd.max });
  inp.addEventListener('input', () => { if (inp.value !== '' && !isNaN(+inp.value)) set(clampPd(+inp.value, pd)); });
  return inp;
}

const BUILDERS = {
  number(pd, io, set, label) {
    const inp = numberInput(pd, set);
    const step = pd.step ?? 1;
    label.classList.add('scrub');
    label.title = pd.label + '（左右拖曳調整，按住 Shift 加快）';
    label.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const v0 = +io.value() || 0, key = 'g:scrub:' + pd.key + ':' + performance.now();
      drag(e, (dx, dy, ev) => {
        const v = roundTo(clampPd(v0 + dx * step * (ev.shiftKey ? 10 : 1), pd), step);
        inp.value = v;
        set(v, key);
      });
    });
    return {
      ctl: h('div.ctl', inp, pd.unit ? h('span.unit', pd.unit) : null), focusEl: inp,
      update: (v) => { if (!active(inp)) inp.value = roundTo(v ?? 0, step); },
    };
  },

  range(pd, io, set) {
    const r = h('input', { type: 'range', min: pd.min ?? 0, max: pd.max ?? 1, step: pd.step ?? 0.01 });
    const n = numberInput(pd, set, '.small');
    r.addEventListener('input', () => { n.value = r.value; set(+r.value); });
    n.addEventListener('input', () => { r.value = n.value; });
    return {
      ctl: h('div.ctl', r, n), focusEl: n,
      update: (v) => { const x = roundTo(v ?? 0, pd.step ?? 0.01); if (!active(n)) n.value = x; if (!active(r)) r.value = x; },
    };
  },

  color(pd, io, set) {
    const c = h('input', { type: 'color' });
    const tx = h('input.inp', { type: 'text', spellcheck: 'false' });
    const alphaOf = (v) => { const hx = P5M.toHex(v || '#000'); return hx.length === 9 ? hx.slice(7) : ''; };
    c.addEventListener('input', () => { const v = c.value + alphaOf(io.value()); tx.value = v; set(v); });
    tx.addEventListener('change', () => {
      const v = tx.value.trim();
      if (HEX_RE.test(v)) set(v, null);
      else tx.value = P5M.toHex(io.value() || '#000');
    });
    return {
      ctl: h('div.ctl', c, tx), focusEl: tx,
      update: (v) => { const hx = P5M.toHex(v || '#000'); if (!active(tx)) tx.value = hx; if (!active(c)) c.value = hx.slice(0, 7); },
    };
  },

  select(pd, io, set) {
    const s = h('select.sel', (pd.options || []).map(([v, l]) => h('option', { value: String(v) }, l)));
    s.addEventListener('change', () => {
      const o = (pd.options || []).find(([v]) => String(v) === s.value);
      set(o ? o[0] : s.value, null);
    });
    return { ctl: h('div.ctl', s), focusEl: s, update: (v) => { s.value = String(v); } };
  },

  textarea(pd, io, set) {
    const ta = h('textarea.ta', { rows: 3, spellcheck: 'false' });
    ta.addEventListener('input', () => set(ta.value));
    return { ctl: h('div.ctl', ta), focusEl: ta, wide: true, update: (v) => { if (!active(ta)) ta.value = v ?? ''; } };
  },

  font(pd, io, set) {
    const fonts = P5M.assets.FONTS;
    P5M.assets.requestFonts(fonts.map((f) => f.family));
    const s = h('select.sel', fonts.map((f) => h('option', { value: f.family, style: { fontFamily: `"${f.family}"` } }, f.label)));
    const show = (v) => { s.value = v; s.style.fontFamily = `"${v}", sans-serif`; };
    s.addEventListener('change', () => { show(s.value); set(s.value, null); });
    return { ctl: h('div.ctl', s), focusEl: s, update: show };
  },

  asset(pd, io, set) {
    const s = h('select.sel');
    let sig = null;
    const fill = () => {
      const list = Object.values(io.assets()).filter((a) => a.kind === pd.accept);
      const next = list.map((a) => a.id + a.name).join('|');
      if (next === sig) return;
      sig = next;
      s.replaceChildren(
        h('option', { value: '' }, list.length ? '（未選擇）' : '（尚無素材）'),
        ...list.map((a) => h('option', { value: a.id }, a.name)),
        ...(pd.accept !== 'legacy' ? [h('option', { value: '__import' }, '匯入檔案…')] : []),
      );
    };
    const show = (v) => { fill(); s.value = v || ''; };
    s.addEventListener('change', async () => {
      if (s.value !== '__import') { set(s.value, null); return; }
      const id = await io.importAsset(pd.accept);
      if (id) set(id, null);
      show(io.value());
    });
    return { ctl: h('div.ctl', s), focusEl: s, update: show };
  },

  bool(pd, io, set) {
    const cb = h('input', { type: 'checkbox' });
    cb.addEventListener('change', () => set(cb.checked, null));
    return { ctl: h('div.ctl', cb), focusEl: cb, update: (v) => { cb.checked = !!v; } };
  },

  code(pd, io, set) {
    const ta = h('textarea.ta.code', { spellcheck: 'false', rows: 14 });
    const msg = h('div');
    let editing = false;
    const apply = () => {
      try { new Function('p', 't', 'env', 'P5M', ta.value); } catch (err) {
        msg.className = 'err-msg';
        msg.textContent = '語法錯誤：' + err.message;
        return;
      }
      editing = false;
      msg.className = 'ok-msg';
      msg.textContent = '已套用。執行期錯誤會以紅框顯示在畫面上。';
      set(ta.value, null);
    };
    ta.addEventListener('input', () => { editing = true; msg.className = 'unit'; msg.textContent = '尚未套用'; });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); apply(); }
      else if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); }
    });
    const ctl = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      ta, h('div.btn-row', h('button.btn.accent', { on: { click: apply } }, '套用（Ctrl+Enter）')), msg);
    return { ctl, focusEl: ta, wide: true, update: (v) => { if (!editing && !active(ta)) ta.value = v ?? ''; } };
  },
};
