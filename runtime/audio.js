// Audio clip types (music score, synth sound effect, audio file) and the playback engine.
// Each play() builds a fresh AudioContext and schedules every audible clip against it; stop() closes it.
// Project time T maps to context time: ctxStart + (T - fromT).
(function () {
  const P5M = window.P5M;
  const { registerType, hash, clamp } = P5M;
  const V = P5M.voices;

  // ---------- mood presets -> generated SCORE (same shape as legacy sound.js scores) ----------
  const MOODS = {
    warm: { label: '溫馨', bpm: 84, bpc: 4, density: 0.55, chords: { F: [53, 57, 60], C: [48, 52, 55], Dm: [50, 53, 57], Bb: [46, 50, 53] },
      prog: ['F', 'C', 'Dm', 'Bb'], scale: [65, 67, 69, 72, 74, 77, 79, 81] },
    festive: { label: '喜慶', bpm: 108, bpc: 4, density: 0.8, chime: 4, chords: { C: [48, 52, 55], Am: [45, 48, 52], F: [41, 45, 48], G: [43, 47, 50] },
      prog: ['C', 'Am', 'F', 'G'], scale: [72, 74, 76, 79, 81, 84, 86, 88] },
    calm: { label: '寧靜', bpm: 66, bpc: 8, density: 0.22, chords: { D: [50, 54, 57], Bm: [47, 50, 54], G: [43, 47, 50], A: [45, 49, 52] },
      prog: ['D', 'Bm', 'G', 'A'], scale: [74, 76, 78, 81, 83, 86] },
    romantic: { label: '浪漫', bpm: 78, bpc: 4, density: 0.45, chords: { Fmaj7: [53, 57, 60, 64], Em7: [52, 55, 59, 62], Dm7: [50, 53, 57, 60], Cmaj7: [48, 52, 55, 59] },
      prog: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], scale: [72, 74, 76, 77, 79, 81, 84] },
    happy: { label: '歡樂', bpm: 124, bpc: 4, density: 0.9, chords: { C: [48, 52, 55], G: [43, 47, 50], Am: [45, 48, 52], F: [41, 45, 48] },
      prog: ['C', 'G', 'Am', 'F'], scale: [72, 74, 76, 79, 81, 84] },
    mystery: { label: '神秘', bpm: 72, bpc: 4, density: 0.35, chords: { Am: [45, 48, 52], F: [41, 45, 48], Dm: [50, 53, 57], E: [40, 44, 47] },
      prog: ['Am', 'F', 'Dm', 'E'], scale: [69, 71, 72, 74, 76, 77, 80, 81] },
  };

  const scoreCache = new Map();
  function moodScore(name, seconds, seed = 1) {
    const m = MOODS[name] || MOODS.warm;
    const beat = 60 / m.bpm;
    const nChords = Math.max(1, Math.ceil(seconds / (m.bpc * beat)));
    const key = name + '|' + nChords + '|' + seed;
    if (scoreCache.has(key)) return scoreCache.get(key);
    const progression = [...Array(nChords)].map((_, i) => m.prog[i % m.prog.length]);
    const melody = [];
    let idx = Math.floor(m.scale.length / 2);
    for (let b = 0; b < nChords * m.bpc; b++) {
      const strong = b % m.bpc === 0;
      if (hash(b, seed) < m.density * (strong ? 1.2 : 0.75)) {
        idx = clamp(idx + Math.round((hash(b + 500, seed) - 0.5) * 4), 0, m.scale.length - 1);
        melody.push([b, m.scale[idx], strong ? 2 : 1]);
      }
      if (m.density > 0.7 && hash(b + 900, seed) < m.density - 0.5) {
        const j = clamp(idx + (hash(b + 1300, seed) < 0.5 ? 1 : -1), 0, m.scale.length - 1);
        melody.push([b + 0.5, m.scale[j], 0.5]);
      }
    }
    const cues = [[0, 'shimmer', 2, 0.02]];
    if (m.chime) for (let c = 0; c < nChords; c += m.chime) cues.push([c * m.bpc * beat, 'chime', 0.05]);
    const score = { bpm: m.bpm, beatsPerChord: m.bpc, chords: m.chords, progression, melody, cues };
    scoreCache.set(key, score);
    return score;
  }

  // ---------- sound effect catalogue: default clip length and how clip props map to voice args ----------
  // Volume is applied by the clip lane, so args carry only the voice's own base level.
  const SFX = {
    pop: { label: '啵', dur: 0.3, args: () => [] },
    thud: { label: '咚（敲擊）', dur: 0.4, args: (pr) => [0.4, pr.pitch] },
    chime: { label: '叮（鈴聲）', dur: 2.5, music: true, args: () => [] },
    glissando: { label: '上行琶音', dur: 1, music: true, args: () => [] },
    shimmer: { label: '閃亮音', dur: 2, music: true, args: (pr, len) => [len] },
    pluck: { label: '撥弦單音', dur: 1.5, music: true, args: (pr, len) => [pr.note, len] },
    whoosh: { label: '咻（風聲）', dur: 0.6, args: (pr, len) => [len, pr.up] },
    strike: { label: '擦火柴', dur: 0.4, args: () => [] },
    meow: { label: '貓叫', dur: 0.8, args: (pr, len) => [pr.pitch, Math.min(len, 3)] },
    purr: { label: '呼嚕', dur: 3, args: (pr, len) => [len] },
    sniff: { label: '嗅聞', dur: 0.6, args: (pr) => [Math.max(1, Math.round(pr.count))] },
    crickets: { label: '蟲鳴', dur: 6, args: (pr, len) => [len] },
    sizzle: { label: '滋滋聲', dur: 4, args: (pr, len) => [Math.max(len, 1.6)] },
    crackle: { label: '劈啪（鞭炮）', dur: 3, args: (pr, len) => [len, pr.density] },
    roll: { label: '滾動隆隆', dur: 1.5, args: (pr, len) => [len] },
  };
  // Continuous textures that can start mid-way when playback begins inside the clip
  const RESUMABLE = new Set(['shimmer', 'purr', 'crickets', 'sizzle', 'crackle', 'roll']);

  const volumeProp = { key: 'volume', label: '音量', type: 'range', min: 0, max: 2, step: 0.01, default: 1, group: 'main' };
  const fadeInProp = { key: 'fadeIn', label: '淡入（秒）', type: 'number', min: 0, step: 0.1, default: 0, group: 'main' };
  const fadeOutProp = { key: 'fadeOut', label: '淡出（秒）', type: 'number', min: 0, step: 0.1, default: 0, group: 'main' };

  registerType('music', {
    label: '配樂', category: 'audio', audio: true,
    props: [
      { key: 'preset', label: '曲風', type: 'select', default: 'warm', group: 'main',
        options: [...Object.entries(MOODS).map(([k, v]) => [k, v.label]), ['score', '匯入的樂譜']] },
      { key: 'seed', label: '旋律變化', type: 'number', step: 1, default: 1, group: 'main', when: (pr) => pr.preset !== 'score' },
      { ...volumeProp, default: 0.8 }, fadeInProp, { ...fadeOutProp, default: 1.5 },
    ],
    schedule(eng, clip, pr, lane) {
      const score = pr.preset === 'score' ? pr.score : moodScore(pr.preset, (clip.offset || 0) + clip.duration, pr.seed);
      if (score) scheduleScore(eng, clip, score, lane);
    },
  });

  registerType('sfx', {
    label: '音效', category: 'audio', audio: true,
    props: [
      { key: 'voice', label: '音效', type: 'select', default: 'pop', group: 'main', options: Object.entries(SFX).map(([k, v]) => [k, v.label]) },
      { key: 'pitch', label: '音高', type: 'range', min: 0.4, max: 2.5, step: 0.01, default: 1, group: 'main', when: (pr) => pr.voice === 'meow' || pr.voice === 'thud' },
      { key: 'note', label: '音符（MIDI）', type: 'number', min: 24, max: 108, step: 1, default: 72, group: 'main', when: (pr) => pr.voice === 'pluck' },
      { key: 'up', label: '上升', type: 'bool', default: true, group: 'main', when: (pr) => pr.voice === 'whoosh' },
      { key: 'count', label: '次數', type: 'number', min: 1, max: 12, step: 1, default: 3, group: 'main', when: (pr) => pr.voice === 'sniff' },
      { key: 'density', label: '密度（次/秒）', type: 'number', min: 0.5, max: 40, step: 0.5, default: 6, group: 'main', when: (pr) => pr.voice === 'crackle' },
      volumeProp,
    ],
    schedule(eng, clip, pr, lane) {
      const sfx = SFX[pr.voice];
      if (!sfx) return;
      const T0 = clip.start - (clip.offset || 0); // when the sound itself begins
      const from = Math.max(clip.start, eng.fromT); // audible window is [start, start + duration) only
      if (T0 < from && !RESUMABLE.has(pr.voice)) return;
      const at = Math.max(T0, from), len = clip.start + clip.duration - at;
      if (len < 0.1) return;
      V.VOICES[pr.voice](eng.ctx, sfx.music ? lane.music : lane.sfx, eng.time(at), ...sfx.args(pr, len));
    },
  });

  registerType('audiofile', {
    label: '音訊檔', category: 'audio', audio: true,
    props: [{ key: 'asset', label: '音訊', type: 'asset', accept: 'audio', group: 'main' }, volumeProp, fadeInProp, fadeOutProp],
    schedule(eng, clip, pr, lane) {
      const buf = eng.buffers.get(pr.asset);
      if (!buf) return;
      const skip = Math.max(0, eng.fromT - clip.start);
      const offset = (clip.offset || 0) + skip;
      const len = clip.duration - skip;
      if (len <= 0.01 || offset >= buf.duration) return;
      const src = eng.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(lane.sfx);
      src.start(eng.time(clip.start + skip), offset, len);
    },
  });

  // Score time st maps to project time clip.start + (st - offset); only [offset, offset + duration) is audible
  function scheduleScore(eng, clip, score, lane) {
    const { ctx } = eng;
    const beat = 60 / score.bpm, bpc = score.beatsPerChord || 4;
    const a = clip.offset || 0, b = a + clip.duration;
    const proj = (st) => clip.start + (st - a);
    const due = (st) => st >= a - 0.05 && st < b && proj(st) >= eng.fromT - 0.02;
    (score.progression || []).forEach((name, i) => {
      const st = i * bpc * beat, len = bpc * beat, notes = score.chords[name];
      if (!notes || st >= b || st + len <= a) return;
      const T = Math.max(proj(st), eng.fromT);
      const remain = proj(st) + len - T;
      if (remain > 0.3) V.pad(ctx, lane.music, eng.time(T), notes, remain);
    });
    (score.melody || []).forEach(([bt, midi, dur]) => {
      const st = bt * beat;
      if (due(st)) V.VOICES.pluck(ctx, lane.music, eng.time(proj(st)), midi, dur * beat);
    });
    (score.cues || []).forEach(([sec, voice, ...args]) => {
      const fn = V.VOICES[voice];
      if (!fn) { console.warn('未知的音效名稱：' + voice); return; }
      if (due(sec)) fn(ctx, V.MUSIC_VOICES.has(voice) ? lane.music : lane.sfx, eng.time(proj(sec)), ...args);
    });
    // legacy SCORE.fadeOut faded the whole master in sound.js; here it fades this clip's lanes
    if (score.fadeOut) for (const g of lane.fades) automate(eng, g, [[proj(score.fadeOut[0]), 1], [proj(score.fadeOut[1]), 0]]);
  }

  // Piecewise-linear automation in project time, starting from its value at the play head
  function automate(eng, param, points) {
    const valueAt = (T) => {
      if (T <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        const [t1, v1] = points[i], [t0, v0] = points[i - 1];
        if (T <= t1) return t1 > t0 ? v0 + ((v1 - v0) * (T - t0)) / (t1 - t0) : v1;
      }
      return points[points.length - 1][1];
    };
    param.setValueAtTime(valueAt(eng.fromT), eng.ctxStart);
    for (const [T, v] of points) if (T > eng.fromT) param.linearRampToValueAtTime(v, eng.time(T));
  }

  // Two lanes per clip (music -> music bus, sfx -> sfx bus), each gated by the clip's volume and fades
  // and hard-cut at the clip edges; `fades` are extra gains for a legacy score's fadeOut.
  function clipLanes(eng, clip, pr, musicBus, sfxBus) {
    const vol = pr.volume ?? 1;
    const s = clip.start, e = clip.start + clip.duration;
    const fi = Math.max(0.005, Math.min(pr.fadeIn || 0, clip.duration / 2));
    const fo = Math.max(0.005, Math.min(pr.fadeOut || 0, clip.duration / 2));
    const envelope = [[s, 0], [s + fi, vol], [e - fo, vol], [e, 0]];
    const lane = (dest) => {
      const gate = eng.ctx.createGain(), fade = eng.ctx.createGain();
      gate.connect(fade).connect(dest);
      automate(eng, gate.gain, envelope);
      return { gate, fade: fade.gain };
    };
    const m = lane(musicBus), x = lane(sfxBus);
    return { music: m.gate, sfx: x.gate, fades: [m.fade, x.fade] };
  }

  // ---------- engine ----------
  const engine = {
    session: null,

    // Plays every unmuted audio track from project time fromT. opts.record adds a MediaStream output (session.stream).
    async play(project, fromT, opts = {}) {
      engine.stop();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Freeze the clock while scheduling (can take a few hundred ms) so the first notes are not late
      const hold = ctx.suspend().catch(() => {});
      const eng = {
        ctx, fromT, ctxStart: ctx.currentTime + 0.12, perf0: performance.now(), buffers: new Map(), stream: null,
        time(T) { return Math.max(0, this.ctxStart + (T - fromT)); },
        // Current project time; falls back to the wall clock when the context is not running (autoplay blocked)
        now() {
          if (ctx.state === 'running') return fromT + Math.max(0, ctx.currentTime - this.ctxStart);
          return fromT + Math.max(0, (performance.now() - this.perf0) / 1000 - 0.12);
        },
        stop() { if (ctx.state !== 'closed') ctx.close().catch(() => {}); },
      };
      engine.session = eng;

      const master = ctx.createGain();
      master.gain.value = project.settings.volume ?? 1;
      master.connect(ctx.destination);
      if (opts.record) {
        const dest = ctx.createMediaStreamDestination();
        master.connect(dest);
        eng.stream = dest.stream;
      }
      // routing from sound.js: music bus fully into reverb, sfx with a 25% send
      const reverb = V.makeReverb(ctx);
      const wet = ctx.createGain(); wet.gain.value = 0.35;
      reverb.connect(wet).connect(master);
      const musicBus = ctx.createGain(); musicBus.gain.value = 0.8;
      musicBus.connect(master); musicBus.connect(reverb);
      const sfxBus = ctx.createGain(); sfxBus.connect(master);
      const send = ctx.createGain(); send.gain.value = 0.25;
      sfxBus.connect(send).connect(reverb);

      const clips = [];
      for (const tr of project.tracks) {
        if (tr.kind !== 'audio' || tr.muted) continue;
        for (const c of tr.clips) {
          const def = P5M.types[c.type];
          if (def && def.schedule && c.start + c.duration > fromT) clips.push(c);
        }
      }
      await Promise.all(clips.filter((c) => c.type === 'audiofile' && c.props.asset).map(async (c) => {
        const buf = await P5M.assets.audioBuffer(project.assets[c.props.asset]);
        if (buf) eng.buffers.set(c.props.asset, buf);
      }));
      if (engine.session !== eng) return eng; // stopped or restarted while decoding
      for (const c of clips) {
        const pr = P5M.resolveProps(c, 0, project.settings);
        try { P5M.types[c.type].schedule(eng, c, pr, clipLanes(eng, c, pr, musicBus, sfxBus)); }
        catch (err) { console.error('音訊排程失敗', c.type, c.id, err); }
      }
      await hold;
      if (engine.session !== eng) return eng;
      eng.perf0 = performance.now();
      ctx.resume().catch(() => {}); // not awaited: stays pending forever when autoplay is blocked
      return eng;
    },

    stop() {
      if (engine.session) { engine.session.stop(); engine.session = null; }
    },

    // Audition one audio clip from its beginning (library click, inspector preview)
    preview(clip, project) {
      const mini = { settings: project.settings, assets: project.assets, tracks: [{ kind: 'audio', clips: [{ ...clip, start: 0 }] }] };
      return engine.play(mini, 0);
    },
  };

  P5M.audio = engine;
  P5M.music = { MOODS, moodScore };
  P5M.sfxCatalog = SFX;
})();
