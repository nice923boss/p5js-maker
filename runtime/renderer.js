// Project model helpers and the frame renderer: renderFrame(p, project, t) paints one frame as a pure function of t.
//
// project = {
//   format: 'p5maker', version: 1,
//   settings: { width, height, fps, duration, background, volume },
//   assets:   { [id]: { id, kind: 'image' | 'audio' | 'legacy', name, src, w?, h?, ... } },
//   camera:   { props: { x, y, zoom, rotation, shake }, keys: { [prop]: [{ t, v, e }] } },   // keys in project seconds
//   tracks:   [{ id, name, kind: 'visual' | 'audio', hidden, muted, locked, followCamera, clips: [clip] }],  // index 0 = top
// }
// clip = { id, type, name, start, duration, offset, props, keys, anim, blend }
(function () {
  const P5M = window.P5M;
  const { types, clamp, resolveProps, localTime, isActive, sampleKeys, noise, uid } = P5M;

  const CAMERA_DEFAULTS = (s) => ({ x: s.width / 2, y: s.height / 2, zoom: 1, rotation: 0, shake: 0 });

  function newProject(opts = {}) {
    const settings = { width: 1280, height: 720, fps: 30, duration: 10, background: '#101018', volume: 1, ...opts };
    return {
      format: 'p5maker', version: 1, settings, assets: {},
      camera: { props: CAMERA_DEFAULTS(settings), keys: {} },
      tracks: [
        { id: uid('tr'), name: '軌道 1', kind: 'visual', clips: [] },
        { id: uid('tr'), name: '音訊 1', kind: 'audio', clips: [] },
      ],
    };
  }

  // Fill missing fields so older or hand-written (Claude-made) JSON renders; returns a new object
  function normalizeProject(src) {
    const settings = { width: 1280, height: 720, fps: 30, duration: 10, background: '#101018', volume: 1, ...(src.settings || {}) };
    const tracks = (src.tracks || []).map((tr, i) => ({
      id: tr.id || uid('tr'), name: tr.name || '軌道 ' + (i + 1), kind: tr.kind === 'audio' ? 'audio' : 'visual',
      hidden: !!tr.hidden, muted: !!tr.muted, locked: !!tr.locked, followCamera: tr.followCamera !== false,
      clips: (tr.clips || []).map((c) => ({
        id: c.id || uid('c'), type: c.type, name: c.name || '', start: +c.start || 0, duration: Math.max(0.05, +c.duration || 1),
        offset: +c.offset || 0, props: { ...(c.props || {}) }, keys: { ...(c.keys || {}) }, anim: c.anim ? { ...c.anim } : {}, blend: c.blend || 'source-over',
      })),
    }));
    const cam = src.camera || {};
    const assets = {};
    for (const [id, a] of Object.entries(src.assets || {})) assets[id] = { ...a, name: a.name || id };
    return {
      format: 'p5maker', version: 1, title: src.title || '', settings, assets,
      camera: { props: { ...CAMERA_DEFAULTS(settings), ...(cam.props || {}) }, keys: { ...(cam.keys || {}) } },
      tracks,
    };
  }

  // Latest clip end across all tracks (the editor can extend settings.duration to this)
  function contentEnd(project) {
    let end = 0;
    for (const tr of project.tracks) for (const c of tr.clips) end = Math.max(end, c.start + c.duration);
    return end;
  }

  function cameraAt(project, t) {
    const cam = project.camera || { props: {}, keys: {} };
    const out = { ...CAMERA_DEFAULTS(project.settings), ...cam.props };
    for (const k in cam.keys) if (cam.keys[k] && cam.keys[k].length) out[k] = sampleKeys(cam.keys[k], t);
    return out;
  }

  function cameraMatrix(project, t) {
    const { width: W, height: H } = project.settings;
    const c = cameraAt(project, t);
    let sx = 0, sy = 0;
    if (c.shake > 0) { sx = (noise(t * 9, 0, 0, 7) - 0.5) * 2 * c.shake; sy = (noise(0, t * 9, 0, 11) - 0.5) * 2 * c.shake; }
    return new DOMMatrix().translate(W / 2, H / 2).scale(c.zoom).rotate(-c.rotation).translate(-c.x + sx, -c.y + sy);
  }

  function filterString(pr, extraBlur) {
    const parts = [];
    const blur = (pr.blur || 0) + (extraBlur || 0);
    if (blur > 0.05) parts.push(`blur(${blur.toFixed(2)}px)`);
    if (pr.brightness !== undefined && pr.brightness !== 1) parts.push(`brightness(${pr.brightness})`);
    if (pr.contrast !== undefined && pr.contrast !== 1) parts.push(`contrast(${pr.contrast})`);
    if (pr.saturate !== undefined && pr.saturate !== 1) parts.push(`saturate(${pr.saturate})`);
    if (pr.hue) parts.push(`hue-rotate(${pr.hue}deg)`);
    return parts.length ? parts.join(' ') : 'none';
  }

  function clipReveal(ctx, rv, b) {
    const p = clamp(rv.p, 0, 1);
    ctx.beginPath();
    if (rv.dir === 'iris') ctx.arc(0, 0, Math.hypot(b.w, b.h) / 2 * p, 0, Math.PI * 2);
    else if (rv.dir === 'left') ctx.rect(b.w / 2 - b.w * p, -b.h / 2, b.w * p, b.h);
    else ctx.rect(-b.w / 2, -b.h / 2, b.w * p, b.h);
    ctx.clip();
  }

  const warned = new Set();
  function drawClip(p, def, pr, env) {
    try { def.draw.call(def, p, pr, env); } catch (err) {
      if (!warned.has(env.clip.id)) { warned.add(env.clip.id); console.error('圖層繪製失敗', env.clip.type, env.clip.id, err); }
    }
  }

  // Chrome spends several ms per draw call while ctx.filter is set, so a clip that draws many shapes under a blur
  // (particles, clouds, per-glyph text) took 200-900 ms a frame. Such clips are painted unfiltered into a
  // frame-sized scratch canvas, then composited once with the filter and the clip's blend mode. Alpha is applied
  // per shape inside the layer, as on the direct path, so overlaps look the same when the filter turns off.
  let layer = null;
  function drawFiltered(p, def, pr, env, filter, reveal, b) {
    const ctx = p.drawingContext, r = p._renderer;
    const c = layer || (layer = document.createElement('canvas'));
    if (c.width !== ctx.canvas.width || c.height !== ctx.canvas.height) { c.width = ctx.canvas.width; c.height = ctx.canvas.height; }
    const lc = c.getContext('2d');
    lc.save();
    lc.clearRect(0, 0, c.width, c.height);
    lc.setTransform(ctx.getTransform());
    lc.globalAlpha = ctx.globalAlpha;
    if (reveal) clipReveal(ctx, reveal, b); // on ctx, so the filtered result is clipped as before
    // types draw through p.drawingContext, and p5 calls (code clips) through the renderer: point both at the layer
    const cached = [r._cachedFillStyle, r._cachedStrokeStyle];
    p.drawingContext = r.drawingContext = lc;
    r._cachedFillStyle = r._cachedStrokeStyle = undefined;
    try { drawClip(p, def, pr, env); } finally {
      p.drawingContext = r.drawingContext = ctx;
      [r._cachedFillStyle, r._cachedStrokeStyle] = cached;
    }
    // aurora and fireworks switch to 'lighter' themselves; composite the layer the same way so they still add up
    const op = lc.globalCompositeOperation;
    lc.restore();
    if (op !== 'source-over') ctx.globalCompositeOperation = op;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = filter;
    ctx.drawImage(c, 0, 0);
  }

  // Paints the frame at project time t. Returns hit boxes for visual clips, top-most last:
  // [{ clipId, trackId, m: DOMMatrix (props transform, before in/out animation), w, h }]
  function renderFrame(p, project, t, opts = {}) {
    const { width: W, height: H, background } = project.settings;
    const ctx = p.drawingContext;
    const hits = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    if (background && background !== 'transparent') { ctx.fillStyle = P5M.rgba(background); ctx.fillRect(0, 0, W, H); }
    const cam = cameraMatrix(project, t);
    const ident = new DOMMatrix();

    for (let ti = project.tracks.length - 1; ti >= 0; ti--) {
      const tr = project.tracks[ti];
      if (tr.kind === 'audio' || tr.hidden) continue;
      if (opts.solo && opts.solo !== tr.id) continue;
      for (const clip of tr.clips) {
        if (!isActive(clip, t)) continue;
        const def = types[clip.type];
        if (!def || def.audio) continue;
        const lt = localTime(clip, t);
        const pr = resolveProps(clip, lt, project.settings);
        const st = P5M.animState(clip, t, { W, H });
        const env = { W, H, lt, t, st, clip, project, sx: 1, sy: 1 };

        p.push();
        if (def.screen) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          drawClip(p, def, pr, env);
          p.pop();
          continue;
        }
        const base = tr.followCamera === false ? ident : cam;
        const m = base.translate(pr.x, pr.y).rotate(pr.rotation || 0).scale(pr.scale ?? 1);
        const b = def.bounds ? def.bounds.call(def, pr, env) : null;
        if (b) hits.push({ clipId: clip.id, trackId: tr.id, m, w: b.w, h: b.h });

        const alpha = clamp(pr.opacity ?? 1, 0, 1) * st.alpha;
        const fm = base.translate(pr.x + st.dx, pr.y + st.dy).rotate((pr.rotation || 0) + st.rot).scale((pr.scale ?? 1) * st.sx, (pr.scale ?? 1) * st.sy);
        if (alpha <= 0.001 || Math.abs(fm.a * fm.d - fm.b * fm.c) < 1e-9) { p.pop(); continue; }
        ctx.setTransform(fm);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = clip.blend || 'source-over';
        env.sx = Math.hypot(fm.a, fm.b);
        env.sy = Math.hypot(fm.c, fm.d);
        const filter = filterString(pr, st.blur);
        const reveal = st.reveal && b ? st.reveal : null;
        if (filter !== 'none') drawFiltered(p, def, pr, env, filter, reveal, b);
        else {
          ctx.filter = 'none';
          if (reveal) clipReveal(ctx, reveal, b);
          drawClip(p, def, pr, env);
        }
        p.pop();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    return hits;
  }

  // Everything a p5 instance needs before the first frame: fonts, images, legacy iframes, 3D shaders
  async function prepare(p, project) {
    await P5M.assets.prepare(project);
    const has3d = project.tracks.some((tr) => tr.clips.some((c) => c.type === 'shape3d'));
    if (has3d && P5M.warm3d) P5M.warm3d(p, project.settings.width, project.settings.height);
  }

  Object.assign(P5M, { newProject, normalizeProject, contentEnd, cameraAt, cameraMatrix, renderFrame, prepare });
})();
