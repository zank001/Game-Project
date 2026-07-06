/* =============================================================
   sound.js — Lightweight generated sound effects (Web Audio).
   No audio files: every sound is synthesised, so the game stays
   fully self-contained. Respects the mute setting; the audio
   context is created lazily on the first user gesture.
   ============================================================= */
const Sound = {
  ctx: null,
  muted: false,
  _lastBlip: 0,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  _tone(freq, dur, type = 'sine', gain = 0.06, when = 0) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  // soft typewriter tick (throttled so it never machine-guns)
  blip() {
    if (this.muted) return;
    const now = performance.now ? performance.now() : Date.now();
    if (now - this._lastBlip < 45) return;
    this._lastBlip = now;
    this._tone(1400 + Math.sin(now / 200) * 120, 0.03, 'triangle', 0.018);
  },

  // pleasant rising two-note on affection gain
  pop() {
    this._tone(660, 0.14, 'sine', 0.05, 0);
    this._tone(990, 0.20, 'sine', 0.045, 0.08);
  },

  // choice selected
  pick() {
    this._tone(523, 0.10, 'triangle', 0.05, 0);
    this._tone(784, 0.14, 'triangle', 0.045, 0.06);
  },

  // gentle page-advance
  advance() { this._tone(420, 0.05, 'sine', 0.02); },

  // soft chime on reaching an ending
  chime() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.5, 'sine', 0.05, i * 0.12));
  },

  toggle() { this.muted = !this.muted; return this.muted; },
};

if (typeof module !== 'undefined') module.exports = { Sound };
