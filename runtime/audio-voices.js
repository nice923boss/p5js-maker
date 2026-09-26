// Synth voices ported from the p5-comfyui-animation sound.js kit so legacy SCORE objects play unchanged.
// Every voice: (ctx, destinationNode, startTime, ...args)
(function () {
  const P5M = window.P5M;

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function makeReverb(ctx, seconds = 2.6) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function envGain(ctx, dest, t, attack, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function noiseSource(ctx, t, len) {
    if (!ctx._noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ctx._noise = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = ctx._noise;
    src.loop = true;
    src.start(t, Math.random() * 1.5);
    src.stop(t + len + 0.1);
    return src;
  }

  function biquad(ctx, type, freq, q = 1) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  // ---------- tonal voices ----------
  function pluck(ctx, bus, t, midi, durSec = 1, vol = 0.22) {
    const f = midiToHz(midi);
    const decay = Math.max(1.2, durSec * 1.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + decay);
    const g = envGain(ctx, lp, t, 0.005, vol, decay);
    lp.connect(bus);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([mult, type, amp]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
  }

  function pad(ctx, bus, t, notes, len, vol = 0.045) {
    notes.forEach((m) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midiToHz(m);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.9);
      g.gain.setValueAtTime(vol, t + len - 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + len + 0.5);
    });
  }

  function chime(ctx, bus, t, vol = 0.08) {
    [1568, 2349, 3136].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(envGain(ctx, bus, t + i * 0.06, 0.004, vol / (i + 1), 2.2));
      o.start(t + i * 0.06);
      o.stop(t + 2.5);
    });
  }

  function glissando(ctx, bus, t, notes = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81], step = 0.045, vol = 0.1) {
    notes.forEach((m, i) => pluck(ctx, bus, t + i * step, m, 0.6, vol));
  }

  function shimmer(ctx, bus, t, len = 2, vol = 0.03) {
    for (let i = 0; i < 14; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2000 + Math.random() * 3000;
      const s = t + (i / 14) * len * 0.7;
      o.connect(envGain(ctx, bus, s, 0.01, vol, 0.5));
      o.start(s);
      o.stop(s + 0.6);
    }
  }

  function pop(ctx, bus, t, vol = 0.16) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.07);
    o.connect(envGain(ctx, bus, t, 0.004, vol, 0.12));
    o.start(t);
    o.stop(t + 0.2);
  }

  function thud(ctx, bus, t, vol = 0.4, pitch = 1) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(80 * pitch, t + 0.12);
    o.connect(envGain(ctx, bus, t, 0.003, vol, 0.18));
    o.start(t);
    o.stop(t + 0.25);
    const n = noiseSource(ctx, t, 0.06);
    n.connect(biquad(ctx, 'bandpass', 1400 * pitch, 3)).connect(envGain(ctx, bus, t, 0.002, vol * 0.5, 0.04));
  }

  // ---------- creature voices ----------
  function meow(ctx, dest, t, pitch = 1, dur = 0.75) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(430 * pitch, t);
    o.frequency.linearRampToValueAtTime(820 * pitch, t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(700 * pitch, t + dur * 0.6);
    o.frequency.linearRampToValueAtTime(420 * pitch, t + dur);
    const vib = ctx.createOscillator();
    const vibAmt = ctx.createGain();
    vib.frequency.value = 7;
    vibAmt.gain.value = 14 * pitch;
    vib.connect(vibAmt).connect(o.frequency);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 2.5;
    formant.frequency.setValueAtTime(800, t);
    formant.frequency.linearRampToValueAtTime(1700, t + dur * 0.35);
    formant.frequency.linearRampToValueAtTime(950, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
    g.gain.setValueAtTime(0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(formant).connect(g).connect(dest);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  function purr(ctx, dest, t, len = 3) {
    const src = noiseSource(ctx, t, len);
    const flutter = ctx.createGain();
    flutter.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 25;
    lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt).connect(flutter.gain);
    const breath = ctx.createGain();
    breath.gain.setValueAtTime(0.0001, t);
    for (let s = t; s < t + len; s += 1.6) {
      breath.gain.linearRampToValueAtTime(0.9, s + 0.72);
      breath.gain.linearRampToValueAtTime(0.25, s + 1.6);
    }
    breath.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(biquad(ctx, 'lowpass', 260)).connect(flutter).connect(breath).connect(dest);
    lfo.start(t);
    lfo.stop(t + len + 0.1);
  }

  function sniff(ctx, dest, t, count = 3, vol = 0.25) {
    for (let i = 0; i < count; i++) {
      const s = t + i * 0.16;
      noiseSource(ctx, s, 0.12).connect(biquad(ctx, 'bandpass', 2600, 2))
        .connect(envGain(ctx, dest, s, 0.02, vol, 0.08));
    }
  }

  function crickets(ctx, dest, t, len = 10, vol = 0.02) {
    for (let s = t; s < t + len; s += 0.8 + Math.random() * 0.5) {
      for (let k = 0; k < 3; k++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 4300;
        const p = s + k * 0.055;
        o.connect(envGain(ctx, dest, p, 0.004, vol, 0.035));
        o.start(p);
        o.stop(p + 0.05);
      }
    }
  }

  // ---------- noise effects ----------
  function whoosh(ctx, dest, t, dur = 0.6, up = true, vol = 0.25) {
    const bp = biquad(ctx, 'bandpass', up ? 400 : 3000, 1.5);
    bp.frequency.exponentialRampToValueAtTime(up ? 3000 : 400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    noiseSource(ctx, t, dur).connect(bp).connect(g).connect(dest);
  }

  function strike(ctx, dest, t, vol = 0.3) {
    const bp = biquad(ctx, 'bandpass', 5000, 1.2);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.25);
    noiseSource(ctx, t, 0.3).connect(bp).connect(envGain(ctx, dest, t, 0.005, vol, 0.25));
  }

  function sizzle(ctx, dest, t, len = 5, vol = 0.05) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.8);
    g.gain.setValueAtTime(vol, t + len - 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    noiseSource(ctx, t, len).connect(biquad(ctx, 'highpass', 3500)).connect(g).connect(dest);
  }

  function crackle(ctx, dest, t, len = 3, density = 6, vol = 0.18) {
    const n = Math.floor(len * density);
    for (let i = 0; i < n; i++) {
      const s = t + Math.random() * len;
      const a = vol * (0.3 + Math.random() * 0.7);
      noiseSource(ctx, s, 0.03).connect(biquad(ctx, 'bandpass', 1500 + Math.random() * 2500, 2))
        .connect(envGain(ctx, dest, s, 0.001, a, 0.02 + Math.random() * 0.03));
    }
  }

  function roll(ctx, dest, t, len = 1.5, vol = 0.3) {
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 9;
    lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt).connect(am.gain);
    lfo.start(t);
    lfo.stop(t + len + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.2);
    g.gain.setValueAtTime(vol, t + len * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    noiseSource(ctx, t, len).connect(biquad(ctx, 'lowpass', 380)).connect(am).connect(g).connect(dest);
  }

  P5M.voices = {
    midiToHz, makeReverb, envGain, noiseSource, biquad, pad,
    VOICES: { pluck, chime, glissando, shimmer, pop, thud, meow, purr, sniff, crickets, whoosh, strike, sizzle, crackle, roll },
    MUSIC_VOICES: new Set(['pluck', 'chime', 'glissando', 'shimmer']),
  };
})();
