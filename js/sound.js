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

  // Selecting a cell and general buttons.
  function pop() {
    tone({ freq: 380, slideTo: 950, dur: 0.07, vol: 0.2 });
  }

  // Tool row and number pad.
  function wood() {
    tone({ freq: 720, slideTo: 380, type: 'triangle', dur: 0.08, vol: 0.32 });
  }

  // Placing a correct number: a quick rising arpeggio.
  function sparkle() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone({ freq: f, start: i * 0.055, dur: 0.3, vol: 0.12 }));
  }

  // Finishing a puzzle: a short fanfare.
  function win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, start: i * 0.12, dur: 0.35, vol: 0.18, type: 'triangle' }));
    [1046.5, 1318.5, 1568].forEach((f) => tone({ freq: f, start: 0.5, dur: 1.2, vol: 0.1 }));
  }

  global.Sound = { pop, wood, sparkle, win };
})(window);
