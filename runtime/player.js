// Standalone player for an exported project HTML.
// Reads <script type="application/json" id="p5maker-project">, renders with P5M.renderFrame, plays audio with P5M.audio.
// URL options: ?t=12.5 renders that frame frozen with no UI (baseline screenshots); ?autoplay=1 starts muted-safe playback.
(function () {
  const P5M = window.P5M;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const frozenT = params.has('t') ? parseFloat(params.get('t')) : null;

  const raw = $('p5maker-project');
  const project = P5M.normalizeProject(JSON.parse(raw.textContent));
  const { width: W, height: H, duration } = project.settings;

  const api = { project, t: 0, playing: false, frameReady: false, ready: null, seek, play, pause, render: null };
  window.P5M_PLAYER = api;

  const stageEl = $('p5m-stage');
  let pInst = null;
  let session = null;
  let raf = 0;
  let exporting = false;

  function render(t) {
    api.t = t;
    P5M.renderFrame(pInst, project, t);
    const bar = $('p5m-seek');
    if (bar && !bar.matches(':active')) bar.value = String(t);
    const lbl = $('p5m-time');
    if (lbl) lbl.textContent = P5M.fmtTime(t) + ' / ' + P5M.fmtTime(duration);
  }
  api.render = render;

  function loop() {
    if (!api.playing) return;
    const t = session ? session.now() : api.t;
    if (t >= duration) { render(duration); pause(); showOverlay('重新播放'); api.t = 0; return; }
    render(t);
    raf = requestAnimationFrame(loop);
  }

  async function play() {
    if (api.playing || exporting) return;
    hideOverlay();
    api.playing = true;
    setPlayIcon();
    session = await P5M.audio.play(project, api.t >= duration ? 0 : api.t);
    if (!api.playing) { P5M.audio.stop(); return; }
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    api.playing = false;
    cancelAnimationFrame(raf);
    if (session) { api.t = Math.min(session.now(), duration); session = null; }
    P5M.audio.stop();
    setPlayIcon();
  }

  function seek(t) {
    const wasPlaying = api.playing;
    if (wasPlaying) pause();
    render(P5M.clamp(t, 0, duration));
    if (wasPlaying) play();
  }

  // ---------- UI ----------
  function setPlayIcon() { const b = $('p5m-play'); if (b) b.textContent = api.playing ? '❚❚' : '▶'; }
  function showOverlay(label) { const o = $('p5m-overlay'); o.querySelector('span').textContent = label; o.hidden = false; }
  function hideOverlay() { $('p5m-overlay').hidden = true; }
  function setStatus(msg) { const s = $('p5m-status'); s.textContent = msg || ''; s.hidden = !msg; }

  async function exportVideo() {
    if (exporting) return;
    pause();
    exporting = true;
    document.body.classList.add('p5m-exporting');
    try {
      const res = await P5M.recorder.recordVideo({
        canvas: pInst.canvas, project, from: 0, to: duration, render,
        onProgress: (p) => setStatus('錄製中 ' + Math.round(p * 100) + '%（請保持此分頁在前景）'),
      });
      const name = (document.title || 'animation').replace(/[\\/:*?"<>|]/g, '_') + '.' + res.ext;
      P5M.recorder.downloadBlob(res.blob, name);
      setStatus('已下載 ' + name);
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      console.error('匯出影片失敗', err);
      setStatus('匯出失敗：' + err.message);
    } finally {
      exporting = false;
      document.body.classList.remove('p5m-exporting');
      render(0);
      showOverlay('播放');
    }
  }

  function bindUI() {
    const bar = $('p5m-seek');
    bar.max = String(duration);
    bar.step = String(1 / (project.settings.fps || 30));
    bar.addEventListener('input', () => { if (api.playing) pause(); render(parseFloat(bar.value)); });
    $('p5m-play').addEventListener('click', () => (api.playing ? pause() : play()));
    $('p5m-overlay').addEventListener('click', play);
    $('p5m-export').addEventListener('click', exportVideo);
    $('p5m-full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); api.playing ? pause() : play(); }
    });
    let idle = 0;
    document.addEventListener('pointermove', () => {
      document.body.classList.remove('p5m-idle');
      clearTimeout(idle);
      idle = setTimeout(() => { if (api.playing) document.body.classList.add('p5m-idle'); }, 2200);
    });
  }

  api.ready = new Promise((resolve) => {
    pInst = new p5((p) => {
      p.setup = async () => {
        pInst = p; // p5 may run setup inside its constructor, before the assignment below returns
        p.pixelDensity(1);
        p.createCanvas(W, H);
        p.noLoop();
        P5M.assets.onReady = () => { if (!api.playing && !exporting) render(api.t); };
        setStatus('載入中…');
        await P5M.prepare(p, project);
        setStatus('');
        if (frozenT !== null) {
          document.body.classList.add('p5m-frozen');
          render(P5M.clamp(frozenT, 0, duration));
          api.frameReady = true;
          document.body.dataset.ready = '1';
        } else {
          bindUI();
          render(0);
          if (params.get('autoplay') === '1') play(); else showOverlay('播放');
        }
        resolve(api);
      };
    }, stageEl);
  });
})();
