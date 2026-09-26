// Real-time video export: plays the project once while MediaRecorder captures the canvas and the audio engine output.
// Same approach as the legacy engine.js exportVideo (MP4 on Chrome/Edge 130+, WebM fallback).
(function () {
  const P5M = window.P5M;

  const VIDEO_TYPES = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1,opus',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];

  function pickType() {
    if (typeof MediaRecorder === 'undefined') return null;
    return VIDEO_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  // opts: { canvas, project, from, to, render(t), onProgress(p), signal (AbortSignal) }
  // Resolves { blob, type, ext }. The caller must pause its own draw loop while this runs.
  async function recordVideo(opts) {
    const type = pickType();
    if (!type) throw new Error('此瀏覽器不支援影片錄製（請改用 Chrome 或 Edge）');
    const { canvas, project, render, onProgress, signal } = opts;
    const from = opts.from || 0;
    const to = opts.to ?? project.settings.duration;
    const fps = project.settings.fps || 30;

    const session = await P5M.audio.play(project, from, { record: true });
    const tracks = [...canvas.captureStream(fps).getVideoTracks()];
    if (session.stream) tracks.push(...session.stream.getAudioTracks());
    const stream = new MediaStream(tracks);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) => reject(e.error || new Error('錄製失敗'));
    });
    render(from);
    recorder.start(1000);

    // Timer-driven, not rAF: rAF stops when the window is covered, timers keep running while the tab is visible
    let aborted = false;
    await new Promise((resolve) => {
      const tick = () => {
        if (signal && signal.aborted) { aborted = true; resolve(); return; }
        const t = Math.min(session.now(), to);
        render(t);
        if (onProgress) onProgress((t - from) / Math.max(0.001, to - from));
        if (t >= to) setTimeout(resolve, 300); // short tail so the last frame lands
        else setTimeout(tick, 1000 / fps);
      };
      tick();
    });
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    P5M.audio.stop();
    if (aborted) return null;
    return { blob: new Blob(chunks, { type: type.split(';')[0] }), type, ext: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  P5M.recorder = { VIDEO_TYPES, pickType, recordVideo, downloadBlob };
})();
