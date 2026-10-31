/* input.js — keyboard + touch joystick + action buttons; and tiny WebAudio SFX. */
'use strict';
(function () {
  const keys = {};
  const joy = { x: 0, y: 0, active: false, id: null, cx: 0, cy: 0 };
  const handlers = {};
  const Input = (S77.Input = {
    on(k, fn) { handlers[k] = fn; },
    vector() {
      let x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;
      if (joy.active) { x = joy.x; y = joy.y; }
      return { x, y };
    },
    running() { return !!(keys.ShiftLeft || keys.ShiftRight || joy.run); },
    clear() { for (const k in keys) keys[k] = false; },
  });
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'); };
  window.addEventListener('keydown', (e) => {
    if (typing()) return;
    keys[e.code] = true;
    const map = { KeyE: 'act', Enter: 'act', Space: 'act', KeyM: 'map', KeyI: 'inv', KeyP: 'passport', KeyJ: 'quests', KeyC: 'status', KeyR: 'ride', Escape: 'esc', Equal: 'zoomIn', NumpadAdd: 'zoomIn', Minus: 'zoomOut', NumpadSubtract: 'zoomOut', F1: 'help', KeyH: 'help' };
    const a = map[e.code];
    if (a && handlers[a]) { if (!e.repeat || a.startsWith('zoom')) handlers[a](); e.preventDefault(); }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => Input.clear());

  // touch joystick (left half of the screen)
  S77.setupTouch = function (canvas) {
    const pad = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    const R = 46;
    const start = (t) => {
      joy.active = true; joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY;
      pad.style.display = 'block'; pad.style.left = t.clientX - 60 + 'px'; pad.style.top = t.clientY - 60 + 'px';
      knob.style.transform = 'translate(0px,0px)';
    };
    const move = (t) => {
      let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      joy.x = dx / R; joy.y = dy / R; joy.run = d > R * 1.6;
      if (Math.hypot(joy.x, joy.y) < 0.18) { joy.x = 0; joy.y = 0; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const end = () => { joy.active = false; joy.x = joy.y = 0; joy.id = null; joy.run = false; pad.style.display = 'none'; };
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) if (!joy.active && t.clientX < window.innerWidth * 0.6) start(t);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) move(t); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) end(); }, { passive: false });
    canvas.addEventListener('touchcancel', end);
  };

  /* ---------------- sound (synthesised, no assets) ---------------- */
  let ac = null, stepT = 0;
  const ensure = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; };
  window.addEventListener('pointerdown', ensure, { once: true });
  window.addEventListener('keydown', ensure, { once: true });
  const tone = (f, dur, type, vol, slide) => {
    const a = ensure(); if (!a || !S77.soundOn) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur);
  };
  S77.soundOn = true;
  S77.Sound = {
    play(n) {
      if (n === 'click') tone(660, 0.06, 'square', 0.03);
      else if (n === 'coin') { tone(988, 0.07, 'square', 0.04); setTimeout(() => tone(1319, 0.12, 'square', 0.04), 70); }
      else if (n === 'error') tone(180, 0.18, 'sawtooth', 0.04, 120);
      else if (n === 'stamp') { tone(220, 0.08, 'triangle', 0.08); setTimeout(() => tone(523, 0.1, 'square', 0.04), 90); setTimeout(() => tone(784, 0.18, 'square', 0.04), 190); }
      else if (n === 'eat') { tone(400, 0.05, 'triangle', 0.05); setTimeout(() => tone(500, 0.05, 'triangle', 0.05), 80); }
      else if (n === 'shutter') { tone(1800, 0.03, 'square', 0.04); setTimeout(() => tone(900, 0.05, 'square', 0.03), 40); }
      else if (n === 'open') tone(520, 0.08, 'triangle', 0.04, 780);
      else if (n === 'talk') tone(300 + Math.random() * 200, 0.04, 'triangle', 0.025);
    },
    step(running) {
      const now = performance.now();
      if (now - stepT < (running ? 210 : 320)) return;
      stepT = now; tone(running ? 140 : 110, 0.03, 'triangle', 0.012);
    },
  };
})();
