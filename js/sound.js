/* =============================================================
   sound.js — เสียงเอฟเฟกต์สังเคราะห์ด้วย Web Audio (ไม่มีไฟล์เสียง)
   สร้าง AudioContext แบบ lazy หลัง user gesture แรกเท่านั้น
   ============================================================= */
'use strict';

const Sound = {
  ctx: null,
  muted: false,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  _tone(freq, dur, type = 'square', gain = 0.05, when = 0, slide = 0) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  _noise(dur, gain = 0.05, when = 0, freq = 1800) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t);
  },

  /* --- UI --- */
  click()  { this._tone(880, 0.05, 'square', 0.03); },
  open()   { this._tone(523, 0.06, 'square', 0.035); this._tone(784, 0.08, 'square', 0.03, 0.05); },
  cash()   { this._tone(1047, 0.07, 'square', 0.04); this._tone(1568, 0.12, 'square', 0.04, 0.06); },
  error()  { this._tone(196, 0.15, 'sawtooth', 0.04, 0, -60); },
  levelup(){ [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.1, 'square', 0.04, i * 0.07)); },
  train()  { this._tone(440, 0.06, 'square', 0.035); this._tone(587, 0.09, 'square', 0.03, 0.06); },

  /* --- ในสนาม --- */
  whistle(){ this._tone(2200, 0.28, 'square', 0.035, 0, 300); },
  hit()    { this._noise(0.06, 0.06, 0, 900); this._tone(180, 0.05, 'triangle', 0.05); },
  bounce() { this._tone(120, 0.08, 'triangle', 0.05, 0, -40); },
  point()  { this._tone(784, 0.08, 'square', 0.04); this._tone(1175, 0.14, 'square', 0.04, 0.07); },
  losePoint(){ this._tone(330, 0.1, 'square', 0.03, 0, -80); },
  win()    { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.12, 'square', 0.045, i * 0.1)); },
  lose()   { [494, 440, 392, 330].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.04, i * 0.12)); },
  trophy() { [784, 1047, 1319, 1568, 2093].forEach((f, i) => this._tone(f, 0.15, 'square', 0.05, i * 0.11)); },
};
