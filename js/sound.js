/*
 * Sound effects synthesized with the Web Audio API (no audio files, works offline).
 * Exposed as window.Sound.
 */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;

  function audio() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(o) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + (o.start || 0);
    const dur = o.dur || 0.15;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur * 0.8);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(o) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime + (o.start || 0);
    const dur = o.dur || 0.03;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = o.freq || 3000;
    filter.Q.value = 1.2;
    const gain = c.createGain();
    gain.gain.setValueAtTime(o.vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // Everyday button taps: short and quiet.
  const CLICKS = {
    tap: () => tone({ freq: 1100, dur: 0.05, vol: 0.16 }),
    wood: () => tone({ freq: 720, slideTo: 380, type: 'triangle', dur: 0.08, vol: 0.32 }),
    pop: () => tone({ freq: 380, slideTo: 950, dur: 0.07, vol: 0.2 }),
    tick: () => noise({ dur: 0.025, vol: 0.4, freq: 4200 }),
  };

  // Placing a correct number: brighter, a little celebratory.
  const CORRECT = {
    ding: () => {
      tone({ freq: 1318.5, dur: 0.6, vol: 0.2 });
      tone({ freq: 2637, dur: 0.25, vol: 0.05 });
    },
    chime: () => {
      tone({ freq: 1046.5, dur: 0.25, vol: 0.18 });
      tone({ freq: 1568, start: 0.09, dur: 0.5, vol: 0.18 });
    },
    bell: () => {
      tone({ freq: 880, dur: 1.0, vol: 0.18 });
      tone({ freq: 880 * 2.76, dur: 0.5, vol: 0.06 });
      tone({ freq: 880 * 5.4, dur: 0.25, vol: 0.025 });
    },
    sparkle: () => {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone({ freq: f, start: i * 0.055, dur: 0.3, vol: 0.12 }));
    },
  };

  // Finishing a puzzle: a short fanfare.
  function win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, start: i * 0.12, dur: 0.35, vol: 0.18, type: 'triangle' }));
    [1046.5, 1318.5, 1568].forEach((f) => tone({ freq: f, start: 0.5, dur: 1.2, vol: 0.1 }));
  }

  global.Sound = {
    CLICKS: Object.keys(CLICKS),
    CORRECT: Object.keys(CORRECT),
    click: (name) => (CLICKS[name] || CLICKS.tap)(),
    correct: (name) => (CORRECT[name] || CORRECT.ding)(),
    win,
  };
})(window);
