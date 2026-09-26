// Project checker for hand-written (Claude-made) project JSON. Validates against the live type registry so it
// never drifts from the runtime, and writes the type reference used by the Claude SKILL.
// Loaded by tests/check.html after the runtime; driven by tools/check_project.py.
(function () {
  const P5M = window.P5M;
  const COMMON = ['x', 'y', 'scale', 'rotation', 'opacity', 'blur', 'brightness', 'contrast', 'saturate', 'hue'];
  const CAMERA = { x: 'number', y: 'number', zoom: 'number', rotation: 'number', shake: 'number' };
  const ASSET_KINDS = ['image', 'audio', 'legacy'];
  const HIDDEN_PROPS = { music: ['score'] }; // set by legacy import, not shown in the inspector

  const optionValues = (pd) => (pd.options || []).map((o) => (Array.isArray(o) ? o[0] : o));
  const presetTable = (type) => (type === 'particles' ? P5M.particlePresets : type === 'gen' ? P5M.genPresets : null);

  const probe = document.createElement('canvas').getContext('2d');
  function validBlend(v) {
    probe.globalCompositeOperation = 'source-over';
    probe.globalCompositeOperation = v;
    return probe.globalCompositeOperation === v;
  }

  // Returns [level, message] for a bad value, or null
  function checkValue(pd, v, project) {
    switch (pd.type) {
      case 'number':
      case 'range':
        if (typeof v !== 'number' || !Number.isFinite(v)) return ['error', `必須是數字，目前是 ${JSON.stringify(v)}`];
        if (pd.min !== undefined && v < pd.min) return ['warn', `${v} 小於最小值 ${pd.min}`];
        if (pd.max !== undefined && v > pd.max) return ['warn', `${v} 大於最大值 ${pd.max}`];
        return null;
      case 'select':
        return optionValues(pd).includes(v) ? null : ['error', `${JSON.stringify(v)} 不是可用選項，可用：${optionValues(pd).map((o) => JSON.stringify(o)).join('、')}`];
      case 'color':
        return P5M.isColor(v) && !P5M.parseColor(v).some(Number.isNaN) ? null : ['error', `${JSON.stringify(v)} 不是顏色，請用 #rrggbb、#rrggbbaa 或 rgba(r,g,b,a)`];
      case 'bool':
        return typeof v === 'boolean' ? null : ['error', `必須是 true 或 false，目前是 ${JSON.stringify(v)}`];
      case 'asset': {
        if (v === '' || v === null) return ['warn', '尚未指定素材，這個圖層不會顯示內容'];
        const a = project.assets[v];
        if (!a) return ['error', `找不到素材 ${JSON.stringify(v)}（assets 裡沒有這個 id）`];
        return a.kind === pd.accept ? null : ['error', `素材 ${v} 的 kind 是 ${a.kind}，這裡需要 ${pd.accept}`];
      }
      case 'font':
        if (typeof v !== 'string') return ['error', '必須是字型名稱字串'];
        return P5M.assets.FONTS.some((f) => f.family === v) ? null : ['warn', `字型 ${JSON.stringify(v)} 不在內建清單，其他電腦可能沒有`];
      default:
        return typeof v === 'string' ? null : ['error', `必須是字串，目前是 ${JSON.stringify(v)}`];
    }
  }

  function checkKeys(keys, lookup, tMin, tMax, where, add) {
    for (const [k, list] of Object.entries(keys || {})) {
      const pd = lookup(k);
      const at = `${where}.keys.${k}`;
      if (!pd) { add('error', at, '沒有這個屬性，無法設關鍵影格'); continue; }
      if (!pd.anim) add('warn', at, '這個屬性不支援關鍵影格，編輯器不會顯示');
      if (!Array.isArray(list) || !list.length) { add('error', at, '必須是非空陣列 [{ t, v, e }]'); continue; }
      list.forEach((key, i) => {
        if (typeof key.t !== 'number') add('error', `${at}[${i}].t`, '必須是數字（秒）');
        else if (key.t < tMin - 1e-6 || key.t > tMax + 1e-6) add('warn', `${at}[${i}].t`, `${key.t} 超出 ${tMin} 到 ${tMax} 秒，這段不會播到`);
        if (i > 0 && key.t < list[i - 1].t) add('error', `${at}[${i}].t`, '關鍵影格必須依 t 由小到大排列');
        const bad = checkValue(pd, key.v, lookup.project);
        if (bad) add(bad[0], `${at}[${i}].v`, bad[1]);
        if (key.e !== undefined && !P5M.EASE[key.e]) add('error', `${at}[${i}].e`, `沒有 ${JSON.stringify(key.e)} 這種緩動，可用：${Object.keys(P5M.EASE).join('、')}`);
      });
    }
  }

  function checkAnim(clip, def, where, add) {
    const tables = { in: P5M.presets.IN, out: P5M.presets.OUT, loop: P5M.presets.LOOP };
    let used = 0;
    for (const slot of Object.keys(clip.anim || {})) {
      const a = clip.anim[slot];
      const at = `${where}.anim.${slot}`;
      if (!tables[slot]) { add('error', at, 'anim 只能有 in、out、loop'); continue; }
      if (!a || !a.type || a.type === 'none') continue;
      const preset = tables[slot][a.type];
      if (!preset) { add('error', at + '.type', `沒有 ${JSON.stringify(a.type)}，可用：${Object.keys(tables[slot]).join('、')}`); continue; }
      if (preset.text && clip.type !== 'text') add('warn', at + '.type', `${a.type} 只對文字圖層有效`);
      for (const k of ['dur', 'speed', 'amount']) if (a[k] !== undefined && !(typeof a[k] === 'number' && a[k] > 0)) add('error', `${at}.${k}`, '必須是正數');
      if (slot !== 'loop') used += a.dur ?? preset.dur ?? 0.6;
    }
    if (def.audio && used) add('warn', where + '.anim', '音訊圖層不會套用動畫');
    if (used > clip.duration + 1e-6) add('warn', where + '.anim', `入場加出場共 ${used.toFixed(2)} 秒，超過圖層長度 ${clip.duration} 秒`);
  }

  // Returns { errors: [], warnings: [] } of "path: message" strings
  function validate(src) {
    const errors = [], warnings = [];
    const add = (level, at, msg) => (level === 'error' ? errors : warnings).push(`${at}：${msg}`);
    const project = P5M.normalizeProject(src);
    const s = src.settings || {};
    for (const k of ['width', 'height', 'duration']) if (!(typeof s[k] === 'number' && s[k] > 0)) add('error', 'settings.' + k, '必須是正數');
    if (s.background !== undefined && s.background !== 'transparent' && !P5M.isColor(s.background)) add('error', 'settings.background', '必須是顏色或 "transparent"');
    const dur = project.settings.duration;

    for (const [id, a] of Object.entries(project.assets)) {
      const at = `assets.${id}`;
      if (a.id !== id) add('error', at + '.id', 'id 必須與 assets 的鍵相同');
      if (!ASSET_KINDS.includes(a.kind)) add('error', at + '.kind', `必須是 ${ASSET_KINDS.join('、')}`);
      if (typeof a.src !== 'string' && a.kind !== 'legacy') add('error', at + '.src', '缺少 src');
      else if (a.kind !== 'legacy' && !/^(data:|https?:)/.test(a.src)) add('error', at + '.src', '本機路徑無法載入，請先執行 tools/embed_assets.py 轉成 data URL');
    }

    const cam = src.camera || {};
    const camLookup = (k) => (CAMERA[k] ? { key: k, type: CAMERA[k], anim: true } : null);
    camLookup.project = project;
    for (const [k, v] of Object.entries(cam.props || {})) {
      if (!CAMERA[k]) add('warn', 'camera.props.' + k, `鏡頭沒有這個屬性，可用：${Object.keys(CAMERA).join('、')}`);
      else if (typeof v !== 'number') add('error', 'camera.props.' + k, '必須是數字');
    }
    checkKeys(cam.keys, camLookup, 0, dur, 'camera', add);

    const ids = new Set();
    const dupe = (id, at) => { if (ids.has(id)) add('error', at, `id ${JSON.stringify(id)} 重複`); ids.add(id); };
    (src.tracks || []).forEach((tr, ti) => {
      const tw = `tracks[${ti}]`;
      if (tr.id) dupe(tr.id, tw + '.id');
      if (tr.kind !== 'visual' && tr.kind !== 'audio') add('error', tw + '.kind', '必須是 "visual" 或 "audio"');
      const clips = tr.clips || [];
      clips.forEach((c, ci) => {
        const where = `${tw}.clips[${ci}]`;
        if (c.id) dupe(c.id, where + '.id');
        const def = P5M.types[c.type];
        if (!def) { add('error', where + '.type', `沒有 ${JSON.stringify(c.type)} 這種圖層，可用：${Object.keys(P5M.types).join('、')}`); return; }
        if (!!def.audio !== (tr.kind === 'audio')) add('error', where + '.type', def.audio ? '音訊圖層必須放在 kind "audio" 的軌道，否則不會播放' : '畫面圖層放在音訊軌道上不會顯示');
        if (!(typeof c.start === 'number' && c.start >= 0)) add('error', where + '.start', '必須是 0 以上的數字');
        if (!(typeof c.duration === 'number' && c.duration > 0)) add('error', where + '.duration', '必須是正數');
        else if (c.start >= dur) add('warn', where + '.start', `在片長 ${dur} 秒之後，不會出現`);
        else if (c.start + c.duration > dur + 1e-6) add('warn', where + '.duration', `結束於 ${+(c.start + c.duration).toFixed(3)} 秒，超過片長 ${dur} 秒的部分不會播放`);
        if (c.blend !== undefined && !validBlend(c.blend)) add('error', where + '.blend', `${JSON.stringify(c.blend)} 不是有效的混合模式`);

        const byKey = Object.fromEntries(def.props.map((pd) => [pd.key, pd]));
        const lookup = (k) => byKey[k];
        lookup.project = project;
        for (const [k, v] of Object.entries(c.props || {})) {
          const pd = byKey[k];
          if (!pd && (HIDDEN_PROPS[c.type] || []).includes(k)) continue;
          if (!pd) { add('warn', `${where}.props.${k}`, `${c.type} 沒有這個屬性，會被忽略${COMMON.includes(k) ? '（全畫面特效、轉場與音訊沒有位置與濾鏡屬性）' : ''}`); continue; }
          const bad = checkValue(pd, v, project);
          if (bad) add(bad[0], `${where}.props.${k}`, bad[1]);
        }
        // The editor copies a preset's `d` values into props when the preset is picked; the runtime does not
        const table = presetTable(c.type);
        const presetName = table && ((c.props || {}).preset ?? byKey.preset.default);
        const preset = table && table[presetName];
        if (preset && preset.d) {
          const typeDefaults = P5M.defaultProps(c.type, project.settings);
          const missing = Object.keys(preset.d).filter((k) => !(k in (c.props || {})) && !(c.keys && c.keys[k]) && preset.d[k] !== typeDefaults[k]);
          if (missing.length) add('warn', where + '.props', `預設 ${presetName} 在編輯器會一併帶入 ${missing.map((k) => `"${k}": ${JSON.stringify(preset.d[k])}`).join(', ')}；手寫 JSON 沒寫時會用類型預設值，外觀可能不同`);
        }
        const off = +c.offset || 0;
        checkKeys(c.keys, lookup, off, off + (c.duration || 0), where, add);
        if (def.audio && c.keys && Object.keys(c.keys).length) add('warn', where + '.keys', '音訊圖層只取開始時的值，關鍵影格沒有作用');
        checkAnim(c, def, where, add);
      });
      const sorted = clips.filter((c) => typeof c.start === 'number' && c.duration > 0).slice().sort((a, b) => a.start - b.start);
      let a = sorted[0]; // the clip that ends latest so far, so one long clip is compared with every later one
      for (let i = 1; i < sorted.length; i++) {
        const b = sorted[i];
        if (b.start < a.start + a.duration - 1e-6) add('warn', tw, `${a.id || a.type} 與 ${b.id || b.type} 在同一軌時間重疊，時間軸上會疊在一起不好點選（編輯器自己不會這樣排），建議放到不同軌道`);
        if (b.start + b.duration > a.start + a.duration) a = b;
      }
    });
    return { errors, warnings };
  }

  // ---------- type reference (Markdown) ----------
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  function fmtDefault(pd) {
    if (pd.default === undefined) return '';
    if (typeof pd.default === 'function') return pd.default({ width: '畫布寬', height: '畫布高' });
    if (pd.type === 'code') return '（範例程式）';
    return '`' + JSON.stringify(pd.default) + '`';
  }
  function fmtNote(pd) {
    const out = [];
    if (pd.options) out.push(pd.options.map((o) => (Array.isArray(o) ? `\`${JSON.stringify(o[0])}\` ${o[1]}` : `\`${JSON.stringify(o)}\``)).join('、'));
    if (pd.min !== undefined && pd.max !== undefined) out.push(`範圍 ${pd.min} 到 ${pd.max}`);
    else if (pd.min !== undefined) out.push(`最小 ${pd.min}`);
    else if (pd.max !== undefined) out.push(`最大 ${pd.max}`);
    if (pd.accept) out.push(`填 assets 的 id（kind ${pd.accept}）`);
    if (pd.when) {
      const src = pd.when.toString();
      out.push(src.includes('.uses.') ? '只在所選預設用到時有作用（見預設清單的「用到」欄）' : '條件：`' + src.replace(/^\(pr\)\s*=>\s*/, '') + '`');
    }
    return out.join('；');
  }
  function propTable(props) {
    const rows = props.map((pd) => `| \`${pd.key}\` | ${cell(pd.label)}${pd.unit ? '（' + pd.unit + '）' : ''} | ${pd.type} | ${fmtDefault(pd)} | ${pd.anim ? '可' : ''} | ${cell(fmtNote(pd))} |`);
    return ['| 屬性 | 說明 | 型別 | 預設 | 關鍵影格 | 選項與備註 |', '|---|---|---|---|---|---|', ...rows].join('\n');
  }
  function presetList(title, table) {
    const rows = Object.entries(table).map(([k, v]) => `| \`${k}\` | ${v.label} | ${v.uses ? v.uses.join('、') : ''} | ${v.d ? '`' + cell(JSON.stringify(v.d)) + '`' : ''} |`);
    return [`### ${title}`, '', '| 值 | 名稱 | 用到 | 編輯器會一併帶入的屬性（手寫 JSON 請照抄） |', '|---|---|---|---|', ...rows].join('\n');
  }
  function animList(title, table) {
    const rows = Object.entries(table).map(([k, v]) => `| \`${k}\` | ${v.label} | ${v.dur ?? ''} | ${v.text ? '只限文字' : ''} |`);
    return [`### ${title}`, '', '| type | 名稱 | 預設秒數 | 備註 |', '|---|---|---|---|', ...rows].join('\n');
  }

  function typesMarkdown() {
    const types = Object.values(P5M.types);
    const anyVisual = types.find((d) => !d.screen && !d.audio);
    const common = anyVisual.props.filter((pd) => COMMON.includes(pd.key));
    const out = [
      '# 圖層類型參考',
      '',
      '> 由 `tools/check_project.py --types-md` 從 runtime registry 產生，不要手改。runtime 改版後重新產生。',
      '',
      '## 共用屬性（全畫面特效、轉場、音訊以外的圖層都有）',
      '',
      'x、y 預設是畫布中心；x、y 是圖層中心點的位置。',
      '',
      propTable(common),
    ];
    for (const d of types) {
      const kind = d.screen ? '全畫面（沒有位置與濾鏡屬性，入場／出場只影響透明度）' : d.audio ? '音訊（放在 kind "audio" 的軌道）' : '畫面圖層（另有上面的共用屬性）';
      out.push('', `## \`${d.name}\` ${d.label}`, '', kind, '', d.props.filter((pd) => !COMMON.includes(pd.key)).length ? propTable(d.props.filter((pd) => !COMMON.includes(pd.key))) : '（無額外屬性）');
    }
    out.push('', '## 預設值清單', '', presetList('粒子 `particles.preset`', P5M.particlePresets), '', presetList('生成藝術 `gen.preset`', P5M.genPresets));
    out.push('', '## 動畫預設（clip.anim）', '', animList('入場 `anim.in.type`', P5M.presets.IN), '', animList('出場 `anim.out.type`', P5M.presets.OUT), '', animList('循環 `anim.loop.type`（另可設 speed、amount，預設 1）', P5M.presets.LOOP));
    out.push('', '## 緩動（keys[].e）', '', Object.entries(P5M.EASE_LABELS).map(([k, v]) => `\`${k}\` ${v}`).join('、'));
    out.push('', '## 內建字型（text.font）', '', P5M.assets.FONTS.map((f) => `\`${f.family}\` ${f.label}`).join('、'), '');
    return out.join('\n');
  }

  window.CHECK = { validate, typesMarkdown };
})();
