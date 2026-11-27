/* =============================================================
   sound.js — ลิขิตหงส์ · วังหลังต้าชิง
   Pure Web Audio synthesis (no audio files). Global `Sound` (docs/DESIGN.md §11):
     Sound.muted            (read/write; setting it pauses / resumes the ambience)
     Sound.ensure()         lazily creates + resumes the AudioContext (call from a user gesture)
     Sound.blip() pick() pop() fail() chime() gong() page()          sound effects
     Sound.startAmbient(mood) / Sound.stopAmbient()                  mood: palace|tense|sad|joy|night
   Extras: toggle(), setVolume(v), state(), moods, lastError.
   Everything is wrapped in try/catch: a missing / blocked AudioContext simply makes every call a no-op.

   Voice: guzheng / pipa-like plucks = sawtooth + triangle octave through a lowpass whose cutoff
   falls quickly (bright attack, round body), a tiny noise "pick" click, feedback-delay echoes and a
   short room convolver. Ambience is generative, built on the five Chinese pentatonic modes
   (gong 宮 · shang 商 · jue 角 · zhi 徵 · yu 羽), one scheduler, one loop at a time.
   ============================================================= */
var Sound = (function () {
  'use strict';

  /* ---------- constants ---------- */
  var MASTER = 0.18;          // master gain: the whole game is meant to sit quietly under the text
  var AMB_LEVEL = 0.85;       // ambience bus (relative to sfx bus = 1)
  var LOOKAHEAD = 2.4;        // seconds of music scheduled ahead of the audio clock
  var TICK_MS = 250;          // scheduler interval
  var MAX_VOICES = 38;        // overlapping synth voices (ambience yields first)
  var FADE_IN = 3.2, FADE_OUT = 2.6;
  var MODES = {               // semitones above the tonic
    gong:  [0, 2, 4, 7, 9],   // 宮
    shang: [0, 2, 5, 7, 10],  // 商
    jue:   [0, 3, 5, 8, 10],  // 角
    zhi:   [0, 2, 5, 7, 9],   // 徵
    yu:    [0, 3, 5, 7, 10]   // 羽
  };

  /* ---------- state ---------- */
  var _ctx = null, _tries = 0;
  var _muted = false, _vol = 1;
  var _unlocked = false;       // a user gesture is known to have happened (or ensure() was called)
  var _master = null, _comp = null, _mix = null, _sfxBus = null, _ambBus = null;
  var _fxIn = null, _noiseBuf = null;
  var _sess = null;            // the one live ambience session
  var _dying = [];             // sessions fading out
  var _want = null;            // mood the game asked for (kept while muted / before unlock)
  var _timer = null;
  var _voices = [];            // {s, e} start/end (audio clock) of scheduled synth voices
  var _lastBlip = -1e9, _lastSfx = {};
  var _lastError = null;
  var _listening = false;
  var _resumeAt = -1e9, _budget = 0;   // short burst allowance while a resume() is pending
  var _g = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

  /* ---------- tiny utils ---------- */
  var _seed = ((Date.now() & 0x7fffffff) ^ 0x9e3779b9) >>> 0;
  function rnd() {                                   // mulberry32
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function noop() {}
  function wpick(list) {                              // list of [value, weight]
    var tot = 0, i;
    for (i = 0; i < list.length; i++) tot += list[i][1];
    var r = rnd() * tot;
    for (i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; }
    return list[list.length - 1][0];
  }
  function nowMs() { try { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); } catch (e) { return Date.now(); } }
  function swallow(p) { try { if (p && typeof p.catch === 'function') p.catch(noop); } catch (e) { /* ignore */ } return p; }
  function fail_(e) { _lastError = e; }

  /* ---------- context lifecycle ---------- */
  function isHidden() { try { return typeof document !== 'undefined' && !!document.hidden; } catch (e) { return false; } }
  function hasActivation() {
    try { return !!(navigator.userActivation && navigator.userActivation.hasBeenActive); } catch (e) { return false; }
  }

  function makeCtx() {
    if (_ctx && _ctx.state === 'closed') {               // the browser killed it: start over cleanly
      _ctx = null; _sess = null; _dying = []; _voices = []; _budget = 0; stopTimer();
    }
    if (_ctx) return _ctx;
    if (_tries >= 3) return null;
    var AC = _g.AudioContext || _g.webkitAudioContext;
    if (!AC) { _tries = 3; return null; }
    _tries++;
    try {
      _ctx = new AC();
      build();
      try { _ctx.onstatechange = function () { if (_ctx && _ctx.state === 'running') kick(); }; } catch (e) { /* ignore */ }
    } catch (e) {
      fail_(e);
      try { if (_ctx && typeof _ctx.close === 'function') swallow(_ctx.close()); } catch (e2) { /* ignore */ }
      _ctx = null; return null;
    }
    return _ctx;
  }

  /* ask the browser to run the context. `arm` (a real user gesture) also allows a few sounds to be
     queued while the resume is still pending; non-gesture retries are rate-limited and never queue. */
  var _lastTry = -1e9;
  function resumeCtx(arm) {
    var c = _ctx;
    if (!c) return;
    try {
      if (c.state !== 'running' && typeof c.resume === 'function' && !isHidden()) {
        var n = nowMs();
        if (arm && n - _resumeAt > 1000) { _resumeAt = n; _budget = 4; }
        else if (!arm && n - _lastTry < 500) return;
        _lastTry = n;
        var p = c.resume();
        if (p && typeof p.then === 'function') p.then(kick, noop);
        swallow(p);
      }
    } catch (e) { /* ignore */ }
  }

  /* context usable for scheduling right now?  A running context always is; while a resume() is still
     pending a handful of sounds are allowed through (they start the moment it runs), never a backlog. */
  function ready() {
    if (_muted) return null;
    var c = _ctx;
    if (!c) {
      if (!(_unlocked || hasActivation())) return null;
      c = makeCtx();
      if (!c) return null;
      resumeCtx(true);                                   // the browser told us a gesture already happened
    }
    if (c.state === 'running') return c;
    if (isHidden()) return null;
    resumeCtx(false);
    if (_budget > 0) { _budget--; return c; }
    return null;
  }

  /* when the context becomes running: start (or continue) the wanted ambience */
  function kick() {
    try {
      if (!_ctx || _ctx.state !== 'running') return;
      unlisten();
      _budget = 0;
      if (_muted) return;
      if (_want && (!_sess || _sess.mood !== _want)) beginAmbient(_want);
      else if (_sess) pump(_ctx.currentTime + LOOKAHEAD);
    } catch (e) { fail_(e); }
  }

  function onGesture() {
    try {
      _unlocked = true;
      if (!_muted) { makeCtx(); resumeCtx(true); kick(); }
    } catch (e) { fail_(e); }
  }
  var GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'click', 'keydown'];
  function listen() {
    if (_listening || typeof document === 'undefined' || !document.addEventListener) return;
    _listening = true;
    try { GESTURES.forEach(function (n) { document.addEventListener(n, onGesture, true); }); } catch (e) { /* ignore */ }
  }
  function unlisten() {
    if (!_listening) return;
    _listening = false;
    try { GESTURES.forEach(function (n) { document.removeEventListener(n, onGesture, true); }); } catch (e) { /* ignore */ }
  }
  /* do not burn battery in a hidden tab */
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        try {
          if (!_ctx) return;
          if (document.hidden) { if (_ctx.state === 'running' && typeof _ctx.suspend === 'function') swallow(_ctx.suspend()); }
          else if (!_muted) { _lastTry = -1e9; resumeCtx(false); }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }

  /* ---------- graph ---------- */
  function mkGain(v) { var g = _ctx.createGain(); g.gain.value = v; return g; }

  function build() {
    var c = _ctx;
    _master = mkGain(_muted ? 0 : MASTER * _vol);
    _master.connect(c.destination);
    var tail = _master;
    if (typeof c.createDynamicsCompressor === 'function') {
      try {
        _comp = c.createDynamicsCompressor();
        _comp.threshold.value = -12; _comp.knee.value = 12; _comp.ratio.value = 5;
        _comp.attack.value = 0.004; _comp.release.value = 0.3;
        _comp.connect(_master); tail = _comp;
      } catch (e) { _comp = null; tail = _master; }
    }
    _mix = mkGain(1); _mix.connect(tail);
    _sfxBus = mkGain(1); _sfxBus.connect(_mix);
    _ambBus = mkGain(AMB_LEVEL);
    try {                                                // nothing below ~70 Hz: it only eats headroom on small speakers
      var ahp = _ctx.createBiquadFilter(); ahp.type = 'highpass'; ahp.frequency.value = 70; ahp.Q.value = 0.5;
      _ambBus.connect(ahp); ahp.connect(_mix);
    } catch (e) { _ambBus.connect(_mix); }
    buildFx();
    buildNoise();
  }

  /* effects: three feedback delays (the "reverb" of a courtyard) + a short generated room */
  function buildFx() {
    var c = _ctx;
    _fxIn = mkGain(1);
    var out = mkGain(0.5); out.connect(_mix);
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    _fxIn.connect(hp);
    var lines = [[0.27, 0.40, 2300, -0.6, 0.9], [0.39, 0.38, 1900, 0.6, 0.85], [0.53, 0.30, 1500, 0.0, 0.6]];
    lines.forEach(function (L) {
      var d = c.createDelay(1.5); d.delayTime.value = L[0];
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = L[2];
      var fb = mkGain(L[1]);
      var wet = mkGain(L[4]);
      hp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d);          // the loop contains a DelayNode
      lp.connect(wet);
      var tailNode = wet;
      if (typeof c.createStereoPanner === 'function') {
        try { var p = c.createStereoPanner(); p.pan.value = L[3]; wet.connect(p); tailNode = p; } catch (e) { tailNode = wet; }
      }
      tailNode.connect(out);
    });
    if (typeof c.createConvolver === 'function' && typeof c.createBuffer === 'function') {
      try {
        var sr = c.sampleRate || 44100, n = Math.floor(sr * 1.9);
        var ir = c.createBuffer(2, n, sr);
        for (var ch = 0; ch < 2; ch++) {
          var d2 = ir.getChannelData(ch), lpv = 0;
          for (var i = 0; i < n; i++) {
            var k = i / n, a = 0.9 - 0.78 * Math.sqrt(k);                  // darker as the tail ages
            lpv += ((rnd() * 2 - 1) - lpv) * a;
            d2[i] = lpv * Math.pow(1 - k, 2.6) * (i < 90 ? i / 90 : 1);
          }
        }
        var cv = c.createConvolver(); cv.buffer = ir;
        var vg = mkGain(0.34);
        _fxIn.connect(cv); cv.connect(vg); vg.connect(_mix);
      } catch (e) { /* the delays alone are fine */ }
    }
  }

  function buildNoise() {
    var c = _ctx;
    if (typeof c.createBuffer !== 'function') return;
    var sr = c.sampleRate || 44100, n = sr * 2;
    _noiseBuf = c.createBuffer(1, n, sr);
    var d = _noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  }

  function applyMaster() {
    if (!_ctx || !_master) return;
    var t = _ctx.currentTime, v = _muted ? 0 : MASTER * _vol;
    try { _master.gain.cancelScheduledValues(t); } catch (e) { /* ignore */ }
    try { _master.gain.setTargetAtTime(v, t, 0.03); } catch (e) { _master.gain.value = v; }
  }

  /* output bus for one sound effect; `send` = how much of it feeds the echoes / room */
  function sfxOut(send, level) {
    var o = mkGain(level == null ? 1 : level);
    o.connect(_sfxBus);
    if (send > 0 && _fxIn) { var s = mkGain(send); o.connect(s); s.connect(_fxIn); }
    return o;
  }

  /* ---------- voice bookkeeping ---------- */
  function room(t) {
    var now = _ctx ? _ctx.currentTime : 0, n = 0, i, keep = [];
    for (i = 0; i < _voices.length; i++) { if (_voices[i].e >= now - 0.05) { keep.push(_voices[i]); if (_voices[i].s <= t && _voices[i].e >= t) n++; } }
    _voices = keep;
    return n < MAX_VOICES;
  }
  function claim(t, dur) { if (_voices.length > 160) room(t); _voices.push({ s: t, e: t + dur }); }

  function stopAt(node, when) { try { node.stop(when); } catch (e) { /* already stopped */ } }
  function osc(type, f, t0, t1, detuneCents) {
    var o = _ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (detuneCents) { try { o.detune.value = detuneCents; } catch (e) { /* ignore */ } }
    o.start(t0); o.stop(t1);
    return o;
  }
  function panner(v) {
    if (!v || typeof _ctx.createStereoPanner !== 'function') return null;
    try { var p = _ctx.createStereoPanner(); p.pan.value = clamp(v, -1, 1); return p; } catch (e) { return null; }
  }
  /* noise burst through a filter; returns the gain node (not yet connected) */
  function noiseBurst(t, dur, type, freq, q, peak, atk) {
    if (!_noiseBuf) return null;
    var src = _ctx.createBufferSource();
    src.buffer = _noiseBuf; src.loop = true;
    var f = _ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = _ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (atk || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    src.start(t, rr(0, 1.4)); src.stop(t + dur + 0.02);
    return g;
  }

  /* ============================================================
     PLUCKED STRING (guzheng / pipa-like)
     o: { t, f, dur, vel, bright, dest, pan, bend, harm, light, click }
     ============================================================ */
  function pluck(o) {
    var c = _ctx, t = o.t, f = o.f, dur = o.dur, vel = o.vel;
    if (!(f > 20 && f < 12000) || !(dur > 0.05)) return;
    claim(t, dur);
    var end = t + dur + 0.08;
    var amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(vel, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(Math.max(vel * 0.42, 0.0002), t + Math.min(0.16, dur * 0.2));   // quick bloom...
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);                                              // ...long tail
    var tailNode = amp;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = o.harm ? 0.5 : 1.1;
    var top = clamp(f * (o.bright || 6), 400, 11000), low = clamp(f * 1.7, 220, 5000);
    lp.frequency.setValueAtTime(top, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(low, top), t + Math.min(0.7, dur * 0.4));
    lp.connect(amp);

    var bendTo = o.bend || 1;
    function voice(type, mult, gain, cents) {
      var ff = f * mult;
      if (ff > 15000) return;
      var v = c.createOscillator();
      v.type = type;
      v.frequency.setValueAtTime(ff, t);
      if (bendTo !== 1) {                                             // pressed string: pitch rises after the pluck
        v.frequency.setValueAtTime(ff, t + 0.07);
        v.frequency.exponentialRampToValueAtTime(ff * bendTo, t + 0.07 + Math.min(0.25, dur * 0.2));
      }
      if (cents) { try { v.detune.value = cents; } catch (e) { /* ignore */ } }
      if (gain === 1) v.connect(lp);
      else { var vg = c.createGain(); vg.gain.value = gain; v.connect(vg); vg.connect(lp); }
      v.start(t); v.stop(end);
      return v;
    }
    var last;
    if (o.harm) {                                                      // flute-like harmonic: pure sines
      last = voice('sine', 1, 1, 0);
      voice('sine', 3, 0.22, 0); voice('sine', 2, 0.15, 0);
    } else if (o.light) {                                              // cheap voice for tremolo / sweeps
      last = voice('sawtooth', 1, 1, 0);
    } else {
      last = voice('sawtooth', 1, 1, 0);
      voice('triangle', 2, 0.42, 5);
      voice('sine', 1, 0.5, -4);
    }
    if (o.click && _noiseBuf) {                                        // the pick
      var nb = noiseBurst(t, 0.03, 'bandpass', clamp(f * 3.2, 1400, 6000), 0.9, 0.2 * vel, 0.001);
      if (nb) nb.connect(amp);
    }
    var p = panner(o.pan);
    if (p) { amp.connect(p); tailNode = p; }
    tailNode.connect(o.dest);
    if (last) last.onended = function () { try { tailNode.disconnect(); amp.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* inharmonic little bell (pop / chime) */
  function bell(t, f, dur, vel, dest, pan) {
    var c = _ctx;
    claim(t, dur);
    var amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(vel, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var parts = [[1, 1, 1], [2.0, 0.3, 0.55], [2.76, 0.17, 0.4], [5.4, 0.06, 0.22]], last = null;
    parts.forEach(function (p) {
      if (f * p[0] > 14000) return;
      var o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * p[0], t);
      var g = c.createGain();
      g.gain.setValueAtTime(p[1], t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, dur * p[2]));
      o.connect(g); g.connect(amp);
      o.start(t); o.stop(t + dur + 0.05);
      last = o;
    });
    var tn = amp, pn = panner(pan);
    if (pn) { amp.connect(pn); tn = pn; }
    tn.connect(dest);
    if (last) last.onended = function () { try { tn.disconnect(); amp.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* soft hollow wood knock (typewriter tick / the night watchman's clapper) */
  function knock(t, f, vel, dest, dur) {
    var c = _ctx, d = dur || 0.05;
    claim(t, d);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    var o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f * 0.6, 40), t + d * 0.9);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + d + 0.02);
    o.onended = function () { try { g.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* low soft thump (a distant drum / heartbeat) */
  function thump(t, vel, dest) {
    var c = _ctx;
    claim(t, 0.34);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    var o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.22);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.34);
    o.onended = function () { try { g.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* ============================================================
     SOUND EFFECTS
     ============================================================ */
  var F = { D3: 146.83, F3: 174.61, A3: 220, D4: 293.66, A4: 440, D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880, D6: 1174.66, E6: 1318.51 };

  function again(name, ms) {                            // true when this effect fired less than `ms` ago
    var n = nowMs();
    if (n - (_lastSfx[name] || -1e9) < ms) return true;
    _lastSfx[name] = n;
    return false;
  }

  function sfxBlip() {                                  // typewriter tick, throttled
    if (_muted) return;
    var n = nowMs();
    if (n - _lastBlip < 50) return;
    var c = ready(); if (!c) return;
    _lastBlip = n;
    if (!room(c.currentTime)) return;
    knock(c.currentTime + 0.002, rr(1250, 1650), 0.75, _sfxBus, 0.04);
  }

  function sfxPick() {                                  // a choice was made: two soft plucks, a fifth apart
    if (_muted || again('pick', 40)) return;
    var c = ready(); if (!c) return;
    var t = c.currentTime + 0.004, out = sfxOut(0.2, 1.55);
    pluck({ t: t, f: F.D5, dur: 0.6, vel: 0.5, bright: 6, dest: out, pan: -0.15, click: true });
    pluck({ t: t + 0.075, f: F.A5, dur: 0.85, vel: 0.46, bright: 6, dest: out, pan: 0.15, light: true });
  }

  function sfxPop() {                                   // something good: a rising pair of bells
    if (_muted || again('pop', 40)) return;
    var c = ready(); if (!c) return;
    var t = c.currentTime + 0.004, out = sfxOut(0.3, 1.15);
    bell(t, F.A5, 0.7, 0.5, out, -0.12);
    bell(t + 0.085, F.E6, 1.0, 0.45, out, 0.12);
  }

  function sfxFail() {                                  // something bad: a dull descending phrase
    if (_muted || again('fail', 60)) return;
    var c = ready(); if (!c) return;
    var t = c.currentTime + 0.004, out = sfxOut(0.22, 1.1);
    pluck({ t: t, f: F.D4, dur: 0.5, vel: 0.46, bright: 4.2, dest: out, pan: -0.12, click: true });
    pluck({ t: t + 0.11, f: F.A3, dur: 0.55, vel: 0.46, bright: 4, dest: out, pan: -0.04, light: true });
    pluck({ t: t + 0.22, f: F.F3, dur: 0.6, vel: 0.48, bright: 3.8, dest: out, pan: 0.04, light: true });
    pluck({ t: t + 0.34, f: F.D3, dur: 1.3, vel: 0.56, bright: 3.4, dest: out, pan: 0.12, bend: 0.944, click: true });
    thump(t + 0.34, 0.34, out);
  }

  function sfxChime() {                                 // an ending / a keepsake: a falling-rising cascade of bells + a soft pad
    if (_muted || again('chime', 120)) return;
    var c = ready(); if (!c) return;
    var t = c.currentTime + 0.01, out = sfxOut(0.5, 0.78);
    [F.D5, F.E5, F.Fs5, F.A5, F.D6, F.A5, F.D6].forEach(function (f, i) {
      bell(t + i * 0.13 + (i > 4 ? 0.12 : 0), f, i >= 4 ? 2.4 : 1.7, 0.42 - i * 0.012, out, -0.5 + i * 0.16);
    });
    [F.D4, F.A4].forEach(function (f, i) {              // pad
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      var o = osc('triangle', f, t, t + 3.3, i * 3);
      o.connect(g); g.connect(out);
      claim(t, 3.3);
    });
  }

  /* rank-up: deep bronze gong, long decay, inharmonic partials that beat against each other, a shimmering halo */
  function sfxGong() {
    if (_muted || again('gong', 400)) return;
    var c = ready(); if (!c) return;
    var t = c.currentTime + 0.01, f0 = 110;
    var out = sfxOut(0.55, 1.9);
    claim(t, 9);
    //            ratio  amp   decay(s)  beat(Hz)
    var P = [[1.00, 0.75, 9.0, 1.1], [1.52, 0.80, 7.5, 1.7], [2.07, 0.85, 6.4, 0.9], [2.61, 0.60, 5.2, 2.3], [3.35, 0.52, 4.4, 1.4],
             [4.18, 0.55, 3.6, 2.6], [5.43, 0.42, 2.9, 1.9], [6.80, 0.30, 2.3, 3.1], [8.90, 0.19, 1.7, 2.2], [11.30, 0.11, 1.2, 3.4]];
    P.forEach(function (p, i) {
      for (var k = 0; k < 2; k++) {                                       // two slightly detuned sines → slow beating
        var f = f0 * p[0] + (k ? p[3] * 0.5 : -p[3] * 0.5);
        var g = c.createGain(), pk = 0.07 * p[1], dd = p[2] * (k ? 0.92 : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(pk, t + 0.006 + i * 0.0015);
        g.gain.exponentialRampToValueAtTime(pk * 0.5, t + Math.min(0.9, dd * 0.12));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dd);
        var o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f * 1.012, t);                          // tiny settle after the strike
        o.frequency.exponentialRampToValueAtTime(f, t + 0.55);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + dd + 0.1);
      }
    });
    // sub boom
    var sg = c.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.linearRampToValueAtTime(0.2, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    var so = osc('sine', f0 * 0.5, t, t + 3.5, 0);
    so.connect(sg); sg.connect(out);
    // the strike: mallet thud + a crash that blooms and fades
    var n1 = noiseBurst(t, 0.28, 'bandpass', 1500, 0.7, 0.34, 0.002); if (n1) n1.connect(out);
    var n2 = noiseBurst(t, 2.4, 'highpass', 3200, 0.5, 0.045, 0.35); if (n2) n2.connect(out);
    // shimmer: glassy high partials with an amplitude tremolo, swelling after the strike
    [16.4, 20.7, 26.6, 33.5].forEach(function (r, i) {
      var sh = c.createGain();
      sh.gain.setValueAtTime(0.0001, t);
      sh.gain.exponentialRampToValueAtTime(0.040 - i * 0.006, t + 0.5 + i * 0.18);
      sh.gain.exponentialRampToValueAtTime(0.0001, t + 4.8 + i * 0.5);
      var so2 = osc('sine', f0 * r, t, t + 5.4 + i * 0.5, 0);
      var trem = c.createGain(); trem.gain.value = 0.5;
      var lfo = osc('sine', 4.2 + i * 0.95, t, t + 5.4 + i * 0.5, 0);
      var depth = c.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(trem.gain);
      so2.connect(trem); trem.connect(sh); sh.connect(out);
    });
  }

  function sfxPage() {                                  // soft paper rustle: a few filtered-noise flutters
    if (_muted || again('page', 40)) return;
    var c = ready(); if (!c || !_noiseBuf) return;
    var t = c.currentTime + 0.003, out = sfxOut(0.08, 1.6);
    claim(t, 0.4);
    var src = c.createBufferSource();
    src.buffer = _noiseBuf; src.loop = true;
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(2800, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + 0.28);
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7800;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    [[0, 0.5, 0.07], [0.075, 0.34, 0.06], [0.14, 0.22, 0.1]].forEach(function (b) {
      g.gain.linearRampToValueAtTime(b[1], t + b[0] + 0.008);
      g.gain.exponentialRampToValueAtTime(0.02, t + b[0] + b[2]);
    });
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    src.connect(hp); hp.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    src.start(t, rr(0, 1.5)); src.stop(t + 0.36);
    src.onended = function () { try { g.disconnect(); out.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* ============================================================
     GENERATIVE AMBIENCE
     ============================================================ */
  /* mood tables. degrees are indices on the pentatonic ladder: n=0 is the tonic, 5 notes per octave */
  var MOODS = {
    palace: {                                // calm, stately: gong mode on D, rolling arpeggios, a long bronze-warm drone
      mode: 'gong', tonic: 146.83, bpm: 54, lo: 2, hi: 12, center: 6, pull: 0.14, drift: 0, stable: [0, 3],
      steps: [[-3, 0.4], [-2, 1.2], [-1, 3], [0, 0.3], [1, 3], [2, 1.3], [3, 0.5]],
      len: [4, 7], durs: [[0.5, 2], [1, 4], [1.5, 1.5], [2, 1.5]], rest: [2, 5],
      vel: [0.42, 0.7], decay: 2.8, bright: 9, send: 0.36,
      bendP: 0.1, sweepP: 0.16, lowP: 0.75, low: [-5, -2], graceP: 0.15, tremP: 0, pulseP: 0, runP: 0.1,
      drone: [[0.5, 0.036, 'triangle', 0], [0.75, 0.026, 'triangle', 3]], droneLp: 380
    },
    tense: {                                 // jue mode low on A: ostinati, tremolo bursts, a heartbeat, a beating drone
      mode: 'jue', tonic: 146.83, bpm: 72, lo: 1, hi: 12, center: 6, pull: 0.12, drift: 0, stable: [0, 2],
      steps: [[-2, 1], [-1, 2], [0, 2.6], [1, 2], [2, 1], [3, 0.4]],
      len: [3, 6], durs: [[0.25, 2], [0.5, 3], [1, 1.2]], rest: [1.5, 4],
      vel: [0.34, 0.58], decay: 1.3, bright: 6.5, send: 0.3,
      bendP: 0.05, sweepP: 0.04, lowP: 0.55, low: [-5, -3], graceP: 0.05, tremP: 0.28, pulseP: 0.34, runP: 0,
      drone: [[1, 0.04, 'sawtooth', 0], [1, 0.04, 'sawtooth', 9], [0.5, 0.034, 'triangle', 0]], droneLp: 300
    },
    sad: {                                   // yu mode on D: slow descending lines, pressed bends, weeping tremolo
      mode: 'yu', tonic: 146.83, bpm: 42, lo: 1, hi: 12, center: 6, pull: 0.1, drift: -0.6, stable: [0, 3],
      steps: [[-3, 0.6], [-2, 1.6], [-1, 3], [0, 0.2], [1, 1.4], [2, 0.7]],
      len: [3, 5], durs: [[1, 2], [1.5, 3], [2, 3], [3, 1]], rest: [3, 6],
      vel: [0.34, 0.6], decay: 3.7, bright: 6, send: 0.52,
      bendP: 0.26, sweepP: 0.08, lowP: 0.5, low: [-5, -2], graceP: 0.2, tremP: 0.12, pulseP: 0, runP: 0,
      drone: [[0.5, 0.032, 'triangle', 0], [0.75, 0.024, 'triangle', 4]], droneLp: 340
    },
    joy: {                                   // bright gong mode on G: quick arpeggios and guzheng sweeps
      mode: 'gong', tonic: 196, bpm: 96, lo: 4, hi: 16, center: 10, pull: 0.1, drift: 0, stable: [0, 3],
      steps: [[-2, 1], [-1, 2], [1, 2.5], [2, 2], [3, 1]],
      len: [6, 10], durs: [[0.5, 5], [0.25, 2], [1, 2], [1.5, 0.5]], rest: [1, 3],
      vel: [0.38, 0.66], decay: 1.8, bright: 10, send: 0.3,
      bendP: 0.05, sweepP: 0.34, lowP: 0.5, low: [-5, 0], graceP: 0.18, tremP: 0, pulseP: 0, runP: 0.3,
      drone: [[0.5, 0.02, 'triangle', 0], [0.75, 0.015, 'triangle', 3]], droneLp: 400
    },
    night: {                                 // shang mode, high harmonics in a lot of echo, a breath of wind, a far-off watchman's clapper
      mode: 'shang', tonic: 293.66, bpm: 40, lo: 3, hi: 13, center: 8, pull: 0.1, drift: 0, stable: [0, 3], harm: true,
      steps: [[-3, 0.8], [-2, 1.5], [-1, 2], [1, 2], [2, 1.5], [3, 0.8]],
      len: [1, 3], durs: [[1, 2], [2, 3]], rest: [4, 9],
      vel: [0.3, 0.5], decay: 4.4, bright: 3.4, send: 0.7,
      bendP: 0, sweepP: 0, lowP: 0.2, low: [-5, -2], graceP: 0, tremP: 0, pulseP: 0, runP: 0, knockP: 0.13,
      drone: [[0.5, 0.026, 'sine', 0], [0.75, 0.018, 'sine', 3]], droneLp: 400,
      wind: { f: 360, q: 0.5, g: 0.02 }
    }
  };
  Object.keys(MOODS).forEach(function (k) { MOODS[k].beat = 60 / MOODS[k].bpm; });

  function degFreq(M, n) {
    var oct = Math.floor(n / 5), i = n - oct * 5;
    return M.tonic * Math.pow(2, (MODES[M.mode][i] + 12 * oct) / 12);
  }
  function isStable(M, n) { return M.stable.indexOf(((n % 5) + 5) % 5) >= 0; }

  function nextDeg(s) {
    var M = s.M, st = s.st, cand = [], i, step, nd, w;
    for (i = 0; i < M.steps.length; i++) {
      step = M.steps[i][0]; nd = st.deg + step;
      if (nd < M.lo || nd > M.hi) continue;
      w = M.steps[i][1] * Math.exp(-Math.abs(nd - M.center) * M.pull);
      if (M.drift) w *= (step * M.drift > 0) ? 1.7 : (step * M.drift < 0 ? 0.5 : 1);
      cand.push([nd, w]);
    }
    return cand.length ? wpick(cand) : clamp(M.center, M.lo, M.hi);
  }
  function endDeg(s) {                                  // phrases come to rest on a stable degree
    var M = s.M, st = s.st, cand = [], d, n;
    for (d = -2; d <= 2; d++) { n = st.deg + d; if (n >= M.lo && n <= M.hi && isStable(M, n)) cand.push([n, 1 / (1 + Math.abs(d))]); }
    return cand.length ? wpick(cand) : st.deg;
  }

  function play(s, t, n, dur, vel, extra) {
    var M = s.M;
    if (!room(t)) return;
    var o = { t: t + rr(0, 0.02), f: degFreq(M, n), dur: dur, vel: vel, bright: M.bright, dest: s.bus,
              pan: clamp((n - M.center) / 9, -0.7, 0.7) + rr(-0.1, 0.1), harm: !!M.harm, click: true };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    pluck(o);
  }
  function decayFor(M, n) { return M.decay * (n < M.center ? 1.15 : 0.9) * rr(0.88, 1.12); }

  function phrase(s, t) {
    var M = s.M, st = s.st, b = M.beat, len = ri(M.len[0], M.len[1]), i, n, d, vel, ex;
    if (M.lowP && rnd() < M.lowP) {                                    // a bass string opens the phrase
      var ln = M.low[ri(0, M.low.length - 1)];
      play(s, t, ln, M.decay * 1.2, rr(M.vel[0], M.vel[1]) * 0.6, { bright: 3.2 });
      t += 0.5 * b;
    }
    for (i = 0; i < len; i++) {
      n = (i === len - 1) ? endDeg(s) : nextDeg(s);
      d = wpick(M.durs) * b;
      vel = rr(M.vel[0], M.vel[1]);
      ex = null;
      if (M.bendP && rnd() < M.bendP) ex = { bend: rnd() < 0.5 ? 1.1225 : 1.0595 };
      if (i > 0 && M.graceP && rnd() < M.graceP) {                      // quick neighbour note before the beat
        play(s, t - 0.07, clamp(n + (rnd() < 0.5 ? 1 : -1), M.lo, M.hi), 0.9, vel * 0.5, { light: true, click: false });
      }
      play(s, t, n, decayFor(M, n), vel, ex);
      st.deg = n;
      t += (i === len - 1) ? d * 1.3 : d;
    }
    if (M.sweepP && rnd() < M.sweepP) t = sweep(s, t);
    return t;
  }

  /* guzheng glissando: a fast run up (or down) the scale that lands on a stable degree */
  function sweep(s, t) {
    var M = s.M, st = s.st, cnt = ri(5, 9), gap = rr(0.045, 0.07), up = rnd() < 0.62 || M.drift < 0, i, n;
    if (M.drift < 0) up = false;
    var bottom = clamp(st.deg - ri(2, 5), M.lo - 2, M.hi - cnt + 3), v0 = rr(0.16, 0.26), v1 = rr(0.46, 0.6);
    for (i = 0; i < cnt; i++) {
      n = up ? bottom + i : bottom + cnt - 1 - i;
      play(s, t + i * gap, n, 1.1 * rr(0.9, 1.1), v0 + (v1 - v0) * (up ? i / cnt : 1 - i / cnt) * 0.9,
           { light: true, click: false, bright: M.bright * 0.85 });
    }
    st.deg = clamp(up ? bottom + cnt - 1 : bottom, M.lo, M.hi);
    t += cnt * gap + 0.12;
    n = endDeg(s);
    play(s, t, n, decayFor(M, n) * 1.1, rr(M.vel[0], M.vel[1]));
    st.deg = n;
    return t + M.beat * 1.4;
  }

  /* pipa-style tremolo on one note: swells and thins out */
  function tremolo(s, t) {
    var M = s.M, st = s.st, gap = rr(0.07, 0.095), total = rr(0.9, 1.7), cnt = Math.floor(total / gap), i, k, v;
    var n = clamp(st.deg + ri(-1, 1), M.lo, M.hi), vmax = M.vel[1];
    for (i = 0; i < cnt; i++) {
      k = i / cnt;
      v = (k < 0.35 ? 0.25 + 0.55 * (k / 0.35) : 0.8 * (1 - (k - 0.35) / 0.65) + 0.1) * vmax;
      play(s, t + i * gap, n, 0.55, v, { light: true, click: false });
    }
    st.deg = n;
    var e = t + total + 0.05;
    play(s, e, n, decayFor(M, n), rr(M.vel[0], M.vel[1]) * 0.8);
    return e + M.beat;
  }

  /* low string pulses with a soft heartbeat underneath */
  function pulses(s, t) {
    var M = s.M, b = M.beat, cnt = ri(2, 4), i, tt;
    for (i = 0; i < cnt; i++) {
      tt = t + i * b * 2;
      play(s, tt, M.low[i % M.low.length] + (i % 2 ? 3 : 0), 1.5, rr(0.3, 0.42), { bright: 3.5 });
      if (room(tt)) { thump(tt, 0.3, s.bus); thump(tt + b * 0.4, 0.2, s.bus); }
    }
    return t + cnt * b * 2;
  }

  /* playful rising/falling pentatonic arpeggio */
  function run(s, t) {
    var M = s.M, st = s.st, b = M.beat, i, n;
    var pat = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 4], [0, 2, 4, 2, 3, 1], [0, 1, 3, 2, 4, 3, 1]][ri(0, 3)];
    var base = clamp(st.deg - ri(0, 3), M.lo, M.hi - 4);
    for (i = 0; i < pat.length; i++) {
      n = clamp(base + pat[i], M.lo, M.hi);
      play(s, t + i * b * 0.5, n, decayFor(M, n) * 0.9, rr(M.vel[0], M.vel[1]) * (0.8 + 0.25 * (i % 2 === 0 ? 1 : 0)));
    }
    st.deg = endDeg({ M: M, st: { deg: clamp(base + pat[pat.length - 1], M.lo, M.hi) } });
    var e = t + pat.length * b * 0.5;
    play(s, e, st.deg, decayFor(M, st.deg) * 1.2, rr(M.vel[0], M.vel[1]));
    return e + b;
  }

  /* the night watchman's wooden clapper, far away: tok ... tok-tok */
  function knocks(s, t) {
    var cnt = ri(1, 3), i;
    for (i = 0; i < cnt; i++) if (room(t + i * 0.55)) knock(t + i * 0.55, 640 + rr(-30, 30), 0.15, s.bus, 0.09);
  }

  function gen(s) {
    var M = s.M, st = s.st, t = s.next, r = rnd(), end;
    if (st.first) { st.first = false; end = phrase(s, t); }                     // always begin melodically
    else if (r < M.tremP) end = tremolo(s, t);
    else if (r < M.tremP + M.pulseP) end = pulses(s, t);
    else if (r < M.tremP + M.pulseP + M.runP) end = run(s, t);
    else end = phrase(s, t);
    if (M.knockP && rnd() < M.knockP) knocks(s, end + rr(0.6, 2.5) * M.beat);
    s.next = Math.max(end, t + 0.6) + rr(M.rest[0], M.rest[1]) * M.beat;
  }

  function pump(horizon) {
    var s = _sess;
    if (!s || !_ctx || _muted) return;
    var now = _ctx.currentTime, guard = 0;
    if (s.next < now + 0.05) s.next = now + 0.05;
    while (s.next < horizon && guard++ < 6) gen(s);
  }

  function startDrone(s) {
    var c = _ctx, M = s.M, t = c.currentTime;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = M.droneLp || 320; lp.Q.value = 0.4;
    lp.connect(s.bus);
    (M.drone || []).forEach(function (d) {
      var g = c.createGain(); g.gain.value = d[1];
      var o = c.createOscillator(); o.type = d[2]; o.frequency.value = M.tonic * d[0];
      if (d[3]) { try { o.detune.value = d[3]; } catch (e) { /* ignore */ } }
      var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rr(0.05, 0.13);
      var depth = c.createGain(); depth.gain.value = d[1] * 0.55;
      lfo.connect(depth); depth.connect(g.gain);                         // slow breathing
      o.connect(g); g.connect(lp);
      o.start(t); lfo.start(t);
      s.stops.push(o, lfo);
    });
    if (M.wind && _noiseBuf) {
      var src = c.createBufferSource(); src.buffer = _noiseBuf; src.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = M.wind.f; bp.Q.value = M.wind.q;
      var wg = c.createGain(); wg.gain.value = M.wind.g;
      var l1 = c.createOscillator(); l1.frequency.value = 0.045;
      var d1 = c.createGain(); d1.gain.value = M.wind.f * 0.35;
      l1.connect(d1); d1.connect(bp.frequency);                          // the pitch of the breeze drifts
      var l2 = c.createOscillator(); l2.frequency.value = 0.07;
      var d2 = c.createGain(); d2.gain.value = M.wind.g * 0.6;
      l2.connect(d2); d2.connect(wg.gain);                               // ...and so does its strength
      src.connect(bp); bp.connect(wg); wg.connect(s.bus);
      src.start(t, rr(0, 1.5)); l1.start(t); l2.start(t);
      s.stops.push(src, l1, l2);
    }
  }

  function reap(s) {
    try { s.bus.disconnect(); } catch (e) { /* ignore */ }
    try { s.send.disconnect(); } catch (e) { /* ignore */ }
    var i = _dying.indexOf(s);
    if (i >= 0) _dying.splice(i, 1);
  }

  function fadeOut(s, sec) {
    if (!s || s.dying) return;
    s.dying = true;
    var c = _ctx, t = c.currentTime;
    try {
      var cur = s.bus.gain.value;
      s.bus.gain.cancelScheduledValues(t);
      s.bus.gain.setValueAtTime(cur, t);
      s.bus.gain.linearRampToValueAtTime(0.0001, t + sec);
    } catch (e) { fail_(e); }
    s.stops.forEach(function (n) { stopAt(n, t + sec + 0.1); });
    _dying.push(s);
    if (typeof setTimeout === 'function') setTimeout(function () { reap(s); }, (sec + 0.6) * 1000);
  }

  function startTimer() { if (!_timer && typeof setInterval === 'function') _timer = setInterval(tick, TICK_MS); }
  function stopTimer() { if (_timer) { clearInterval(_timer); _timer = null; } }
  function tick() {
    try {
      if (!_sess) { stopTimer(); return; }
      if (_ctx && !_muted && _ctx.state === 'running') pump(_ctx.currentTime + LOOKAHEAD);
    } catch (e) { fail_(e); }
  }

  /* start `m` now, crossfading from whatever plays; never creates a second live loop */
  function beginAmbient(m) {
    var c = _ctx;
    if (!c || _muted || !MOODS[m]) return;
    if (_sess && !_sess.dying) {
      if (_sess.mood === m) return;
      fadeOut(_sess, FADE_OUT);
    }
    _sess = null;
    while (_dying.length > 3) reap(_dying[0]);
    var M = MOODS[m], t = c.currentTime;
    var s = { mood: m, M: M, next: t + 0.5, bus: null, send: null, stops: [], dying: false, st: { deg: M.center, first: true } };
    s.bus = c.createGain();
    s.bus.gain.setValueAtTime(0.0001, t);
    s.bus.gain.linearRampToValueAtTime(1, t + FADE_IN);
    s.bus.connect(_ambBus);
    s.send = c.createGain(); s.send.gain.value = M.send;
    s.bus.connect(s.send); s.send.connect(_fxIn);
    _sess = s;
    startDrone(s);
    startTimer();
    pump(t + LOOKAHEAD);
  }

  function killAll(sec) {
    if (_sess) { fadeOut(_sess, sec); _sess = null; }
    stopTimer();
  }

  /* ============================================================
     PUBLIC API  (every entry is wrapped: audio can never break the game)
     ============================================================ */
  function safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { fail_(e); } }; }

  var api = {
    ensure: safe(function () {
      _unlocked = true;
      var c = makeCtx();
      if (!c) return null;
      resumeCtx(true);
      return c;
    }),

    blip: safe(sfxBlip),
    pick: safe(sfxPick),
    pop: safe(sfxPop),
    fail: safe(sfxFail),
    chime: safe(sfxChime),
    gong: safe(sfxGong),
    page: safe(sfxPage),
    advance: safe(sfxPage),                              // alias kept from the old game

    startAmbient: safe(function (m) {
      m = MOODS[m] ? m : 'palace';
      _want = m;
      if (_muted) return;                                // remembered; resumes on unmute
      if (!_ctx && !(_unlocked || hasActivation())) { listen(); return; }
      var c = _ctx || makeCtx();
      if (!c) return;
      if (_sess && !_sess.dying && _sess.mood === m) return;
      if (c.state !== 'running') { resumeCtx(false); listen(); return; }   // kick() starts it the moment the context runs
      beginAmbient(m);
    }),

    stopAmbient: safe(function (sec) {
      _want = null;
      killAll(sec > 0 ? Math.min(sec, 8) : 1.8);
    }),

    toggle: safe(function () { api.muted = !_muted; return _muted; }),

    setVolume: safe(function (v) {
      v = Number(v);
      _vol = isFinite(v) ? clamp(v, 0, 2) : 1;
      applyMaster();
    }),

    state: function () {
      return {
        ctx: _ctx ? _ctx.state : 'none', muted: _muted, mood: (_sess && !_sess.dying) ? _sess.mood : null, want: _want,
        sessions: (_sess ? 1 : 0) + _dying.length, fading: _dying.length, timer: !!_timer, voices: _voices.length, volume: _vol
      };
    },
    moods: Object.keys(MOODS),
    master: MASTER
  };

  /* `muted` is a live property: assigning it (the engine does) silences / restores everything */
  Object.defineProperty(api, 'muted', {
    enumerable: true, configurable: true,
    get: function () { return _muted; },
    set: function (v) {
      try {
        v = !!v;
        if (v === _muted) return;
        _muted = v;
        if (_ctx) applyMaster();
        if (v) { killAll(0.2); }                         // pause the ambience (the wanted mood is remembered)
        else if (_want) {
          if (!_ctx && !(_unlocked || hasActivation())) listen();
          else { var c = _ctx || makeCtx(); if (c) { if (c.state === 'running') beginAmbient(_want); else { resumeCtx(false); listen(); } } }
        }
      } catch (e) { fail_(e); }
    }
  });
  Object.defineProperty(api, 'lastError', { enumerable: false, configurable: true, get: function () { return _lastError; } });

  /* test hooks (not used by the game) */
  api._pump = safe(function (horizon) { pump(horizon); });
  api._seed = function (n) { _seed = n >>> 0; };

  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Sound: Sound };
