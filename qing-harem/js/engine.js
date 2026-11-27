/* =============================================================
   engine.js — UI controller for "ลิขิตหงส์ · วังหลังต้าชิง"
   A thin presentation layer over QL (js/logic.js). It never
   re-implements a rule: every state change goes through QL.*.
   Exposes window.Game (Game.st = live state, Game.settings …).
   URL params:  ?fast=1  instant text / no animation delays / no
                         season-report overlay / no tutorial hints
                ?report=1 keep the season report in fast mode
                ?tut=1    keep tutorial hints in fast mode
                ?fonts=0  never request web fonts
   ============================================================= */
(function () {
  'use strict';

  var Q = window.Q, QL = window.QL;
  if (!Q || !QL) {
    document.body.innerHTML = '<p style="color:#f3d58a;padding:24px;font-family:serif">ไม่สามารถโหลดข้อมูลเกมได้ — กรุณารีเฟรชหน้านี้</p>';
    return;
  }

  /* ============================================================
     1. UTILITIES
     ============================================================ */
  var PARAMS = (function () { try { return new URLSearchParams(window.location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var FAST = PARAMS.get('fast') === '1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined && html !== null) e.innerHTML = html; return e; }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sign(n) { return n > 0 ? '+' + n : (n < 0 ? '−' + Math.abs(n) : '0'); }
  function later(fn, ms) { return setTimeout(fn, FAST ? 0 : ms); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var SEG = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) SEG = new Intl.Segmenter('th', { granularity: 'grapheme' }); } catch (e) { SEG = null; }
  function graphemes(s) {
    if (SEG) {
      var out = [], it = SEG.segment(s)[Symbol.iterator](), n;
      while (!(n = it.next()).done) out.push(n.value.segment);
      return out;
    }
    return Array.from(s);
  }

  /* safe storage (falls back to memory when localStorage is blocked) */
  var LS = (function () {
    var mem = {}, ok = false;
    try { var k = '__qh_t'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
    return {
      available: ok,
      get: function (k) { try { return ok ? window.localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
      set: function (k, v) { try { if (ok) window.localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
      remove: function (k) { try { if (ok) window.localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } }
    };
  })();
  function readJSON(key, dflt) { try { var o = JSON.parse(LS.get(key)); return (o && typeof o === 'object') ? o : dflt; } catch (e) { return dflt; } }

  /* ============================================================
     2. GAME OBJECT, SETTINGS, SEEN-BOOKKEEPING, SAVE SLOTS
     ============================================================ */
  var Game = {
    st: null, Q: Q, QL: QL, fast: FAST,
    settings: { speed: 30, mute: false, tut: {}, autoDelay: 1500 },
    auto: false, skip: false, history: [], screen: 'title-screen',
    _run: 0, _wait: null, _typing: null, _lastEv: null, _hubWait: null
  };
  window.Game = Game;

  function loadSettings() {
    var s = readJSON(Q.SET_KEY, {});
    var d = Game.settings;
    if (typeof s.speed === 'number') d.speed = s.speed;
    d.mute = !!s.mute;
    if (s.tut && typeof s.tut === 'object') d.tut = s.tut;
    if (typeof s.autoDelay === 'number') d.autoDelay = s.autoDelay;
    Game._speedSaved = d.speed;
    if (FAST) d.speed = 0;
    applyMute();
  }
  function saveSettings() {
    var o = copy(Game.settings);
    if (FAST) o.speed = Game._speedSaved;
    LS.set(Q.SET_KEY, JSON.stringify(o));
  }
  Game.saveSettings = saveSettings;

  var Seen = {
    d: null,
    load: function () {
      var o = readJSON(Q.SEEN_KEY, {});
      this.d = { e: o.e || {}, c: o.c || {}, r: o.r || 0 };
    },
    put: function () { LS.set(Q.SEEN_KEY, JSON.stringify(this.d)); },
    ending: function (id) { if (!this.d.e[id]) { this.d.e[id] = Date.now(); this.put(); return true; } return false; },
    char: function (c) { if (c && c !== 'narrator' && Q.CHARS[c] && !this.d.c[c]) { this.d.c[c] = 1; this.put(); } },
    rank: function (r) { if (r > this.d.r) { this.d.r = r; this.put(); } },
    countEndings: function () { return Object.keys(this.d.e).length; }
  };
  Game.Seen = Seen;

  var Saves = {
    KEYS: ['auto', '1', '2', '3', '4'],
    all: function () { return readJSON(Q.SAVE_KEY, {}); },
    meta: function (st) {
      var d = QL.dateInfo(st);
      return { ts: Date.now(), name: st.name, origin: st.origin, rank: st.rank, rankTitle: QL.rankTitle(st), zh: Q.RANKS[st.rank].zh,
               t: st.t, label: d.label, year: d.year, season: d.season, age: d.age, phase: st.phase, mid: !!st.cur };
    },
    save: function (key, st) {
      var o = this.all();
      o[key] = { meta: this.meta(st), st: st };
      try { LS.set(Q.SAVE_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
    },
    get: function (key) {
      var r = this.all()[key];
      if (!r || !r.st || !r.st.S || !r.st.R || !r.st.F) return null;
      return r;
    },
    del: function (key) { var o = this.all(); delete o[key]; LS.set(Q.SAVE_KEY, JSON.stringify(o)); },
    latest: function () {
      var o = this.all(), best = null, bk = null;
      this.KEYS.forEach(function (k) { var r = o[k]; if (r && r.st && r.meta && (!best || r.meta.ts > best.meta.ts)) { best = r; bk = k; } });
      return best ? { key: bk, rec: best } : null;
    },
    any: function () { return !!this.latest(); }
  };
  Game.Saves = Saves;

  /* ============================================================
     3. SOUND (always defensive) & AUDIO MOODS
     ============================================================ */
  function snd(name, a, b) {
    try { if (window.Sound && typeof window.Sound[name] === 'function') window.Sound[name](a, b); } catch (e) { /* never break the UI for audio */ }
  }
  function applyMute() {
    try { if (window.Sound) { window.Sound.muted = !!Game.settings.mute; if (Game.settings.mute) snd('stopAmbient'); } } catch (e) { /* ignore */ }
    var ico = Game.settings.mute ? '🔇' : '🔊';
    $$('#btn-mute, #btn-title-mute').forEach(function (b) { b.textContent = ico; b.setAttribute('aria-pressed', Game.settings.mute ? 'true' : 'false'); });
  }
  var _mood = null;
  function mood(m) {
    if (Game.settings.mute) return;
    if (m === _mood) return;
    _mood = m;
    snd('startAmbient', m);
  }
  var BG_MOOD = { prison: 'tense', corridor_rain: 'tense', cold_palace: 'sad', bedchamber: 'sad', temple: 'sad', gate: 'sad',
                  banquet: 'joy', garden: 'joy', pavilion_lake: 'joy', garden_night: 'night', title: 'night', snow_court: 'sad', throne: 'palace' };
  function toggleMute() {
    Game.settings.mute = !Game.settings.mute;
    saveSettings(); applyMute(); _mood = null;
    if (!Game.settings.mute) { snd('ensure'); mood(Game.screen === 'title-screen' ? 'night' : 'palace'); snd('chime'); }
  }

  /* ============================================================
     4. ART HELPERS (defensive wrappers; unique ids per insertion)
     ============================================================ */
  var _pcache = {}, _bcache = {}, _uid = 0;
  function uniq(svg) {
    if (!svg || svg.indexOf(' id="') < 0) return svg;
    var n = ++_uid, ids = {}, m, re = /\sid="([^"]+)"/g;
    while ((m = re.exec(svg))) ids[m[1]] = 1;
    var keys = Object.keys(ids);
    if (!keys.length) return svg;
    var sfx = '_u' + n;
    svg = svg.replace(/\sid="([^"]+)"/g, function (all, id) { return ' id="' + id + sfx + '"'; });
    svg = svg.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g, function (all, q, id) { return ids[id] ? 'url(#' + id + sfx + ')' : all; });
    svg = svg.replace(/(xlink:href|href)="#([^"]+)"/g, function (all, a, id) { return ids[id] ? a + '="#' + id + sfx + '"' : all; });
    return svg;
  }
  function fallbackPortrait(c, x, o) {
    var col = (Q.CHARS[c] && Q.CHARS[c].color) || '#9a8a7a';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (o && o.bust ? '40 10 320 320' : '0 0 400 600') + '"><ellipse cx="200" cy="560" rx="150" ry="36" fill="' + col + '" opacity=".3"/>' +
      '<rect x="105" y="300" width="190" height="290" rx="70" fill="' + col + '"/><circle cx="200" cy="200" r="86" fill="#f3d9c0"/></svg>';
  }
  function portraitRaw(c, x, o) {
    o = o || {};
    var key = [c, x || 'neutral', o.rank === undefined ? '' : o.rank, o.origin || '', o.bust ? 1 : 0, o.outfit ? JSON.stringify(o.outfit) : ''].join('|');
    if (_pcache[key] !== undefined) return _pcache[key];
    var s = '';
    try { if (typeof window.portraitSVG === 'function') s = String(window.portraitSVG(c, x || 'neutral', o) || ''); } catch (e) { s = ''; }
    if (s.indexOf('<svg') < 0) s = fallbackPortrait(c, x, o);
    _pcache[key] = s;
    return s;
  }
  function cropVB(svg, vb) { return svg.replace(/viewBox="[^"]*"/, 'viewBox="' + vb + '"'); }
  /* portrait(c, expr, {rank, origin, bust, vb}) → ready-to-insert svg string with unique ids */
  function portrait(c, x, o) {
    o = o || {};
    var oo = o.outfit === true ? (Game.st ? QL.look(Game.st) : null) : (o.outfit || null);
    var s = portraitRaw(c, x, { rank: o.rank, origin: o.origin, bust: o.bust, outfit: oo });
    if (o.vb) s = cropVB(s, o.vb);
    return uniq(s);
  }
  function fallbackBg(key) {
    var pal = { title: ['#0b0a1e', '#6a2c3a'], garden: ['#7fb28a', '#2f5a45'], garden_night: ['#0b1230', '#27385f'], snow_court: ['#cfd8e4', '#8696ad'], prison: ['#1b1618', '#3b2a2c'] }[key] || ['#5a2230', '#1c1018'];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient></defs><rect width="1600" height="900" fill="url(#fg)"/></svg>';
  }
  function bgSVG(key, season) {
    var k = (key || 'small_court') + '|' + (season || 0);
    if (_bcache[k] !== undefined) return uniq(_bcache[k]);
    var s = '';
    try { if (typeof window.backgroundSVG === 'function') s = String(window.backgroundSVG(key, { season: season || 0 }) || ''); } catch (e) { s = ''; }
    if (s.indexOf('<svg') < 0) s = fallbackBg(key);
    _bcache[k] = s;
    return uniq(s);
  }

  function sealChars(zh) { return Array.from(String(zh)).map(function (c) { return '<i>' + esc(c) + '</i>'; }).join(''); }
  /* rank seal (印章) */
  function seal(r, cls) {
    var R = Q.RANKS[r] || Q.RANKS[0];
    return '<span class="seal n' + R.zh.length + ' ' + (cls || '') + '" style="--rk:' + R.color + '"><b>' + sealChars(R.zh) + '</b></span>';
  }
  function charName(c) {
    var C = Q.CHARS[c]; if (!C) return '';
    return Game.st ? QL.fill(Game.st, C.th) : String(C.th).replace('{{PLAYER}}', 'หลันซี');
  }
  function charShort(c) {
    var C = Q.CHARS[c]; if (!C) return c;
    if (c === 'player') return charName(c);
    return C.short || C.th;
  }
  function statIcon(k) { var m = Q.STAT_META[k]; return m ? m.icon : '•'; }
  function statName(k) { if (k === 'luck') return 'โชค'; var m = Q.STAT_META[k]; return m ? m.th : k; }
  function plainDesc(d) { return String(d || '').replace(/\s*\(−?\d+\s*ตำลึง\)/g, ''); }

  /* ============================================================
     5. SCREEN SWITCHING + TITLE ART (night palace, moon, plum branch)
     ============================================================ */
  function show(id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    Game.screen = id;
    document.body.setAttribute('data-screen', id);
  }
  function mk(seed) {
    var s = seed | 0;
    return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function f1(n) { return Math.round(n * 10) / 10; }

  function tRoof(cx, y, w, hh, fill) {
    var l = cx - w / 2, r = cx + w / 2, a = cx - w * 0.27, b = cx + w * 0.27;
    var d = 'M' + f1(a) + ' ' + f1(y) + ' L' + f1(b) + ' ' + f1(y) +
      ' Q' + f1(cx + w * 0.40) + ' ' + f1(y + hh * 0.55) + ' ' + f1(r - w * 0.03) + ' ' + f1(y + hh * 0.88) +
      ' Q' + f1(r + w * 0.015) + ' ' + f1(y + hh * 1.0) + ' ' + f1(r + w * 0.055) + ' ' + f1(y + hh * 0.72) +
      ' Q' + f1(r - w * 0.01) + ' ' + f1(y + hh * 1.04) + ' ' + f1(r - w * 0.11) + ' ' + f1(y + hh) +
      ' L' + f1(l + w * 0.11) + ' ' + f1(y + hh) +
      ' Q' + f1(l + w * 0.01) + ' ' + f1(y + hh * 1.04) + ' ' + f1(l - w * 0.055) + ' ' + f1(y + hh * 0.72) +
      ' Q' + f1(l - w * 0.015) + ' ' + f1(y + hh * 1.0) + ' ' + f1(l + w * 0.03) + ' ' + f1(y + hh * 0.88) +
      ' Q' + f1(cx - w * 0.40) + ' ' + f1(y + hh * 0.55) + ' ' + f1(a) + ' ' + f1(y) + 'Z';
    var ridge = '<path d="M' + f1(a - w * 0.018) + ' ' + f1(y + hh * 0.02) + ' q-' + f1(w * 0.012) + ' -' + f1(hh * 0.22) + ' ' + f1(w * 0.03) + ' -' + f1(hh * 0.2) + ' l' + f1(w * 0.02) + ' ' + f1(hh * 0.22) + 'z M' + f1(b + w * 0.018) + ' ' + f1(y + hh * 0.02) + ' q' + f1(w * 0.012) + ' -' + f1(hh * 0.22) + ' -' + f1(w * 0.03) + ' -' + f1(hh * 0.2) + ' l-' + f1(w * 0.02) + ' ' + f1(hh * 0.22) + 'z" fill="' + fill + '"/>';
    return '<path d="' + d + '" fill="' + fill + '"/>' + ridge;
  }
  function tHall(cx, base, w, hh, two, cr, cb, lit, R) {
    var s = '', bodyH = hh * 0.34, roofH = hh * 0.30;
    s += '<rect x="' + f1(cx - w * 0.5) + '" y="' + f1(base - hh * 0.05) + '" width="' + f1(w) + '" height="' + f1(hh * 0.05 + 2) + '" fill="' + cb + '"/>';
    s += '<rect x="' + f1(cx - w * 0.36) + '" y="' + f1(base - hh * 0.05 - bodyH) + '" width="' + f1(w * 0.72) + '" height="' + f1(bodyH) + '" fill="' + cb + '"/>';
    var y1 = base - hh * 0.05 - bodyH - roofH * 0.80;
    s += tRoof(cx, y1, w, roofH, cr);
    var top = y1;
    if (two) {
      var b2 = hh * 0.17;
      s += '<rect x="' + f1(cx - w * 0.23) + '" y="' + f1(y1 - b2 + roofH * 0.14) + '" width="' + f1(w * 0.46) + '" height="' + f1(b2) + '" fill="' + cb + '"/>';
      var y2 = y1 - b2 - roofH * 0.62 + roofH * 0.14;
      s += tRoof(cx, y2, w * 0.64, roofH * 0.92, cr);
      top = y2;
    }
    s += '<path d="M' + f1(cx) + ' ' + f1(top - hh * 0.07) + ' l' + f1(w * 0.012) + ' ' + f1(hh * 0.07) + ' h-' + f1(w * 0.024) + 'z" fill="#e8b45a" opacity=".75"/>';
    if (lit) {
      var n = Math.max(3, Math.round(w / 38)), x0 = cx - w * 0.30, step = (w * 0.60) / n;
      for (var i = 0; i < n; i++) {
        if (R() < 0.18) continue;
        s += '<rect x="' + f1(x0 + i * step + step * 0.22) + '" y="' + f1(base - hh * 0.05 - bodyH * 0.78) + '" width="' + f1(step * 0.5) + '" height="' + f1(bodyH * 0.5) + '" fill="#ffcf7a" opacity="' + f1(0.55 + R() * 0.4) + '"/>';
      }
    }
    return s;
  }
  function tCloud(x, y, sc, op, col) {
    return '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + sc + ')" opacity="' + op + '" fill="none" stroke="' + col + '" stroke-width="3" stroke-linecap="round">' +
      '<path d="M0 40 C0 22 22 16 34 26 C36 6 66 0 78 18 C92 6 118 14 116 34 C134 34 140 52 124 58 L16 58 C2 56 -4 46 0 40Z" fill="' + col + '" fill-opacity=".22"/>' +
      '<path d="M30 40 c8-10 20-8 22 2 M70 36 c6-8 18-6 20 4 M98 46 c4-6 12-4 12 2" /></g>';
  }
  function bez(t, a, b, c, d) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  function tPlum(W, H, P, R) {
    var s = '<g class="plum-branch amb">';
    var br = [[-30, H * 0.20], [W * (P ? 0.10 : 0.07), H * (P ? 0.18 : 0.23)], [W * (P ? 0.26 : 0.18), H * (P ? 0.05 : 0.02)], [W * (P ? 0.54 : 0.36), H * (P ? 0.09 : 0.075)]];
    s += '<path d="M' + f1(br[0][0]) + ' ' + f1(br[0][1]) + ' C' + br.slice(1).map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' ') + '" stroke="#12090f" stroke-width="' + (P ? 14 : 16) + '" fill="none" stroke-linecap="round"/>';
    var twigs = [[0.35, -1, 0.14], [0.55, 1, 0.16], [0.75, -1, 0.1], [0.9, 1, 0.08], [0.2, 1, 0.12]];
    var flowers = [];
    twigs.forEach(function (tw) {
      var x = bez(tw[0], br[0][0], br[1][0], br[2][0], br[3][0]), y = bez(tw[0], br[0][1], br[1][1], br[2][1], br[3][1]);
      var L = (P ? W : W * 0.8) * tw[2], dx = L * 0.7, dy = tw[1] * L * 0.9 + (tw[1] > 0 ? L * 0.5 : 0);
      s += '<path d="M' + f1(x) + ' ' + f1(y) + ' q' + f1(dx * 0.3) + ' ' + f1(dy * 0.2) + ' ' + f1(dx * 0.6) + ' ' + f1(dy * 0.65) + ' t' + f1(dx * 0.4) + ' ' + f1(dy * 0.4) + '" stroke="#12090f" stroke-width="6" fill="none" stroke-linecap="round"/>';
      flowers.push([x + dx, y + dy * 1.05], [x + dx * 0.55, y + dy * 0.7], [x + dx * 0.25, y + dy * 0.3]);
    });
    for (var i = 0; i < 9; i++) { var t = 0.1 + i * 0.1; flowers.push([bez(t, br[0][0], br[1][0], br[2][0], br[3][0]) + (R() - 0.5) * 20, bez(t, br[0][1], br[1][1], br[2][1], br[3][1]) + (R() - 0.2) * 24]); }
    flowers.forEach(function (p) {
      var r = (P ? 9 : 11) * (0.8 + R() * 0.6), col = R() < 0.5 ? '#fbd3dc' : '#f4a9bd';
      s += '<g transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') rotate(' + Math.round(R() * 72) + ')">';
      for (var k = 0; k < 5; k++) s += '<circle cx="' + f1(Math.cos(k * 1.2566) * r * 0.85) + '" cy="' + f1(Math.sin(k * 1.2566) * r * 0.85) + '" r="' + f1(r * 0.62) + '" fill="' + col + '" opacity=".96"/>';
      s += '<circle r="' + f1(r * 0.3) + '" fill="#e0607f"/><circle r="' + f1(r * 0.12) + '" fill="#ffe08a"/></g>';
    });
    return s + '</g>';
  }
  function tLantern(x, y, sc) {
    return '<g class="lantern amb" style="transform-origin:' + f1(x) + 'px ' + f1(y) + 'px"><circle cx="' + f1(x) + '" cy="' + f1(y + 110 * sc) + '" r="' + f1(90 * sc) + '" fill="url(#tglow)"/>' +
      '<path d="M' + f1(x) + ' ' + f1(y - 40) + ' V' + f1(y + 40 * sc) + '" stroke="#d9a441" stroke-width="2.4"/>' +
      '<rect x="' + f1(x - 16 * sc) + '" y="' + f1(y + 36 * sc) + '" width="' + f1(32 * sc) + '" height="' + f1(9 * sc) + '" rx="2" fill="#d9a441"/>' +
      '<ellipse cx="' + f1(x) + '" cy="' + f1(y + 84 * sc) + '" rx="' + f1(30 * sc) + '" ry="' + f1(40 * sc) + '" fill="url(#tlan)"/>' +
      '<path d="M' + f1(x - 14 * sc) + ' ' + f1(y + 48 * sc) + ' Q' + f1(x - 22 * sc) + ' ' + f1(y + 84 * sc) + ' ' + f1(x - 14 * sc) + ' ' + f1(y + 120 * sc) + ' M' + f1(x) + ' ' + f1(y + 45 * sc) + ' V' + f1(y + 124 * sc) + ' M' + f1(x + 14 * sc) + ' ' + f1(y + 48 * sc) + ' Q' + f1(x + 22 * sc) + ' ' + f1(y + 84 * sc) + ' ' + f1(x + 14 * sc) + ' ' + f1(y + 120 * sc) + '" stroke="#7a1018" stroke-width="1.6" fill="none" opacity=".7"/>' +
      '<rect x="' + f1(x - 14 * sc) + '" y="' + f1(y + 120 * sc) + '" width="' + f1(28 * sc) + '" height="' + f1(8 * sc) + '" rx="2" fill="#d9a441"/>' +
      '<path d="M' + f1(x) + ' ' + f1(y + 128 * sc) + ' v' + f1(34 * sc) + ' M' + f1(x - 5 * sc) + ' ' + f1(y + 128 * sc) + ' l-' + f1(3 * sc) + ' ' + f1(28 * sc) + ' M' + f1(x + 5 * sc) + ' ' + f1(y + 128 * sc) + ' l' + f1(3 * sc) + ' ' + f1(28 * sc) + '" stroke="#e23b3b" stroke-width="2.2" stroke-linecap="round"/></g>';
  }
  function titleArt(W, H, wide) {
    var R = mk(20260101), o = [], i;
    var hz = Math.round(H * (wide ? 0.80 : 0.75));
    var mx = wide ? W * 0.70 : W * 0.74, my = wide ? H * 0.33 : H * 0.17, mr = wide ? H * 0.12 : W * 0.125;
    var gx = wide ? W * 0.70 : W * 0.5;
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice">');
    o.push('<defs>' +
      '<linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05041a"/><stop offset=".38" stop-color="#1a0d38"/><stop offset=".62" stop-color="#4c1b4a"/><stop offset=".84" stop-color="#a8405a"/><stop offset="1" stop-color="#f4a46a"/></linearGradient>' +
      '<radialGradient id="tmoon" cx=".42" cy=".4" r=".7"><stop offset="0" stop-color="#fffdf0"/><stop offset=".65" stop-color="#f9ebbb"/><stop offset="1" stop-color="#e3c985"/></radialGradient>' +
      '<radialGradient id="thalo"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".62"/><stop offset=".35" stop-color="#f0c0a8" stop-opacity=".22"/><stop offset="1" stop-color="#f0c0a8" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="thz"><stop offset="0" stop-color="#ffb070" stop-opacity=".75"/><stop offset=".5" stop-color="#e0607a" stop-opacity=".3"/><stop offset="1" stop-color="#e0607a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="tglow"><stop offset="0" stop-color="#ffb060" stop-opacity=".6"/><stop offset="1" stop-color="#ff8040" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="tlan" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ff6a50"/><stop offset=".6" stop-color="#d42a2a"/><stop offset="1" stop-color="#7a1018"/></radialGradient>' +
      '<linearGradient id="tmist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b0b0" stop-opacity="0"/><stop offset=".6" stop-color="#d890a0" stop-opacity=".2"/><stop offset="1" stop-color="#2a1030" stop-opacity=".7"/></linearGradient>' +
      '<linearGradient id="tgrd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0c24"/><stop offset="1" stop-color="#050209"/></linearGradient>' +
      '<filter id="tblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="url(#tsky)"/>');
    o.push('<ellipse cx="' + f1(gx) + '" cy="' + f1(hz) + '" rx="' + f1(W * 0.5) + '" ry="' + f1(H * 0.26) + '" fill="url(#thz)"/>');
    for (i = 0; i < (wide ? 90 : 60); i++) {
      var sx = R() * W, sy = R() * hz * 0.78, sr = 0.8 + R() * 1.6;
      o.push('<circle class="star amb" cx="' + f1(sx) + '" cy="' + f1(sy) + '" r="' + f1(sr) + '" fill="#fff6dc" style="animation-delay:' + f1(R() * 5) + 's;animation-duration:' + f1(2.5 + R() * 3.5) + 's"/>');
    }
    o.push('<circle cx="' + f1(mx) + '" cy="' + f1(my) + '" r="' + f1(mr * 3.6) + '" fill="url(#thalo)"/>');
    o.push('<circle cx="' + f1(mx) + '" cy="' + f1(my) + '" r="' + f1(mr) + '" fill="url(#tmoon)"/>');
    [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.38, 0.18], [0.35, -0.35, 0.14]].forEach(function (c) {
      o.push('<circle cx="' + f1(mx + c[0] * mr) + '" cy="' + f1(my + c[1] * mr) + '" r="' + f1(c[2] * mr) + '" fill="#c9ab62" opacity=".16"/>');
    });
    o.push('<g class="drift amb">' + tCloud(mx - mr * 3.4, my + mr * 0.2, wide ? 1.5 : 1.0, 0.6, '#b49acb') + tCloud(mx + mr * 0.9, my + mr * 1.25, wide ? 1.2 : 0.8, 0.55, '#d4a8c0') + tCloud(W * (wide ? 0.38 : 0.1), hz * 0.5, wide ? 1.3 : 0.9, 0.38, '#8f7ab5') + '</g>');
    var hp = 'M0 ' + hz;
    for (i = 0; i <= 12; i++) hp += ' L' + f1(W * i / 12) + ' ' + f1(hz - 20 - R() * H * 0.07 - (i % 3 === 0 ? H * 0.035 : 0));
    o.push('<path d="' + hp + ' L' + W + ' ' + hz + ' Z" fill="#3a1d4e" opacity=".9"/>');
    var n = wide ? 11 : 5, fi;
    for (fi = 0; fi < n; fi++) {
      var cx = (fi + 0.5) * W / n + (R() - 0.5) * 24, wv = (wide ? 210 : 230) * (0.7 + R() * 0.5);
      o.push(tHall(cx, hz + 6, wv, wv * 0.62, R() < 0.5, '#44285c', '#35204c', false, R));
    }
    var gw = wide ? Math.min(H * 0.66, 620) : W * 0.9, gh = gw * 0.72;
    o.push(tHall(gx - gw * 0.68, hz + 14, gw * 0.5, gw * 0.4, false, '#2f1a46', '#241238', true, R));
    o.push(tHall(gx + gw * 0.68, hz + 14, gw * 0.5, gw * 0.4, false, '#2f1a46', '#241238', true, R));
    o.push(tHall(gx, hz + 20, gw, gh, true, '#3a2056', '#2a1642', true, R));
    var ry = hz + 20 - gh * 0.05 - gh * 0.34 - gh * 0.30 * 0.80;
    o.push('<path d="M' + f1(gx - gw * 0.26) + ' ' + f1(ry + 1.5) + ' H' + f1(gx + gw * 0.26) + '" stroke="#ffe9b0" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>');
    o.push('<rect x="0" y="' + (hz + 22) + '" width="' + W + '" height="' + f1(H * 0.05) + '" fill="#5a1620"/>');
    o.push('<rect x="0" y="' + (hz + 22) + '" width="' + W + '" height="7" fill="#1c0912"/>');
    for (i = 0; i < W; i += 46) o.push('<rect x="' + i + '" y="' + (hz + 29) + '" width="2" height="' + f1(H * 0.05 - 7) + '" fill="#2a0810" opacity=".55"/>');
    o.push('<rect x="0" y="' + f1(hz + 22 + H * 0.05) + '" width="' + W + '" height="' + f1(H - hz) + '" fill="url(#tgrd)"/>');
    o.push('<rect x="0" y="' + f1(hz - H * 0.1) + '" width="' + W + '" height="' + f1(H * 0.22) + '" fill="url(#tmist)"/>');
    o.push('<g class="mist amb" opacity=".5" filter="url(#tblur)"><ellipse cx="' + f1(W * 0.2) + '" cy="' + f1(hz + 6) + '" rx="' + f1(W * 0.24) + '" ry="22" fill="#e8b0b8"/><ellipse cx="' + f1(W * 0.72) + '" cy="' + f1(hz + 16) + '" rx="' + f1(W * 0.28) + '" ry="26" fill="#e8b0b8"/></g>');
    o.push(wide ? '<g transform="translate(' + W + ' 0) scale(-1 1)">' + tPlum(W, H, false, R) + '</g>' : tPlum(W, H, true, R));
    if (wide) { o.push(tLantern(W * 0.04, -30, 1.05)); o.push(tLantern(W * 0.115, -75, 0.8)); }
    else { o.push(tLantern(W * 0.92, -20, 0.9)); o.push(tLantern(W * 0.8, -60, 0.7)); }
    o.push('</svg>');
    return o.join('');
  }
  var _titleKey = '';
  function isWide() { var w = window.innerWidth || 1280, hgt = window.innerHeight || 720; return w >= 820 && w / hgt >= 1.2; }
  function renderTitleArt() {
    var host = $('#title-art'); if (!host) return;
    var wide = isWide(), key = wide ? 'w' : 't';
    if (key === _titleKey && host.firstChild) return;
    _titleKey = key;
    host.innerHTML = uniq(titleArt(wide ? 1600 : 900, wide ? 900 : 1600, wide));
  }
  function buildPetals() {
    var box = $('#petals'); if (!box || box.firstChild) return;
    var R = mk(77), html = '';
    for (var i = 0; i < 26; i++) {
      var size = 8 + R() * 10;
      html += '<span class="petal amb" style="--x:' + f1(R() * 100) + '%;--sz:' + f1(size) + 'px;--dur:' + f1(9 + R() * 9) + 's;--dl:-' + f1(R() * 16) + 's;--sw:' + Math.round((R() - 0.4) * 160) + 'px;--rot:' + Math.round(240 + R() * 480) + 'deg;--op:' + f1(0.55 + R() * 0.4) + '"></span>';
    }
    box.innerHTML = html;
  }

  /* ============================================================
     6. CHARACTER CREATION
     ============================================================ */
  var NAME_SUGGEST = ['หลันซี', 'ซินหรง', 'เยว่เหยา', 'อวี้หลิน', 'ชิงอวี่', 'จิ่นเซียน', 'หมิงจู', 'ฮุ่ยหราน'];
  var ORIGIN_GLYPH = { noble: '旗', scholar: '文', maid: '洗' };
  var Create = { origin: 'noble', gift: 'beauty' };

  function buildCreate() {
    var ol = $('#origin-list'); ol.innerHTML = '';
    Object.keys(Q.ORIGINS).forEach(function (k) {
      var o = Q.ORIGINS[k], S = o.start.S, stars = '';
      for (var i = 0; i < 3; i++) stars += '<i class="' + (i < o.stars ? 'on' : '') + '">★</i>';
      var b = h('button', 'origin-card');
      b.type = 'button'; b.dataset.origin = k;
      b.innerHTML = '<span class="oc-glyph seal-like">' + (ORIGIN_GLYPH[k] || '宫') + '</span>' +
        '<span class="oc-main"><span class="oc-head"><b class="oc-name">' + esc(o.th) + '</b><span class="oc-diff d' + o.stars + '"><span class="stars">' + stars + '</span>' + esc(o.diff) + '</span></span>' +
        '<small class="oc-sub">' + esc(o.sub) + '</small>' +
        '<span class="oc-desc">' + esc(o.desc) + '</span>' +
        '<span class="oc-stats">' + ['prestige', 'wit', 'charm', 'talent', 'virtue', 'silver'].map(function (s) { return '<i title="' + esc(statName(s)) + '"><u>' + statIcon(s) + '</u>' + S[s] + '</i>'; }).join('') + '</span></span>';
      b.addEventListener('click', function () { snd('pick'); selectOrigin(k); });
      ol.appendChild(b);
    });
    var gl = $('#gift-list'); gl.innerHTML = '';
    Object.keys(Q.GIFTS).forEach(function (k) {
      var g = Q.GIFTS[k];
      var b = h('button', 'gift-card');
      b.type = 'button'; b.dataset.gift = k;
      b.innerHTML = '<span class="gc-ico">' + esc(g.icon) + '</span><b>' + esc(g.th) + '</b><small>' + esc(g.desc) + '</small>';
      b.addEventListener('click', function () { snd('pick'); selectGift(k); });
      gl.appendChild(b);
    });
    var nc = $('#name-chips'); nc.innerHTML = '';
    NAME_SUGGEST.forEach(function (n) {
      var b = h('button', 'chip-btn', esc(n)); b.type = 'button';
      b.addEventListener('click', function () { $('#name-input').value = n; updatePreviewName(); snd('pick'); });
      nc.appendChild(b);
    });
  }
  function selectOrigin(k) {
    Create.origin = k;
    $$('.origin-card').forEach(function (c) { c.classList.toggle('selected', c.dataset.origin === k); c.setAttribute('aria-pressed', c.dataset.origin === k ? 'true' : 'false'); });
    var fig = $('#create-preview');
    fig.innerHTML = portrait('player', 'smile', { rank: 0, origin: k, vb: '40 0 320 430' });
    $('#create-preview-bg').innerHTML = bgSVG(k === 'maid' ? 'servants_quarters' : (k === 'noble' ? 'family_home' : 'family_home'), 0);
    $('#preview-origin').textContent = Q.ORIGINS[k].th;
    updatePreviewName();
  }
  function selectGift(k) {
    Create.gift = k;
    $$('.gift-card').forEach(function (c) { c.classList.toggle('selected', c.dataset.gift === k); c.setAttribute('aria-pressed', c.dataset.gift === k ? 'true' : 'false'); });
  }
  function updatePreviewName() {
    var v = $('#name-input').value.trim() || 'หลันซี';
    $('#preview-name').textContent = v;
  }
  function showCreate() {
    show('create-screen');
    selectOrigin(Create.origin); selectGift(Create.gift);
    mood('night');
  }

  /* ============================================================
     7. TITLE
     ============================================================ */
  function updateContinue() {
    var L = Saves.latest(), b = $('#btn-continue'), m = $('#continue-meta');
    if (L) {
      b.disabled = false; b.classList.remove('disabled');
      var mt = L.rec.meta;
      m.textContent = (mt.name || '') + ' · ' + (mt.rankTitle || '') + ' · ปีที่ ' + (mt.year || 1);
      $('#btn-load-list').hidden = false;
    } else {
      b.disabled = true; b.classList.add('disabled'); m.textContent = '';
      $('#btn-load-list').hidden = true;
    }
  }
  function showTitle() {
    Game._run++; Game._wait = null; Game._hubWait = null;
    stopAuto(); closeModal(); hideOverlay('ceremony'); hideOverlay('season-report');
    Game.st = null;
    show('title-screen');
    renderTitleArt(); buildPetals(); updateContinue();
    mood('night');
  }

  /* ============================================================
     8. HUB — ladder, stats, relations, actions
     ============================================================ */
  var GROUPS = [['self', 'ฝึกฝนตน', '☯'], ['court', 'สัมพันธ์ในวัง', '🏮'], ['intrigue', 'อุบายและการสืบข่าว', '🗡']];
  var REL_MAIN = ['empress', 'dowager', 'consort', 'friend', 'maid', 'eunuch', 'doctor', 'prince'];
  var REL_EXTRA = ['chu', 'lu', 'shu'];
  var STAT_ROWS = ['favor', 'prestige', 'wit', 'charm', 'talent', 'virtue', 'health', 'threat'];
  var HALL_BG = ['servants_quarters', 'small_court', 'small_court', 'small_court', 'chamber_mid', 'chamber_mid', 'chamber_grand', 'chamber_grand', 'chamber_grand', 'cining'];

  function gateFrac(g) {
    if (!g) return 1;
    var sum = 0;
    g.need.forEach(function (n) { sum += n.k === 'req' ? (n.ok ? 1 : 0) : (n.ok ? 1 : clamp(n.have / n.want, 0, 1)); });
    return sum / g.need.length;
  }
  function needOf(g, k) { if (!g) return null; for (var i = 0; i < g.need.length; i++) if (g.need[i].k === k) return g.need[i]; return null; }

  var _topKey = '';
  function renderTop(hub) {
    var st = Game.st, d = hub.date, R = Q.RANKS[st.rank];
    $('#hub-screen').setAttribute('data-season', d.season);
    $('#hud-date').innerHTML = '<span class="hd-ico">' + d.icon + '</span><span class="hd-txt"><b>รัชศก' + esc(Q.ERA) + ' ปีที่ ' + d.year + '</b><small>' + esc(d.seasonName) + ' · อายุ ' + d.age + ' ปี</small></span>';
    var idKey = [st.rank, st.origin, st.name].join('|');
    if (_topKey !== idKey || !$('#hud-id').firstChild) {
      _topKey = idKey;
      $('#hud-id').innerHTML = '<span class="hid-ava">' + portrait('player', 'neutral', { rank: st.rank, origin: st.origin, bust: true, outfit: true }) + '</span>' +
        seal(st.rank, 'sm') + '<span class="hid-txt"><b>' + esc(st.name) + '</b><small>' + esc(hub.rankTitle) + ' · ' + esc(R.zh) + '</small></span>';
    }
    var total = Math.max(Q.CONST.apPerSeason, hub.ap), pips = '';
    for (var i = 0; i < total; i++) pips += '<i class="pip ' + (i < hub.ap ? 'on' : '') + '"></i>';
    $('#hud-ap').innerHTML = '<span class="ap-label">กำลัง</span>' + pips;
    $('#hud-ap').title = 'แต้มกำลังที่เหลือในฤดูนี้: ' + hub.ap;
  }

  function renderClimbStrip(hub) {
    var st = Game.st, g = hub.gate, s = $('#climb-strip');
    if (!g) {
      if (st.rank >= 9) s.innerHTML = seal(9, 'sm') + '<span class="cs-main"><b>จุดสูงสุดแห่งวังหลัง</b><span class="cs-bar"><i style="width:100%"></i></span></span>';
      else s.innerHTML = seal(st.rank, 'sm') + '<span class="cs-main"><b>' + esc(hub.rankTitle) + ' <em>→ ' + esc(Q.RANKS[st.rank + 1].th) + '</em></b><span class="cs-bar"><i style="width:' + Math.round(100 * st.rank / 9) + '%"></i></span></span>' + seal(st.rank + 1, 'sm ghost');
      return;
    }
    var okN = g.need.filter(function (n) { return n.ok; }).length, segs = '';
    g.need.forEach(function (n) {
      var f = n.k === 'req' ? (n.ok ? 1 : 0) : (n.ok ? 1 : clamp(n.have / n.want, 0, 1));
      segs += '<i class="seg ' + (n.ok ? 'ok' : '') + '" title="' + esc(n.label) + '"><b style="width:' + Math.round(f * 100) + '%"></b></i>';
    });
    s.innerHTML = seal(st.rank, 'sm') + '<span class="cs-main"><b>สู่ ' + esc(Q.RANKS[g.to].th) + ' <em>' + okN + '/' + g.need.length + ' เงื่อนไข' + (g.ok ? ' · ครบแล้ว' : '') + '</em></b><span class="cs-segs">' + segs + '</span></span>' + seal(g.to, 'sm ghost');
  }

  function needRow(n) {
    var ok = n.ok, f = n.k === 'req' ? (ok ? 1 : 0) : (ok ? 1 : clamp(n.have / n.want, 0, 1));
    var val = n.k === 'req' ? (ok ? 'ผ่านแล้ว' : 'ยังไม่ผ่าน') : (n.have + ' / ' + n.want);
    return '<div class="need ' + (ok ? 'ok' : 'no') + '" data-need="' + n.k + '"><span class="n-ico">' + (ok ? '✓' : '✗') + '</span><span class="n-label">' + esc(n.label) + '</span><span class="n-val">' + esc(val) + '</span>' +
      (n.k === 'req' ? '' : '<span class="n-bar"><i style="width:' + Math.round(f * 100) + '%"></i></span>') + '</div>';
  }

  function renderLadder(hub) {
    var st = Game.st, g = hub.gate, rank = st.rank, frac = gateFrac(g), html = '';
    var pct = rank >= 9 ? 100 : Math.round(100 * (rank + (g ? frac : 0)) / 9);
    $('#ladder-head').innerHTML = '<div class="lh-title"><svg class="orn"><use href="#orn-cloud"/></svg><h3>บันไดสู่บัลลังก์หงส์</h3><svg class="orn"><use href="#orn-cloud"/></svg></div>' +
      '<div class="lh-meter"><span class="lh-step">ขั้นที่ <b>' + rank + '</b> / 9</span><span class="lh-bar"><i style="width:' + pct + '%"></i></span><span class="lh-pct">' + pct + '%</span></div>';
    function conn(k) { return k + 1 <= rank ? 1 : (k === rank ? (g ? frac : 0) : 0); }
    for (var r = 9; r >= 0; r--) {
      var R = Q.RANKS[r], cls = r < rank ? 'reached' : (r === rank ? 'current' : 'locked'), nxt = (r === rank + 1);
      var up = r < 9 ? Math.min(1, 2 * conn(r)) : 0, dn = r > 0 ? Math.max(0, 2 * conn(r - 1) - 1) : 0;
      var title = r === 0 ? (st.origin === 'maid' ? R.th : R.alt) : R.th;
      var meta;
      if (cls === 'reached') meta = '<span class="rm-ok">✓ ผ่านแล้ว</span>';
      else if (cls === 'locked') meta = esc(R.note);
      else meta = esc(R.note);
      var right = cls === 'reached' ? '<span class="rung-right ok">✓</span>' : (cls === 'locked' && r >= 1 ? '<span class="rung-right" title="เบี้ยหวัดประจำฤดู">銀 ' + R.stipend + '</span>' : '');
      var body = '<div class="rung-top"><b class="rung-name">' + esc(title) + '</b><span class="rung-zh">' + esc(R.zh) + '</span>' + (cls === 'current' ? '<span class="rung-tag">ท่านอยู่ที่นี่</span>' : right) + '</div>';
      body += '<div class="rung-meta">' + meta + (r >= 1 && cls !== 'reached' ? ' · <span class="rm-stipend">เบี้ยหวัด ' + R.stipend + '/ฤดู</span>' : '') + '</div>';
      if (cls === 'current') {
        body += '<div class="rung-hall">🏠 ' + esc(R.hall) + ' · อยู่ในขั้นนี้มา <b>' + st.sir + '</b> ฤดู</div>';
        if (g) {
          var left = g.need.filter(function (n) { return !n.ok; }).length;
          body += '<div class="gate"><div class="gate-title">ก้าวต่อไป <span>→</span> <b>' + esc(Q.RANKS[g.to].th) + '</b> <i>' + esc(Q.RANKS[g.to].zh) + '</i></div>' +
            g.need.map(needRow).join('') +
            '<div class="gate-foot ' + (g.ok ? 'ready' : '') + '">' + (g.ok ? '✦ เงื่อนไขครบแล้ว — ราชโองการจะมาถึงเมื่อสิ้นฤดูกาล' : 'ยังขาดอีก ' + left + ' ข้อ') + '</div></div>';
        } else if (r === 0) {
          body += '<div class="gate"><div class="gate-title">ก้าวต่อไป <span>→</span> <b>' + esc(Q.RANKS[1].th) + '</b> <i>' + esc(Q.RANKS[1].zh) + '</i></div><div class="gate-note">ทำหน้าที่ให้ดี และรอวันที่มีผู้สังเกตเห็น</div></div>';
        } else {
          body += '<div class="gate"><div class="gate-note">ท่านยืนอยู่บนจุดสูงสุดของสตรีในแผ่นดินแล้ว</div></div>';
        }
      }
      html += '<li class="rung ' + cls + (nxt ? ' next' : '') + '" data-rank="' + r + '" style="--up:' + up.toFixed(3) + ';--dn:' + dn.toFixed(3) + '"><div class="rung-seal">' + seal(r, cls) + '</div><div class="rung-body">' + body + '</div></li>';
    }
    $('#ladder').innerHTML = html;
  }

  function renderHero(hub) {
    var st = Game.st, R = Q.RANKS[st.rank];
    var expr = (st.S.health < 30 || st.F.poisoned) ? 'sad' : (st.S.favor >= 50 ? 'smile' : 'neutral');
    var wsig = (QL.ensureW(st), Object.keys(st.W.eq).map(function (k) { return st.W.eq[k]; }).join(','));
    var xs = QL.ensureX(st), xsig = xs.batches + ':' + (xs.pending ? xs.pending.ids.length : 0);
    var key = [st.rank, st.origin, expr, st.name, st.F.has_heir ? 1 : 0, st.F.poisoned ? 1 : 0, st.F.heir_name || '', wsig, xsig].join('|');
    var chips = '<span class="hc">อายุ ' + hub.date.age + '</span>';
    if (st.F.has_heir) chips += '<span class="hc heir">👶 ' + esc(typeof st.F.heir_name === 'string' ? st.F.heir_name : 'ทายาท') + '</span>';
    if (st.F.poisoned) chips += '<span class="hc poison">☠ ถูกพิษ</span>';
    ['hero', 'status-hero'].forEach(function (id) {
      var el = $('#' + id);
      var k2 = key + '|' + id;
      if (el.getAttribute('data-key') === k2) { var ch = $('.hero-chips', el); if (ch) ch.innerHTML = chips; return; }
      el.setAttribute('data-key', k2);
      el.innerHTML = '<div class="hero-bg">' + bgSVG(st.origin !== 'maid' && st.rank === 0 ? 'family_home' : HALL_BG[st.rank], hub.date.season) + '</div><div class="hero-shade"></div>' +
        '<div class="hero-fig">' + portrait('player', expr, { rank: st.rank, origin: st.origin, vb: '30 0 340 440', outfit: true }) + '</div>' +
        '<div class="hero-info"><div class="hero-name">' + esc(st.name) + '</div>' +
        '<div class="hero-rank">' + seal(st.rank, 'sm') + '<span><b>' + esc(hub.rankTitle) + '</b><small>' + esc(R.zh) + '</small></span></div>' +
        '<div class="hero-hall">🏠 ' + esc(R.hall) + '</div><div class="hero-chips">' + chips + '</div>' +
        '<div class="hero-btns"><button type="button" class="btn btn-ghost sm btn-wardrobe">👘 ตู้เสื้อผ้า</button>' +
        (xs.batches > 0 ? '<button type="button" class="btn btn-ghost sm btn-xiunu">📜 ซิ่วหนี่' + (xs.pending ? '<i class="xn-dot"></i>' : '') + '</button>' : '') + '</div></div>';
    });
  }

  function heartsHTML(v) {
    var n = clamp(Math.round(Math.abs(v) / 20), 0, 5), neg = v < 0, s = '';
    for (var i = 0; i < 5; i++) s += '<i class="ht ' + (i < n ? (neg ? 'neg' : 'on') : '') + '">' + (i < n ? '♥' : '♡') + '</i>';
    return s;
  }
  function relKnown(c) { var st = Game.st; return !!(Seen.d.c[c] || (st.R[c] || 0) !== 0 || (c === 'prince' && st.F.met_prince) || (c === 'doctor' && st.F.met_doctor)); }

  function renderStats(hub) {
    var st = Game.st, g = hub.gate, S = st.S, dl = (Game._deltas && Game._deltas.S) || {}, html = '';
    STAT_ROWS.forEach(function (k) {
      var m = Q.STAT_META[k], v = S[k], tick = '', need = (k === 'favor' || k === 'prestige') ? needOf(g, k) : null;
      if (need) tick = '<b class="tick ' + (need.ok ? 'ok' : '') + '" style="left:' + clamp(need.want, 0, 100) + '%" title="เกณฑ์เลื่อนขั้น ' + need.want + '"></b>';
      var low = (k === 'health' && v < 30), dcls = '';
      var d = dl[k]; var good = (k === 'threat') ? d < 0 : d > 0;
      var delta = (d && !FAST) ? '<em class="delta ' + (good ? 'up' : 'dn') + '">' + sign(d) + '</em>' : '';
      html += '<div class="stat-row s-' + k + (low ? ' low' : '') + dcls + '" data-stat="' + k + '" style="--sc:' + m.color + '"><span class="s-ico">' + esc(m.icon) + '</span>' +
        '<span class="s-name">' + esc(m.th) + '</span><span class="s-bar"><i style="width:' + clamp(v, 0, 100) + '%"></i>' + tick + '</span>' +
        '<span class="s-val">' + v + delta + '</span><small class="s-hint">' + esc(m.hint) + (need ? ' · เกณฑ์เลื่อนขั้น ' + need.want : '') + '</small></div>';
    });
    var sd = dl.silver, sm = Q.STAT_META.silver;
    html += '<div class="stat-row s-silver" data-stat="silver"><span class="s-ico coin">銀</span><span class="s-name">' + esc(sm.th) + '</span><span class="s-coin"><b>' + S.silver + '</b><small>+' + Q.RANKS[st.rank].stipend + '/ฤดู</small>' + ((sd && !FAST) ? '<em class="delta ' + (sd > 0 ? 'up' : 'dn') + '">' + sign(sd) + '</em>' : '') + '</span><small class="s-hint">' + esc(sm.hint) + '</small></div>';
    $('#stats').innerHTML = html;
  }

  function relRow(c, v, label) {
    var st = Game.st, known = relKnown(c) || c === 'emperor', gone = (c === 'friend' && st.F.friend_alive === false) || (c === 'maid' && st.F.maid_alive === false);
    var nm = c === 'emperor' ? 'ฮ่องเต้เฉิงผิง' : charShort(c);
    var cls = 'rel-row' + (known ? '' : ' unknown') + (gone ? ' gone' : '') + (v < 0 && known ? ' neg' : '');
    var ava = known ? portrait(c, 'neutral', { bust: true }) : '<span class="ava-q">?</span>';
    var right = gone ? '<span class="rel-gone">🕊 จากไปแล้ว</span>' : (known ? '<span class="hearts">' + heartsHTML(v) + '</span>' : '<span class="rel-gone">ยังไม่รู้จัก</span>');
    var tag = known && !gone ? (v <= -20 ? '<small class="rel-tag bad">เป็นศัตรู</small>' : (v >= 60 ? '<small class="rel-tag good">สนิทสนม</small>' : '')) : '';
    return '<div class="' + cls + '" data-rel="' + c + '" style="--cc:' + ((Q.CHARS[c] || {}).color || '#caa') + '"><span class="rel-ava">' + ava + '</span><span class="rel-main"><b>' + esc(known ? nm : '???') + '</b>' + (label ? '<small>' + esc(label) + '</small>' : tag) + '</span>' + right + (known && !gone ? '<span class="rel-val">' + v + '</span>' : '') + '</div>';
  }
  var _relSig = '';
  function renderRels() {
    var st = Game.st;
    var sig = [st.S.favor, st.F.friend_alive, st.F.maid_alive].concat(REL_MAIN.concat(REL_EXTRA).map(function (c) { return (st.R[c] || 0) + (relKnown(c) ? 'k' : 'u'); })).join(',');
    if (sig === _relSig && $('#rels').firstChild) return;
    _relSig = sig;
    var html = relRow('emperor', st.S.favor, 'ความโปรดปราน');
    REL_MAIN.forEach(function (c) { html += relRow(c, st.R[c] || 0); });
    var extra = REL_EXTRA.filter(relKnown);
    if (extra.length) { html += '<div class="rel-sep">คู่แข่งและคนรอบตัว</div>'; extra.forEach(function (c) { html += relRow(c, st.R[c] || 0); }); }
    $('#rels').innerHTML = html;
  }

  function renderActions(hub) {
    var st = Game.st, box = $('#action-groups'), html = '', byGrp = {};
    hub.actions.forEach(function (a) { (byGrp[a.grp] = byGrp[a.grp] || []).push(a); });
    var order = GROUPS.slice();
    Object.keys(byGrp).forEach(function (k) { if (!order.some(function (g) { return g[0] === k; })) order.push([k, 'อื่นๆ', '✦']); });
    if (hub.ap <= 0) html += '<div class="ap-empty">หมดแรงในฤดูนี้แล้ว — ได้เวลาสิ้นสุดฤดูกาล</div>';
    order.forEach(function (g) {
      var list = byGrp[g[0]]; if (!list || !list.length) return;
      html += '<section class="agroup" data-grp="' + g[0] + '"><h3><svg class="orn"><use href="#orn-cloud"/></svg><span>' + g[2] + ' ' + esc(g[1]) + '</span><svg class="orn"><use href="#orn-cloud"/></svg></h3><div class="agrid">';
      list.forEach(function (a) {
        var dis = a.disabled;
        html += '<button type="button" class="action-card' + (dis ? ' disabled' : '') + '" data-action="' + a.id + '" data-grp="' + a.grp + '"' + (dis ? ' disabled' : '') + '>' +
          '<span class="ac-ico">' + a.icon + '</span><span class="ac-body"><b class="ac-name">' + esc(a.th) + '</b><span class="ac-desc">' + esc(plainDesc(a.desc)) + '</span>' +
          (dis && a.why && hub.ap > 0 ? '<span class="ac-why">' + esc(a.why) + '</span>' : '') + '</span>' +
          '<span class="ac-meta">' + (a.cost && a.cost.silver ? '<i class="ac-cost">銀 ' + a.cost.silver + '</i>' : '<i class="ac-cost free">ฟรี</i>') + (a.draw ? '<i class="ac-draw" title="อาจพบเหตุการณ์">✦</i>' : '') + '</span></button>';
      });
      html += '</div></section>';
    });
    box.innerHTML = html;
    var end = $('#btn-end-season'), nxt = QL.dateInfo({ t: st.t + 1 });
    $('#end-season-sub').textContent = hub.ap > 0 ? 'ยังเหลือ ' + hub.ap + ' แต้ม · ต่อไป: ' + nxt.seasonName : 'ต่อไป: ' + nxt.seasonName + ' ' + Q.SEASON_ICON[nxt.season];
    end.classList.toggle('ready', hub.ap <= 0);
  }

  function renderHub(noSave, refresh) {
    var st = Game.st; if (!st) return;
    var hub = QL.hub(st);
    $('#action-groups').classList.toggle('still', !!refresh);
    renderTop(hub); renderClimbStrip(hub); renderLadder(hub); renderHero(hub); renderStats(hub); renderRels(); renderActions(hub);
    renderXnBanner();
    Seen.rank(st.rank);
    if (st.rank >= 1 && !refresh) tip('wd_intro', 'ท่านมี <b>ตู้เสื้อผ้า</b> แล้ว — เลือกชุด เครื่องหัว และเครื่องประดับได้ตามฐานะ ซื้อเพิ่มด้วยเงินตำลึง หรือรับเป็นของพระราชทานเมื่อเลื่อนขั้น เครื่องแต่งกายมีผลต่อการทอยเต๋าและความอิจฉาจากศัตรู', '.btn-wardrobe');
    if (!noSave && !st.cur && st.phase !== 'ended') Saves.save('auto', st);
    Game._deltas = null;
  }

  var _toastT = null;
  function chipHTML(f) {
    if (!f) return '';
    var h2 = '';
    Q.STAT_KEYS.forEach(function (k) {
      var d = f.S && f.S[k]; if (!d) return;
      var good = k === 'threat' ? d < 0 : d > 0;
      h2 += '<i class="fchip ' + (good ? 'up' : 'dn') + '"><u>' + esc(statIcon(k)) + '</u>' + esc(statName(k)) + ' ' + sign(d) + '</i>';
    });
    Object.keys((f && f.R) || {}).forEach(function (k) {
      var d = f.R[k]; if (!d) return;
      h2 += '<i class="fchip ' + (d > 0 ? 'up' : 'dn') + '"><u>♥</u>' + esc(charShort(k)) + ' ' + sign(d) + '</i>';
    });
    return h2;
  }
  function hubToast(res) {
    var el = $('#hub-toast');
    el.innerHTML = '<div class="ht-card"><span class="ht-ico">' + esc((QL.action(res.action) || {}).icon || '✦') + '</span><div class="ht-body"><b>' + esc(res.th) + '</b><p>' + esc(res.line || '') + '</p><div class="ht-chips">' + chipHTML(res.flash) + '</div></div></div>';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(_toastT);
    _toastT = setTimeout(function () { el.classList.remove('show'); }, 5200);
  }
  function toast(msg, ms) {
    var root = $('#toast-root'), t = h('div', 'toast', esc(msg));
    root.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ms || (FAST ? 1500 : 2600));
  }
  Game.toast = toast;

  function setHubTab(tab) {
    $('#hub-screen').setAttribute('data-tab', tab);
    $$('#hub-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (tab === 'ladder') scrollLadder();
  }
  function scrollLadder() {
    var cur = $('#ladder .rung.current'), pane = $('#panel-ladder');
    if (!cur || !pane) return;
    try { pane.scrollTop = Math.max(0, cur.offsetTop - Math.min(150, pane.clientHeight * 0.28)); } catch (e) { /* ignore */ }
  }

  /* the hub waits for either "an action produced events" or "end the season" */
  function hubWait() {
    return new Promise(function (resolve) { Game._hubWait = { resolve: resolve }; });
  }
  function resolveHub(v) { var w = Game._hubWait; if (w) { Game._hubWait = null; w.resolve(v); } }

  function doHubAction(id) {
    if (!Game._hubWait) return;
    var st = Game.st, res = QL.doAction(st, id);
    if (!res.ok) { toast(res.why || 'ไม่สามารถทำได้'); return; }
    snd('pick');
    if (!res.event && !st.pendingEnding && QL.systemEnd(st)) st.pendingEnding = QL.systemEnd(st);
    if (res.event || st.pendingEnding) { resolveHub({ type: 'events' }); return; }
    Game._deltas = res.flash;
    hubToast(res);
    snd(res.flash && res.flash.S && Object.keys(res.flash.S).some(function (k) { return k !== 'threat' && res.flash.S[k] < 0; }) ? 'fail' : 'chime');
    renderHub(false, true);
    if (st.ap <= 0) tip('hub_end', 'ใช้แต้มกำลังครบแล้ว — กด <b>สิ้นสุดฤดูกาล</b> เพื่อเดินหน้าสู่ฤดูต่อไป', '#btn-end-season');
  }
  function onEndSeasonClick() {
    if (!Game._hubWait) return;
    var st = Game.st;
    var xp = QL.ensureX(st).pending;
    if (xp && xp.deadlineLeft === undefined && st.t >= xp.deadline && !FAST) {
      confirmBox('ยังมีผู้เข้าคัดเลือกรอพิจารณา', 'ถ้าสิ้นสุดฤดูกาลนี้ ฮองเฮาจะจัดสรรผู้ที่ท่านยังไม่ได้ตัดสินใจให้เอง ต้องการไปพิจารณาก่อนหรือไม่?', 'ไปพิจารณา', 'สิ้นสุดฤดูกาลเลย').then(function (go) { if (go) openXiunu('pending'); else resolveHub({ type: 'end' }); });
      return;
    }
    if (st.ap > 0 && !FAST) {
      confirmBox('ยังเหลือแต้มกำลัง ' + st.ap + ' แต้ม', 'ต้องการสิ้นสุดฤดูกาลเลยหรือไม่? แต้มที่เหลือจะหายไป', 'สิ้นสุดฤดูกาล', 'อยู่ต่ออีกนิด').then(function (ok) { if (ok) resolveHub({ type: 'end' }); });
      return;
    }
    resolveHub({ type: 'end' });
  }

  /* ============================================================
     9. EVENT / VISUAL-NOVEL MODE
     ============================================================ */
  var KIND_LABEL = { random: 'เหตุการณ์', chapter: 'เรื่องราวหลัก', chain: 'เรื่องราวต่อเนื่อง', festival: 'เทศกาล', promo: 'ราชโองการ', ending: 'ตอนจบ' };
  var _sprites = {}, _bgKey = '', _bgFront = 'a', _flashT = null, _autoT = null, _skipT = null;

  function onStage(c) { return !!_sprites[c] && !_sprites[c].leaving; }

  function setBg(key, season) {
    key = key || 'small_court';
    var k = key + '|' + season;
    if (k === _bgKey) return;
    _bgKey = k;
    var nxt = _bgFront === 'a' ? 'b' : 'a', nEl = $('#bg-' + nxt), cEl = $('#bg-' + _bgFront);
    nEl.innerHTML = bgSVG(key, season);
    nEl.classList.add('on'); cEl.classList.remove('on');
    _bgFront = nxt;
    mood(BG_MOOD[key] || 'palace');
  }

  function renderStage(v) {
    var st = Game.st, stage = $('#stage'), cast = (v.cast || []).slice(0, 3), present = {};
    stage.className = 'stage n' + cast.length;
    var speakerOn = cast.some(function (ce) { return ce.c === v.who; });
    cast.forEach(function (ce) {
      present[ce.c] = true;
      var expr = (ce.c === v.who && v.x) ? v.x : (ce.x || 'neutral');
      var key = [ce.c, expr, st.rank, st.origin].join('|');
      var sp = _sprites[ce.c];
      if (!sp || sp.leaving) {
        if (sp && sp.el.parentNode) sp.el.parentNode.removeChild(sp.el);
        var el = h('div', 'sprite enter'); el.dataset.c = ce.c;
        stage.appendChild(el);
        sp = _sprites[ce.c] = { el: el, key: '', leaving: false };
      }
      if (sp.key !== key) {
        var changed = sp.key !== '';
        sp.el.innerHTML = portrait(ce.c, expr, { rank: st.rank, origin: st.origin, outfit: ce.c === 'player' ? true : (ce.c === 'maiden' ? QL.focusLook(st) : undefined) });
        sp.key = key;
        if (changed) { sp.el.classList.remove('swap'); void sp.el.offsetWidth; sp.el.classList.add('swap'); }
      }
      sp.el.dataset.pos = ce.pos || 'center';
      sp.el.classList.toggle('speaking', ce.c === v.who);
      sp.el.classList.toggle('dim', speakerOn && ce.c !== v.who);
      Seen.char(ce.c);
    });
    Object.keys(_sprites).forEach(function (c) {
      if (present[c]) return;
      var sp = _sprites[c];
      if (sp.leaving) return;
      sp.leaving = true; sp.el.classList.add('leaving');
      var rm = function () { if (sp.el.parentNode) sp.el.parentNode.removeChild(sp.el); if (_sprites[c] === sp) delete _sprites[c]; };
      if (FAST) rm(); else setTimeout(rm, 380);
    });
  }
  function clearStage() {
    Object.keys(_sprites).forEach(function (c) { var sp = _sprites[c]; if (sp.el.parentNode) sp.el.parentNode.removeChild(sp.el); });
    _sprites = {}; _bgKey = '';
    var s = $('#stage'); if (s) s.innerHTML = '';
  }

  function setDialogue(v) {
    var box = $('#dialogue-box'), c = v.who || 'narrator', C = Q.CHARS[c], isNarr = !C || c === 'narrator';
    var thought = !!(v.text && /^\s*[（(]/.test(v.text));
    box.className = 'dialogue-box' + (isNarr ? ' narr' : '') + (c === 'player' ? ' is-player' : '') + (thought ? ' thought' : '') + (v.text ? '' : ' empty');
    box.style.setProperty('--cc', (C && C.color) || '#8a7a6a');
    var nt = $('#name-tab');
    nt.innerHTML = isNarr ? '' : '<span class="nt-name">' + esc(charName(c)) + '</span>' + ((C && C.zh && c !== 'player') ? '<span class="nt-zh">' + esc(C.zh) + '</span>' : '');
    nt.style.display = isNarr ? 'none' : '';
    var av = $('#speaker-avatar');
    if (!isNarr && !onStage(c) && c !== 'player') { av.innerHTML = portrait(c, v.x || 'neutral', { bust: true, outfit: c === 'maiden' ? QL.focusLook(Game.st) : undefined }); av.classList.add('on'); Seen.char(c); }
    else if (!isNarr && c === 'player' && !onStage('player')) { av.innerHTML = portrait('player', v.x || 'neutral', { bust: true, rank: Game.st.rank, origin: Game.st.origin, outfit: true }); av.classList.add('on'); }
    else { av.innerHTML = ''; av.classList.remove('on'); }
    $('#caption').classList.remove('on');
    if (v.card && v.text) { var cp = $('#caption'); cp.textContent = v.card; cp.classList.add('on'); }
  }

  function stopTyping() { if (Game._typing) { Game._typing.cancel(); Game._typing = null; } }
  function typeText(text, onDone) {
    var el = $('#dialogue-text'), box = $('#dialogue-box');
    stopTyping();
    box.classList.remove('complete');
    text = text || '';
    var cl = graphemes(text), speed = Game.settings.speed;
    var on = h('span', 'tw-on'), off = h('span', 'tw-off');
    el.innerHTML = ''; el.appendChild(on); el.appendChild(off);
    var finished = false, tm = null;
    function done() {
      if (finished) return; finished = true; clearTimeout(tm); Game._typing = null;
      on.textContent = text; off.textContent = '';
      box.classList.add('complete');
      if (onDone) onDone();
    }
    if (!speed || FAST || Game.skip || !text) { done(); return; }
    var i = 0;
    off.textContent = text;
    Game._typing = { finish: done, cancel: function () { finished = true; clearTimeout(tm); } };
    (function step() {
      if (finished) return;
      i++;
      if (i >= cl.length) { done(); return; }
      on.textContent = cl.slice(0, i).join(''); off.textContent = cl.slice(i).join('');
      if (i % 3 === 0) snd('blip');
      var ch = cl[i - 1], d = speed;
      if (/[…—?!]/.test(ch)) d = speed * 6; else if (ch === ' ' || ch === '\n') d = speed * 2.5;
      tm = setTimeout(step, d);
    })();
  }

  function waitInput(kind) { return new Promise(function (resolve) { Game._wait = { kind: kind, resolve: resolve }; }); }
  function deliver(x) { var w = Game._wait; if (w) { Game._wait = null; w.resolve(x); } }

  function renderFlash(f) {
    var box = $('#flash'), nb = $('#note-bar');
    clearTimeout(_flashT);
    box.classList.remove('fade'); box.innerHTML = ''; nb.innerHTML = ''; nb.classList.remove('show');
    $('#event-screen').classList.toggle('has-note', !!(f && f.notes && f.notes.length));
    if (!f) return;
    var chips = chipHTML(f);
    if (chips) {
      box.innerHTML = chips;
      $$('.fchip', box).forEach(function (c, i) { c.style.animationDelay = (i * 90) + 'ms'; });
      var pos = false, neg = false;
      Q.STAT_KEYS.forEach(function (k) { var d = f.S && f.S[k]; if (d) { if ((k === 'threat') ? d < 0 : d > 0) pos = true; else neg = true; } });
      Object.keys(f.R || {}).forEach(function (k) { if (f.R[k] > 0) pos = true; else if (f.R[k] < 0) neg = true; });
      if (neg) snd('fail'); else if (pos) snd('pop');
      _flashT = setTimeout(function () { box.classList.add('fade'); }, 4200);
    }
    if (f.notes && f.notes.length) {
      nb.innerHTML = f.notes.map(function (n) { return '<div class="note-item"><u>✧</u>' + esc(n) + '</div>'; }).join('');
      nb.classList.add('show');
    }
  }

  function updateEvTop(v) {
    var st = Game.st, ev = QL.event(v.ev) || {};
    var gt = QL.gate(st), gfr = gt ? Math.round(gateFrac(gt) * 100) : (st.rank >= 9 ? 100 : 0);
    var gnote = gt ? ('ก้าวต่อไป: ' + Q.RANKS[gt.to].th + ' · ' + gt.need.filter(function (n) { return n.ok; }).length + '/' + gt.need.length + ' เงื่อนไข') : '';
    $('#ev-badge').innerHTML = seal(st.rank, 'sm') + '<span class="evb-txt" title="' + esc(gnote) + '"><b>' + esc(QL.rankTitle(st)) + '</b><small>' + QL.dateInfo(st).icon + ' ปีที่ ' + QL.dateInfo(st).year + '</small><i class="evb-bar"><u style="width:' + gfr + '%"></u></i></span>';
    if (Game._lastEv !== v.ev) {
      Game._lastEv = v.ev;
      var t = $('#ev-title');
      t.innerHTML = '<small>' + esc(KIND_LABEL[ev.kind] || 'เหตุการณ์') + '</small><b>' + esc(v.title) + '</b>';
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      Game.history.push({ sep: true, text: (KIND_LABEL[ev.kind] || 'เหตุการณ์') + ' · ' + v.title });
      if (Game.history.length > 200) Game.history.splice(0, Game.history.length - 200);
    }
  }
  function pushHistory(v) {
    var C = Q.CHARS[v.who];
    if (v.card && !v.text) Game.history.push({ sep: true, text: v.card });
    if (v.text) Game.history.push({ who: v.who, name: (v.who === 'narrator' || !C) ? '' : charName(v.who), color: C && C.color, text: v.text });
    if (Game.history.length > 200) Game.history.splice(0, Game.history.length - 200);
  }

  function showChoices(v) {
    var box = $('#choices'); box.innerHTML = '';
    v.choices.forEach(function (c) {
      var b = h('button', 'choice-btn' + (c.disabled ? ' disabled' : '') + (c.risky ? ' risky' : '') + (c.forced ? ' forced' : ''));
      b.type = 'button'; b.dataset.i = c.i;
      if (c.disabled) b.disabled = true;
      var meta = '';
      if (c.cost && c.cost.silver) meta += '<i class="chip cost" title="ต้องจ่ายเงินตำลึง">銀 ' + c.cost.silver + '</i>';
      if (c.pct !== null && c.pct !== undefined) {
        var st2 = Array.isArray(c.stat) ? c.stat : [c.stat];
        var lvl = c.pct >= 70 ? 'hi' : (c.pct >= 40 ? 'mid' : 'lo');
        meta += '<i class="chip check ' + lvl + '" title="ทดสอบ ' + esc(st2.map(statName).join(' + ')) + ' · โอกาสสำเร็จ ' + c.pct + '%"><u>' + st2.map(function (s) { return s === 'luck' ? '🎲' : statIcon(s); }).join('') + '</u>' + c.pct + '%</i>';
      }
      b.innerHTML = '<span class="cb-num">' + (c.i + 1) + '</span><span class="cb-main"><span class="cb-text">' + esc(c.text) + '</span>' +
        (c.hint ? '<span class="cb-hint">' + esc(c.hint) + '</span>' : '') + (c.disabled && c.why ? '<span class="cb-why">🔒 ' + esc(c.why) + '</span>' : '') + '</span>' +
        (meta ? '<span class="cb-meta">' + meta + '</span>' : '');
      b.style.animationDelay = (c.i * 70) + 'ms';
      b.addEventListener('click', function (e) { e.stopPropagation(); if (!c.disabled) deliver({ t: 'choose', i: c.i }); });
      box.appendChild(b);
    });
    box.classList.add('on');
    $('#event-screen').classList.add('choosing');
    snd('page');
    tip('ev_choice', 'ตัวเลข <b>%</b> บนตัวเลือก คือโอกาสสำเร็จของการทดสอบ · ป้าย <b>銀</b> คือเงินตำลึงที่ต้องจ่าย ตัวเลือกไม่มีถูกผิดตายตัว — ทุกทางมีราคา', '#choices');
  }
  function hideChoices() { var box = $('#choices'); box.classList.remove('on'); box.innerHTML = ''; $('#event-screen').classList.remove('choosing'); }

  function showCheckStamp(res) {
    var el = $('#check-stamp');
    el.innerHTML = '<div class="stamp ' + (res.success ? 'ok' : 'no') + '"><b>' + (res.success ? 'สำเร็จ' : 'พลาด') + '</b><small>โอกาส ' + res.pct + '%</small></div>';
    el.classList.add('show');
    snd(res.success ? 'chime' : 'fail');
    return new Promise(function (resolve) { setTimeout(function () { el.classList.remove('show'); el.innerHTML = ''; resolve(); }, FAST ? 0 : 1100); });
  }

  function stopAuto() {
    Game.auto = false; Game.skip = false; clearTimeout(_autoT); clearInterval(_skipT); _skipT = null;
    var a = $('#btn-auto'), s = $('#btn-skip'); if (a) a.classList.remove('on'); if (s) s.classList.remove('on');
  }
  function scheduleAuto(len) {
    clearTimeout(_autoT);
    if (!Game.auto && !Game.skip) return;
    var d = Game.skip ? 60 : Math.max(900, Game.settings.autoDelay + len * (Game.settings.speed ? 22 : 12));
    _autoT = setTimeout(function () { if (Game._wait && Game._wait.kind === 'advance') deliver({ t: 'advance' }); }, d);
  }
  function setAuto(on) {
    Game.auto = !!on; if (on) { Game.skip = false; $('#btn-skip').classList.remove('on'); }
    $('#btn-auto').classList.toggle('on', Game.auto); $('#btn-auto').textContent = Game.auto ? '⏸' : '▶';
    if (Game.auto && Game._wait && Game._wait.kind === 'advance' && !Game._typing) scheduleAuto(($('#dialogue-text').textContent || '').length);
    else clearTimeout(_autoT);
  }
  function setSkip(on) {
    Game.skip = !!on; if (on) { Game.auto = false; $('#btn-auto').classList.remove('on'); $('#btn-auto').textContent = '▶'; }
    $('#btn-skip').classList.toggle('on', Game.skip);
    clearTimeout(_autoT);
    if (Game.skip) { if (Game._typing) Game._typing.finish(); if (Game._wait && Game._wait.kind === 'advance') scheduleAuto(0); }
  }

  /* one view = one beat of the story */
  async function presentView(v, run) {
    var st = Game.st;
    $('#event-screen').classList.toggle('is-ending', !!v.isEnding);
    if (v.isEnding && Game._endMark !== v.ev) { Game._endMark = v.ev; Game._endNew = Seen.ending(v.ev); }
    setBg(v.bg, st.t % 4);
    updateEvTop(v);
    pushHistory(v);
    renderStage(v);
    renderFlash(v.flash);
    if (v.who && v.who !== 'narrator' && Q.CHARS[v.who]) Seen.char(v.who);

    if (v.kind === 'card') {
      $('#caption').classList.remove('on');
      $('#dialogue-box').classList.add('empty');
      var co = $('#card-overlay');
      $('#card-text').textContent = v.card;
      co.classList.add('show'); $('#event-screen').classList.add('card-on');
      if (Game.skip) setSkip(false);
      var inp0 = await waitInput('advance');
      if (run !== Game._run) return;
      co.classList.remove('show'); $('#event-screen').classList.remove('card-on');
      await maybeCeremony(run);
      if (run !== Game._run) return;
      QL.advance(st);
      return;
    }

    setDialogue(v);
    if (v.kind === 'choice') {
      await maybeCeremony(run);
      if (run !== Game._run) return;
      if (Game.skip) setSkip(false);
      clearTimeout(_autoT);
      typeText(v.text, function () { showChoices(v); });
      if (!v.text) showChoices(v);
      var pick = await waitInput('choice');
      if (run !== Game._run) return;
      hideChoices();
      var label = v.choices[pick.i] ? v.choices[pick.i].text : '';
      Game.history.push({ choice: true, text: label });
      snd('pick');
      var res = QL.choose(st, pick.i);
      if (res && res.success !== null && res.success !== undefined) { await showCheckStamp(res); }
      return;
    }

    /* plain line */
    tip('ev_click', 'แตะที่หน้าจอ · กด <b>Space</b> หรือ <b>Enter</b> เพื่อไปต่อ — แตะขณะข้อความกำลังพิมพ์เพื่อแสดงทั้งหมด', '#dialogue-box');
    typeText(v.text, function () { if (Game.auto || Game.skip) scheduleAuto((v.text || '').length); });
    await waitInput('advance');
    if (run !== Game._run) return;
    clearTimeout(_autoT);
    $('#caption').classList.remove('on');
    await maybeCeremony(run);
    if (run !== Game._run) return;
    QL.advance(st);
  }

  async function playEvent(run) {
    var st = Game.st, v, guard = 0;
    show('event-screen');
    while (run === Game._run && (v = QL.view(st)) && guard++ < 2000) {
      await presentView(v, run);
      if (run !== Game._run) return;
    }
    if (run !== Game._run) return;
    if (st.cur && !QL.view(st)) st.cur = null;        /* defensive: broken node graph must never freeze the UI */
    hideChoices(); setSkip(false);
    $('#card-overlay').classList.remove('show'); $('#event-screen').classList.remove('card-on');
    $('#flash').innerHTML = ''; $('#note-bar').classList.remove('show');
  }

  function onAdvanceClick(e) {
    if (e && e.target && e.target.closest && e.target.closest('.choice-btn')) return;
    if (!$('#modal-root').hidden) return;
    if (Game._typing) { Game._typing.finish(); return; }
    if (Game._wait && Game._wait.kind === 'advance') { snd('page'); deliver({ t: 'advance' }); }
  }
  function onCardClick() { if (Game._wait && Game._wait.kind === 'advance') { snd('page'); deliver({ t: 'advance' }); } }

  function openLog() {
    var items = Game.history.slice(-80), html = '';
    if (!items.length) html = '<p class="empty-note">ยังไม่มีบทสนทนาให้ย้อนอ่าน</p>';
    items.forEach(function (it) {
      if (it.sep) html += '<div class="log-sep"><span>' + esc(it.text) + '</span></div>';
      else if (it.choice) html += '<div class="log-choice">➤ ' + esc(it.text) + '</div>';
      else html += '<div class="log-line"><b style="color:' + esc(it.color || '#c9b68a') + '">' + esc(it.name || '') + '</b><p>' + esc(it.text) + '</p></div>';
    });
    openModal({ title: 'ย้อนอ่านบทสนทนา', cls: 'modal-log', tabs: [{ id: 'log', label: 'บทสนทนา', render: function (el) { el.innerHTML = '<div class="log-list">' + html + '</div>'; el.scrollTop = el.scrollHeight; var l = $('.log-list', el); if (l) l.scrollTop = l.scrollHeight; } }] });
  }

  /* ============================================================
     10. OVERLAYS: ceremony (edict), season report, confirm, tips
     ============================================================ */
  function showOverlay(id) { var el = document.getElementById(id); if (el) { el.hidden = false; void el.offsetWidth; el.classList.add('open'); } }
  function hideOverlay(id) { var el = document.getElementById(id); if (el) { el.classList.remove('open'); el.hidden = true; } }

  var EDICT_LEAD = {
    1: 'ฟ้าดินเป็นพยาน {name} ผ่านการคัดเลือกเข้าถวายงานในวังหลัง รู้จักหน้าที่ นอบน้อมต่อกฎ จึงพระราชทานฐานันดรเป็น',
    2: '{name} ปรนนิบัติเรียบร้อย รู้กาลเทศะ เป็นที่เอ็นดูของผู้คน บัดนี้พระราชทานเลื่อนฐานันดรเป็น',
    3: '{name} มีใจซื่อสัตย์ ฝ่าความยากลำบากมาด้วยสติปัญญา ควรได้รับเกียรติยิ่งขึ้น พระราชทานฐานันดรเป็น',
    4: '{name} มีความดีความชอบต่อราชสำนักและวังหลัง พระราชทานฉายา ตำหนักเป็นของตน และฐานันดรเป็น',
    5: '{name} เป็นที่ไว้วางพระทัย เป็นแบบอย่างแก่สนมทั้งหลาย พระราชทานฐานันดรสนมชั้นสูงเป็น',
    6: '{name} ร่วมแบกรับภาระของวังหลัง เป็นที่ประจักษ์แก่สายตาทั่วแผ่นดิน พระราชทานฐานันดรอันดับสามเป็น',
    7: '{name} เป็นเสาหลักแห่งวังหลัง ใกล้ชิดแท่นฮองเฮาเพียงหนึ่งก้าว พระราชทานฐานันดรเป็น',
    8: 'ฟ้าดินและบรรพชนเป็นพยาน แต่งตั้ง {name} เป็นมารดาแห่งแผ่นดิน ถือตราหงส์ ครองตำหนักขุนหนิง ในฐานะ',
    9: 'ฟ้าสวรรค์ประทานบุญบารมี ทั่วหล้าถวายพระราชสมัญญาแด่ {name} ผู้เป็นมารดาของฮ่องเต้พระองค์ใหม่ ในฐานะ'
  };
  var REWARD_LABEL = { prestige: 'ศักดิ์ศรี', silver: 'เงินตำลึง', favor: 'ความโปรดปราน', threat: 'ภัยรอบกาย' };
  var _cer = null;

  function ceremony() {
    var st = Game.st, up = !!st.promoted, info = up ? st.promoted : st.demoted;
    if (!info) return Promise.resolve();
    if (_cer) return _cer.promise;
    var from = info.from, to = info.to, R = Q.RANKS[to], root = $('#ceremony');
    root.classList.toggle('demote', !up);
    root.classList.toggle('grand', up && to >= 8);
    $('#cer-head').textContent = up ? '奉天承运 皇帝诏曰' : '圣谕 · 降位诏书';
    var okSpan = $('#btn-ceremony-ok span'); if (okSpan) okSpan.textContent = up ? 'น้อมรับราชโองการ' : 'น้อมรับโทษ';
    $('#cer-lead').textContent = up ? (EDICT_LEAD[to] || EDICT_LEAD[1]).replace('{name}', st.name)
      : 'เพราะความผิดพลาดและเสียงครหาในวังหลัง {name} ถูกลดฐานันดรลงเป็น'.replace('{name}', st.name);
    $('#cer-change').innerHTML = seal(from, 'ghost lg') + '<span class="cer-arrow">' + (up ? '➜' : '⬇') + '</span>' + seal(to, 'lg ' + (up ? 'stampin' : 'broken'));
    $('#cer-title').textContent = QL.rankTitle(st, to);
    $('#cer-zh').textContent = R.zh + ' · ' + R.note;
    var rw = '';
    if (up) {
      var op = R.onPromote || {};
      Object.keys(op).forEach(function (k) { if (op[k]) rw += '<li><u>' + (k === 'silver' ? '銀' : esc(statIcon(k))) + '</u>' + esc(REWARD_LABEL[k] || statName(k)) + ' <b class="' + (k === 'threat' ? 'dn' : 'up') + '">' + sign(op[k]) + '</b></li>'; });
      rw += '<li><u>🏠</u>ที่ประทับ: <b>' + esc(R.hall) + '</b></li>';
      if (info.gifts && info.gifts.length) rw += '<li><u>👘</u>ของพระราชทาน: <b class="up">' + esc(info.gifts.join(' · ')) + '</b></li>';
      if (R.stipend) rw += '<li><u>銀</u>เบี้ยหวัดประจำฤดู <b class="up">' + R.stipend + ' ตำลึง</b></li>';
    } else {
      rw += '<li><u>🏠</u>ย้ายไปประทับ: <b>' + esc(R.hall) + '</b></li><li><u>銀</u>เบี้ยหวัดประจำฤดู <b class="dn">' + R.stipend + ' ตำลึง</b></li>';
    }
    $('#cer-rewards').innerHTML = rw;
    var d = QL.dateInfo(st);
    $('#cer-date').textContent = 'รัชศก' + Q.ERA + ' ปีที่ ' + d.year + ' · ' + d.seasonName;
    $('#cer-portrait').innerHTML = portrait('player', up ? 'smile' : 'sad', { rank: st.rank, origin: st.origin, vb: '0 0 400 560', outfit: true });
    $('#cer-sparks').innerHTML = (function () { var s = '', R2 = mk(to * 31 + 5); for (var i = 0; i < 28; i++) s += '<i class="spark amb" style="--x:' + f1(R2() * 100) + '%;--d:' + f1(5 + R2() * 6) + 's;--dl:-' + f1(R2() * 8) + 's;--s:' + f1(2 + R2() * 4) + 'px"></i>'; return s; })();
    Seen.rank(st.rank);
    showOverlay('ceremony');
    snd(up ? 'gong' : 'fail');
    var opened = Date.now(), resolveFn, prom = new Promise(function (r) { resolveFn = r; });
    _cer = { promise: prom, opened: opened, resolve: resolveFn };
    var btn = $('#btn-ceremony-ok'); try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return prom;
  }
  function closeCeremony(fromBg) {
    if (!_cer) return;
    if (fromBg && !FAST && Date.now() - _cer.opened < 1500) return;
    if (!FAST && Date.now() - _cer.opened < 350) return;
    var c = _cer; _cer = null;
    QL.ackPromotion(Game.st);
    hideOverlay('ceremony');
    snd('page');
    c.resolve();
  }
  function maybeCeremony(run) {
    var st = Game.st;
    if (!(st.promoted || st.demoted)) return Promise.resolve();
    return ceremony();
  }

  /* season report */
  var _rep = null;
  function seasonReport(rep, prev) {
    var st = Game.st;
    if (FAST && PARAMS.get('report') !== '1') return Promise.resolve();
    var d = rep.date, g = QL.gate(st), lines = '';
    function line(ico, txt, cls) { lines += '<li class="' + (cls || '') + '"><u>' + ico + '</u><span>' + txt + '</span></li>'; }
    if (rep.stipend) line('銀', 'เบี้ยหวัดประจำฤดู <b class="up">+' + rep.stipend + ' ตำลึง</b>', 'up');
    if (rep.favorLoss) line('♥', 'ความโปรดปรานจางลง <b class="dn">−' + rep.favorLoss + '</b>', 'dn');
    if (rep.healthDelta) line('✚', 'สุขภาพ <b class="' + (rep.healthDelta > 0 ? 'up' : 'dn') + '">' + sign(rep.healthDelta) + '</b>', rep.healthDelta > 0 ? 'up' : 'dn');
    if (rep.threatDelta) line('⚠', 'ภัยรอบกาย <b class="' + (rep.threatDelta < 0 ? 'up' : 'dn') + '">' + sign(rep.threatDelta) + '</b>', rep.threatDelta < 0 ? 'up' : 'dn');
    (rep.notes || []).forEach(function (n) { line('✧', esc(n), 'note'); });
    (rep.xn || []).forEach(function (n) { line('📜', esc(n), 'note'); });
    var foot = '';
    if (rep.promo) foot = '<div class="rp-foot promo">✦ ราชโองการเลื่อนขั้นกำลังมาถึง</div>';
    else if (rep.pending) foot = '<div class="rp-foot">มีเหตุการณ์รอท่านอยู่ในฤดูนี้ ' + rep.pending + ' เรื่อง</div>';
    else foot = '<div class="rp-foot quiet">ฤดูกาลนี้ผ่านไปอย่างเงียบสงบ</div>';
    var gate = '';
    if (g) {
      var okN = g.need.filter(function (n) { return n.ok; }).length;
      gate = '<div class="rp-gate">สู่ <b>' + esc(Q.RANKS[g.to].th) + '</b> · เงื่อนไข <b>' + okN + '/' + g.need.length + '</b>' + (g.ok ? ' <span class="ready">ครบแล้ว!</span>' : '') + '</div>';
    }
    $('#report-card').innerHTML = '<div class="rp-top"><span class="rp-from">' + prev.icon + ' ' + esc(prev.seasonName) + '</span><span class="rp-arrow">➜</span><span class="rp-to">' + d.icon + ' ' + esc(d.seasonName) + '</span></div>' +
      '<h2>สิ้นสุดฤดูกาล</h2><div class="rp-date">รัชศก' + esc(Q.ERA) + ' ปีที่ ' + d.year + ' · อายุ ' + d.age + ' ปี</div>' +
      '<ul class="rp-lines">' + lines + '</ul>' + gate + foot + '<button id="btn-report-ok" class="btn btn-primary btn-xl"><span>ก้าวสู่ฤดูกาลใหม่</span></button>';
    $('#season-report').setAttribute('data-season', d.season);
    showOverlay('season-report');
    snd('chime');
    return new Promise(function (resolve) { _rep = { resolve: resolve }; });
  }
  function closeReport() {
    if (!_rep) return;
    var r = _rep; _rep = null;
    hideOverlay('season-report'); snd('page'); r.resolve();
    setTimeout(function () { tip('season', 'ความโปรดปรานจะจางลง <b>3</b> ทุกฤดู — หมั่นเข้าเฝ้าและสร้างโอกาสเพื่อรักษาไว้ · ผ่านไปครบ <b>4 ฤดู</b> คือ 1 ปี', '#stats'); }, 400);
  }

  /* confirm */
  function confirmBox(title, msg, okLabel, cancelLabel) {
    return new Promise(function (resolve) {
      var o = h('div', 'overlay confirm open'), done = false;
      o.innerHTML = '<div class="confirm-card"><h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p><div class="confirm-btns"><button class="btn btn-ghost c-no">' + esc(cancelLabel || 'ยกเลิก') + '</button><button class="btn btn-primary c-yes"><span>' + esc(okLabel || 'ตกลง') + '</span></button></div></div>';
      function fin(v) { if (done) return; done = true; if (o.parentNode) o.parentNode.removeChild(o); resolve(v); }
      $('.c-no', o).onclick = function () { fin(false); };
      $('.c-yes', o).onclick = function () { fin(true); };
      o.addEventListener('click', function (e) { if (e.target === o) fin(false); });
      $('#app').appendChild(o);
      try { $('.c-yes', o).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    });
  }
  Game.confirm = confirmBox;

  /* tutorial tips (non-blocking ribbon) */
  var _tip = null;
  function tip(id, html, anchor) {
    if (Game.settings.tut[id]) return;
    if (FAST && PARAMS.get('tut') !== '1') return;
    if (_tip) return;
    var root = $('#tip-root'), el = h('div', 'tip'), tgt = anchor ? $(anchor) : null;
    el.innerHTML = '<span class="tip-ico">✦</span><div class="tip-body">' + html + '</div><button type="button" class="tip-ok">เข้าใจแล้ว</button>';
    root.appendChild(el);
    if (tgt) tgt.classList.add('tut-glow');
    var tm = null;
    function close() {
      if (!_tip) return;
      clearTimeout(tm); _tip = null;
      Game.settings.tut[id] = 1; saveSettings();
      if (tgt) tgt.classList.remove('tut-glow');
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    _tip = { id: id, close: close };
    $('.tip-ok', el).addEventListener('click', function (e) { e.stopPropagation(); close(); });
    tm = setTimeout(close, 16000);
  }

  /* ============================================================
     11. ENDING SCREEN
     ============================================================ */
  var END_TYPE = {
    'true': { label: 'ตอนจบแท้จริง', glyph: '凤', cls: 'true' },
    good: { label: 'ตอนจบอันงดงาม', glyph: '吉', cls: 'good' },
    neutral: { label: 'ตอนจบสามัญ', glyph: '平', cls: 'neutral' },
    bad: { label: 'ตอนจบอันเศร้า', glyph: '凶', cls: 'bad' }
  };
  function allEndings() { return Q.events.filter(function (e) { return e.kind === 'ending'; }); }
  function showEnding() {
    var st = Game.st, sum = QL.summary(st), T = END_TYPE[sum.type] || END_TYPE.neutral;
    if (Game._endMark !== sum.id) { Game._endMark = sum.id; Game._endNew = Seen.ending(sum.id); }
    var isNew = Game._endNew;
    var ev = QL.event(sum.id) || {};
    $('#end-bg').innerHTML = bgSVG(st.scene.bg || ev.bg || 'cining', st.t % 4);
    var scr = $('#ending-screen'); scr.className = 'screen active end-' + T.cls;
    $('#end-badge').innerHTML = '<span class="eb-glyph seal-like">' + T.glyph + '</span><span class="eb-label">' + esc(T.label) + '</span>';
    $('#end-title').textContent = sum.title;
    $('#end-sub').innerHTML = seal(sum.rank, 'sm') + '<span>' + esc(sum.name) + ' · ' + esc(sum.rankTitle) + ' (' + esc(sum.zh) + ')</span>';
    var epi = sum.hint ? '<p class="epi-hint">“' + esc(sum.hint) + '”</p>' : '';
    if (st.origin === 'maid' && (sum.type === 'true') && sum.rank >= 8) epi += '<p class="epi-maid">จากโรงซักผ้าหลวง สู่บัลลังก์หงส์ — ไม่มีใครในวังลืมเรื่องนี้</p>';
    $('#end-epi').innerHTML = epi;
    var best = [], worst = [];
    Q.REL_KEYS.forEach(function (k) {
      var v = st.R[k] || 0, gone = (k === 'friend' && st.F.friend_alive === false) || (k === 'maid' && st.F.maid_alive === false);
      if (gone) return;
      if (v >= 40) best.push([k, v]); else if (v <= -40) worst.push([k, v]);
    });
    best.sort(function (a, b) { return b[1] - a[1]; }); worst.sort(function (a, b) { return a[1] - b[1]; });
    function names(list) { return list.slice(0, 3).map(function (p) { return esc(charShort(p[0])); }).join(' · '); }
    var rows = '<div class="es"><u>⌛</u><span>เวลาที่ผ่านไป</span><b>' + sum.years + ' ปี (' + sum.seasons + ' ฤดู)</b></div>' +
      '<div class="es"><u>🎂</u><span>อายุ</span><b>' + sum.age + ' ปี</b></div>' +
      '<div class="es"><u>♛</u><span>ฐานันดรสุดท้าย</span><b>' + esc(sum.rankTitle) + '</b></div>' +
      '<div class="es"><u>👶</u><span>ทายาท</span><b>' + (sum.heir ? esc(typeof st.F.heir_name === 'string' ? st.F.heir_name : 'มี') : 'ไม่มี') + '</b></div>';
    ['favor', 'prestige', 'wit', 'charm', 'talent', 'virtue'].forEach(function (k) {
      var m = Q.STAT_META[k];
      rows += '<div class="es bar" style="--sc:' + m.color + '"><u>' + esc(m.icon) + '</u><span>' + esc(m.th) + '</span><i><s style="width:' + clamp(sum.S[k], 0, 100) + '%"></s></i><b>' + sum.S[k] + '</b></div>';
    });
    if (best.length) rows += '<div class="es wide"><u>♥</u><span>ผู้ที่ยังอยู่ในใจ</span><b>' + names(best) + '</b></div>';
    if (worst.length) rows += '<div class="es wide"><u>⚔</u><span>ผู้ที่เป็นศัตรู</span><b>' + names(worst) + '</b></div>';
    $('#end-stats').innerHTML = rows;
    var tot = allEndings().length, got = Seen.countEndings();
    $('#end-new').innerHTML = (isNew ? '<span class="en-new">✦ ปลดล็อกตอนจบใหม่!</span>' : '<span class="en-old">เคยพบตอนจบนี้แล้ว</span>') + '<span class="en-count">ตอนจบที่พบแล้ว ' + got + ' / ' + tot + '</span>';
    show('ending-screen');
    mood(sum.type === 'bad' ? 'sad' : (sum.type === 'true' ? 'joy' : 'palace'));
    try { $('#ending-screen .end-scroll').scrollTop = 0; } catch (e) { /* ignore */ }
    stopAuto();
  }

  /* ============================================================
     12. MODAL (menu, archive, how-to)
     ============================================================ */
  var _modal = null;
  function openModal(cfg) {
    var root = $('#modal-root');
    _modal = { cfg: cfg, cur: null };
    root.hidden = false;
    root.innerHTML = '<div class="modal ' + (cfg.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(cfg.title) + '"><div class="modal-head"><svg class="orn"><use href="#orn-cloud"/></svg><h2>' + esc(cfg.title) + '</h2><svg class="orn"><use href="#orn-cloud"/></svg><button type="button" class="icon-btn modal-x" aria-label="ปิด">✕</button></div><div class="modal-tabs"></div><div class="modal-body"></div></div>';
    var tabs = $('.modal-tabs', root);
    cfg.tabs.forEach(function (t) {
      var b = h('button', 'mtab', esc(t.label)); b.type = 'button'; b.dataset.tab = t.id;
      b.addEventListener('click', function () { snd('page'); modalTab(t.id); });
      tabs.appendChild(b);
    });
    if (cfg.tabs.length < 2) tabs.style.display = 'none';
    $('.modal-x', root).addEventListener('click', closeModal);
    modalTab(cfg.start || cfg.tabs[0].id);
    void root.offsetWidth; root.classList.add('open');
    snd('page');
    try { $('.modal-x', root).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function modalTab(id) {
    var root = $('#modal-root'), body = $('.modal-body', root);
    if (!_modal) return;
    _modal.cur = id;
    $$('.mtab', root).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === id); });
    body.innerHTML = ''; body.scrollTop = 0;
    var t = _modal.cfg.tabs.filter(function (x) { return x.id === id; })[0];
    if (t) t.render(body);
  }
  function refreshTab() { if (_modal) { var b = $('#modal-root .modal-body'), top = b ? b.scrollTop : 0; modalTab(_modal.cur); if (b) b.scrollTop = top; } }
  function closeModal() {
    var root = $('#modal-root'); if (!root) return;
    root.classList.remove('open'); root.hidden = true; root.innerHTML = ''; _modal = null;
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* ignore */ }
  }
  Game.closeModal = closeModal;

  /* ---- tab: save / load ---- */
  function slotName(k) { return k === 'auto' ? 'บันทึกอัตโนมัติ' : 'ช่องบันทึก ' + k; }
  function fmtTime(ts) { try { return new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } }
  function tabSaves(el) {
    var all = Saves.all(), st = Game.st, canSave = !!st && st.phase !== 'ended';
    var html = '<p class="tab-note">' + (canSave ? 'บันทึกได้ทุกช่วงของเรื่อง · ระบบจะบันทึกอัตโนมัติทุกครั้งที่ท่านกลับสู่วังหลัง' : 'เลือกช่องบันทึกที่ต้องการโหลด') + (LS.available ? '' : ' <em>(เบราว์เซอร์นี้เก็บข้อมูลชั่วคราวเท่านั้น)</em>') + '</p><div class="slots">';
    Saves.KEYS.forEach(function (k) {
      var r = all[k], ok = r && r.st && r.meta, m = ok ? r.meta : null;
      html += '<div class="slot' + (ok ? '' : ' empty') + '" data-slot="' + k + '"><div class="slot-id">' + (k === 'auto' ? '自' : k) + '</div><div class="slot-info"><b>' + esc(slotName(k)) + '</b>' +
        (ok ? '<span class="slot-main">' + seal(m.rank, 'sm') + '<span>' + esc(m.name) + ' · ' + esc(m.rankTitle) + '</span></span><small>' + esc(m.label || '') + (m.mid ? ' · กลางเหตุการณ์' : '') + (m.phase === 'ended' ? ' · จบเรื่องแล้ว' : '') + '</small><small class="slot-ts">' + esc(fmtTime(m.ts)) + '</small>' : '<span class="slot-empty">— ว่าง —</span>') +
        '</div><div class="slot-btns">' +
        (k !== 'auto' && canSave ? '<button type="button" class="btn btn-secondary sm s-save">บันทึก</button>' : '') +
        (ok ? '<button type="button" class="btn btn-primary sm s-load"><span>โหลด</span></button>' : '') +
        (ok && k !== 'auto' ? '<button type="button" class="btn btn-ghost sm s-del" aria-label="ลบ">🗑</button>' : '') + '</div></div>';
    });
    el.innerHTML = html + '</div>';
    $$('.slot', el).forEach(function (row) {
      var k = row.dataset.slot;
      var bs = $('.s-save', row), bl = $('.s-load', row), bd = $('.s-del', row);
      if (bs) bs.onclick = function () {
        var exists = !!Saves.get(k);
        (exists ? confirmBox('เขียนทับช่องบันทึก ' + k + '?', 'ข้อมูลเดิมในช่องนี้จะถูกแทนที่', 'เขียนทับ', 'ยกเลิก') : Promise.resolve(true)).then(function (ok) {
          if (!ok) return; Saves.save(k, Game.st); snd('chime'); toast('บันทึกลง ' + slotName(k) + ' แล้ว'); refreshTab();
        });
      };
      if (bl) bl.onclick = function () {
        (Game.st && Game.st.phase !== 'ended' && !FAST ? confirmBox('โหลดบันทึก?', 'ความคืบหน้าที่ยังไม่ได้บันทึกจะหายไป', 'โหลด', 'ยกเลิก') : Promise.resolve(true)).then(function (ok) { if (ok) Game.loadSlot(k); });
      };
      if (bd) bd.onclick = function () { confirmBox('ลบบันทึก?', slotName(k) + ' จะถูกลบถาวร', 'ลบ', 'ยกเลิก').then(function (ok) { if (ok) { Saves.del(k); refreshTab(); updateContinue(); } }); };
    });
  }

  /* ---- tab: diary ---- */
  function tabDiary(el) {
    var st = Game.st;
    if (!st) { el.innerHTML = '<p class="empty-note">ยังไม่ได้เริ่มบันทึกประวัติ</p>'; return; }
    var log = (st.log || []).slice().reverse();
    if (!log.length) { el.innerHTML = '<p class="empty-note">สมุดบันทึกยังว่างเปล่า — เรื่องราวของท่านเพิ่งเริ่มต้น</p>'; return; }
    var html = '<div class="diary">', last = null;
    log.forEach(function (it) {
      var key = it.t, d = QL.dateInfo({ t: it.t });
      if (key !== last) { if (last !== null) html += '</ul></section>'; html += '<section class="dy-group"><h4>' + d.icon + ' ปีที่ ' + d.year + ' · ' + esc(d.seasonName) + '</h4><ul>'; last = key; }
      html += '<li>' + esc(it.text) + '</li>';
    });
    el.innerHTML = html + '</ul></section></div>';
  }

  /* ---- tab: settings ---- */
  var SPEEDS = [{ v: 55, l: 'ช้า' }, { v: 30, l: 'ปกติ' }, { v: 14, l: 'เร็ว' }, { v: 0, l: 'ทันที' }];
  var AUTOS = [{ v: 2400, l: 'ช้า' }, { v: 1500, l: 'ปกติ' }, { v: 800, l: 'เร็ว' }];
  function segHTML(list, cur, name) {
    return '<div class="seg-ctl" data-name="' + name + '">' + list.map(function (o) { return '<button type="button" class="' + (o.v === cur ? 'on' : '') + '" data-v="' + o.v + '">' + o.l + '</button>'; }).join('') + '</div>';
  }
  function tabSettings(el) {
    var s = Game.settings;
    el.innerHTML = '<div class="set-list">' +
      '<div class="set-row"><div><b>ความเร็วข้อความ</b><small>' + (FAST ? 'โหมด fast: ข้อความแสดงทันที' : 'ความเร็วในการพิมพ์บทสนทนา') + '</small></div>' + segHTML(SPEEDS, s.speed, 'speed') + '</div>' +
      '<div class="set-row"><div><b>ความเร็วโหมดอัตโนมัติ</b><small>เวลารอก่อนไปข้อความถัดไป</small></div>' + segHTML(AUTOS, s.autoDelay, 'auto') + '</div>' +
      '<div class="set-row"><div><b>เสียงและดนตรี</b><small>เสียงพิณและเสียงประกอบ</small></div><button type="button" id="set-mute" class="switch ' + (s.mute ? '' : 'on') + '" aria-pressed="' + (!s.mute) + '"><i></i><span>' + (s.mute ? 'ปิด' : 'เปิด') + '</span></button></div>' +
      '<div class="set-row"><div><b>คำแนะนำสำหรับมือใหม่</b><small>แสดงคำแนะนำที่เคยปิดไปอีกครั้ง</small></div><button type="button" id="set-tips" class="btn btn-ghost sm">แสดงอีกครั้ง</button></div>' +
      (Game.st ? '<div class="set-row"><div><b>กลับหน้าชื่อเรื่อง</b><small>ระบบบันทึกอัตโนมัติไว้ให้แล้ว</small></div><button type="button" id="set-title" class="btn btn-secondary sm">กลับหน้าแรก</button></div>' : '') +
      '<div class="set-row danger"><div><b>ลบข้อมูลทั้งหมด</b><small>ลบบันทึก จดหมายเหตุ และการตั้งค่า (ไม่สามารถกู้คืนได้)</small></div><button type="button" id="set-erase" class="btn btn-danger sm">ลบข้อมูล</button></div>' +
      '</div>';
    $$('.seg-ctl', el).forEach(function (sc) {
      $$('button', sc).forEach(function (b) {
        b.onclick = function () {
          var v = +b.dataset.v;
          if (sc.dataset.name === 'speed') Game.settings.speed = FAST ? 0 : v; else Game.settings.autoDelay = v;
          saveSettings(); $$('button', sc).forEach(function (x) { x.classList.toggle('on', x === b); }); snd('pick');
        };
      });
    });
    $('#set-mute', el).onclick = function () { toggleMute(); refreshTab(); };
    $('#set-tips', el).onclick = function () { Game.settings.tut = {}; saveSettings(); toast('จะแสดงคำแนะนำอีกครั้ง'); };
    var t = $('#set-title', el); if (t) t.onclick = function () { confirmBox('กลับหน้าชื่อเรื่อง?', 'ความคืบหน้าล่าสุดถูกบันทึกอัตโนมัติไว้ที่ช่อง "บันทึกอัตโนมัติ"', 'กลับหน้าแรก', 'ยกเลิก').then(function (ok) { if (ok) { if (Game.st && !Game.st.cur && Game.st.phase !== 'ended') Saves.save('auto', Game.st); closeModal(); showTitle(); } }); };
    $('#set-erase', el).onclick = function () {
      confirmBox('ลบข้อมูลทั้งหมด?', 'บันทึกเกม จดหมายเหตุ และการตั้งค่าจะถูกลบถาวร', 'ลบทั้งหมด', 'ยกเลิก').then(function (ok) {
        if (!ok) return;
        LS.remove(Q.SAVE_KEY); LS.remove(Q.SEEN_KEY); LS.remove(Q.SET_KEY);
        Seen.load(); Game.settings.tut = {}; Game.settings.speed = FAST ? 0 : 30; Game.settings.mute = false; Game.settings.autoDelay = 1500; applyMute();
        updateContinue(); toast('ลบข้อมูลทั้งหมดแล้ว'); refreshTab();
      });
    };
  }

  /* ---- tab: archive of endings ---- */
  var TYPE_ORDER = ['true', 'good', 'neutral', 'bad'];
  function tabEndings(el) {
    var list = allEndings().slice(), got = 0;
    list.forEach(function (e) { if (Seen.d.e[e.id]) got++; });
    list.sort(function (a, b) {
      var ta = TYPE_ORDER.indexOf((a.ending || {}).type), tb = TYPE_ORDER.indexOf((b.ending || {}).type);
      return (ta < 0 ? 9 : ta) - (tb < 0 ? 9 : tb) || (a.id < b.id ? -1 : 1);
    });
    var html = '<div class="arc-sum"><b>' + got + '</b> / ' + list.length + ' <span>ตอนจบที่พบแล้ว</span><i><s style="width:' + (list.length ? Math.round(100 * got / list.length) : 0) + '%"></s></i></div><div class="end-grid">';
    list.forEach(function (e) {
      var m = e.ending || {}, T = END_TYPE[m.type] || END_TYPE.neutral, un = !!Seen.d.e[e.id];
      html += '<div class="end-card-s ' + T.cls + (un ? ' unlocked' : ' locked') + '" data-end="' + e.id + '"><span class="ec-glyph seal-like">' + (un ? T.glyph : '？') + '</span><div class="ec-main"><b>' + (un ? esc(m.title || e.title) : '? ? ?') + '</b>' +
        '<small class="ec-type">' + esc(T.label) + '</small><p>' + (un ? '“' + esc(m.hint || '') + '”' : '<em>คำใบ้:</em> ' + esc(m.hint || 'ยังไม่มีคำใบ้')) + '</p></div></div>';
    });
    el.innerHTML = html + '</div>';
  }

  /* ---- tab: cast gallery ---- */
  var EXPR_TH = { neutral: 'เรียบเฉย', smile: 'ยิ้ม', sad: 'เศร้า', angry: 'โกรธ', shy: 'เขินอาย', surprised: 'ตกใจ', smirk: 'แสยะยิ้ม', cry: 'ร้องไห้' };
  function tabCast(el, detail) {
    var ids = Object.keys(Q.CHARS).filter(function (c) { return c !== 'narrator'; });
    if (detail) {
      var C = Q.CHARS[detail], rk = (Game.st ? Game.st.rank : Seen.d.r) || 0, org = Game.st ? Game.st.origin : 'noble';
      var expr = el._expr || 'neutral';
      el.innerHTML = '<button type="button" class="btn btn-ghost sm cast-back">‹ กลับ</button><div class="cast-detail" style="--cc:' + C.color + '"><div class="cd-fig">' + portrait(detail, expr, { rank: rk, origin: org }) + '</div><div class="cd-info"><h3>' + esc(detail === 'player' ? (Game.st ? Game.st.name : 'หลันซี') : C.th) + '</h3><div class="cd-zh">' + esc(C.zh || '') + '</div><p>' + esc(C.role || '') + '</p>' +
        '<div class="cd-exprs">' + Q.EXPRS.map(function (x) { return '<button type="button" class="chip-btn ' + (x === expr ? 'on' : '') + '" data-x="' + x + '">' + esc(EXPR_TH[x] || x) + '</button>'; }).join('') + '</div>' +
        (detail === 'player' ? '<div class="cd-ranks">' + Q.RANKS.map(function (R, i) { return '<button type="button" class="rk-btn ' + (i === rk ? 'on' : '') + '" data-r="' + i + '" ' + (i > Math.max(Seen.d.r, rk) ? 'disabled' : '') + '>' + seal(i, 'sm' + (i > Math.max(Seen.d.r, rk) ? ' locked' : '')) + '</button>'; }).join('') + '</div><small class="cd-note">เลือกฐานันดรเพื่อดูชุดและเครื่องประดับของแต่ละขั้น</small>' : '') + '</div></div>';
      $('.cast-back', el).onclick = function () { el._expr = null; tabCast(el); };
      $$('.cd-exprs button', el).forEach(function (b) { b.onclick = function () { el._expr = b.dataset.x; tabCast(el, detail); }; });
      $$('.rk-btn', el).forEach(function (b) { b.onclick = function () { if (b.disabled) return; el._rk = +b.dataset.r; var f = $('.cd-fig', el); f.innerHTML = portrait('player', el._expr || 'neutral', { rank: el._rk, origin: org }); $$('.rk-btn', el).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      return;
    }
    var html = '<p class="tab-note">พบตัวละครใหม่ระหว่างเล่นเพื่อปลดล็อกในหน้านี้ · แตะที่การ์ดเพื่อดูภาพเต็มและอารมณ์ต่างๆ</p><div class="cast-grid">';
    ids.forEach(function (c) {
      var C = Q.CHARS[c], seen = c === 'player' || !!Seen.d.c[c];
      html += '<button type="button" class="cast-card' + (seen ? '' : ' locked') + '" data-c="' + c + '" style="--cc:' + C.color + '"><span class="cc-ava">' + portrait(c, 'neutral', { bust: true, rank: Math.max(1, Seen.d.r || 1), origin: 'noble' }) + '</span><b>' + (seen ? esc(c === 'player' ? (Game.st ? Game.st.name : 'หลันซี') : (C.short || C.th)) : '???') + '</b><small>' + (seen ? esc(C.role || '') : 'ยังไม่เคยพบ') + '</small></button>';
    });
    el.innerHTML = html + '</div>';
    $$('.cast-card', el).forEach(function (b) { b.onclick = function () { if (b.classList.contains('locked')) { toast('ยังไม่เคยพบตัวละครนี้'); return; } snd('pick'); tabCast(el, b.dataset.c); }; });
  }

  function tabHowto(el) {
    el.innerHTML = '<div class="howto">' +
      '<section><h4>🎯 เป้าหมาย</h4><p>เริ่มต้นจากสตรีธรรมดาในวังต้องห้าม ไต่ขึ้นบันได 9 ขั้น — <b>ต่าอิง → ฉังไจ้ → กุ้ยเหริน → ปิน → เฟย → กุ้ยเฟย → หวงกุ้ยเฟย → ฮองเฮา → ไทเฮา</b> ทุกก้าวมีผู้กีดขวางและทุกชัยชนะมีราคา</p></section>' +
      '<section><h4>🌸 ฤดูกาลและแต้มกำลัง</h4><p>1 ตา = 1 ฤดู (4 ฤดู = 1 ปี) แต่ละฤดูท่านมี <b>2 แต้มกำลัง</b> ใช้กับการกระทำในหน้าวังหลัง เมื่อพร้อมให้กด <b>สิ้นสุดฤดูกาล</b> เหตุการณ์ต่างๆ จะเกิดขึ้นเองเมื่อเริ่มฤดูใหม่</p></section>' +
      '<section><h4>⛰ บันไดฐานันดร</h4><p>ดูความก้าวหน้าได้ตลอดเวลาที่ <b>บันไดยศ</b> — การเลื่อนขั้นต้องครบทุกเงื่อนไข: อยู่ในขั้นนั้นนานพอ · ความโปรดปราน · ศักดิ์ศรี · และบททดสอบประจำขั้น ที่เป็นเรื่องราวสำคัญของแต่ละขั้น</p></section>' +
      '<section><h4>♥ ความโปรดปรานและความสัมพันธ์</h4><p>ความโปรดปรานของฮ่องเต้ <b>จางลงทุกฤดู</b> ต้องหมั่นสร้างโอกาสพบพระองค์ ส่วนฮองเฮา ไทเฮา และคนรอบตัว ล้วนมีผลต่อชะตาท่าน</p></section>' +
      '<section><h4>🎲 การเลือกและโอกาส</h4><p>ตัวเลือกที่มี <b>%</b> คือการทดสอบคุณสมบัติ ยิ่งสูงยิ่งสำเร็จง่าย · ป้าย <b>銀</b> คือเงินตำลึงที่ต้องจ่าย · ภัยรอบกายสูง เหตุร้ายจะมาบ่อยขึ้น</p></section>' +
      '<section><h4>👘 ตู้เสื้อผ้า</h4><p>กดปุ่ม <b>ตู้เสื้อผ้า</b> ในหน้าหลักเพื่อเลือก <b>ชุด · เครื่องหัว · สร้อยคอ · ต่างหู · ของติดตัว</b> ได้ตามฐานะ ลองสวมก่อนซื้อได้ รับของพระราชทานเมื่อเลื่อนขั้น และได้ของขวัญจากผู้คนในวัง ของแต่ละชิ้นเพิ่มโอกาสตอนทอยเต๋า (โฉมงาม พรสวรรค์ ปัญญา) หรือส่งผลต่อศักดิ์ศรีและภัยรอบกายทุกฤดู — ชุดหรูสะดุดตาช่วยให้ถูกจดจำ แต่ก็ล่อสายตาศัตรูด้วย · สวมชุด เครื่องหัว และเครื่องประดับโทนเดียวกันครบ จะได้โบนัสชุดเซ็ต</p></section>' +
      '<section><h4>🏯 ซิ่วหนี่ — สนมรุ่นใหม่</h4><p>ทุก 3 ปีมี <b>รุ่นซิ่วหนี่</b> เข้าวัง เมื่อท่านถึงขั้น <b>เฟย</b> ท่านมีสิทธิ์พิจารณาผู้เข้าคัดเลือก: สืบประวัติ → <b>รับเข้าสังกัด</b> / <b>ปล่อยตามชะตา</b> / <b>ส่งเป็นนางกำนัลข้างกาย</b> / <b>คัดออก</b> สนมที่ท่านอุปถัมภ์อาจเป็นหูเป็นตาและกราบทูลแทนท่าน แต่บางคนทะเยอทะยานจนกลายเป็นคู่แข่ง — และบางคนคือสายสืบของคนอื่นตั้งแต่แรก ดูรายชื่อได้ที่ปุ่ม <b>📜 ซิ่วหนี่</b></p></section>' +
      '<section><h4>📜 ตอนจบ</h4><p>มีตอนจบมากมายตามวิถีที่ท่านเลือก ทั้งสุข เศร้า และสงบ ดูได้ที่ <b>จดหมายเหตุ</b> · ระบบบันทึกอัตโนมัติทุกครั้งที่กลับสู่หน้าวังหลัง</p></section>' +
      '<section><h4>⌨ ปุ่มลัด</h4><p><b>Space / Enter</b> ไปต่อ · <b>1–4</b> เลือกตัวเลือก · <b>Esc</b> เมนู</p></section>' +
      '<section class="credits"><h4>✦ เครดิต</h4><p>ลิขิตหงส์ · วังหลังต้าชิง<br>เกมกลยุทธ์ผสมวิชวลโนเวล ภาพและเสียงทั้งหมดสร้างด้วยโค้ด<br>เรื่องราวเป็นนิยายสมมติ — รัชศกเฉิงผิง ฮ่องเต้ ราชวงศ์ และตัวละครทั้งหมดไม่มีตัวตนจริง ชื่อสกุลแมนจูใช้เพื่อบรรยากาศเท่านั้น</p></section></div>';
  }


  /* ============================================================
     11b. WARDROBE (ตู้เสื้อผ้า · เครื่องหัว · เครื่องประดับ)
     ============================================================ */
  var _wd = { tryId: null };
  var GEM_COL = { pearl: '#f1e8dc', jade: '#7ccaa0', gold: '#e8b43e', ruby: '#d83a52', sapphire: '#4a6cd8', silver: '#cfd6e0' };
  function wdSwatch(it) {
    if (it.sw) return 'background:linear-gradient(135deg,' + it.sw[0] + ' 0 55%,' + it.sw[1] + ' 55% 100%)';
    var L = it.look || {};
    var col = L.col || L.flowers || L.kerchief || L.sachet || GEM_COL[L.earring] || GEM_COL[L.pendant] || L.bigCol || (Q.RANKS[Math.min(9, it.tier)] || {}).color || '#d9a441';
    var col2 = L.trim || L.silk || (L.beads ? '#e8b43e' : null) || col;
    return 'background:linear-gradient(135deg,' + col + ' 0 55%,' + col2 + ' 55% 100%)';
  }
  function wdAfterChange() {
    var st = Game.st; if (!st) return;
    try { renderHub(true, true); } catch (e) { /* ignore */ }
    if (!st.cur && st.phase !== 'ended') Saves.save('auto', st);
  }
  function renderWardrobe(el, slotId) {
    var st = Game.st, w = QL.wardrobe(st);
    var slot = w.slots.filter(function (x) { return x.id === slotId; })[0];
    var tryIt = _wd.tryId ? Q.WARDROBE.byId[_wd.tryId] : null;
    if (tryIt && tryIt.slot !== slotId) tryIt = null;
    var outfit = QL.look(st);
    if (tryIt) outfit[tryIt.slot] = tryIt.look;
    var fig = portrait('player', 'smile', { rank: st.rank, origin: st.origin, vb: '30 0 340 440', outfit: outfit });
    var effHtml = w.effLines.length ? w.effLines.map(function (l) { return '<li class="' + (l.good ? 'up' : 'dn') + '">' + esc(l.t) + '</li>'; }).join('') : '<li class="mute">ยังไม่มีผลพิเศษ</li>';
    var setHtml = w.set
      ? '<div class="wd-set on"><b>✦ ' + esc(w.setTh) + '</b><small>ครบชุดเซ็ต! ' + w.setLines.map(function (l) { return esc(l.t); }).join(' · ') + '</small></div>'
      : '<div class="wd-set"><b>ชุดเซ็ต</b><small>สวมชุด เครื่องหัว และเครื่องประดับอย่างน้อย 1 ชิ้นที่มีโทนเดียวกัน (ดูป้ายบนการ์ด) เพื่อรับโบนัสเพิ่ม</small></div>';
    var tryBar = '';
    if (tryIt) {
      var owned = !!st.W.own[tryIt.id], can = !owned && tryIt.price > 0 && st.rank >= tryIt.minRank && st.S.silver >= tryIt.price;
      tryBar = '<div class="wd-try"><span>👁 กำลังลองสวม: <b>' + esc(tryIt.th) + '</b></span>' +
        (owned ? '<button type="button" class="btn btn-primary sm" data-a="equip" data-id="' + tryIt.id + '"><span>สวมใส่</span></button>'
          : can ? '<button type="button" class="btn btn-primary sm" data-a="buy" data-id="' + tryIt.id + '"><span>ซื้อ 銀 ' + tryIt.price + '</span></button>' : '') +
        '<button type="button" class="btn btn-ghost sm" data-a="untry"><span>เลิกลอง</span></button></div>';
    }
    var list = slot.items.map(function (it) {
      var tags = '<span class="wd-tag tier">' + esc(it.minRank === 0 ? 'ทุกฐานะ' : it.rankTh + 'ขึ้นไป') + '</span>' +
        (it.styleTh ? '<span class="wd-tag style">' + esc(it.styleTh) + '</span>' : '') + (it.setTh ? '<span class="wd-tag set">✦ ' + esc(it.setTh) + '</span>' : '');
      var eff = it.eff.length ? '<ul class="wd-eff">' + it.eff.map(function (l) { return '<li class="' + (l.good ? 'up' : 'dn') + '">' + esc(l.t) + '</li>'; }).join('') + '</ul>' : '';
      var act = '';
      if (it.equipped) act = '<span class="wd-worn">✓ สวมอยู่</span>' + ((slotId === 'robe' || slotId === 'head') ? '' : '<button type="button" class="btn btn-ghost sm" data-a="unequip"><span>ถอด</span></button>');
      else if (it.owned) act = it.wearable ? '<button type="button" class="btn btn-secondary sm" data-a="equip" data-id="' + it.id + '"><span>สวมใส่</span></button>' : '<span class="wd-lock">🔒 ' + esc(it.why) + '</span>';
      else {
        if (it.price > 0) act = it.buyable ? '<button type="button" class="btn btn-primary sm" data-a="buy" data-id="' + it.id + '"><span>ซื้อ 銀 ' + it.price + '</span></button>'
          : it.tooPoor ? '<span class="wd-lock">銀 ' + it.price + ' · เงินไม่พอ</span>' : '<span class="wd-lock">🔒 ' + esc(it.why) + ' · 銀 ' + it.price + '</span>';
        else act = '<span class="wd-lock">🎁 ' + (it.src === 'rank' ? 'รับพระราชทานเมื่อเป็น' + esc(Q.RANKS[it.grant].th) : 'ได้รับจากเหตุการณ์ในวัง') + '</span>';
        act += '<button type="button" class="btn btn-ghost sm" data-a="try" data-id="' + it.id + '"><span>ลองสวม</span></button>';
      }
      return '<div class="wd-item' + (it.equipped ? ' eq' : it.owned ? ' own' : '') + (tryIt && tryIt.id === it.id ? ' trying' : '') + '"><i class="wd-sw" style="' + wdSwatch(it) + '"></i>' +
        '<div class="wd-info"><b>' + esc(it.th) + '</b><div class="wd-tags">' + tags + '</div><p>' + esc(it.desc) + '</p>' + eff + '</div><div class="wd-act">' + act + '</div></div>';
    }).join('');
    var worn = Q.WARDROBE.slots.map(function (sl) { var id = st.W.eq[sl.id], it = id && Q.WARDROBE.byId[id]; return '<li><u>' + sl.icon + '</u><span>' + esc(it ? it.th : '—') + '</span></li>'; }).join('');
    el.innerHTML = '<div class="wd"><aside class="wd-side"><div class="wd-fig">' + fig + '<div class="wd-name"><b>' + esc(st.name) + '</b><small>' + esc(QL.rankTitle(st)) + '</small></div></div>' +
      '<div class="wd-sum"><div class="wd-silver"><u>銀</u>' + w.silver + ' ตำลึง</div><h4>ผลของเครื่องแต่งกาย</h4><ul class="wd-eff big">' + effHtml + '</ul>' + setHtml + '<h4>ที่สวมอยู่</h4><ul class="wd-worn-list">' + worn + '</ul></div></aside>' +
      '<section class="wd-main">' + tryBar + '<div class="wd-hint">' + esc(slotId === 'robe' ? 'ชุดตามฐานะต้องสวมเสมอ ยิ่งสูงศักดิ์ยิ่งสะดุดตา — และยิ่งเป็นเป้าสายตา' : slotId === 'head' ? 'เครื่องหัวบอกฐานะและรสนิยมของท่านก่อนที่ท่านจะเอ่ยปาก' : 'เครื่องประดับชิ้นเล็กๆ ที่บางครั้งตัดสินความประทับใจแรก') + '</div>' +
      '<div class="wd-list">' + (list || '<p class="mute">ยังไม่มีสิ่งของในหมวดนี้</p>') + '</div></section></div>';
    $$('[data-a]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.a, id = b.dataset.id, r;
        if (a === 'try') { _wd.tryId = id; snd('page'); renderWardrobe(el, slotId); return; }
        if (a === 'untry') { _wd.tryId = null; snd('page'); renderWardrobe(el, slotId); return; }
        if (a === 'equip') { r = QL.equip(st, id); if (!r.ok) { toast(r.why); return; } _wd.tryId = null; snd('pick'); wdAfterChange(); renderWardrobe(el, slotId); return; }
        if (a === 'unequip') { r = QL.unequip(st, slotId); if (!r.ok) { toast(r.why); return; } snd('page'); wdAfterChange(); renderWardrobe(el, slotId); return; }
        if (a === 'buy') {
          r = QL.buy(st, id); if (!r.ok) { toast(r.why); snd('fail'); return; }
          QL.equip(st, id); _wd.tryId = null; snd('chime'); toast('ซื้อ ' + Q.WARDROBE.byId[id].th + ' แล้ว · สวมใส่ให้เรียบร้อย'); wdAfterChange(); renderWardrobe(el, slotId);
        }
      });
    });
  }
  function openWardrobe(slot) {
    var st = Game.st; if (!st) return;
    QL.ensureW(st); _wd.tryId = null;
    var tabs = Q.WARDROBE.slots.map(function (sl) { return { id: sl.id, label: sl.icon + ' ' + sl.th, render: function (el) { _wd.tryId = null; renderWardrobe(el, sl.id); } }; });
    openModal({ title: 'ตู้เสื้อผ้า', cls: 'modal-wardrobe', tabs: tabs, start: slot || 'robe' });
  }
  Game.openWardrobe = openWardrobe;


  /* ============================================================
     11c. XIUNÜ (ซิ่วหนี่ — รุ่นสนมใหม่)
     ============================================================ */
  var AMB_TH = ['ต่ำ — ใจเรียบง่าย', 'ปานกลาง', 'สูง — หิวบันได'];
  function renderXnBanner() {
    var el = $('#xn-banner'), st = Game.st; if (!el || !st) return;
    var x = QL.xiunu(st), P = x.pending;
    if (!P || !x.pendingCards.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span class="xb-ico">📜</span><div class="xb-body"><b>รุ่นซิ่วหนี่ปีที่ ' + P.no + ' รอการพิจารณา</b><small>ผู้เข้าคัดเลือก ' + x.pendingCards.length + ' คน · ' + (P.deadlineIn > 0 ? 'ตัดสินใจได้อีก ' + P.deadlineIn + ' ฤดู' : 'ฤดูสุดท้ายที่ตัดสินใจได้') + ' · โควตารับเข้าสังกัด ' + P.left + '</small></div><button type="button" class="btn btn-primary sm btn-xiunu"><span>พิจารณา</span></button>';
    tip('xn_intro', 'รุ่น <b>ซิ่วหนี่</b> (สตรีผู้เข้าคัดเลือก) เข้าวังแล้ว — ท่านมีสิทธิ์ช่วยพิจารณา สืบประวัติก่อนตัดสินใจได้ <b>รับเข้าสังกัด</b> (ได้พันธมิตรแต่เสี่ยงเลี้ยงคนที่ทะเยอทะยาน) · <b>ปล่อยตามชะตา</b> · <b>ส่งเป็นนางกำนัลข้างกาย</b> · <b>คัดออก</b> (ระวังตระกูลใหญ่จะผูกใจเจ็บ)', '#xn-banner .btn-xiunu');
  }
  function xnBust(c, big) { return portrait('maiden', 'neutral', { rank: 1, origin: 'noble', bust: true, outfit: c.look }); }
  function xnMeter(label, v, cls) { return '<span class="xn-m ' + (cls || '') + '"><u>' + label + '</u><i style="--v:' + Math.max(0, Math.min(100, v)) + '%"></i><em>' + v + '</em></span>'; }
  function xnCardHTML(c, mode, x) {
    var tags = '<span class="xn-tag ' + (c.arch ? 'known' : '') + '">' + esc(c.archTh || 'นิสัยแท้ยังไม่แน่ชัด') + '</span>' +
      '<span class="xn-tag">' + esc(c.sideTh) + '</span>' +
      (c.ambition !== null && c.ambition !== undefined ? '<span class="xn-tag amb' + c.ambition + '">ทะเยอทะยาน: ' + esc(AMB_TH[c.ambition]) + '</span>' : '') +
      (c.agentKnown === 'yes' ? '<span class="xn-tag bad">⚠ ' + esc(c.agentTh || 'สายสืบ') + '</span>' : c.agentKnown === 'no' ? '<span class="xn-tag good">ไม่พบสายสืบ</span>' : '') +
      (c.turned ? '<span class="xn-tag bad">เป็นปฏิปักษ์ต่อท่าน</span>' : '') + (c.graduated ? '<span class="xn-tag good">ตอบแทนบุญคุณแล้ว</span>' : '');
    var meters = '';
    if (mode !== 'pending') meters = '<div class="xn-meters">' + xnMeter('โปรดปราน', c.favor, 'fav') + (c.loyalty !== null ? xnMeter('ภักดี', c.loyalty, 'loy') : '') + '</div>';
    var act = '';
    if (mode === 'pending') {
      act += c.investigated ? '<span class="xn-done">✓ สืบประวัติแล้ว</span>' : '<button type="button" class="btn btn-ghost sm" data-a="inv" data-id="' + c.id + '"><span>🔍 สืบประวัติ · 銀' + x.investigateCost + '</span></button>';
      act += '<button type="button" class="btn btn-primary sm" data-a="sponsor" data-id="' + c.id + '"' + (x.pending.left <= 0 ? ' disabled' : '') + '><span>🤝 รับเข้าสังกัด · 銀' + c.sponsorCost + '</span></button>' +
        '<button type="button" class="btn btn-secondary sm" data-a="neutral" data-id="' + c.id + '"><span>ปล่อยตามชะตา</span></button>' +
        '<button type="button" class="btn btn-secondary sm" data-a="maid" data-id="' + c.id + '"><span>ส่งเป็นนางกำนัลข้างกาย</span></button>' +
        '<button type="button" class="btn btn-ghost sm dn" data-a="reject" data-id="' + c.id + '"><span>คัดออก</span></button>';
    } else if (c.status === 'sponsored' || c.status === 'maid' || c.status === 'kept') {
      if (!c.turned) act += '<button type="button" class="btn btn-ghost sm" data-a="gift" data-id="' + c.id + '"' + (c.giftOk ? '' : ' disabled') + '><span>🎁 ให้ของขวัญ · 銀' + x.giftCost + '</span></button>';
      act += '<button type="button" class="btn btn-ghost sm dn" data-a="dismiss" data-id="' + c.id + '"><span>ตัดสัมพันธ์</span></button>';
    }
    var origin = c.clan === 'สามัญชน' ? 'ลูกสาวสามัญชน' : 'ตระกูล' + c.clan + (c.han ? ' (ฮั่นจวิน)' : ' · ' + c.banner);
    return '<div class="xn-card ' + c.status + (c.turned ? ' turned' : '') + '"><div class="xn-ava">' + xnBust(c) + '</div><div class="xn-body">' +
      '<div class="xn-head"><b>' + esc(c.name) + '</b><span class="xn-rk">' + esc(c.rankTh) + '</span><span class="xn-st">' + esc(c.statusTh) + '</span></div>' +
      '<div class="xn-sub">' + esc(origin) + ' · อายุ ' + c.age + '</div><p class="xn-blurb">“' + esc(c.blurb) + '”</p>' +
      '<div class="xn-bars">' + xnMeter('โฉม', c.charm) + xnMeter('ปัญญา', c.wit) + xnMeter('ศิลป์', c.talent) + '</div>' + meters +
      '<div class="xn-tags">' + tags + '</div></div>' + (act ? '<div class="xn-act">' + act + '</div>' : '') + '</div>';
  }
  function renderXnTab(el, mode) {
    var st = Game.st, x = QL.xiunu(st), list, head = '', empty = '';
    if (mode === 'pending') {
      list = x.pendingCards;
      if (x.pending) head = '<div class="xn-head-bar"><span>รุ่นที่ <b>' + x.pending.no + '</b></span><span>โควตารับเข้าสังกัด <b>' + x.pending.left + '</b>/' + x.pending.quota + '</span><span>' + (x.pending.deadlineIn > 0 ? 'ตัดสินใจได้อีก <b>' + x.pending.deadlineIn + '</b> ฤดู' : '<b class="dn">ฤดูสุดท้าย</b>') + '</span><span class="wd-silver"><u>銀</u>' + x.silver + '</span></div>' +
        '<p class="xn-note">ผู้เข้าคัดเลือกแต่ละคนมีความลับที่มองจากภายนอกไม่เห็น — บางคนเป็นสายของฮองเฮาหรือหวงกุ้ยเฟย บางคนซื่อตรงเกินกว่าจะอยู่รอดในวัง การ <b>สืบประวัติ</b> ช่วยให้เห็นความทะเยอทะยานและสายสืบ (แม่นยำตามปัญญาของท่าน)</p>';
      empty = 'ไม่มีผู้เข้าคัดเลือกรอพิจารณาแล้ว';
    } else if (mode === 'mine') { list = x.mine; empty = 'ยังไม่มีสนมในสังกัดของท่าน — เมื่อถึงขั้น ' + Q.RANKS[x.participateRank].th + ' ท่านจะมีสิทธิ์รับผู้เข้าคัดเลือกเข้าสังกัด'; }
    else if (mode === 'palace') { list = x.palace; empty = 'ยังไม่มีสนมหน้าใหม่ในวังที่อยู่นอกสังกัดของท่าน'; head = '<p class="xn-note">รุ่นถัดไปจะเข้าวังในอีก <b>' + x.nextIn + '</b> ฤดู</p>'; }
    else { list = x.gone; empty = 'ยังไม่มีใครถูกส่งกลับหรือจากไป'; }
    el.innerHTML = head + '<div class="xn-list">' + (list.length ? list.map(function (c) { return xnCardHTML(c, mode, x); }).join('') : '<p class="mute xn-empty">' + esc(empty) + '</p>') + '</div>';
    $$('[data-a]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var a = b.dataset.a, id = b.dataset.id, r;
        function done(res, ok) {
          if (!res.ok) { toast(res.why || 'ทำไม่ได้'); snd('fail'); return; }
          snd(ok || 'pick'); if (res.note) toast(res.note);
          try { renderHub(true, true); } catch (e) { /* ignore */ }
          if (!st.cur && st.phase !== 'ended') Saves.save('auto', st);
          var P = QL.xiunu(st).pending;
          if (mode === 'pending' && (!P || !QL.xiunu(st).pendingCards.length)) { closeModal(); toast('พิจารณารุ่นซิ่วหนี่เสร็จสิ้น'); return; }
          renderXnTab(el, mode);
        }
        if (a === 'inv') { done(QL.xnInvestigate(st, id), 'page'); return; }
        if (a === 'gift') { done(QL.xnGift(st, id), 'chime'); return; }
        if (a === 'sponsor') { done(QL.xnDecide(st, id, 'sponsor'), 'chime'); return; }
        if (a === 'neutral') { done(QL.xnDecide(st, id, 'neutral'), 'page'); return; }
        if (a === 'maid') { done(QL.xnDecide(st, id, 'maid'), 'pick'); return; }
        if (a === 'reject') { confirmBox('คัดนางออก?', 'นางจะถูกส่งกลับบ้าน ถ้านางมาจากตระกูลใหญ่ ตระกูลนั้นจะจดจำเรื่องนี้ไว้', 'คัดออก', 'ยังก่อน').then(function (ok) { if (ok) done(QL.xnDecide(st, id, 'reject'), 'fail'); }); return; }
        if (a === 'dismiss') { confirmBox('ตัดสัมพันธ์กับนาง?', 'นางจะจากสังกัดของท่านไปและจะไม่กลับมาอีก หากนางเคยภักดีต่อท่าน ท่านจะเสียชื่อเรื่องความใจดำ', 'ตัดสัมพันธ์', 'ยังก่อน').then(function (ok) { if (ok) done(QL.xnDismiss(st, id), 'fail'); }); }
      });
    });
  }
  function openXiunu(tab) {
    var st = Game.st; if (!st) return;
    var x = QL.xiunu(st), tabs = [];
    if (x.pending && x.pendingCards.length) tabs.push({ id: 'pending', label: '📜 รอพิจารณา (' + x.pendingCards.length + ')', render: function (el) { renderXnTab(el, 'pending'); } });
    tabs.push({ id: 'mine', label: '🤝 สังกัดของท่าน (' + x.mine.length + ')', render: function (el) { renderXnTab(el, 'mine'); } });
    tabs.push({ id: 'palace', label: '🏯 ในวัง (' + x.palace.length + ')', render: function (el) { renderXnTab(el, 'palace'); } });
    tabs.push({ id: 'gone', label: '🍂 จากไป (' + x.gone.length + ')', render: function (el) { renderXnTab(el, 'gone'); } });
    openModal({ title: 'ซิ่วหนี่ · สตรีผู้เข้าคัดเลือก', cls: 'modal-xiunu', tabs: tabs, start: tab && tabs.some(function (t) { return t.id === tab; }) ? tab : tabs[0].id });
  }
  Game.openXiunu = openXiunu;

  function menuTabs(inGame) {
    var t = [{ id: 'save', label: inGame ? 'บันทึก' : 'โหลดเกม', render: tabSaves }];
    if (inGame) t.push({ id: 'diary', label: 'สมุดบันทึก', render: tabDiary });
    t.push({ id: 'endings', label: 'ตอนจบ', render: tabEndings }, { id: 'cast', label: 'ตัวละคร', render: tabCast }, { id: 'settings', label: 'ตั้งค่า', render: tabSettings });
    return t;
  }
  function openMenu(tab) {
    var inGame = !!Game.st;
    openModal({ title: inGame ? 'เมนู' : 'ตั้งค่าและบันทึก', cls: 'modal-menu', tabs: menuTabs(inGame), start: tab });
  }
  Game.openMenu = openMenu;

  /* ============================================================
     13. MAIN LOOP (the ONLY way the UI drives the game)
     ============================================================ */
  function normalizeState(st) {
    ['pending', 'queue', 'log'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
    ['seen', 'F', 'R', 'S'].forEach(function (k) { if (!st[k] || typeof st[k] !== 'object') st[k] = {}; });
    if (!st.scene || typeof st.scene !== 'object') st.scene = { bg: null, cast: [] };
    if (!Array.isArray(st.scene.cast)) st.scene.cast = [];
    if (!st.stats) st.stats = { events: 0, actions: 0 };
    Q.REL_KEYS.forEach(function (k) { if (typeof st.R[k] !== 'number') st.R[k] = 0; });
    return st;
  }
  function crash(e) {
    try { console.error('[Game]', e && e.stack ? e.stack : e); } catch (x) { /* ignore */ }
    toast('เกิดข้อผิดพลาดภายใน — ลองโหลดเกมจากเมนู', 4200);
  }
  function hubTips() {
    var phone = window.matchMedia && window.matchMedia('(max-width: 999px)').matches;
    tip('hub_ap', 'แต่ละฤดูท่านมี <b>2 แต้มกำลัง</b> ใช้ทำกิจกรรมด้านล่าง เสร็จแล้วกด <b>สิ้นสุดฤดูกาล</b> — เหตุการณ์ใหม่จะเกิดเมื่อฤดูกาลเปลี่ยน', '#hud-ap');
    tip('hub_ladder', '<b>บันไดยศ</b> บอกว่าท่านอยู่ตรงไหนและยังขาดอะไรจึงจะเลื่อนขั้น: ความโปรดปราน · ศักดิ์ศรี · เวลา · บททดสอบประจำขั้น', phone ? '#climb-strip' : '#panel-ladder');
  }
  function enterHub() {
    show('hub-screen');
    renderHub();
    mood('palace');
    scrollLadder();
    hubTips();
  }

  async function drive() {
    var run = ++Game._run, st = Game.st;
    Game._wait = null; Game._hubWait = null;
    try {
      for (var guard = 0; guard < 200000; guard++) {
        if (run !== Game._run) return;
        if (st.cur) { await playEvent(run); continue; }
        var id = QL.nextPending(st);
        if (id) { if (QL.startEvent(st, id)) await playEvent(run); continue; }
        if (st.promoted || st.demoted) { await ceremony(); if (run !== Game._run) return; continue; }
        if (st.phase === 'ended') { showEnding(); return; }
        if (!st.pendingEnding) { var dead = QL.systemEnd(st); if (dead) { st.pendingEnding = dead; continue; } }
        enterHub();
        var r = await hubWait();
        if (run !== Game._run) return;
        if (r && r.type === 'end') {
          var over = QL.systemEnd(st);
          if (over && !st.pendingEnding) { st.pendingEnding = over; continue; }
          var prev = QL.dateInfo(st), rep = QL.endSeason(st);
          await seasonReport(rep, prev);
        }
      }
    } catch (e) { crash(e); }
  }

  Game.newGame = function (opts) {
    opts = opts || {};
    var st = QL.newGame({ name: opts.name, origin: opts.origin, gift: opts.gift, seed: opts.seed });
    startWith(st);
    return st;
  };
  Game.start = Game.newGame;
  function startWith(st) {
    QL.reindex();
    normalizeState(st);
    stopAuto(); closeModal(); hideOverlay('ceremony'); hideOverlay('season-report');
    _cer = null; _rep = null; hideChoices(); clearStage();
    $('#card-overlay').classList.remove('show'); $('#event-screen').classList.remove('card-on', 'choosing', 'has-note', 'is-ending');
    $$('.overlay.confirm').forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); });
    Game.st = st; Game.history = []; Game._lastEv = null; Game._endMark = null; Game._endNew = false; _relSig = ''; _topKey = '';
    snd('ensure');
    drive();
    return true;
  }
  Game.loadSlot = function (key) {
    var rec = Saves.get(key);
    if (!rec) { toast('ไม่พบข้อมูลบันทึก'); return false; }
    return startWith(rec.st);
  };
  Game.saveSlot = function (key) { if (!Game.st) return false; return Saves.save(String(key), Game.st); };
  Game.continueGame = function () { var L = Saves.latest(); if (!L) return false; return Game.loadSlot(L.key); };
  Game.toTitle = showTitle;
  Game.doAction = doHubAction;
  Game.endSeason = onEndSeasonClick;
  Game.show = show;
  /* test/debug helper: queue an event by id and run it from the hub */
  Game.runEvent = function (id) { if (!Game.st || !Game._hubWait) return false; Game.st.pending.unshift(id); Game.st.phase = 'events'; resolveHub({ type: 'events' }); return true; };
  Game.refresh = function () { if (Game.st && Game.screen === 'hub-screen') { renderHub(true); scrollLadder(); } };

  /* ============================================================
     14. BINDINGS & BOOT
     ============================================================ */
  function bindUI() {
    $('#btn-new').onclick = function () { snd('ensure'); snd('pick'); showCreate(); };
    $('#btn-continue').onclick = function () { snd('ensure'); snd('pick'); Game.continueGame(); };
    $('#btn-load-list').onclick = function () { openModal({ title: 'โหลดเกม', cls: 'modal-menu', tabs: [{ id: 'save', label: 'โหลดเกม', render: tabSaves }] }); };
    $('#btn-archive').onclick = function () { snd('pick'); openModal({ title: 'จดหมายเหตุ', cls: 'modal-menu', tabs: [{ id: 'endings', label: 'ตอนจบ', render: tabEndings }, { id: 'cast', label: 'ตัวละคร', render: tabCast }] }); };
    $('#btn-howto').onclick = function () { snd('pick'); openModal({ title: 'วิธีเล่น & เครดิต', cls: 'modal-menu', tabs: [{ id: 'howto', label: 'วิธีเล่น', render: tabHowto }] }); };
    $('#btn-title-settings').onclick = function () { snd('pick'); openModal({ title: 'ตั้งค่า', cls: 'modal-menu', tabs: [{ id: 'settings', label: 'ตั้งค่า', render: tabSettings }] }); };
    $('#btn-title-mute').onclick = toggleMute;
    $('#btn-mute').onclick = toggleMute;
    $('#btn-create-back').onclick = function () { snd('page'); showTitle(); };
    $('#btn-start').onclick = function () {
      var nm = ($('#name-input').value || '').trim() || 'หลันซี';
      snd('ensure'); snd('chime');
      Game.newGame({ name: nm, origin: Create.origin, gift: Create.gift });
    };
    $('#name-input').addEventListener('input', updatePreviewName);
    $('#name-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#btn-start').click(); } });

    /* hub */
    $$('#hub-tabs button').forEach(function (b) { b.onclick = function () { snd('page'); setHubTab(b.dataset.tab); }; });
    $('#climb-strip').onclick = function () { setHubTab('ladder'); };
    $('#btn-menu').onclick = function () { openMenu(); };
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.btn-wardrobe') : null; if (b) { e.preventDefault(); openWardrobe(); return; }
      var xb = e.target && e.target.closest ? e.target.closest('.btn-xiunu') : null; if (xb) { e.preventDefault(); openXiunu(); }
    });
    $('#btn-end-season').onclick = onEndSeasonClick;
    $('#action-groups').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.action-card') : null;
      if (b && !b.disabled) doHubAction(b.dataset.action);
    });
    $('#stats').addEventListener('click', function (e) { var r = e.target.closest ? e.target.closest('.stat-row') : null; if (r) r.classList.toggle('open'); });

    /* event */
    $('#advance-area').addEventListener('click', onAdvanceClick);
    $('#card-overlay').addEventListener('click', onCardClick);
    $('#btn-log').onclick = function (e) { e.stopPropagation(); openLog(); };
    $('#btn-auto').onclick = function (e) { e.stopPropagation(); setAuto(!Game.auto); };
    $('#btn-skip').onclick = function (e) { e.stopPropagation(); setSkip(!Game.skip); };
    $('#btn-ev-menu').onclick = function (e) { e.stopPropagation(); openMenu(); };

    /* ending */
    $('#btn-restart').onclick = function () { snd('pick'); showTitle(); };
    $('#btn-end-archive').onclick = function () { openModal({ title: 'จดหมายเหตุ', cls: 'modal-menu', tabs: [{ id: 'endings', label: 'ตอนจบ', render: tabEndings }, { id: 'cast', label: 'ตัวละคร', render: tabCast }] }); };
    $('#btn-end-load').onclick = function () { openModal({ title: 'โหลดเกม', cls: 'modal-menu', tabs: [{ id: 'save', label: 'โหลดเกม', render: tabSaves }] }); };

    /* overlays */
    $('#btn-ceremony-ok').onclick = function (e) { e.stopPropagation(); closeCeremony(false); };
    $('#ceremony').addEventListener('click', function () { closeCeremony(true); });
    $('#season-report').addEventListener('click', function (e) {
      if (e.target.id === 'btn-report-ok' || e.target.closest('#btn-report-ok')) { closeReport(); return; }
      if (e.target.id === 'season-report') closeReport();
    });
    $('#modal-root').addEventListener('click', function (e) { if (e.target.id === 'modal-root') closeModal(); });

    document.addEventListener('keydown', onKey);
    var rz = null;
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (Game.screen === 'title-screen') renderTitleArt(); }, 150); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && Game.st && Game.st.phase === 'hub' && !Game.st.cur) Saves.save('auto', Game.st);
    });
    document.addEventListener('pointerdown', function () { snd('ensure'); if (!Game.settings.mute) { mood(Game.screen === 'title-screen' || Game.screen === 'create-screen' ? 'night' : 'palace'); } }, { once: true, capture: true });
  }

  function onKey(e) {
    var tg = e.target, tag = tg && tg.tagName;
    if (e.key === 'Escape') {
      if (document.querySelector('.overlay.confirm')) return;
      if (_cer || _rep) return;
      if (!$('#modal-root').hidden) { closeModal(); return; }
      if (Game.st && Game.screen !== 'ending-screen') openMenu();
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!$('#modal-root').hidden || document.querySelector('.overlay.confirm')) return;
    var go = (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight');
    if (_cer) { if (go && tag !== 'BUTTON') { e.preventDefault(); closeCeremony(false); } return; }
    if (_rep) { if (go && tag !== 'BUTTON') { e.preventDefault(); closeReport(); } return; }
    if (Game.screen === 'event-screen') {
      if (go) { if (tag === 'BUTTON') return; e.preventDefault(); onAdvanceClick(); }
      else if (/^[1-4]$/.test(e.key) && Game._wait && Game._wait.kind === 'choice') {
        var b = $('.choice-btn[data-i="' + (parseInt(e.key, 10) - 1) + '"]');
        if (b && !b.disabled) deliver({ t: 'choose', i: parseInt(e.key, 10) - 1 });
      }
    }
  }

  function loadFonts() {
    if (FAST || PARAMS.get('fonts') === '0') return;
    if (!/^(https?|file):$/.test(window.location.protocol)) return;
    try {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;800&family=Sarabun:wght@400;500;700&family=Noto+Serif+SC:wght@600;900&display=swap';
      document.head.appendChild(l);
    } catch (e) { /* fonts are optional */ }
  }

  function boot() {
    QL.reindex();
    Seen.load(); loadSettings();
    if (FAST) document.body.classList.add('fast');
    buildCreate(); buildPetals(); renderTitleArt(); bindUI();
    show('title-screen'); updateContinue(); applyMute();
    loadFonts();
    Game.ready = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
