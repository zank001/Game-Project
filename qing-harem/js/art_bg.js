/* =============================================================
   art_bg.js — ลิขิตหงส์ · วังหลังต้าชิง
   Painterly Qing-palace backgrounds (pure SVG strings, no DOM).
   Public API:  backgroundSVG(key, { season: 0..3, uid: 'optional id prefix' })
   Every key of Q.BGS is implemented. viewBox 0 0 1600 900, slice.
   Deterministic artwork (seeded RNG only, no ambient randomness or clock); every call gets a fresh id prefix
   so several backgrounds can live in one document — pass opts.uid to get byte-identical output.
   Helpers live inside _bgLib (nothing else leaks into the global scope).
   ============================================================= */
function backgroundSVG(key, opts) { return _bgLib.render(key, opts); }

var _bgLib = (function () {
  'use strict';

  /* ======================================================================
     1. numeric / colour helpers
     ====================================================================== */
  function f1(v) { return Math.round(v * 10) / 10; }
  function rngf(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hstr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hx(n) { n = n < 0 ? 0 : n > 255 ? 255 : Math.round(n); return (n < 16 ? '0' : '') + n.toString(16); }
  var _cc = {};
  function rgb(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(a, b, t) {
    var k = a + b + t; if (_cc[k]) return _cc[k];
    var x = rgb(a), y = rgb(b);
    return (_cc[k] = '#' + hx(x[0] + (y[0] - x[0]) * t) + hx(x[1] + (y[1] - x[1]) * t) + hx(x[2] + (y[2] - x[2]) * t));
  }
  function lt(c, t) { return mix(c, '#ffffff', t); }
  function dk(c, t) { return mix(c, '#000000', t); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ======================================================================
     2. tiny svg string builders
     ====================================================================== */
  function RC(x, y, w, h, fill, x_) { return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" fill="' + fill + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function PA(d, fill, x_) { return '<path d="' + d + '" fill="' + fill + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function ST(d, stroke, w, x_) { return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  /* stroke a path through a shared <path> in defs (so repeated passes over the same branch cost ~80 bytes) */
  function SU(c, d, stroke, w, x_) {
    var id = c.def('D' + d, function (id) { return '<path id="' + id + '" d="' + d + '" fill="none"/>'; });
    return '<use href="#' + id + '" stroke="' + stroke + '" stroke-width="' + w + '"' + (x_ ? ' ' + x_ : '') + '/>';
  }
  function EL(cx, cy, rx, ry, fill, x_) { return '<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="' + fill + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function CI(cx, cy, r, fill, x_) { return '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="' + fill + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function LN(x1, y1, x2, y2, stroke, w, x_) { return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) + '" stroke="' + stroke + '" stroke-width="' + w + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function GR(inner, x_) { return '<g' + (x_ ? ' ' + x_ : '') + '>' + inner + '</g>'; }
  function POLY(pts, fill, x_) { var s = ''; for (var i = 0; i < pts.length; i += 2) s += (i ? ' ' : '') + f1(pts[i]) + ',' + f1(pts[i + 1]); return '<polygon points="' + s + '" fill="' + fill + '"' + (x_ ? ' ' + x_ : '') + '/>'; }
  function OP(o) { return 'opacity="' + o + '"'; }

  /* ======================================================================
     3. context: defs registry (gradients / filters / patterns shared per scene)
     ====================================================================== */
  var _seq = 0; /* per-call counter: every call gets its own id prefix (pass opts.uid for reproducible output) */
  function newCtx(key, opts) {
    var se = ((opts.season | 0) % 4 + 4) % 4;
    var c = {
      key: key, se: se, defs: [], d: {}, nid: 0,
      uid: String(opts.uid || ('b' + (++_seq).toString(36) + (hstr(key) % 97).toString(36))) + se + '_',
      r: rngf(hstr(key) + 17), r2: rngf(hstr(key) * 3 + se * 7919 + 5)
    };
    c.def = function (k, fn) {
      if (!Object.prototype.hasOwnProperty.call(c.d, k)) { var id = c.uid + (++c.nid).toString(36); c.d[k] = id; c.defs.push(fn(id)); }
      return c.d[k];
    };
    return c;
  }
  function stopsS(st) {
    var s = '';
    for (var i = 0; i < st.length; i++) s += '<stop offset="' + st[i][0] + '" stop-color="' + st[i][1] + '"' + (st[i][2] != null && st[i][2] < 1 ? ' stop-opacity="' + st[i][2] + '"' : '') + '/>';
    return s;
  }
  /* linear gradient → 'url(#id)'. a=[x1,y1,x2,y2] (bbox units unless u=true) */
  function LG(c, st, a, u) {
    a = a || [0, 0, 0, 1]; var b = stopsS(st), k = 'L' + a.join(',') + (u ? 'u' : '') + b;
    return 'url(#' + c.def(k, function (id) { return '<linearGradient id="' + id + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + a[2] + '" y2="' + a[3] + '"' + (u ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + b + '</linearGradient>'; }) + ')';
  }
  /* radial gradient → 'url(#id)'. a=[cx,cy,r] */
  function RG(c, st, a, u) {
    a = a || [0.5, 0.5, 0.5]; var b = stopsS(st), k = 'R' + a.join(',') + (u ? 'u' : '') + b;
    return 'url(#' + c.def(k, function (id) { return '<radialGradient id="' + id + '" cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '"' + (u ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + b + '</radialGradient>'; }) + ')';
  }
  /* gaussian blur filter → attribute string */
  function BL(c, sd) {
    return 'filter="url(#' + c.def('B' + sd, function (id) { return '<filter id="' + id + '" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'; }) + ')"';
  }
  /* rough-edge (hand painted) displacement filter */
  function RO(c, sc, fq) {
    sc = sc || 7; fq = fq || '.035';
    return 'filter="url(#' + c.def('O' + sc + fq, function (id) { return '<filter id="' + id + '" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="' + fq + '" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="' + sc + '"/></filter>'; }) + ')"';
  }
  function CP(c, d) { /* clipPath from path d → id string */
    return c.def('C' + d, function (id) { return '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>'; });
  }
  function CPR(c, x, y, w, h) {
    return c.def('CR' + x + ',' + y + ',' + w + ',' + h, function (id) { return '<clipPath id="' + id + '"><rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '"/></clipPath>'; });
  }
  /* a soft glow disc (radial colour → transparent) */
  function glow(c, cx, cy, r, col, op, x_) {
    return CI(cx, cy, r, RG(c, [[0, col, op == null ? 1 : op], [0.45, col, (op == null ? 1 : op) * 0.42], [1, col, 0]]), x_);
  }
  function glowE(c, cx, cy, rx, ry, col, op, x_) {
    return EL(cx, cy, rx, ry, RG(c, [[0, col, op == null ? 1 : op], [0.45, col, (op == null ? 1 : op) * 0.42], [1, col, 0]]), x_);
  }
  /* soft horizontal mist band (gradient only: cheap) */
  function mist(c, y, h, col, op) {
    return RC(0, y - h, W, h * 2, LG(c, [[0, col, 0], [0.5, col, op], [1, col, 0]]));
  }
  var W = 1600, H = 900;

  /* ======================================================================
     4. sky, stars, moon, clouds, ridges
     ====================================================================== */
  function sky(c, stops, y0, y1) { return RC(0, y0 || 0, W, (y1 || H) - (y0 || 0), LG(c, stops)); }
  function stars(c, n, ymax, op) {
    var r = c.r, B = [[], [], [], []], sp = '', i, s = '';
    for (i = 0; i < n; i++) {
      var x = r() * W, y = r() * ymax, big = r() > 0.92, f = (1 - y / (ymax * 1.4)), cls = Math.min(3, Math.floor(r() * 3 * (0.5 + f)));
      B[cls].push('M' + f1(x) + ' ' + f1(y) + 'h.1');
      if (big) sp += 'M' + f1(x - 7) + ' ' + f1(y) + 'h14M' + f1(x) + ' ' + f1(y - 7) + 'v14';
    }
    var wd = [1.2, 1.8, 2.4, 3.2], o = [0.45, 0.6, 0.78, 0.95];
    for (i = 0; i < 4; i++) if (B[i].length) s += ST(B[i].join(''), '#fff6dc', wd[i], 'stroke-linecap="round" ' + OP(f1(o[i] * (op == null ? 1 : op))));
    return s + ST(sp, '#fff6dc', 0.7, OP(f1(0.6 * (op == null ? 1 : op))));
  }
  function moon(c, x, y, r, col) {
    col = col || '#fff2cf';
    var s = glow(c, x, y, r * 5, col, 0.22) + glow(c, x, y, r * 2.6, col, 0.32);
    s += CI(x, y, r, RG(c, [[0, '#fffbea'], [0.7, col], [1, mix(col, '#d8b66a', 0.55)]], [0.4, 0.38, 0.65]));
    s += EL(x - r * 0.28, y - r * 0.15, r * 0.22, r * 0.17, '#d9c48a', OP(0.2)) + EL(x + r * 0.3, y + r * 0.28, r * 0.28, r * 0.2, '#d9c48a', OP(0.16)) + EL(x + r * 0.1, y - r * 0.45, r * 0.12, r * 0.09, '#d9c48a', OP(0.16));
    return s;
  }
  /* blurry painted cloud (cluster of ellipses) */
  function cloud(c, x, y, s, col, op) {
    var g = EL(x, y, 150 * s, 24 * s, col) + EL(x - 70 * s, y - 14 * s, 80 * s, 24 * s, col) + EL(x + 55 * s, y - 20 * s, 95 * s, 28 * s, col) + EL(x + 10 * s, y - 32 * s, 70 * s, 22 * s, col);
    return GR(g, BL(c, Math.max(3, Math.round(9 * s))) + ' ' + OP(op));
  }
  /* long thin cloud streaks */
  function streaks(c, y, col, op, n) {
    var s = '', r = c.r;
    for (var i = 0; i < n; i++) { var x = r() * W, yy = y + (r() - 0.5) * 90, w = 180 + r() * 360; s += EL(x, yy, w, 4 + r() * 9, col, OP(f1(op * (0.5 + r() * 0.6)))); }
    return GR(s, BL(c, 6));
  }
  /* auspicious cloud 祥云 ornament (outline, stroke colour) */
  function xiangyun(x, y, s, col, w) {
    var d = 'M' + x + ' ' + y + 'c' + f1(-6 * s) + ' ' + f1(-14 * s) + ' ' + f1(14 * s) + ' ' + f1(-24 * s) + ' ' + f1(26 * s) + ' ' + f1(-12 * s) + 'c' + f1(2 * s) + ' ' + f1(-16 * s) + ' ' + f1(30 * s) + ' ' + f1(-18 * s) + ' ' + f1(32 * s) + ' ' + f1(0) + 'c' + f1(14 * s) + ' ' + f1(-8 * s) + ' ' + f1(26 * s) + ' ' + f1(8 * s) + ' ' + f1(14 * s) + ' ' + f1(20 * s) + 'c' + f1(-18 * s) + ' ' + f1(6 * s) + ' ' + f1(-40 * s) + ' ' + f1(2 * s) + ' ' + f1(-52 * s) + ' ' + f1(14 * s) + 'c' + f1(-12 * s) + ' ' + f1(8 * s) + ' ' + f1(-24 * s) + ' ' + f1(4 * s) + ' ' + f1(-34 * s) + ' ' + f1(-6 * s) + 'z';
    return ST(d, col, w || 1.4, 'stroke-linejoin="round"');
  }
  /* mountain / hill ridge: smooth random silhouette, vertical gradient fill */
  function ridge(c, base, amp, col, haze, o) {
    o = o || {}; var r = o.r || c.r, step = o.step || 130, pts = [], x = -80, i;
    var ph = r() * 6.28, fr = 0.6 + r() * 0.8;
    for (; x < W + 160; x += step * (0.7 + r() * 0.6)) {
      var n = 0.55 * Math.sin(x / 260 * fr + ph) + 0.45 * (r() * 2 - 1);
      pts.push([x, base - amp * (0.5 + 0.5 * n)]);
    }
    var d = 'M-80 ' + f1(pts[0][1]);
    for (i = 1; i < pts.length; i++) { var p = pts[i - 1], q = pts[i]; d += 'Q' + f1(p[0]) + ' ' + f1(p[1]) + ' ' + f1((p[0] + q[0]) / 2) + ' ' + f1((p[1] + q[1]) / 2); }
    var L = pts[pts.length - 1]; d += 'L' + f1(L[0]) + ' ' + f1(L[1]) + 'V' + (o.bottom || H) + 'H-80Z';
    return PA(d, LG(c, [[0, col, o.opTop == null ? 1 : o.opTop], [1, haze, o.opBot == null ? 1 : o.opBot]], [0, 0, 0, 1]), o.x_);
  }
  /* sharper karst-style peaks (for distant misty mountains / temple) */
  function peaks(c, base, amp, col, haze, o) {
    o = o || {}; var r = o.r || c.r, n = o.n || 7, d = 'M-60 ' + (base + 40), i, x = -60, stepx = (W + 120) / n;
    for (i = 0; i < n; i++) {
      var px = x + stepx * (i + 0.5) + (r() - 0.5) * stepx * 0.5, py = base - amp * (0.45 + 0.55 * r()), hw = stepx * (0.45 + r() * 0.35);
      d += 'L' + f1(px - hw) + ' ' + (base + 6) + 'Q' + f1(px - hw * 0.35) + ' ' + f1(py + amp * 0.35) + ' ' + f1(px - 6) + ' ' + f1(py + 8) + 'Q' + f1(px) + ' ' + f1(py - 6) + ' ' + f1(px + 10) + ' ' + f1(py + 10) + 'Q' + f1(px + hw * 0.4) + ' ' + f1(py + amp * 0.4) + ' ' + f1(px + hw) + ' ' + (base + 6);
    }
    d += 'L' + (W + 60) + ' ' + (base + 40) + 'V' + H + 'H-60Z';
    return PA(d, LG(c, [[0, col], [1, haze]]), o.x_);
  }
  function vignette(c, op, y0) {
    var s = RC(0, 0, W, H, RG(c, [[0.5, '#000', 0], [1, '#000', op == null ? 0.5 : op]], [0.5, 0.45, 0.78]));
    return s;
  }
  /* darken the lower part so the dialogue box area stays calm */
  function floorShade(c, op) { return RC(0, 560, W, 340, LG(c, [[0, '#000', 0], [1, '#000', op == null ? 0.38 : op]])); }
  /* subtle painted paper grain over everything */
  function grain(c, op) {
    var id = c.def('grain', function (id) { return '<filter id="' + id + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .9  1.9 0 0 0 -.78"/></filter>'; });
    return RC(0, 0, W, H, '#fff', 'filter="url(#' + id + ')" ' + OP(op == null ? 0.11 : op));
  }
  /* seasonal colour wash for interiors: spring rosy, summer bright, autumn amber, winter cold */
  function tintWash(c, k) {
    var w = [['#ffc0d4', 0.09], ['#fff4a0', 0.07], ['#ff9230', 0.13], ['#8cb0ff', 0.14]][c.se];
    return RC(0, 0, W, H, w[0], OP(f1(w[1] * (k == null ? 1 : k))));
  }
  /* small flying birds */
  function birds(c, n, x0, x1, y0, y1, col) {
    var r = c.r, d = '', i;
    for (i = 0; i < n; i++) { var x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), q = 0.7 + r() * 0.9; d += 'M' + Math.round(x) + ' ' + Math.round(y) + 'q' + f1(5 * q) + ' ' + f1(-6 * q) + ' ' + f1(10 * q) + ' 0q' + f1(5 * q) + ' ' + f1(-6 * q) + ' ' + f1(10 * q) + ' 0'; }
    return ST(d, col || '#2a3040', 1.6, 'stroke-linecap="round" stroke-linejoin="round" ' + OP(0.65));
  }
  /* a V of wild geese */
  function geese(c, x, y, n, col) {
    var d = '', i;
    for (i = 0; i < n; i++) { var k = Math.ceil(i / 2) * (i % 2 ? 1 : -1), gx = x + k * 30, gy = y + Math.abs(k) * 15; d += 'M' + Math.round(gx) + ' ' + Math.round(gy) + 'q5 -5 10 0q5 -5 10 0'; }
    return ST(d, col || '#3a3040', 1.8, 'stroke-linecap="round" ' + OP(0.7));
  }
  /* soft light shaft (diagonal) */
  function shaft(c, x1, x2, y1, x3, x4, y2, col, op) {
    return POLY([x1, y1, x2, y1, x4, y2, x3, y2], LG(c, [[0, col, op], [1, col, 0]]), BL(c, 7));
  }

  /* ======================================================================
     5. falling things: petals, leaves, snow, rain, fireflies, embers, dust
     ====================================================================== */
  /* seasonal air: spring petals / summer fireflies(night) or pollen / autumn leaves / winter snow */
  function seasonAir(c, o) {
    o = o || {}; var se = c.se, night = o.night, n = o.n || 46, y1 = o.y1 || 780;
    if (se === 0) return fall(c, 'petal', n, { y1: y1, cols: o.petal });
    if (se === 1) return night ? fall(c, 'firefly', Math.round(n * 0.4), { y0: 360, y1: y1 }) : fall(c, 'dust', Math.round(n * 0.7), { y1: y1, col: '#fff3b0' });
    if (se === 2) return fall(c, 'leaf', Math.round(n * 0.8), { y1: y1 });
    return fall(c, 'snow', n * 2, { y1: y1 });
  }

  /* ======================================================================
     6. architecture
     ====================================================================== */
  var RED = '#b3261e', REDD = '#6e1511', GOLD = '#e0b24a', GOLDL = '#f6dc8c', GOLDD = '#9a6f1c';

  function colGrad(c, base) { return LG(c, [[0, dk(base, 0.42)], [0.32, lt(base, 0.08)], [0.62, base], [1, dk(base, 0.5)]], [0, 0, 1, 0]); }

  /* tile pattern for roofs (vertical ribs) */
  function tilePat(c, w) {
    var sc = clamp(w / 760, 0.3, 1.25);
    return PT(c, 'tile', sc, 9, 10, '<rect width="9" height="10" fill="none"/><rect x="0" width="3.2" height="10" fill="#000" opacity=".16"/><rect x="3.4" width="1.6" height="10" fill="#fff" opacity=".13"/>');
  }
  function latPat(c, sc, col) {
    col = col || '#3a0f0c';
    return PT(c, 'lat' + col, sc, 12, 12, '<path d="M0 0H12M0 0V12M0 6H12M6 0V12" stroke="' + col + '" stroke-width="1.5" fill="none"/>');
  }
  function iceCrack(c, sc, col) {
    col = col || '#3a0f0c';
    return PT(c, 'ice' + col, sc, 60, 60, '<path d="M0 20L18 8 40 14 60 20M18 8L22 30 44 40 40 14M22 30L4 44 0 58M44 40L60 34M4 44L26 58 44 40M26 58L30 60M22 30L0 20M44 40L50 60M18 8L16 0M40 14L38 0M60 20L60 0" stroke="' + col + '" stroke-width="2.2" fill="none" stroke-linejoin="round"/>');
  }
  function studPat(c, sc) {
    return PT(c, 'stud', sc, 20, 20, '<circle cx="10" cy="10" r="4.6" fill="#f2cf74"/><circle cx="8.6" cy="8.6" r="1.7" fill="#fff3c0" opacity=".8"/>');
  }

  /* roof outline (hip roof with up-turned eaves). returns {d, ridgeY, rl, rr, L, R, by, ty} */
  function roofGeom(cx, by, w, h, rw) {
    var L = cx - w / 2, R = cx + w / 2, yt = by - h, rl = cx - rw * w, rr = cx + rw * w, ty = by - h * 0.15;
    var left = 'C' + f1(rl - 0.03 * w) + ' ' + f1(yt + 0.55 * h) + ' ' + f1(L + 0.16 * w) + ' ' + f1(by - 0.05 * h) + ' ' + f1(L - 0.025 * w) + ' ' + f1(ty);
    var d = 'M' + f1(rl) + ' ' + f1(yt) + left +
      'Q' + f1(L + 0.045 * w) + ' ' + f1(by + 0.06 * h) + ' ' + f1(L + 0.14 * w) + ' ' + f1(by + 0.015 * h) +
      'L' + f1(R - 0.14 * w) + ' ' + f1(by + 0.015 * h) +
      'Q' + f1(R - 0.045 * w) + ' ' + f1(by + 0.06 * h) + ' ' + f1(R + 0.025 * w) + ' ' + f1(ty) +
      'C' + f1(R - 0.16 * w) + ' ' + f1(by - 0.05 * h) + ' ' + f1(rr + 0.03 * w) + ' ' + f1(yt + 0.55 * h) + ' ' + f1(rr) + ' ' + f1(yt) + 'Z';
    var eL = 'M' + f1(rl) + ' ' + f1(yt) + left, eR = 'M' + f1(rr) + ' ' + f1(yt) + 'C' + f1(rr + 0.03 * w) + ' ' + f1(yt + 0.55 * h) + ' ' + f1(R - 0.16 * w) + ' ' + f1(by - 0.05 * h) + ' ' + f1(R + 0.025 * w) + ' ' + f1(ty);
    return { d: d, yt: yt, rl: rl, rr: rr, L: L, R: R, by: by, ty: ty, eL: eL, eR: eR };
  }


  /* a roof: o = {glaze, snow, night, det, rw} */
  function roof(c, cx, by, w, h, o) {
    o = o || {}; var g = roofGeom(cx, by, w, h, o.rw == null ? 0.28 : o.rw), gl = o.glaze || '#e2ac2c', det = o.det == null ? 2 : o.det, s = '', i;
    var pid = c.def('RF' + g.d, function (id) { return '<path id="' + id + '" d="' + g.d + '"/>'; });
    var cid = c.def('RK' + g.d, function (id) { return '<clipPath id="' + id + '"><use href="#' + pid + '"/></clipPath>'; });
    s += '<use href="#' + pid + '" fill="' + LG(c, [[0, lt(gl, 0.35)], [0.35, gl], [1, dk(gl, 0.42)]]) + '"/>';
    if (det >= 1) {
      s += '<g clip-path="url(#' + cid + ')">';
      s += RC(g.L - 20, g.yt - 4, w + 40, h + 30, tilePat(c, w));
      s += RC(g.L - 20, g.yt - 4, w + 40, h + 30, LG(c, [[0, '#fff', o.night ? 0.05 : 0.18], [0.5, '#fff', 0], [1, '#000', 0.18]], [0, 0, 1, 0]));
      if (det >= 2) {
        s += RC(g.L - 20, by - h * 0.22, w + 40, h * 0.3, LG(c, [[0, '#000', 0], [1, '#000', 0.26]]));
        var cr = '';
        for (i = 1; i < 5; i++) { var yy = g.yt + h * (0.2 + i * 0.15); cr += 'M' + f1(g.L) + ' ' + f1(yy) + 'Q' + f1(cx) + ' ' + f1(yy + h * 0.05) + ' ' + f1(g.R) + ' ' + f1(yy); }
        s += ST(cr, '#000', 1, OP(0.1));
      }
      if (o.snow) s += snowCap(c, g, w, h);
      s += '</g>';
    }
    var ew = Math.max(1.2, w * 0.006);
    s += ST(g.eL + g.eR, lt(gl, 0.4), ew, OP(0.8));
    s += ST('M' + f1(g.L + 0.04 * w) + ' ' + f1(by + 0.045 * h) + 'Q' + f1(cx) + ' ' + f1(by + 0.05 * h) + ' ' + f1(g.R - 0.04 * w) + ' ' + f1(by + 0.045 * h), dk(gl, 0.55), Math.max(1.5, h * 0.05), OP(0.55));
    if (det >= 2) s += LN(g.L + 0.1 * w, by + h * 0.02, g.R - 0.1 * w, by + h * 0.02, GOLDL, Math.max(2, h * 0.04), 'stroke-dasharray="0 ' + f1(Math.max(5, w * 0.012)) + '" stroke-linecap="round" ' + OP(0.85));
    var rh = Math.max(3, h * 0.07), ry = g.yt - rh * 0.6;
    s += RC(g.rl - w * 0.012, ry, g.rr - g.rl + w * 0.024, rh, LG(c, [[0, lt(gl, 0.5)], [1, dk(gl, 0.2)]]));
    if (det >= 1) {
      var bz = Math.max(4, w * 0.045), dg = dk(gl, 0.08);
      s += PA('M' + f1(g.rl - w * 0.01) + ' ' + f1(ry + rh) + 'C' + f1(g.rl - bz * 1.1) + ' ' + f1(ry + rh * 0.5) + ' ' + f1(g.rl - bz) + ' ' + f1(ry - bz * 1.2) + ' ' + f1(g.rl - bz * 0.1) + ' ' + f1(ry - bz * 1.5) + 'C' + f1(g.rl - bz * 0.6) + ' ' + f1(ry - bz * 0.7) + ' ' + f1(g.rl - bz * 0.1) + ' ' + f1(ry - bz * 0.1) + ' ' + f1(g.rl + bz * 0.5) + ' ' + f1(ry) + 'ZM' + f1(g.rr + w * 0.01) + ' ' + f1(ry + rh) + 'C' + f1(g.rr + bz * 1.1) + ' ' + f1(ry + rh * 0.5) + ' ' + f1(g.rr + bz) + ' ' + f1(ry - bz * 1.2) + ' ' + f1(g.rr + bz * 0.1) + ' ' + f1(ry - bz * 1.5) + 'C' + f1(g.rr + bz * 0.6) + ' ' + f1(ry - bz * 0.7) + ' ' + f1(g.rr + bz * 0.1) + ' ' + f1(ry - bz * 0.1) + ' ' + f1(g.rr - bz * 0.5) + ' ' + f1(ry) + 'Z', dg);
    }
    if (det >= 2) s += PA('M' + f1(cx - w * 0.012) + ' ' + f1(ry) + 'L' + f1(cx) + ' ' + f1(ry - w * 0.03) + 'L' + f1(cx + w * 0.012) + ' ' + f1(ry) + 'Z', GOLDL);
    return s;
  }
  /* grass tufts along y (spring/summer/autumn) or snow mounds; batched into a few paths */
  function tufts(c, y0, y1, n, o) {
    o = o || {}; var r = o.r || c.r2, se = c.se, i, B = ['', '', ''], S2 = '', col = o.col || ['#5a9a4a', '#3f8a44', '#a08a3a', '#e8edf6'][se];
    for (i = 0; i < n; i++) {
      var x = (o.x0 || 0) + r() * ((o.x1 || W) - (o.x0 || 0)), y = y0 + r() * (y1 - y0), k = (y - y0) / (y1 - y0 + 1), cls = k < 0.34 ? 0 : k < 0.67 ? 1 : 2, sz = 0.6 + k * 0.9;
      if (se === 3) S2 += 'M' + Math.round(x) + ' ' + Math.round(y) + 'h' + Math.round(26 * sz);
      else B[cls] += 'M' + Math.round(x) + ' ' + Math.round(y) + 'l' + Math.round(-5 * sz) + ' ' + Math.round(-16 * sz) + 'M' + Math.round(x) + ' ' + Math.round(y) + 'l' + Math.round(sz) + ' ' + Math.round(-20 * sz) + 'M' + Math.round(x) + ' ' + Math.round(y) + 'l' + Math.round(6 * sz) + ' ' + Math.round(-14 * sz);
    }
    if (se === 3) return ST(S2, '#c9d6ee', 7, 'stroke-linecap="round" ' + OP(0.5)) + ST(S2, '#fff', 4, 'stroke-linecap="round" transform="translate(0 -2)" ' + OP(0.7));
    return ST(B[0], col, 1.2, 'stroke-linecap="round" ' + OP(0.8)) + ST(B[1], col, 1.8, 'stroke-linecap="round" ' + OP(0.85)) + ST(B[2], col, 2.6, 'stroke-linecap="round" ' + OP(0.9));
  }
  /* bamboo grove (stalks + leaf strokes batched) */
  function bamboo(c, x, y, h, n, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, i, k, lc = se === 3 ? ['#6f8f6a', '#8fae88'] : se === 2 ? ['#6f9a3c', '#a0c452'] : ['#2f7a44', '#5aa65a'], sd = '', l1 = '', l2 = '';
    for (i = 0; i < n; i++) {
      var bx = x + (i - n / 2) * 26 + (r() - 0.5) * 18, hh = h * (0.7 + r() * 0.3), lean = (r() - 0.5) * 24;
      sd += 'M' + Math.round(bx) + ' ' + Math.round(y) + 'Q' + Math.round(bx + lean * 0.4) + ' ' + Math.round(y - hh * 0.5) + ' ' + Math.round(bx + lean) + ' ' + Math.round(y - hh);
      for (k = 0; k < 4; k++) {
        var ly = y - hh * (0.45 + k * 0.15), lx = bx + lean * (0.45 + k * 0.15), dir = k % 2 ? 1 : -1;
        l1 += 'M' + Math.round(lx) + ' ' + Math.round(ly) + 'q' + dir * 26 + ' -4 ' + dir * 50 + ' 14';
        l2 += 'M' + Math.round(lx) + ' ' + Math.round(ly) + 'q' + dir * 18 + ' 8 ' + dir * 32 + ' 28';
      }
    }
    return ST(sd, '#5d8a4c', 6, 'stroke-linecap="round"') + ST(sd, '#cfe6a8', 2, 'stroke-dasharray="1 ' + Math.round(h * 0.11) + '" ' + OP(0.7)) + ST(l1, lc[0], 7, 'stroke-linecap="round" ' + OP(0.9)) + ST(l2, lc[1], 6, 'stroke-linecap="round" ' + OP(0.85));
  }

  /* snow lying on a roof (drawn inside the roof clip) */
  function snowCap(c, g, w, h) {
    var d = 'M' + f1(g.L - 30) + ' ' + f1(g.yt - 10) + 'H' + f1(g.R + 30) + 'V' + f1(g.yt + h * 0.5), x = g.R + 30, i = 0, r = rngf(Math.round(w) + 3);
    while (x > g.L - 30) { x -= w * (w < 340 ? 0.16 + r() * 0.08 : 0.07 + r() * 0.07); d += 'Q' + f1(x + w * 0.03) + ' ' + f1(g.yt + h * (0.62 + r() * 0.1)) + ' ' + f1(x) + ' ' + f1(g.yt + h * (0.5 + r() * 0.12)); i++; }
    d += 'L' + f1(g.L - 30) + ' ' + f1(g.yt + h * 0.5) + 'Z';
    return PA(d, LG(c, [[0, '#ffffff'], [0.75, '#e8eef8'], [1, '#b9c8e2']]), 'opacity=".96"') + ST('M' + f1(g.L) + ' ' + f1(g.yt + h * 0.56) + 'Q' + f1((g.L + g.R) / 2) + ' ' + f1(g.yt + h * 0.66) + ' ' + f1(g.R) + ' ' + f1(g.yt + h * 0.56), '#9fb0d0', Math.max(1, h * 0.03), OP(0.4));
  }


  /* marble base with stairs. returns svg; gy = ground y; bw = base width */
  function plinth(c, cx, gy, bw, hp, o) {
    o = o || {}; var s = '', x0 = cx - bw / 2;
    var mar = o.marble || '#ddd6c4';
    s += RC(x0, gy - hp, bw, hp, LG(c, [[0, lt(mar, 0.2)], [1, dk(mar, 0.22)]]));
    s += RC(x0 - bw * 0.008, gy - hp - Math.max(2, hp * 0.12), bw * 1.016, Math.max(2, hp * 0.16), lt(mar, 0.3));
    if (o.det !== 0) {
      /* balustrade posts */
      s += LN(x0 + 4, gy - hp * 0.62, x0 + bw - 4, gy - hp * 0.62, dk(mar, 0.28), Math.max(2, hp * 0.5), 'stroke-dasharray="' + f1(Math.max(2, hp * 0.14)) + ' ' + f1(Math.max(3, hp * 0.22)) + '" ' + OP(0.7));
      /* central stair */
      var sw = bw * 0.2, sx = cx - sw / 2, k = 5;
      for (var i = 0; i < k; i++) s += RC(sx - i * bw * 0.004, gy - hp + (hp * i) / k, sw + i * bw * 0.008, hp / k + 0.6, lt(mar, 0.12 - i * 0.04 + 0.08), 'stroke="' + dk(mar, 0.3) + '" stroke-width=".6"');
      s += RC(sx + sw * 0.4, gy - hp, sw * 0.2, hp, '#a2362a', OP(0.5));
    }
    s += RC(x0, gy - 2, bw, 2, '#000', OP(0.25));
    return s;
  }

  /* a full hall. o: {cx,gy,w,det,glaze,tier,night,lit,snow,red,rw,door,ice} */
  function hall(c, o) {
    var cx = o.cx, gy = o.gy, w = o.w, det = o.det == null ? 2 : o.det, tier = o.tier || 1, s = '';
    var hp = w * 0.045, bw = w * 0.80, hw = w * (o.hw || 0.15), hr = w * (o.rh || 0.20), gl = o.glaze || '#e2ac2c';
    var oo = { cols: o.cols, night: o.night, lit: o.lit, red: o.red, door: o.door == null ? 1 : o.door, det: det, ice: o.ice, glass: o.glass, glass2: o.glass2 };
    if (o.far) { /* simplified silhouette for distance */
      var fw = w, fy = gy - hp;
      s += RC(cx - bw / 2, fy - hw * 1.18, bw, hw * 1.18, o.farWall || dk(o.red || RED, 0.2));
      if (tier === 2) { s += roof(c, cx, fy - hw * 1.1, fw, hr * 0.62, { glaze: gl, det: 1, night: o.night, snow: o.snow }); var f2y = fy - hw * 1.1 - hr * 0.5; s += RC(cx - bw * 0.3, f2y - hw * 0.8, bw * 0.6, hw * 0.8, o.farWall || dk(o.red || RED, 0.2)); s += roof(c, cx, f2y - hw * 0.65, fw * 0.8, hr * 0.9, { glaze: gl, det: 1, night: o.night, snow: o.snow }); }
      else s += roof(c, cx, fy - hw * 1.1, fw, hr, { glaze: gl, det: 1, night: o.night, snow: o.snow, rw: o.rw });
      s += RC(cx - w * 0.46, gy - hp, w * 0.92, hp, o.farBase || '#cfc7b4');
      return s;
    }
    s += plinth(c, cx, gy, w * 0.94, hp, { det: det });
    var b1 = bay(c, cx, gy - hp, bw, hw, oo); s += b1.svg;
    var by1 = b1.top + w * 0.01;
    if (tier === 2) {
      s += roof(c, cx, by1 + hr * 0.1, w, hr * 0.62, { glaze: gl, det: det, night: o.night, snow: o.snow, rw: 0.36 });
      var y2 = by1 - hr * 0.5;
      var b2 = bay(c, cx, y2, bw * 0.62, hw * 0.74, { cols: 6, night: o.night, lit: o.lit, red: o.red, det: det, ice: o.ice, glass: o.glass, glass2: o.glass2 }); s += b2.svg;
      s += roof(c, cx, b2.top + w * 0.01, w * 0.84, hr * 0.95, { glaze: gl, det: det, night: o.night, snow: o.snow, rw: o.rw == null ? 0.26 : o.rw });
    } else {
      s += roof(c, cx, by1, w, hr, { glaze: gl, det: det, night: o.night, snow: o.snow, rw: o.rw });
    }
    return s;
  }


  /* ======================================================================
     (more helpers follow in later chunks)
     ====================================================================== */

  /* ======================================================================
     7. nature: foliage, trees, rocks, plants, water
     ====================================================================== */
  /* painterly foliage mass: cols=[dark,mid,light] */
  function crown(c, x, y, rx, ry, cols, n, o) {
    o = o || {}; var r = o.r || c.r, bl = [], s = '', i, m = Math.min(rx, ry);
    for (i = 0; i < n; i++) bl.push([x + (r() * 2 - 1) * rx * 0.78, y + (r() * 2 - 1) * ry * 0.7, (0.3 + 0.32 * r()) * m * (o.k || 1.25)]);
    for (i = 0; i < n; i++) s += EL(bl[i][0], bl[i][1] + bl[i][2] * 0.12, bl[i][2] * 1.12, bl[i][2] * 0.9, cols[0]);
    for (i = 0; i < n; i++) s += EL(bl[i][0] - bl[i][2] * 0.1, bl[i][1] - bl[i][2] * 0.1, bl[i][2] * 0.95, bl[i][2] * 0.78, cols[1]);
    for (i = 0; i < n; i++) if (i % 2 === 0) s += EL(bl[i][0] - bl[i][2] * 0.3, bl[i][1] - bl[i][2] * 0.3, bl[i][2] * 0.5, bl[i][2] * 0.34, cols[2], OP(0.85));
    var dl = '', dd = '';
    for (i = 0; i < n * 3; i++) { var an = r() * 6.28, rr = Math.sqrt(r()), px = x + Math.cos(an) * rx * 0.85 * rr, py = y + Math.sin(an) * ry * 0.75 * rr; if (i % 2) dl += 'M' + f1(px) + ' ' + f1(py) + 'h.1'; else dd += 'M' + f1(px) + ' ' + f1(py) + 'h.1'; }
    s += ST(dd, cols[0], 6, 'stroke-linecap="round" opacity=".55"') + ST(dl, cols[2], 7, 'stroke-linecap="round" opacity=".8"');
    return s;
  }
  /* recursive branches. returns {lv:[pathD per depth], tips:[[x,y]]} */
  function branches(c, x, y, len, ang, maxD, o) {
    o = o || {}; var r = o.r || c.r, lv = [], tips = [], i;
    for (i = 0; i <= maxD; i++) lv.push('');
    (function rec(x, y, len, ang, dep) {
      var x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
      var qx = (x + x2) / 2 + (r() - 0.5) * len * 0.35, qy = (y + y2) / 2 + (r() - 0.5) * len * 0.2;
      lv[dep] += 'M' + Math.round(x) + ' ' + Math.round(y) + 'Q' + Math.round(qx) + ' ' + Math.round(qy) + ' ' + Math.round(x2) + ' ' + Math.round(y2);
      if (dep >= maxD) { tips.push([x2, y2]); return; }
      var nb = dep < 1 ? 2 : (r() < 0.3 ? 3 : 2), spread = o.spread || 0.55;
      for (var k = 0; k < nb; k++) rec(x2, y2, len * (0.6 + r() * 0.16), ang + (k - (nb - 1) / 2) * (spread + r() * 0.3) + (r() - 0.5) * 0.35, dep + 1);
    })(x, y, len, ang, 0);
    return { lv: lv, tips: tips };
  }
  /* a tree with seasonal look. kind: 'plum' | 'blossom' | 'broad' | 'ginkgo' | 'maple' | 'bare'
     x,y = base; h = total height */
  function tree(c, x, y, h, kind, o) {
    o = o || {}; var se = c.se, r = o.r || c.r, s = '', bark = o.bark || '#3b2a24', tw = h * 0.045;
    var maxD = o.depth || 5, bt = branches(c, x, y - h * 0.18, h * 0.3, (r() - 0.5) * 0.5, maxD, { r: r, spread: o.spread });
    var snow = se === 3 && !o.nosnow;
    /* trunk */
    var lean = (r() - 0.5) * h * 0.1;
    s += PA('M' + f1(x - tw) + ' ' + f1(y) + 'Q' + f1(x - tw * 0.4 + lean) + ' ' + f1(y - h * 0.1) + ' ' + f1(x - tw * 0.5) + ' ' + f1(y - h * 0.2) + 'L' + f1(x + tw * 0.5) + ' ' + f1(y - h * 0.2) + 'Q' + f1(x + tw * 0.5 + lean) + ' ' + f1(y - h * 0.1) + ' ' + f1(x + tw) + ' ' + f1(y) + 'Z', bark);
    var wpx = [tw * 1.5, tw * 1.0, tw * 0.65, tw * 0.4, tw * 0.25, tw * 0.15];
    var i;
    for (i = 0; i <= maxD; i++) s += SU(c, bt.lv[i], bark, f1(wpx[i] || 1.4), 'stroke-linecap="round"');
    var green = kind === 'broad' ? [['#4b8c46', '#79b95a', '#bde07c'], ['#1e5d38', '#2f8a4a', '#78c060'], ['#9c2a1c', '#d65f28', '#f0b23a'], null] :
      kind === 'ginkgo' ? [['#6a9a3e', '#9ccf55', '#d6ee8a'], ['#2a6a34', '#46a04a', '#8ed066'], ['#b8820e', '#e6b422', '#fbe46a'], null] :
      kind === 'maple' ? [['#4b8c46', '#79b95a', '#bde07c'], ['#1e5d38', '#2f8a4a', '#78c060'], ['#8c1c14', '#c8381e', '#f07a2a'], null] :
      kind === 'blossom' ? [['#d97a9e', '#f2a6c0', '#fff0f5'], ['#2f7a44', '#4aa056', '#8ccc70'], ['#a8481c', '#cf7f2a', '#e8b84a'], null] :
      [['#7ea84a', '#a8cc66', '#d4e890'], ['#2a6a34', '#3f954a', '#7cc060'], ['#9a6a24', '#c89030', '#e2b85a'], null];
    var pal = green[se];
    if (pal && o.dim) pal = pal.map(function (col) { return mix(col, '#1c2858', o.dim); });
    if (pal && !(kind === 'plum' && se !== 1)) {
      var cy = y - h * 0.72, cr = h * 0.38;
      s += crown(c, x + lean, cy, cr * (o.wide || 1.2), cr * 0.85, pal, o.n || 17, { r: r, k: o.k || 1.0 });
      if (kind === 'blossom' && !o.dim) s += fall(c, 'petal', 14, { x0: x - cr, x1: x + cr, y0: cy - cr * 0.6, y1: y + 10, cols: ['#ffd6e0', '#fff'] });
    } else if (kind === 'plum' || kind === 'blossom' || !pal) {
      /* bare / blossom-by-dash trick */
      var bc = se === 0 ? ['#f7b8cc', '#fff3f6', '#e98aa8'] : se === 3 ? ['#e0405a', '#ff7f96', '#fff'] : se === 2 ? ['#b8782a', '#d9a03a', '#8a5a22'] : ['#4aa056', '#7cc060', '#2f7a44'];
      var showB = (kind === 'plum' && (se === 0 || se === 3)) || (kind === 'plum' && se !== 0 && se !== 3);
      if (kind === 'plum' || kind === 'blossom') {
        for (i = 2; i <= maxD; i++) {
          s += SU(c, bt.lv[i], bc[0], 7 + (i % 2) * 3, 'stroke-linecap="round" stroke-dasharray="0 ' + (8 + i * 2) + '" ' + OP(0.95));
          s += SU(c, bt.lv[i], bc[1], 4, 'stroke-linecap="round" stroke-dasharray="0 ' + (12 + i) + '" stroke-dashoffset="5" ' + OP(0.9));
        }
        for (i = 0; i < bt.tips.length; i++) s += CI(bt.tips[i][0], bt.tips[i][1], 4 + (i % 3), bc[2], OP(0.7));
      }
    }
    if (snow) {
      for (i = 1; i <= maxD; i++) s += SU(c, bt.lv[i], '#ffffff', i < 3 ? 4 : 3, 'stroke-linecap="round" stroke-dasharray="' + (10 + i * 3) + ' ' + (16 + i * 4) + '" ' + OP(0.92));
      s += SU(c, bt.lv[0], '#fff', 3, 'stroke-dasharray="22 40" ' + OP(0.85));
    }
    return s;
  }
  /* evergreen pine with cloud-pads */
  function pine(c, x, y, h, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, s = '', tw = h * 0.035, bark = '#44302a', i;
    var lean = (r() - 0.5) * h * 0.25;
    s += PA('M' + f1(x - tw * 1.4) + ' ' + f1(y) + 'C' + f1(x - tw + lean) + ' ' + f1(y - h * 0.3) + ' ' + f1(x + lean * 1.8) + ' ' + f1(y - h * 0.5) + ' ' + f1(x + lean) + ' ' + f1(y - h * 0.85) + 'L' + f1(x + lean + tw * 0.6) + ' ' + f1(y - h * 0.85) + 'C' + f1(x + lean * 2 + tw) + ' ' + f1(y - h * 0.5) + ' ' + f1(x + tw + lean * 0.6) + ' ' + f1(y - h * 0.3) + ' ' + f1(x + tw * 1.4) + ' ' + f1(y) + 'Z', bark);
    var dark = o.dark || '#1c4a34', mid = o.mid || '#2d6a46', hi = o.hi || '#5a9a62';
    var pads = o.pads || 6;
    for (i = 0; i < pads; i++) {
      var t = i / (pads - 1), py = y - h * (0.3 + 0.62 * t), side = i % 2 ? 1 : -1, px = x + lean * t + side * h * (0.12 + 0.1 * r()) * (1 - t * 0.45), pw = h * (0.2 - 0.06 * t) * (0.8 + r() * 0.5), ph = pw * 0.26;
      s += ST('M' + f1(x + lean * t) + ' ' + f1(py + ph * 1.2) + 'L' + f1(px) + ' ' + f1(py + ph * 0.6), bark, Math.max(2, tw * 0.5));
      var d = 'M' + f1(px - pw) + ' ' + f1(py + ph * 0.5) + 'Q' + f1(px - pw * 0.8) + ' ' + f1(py - ph * 1.3) + ' ' + f1(px) + ' ' + f1(py - ph * 1.2) + 'Q' + f1(px + pw * 0.85) + ' ' + f1(py - ph * 1.4) + ' ' + f1(px + pw) + ' ' + f1(py + ph * 0.5) + 'Q' + f1(px + pw * 0.5) + ' ' + f1(py + ph * 0.1) + ' ' + f1(px + pw * 0.2) + ' ' + f1(py + ph * 0.8) + 'Q' + f1(px - pw * 0.3) + ' ' + f1(py + ph * 0.1) + ' ' + f1(px - pw * 0.6) + ' ' + f1(py + ph * 0.7) + 'Z';
      s += PA(d, LG(c, [[0, mid], [1, dark]]));
      s += PA('M' + f1(px - pw * 0.75) + ' ' + f1(py - ph * 0.2) + 'Q' + f1(px - pw * 0.4) + ' ' + f1(py - ph * 1.25) + ' ' + f1(px + pw * 0.1) + ' ' + f1(py - ph * 1.1) + 'Q' + f1(px - pw * 0.3) + ' ' + f1(py - ph * 0.7) + ' ' + f1(px - pw * 0.75) + ' ' + f1(py - ph * 0.2) + 'Z', hi, OP(0.7));
      if (se === 3 && !o.nosnow) s += PA('M' + f1(px - pw * 0.9) + ' ' + f1(py) + 'Q' + f1(px - pw * 0.6) + ' ' + f1(py - ph * 1.5) + ' ' + f1(px) + ' ' + f1(py - ph * 1.35) + 'Q' + f1(px + pw * 0.7) + ' ' + f1(py - ph * 1.6) + ' ' + f1(px + pw * 0.95) + ' ' + f1(py - ph * 0.2) + 'Q' + f1(px + pw * 0.4) + ' ' + f1(py - ph * 0.8) + ' ' + f1(px) + ' ' + f1(py - ph * 0.5) + 'Q' + f1(px - pw * 0.5) + ' ' + f1(py - ph * 0.9) + ' ' + f1(px - pw * 0.9) + ' ' + f1(py) + 'Z', '#f6f9ff', OP(0.95));
    }
    return s;
  }
  /* drooping willow */
  function willow(c, x, y, h, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, s = '', tw = h * 0.04, bark = '#4a3a2c', i;
    s += PA('M' + f1(x - tw * 1.2) + ' ' + f1(y) + 'Q' + f1(x - tw * 0.2) + ' ' + f1(y - h * 0.35) + ' ' + f1(x - tw * 0.5) + ' ' + f1(y - h * 0.62) + 'L' + f1(x + tw * 0.7) + ' ' + f1(y - h * 0.62) + 'Q' + f1(x + tw * 0.9) + ' ' + f1(y - h * 0.35) + ' ' + f1(x + tw * 1.3) + ' ' + f1(y) + 'Z', bark);
    var cols = [['#9fce62', '#c2e27c'], ['#3f8f48', '#68b45a'], ['#c8a03a', '#e2c260'], ['#8a7a5c', '#b8a888']][se];
    var d1 = '', d2 = '';
    if (se !== 3) s += GR(crown(c, x, y - h * 0.74, h * 0.36, h * 0.12, [dk(cols[0], 0.25), cols[0], cols[1]], 8, { r: r, k: 0.9 }), RO(c, 4, '.05'));
    for (i = 0; i < (o.n || 26); i++) {
      var a = -1 + (2 * i) / ((o.n || 26) - 1), bx = x + a * h * 0.42 + (r() - 0.5) * 20, by = y - h * (0.7 - Math.abs(a) * 0.12) + (r() - 0.5) * 16, len = h * (0.3 + r() * 0.3) * (1 - Math.abs(a) * 0.25), sw = (r() - 0.5) * 26;
      var seg = 'M' + f1(bx) + ' ' + f1(by) + 'Q' + f1(bx + sw * 0.6) + ' ' + f1(by + len * 0.5) + ' ' + f1(bx + sw) + ' ' + f1(by + len);
      if (i % 2) d1 += seg; else d2 += seg;
    }
    s += ST(d1, cols[0], se === 3 ? 1.4 : 3, OP(0.92)) + ST(d2, cols[1], se === 3 ? 1.2 : 2.6, OP(0.88));
    if (se !== 3) s += ST(d1, cols[1], 6, 'stroke-dasharray="0 11" stroke-linecap="round" ' + OP(0.7));
    s += ST('M' + f1(x - h * 0.4) + ' ' + f1(y - h * 0.68) + 'Q' + f1(x) + ' ' + f1(y - h * 0.82) + ' ' + f1(x + h * 0.42) + ' ' + f1(y - h * 0.68), bark, tw * 0.6);
    return s;
  }
  /* Taihu rock with holes and folds. base y; returns svg */
  function rock(c, x, y, w, h, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, s = '', N = 15, pts = [], i;
    var col = o.col || '#8a8d9e';
    for (i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2, nr = 1 + (r() - 0.5) * 0.62 + 0.12 * Math.sin(a * 3 + w);
      var px = x + Math.cos(a) * w * 0.5 * nr * (1 - 0.2 * Math.sin(a)), py = y - h * 0.5 + Math.sin(a) * h * 0.5 * nr * (1 + (r() - 0.5) * 0.25);
      if (py > y - 1) py = y - 1;
      pts.push([px, py]);
    }
    var d = 'M' + f1((pts[0][0] + pts[1][0]) / 2) + ' ' + f1((pts[0][1] + pts[1][1]) / 2);
    for (i = 1; i <= N; i++) { var p = pts[i % N], q = pts[(i + 1) % N]; d += 'Q' + f1(p[0]) + ' ' + f1(p[1]) + ' ' + f1((p[0] + q[0]) / 2) + ' ' + f1((p[1] + q[1]) / 2); }
    d += 'Z';
    s += EL(x + w * 0.08, y + 2, w * 0.58, h * 0.045, '#000', OP(0.28));
    s += PA(d, LG(c, [[0, lt(col, 0.32)], [0.5, col], [1, dk(col, 0.55)]], [0, 0, 1, 1]));
    var cid = CP(c, d);
    s += '<g clip-path="url(#' + cid + ')">' + RC(x - w, y - h * 1.1, w * 2, h * 1.2, LG(c, [[0, '#fff', 0.22], [0.45, '#fff', 0], [1, '#000', 0.4]], [0, 0, 1, 0]));
    var fd = '', fl = '';
    for (i = 0; i < 5; i++) {
      var fx = x - w * 0.36 + (i / 4) * w * 0.7 + (r() - 0.5) * w * 0.1, fy = y - h * (0.12 + 0.2 * r());
      fd += 'M' + f1(fx) + ' ' + f1(fy) + 'Q' + f1(fx + (r() - 0.5) * w * 0.3) + ' ' + f1(fy - h * 0.3) + ' ' + f1(fx + (r() - 0.3) * w * 0.16) + ' ' + f1(fy - h * (0.5 + 0.3 * r()));
      fl += 'M' + f1(fx - w * 0.04) + ' ' + f1(fy - h * 0.05) + 'Q' + f1(fx - w * 0.06) + ' ' + f1(fy - h * 0.3) + ' ' + f1(fx - w * 0.02) + ' ' + f1(fy - h * 0.55);
    }
    s += ST(fd, dk(col, 0.6), 3.2, 'stroke-linecap="round" ' + OP(0.32)) + ST(fl, lt(col, 0.5), 2.4, 'stroke-linecap="round" ' + OP(0.4));
    var nh = o.holes == null ? (h > 230 ? 2 : 1) : o.holes;
    for (i = 0; i < nh; i++) {
      var hx_ = x + (i ? 0.16 : -0.1) * w + (r() - 0.5) * w * 0.1, hy = y - h * (i ? 0.62 : 0.4 + 0.1 * r()), hr = Math.min(w, h) * (i ? 0.034 : 0.062), rot = 'transform="rotate(' + (i ? 30 : -28) + ' ' + f1(hx_) + ' ' + f1(hy) + ')"';
      s += EL(hx_ + 1.5, hy + 2, hr * 1.5, hr, lt(col, 0.3), rot + ' ' + OP(0.8)) + EL(hx_, hy, hr * 1.5, hr, dk(col, 0.75), rot) + EL(hx_ - hr * 0.3, hy - hr * 0.2, hr, hr * 0.62, '#000', rot + ' ' + OP(0.35));
    }
    s += '</g>';
    if (se === 3 && !o.nosnow) s += PA('M' + f1(x - w * 0.3) + ' ' + f1(y - h * 0.8) + 'Q' + f1(x) + ' ' + f1(y - h * 1.08) + ' ' + f1(x + w * 0.3) + ' ' + f1(y - h * 0.82) + 'Q' + f1(x + w * 0.1) + ' ' + f1(y - h * 0.7) + ' ' + f1(x - w * 0.05) + ' ' + f1(y - h * 0.72) + 'Q' + f1(x - w * 0.2) + ' ' + f1(y - h * 0.62) + ' ' + f1(x - w * 0.3) + ' ' + f1(y - h * 0.8) + 'Z', '#f6f9ff', OP(0.96));
    else if (!o.nomoss) s += EL(x - w * 0.12, y - h * 0.04, w * 0.28, h * 0.05, se === 2 ? '#8a8a3a' : '#3f7a42', OP(0.7)) + EL(x + w * 0.2, y - h * 0.03, w * 0.16, h * 0.035, se === 2 ? '#8a8a3a' : '#3f7a42', OP(0.6));
    return s;
  }
  /* peony bush (flowers in spring; green in summer; brown autumn; mulch in winter) */
  function peony(c, x, y, s_, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, s = '', i;
    var lc = [['#3f8a44', '#6cb050'], ['#2b6e3c', '#4b9a4e'], ['#8a6a28', '#b8883a'], ['#6a5a40', '#8a7a5a']][se];
    for (i = 0; i < 9; i++) { var lx = x + (r() - 0.5) * 90 * s_, ly = y - r() * 50 * s_; s += EL(lx, ly, 26 * s_, 13 * s_, lc[i % 2], 'transform="rotate(' + Math.round((r() - 0.5) * 80) + ' ' + f1(lx) + ' ' + f1(ly) + ')" ' + OP(0.95)); }
    if (se === 0 || se === 1) {
      var fc = o.fc || (se === 0 ? ['#e8567a', '#f6a1ba', '#ffe4ec'] : ['#d63a5e', '#ee7a98', '#ffd0dc']);
      for (i = 0; i < 4; i++) {
        var fx = x + (i - 1.5) * 28 * s_ + (r() - 0.5) * 12, fy = y - (36 + r() * 30) * s_, fr = (15 + r() * 7) * s_;
        s += CI(fx, fy, fr * 1.15, fc[0], OP(0.9)) + CI(fx - 1, fy - 1, fr * 0.9, fc[1]) + CI(fx - 2, fy - 2, fr * 0.55, fc[2]) + CI(fx - 2, fy - 2, fr * 0.2, '#f2c84a');
        s += ST('M' + f1(fx - fr * 0.7) + ' ' + f1(fy) + 'Q' + f1(fx) + ' ' + f1(fy - fr * 0.5) + ' ' + f1(fx + fr * 0.7) + ' ' + f1(fy), fc[0], 1.1, OP(0.6));
      }
    }
    if (se === 3) s += EL(x, y - 10 * s_, 52 * s_, 18 * s_, '#fff', OP(0.9));
    return s;
  }
  /* lotus pond plants. region x0..x1, y0..y1 */
  function lotus(c, x0, x1, y0, y1, n, o) {
    o = o || {}; var r = o.r || c.r, se = c.se, s = '', i;
    if (se === 3) { for (i = 0; i < n / 2; i++) { var sx = x0 + r() * (x1 - x0), sy = y0 + r() * (y1 - y0); s += ST('M' + f1(sx) + ' ' + f1(sy) + 'L' + f1(sx + (r() - 0.5) * 14) + ' ' + f1(sy - 20 - r() * 20), '#6a5a48', 1.6, OP(0.7)); } return s; }
    var pa = [];
    for (i = 0; i < n; i++) pa.push([x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), r()]);
    pa.sort(function (a, b) { return a[1] - b[1]; });
    for (i = 0; i < pa.length; i++) {
      var lx = pa[i][0], ly = pa[i][1], sz = 0.6 + (ly - y0) / (y1 - y0 + 1) * 0.9, t = pa[i][2];
      var lc = se === 2 ? ['#9a7a3a', '#6a5224'] : se === 0 ? ['#8cc67a', '#4f9a52'] : ['#4fa05a', '#1f6a3c'];
      var rx = (38 + t * 18) * sz * (se === 0 ? 0.55 : 1);
      s += EL(lx, ly + 4 * sz, rx * 1.05, rx * 0.34, '#000', OP(0.18));
      s += EL(lx, ly, rx, rx * 0.34, RG(c, [[0, lc[0]], [1, lc[1]]], [0.45, 0.4, 0.7]));
      if (se !== 0) s += ST('M' + f1(lx) + ' ' + f1(ly) + 'L' + f1(lx - rx * 0.8) + ' ' + f1(ly - rx * 0.1) + 'M' + f1(lx) + ' ' + f1(ly) + 'L' + f1(lx + rx * 0.7) + ' ' + f1(ly - rx * 0.16) + 'M' + f1(lx) + ' ' + f1(ly) + 'L' + f1(lx + rx * 0.1) + ' ' + f1(ly + rx * 0.28), lc[1], 0.9, OP(0.5));
      if (se === 1 && t > 0.55) {
        var fy = ly - 34 * sz;
        s += ST('M' + f1(lx) + ' ' + f1(ly) + 'L' + f1(lx) + ' ' + f1(fy + 8), '#3f8a48', 2 * sz);
        s += PA('M' + f1(lx) + ' ' + f1(fy - 14 * sz) + 'Q' + f1(lx - 10 * sz) + ' ' + f1(fy) + ' ' + f1(lx) + ' ' + f1(fy + 8) + 'Q' + f1(lx + 10 * sz) + ' ' + f1(fy) + ' ' + f1(lx) + ' ' + f1(fy - 14 * sz) + 'Z', '#f6a6c0') + PA('M' + f1(lx - 14 * sz) + ' ' + f1(fy - 4 * sz) + 'Q' + f1(lx - 8 * sz) + ' ' + f1(fy + 8) + ' ' + f1(lx) + ' ' + f1(fy + 8) + 'Q' + f1(lx - 8 * sz) + ' ' + f1(fy - 2) + ' ' + f1(lx - 14 * sz) + ' ' + f1(fy - 4 * sz) + 'Z', '#ee86a6') + PA('M' + f1(lx + 14 * sz) + ' ' + f1(fy - 4 * sz) + 'Q' + f1(lx + 8 * sz) + ' ' + f1(fy + 8) + ' ' + f1(lx) + ' ' + f1(fy + 8) + 'Q' + f1(lx + 8 * sz) + ' ' + f1(fy - 2) + ' ' + f1(lx + 14 * sz) + ' ' + f1(fy - 4 * sz) + 'Z', '#f9bdd0');
      }
      if (se === 2 && t > 0.6) s += ST('M' + f1(lx) + ' ' + f1(ly) + 'L' + f1(lx + 6) + ' ' + f1(ly - 44 * sz), '#6a5230', 2) + EL(lx + 6, ly - 46 * sz, 7 * sz, 4 * sz, '#8a6a30');
    }
    return s;
  }
  /* water: gradient + ripples. returns svg */
  function water(c, y0, y1, top, bot, o) {
    o = o || {}; var s = RC(0, y0, W, y1 - y0, LG(c, [[0, top], [1, bot]])), r = c.r, i;
    if (o.glints) {
      var gcol = o.gcol || '#fff6d0';
      for (i = 0; i < (o.nr || 26); i++) { var x = r() * W, y = y0 + 6 + r() * (y1 - y0 - 10), w = 30 + r() * 110 * (0.4 + (y - y0) / (y1 - y0)); s += LN(x, y, x + w, y, gcol, f1(0.8 + r() * 1.4), OP(f1(0.12 + r() * 0.28))); }
    }
    return s;
  }
  /* reflect a group (defined once in defs) across horizontal line yw */
  function reflect(c, name, content, yw, op, bl) {
    var id = c.def('G' + name, function (id) { return '<g id="' + id + '">' + content + '</g>'; });
    return '<use href="#' + id + '" transform="translate(0 ' + f1(2 * yw) + ') scale(1 -1)" ' + OP(op == null ? 0.4 : op) + ' ' + BL(c, bl || 3) + '/>';
  }

  /* ======================================================================
     8. props: censer, smoke, brazier, candle, vase, screens, furniture
     ====================================================================== */
  function smoke(c, x, y, h, col, op, o) {
    o = o || {}; var s = '', k = o.n || 2, i, sw = o.sw || 26;
    for (i = 0; i < k; i++) {
      var dx = (i - (k - 1) / 2) * 10, a = i % 2 ? 1 : -1;
      var d = 'M' + f1(x + dx) + ' ' + f1(y) + 'C' + f1(x + dx + a * sw) + ' ' + f1(y - h * 0.25) + ' ' + f1(x + dx - a * sw * 1.2) + ' ' + f1(y - h * 0.5) + ' ' + f1(x + dx + a * sw * 0.4) + ' ' + f1(y - h * 0.72) + 'S' + f1(x + dx + a * sw * 1.4) + ' ' + f1(y - h * 0.92) + ' ' + f1(x + dx - a * sw * 0.2) + ' ' + f1(y - h);
      s += ST(d, col, (o.w || 7) - i * 1.4, 'stroke-linecap="round" ' + OP(f1(op * (1 - i * 0.2))));
    }
    return GR(s, BL(c, o.bl || 3.2));
  }
  /* bronze three-legged censer (鼎) */
  function censer(c, x, y, s_, o) {
    o = o || {}; var s = '', br = o.col || '#8a6a2c';
    s += EL(x, y + 2 * s_, 36 * s_, 6 * s_, '#000', OP(0.3));
    s += PA('M' + f1(x - 24 * s_) + ' ' + f1(y - 18 * s_) + 'L' + f1(x - 30 * s_) + ' ' + f1(y) + 'L' + f1(x - 22 * s_) + ' ' + f1(y) + 'L' + f1(x - 18 * s_) + ' ' + f1(y - 18 * s_) + 'Z', dk(br, 0.3)) + PA('M' + f1(x + 24 * s_) + ' ' + f1(y - 18 * s_) + 'L' + f1(x + 30 * s_) + ' ' + f1(y) + 'L' + f1(x + 22 * s_) + ' ' + f1(y) + 'L' + f1(x + 18 * s_) + ' ' + f1(y - 18 * s_) + 'Z', dk(br, 0.3)) + PA('M' + f1(x - 5 * s_) + ' ' + f1(y - 16 * s_) + 'L' + f1(x - 4 * s_) + ' ' + f1(y) + 'L' + f1(x + 4 * s_) + ' ' + f1(y) + 'L' + f1(x + 5 * s_) + ' ' + f1(y - 16 * s_) + 'Z', dk(br, 0.4));
    s += PA('M' + f1(x - 32 * s_) + ' ' + f1(y - 44 * s_) + 'Q' + f1(x - 40 * s_) + ' ' + f1(y - 16 * s_) + ' ' + f1(x - 20 * s_) + ' ' + f1(y - 14 * s_) + 'L' + f1(x + 20 * s_) + ' ' + f1(y - 14 * s_) + 'Q' + f1(x + 40 * s_) + ' ' + f1(y - 16 * s_) + ' ' + f1(x + 32 * s_) + ' ' + f1(y - 44 * s_) + 'Z', LG(c, [[0, lt(br, 0.3)], [0.4, br], [1, dk(br, 0.55)]], [0, 0, 1, 0]));
    s += EL(x, y - 44 * s_, 34 * s_, 7 * s_, dk(br, 0.35)) + EL(x, y - 44.5 * s_, 30 * s_, 4.5 * s_, '#1a120c');
    s += ST('M' + f1(x - 30 * s_) + ' ' + f1(y - 32 * s_) + 'Q' + f1(x) + ' ' + f1(y - 26 * s_) + ' ' + f1(x + 30 * s_) + ' ' + f1(y - 32 * s_), lt(br, 0.35), 1.6 * s_, OP(0.6));
    s += ST('M' + f1(x - 33 * s_) + ' ' + f1(y - 46 * s_) + 'Q' + f1(x - 46 * s_) + ' ' + f1(y - 60 * s_) + ' ' + f1(x - 30 * s_) + ' ' + f1(y - 62 * s_) + 'M' + f1(x + 33 * s_) + ' ' + f1(y - 46 * s_) + 'Q' + f1(x + 46 * s_) + ' ' + f1(y - 60 * s_) + ' ' + f1(x + 30 * s_) + ' ' + f1(y - 62 * s_), br, 4 * s_);
    return s;
  }
  /* brazier with glowing coals and flame */
  function brazier(c, x, y, s_, o) {
    o = o || {}; var s = '';
    s += glow(c, x, y - 40 * s_, 150 * s_, '#ff8a2a', 0.5 * (o.g == null ? 1 : o.g));
    s += EL(x, y + 2 * s_, 44 * s_, 7 * s_, '#000', OP(0.35));
    s += ST('M' + f1(x - 22 * s_) + ' ' + f1(y - 22 * s_) + 'L' + f1(x - 34 * s_) + ' ' + f1(y) + 'M' + f1(x + 22 * s_) + ' ' + f1(y - 22 * s_) + 'L' + f1(x + 34 * s_) + ' ' + f1(y) + 'M' + f1(x) + ' ' + f1(y - 20 * s_) + 'L' + f1(x) + ' ' + f1(y), '#2a1c14', 5 * s_, 'stroke-linecap="round"');
    s += PA('M' + f1(x - 40 * s_) + ' ' + f1(y - 52 * s_) + 'Q' + f1(x - 40 * s_) + ' ' + f1(y - 22 * s_) + ' ' + f1(x - 18 * s_) + ' ' + f1(y - 20 * s_) + 'L' + f1(x + 18 * s_) + ' ' + f1(y - 20 * s_) + 'Q' + f1(x + 40 * s_) + ' ' + f1(y - 22 * s_) + ' ' + f1(x + 40 * s_) + ' ' + f1(y - 52 * s_) + 'Z', LG(c, [[0, '#7a5a2a'], [0.5, '#4a3418'], [1, '#2a1c0c']], [0, 0, 1, 0]));
    s += EL(x, y - 52 * s_, 40 * s_, 8 * s_, '#8a6a30') + EL(x, y - 52 * s_, 35 * s_, 6 * s_, RG(c, [[0, '#ffd070'], [0.5, '#ff7a1c'], [1, '#8a1c0c']]));
    s += PA('M' + f1(x - 16 * s_) + ' ' + f1(y - 54 * s_) + 'Q' + f1(x - 14 * s_) + ' ' + f1(y - 80 * s_) + ' ' + f1(x - 4 * s_) + ' ' + f1(y - 96 * s_) + 'Q' + f1(x) + ' ' + f1(y - 76 * s_) + ' ' + f1(x + 10 * s_) + ' ' + f1(y - 84 * s_) + 'Q' + f1(x + 18 * s_) + ' ' + f1(y - 66 * s_) + ' ' + f1(x + 14 * s_) + ' ' + f1(y - 54 * s_) + 'Z', LG(c, [[0, '#fff0a0'], [0.5, '#ff9a2a'], [1, '#e0401a']], [0, 0, 0, 1]), OP(0.92));
    return s;
  }
  /* candle on a small stand */
  function candle(c, x, y, s_, o) {
    o = o || {}; var s = '', hgt = (o.h || 40) * s_;
    s += glow(c, x, y - hgt - 6 * s_, 90 * s_, '#ffc766', 0.55 * (o.g == null ? 1 : o.g));
    s += RC(x - 9 * s_, y - 4 * s_, 18 * s_, 4 * s_, GOLDD) + RC(x - 3 * s_, y - 12 * s_, 6 * s_, 9 * s_, GOLD) + RC(x - 8 * s_, y - 14 * s_, 16 * s_, 3 * s_, GOLD);
    s += RC(x - 4.5 * s_, y - 14 * s_ - hgt, 9 * s_, hgt, LG(c, [[0, '#c8281c'], [0.5, '#e8503a'], [1, '#9a1a10']], [0, 0, 1, 0]));
    s += PA('M' + f1(x) + ' ' + f1(y - 14 * s_ - hgt - 17 * s_) + 'Q' + f1(x - 6 * s_) + ' ' + f1(y - 14 * s_ - hgt - 6 * s_) + ' ' + f1(x) + ' ' + f1(y - 14 * s_ - hgt - 1) + 'Q' + f1(x + 6 * s_) + ' ' + f1(y - 14 * s_ - hgt - 6 * s_) + ' ' + f1(x) + ' ' + f1(y - 14 * s_ - hgt - 17 * s_) + 'Z', LG(c, [[0, '#fffbe0'], [0.5, '#ffc040'], [1, '#ff7a1a']]));
    return s;
  }
  /* porcelain vase */
  function vase(c, x, y, s_, col, o) {
    o = o || {}; col = col || '#e8eef4';
    var s = EL(x, y + 1, 22 * s_, 4 * s_, '#000', OP(0.3));
    s += PA('M' + f1(x - 9 * s_) + ' ' + f1(y - 86 * s_) + 'Q' + f1(x - 8 * s_) + ' ' + f1(y - 66 * s_) + ' ' + f1(x - 22 * s_) + ' ' + f1(y - 44 * s_) + 'Q' + f1(x - 30 * s_) + ' ' + f1(y - 10 * s_) + ' ' + f1(x - 14 * s_) + ' ' + f1(y) + 'L' + f1(x + 14 * s_) + ' ' + f1(y) + 'Q' + f1(x + 30 * s_) + ' ' + f1(y - 10 * s_) + ' ' + f1(x + 22 * s_) + ' ' + f1(y - 44 * s_) + 'Q' + f1(x + 8 * s_) + ' ' + f1(y - 66 * s_) + ' ' + f1(x + 9 * s_) + ' ' + f1(y - 86 * s_) + 'Z', LG(c, [[0, dk(col, 0.28)], [0.35, lt(col, 0.4)], [0.7, col], [1, dk(col, 0.35)]], [0, 0, 1, 0]));
    if (o.blue !== false) { s += ST('M' + f1(x - 25 * s_) + ' ' + f1(y - 36 * s_) + 'Q' + f1(x) + ' ' + f1(y - 30 * s_) + ' ' + f1(x + 25 * s_) + ' ' + f1(y - 36 * s_), '#2a5a9a', 2.2 * s_, OP(0.8)); s += ST('M' + f1(x - 14 * s_) + ' ' + f1(y - 24 * s_) + 'q' + f1(6 * s_) + ' ' + f1(-14 * s_) + ' ' + f1(14 * s_) + ' ' + f1(-4 * s_) + 'q' + f1(6 * s_) + ' ' + f1(-12 * s_) + ' ' + f1(12 * s_) + ' ' + f1(2 * s_), '#2a5a9a', 2 * s_, OP(0.75)); }
    return s;
  }
  /* wooden table / desk: front elevation, top at y */
  function table(c, x, y, w, h, o) {
    o = o || {}; var wood = o.wood || '#5a2c1c', s = '', lw = w * 0.04;
    s += EL(x, y + h + 3, w * 0.52, 7, '#000', OP(0.3));
    s += RC(x - w * 0.46, y + h * 0.12, lw, h * 0.88, dk(wood, 0.25)) + RC(x + w * 0.46 - lw, y + h * 0.12, lw, h * 0.88, dk(wood, 0.25));
    s += RC(x - w * 0.5, y, w, h * 0.14, LG(c, [[0, lt(wood, 0.25)], [1, dk(wood, 0.1)]]));
    s += RC(x - w * 0.46, y + h * 0.14, w * 0.92, h * 0.1, dk(wood, 0.3)) + RC(x - w * 0.5, y, w, 1.8, lt(wood, 0.5), OP(0.7));
    if (o.apron !== false) s += RC(x - w * 0.42, y + h * 0.5, w * 0.84, h * 0.06, dk(wood, 0.35));
    return s;
  }
  /* framed painting / plaque panel */
  function frame(c, x, y, w, h, o) {
    o = o || {}; var s = '', fr = o.fr || '#5a3418', silk = o.silk || '#e9dcc0';
    s += RC(x - 4, y - 4, w + 8, h + 8, dk(fr, 0.2)) + RC(x, y, w, h, LG(c, [[0, lt(silk, 0.15)], [1, dk(silk, 0.12)]]));
    return s;
  }
  /* Chinese landscape painting inside a box (ink wash mountains) */
  function paintLand(c, x, y, w, h, o) {
    o = o || {}; var s = '', ink = o.ink || '#4a5a64', id = CPR(c, x, y, w, h);
    s += '<g clip-path="url(#' + id + ')">';
    s += EL(x + w * 0.72, y + h * 0.28, w * 0.07, w * 0.07, '#d9544a', OP(0.7));
    s += PA('M' + f1(x) + ' ' + f1(y + h * 0.7) + 'Q' + f1(x + w * 0.2) + ' ' + f1(y + h * 0.25) + ' ' + f1(x + w * 0.35) + ' ' + f1(y + h * 0.6) + 'Q' + f1(x + w * 0.5) + ' ' + f1(y + h * 0.2) + ' ' + f1(x + w * 0.7) + ' ' + f1(y + h * 0.62) + 'Q' + f1(x + w * 0.85) + ' ' + f1(y + h * 0.42) + ' ' + f1(x + w) + ' ' + f1(y + h * 0.66) + 'V' + f1(y + h) + 'H' + f1(x) + 'Z', ink, OP(0.5));
    s += PA('M' + f1(x) + ' ' + f1(y + h * 0.84) + 'Q' + f1(x + w * 0.3) + ' ' + f1(y + h * 0.55) + ' ' + f1(x + w * 0.55) + ' ' + f1(y + h * 0.8) + 'Q' + f1(x + w * 0.8) + ' ' + f1(y + h * 0.62) + ' ' + f1(x + w) + ' ' + f1(y + h * 0.8) + 'V' + f1(y + h) + 'H' + f1(x) + 'Z', dk(ink, 0.35), OP(0.6));
    s += mist(c, y + h * 0.62, h * 0.1, '#f4ecd8', 0.6);
    s += '</g>';
    return s;
  }
  /* round moon window */
  function moonWindow(c, x, y, r, o) {
    o = o || {}; var s = '';
    s += CI(x, y, r + 10, o.fr || '#3a1a10');
    s += CI(x, y, r, o.sky || LG(c, [[0, '#cfe4f0'], [1, '#f4ecd0']]));
    return s;
  }
  /* stone-lion-less simple stone path (perspective-free) */
  function cobbles(c, x0, x1, y0, y1, col, n) {
    var r = c.r, s = '', i;
    for (i = 0; i < n; i++) { var x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), k = 0.5 + (y - y0) / (y1 - y0); s += EL(x, y, (16 + r() * 18) * k, (6 + r() * 5) * k, i % 3 ? lt(col, 0.1 + r() * 0.12) : dk(col, 0.1 + r() * 0.12), OP(0.55)); }
    return s;
  }

  /* ======================================================================
     9. one-point-perspective room toolkit
     ====================================================================== */
  function room(c, o) {
    var R = { vx: o.vx || 800, vy: o.vy || 400, sb: o.sb || 0.34, Xw: o.Xw || 880, Yf: o.Yf || 640, Yc: o.Yc || -520, c: c };
    R.s = function (d) { return 1 / (1 + d * (1 / R.sb - 1)); };
    R.P = function (X, Y, d) { var s = R.s(d); return [R.vx + X * s, R.vy + Y * s]; };
    R.pts = function (a) { /* array of [X,Y,d] -> flat coords */ var out = [], i; for (i = 0; i < a.length; i++) { var p = R.P(a[i][0], a[i][1], a[i][2]); out.push(p[0], p[1]); } return out; };
    R.quad = function (a, fill, x_) { return POLY(R.pts(a), fill, x_); };
    /* back wall rectangle */
    R.back = function (fill) { var a = R.P(-R.Xw, R.Yc, 1), b = R.P(R.Xw, R.Yf, 1); return RC(a[0], a[1], b[0] - a[0], b[1] - a[1], fill); };
    R.backRect = function () { var a = R.P(-R.Xw, R.Yc, 1), b = R.P(R.Xw, R.Yf, 1); return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] }; };
    R.floor = function (fill) { return R.quad([[-R.Xw * 1.6, R.Yf, -0.25], [R.Xw * 1.6, R.Yf, -0.25], [R.Xw, R.Yf, 1], [-R.Xw, R.Yf, 1]], fill); };
    R.ceil = function (fill) { return R.quad([[-R.Xw * 1.6, R.Yc, -0.25], [R.Xw * 1.6, R.Yc, -0.25], [R.Xw, R.Yc, 1], [-R.Xw, R.Yc, 1]], fill); };
    R.wallL = function (fill) { return R.quad([[-R.Xw, R.Yc, -0.25], [-R.Xw, R.Yf, -0.25], [-R.Xw, R.Yf, 1], [-R.Xw, R.Yc, 1]], fill); };
    R.wallR = function (fill) { return R.quad([[R.Xw, R.Yc, -0.25], [R.Xw, R.Yf, -0.25], [R.Xw, R.Yf, 1], [R.Xw, R.Yc, 1]], fill); };
    /* floor grid: lines at depths + converging lines */
    R.floorGrid = function (col, op, nd, nx, d0) {
      var s = '', i, d = '';
      for (i = 0; i < nd; i++) { var dd = (d0 || 0) + (1 - (d0 || 0)) * Math.pow(i / nd, 1.7) , p = R.P(-R.Xw * 1.6, R.Yf, dd), q = R.P(R.Xw * 1.6, R.Yf, dd); d += 'M' + f1(p[0]) + ' ' + f1(p[1]) + 'L' + f1(q[0]) + ' ' + f1(q[1]); }
      for (i = -nx; i <= nx; i++) { var X = (i / nx) * R.Xw * 1.4, a = R.P(X, R.Yf, -0.25), b = R.P(X, R.Yf, 1); d += 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]); }
      return ST(d, col, 1.2, OP(op));
    };
    /* a vertical pillar (square-ish column) at lateral X, depth d, width pw (near-plane px), from Y0 to Y1 */
    R.pillar = function (X, d, pw, fill, o) {
      o = o || {}; var s_ = R.s(d), top = R.P(X, o.Y0 == null ? R.Yc : o.Y0, d), bot = R.P(X, o.Y1 == null ? R.Yf : o.Y1, d), w = pw * s_, s = '';
      s += RC(top[0] - w / 2, top[1], w, bot[1] - top[1], fill);
      if (o.base !== false) s += RC(bot[0] - w * 0.78, bot[1] - w * 0.55, w * 1.56, w * 0.55, o.baseCol || '#3a2a22') + RC(bot[0] - w * 0.62, bot[1] - w * 0.8, w * 1.24, w * 0.28, o.baseCol2 || '#4e3a2e');
      if (o.cap !== false) s += RC(top[0] - w * 0.62, top[1], w * 1.24, w * 0.35, o.capCol || '#1d5668');
      return s;
    };
    /* a horizontal cross-beam at depth d spanning the width at ceiling level, thickness t (near-plane px) */
    R.beam = function (d, t, fill, o) {
      o = o || {}; var a = R.P(-R.Xw * 1.6, R.Yc, d), b = R.P(R.Xw * 1.6, R.Yc, d), th = t * R.s(d);
      return RC(a[0], a[1], b[0] - a[0], th, fill) + (o.pat ? RC(a[0], a[1] + th * 0.12, b[0] - a[0], th * 0.76, o.pat) : '') + RC(a[0], a[1] + th, b[0] - a[0], Math.max(1.5, th * 0.12), '#000', OP(0.35));
    };
    R.obj = function (X, Y, d) { var p = R.P(X, Y, d); return { x: p[0], y: p[1], s: R.s(d) }; };
    return R;
  }

  /* a branch entering from a corner/edge, seasonal blossoms or leaves (foreground framing) */
  function branchCorner(c, x, y, len, ang, o) {
    o = o || {}; var se = c.se, s = '', i, bt = branches(c, x, y, len, ang, 5, { r: rngf(o.seed || 7), spread: o.spread || 0.5 });
    var bark = o.bark || '#241a1c', wd = [10, 6.5, 4.2, 2.8, 1.8, 1.2], k = o.k || 1;
    var cols = o.cols || [['#f6a8c4', '#fff2f6'], ['#2f7a44', '#56ac5a'], ['#c8381e', '#eaa030'], ['#e0405a', '#ff94aa']][se];
    for (i = 0; i <= 5; i++) s += SU(c, bt.lv[i], bark, f1(wd[i] * k), 'stroke-linecap="round"');
    for (i = 2; i <= 5; i++) {
      if (se === 1 || se === 2) { s += SU(c, bt.lv[i], cols[0], 11 * k, 'stroke-linecap="round" stroke-dasharray="0 13" ' + OP(0.95)) + SU(c, bt.lv[i], cols[1], 7 * k, 'stroke-linecap="round" stroke-dasharray="0 17" stroke-dashoffset="6" ' + OP(0.95)); }
      else { s += SU(c, bt.lv[i], cols[0], 8 * k, 'stroke-linecap="round" stroke-dasharray="0 11" ' + OP(0.95)) + SU(c, bt.lv[i], cols[1], 4.6 * k, 'stroke-linecap="round" stroke-dasharray="0 15" stroke-dashoffset="4" ' + OP(0.95)); }
    }
    if (se === 3) for (i = 1; i <= 4; i++) s += SU(c, bt.lv[i], '#fff', 3.4 * k, 'stroke-linecap="round" stroke-dasharray="12 22" ' + OP(0.9));
    return s;
  }
  function endcap(c, o) {
    o = o || {};
    return vignette(c, o.v == null ? 0.5 : o.v) + floorShade(c, o.f == null ? 0.3 : o.f) + (o.noGrain ? '' : grain(c, o.g));
  }
  /* seasonal palettes */
  function seasonSky(se) { return [[[0, '#8cc4ec'], [0.55, '#d6eaf2'], [1, '#fbece0']], [[0, '#3c96d6'], [0.55, '#b8e0f2'], [1, '#f0f4e6']], [[0, '#82aed2'], [0.5, '#f0d6b0'], [1, '#fbe2bc']], [[0, '#98a6bd'], [0.55, '#d2d7e5'], [1, '#eceef5']]][se]; }
  function seasonGround(se) { return [['#9dbb78', '#6f9a58'], ['#6fa656', '#3f7a40'], ['#bd9a52', '#8f6e32'], ['#eef2fa', '#c4d0e6']][se]; }
  function seasonHill(se) { return [['#a4c4b0', '#dcead8'], ['#78ac8c', '#c8e2d0'], ['#c8a272', '#ecd8b2'], ['#bcc8dc', '#e8ecf5']][se]; }

  /* ======================================================================
     10. scenes
     ====================================================================== */
  var SCENES = {};

  /* ---------- title: the Forbidden City by moonlight ---------- */
  SCENES.title = function (c) {
    var se = c.se, s = '', i;
    s += sky(c, [[0, '#03051a'], [0.34, '#0b1340'], [0.62, '#26245c'], [0.82, '#6c3764'], [1, '#c86a50']]);
    s += stars(c, 170, 470);
    s += glow(c, 1236, 178, 340, '#a8b4ff', 0.2) + moon(c, 1236, 178, 62);
    s += CI(1236, 178, 120, 'none', 'stroke="#cfd6ff" stroke-width="1.2" ' + OP(0.2)) + CI(1236, 178, 176, 'none', 'stroke="#cfd6ff" stroke-width=".8" ' + OP(0.1));
    s += streaks(c, 250, '#9aa0e0', 0.2, 6) + cloud(c, 1120, 250, 1.3, '#7a7ac0', 0.34) + cloud(c, 380, 190, 1.0, '#6a6ab0', 0.28) + cloud(c, 760, 120, 1.4, '#5a5aa0', 0.18);
    s += xiangyun(380, 330, 1.6, '#d8b868', 1.6) + xiangyun(620, 250, 1.2, '#d8b868', 1.3) + xiangyun(1330, 380, 1.4, '#d8b868', 1.4);
    s += glowE(c, 800, 690, 900, 170, '#ff8c52', 0.32);
    s += ridge(c, 650, 130, '#141b4a', '#2a2a68', { step: 170 });
    s += hall(c, { cx: 1470, gy: 640, w: 120, tier: 1, far: true, glaze: '#6a6a8a', night: true, farWall: '#2a2a50', farBase: '#4a4a70' });
    s += mist(c, 636, 40, '#a07ab8', 0.25);
    var far = [[60, 300, 1], [330, 360, 2], [630, 250, 1], [1520, 340, 2], [1300, 250, 1]], gl = '#a89658';
    for (i = 0; i < far.length; i++) s += hall(c, { cx: far[i][0], gy: 706, w: far[i][1], tier: far[i][2], far: true, glaze: gl, night: true, farWall: '#3a1e3a', farBase: '#8a86a0', snow: se === 3 && far[i][1] >= 340 });
    s += mist(c, 692, 36, '#6a5a9a', 0.3);
    s += glowE(c, 960, 520, 380, 250, '#ffb060', 0.2);
    s += hall(c, { cx: 970, gy: 742, w: 640, tier: 2, glaze: '#b8a25c', night: true, lit: 1, snow: se === 3, red: '#8a2a2a' });
    s += hall(c, { cx: 222, gy: 742, w: 300, tier: 2, glaze: '#b8a25c', night: true, lit: 0.95, snow: se === 3, red: '#8a2a2a', rh: 0.22, det: 1 });
    s += hall(c, { cx: 352, gy: 746, w: 190, tier: 1, glaze: '#b8a25c', night: true, lit: 0.95, snow: se === 3, red: '#8a2a2a', det: 1 });
    /* foreground wall with a gate, lantern-lit */
    s += wall(c, -10, 1610, 750, 160, { red: '#7e2428', glaze: '#a8822c', snow: se === 3 });
    var gx = 560, gw = 150;
    s += PA('M' + (gx - gw / 2) + ' 900V830Q' + (gx - gw / 2) + ' 786 ' + gx + ' 786Q' + (gx + gw / 2) + ' 786 ' + (gx + gw / 2) + ' 830V900Z', '#160a0c') + PA('M' + (gx - gw / 2 + 8) + ' 900V832Q' + (gx - gw / 2 + 8) + ' 796 ' + gx + ' 796Q' + (gx + gw / 2 - 8) + ' 796 ' + (gx + gw / 2 - 8) + ' 832V900Z', LG(c, [[0, '#8a1e1c'], [1, '#4a0c0c']])) + PA('M' + (gx - gw / 2 + 8) + ' 900V832Q' + (gx - gw / 2 + 8) + ' 796 ' + gx + ' 796Q' + (gx + gw / 2 - 8) + ' 796 ' + (gx + gw / 2 - 8) + ' 832V900Z', studPat(c, 0.5), OP(0.7));
    s += glowE(c, 300, 800, 300, 80, '#ff9a4a', 0.28) + glowE(c, 1300, 800, 300, 80, '#ff9a4a', 0.28) + glowE(c, gx, 790, 160, 60, '#ffb060', 0.25);
    for (i = 0; i < 7; i++) if (i !== 3) s += lantern(c, 90 + i * 230, 790, 0.55, { night: true, glow: 0.9 });
    s += RC(0, 760, W, 140, LG(c, [[0, '#000', 0], [1, '#05030a', 0.55]]));
    var lx = [1540, 1430, 1330, 90, 190];
    for (i = 0; i < lx.length; i++) s += lantern(c, lx[i], (i % 3) * 22, 0.95 + (i % 2) * 0.15, { night: true, cord: 0, drop: 30 + (i % 3) * 30 });
    s += branchCorner(c, -30, 120, 330, 1.72, { seed: 21, k: 1.25 });
    s += mist(c, 560, 50, '#5a4a90', 0.14);
    s += seasonAir(c, { night: true, n: 40 });
    s += endcap(c, { v: 0.55, f: 0.1 });
    return s;
  };

  /* ---------- shared garden (day / night) ---------- */
  function gardenScene(c, night) {
    var se = c.se, s = '', i, r = c.r;
    var sk = night ? [[0, '#060a24'], [0.5, '#16225a'], [1, '#34356e']] : seasonSky(se);
    s += sky(c, sk);
    if (night) { s += stars(c, 90, 340); s += moon(c, 1240, 170, 54); s += streaks(c, 240, '#8a90d8', 0.16, 4); }
    else { s += glow(c, 300, 90, 460, '#fff4d0', 0.55) + cloud(c, 1000, 150, 1.3, '#fff', 0.5) + cloud(c, 420, 230, 0.9, '#fff', 0.4) + cloud(c, 1350, 300, 0.8, '#fff', 0.35); }
    var hl = night ? ['#1a2252', '#2c3270'] : seasonHill(se);
    s += ridge(c, 470, 110, hl[0], hl[1], { step: 150 }) + mist(c, 470, 30, night ? '#4a4a98' : '#fff', night ? 0.2 : 0.4);
    /* distant halls peeking over the wall */
    var g1 = night ? '#8d8458' : (se === 3 ? '#e0a82c' : '#e2ac2c');
    s += hall(c, { cx: 300, gy: 452, w: 400, tier: 1, far: true, glaze: g1, night: night, snow: se === 3, farWall: night ? '#3a1e3a' : '#8a2a22' });
    s += hall(c, { cx: 1330, gy: 452, w: 480, tier: 2, far: true, glaze: g1, night: night, snow: se === 3, farWall: night ? '#3a1e3a' : '#8a2a22' });
    s += mist(c, 440, 26, night ? '#4a4a98' : '#fff', night ? 0.16 : 0.35);
    /* garden wall with moon gate */
    var wy = 410, wh = 250, redw = night ? '#4a2038' : '#a43428';
    s += wall(c, -10, 1610, wy, wh, { red: redw, glaze: night ? '#6a5a40' : '#d4a22c', snow: se === 3, det: night ? 0 : 1 });
    var gx = 800, gy = 536, gr = 124;
    /* view through the moon gate */
    var cid = c.def('mg', function (id) { return '<clipPath id="' + id + '"><circle cx="' + gx + '" cy="' + gy + '" r="' + gr + '"/></clipPath>'; });
    s += '<g clip-path="url(#' + cid + ')">' + sky(c, night ? [[0, '#1a2458'], [1, '#4a4a88']] : [[0, '#cfe8f2'], [1, '#f6f2dc']], gy - gr, gy + gr);
    s += ridge(c, 560, 70, night ? '#26306a' : '#9cbfa8', night ? '#3c3e80' : '#d4e6d6', { step: 90 });
    s += crown(c, 730, 560, 120, 70, night ? ['#1c2a4c', '#26385c', '#344a6c'] : (se === 3 ? ['#9aa8bc', '#c0ccde', '#eef2fa'] : (se === 0 ? ['#d88aa8', '#f0b4c8', '#fff0f4'] : se === 2 ? ['#b8501c', '#e0802a', '#f4c050'] : ['#2f7a44', '#4aa056', '#8ccc70'])), 7, { r: rngf(3) });
    s += hall(c, { cx: 880, gy: 574, w: 150, tier: 1, far: true, glaze: g1, night: night, snow: se === 3, farWall: night ? '#3a1e3a' : '#a43428' });
    s += RC(gx - gr, gy + 70, gr * 2, 90, night ? '#1e2650' : seasonGround(se)[0]);
    s += mist(c, gy + 20, 30, night ? '#8a8ad0' : '#fff', 0.35);
    s += '</g>';
    s += CI(gx, gy, gr + 2, 'none', 'stroke="' + (night ? '#586088' : '#c8c2b0') + '" stroke-width="16"') + CI(gx, gy, gr + 11, 'none', 'stroke="#000" stroke-width="2" ' + OP(0.35)) + CI(gx, gy, gr - 6, 'none', 'stroke="#000" stroke-width="10" ' + OP(0.18));
    /* ground */
    var gg = night ? ['#1a2450', '#0e1432'] : seasonGround(se);
    s += RC(0, 650, W, 250, LG(c, [[0, gg[0]], [1, gg[1]]]));
    s += PA('M720 650L880 650L1180 900L420 900Z', LG(c, [[0, night ? '#4a4c78' : '#cfc8b4'], [1, night ? '#2a2c50' : '#a89f88']]), OP(0.85));
    s += cobbles(c, 520, 1080, 668, 890, night ? '#3a3c64' : '#b8b09a', 26);
    /* left rockery with pine */
    s += GR(pine(c, 120, 720, 560, { dark: night ? '#0e2430' : '#1c4a34', mid: night ? '#173a44' : '#2d6a46', hi: night ? '#2a5a5a' : '#5a9a62' }), RO(c, 5, '.04'));
    s += rock(c, 300, 722, 250, 330, { col: night ? '#4a4f70' : '#8a8d9e', r: rngf(5) });
    s += rock(c, 450, 730, 180, 210, { col: night ? '#434868' : '#9a9eac', r: rngf(9), holes: 1 });
    s += rock(c, 100, 735, 150, 170, { col: night ? '#434868' : '#868a9a', r: rngf(12), holes: 1 });
    s += peony(c, 560, 760, 1.15, { r: rngf(4) });
    /* right blossom tree + bamboo */
    s += bamboo(c, 1500, 730, 330, 5, { r: rngf(8) });
    s += GR(tree(c, 1290, 730, 440, se === 0 || se === 3 ? 'blossom' : 'maple', { r: rngf(6), dim: night ? 0.55 : 0 }), RO(c, 6, '.03'));
    s += peony(c, 1090, 770, 1.0, { r: rngf(14), fc: night ? ['#b04a70', '#d88aa8', '#f4d8e4'] : null });
    s += rock(c, 1130, 745, 130, 140, { col: night ? '#434868' : '#8f93a2', r: rngf(15), holes: 1 });
    s += tufts(c, 700, 880, 36, {});
    if (night) {
      s += RC(0, 0, W, H, '#0a1030', OP(0.24));
      s += glowE(c, 800, 780, 700, 140, '#ffb060', 0.14);
      var lp = [[610, 410, 1.15], [990, 410, 1.15]];
      for (i = 0; i < lp.length; i++) s += lantern(c, lp[i][0], lp[i][1], lp[i][2], { night: true, drop: 6 }) + glowE(c, lp[i][0], lp[i][1] + 200, 150, 40, '#ffb04a', 0.16);
      s += mist(c, 640, 40, '#7a7ac8', 0.2);
    } else {
      s += (se !== 3 ? birds(c, 5, 500, 1100, 90, 260) : '') + shaft(c, 180, 330, 0, 520, 760, 700, '#fff6cf', 0.34) + shaft(c, 420, 520, 0, 980, 1100, 700, '#fff6cf', 0.22);
      s += mist(c, 640, 34, '#fff', 0.25);
    }
    s += seasonAir(c, { night: night, n: 40 });
    s += endcap(c, { v: night ? 0.55 : 0.34, f: night ? 0.3 : 0.26 });
    return s;
  }
  SCENES.garden = function (c) { return gardenScene(c, false); };
  SCENES.garden_night = function (c) { return gardenScene(c, true); };

  /* ---------- snow court at blue hour ---------- */
  SCENES.snow_court = function (c0) {
    var c = Object.create(c0); c.se = 3; var s = '', i, se = c0.se;
    s += sky(c, [[0, '#6a7aa8'], [0.45, '#aab4d2'], [0.8, '#e4d4d8'], [1, '#f2e2d6']]);
    s += cloud(c, 400, 140, 1.5, '#d8dcee', 0.55) + cloud(c, 1200, 110, 1.4, '#c8cce4', 0.5) + streaks(c, 260, '#f4e6e8', 0.3, 5);
    s += ridge(c, 470, 80, '#9aa6c6', '#d0d6e8', { step: 140 });
    s += hall(c, { cx: 800, gy: 560, w: 720, tier: 2, glaze: '#d8a634', night: true, lit: 0.85, snow: true, red: '#8e2a2a' });
    s += hall(c, { cx: 190, gy: 548, w: 360, tier: 1, glaze: '#d8a634', far: true, snow: true, farWall: '#7e2a2a' });
    s += hall(c, { cx: 1420, gy: 548, w: 380, tier: 1, glaze: '#d8a634', far: true, snow: true, farWall: '#7e2a2a' });
    s += mist(c, 560, 36, '#e8eaf6', 0.45);
    s += wall(c, -10, 1610, 560, 70, { red: '#92302a', glaze: '#c89a30', snow: true });
    /* courtyard snow */
    s += RC(0, 622, W, 278, LG(c, [[0, '#dde4f2'], [0.5, '#eef2fb'], [1, '#c4cfe6']]));
    s += PA('M700 622L900 622L1260 900L340 900Z', LG(c, [[0, '#cdd6ea'], [1, '#b8c4de']]), OP(0.75));
    for (i = 0; i < 6; i++) s += LN(790 + i * 4, 624, 520 + i * 140, 900, '#9fb0d0', 1, OP(0.25));
    s += tufts(c, 640, 880, 30, {});
    /* hanging lanterns on the hall */
    s += glowE(c, 800, 600, 420, 70, '#ffb060', 0.3);
    for (i = 0; i < 3; i++) s += lantern(c, 560 + i * 240, 420, 1.0, { night: true, drop: 8 });
    /* plum tree (left, foreground) and bronze vessel (right) */
    s += tree(c, 230, 800, 560, 'plum', { r: rngf(31), depth: 5 });
    s += censer(c, 1330, 760, 2.0, { col: '#6a5a3a' }) + EL(1330, 690, 78, 12, '#f6f9ff', OP(0.95));
    s += rock(c, 1470, 800, 160, 180, { col: '#8a90a8', r: rngf(7), holes: 1 });
    s += fall(c, 'snow', 120, { y1: 880 }) + (se === 0 ? fall(c0, 'petal', 14, { y1: 700 }) : '');
    s += endcap(c0, { v: 0.38, f: 0.22 });
    return s;
  };

  /* ---------- compact re-implementations (patterns, bays, lanterns, falling things) ---------- */
  function qs(sc) { return Math.round(Math.pow(2, Math.round(Math.log(Math.max(sc, 0.12)) / Math.LN2 * 2) / 2) * 100) / 100; }
  function PT(c, name, sc, w, h, inner) { /* pattern in user space, scale quantised (steps of sqrt2) so scenes share few patterns */
    sc = qs(sc);
    return 'url(#' + c.def('P' + name + sc, function (id) { return '<pattern id="' + id + '" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse" patternTransform="scale(' + sc + ')">' + inner + '</pattern>'; }) + ')';
  }
  /* one storey of wall + columns + painted beam + bracket band. yb = bottom of wall */
  function bay(c, cx, yb, bw, hw, o) {
    o = o || {}; var s = '', n = o.cols || Math.max(4, 2 * Math.round(bw / 150) + 2), cwid = Math.max(3, bw * 0.021), x0 = cx - bw / 2, step = (bw - cwid) / (n - 1), i, det = o.det == null ? 2 : o.det;
    var hb = Math.max(4, bw * 0.040), hd = hb, red = o.red || RED, night = o.night, wt = yb - hw, lit = o.lit != null ? o.lit : (night ? 0.9 : 0.25);
    s += RC(x0, wt, bw, hw, LG(c, [[0, dk(red, 0.5)], [1, dk(red, 0.62)]]));
    if (det >= 1) {
      s += RC(x0 + cwid, wt + hw * 0.08, bw - 2 * cwid, hw * 0.74, LG(c, [[0, o.glass || (night ? '#ffc766' : '#caa56a'), lit], [0.5, o.glass2 || (night ? '#ff9a3c' : '#9a6a3a'), lit * 0.9], [1, o.glass || (night ? '#ffc766' : '#caa56a'), lit]], [0, 0, 1, 0]));
      if (det >= 2) s += RC(x0 + cwid, wt + hw * 0.08, bw - 2 * cwid, hw * 0.74, o.ice ? iceCrack(c, clamp(bw / 1500, 0.15, 0.5), '#4a120d') : latPat(c, clamp(bw / 1300, 0.15, 0.55), '#4a120d'));
      s += RC(x0, wt + hw * 0.84, bw, hw * 0.16, dk(red, 0.55)) + RC(x0, wt + hw * 0.05, bw, hw * 0.04, dk(red, 0.55));
      if (o.door) {
        var mid = Math.floor((n - 1) / 2), px = x0 + cwid + step * mid, pw = step - cwid;
        s += RC(px, wt + hw * 0.04, pw, hw * 0.96, LG(c, [[0, dk(red, 0.25)], [1, dk(red, 0.45)]]));
        if (det >= 2) s += RC(px + pw * 0.05, wt + hw * 0.2, pw * 0.9, hw * 0.8, studPat(c, clamp(bw / 900, 0.25, 0.7)), OP(0.9));
      }
      var cg = colGrad(c, red), bd = '', cd = '';
      for (i = 0; i < n; i++) {
        var cxx = x0 + step * i; s += RC(cxx, wt, cwid, hw, cg);
        if (det >= 2) { bd += 'M' + f1(cxx - cwid * 0.15) + ' ' + f1(yb - cwid * 0.5) + 'h' + f1(cwid * 1.3) + 'v' + f1(cwid * 0.5) + 'h' + f1(-cwid * 1.3) + 'z'; cd += 'M' + f1(cxx - cwid * 0.12) + ' ' + f1(wt) + 'h' + f1(cwid * 1.24) + 'v' + f1(cwid * 0.28) + 'h' + f1(-cwid * 1.24) + 'z'; }
      }
      if (det >= 2) s += PA(bd, '#2a1612') + PA(cd, GOLDD, OP(0.8));
    }
    var by0 = wt - hb;
    s += RC(x0 - bw * 0.01, by0, bw * 1.02, hb, LG(c, [[0, '#2a8a86'], [1, '#17536e']]));
    if (det >= 2) s += RC(x0 - bw * 0.01, by0, bw * 1.02, hb, PT(c, 'cai', hb / 12, 36, 12, '<path d="M0 6L9 1 18 6 9 11Z" fill="#f2cf74" opacity=".85"/><path d="M18 6L27 1 36 6 27 11Z" fill="#e8f4ee" opacity=".55"/><circle cx="9" cy="6" r="1.6" fill="#b3261e"/><circle cx="27" cy="6" r="1.6" fill="#1f6a8a"/><rect width="36" height="1.2" fill="#f2cf74" opacity=".7"/><rect y="10.8" width="36" height="1.2" fill="#f2cf74" opacity=".7"/>'));
    var dy0 = by0 - hd;
    s += RC(x0 - bw * 0.012, dy0, bw * 1.024, hd, LG(c, [[0, '#14405e'], [1, '#0e2c46']]));
    if (det >= 2) s += RC(x0 - bw * 0.012, dy0, bw * 1.024, hd, PT(c, 'dou', hd / 10, 16, 10, '<rect x="1" width="14" height="3" fill="#2d8f8a"/><rect x="4" y="3" width="8" height="3" fill="#e0b24a"/><rect x="6" y="6" width="4" height="4" fill="#b3261e"/><rect y="9" width="16" height="1" fill="#f2cf74" opacity=".6"/>'));
    return { svg: s, top: dy0, wallTop: wt };
  }
  /* red palace wall with yellow cap; y = top of wall, h = height */
  function wall(c, x0, x1, y, h, o) {
    o = o || {}; var s = '', red = o.red || '#9e2a22', cap = o.glaze || '#d9a62e', w = x1 - x0;
    s += RC(x0, y, w, h, LG(c, [[0, lt(red, 0.08)], [1, dk(red, 0.45)]]));
    if (o.det !== 0) s += RC(x0, y, w, h, PT(c, 'brk', 0.9, 40, 16, '<path d="M0 .6H40M0 8.6H40M0 8V16M20 0V8" stroke="#000" stroke-width=".8" fill="none" opacity=".12"/>'));
    s += RC(x0, y + h * 0.88, w, h * 0.12, '#2a1410', OP(0.3));
    var ch = Math.max(8, h * 0.14);
    s += RC(x0, y - ch, w, ch, LG(c, [[0, lt(cap, 0.3)], [1, dk(cap, 0.3)]]));
    s += RC(x0, y - ch - ch * 0.25, w, ch * 0.3, lt(cap, 0.2));
    s += RC(x0, y - ch * 0.04, w, Math.max(2, ch * 0.2), '#000', OP(0.35));
    if (o.det !== 0) s += LN(x0, y - ch * 0.55, x1, y - ch * 0.55, dk(cap, 0.4), 1.2, OP(0.6) + ' stroke-dasharray="3 5"');
    if (o.snow) s += RC(x0, y - ch - ch * 0.5, w, ch * 0.55, '#f4f7fc') + RC(x0, y - ch * 0.5, w, ch * 0.4, '#e4eaf6', OP(0.8));
    return s;
  }
  /* palace lantern 宫灯: body is a shared <g> in defs, placed with <use>. (x,y) = top of the lantern (after optional drop) */
  function lantern(c, x, y, s, o) {
    o = o || {}; var col = o.col || '#d4281c', night = o.night, gl = o.glow == null ? (night ? 1 : 0.4) : o.glow, drop = o.drop || 0, out = '';
    var id = c.def('LT' + col, function (id) {
      var g = RC(-3.5, 0, 7, 8, GOLD) + PA('M-10 8L10 8 15 16-15 16Z', GOLD);
      g += PA('M-15 16Q-25 47-14 78L14 78Q25 47 15 16Z', RG(c, [[0, lt(col, 0.55)], [0.55, col], [1, dk(col, 0.35)]], [0.5, 0.5, 0.6]));
      g += ST('M-5 16Q-14 47-5 78M5 16Q14 47 5 78', GOLD, 1.2, OP(0.8)) + PA('M-14 78L14 78 9 85-9 85Z', GOLD);
      g += LN(0, 85, 0, 104, '#c9302c', 2.2) + PA('M-4 100L4 100 6 118-6 118Z', '#c9302c');
      return '<g id="' + id + '">' + g + '</g>';
    });
    if (o.cord != null) out += LN(x, o.cord, x, y + drop, '#3a2418', Math.max(1, 1.4 * s));
    if (gl > 0) out += glow(c, x, y + drop + 47 * s, 110 * s, o.gcol || '#ffb04a', 0.5 * gl);
    out += '<use href="#' + id + '" transform="translate(' + f1(x) + ' ' + f1(y + drop) + ') scale(' + f1(s) + ')"/>';
    return out;
  }
  /* falling things, batched into few <path>s per class */
  function fall(c, kind, n, o) {
    o = o || {}; var r = c.r2, i, y0 = o.y0 == null ? 0 : o.y0, y1 = o.y1 == null ? 760 : o.y1, x0 = o.x0 || 0, x1 = o.x1 || W, B = {}, s = '', k;
    function add(key, d) { B[key] = (B[key] || '') + d; }
    var T = {}; function shape(name, a, sz) { var key = name + a + sz; if (T[key]) return T[key]; var ca = Math.cos(a * 1.5708), sa = Math.sin(a * 1.5708), pts = name === 'p' ? [[-6, 0], [0, -6.4], [6, 0], [0, 6.4]] : [[0, -8], [6, -1], [0, 8], [-6, -1]], q = pts.map(function (p) { return [(p[0] * ca - p[1] * sa) * sz, (p[0] * sa + p[1] * ca) * sz]; }); return (T[key] = 'q' + f1(q[1][0] - q[0][0]) + ' ' + f1(q[1][1] - q[0][1]) + ' ' + f1(q[2][0] - q[0][0]) + ' ' + f1(q[2][1] - q[0][1]) + 'q' + f1(q[3][0] - q[2][0]) + ' ' + f1(q[3][1] - q[2][1]) + ' ' + f1(q[0][0] - q[2][0]) + ' ' + f1(q[0][1] - q[2][1]) + 'z'); }
    function sp(name, a, sz) { var ca = Math.cos(a * 1.5708), sa = Math.sin(a * 1.5708), p = name === 'p' ? [-6, 0] : [0, -8]; return [(p[0] * ca - p[1] * sa) * sz, (p[0] * sa + p[1] * ca) * sz]; }
    var pc = o.cols || (kind === 'petal' ? ['#ffd6e0', '#ffeef2', '#f7a8c0', '#ffffff'] : ['#c8401f', '#e07a22', '#d9a02a', '#a8301c', '#e8b83a']);
    for (i = 0; i < n; i++) {
      var x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), kk = r(), ai = Math.floor(r() * 4), sz = 0.8 + Math.floor(r() * 3) * 0.3;
      if (kind === 'petal' || kind === 'leaf') {
        var nm = kind === 'petal' ? 'p' : 'l', st0 = sp(nm, ai, sz), ci = Math.floor(kk * pc.length);
        add(pc[ci] + (sz > 1.1 ? 'a' : 'b'), 'M' + f1(x + st0[0]) + ' ' + f1(y + st0[1]) + shape(nm, ai, sz));
      } else if (kind === 'snow') {
        var cls = kk > 0.86 ? 'L' : kk > 0.45 ? 'M' : 'S'; add(cls, 'M' + f1(x) + ' ' + f1(y) + 'h.1');
      } else if (kind === 'rain') {
        var len = 26 + r() * 40, dx = len * 0.16, tk = kk > 0.7 ? 'a' : 'b'; add(tk, 'M' + f1(x) + ' ' + f1(y) + 'l' + f1(-dx) + ' ' + f1(len));
      } else if (kind === 'firefly') {
        s += glow(c, x, y, 7 + r() * 8, '#d8ff7a', 0.8) + CI(x, y, 1.4, '#f6ffc8');
      } else if (kind === 'ember' || kind === 'dust') {
        add(kk > 0.5 ? 'a' : 'b', 'M' + f1(x) + ' ' + f1(y) + 'h.1');
      }
    }
    for (k in B) {
      if (kind === 'petal' || kind === 'leaf') s += PA(B[k], k.slice(0, 7), OP(k.slice(7) === 'a' ? 0.95 : 0.75));
      else if (kind === 'snow') s += ST(B[k], '#fff', k === 'L' ? 6 : k === 'M' ? 3.2 : 2, 'stroke-linecap="round" ' + OP(k === 'L' ? 0.4 : k === 'M' ? 0.75 : 0.9) + (k === 'L' ? ' ' + BL(c, 1.8) : ''));
      else if (kind === 'rain') s += ST(B[k], o.col || '#c9d6e4', k === 'a' ? 1.6 : 1, OP(k === 'a' ? 0.4 : 0.22));
      else if (kind === 'ember') s += ST(B[k], '#ffb347', k === 'a' ? 3 : 2, 'stroke-linecap="round" ' + OP(0.85));
      else if (kind === 'dust') s += ST(B[k], o.col || '#ffe6a8', k === 'a' ? 3.4 : 2, 'stroke-linecap="round" ' + OP(k === 'a' ? 0.5 : 0.3));
    }
    return s;
  }

  /* ---------- covered corridor (day / rain) ---------- */
  function corridorScene(c, rain) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 372, sb: 0.3, Xw: 700, Yf: 528, Yc: -330 }), Xp = 700, ds = [];
    for (i = 0; i < 8; i++) ds.push(0.03 + i * 0.125);
    /* exterior */
    var sk = rain ? [[0, '#5e6c7a'], [0.5, '#8d9ba6'], [1, '#b6c0c4']] : seasonSky(se);
    s += sky(c, sk, 0, 600);
    var hl = rain ? ['#7a8a92', '#a4b0b4'] : seasonHill(se), gg = rain ? ['#6a8068', '#4a6050'] : seasonGround(se);
    s += ridge(c, 400, 90, hl[0], hl[1], { step: 120 }) + mist(c, 396, 30, '#fff', rain ? 0.35 : 0.4);
    s += RC(0, 392, W, 508, LG(c, [[0, gg[0]], [1, gg[1]]]));
    s += hall(c, { cx: 1330, gy: 430, w: 330, tier: 2, far: true, glaze: rain ? '#a48a44' : '#e0aa2a', snow: se === 3 && !rain, farWall: rain ? '#6a2a28' : '#9a2e26' });
    s += hall(c, { cx: 250, gy: 420, w: 260, tier: 1, far: true, glaze: rain ? '#a48a44' : '#e0aa2a', snow: se === 3 && !rain, farWall: rain ? '#6a2a28' : '#9a2e26' });
    s += mist(c, 420, 26, '#fff', rain ? 0.4 : 0.3);
    var tcol = rain ? ['#3a6a4a', '#58885a', '#8cb090'] : null;
    s += GR(tree(c, 360, 560, 340, se === 0 ? 'blossom' : 'maple', { r: rngf(3), n: 9 }), RO(c, 5, '.04')) + GR(pine(c, 1180, 560, 330), RO(c, 4, '.04'));
    s += rock(c, 470, 600, 150, 190, { col: rain ? '#6a7080' : '#8a8d9e', r: rngf(8), holes: 1 }) + rock(c, 1090, 610, 130, 150, { col: rain ? '#6a7080' : '#8a8d9e', r: rngf(18), holes: 1 });
    s += tufts(c, 540, 700, 22, { x0: 100, x1: 600 }) + tufts(c, 540, 700, 22, { x0: 1000, x1: 1500 });
    /* far end: door to a bright court */
    var br = R.backRect(), vcid = CPR(c, br.x, br.y, br.w, br.h), vh = rain ? ['#8a9aa2', '#b4c0c2'] : seasonHill(se);
    s += '<g clip-path="url(#' + vcid + ')">' + sky(c, rain ? [[0, '#9aa8b0'], [1, '#d0d8da']] : seasonSky(se), br.y, br.y + br.h) + glowE(c, 800, 400, 240, 120, rain ? '#e8eef0' : '#fffbe8', 0.8);
    s += ridge(c, 462, 46, vh[0], vh[1], { step: 70, bottom: br.y + br.h }) + RC(br.x, 466, br.w, 80, LG(c, [[0, gg[0]], [1, gg[1]]]));
    s += hall(c, { cx: 800, gy: 474, w: 170, tier: 2, far: true, glaze: rain ? '#a48a44' : '#e2ac2c', farWall: rain ? '#6a2a28' : '#9a2e26', snow: se === 3 && !rain });
    s += crown(c, 650, 470, 60, 40, se === 3 ? ['#9aa8bc', '#c0ccde', '#eef2fa'] : se === 2 ? ['#b8501c', '#e0802a', '#f4c050'] : se === 0 ? ['#d88aa8', '#f0b4c8', '#fff0f4'] : ['#2f7a44', '#4aa056', '#8ccc70'], 5, { r: rngf(2) }) + crown(c, 950, 472, 56, 36, se === 3 ? ['#9aa8bc', '#c0ccde', '#eef2fa'] : ['#2f7a44', '#4aa056', '#8ccc70'], 5, { r: rngf(3) });
    s += mist(c, 466, 20, '#fff', rain ? 0.5 : 0.4) + '</g>';
    s += RC(br.x - 6, br.y - 6, br.w + 12, 8, '#7a1812') + RC(br.x - 6, br.y - 6, 8, br.h + 6, '#7a1812') + RC(br.x + br.w - 2, br.y - 6, 8, br.h + 6, '#7a1812');
    /* floor */
    s += R.floor(LG(c, [[0, rain ? '#4a5258' : '#6c6a68'], [1, rain ? '#8e989c' : '#bdb49c']]));
    s += R.floorGrid(rain ? '#1e262c' : '#3a3630', 0.4, 12, 7, 0);
    /* sunlight patches (day) or wet sheen (rain) */
    for (i = 0; i < 7; i++) {
      var d0 = ds[i] + 0.035, d1 = ds[i + 1] - 0.01;
      if (!rain) { s += R.quad([[-Xp, R.Yf, d0], [-Xp + 340, R.Yf, d0 + 0.05], [-Xp + 340, R.Yf, d1 + 0.05], [-Xp, R.Yf, d1]], '#fff6d0', OP(0.2) + ' ' + BL(c, 4)) + R.quad([[Xp, R.Yf, d0], [Xp - 340, R.Yf, d0 + 0.05], [Xp - 340, R.Yf, d1 + 0.05], [Xp, R.Yf, d1]], '#fff6d0', OP(0.2) + ' ' + BL(c, 4)); }
    }
    if (rain) {
      s += R.quad([[-300, R.Yf, 0], [300, R.Yf, 0], [180, R.Yf, 1], [-180, R.Yf, 1]], '#c8d4d8', OP(0.16) + ' ' + BL(c, 8));
      for (i = 0; i < 14; i++) { var rd = 0.1 + c.r() * 0.9, rp = R.P((c.r() - 0.5) * 1200, R.Yf, rd); s += EL(rp[0], rp[1], 40 * R.s(rd) * 1.6, 3 * R.s(rd) * 1.6, 'none', 'stroke="#dfe8ec" stroke-width="1" ' + OP(0.35)); }
    }
    /* ceiling + beams */
    s += R.ceil(LG(c, [[0, '#2a140e'], [1, rain ? '#4a3020' : '#6a4630']]));
    for (i = -4; i <= 4; i++) { var a = R.P(i * 150, R.Yc, -0.25), b = R.P(i * 150, R.Yc, 1); s += LN(a[0], a[1], b[0], b[1], '#1a0c08', 2, OP(0.55)); }
    var cai = PT(c, 'cai2', 0.7, 36, 12, '<path d="M0 6L9 1 18 6 9 11Z" fill="#f2cf74" opacity=".5"/><path d="M18 6L27 1 36 6 27 11Z" fill="#e8f4ee" opacity=".3"/><rect width="36" height="1.2" fill="#f2cf74" opacity=".45"/>');
    for (i = 0; i < 8; i++) s += R.beam(ds[i], 44, LG(c, [[0, '#1b6272'], [1, '#0f3e52']]), { pat: cai });
    /* eave beams along both sides + hanging fascia */
    s += R.quad([[-Xp, R.Yc, -0.2], [-Xp, R.Yc + 70, -0.2], [-Xp, R.Yc + 70, 1], [-Xp, R.Yc, 1]], LG(c, [[0, '#17536e'], [1, '#2a8a86']], [0, 0, 1, 0]));
    s += R.quad([[Xp, R.Yc, -0.2], [Xp, R.Yc + 70, -0.2], [Xp, R.Yc + 70, 1], [Xp, R.Yc, 1]], LG(c, [[0, '#2a8a86'], [1, '#17536e']], [0, 0, 1, 0]));
    var fz = '', fy = '';
    for (i = 0; i < 40; i++) { var dd = i / 40, pl = R.P(-Xp, R.Yc + 70, dd), pl2 = R.P(-Xp, R.Yc + 135, dd), pr = R.P(Xp, R.Yc + 70, dd), pr2 = R.P(Xp, R.Yc + 135, dd); fz += 'M' + f1(pl[0]) + ' ' + f1(pl[1]) + 'L' + f1(pl2[0]) + ' ' + f1(pl2[1]); fy += 'M' + f1(pr[0]) + ' ' + f1(pr[1]) + 'L' + f1(pr2[0]) + ' ' + f1(pr2[1]); }
    s += R.quad([[-Xp, R.Yc + 70, -0.2], [-Xp, R.Yc + 135, -0.2], [-Xp, R.Yc + 135, 1], [-Xp, R.Yc + 70, 1]], '#a0281e', OP(0.78)) + R.quad([[Xp, R.Yc + 70, -0.2], [Xp, R.Yc + 135, -0.2], [Xp, R.Yc + 135, 1], [Xp, R.Yc + 70, 1]], '#a0281e', OP(0.78));
    s += ST(fz + fy, '#3a0c08', 3, OP(0.7));
    /* seat rails between pillars */
    for (i = 0; i < 7; i++) {
      var e0 = ds[i] + 0.012, e1 = ds[i + 1] - 0.012;
      s += R.quad([[-Xp, R.Yf - 150, e0], [-Xp, R.Yf - 150, e1], [-Xp, R.Yf - 60, e1], [-Xp, R.Yf - 60, e0]], '#7e1c16') + R.quad([[Xp, R.Yf - 150, e0], [Xp, R.Yf - 150, e1], [Xp, R.Yf - 60, e1], [Xp, R.Yf - 60, e0]], '#7e1c16');
      s += R.quad([[-Xp - 30, R.Yf - 162, e0], [-Xp - 30, R.Yf - 162, e1], [-Xp, R.Yf - 150, e1], [-Xp, R.Yf - 150, e0]], '#c9372a') + R.quad([[Xp + 30, R.Yf - 162, e0], [Xp + 30, R.Yf - 162, e1], [Xp, R.Yf - 150, e1], [Xp, R.Yf - 150, e0]], '#c9372a');
    }
    /* pillars far -> near */
    var pg = colGrad(c, '#b3261e');
    for (i = 7; i >= 0; i--) { s += R.pillar(-Xp, ds[i], 64, pg) + R.pillar(Xp, ds[i], 64, pg); }
    /* lanterns */
    var ld = [0.2, 0.45, 0.7];
    for (i = 0; i < 3; i++) { var lo = R.obj(-Xp * 0.55, R.Yc + 140, ld[i]), ro = R.obj(Xp * 0.55, R.Yc + 140, ld[i]); s += lantern(c, lo.x, lo.y, lo.s * 1.15, { night: rain, cord: 0, glow: rain ? 1.1 : 0.25 }) + lantern(c, ro.x, ro.y, ro.s * 1.15, { night: rain, cord: 0, glow: rain ? 1.1 : 0.25 }); }
    if (rain) {
      for (i = 0; i < 3; i++) { var lq = R.obj(-Xp * 0.55, R.Yf, ld[i]), rq = R.obj(Xp * 0.55, R.Yf, ld[i]); s += glowE(c, lq[0] || lq.x, lq.y, 60 * lq.s * 1.6, 14 * lq.s * 1.6, '#ffb04a', 0.3) + glowE(c, rq.x, rq.y, 60 * rq.s * 1.6, 14 * rq.s * 1.6, '#ffb04a', 0.3); }
      s += fall(c, 'rain', 150, { y1: 840, col: '#cdd9e4' });
      /* eave drip curtains */
      var dr = '', dp = R.P(-Xp, R.Yc + 135, 0.04), dq = R.P(Xp, R.Yc + 135, 0.04);
      for (i = 0; i < 26; i++) { var xx = (i < 13 ? 20 + i * 15 : 1360 + (i - 13) * 18); dr += 'M' + xx + ' ' + (40 + (i % 5) * 30) + 'v' + (260 + (i % 3) * 100); }
      s += ST(dr, '#dfe8f0', 1.2, OP(0.28));
      s += RC(0, 0, W, H, '#3a4a5a', OP(0.18)) + mist(c, 470, 90, '#cdd8de', 0.2);
    } else {
      s += tintWash(c, 0.8) + shaft(c, 120, 280, 80, 520, 760, 800, '#fff4c8', 0.2);
      s += fall(c, 'dust', 40, { y1: 700, col: '#fff0b0' }) + (se !== 1 ? seasonAir(c, { n: 26, y1: 700 }) : '');
    }
    s += endcap(c, { v: rain ? 0.55 : 0.4, f: 0.25 });
    return s;
  }
  SCENES.corridor = function (c) { return corridorScene(c, false); };
  SCENES.corridor_rain = function (c) { return corridorScene(c, true); };

  /* ---------- helpers for perspective halls ---------- */
  /* side-wall windows (lattice, lit) between depths; side=-1 left, +1 right */
  function wallWindows(c, R, side, ds, y0, y1, o) {
    o = o || {}; var s = '', i, X = side * R.Xw, fr = o.fr || '#3a0e0a', lit = o.lit == null ? 0.9 : o.lit, lines = '';
    for (i = 0; i < ds.length - 1; i++) {
      var a = ds[i] + (ds[i + 1] - ds[i]) * 0.12, b = ds[i + 1] - (ds[i + 1] - ds[i]) * 0.12;
      s += R.quad([[X, y0 - 14, a], [X, y1 + 14, a], [X, y1 + 14, b], [X, y0 - 14, b]], fr);
      s += R.quad([[X, y0, a], [X, y1, a], [X, y1, b], [X, y0, b]], LG(c, [[0, o.c1 || '#fff0c0', lit], [1, o.c2 || '#e8b860', lit * 0.85]]));
      for (var k = 1; k < 4; k++) { var dm = a + (b - a) * k / 4, p1 = R.P(X, y0, dm), p2 = R.P(X, y1, dm); lines += 'M' + f1(p1[0]) + ' ' + f1(p1[1]) + 'L' + f1(p2[0]) + ' ' + f1(p2[1]); }
      for (k = 1; k < 5; k++) { var yy = y0 + (y1 - y0) * k / 5, q1 = R.P(X, yy, a), q2 = R.P(X, yy, b); lines += 'M' + f1(q1[0]) + ' ' + f1(q1[1]) + 'L' + f1(q2[0]) + ' ' + f1(q2[1]); }
    }
    return s + ST(lines, fr, 1.6, OP(0.8));
  }
  /* sun patches on the floor under side windows */
  function floorLight(c, R, side, ds, col, op, reach) {
    var s = '', X = side * R.Xw, i;
    for (i = 0; i < ds.length - 1; i++) { var a = ds[i] + 0.02, b = ds[i + 1] - 0.02; s += R.quad([[X, R.Yf, a], [X - side * (reach || 380), R.Yf, a + 0.07], [X - side * (reach || 380), R.Yf, b + 0.07], [X, R.Yf, b]], col, OP(op) + ' ' + BL(c, 5)); }
    return s;
  }
  /* ceiling coffers: grid lines + gold rosettes */
  function coffers(c, R, ds, o) {
    o = o || {}; var s = '', i, j, ln = '', cols = o.cols || [-560, -280, 0, 280, 560], gold = o.gold || '#e8c060';
    s += R.ceil(LG(c, [[0, o.c0 || '#3a1410'], [1, o.c1 || '#6a2a18']]));
    for (j = 0; j < cols.length; j++) { var a = R.P(cols[j], R.Yc, -0.25), b = R.P(cols[j], R.Yc, 1); ln += 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]); }
    s += ST(ln, '#14705e', 3, OP(0.6));
    for (i = 0; i < ds.length; i++) s += R.beam(ds[i], o.bt || 32, LG(c, [[0, '#18606e'], [1, '#0e3a4c']]), { pat: PT(c, 'cai3', 0.5, 36, 12, '<path d="M0 6L9 1 18 6 9 11Z" fill="#f2cf74" opacity=".8"/><path d="M18 6L27 1 36 6 27 11Z" fill="#e8f4ee" opacity=".5"/><rect width="36" height="1.2" fill="#f2cf74" opacity=".7"/>') });
    for (i = 0; i < ds.length - 1; i++) {
      var dm = (ds[i] + ds[i + 1]) / 2, rs = '';
      for (j = 0; j < cols.length - 1; j++) { var p = R.P((cols[j] + cols[j + 1]) / 2, R.Yc, dm); rs += 'M' + f1(p[0]) + ' ' + f1(p[1] + 4) + 'h.1'; }
      s += ST(rs, gold, f1(34 * R.s(dm)), 'stroke-linecap="round" ' + OP(0.75)) + ST(rs, '#b3261e', f1(18 * R.s(dm)), 'stroke-linecap="round" ' + OP(0.9));
    }
    return s;
  }

  /* gold-coiled dragon pillar */
  function dragonPillar(c, R, X, d, pw, base) {
    var s = R.pillar(X, d, pw, colGrad(c, base || '#b3261e'), { baseCol: '#e8c060', baseCol2: '#b88a2a', capCol: '#e8c060' }), s_ = R.s(d), top = R.P(X, R.Yc, d), bot = R.P(X, R.Yf, d), w = pw * s_, hgt = bot[1] - top[1], dd, i, n = 6, a = w * 0.34;
    dd = 'M' + f1(top[0] - a) + ' ' + f1(top[1] + hgt * 0.1);
    for (i = 0; i < n; i++) { var y1_ = top[1] + hgt * (0.1 + (i + 1) * 0.125), sg = i % 2 ? -1 : 1; dd += 'C' + f1(top[0] + sg * a * 1.5) + ' ' + f1(y1_ - hgt * 0.1) + ' ' + f1(top[0] + sg * a * 1.5) + ' ' + f1(y1_ - hgt * 0.025) + ' ' + f1(top[0] + sg * a) + ' ' + f1(y1_); }
    s += ST(dd, '#c8962a', f1(w * 0.3), 'stroke-linecap="round" stroke-linejoin="round"') + ST(dd, '#f2d268', f1(w * 0.2), 'stroke-linecap="round"') + ST(dd, '#8a5a14', f1(w * 0.2), 'stroke-linecap="round" stroke-dasharray="1 ' + f1(w * 0.18) + '" ' + OP(0.7)) + ST(dd, '#fff4b8', f1(w * 0.05), 'stroke-linecap="round" ' + OP(0.55));
    s += EL(top[0] - a, top[1] + hgt * 0.08, w * 0.24, w * 0.2, '#f2d268') + CI(top[0] - a - w * 0.06, top[1] + hgt * 0.075, w * 0.045, '#b3261e');
    return s;
  }
  /* phoenix 凤凰, local drawing facing right; (x,y)=body centre, s=scale (1 ≈ 130px tall) */
  function phoenix(c, x, y, s_, o) {
    o = o || {}; var g = o.gold || '#f4d878', gd = o.deep || '#c8902a', rd = o.red || '#d8402a', s = '';
    function P_(px, py) { return f1(x + px * s_) + ' ' + f1(y + py * s_); }
    var tail = [['M' + P_(-24, 18) + 'C' + P_(-80, 44) + ' ' + P_(-150, 20) + ' ' + P_(-210, 70) + 'C' + P_(-240, 96) + ' ' + P_(-250, 60) + ' ' + P_(-236, 40), 9], ['M' + P_(-26, 24) + 'C' + P_(-70, 70) + ' ' + P_(-130, 70) + ' ' + P_(-170, 130) + 'C' + P_(-190, 160) + ' ' + P_(-170, 168) + ' ' + P_(-160, 150), 8], ['M' + P_(-22, 28) + 'C' + P_(-40, 80) + ' ' + P_(-70, 110) + ' ' + P_(-70, 170) + 'C' + P_(-70, 196) + ' ' + P_(-48, 196) + ' ' + P_(-50, 176), 7]];
    for (var i = 0; i < tail.length; i++) s += ST(tail[i][0], gd, f1(tail[i][1] * s_ * 1.4), 'stroke-linecap="round"') + ST(tail[i][0], g, f1(tail[i][1] * s_), 'stroke-linecap="round"') + ST(tail[i][0], rd, f1(tail[i][1] * s_ * 0.3), 'stroke-linecap="round" stroke-dasharray="1 ' + f1(14 * s_) + '"');
    var wing = 'M' + P_(-6, -14) + 'C' + P_(-30, -80) + ' ' + P_(-90, -110) + ' ' + P_(-150, -80) + 'C' + P_(-110, -76) + ' ' + P_(-96, -60) + ' ' + P_(-84, -44) + 'C' + P_(-110, -46) + ' ' + P_(-100, -26) + ' ' + P_(-70, -22) + 'C' + P_(-84, -8) + ' ' + P_(-60, 0) + ' ' + P_(-40, 4) + 'Z';
    s += PA('M' + P_(-34, 12) + 'C' + P_(-30, -30) + ' ' + P_(16, -34) + ' ' + P_(34, -8) + 'C' + P_(46, 18) + ' ' + P_(2, 42) + ' ' + P_(-34, 12) + 'Z', g) + ST('M' + P_(14, -34) + 'C' + P_(40, -50) + ' ' + P_(56, -70) + ' ' + P_(64, -90), g, f1(14 * s_), 'stroke-linecap="round"');
    s += CI(x + 66 * s_, y - 94 * s_, 11 * s_, g) + PA('M' + P_(74, -96) + 'L' + P_(98, -88) + 'L' + P_(74, -84) + 'Z', rd) + CI(x + 68 * s_, y - 96 * s_, 2.4 * s_, '#3a0c08');
    s += ST('M' + P_(60, -104) + 'C' + P_(56, -126) + ' ' + P_(44, -134) + ' ' + P_(30, -128) + 'M' + P_(66, -104) + 'C' + P_(70, -130) + ' ' + P_(86, -136) + ' ' + P_(96, -124), rd, f1(4 * s_), 'stroke-linecap="round"');
    s += PA(wing, gd) + PA(wing, g, 'transform="translate(' + f1(2 * s_) + ' ' + f1(-3 * s_) + ') scale(.97)" ' + OP(0.9)) + ST('M' + P_(-20, -10) + 'C' + P_(-60, -50) + ' ' + P_(-100, -70) + ' ' + P_(-140, -76) + 'M' + P_(-24, -2) + 'C' + P_(-70, -30) + ' ' + P_(-96, -40) + ' ' + P_(-100, -40), rd, f1(2.4 * s_), OP(0.8));
    s += ST('M' + P_(8, 40) + 'L' + P_(8, 70) + 'M' + P_(-6, 38) + 'L' + P_(-10, 66), gd, f1(4 * s_), 'stroke-linecap="round"');
    return s;
  }

  /* round dragon / phoenix medallion */
  function medal(c, x, y, r, col, o) {
    o = o || {}; var s = CI(x, y, r, o.bg || '#9a1e1a') + CI(x, y, r * 0.93, 'none', 'stroke="' + col + '" stroke-width="' + f1(r * 0.07) + '"');
    s += ST('M' + f1(x - r * 0.6) + ' ' + f1(y + r * 0.1) + 'C' + f1(x - r * 0.5) + ' ' + f1(y - r * 0.8) + ' ' + f1(x + r * 0.2) + ' ' + f1(y - r * 0.7) + ' ' + f1(x + r * 0.1) + ' ' + f1(y - r * 0.1) + 'C' + f1(x) + ' ' + f1(y + r * 0.3) + ' ' + f1(x + r * 0.5) + ' ' + f1(y + r * 0.2) + ' ' + f1(x + r * 0.6) + ' ' + f1(y - r * 0.2) + 'M' + f1(x - r * 0.5) + ' ' + f1(y + r * 0.45) + 'Q' + f1(x) + ' ' + f1(y + r * 0.8) + ' ' + f1(x + r * 0.55) + ' ' + f1(y + r * 0.4), col, f1(r * 0.09), 'stroke-linecap="round"');
    s += CI(x + r * 0.1, y - r * 0.12, r * 0.12, col);
    return s;
  }
  /* dais with steps toward the viewer. d0 = depth of the front edge, d1 = back edge. levels given as heights */
  function dais(c, R, d0, d1, xw, levels, cols) {
    var s = '', i, step = (d1 - d0) / (levels.length + 0.5);
    for (i = 0; i < levels.length; i++) {
      var f = d0 + i * step * 0.6, hgt = levels[i], top = R.Yf - hgt, xx = xw * (1 - i * 0.08);
      s += R.quad([[-xx, top, f], [xx, top, f], [xx, R.Yf, f], [-xx, R.Yf, f]], cols[0]);
      s += R.quad([[-xx, top, f], [xx, top, f], [xx, top, d1], [-xx, top, d1]], cols[1]);
      s += R.quad([[-xx, top - 6, f], [xx, top - 6, f], [xx, top, f], [-xx, top, f]], cols[2]);
    }
    return s;
  }

  /* ---------- Taihe hall: throne ---------- */
  SCENES.throne = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 396, sb: 0.36, Xw: 860, Yf: 560, Yc: -470 }), ds = [0.04, 0.22, 0.4, 0.58, 0.76];
    var tint = [['#fff2d0', 0.9], ['#fff6dc', 1], ['#ffe2a0', 0.95], ['#dce6ff', 0.8]][se];
    s += R.back(LG(c, [[0, '#2a1208'], [1, '#4a2410']]));
    s += R.wallL(LG(c, [[0, '#6a1c18'], [1, '#3a100e']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#3a100e'], [1, '#6a1c18']], [0, 0, 1, 0]));
    s += wallWindows(c, R, -1, [0, 0.2, 0.4, 0.6, 0.8, 1], -380, 60, { c1: tint[0], c2: '#e8b860', lit: tint[1] }) + wallWindows(c, R, 1, [0, 0.2, 0.4, 0.6, 0.8, 1], -380, 60, { c1: tint[0], c2: '#e8b860', lit: tint[1] });
    s += R.floor(LG(c, [[0, '#4a2c12'], [0.5, '#a67c34'], [1, '#e0bc60']]));
    s += R.floorGrid('#2a1808', 0.35, 14, 8, 0);
    s += floorLight(c, R, -1, [0.04, 0.24, 0.44, 0.64, 0.84], tint[0], 0.22, 420) + floorLight(c, R, 1, [0.04, 0.24, 0.44, 0.64, 0.84], tint[0], 0.22, 420);
    s += coffers(c, R, [0.1, 0.34, 0.58, 0.82, 0.98], { c0: '#2a0e0c', c1: '#5a2214', bt: 34 });
    /* red carpet runner */
    s += R.quad([[-150, R.Yf, -0.2], [150, R.Yf, -0.2], [110, R.Yf, 0.78], [-110, R.Yf, 0.78]], LG(c, [[0, '#6e0e12'], [1, '#a8201c']]));
    s += R.quad([[-150, R.Yf, -0.2], [-138, R.Yf, -0.2], [-100, R.Yf, 0.78], [-110, R.Yf, 0.78]], '#e8c060', OP(0.7)) + R.quad([[150, R.Yf, -0.2], [138, R.Yf, -0.2], [100, R.Yf, 0.78], [110, R.Yf, 0.78]], '#e8c060', OP(0.7));
    /* dais + throne */
    s += dais(c, R, 0.8, 0.93, 420, [30, 60, 90], ['#b8201c', '#7a1812', '#e8c060']);
    var b = R.backRect(), cx = 800, tb = R.P(0, R.Yf - 90, 0.9);
    /* golden screen behind throne */
    s += RC(cx - 250, tb[1] - 250, 500, 250, LG(c, [[0, '#e8c25a'], [1, '#a8781c']])) + RC(cx - 250, tb[1] - 250, 500, 12, '#b3261e');
    s += medal(c, cx, tb[1] - 150, 78, '#f4d878', { bg: '#a8201c' });
    s += RC(cx - 262, tb[1] - 250, 12, 250, '#9a1e1a') + RC(cx + 250, tb[1] - 250, 12, 250, '#9a1e1a');
    /* throne chair */
    s += RC(cx - 74, tb[1] - 170, 148, 150, LG(c, [[0, '#f4d878'], [1, '#b8861e']])) + RC(cx - 62, tb[1] - 158, 124, 128, '#a8201c') + medal(c, cx, tb[1] - 118, 38, '#f4d878', { bg: '#7a1410' });
    s += RC(cx - 96, tb[1] - 84, 192, 20, '#e8c25a') + RC(cx - 100, tb[1] - 66, 200, 40, LG(c, [[0, '#d8a83a'], [1, '#8a5a14']])) + RC(cx - 90, tb[1] - 24, 180, 14, '#7a1410');
    s += RC(cx - 120, tb[1] - 96, 24, 96, '#d8a83a') + RC(cx + 96, tb[1] - 96, 24, 96, '#d8a83a');
    s += glowE(c, 800, 420, 360, 200, '#ffd88a', 0.22);
    /* pillars with gold dragons */
    var pd = [0.06, 0.24, 0.42, 0.6, 0.78];
    for (i = pd.length - 1; i >= 0; i--) s += dragonPillar(c, R, -520, pd[i], 90) + dragonPillar(c, R, 520, pd[i], 90);
    /* incense burners */
    var ob = R.obj(-250, R.Yf, 0.7), ob2 = R.obj(250, R.Yf, 0.7);
    s += censer(c, ob.x, ob.y, ob.s * 2.6, { col: '#b8902a' }) + censer(c, ob2.x, ob2.y, ob2.s * 2.6, { col: '#b8902a' });
    s += smoke(c, ob.x, ob.y - 150 * ob.s, 200, '#e8e0d0', 0.3, { n: 2, w: 8 }) + smoke(c, ob2.x, ob2.y - 150 * ob2.s, 200, '#e8e0d0', 0.3, { n: 2, w: 8 });
    s += shaft(c, 60, 260, 40, 420, 740, 760, tint[0], 0.16) + shaft(c, 1340, 1540, 40, 1180, 860, 760, tint[0], 0.16);
    s += tintWash(c, 0.9) + fall(c, 'dust', 50, { y1: 700, col: '#ffe9a8' });
    s += endcap(c, { v: 0.5, f: 0.3 });
    return s;
  };

  /* ---------- Empress's Kunning palace: red & gold, phoenix ---------- */
  SCENES.kunning = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 408, sb: 0.4, Xw: 820, Yf: 540, Yc: -440 }), ds = [0.05, 0.3, 0.55, 0.8];
    s += R.back(LG(c, [[0, '#4a0e12'], [1, '#6a1618']]));
    s += R.wallL(LG(c, [[0, '#8a1c1c'], [1, '#4a0e10']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#4a0e10'], [1, '#8a1c1c']], [0, 0, 1, 0]));
    var lt0 = ['#fff0d0', '#fff6dc', '#ffe0a0', '#e8ecff'][se];
    s += wallWindows(c, R, -1, [0, 0.25, 0.5, 0.75, 1], -330, 40, { c1: lt0, c2: '#f0b868', lit: 0.62, fr: '#3a0a08' }) + wallWindows(c, R, 1, [0, 0.25, 0.5, 0.75, 1], -330, 40, { c1: lt0, c2: '#f0b868', lit: 0.62, fr: '#3a0a08' });
    s += R.floor(LG(c, [[0, '#2a0c0c'], [0.6, '#6a2418'], [1, '#9a3a20']]));
    s += R.floorGrid('#1a0606', 0.4, 12, 8, 0);
    s += coffers(c, R, [0.1, 0.34, 0.58, 0.82, 0.98], { c0: '#3a0c0c', c1: '#6a1c14', gold: '#f0c868' });
    /* embroidered carpet */
    s += R.quad([[-300, R.Yf, -0.2], [300, R.Yf, -0.2], [220, R.Yf, 0.9], [-220, R.Yf, 0.9]], LG(c, [[0, '#7a1016'], [1, '#b02a22']]));
    s += R.quad([[-300, R.Yf, -0.2], [-284, R.Yf, -0.2], [-210, R.Yf, 0.9], [-220, R.Yf, 0.9]], '#e8c060', OP(0.8)) + R.quad([[300, R.Yf, -0.2], [284, R.Yf, -0.2], [210, R.Yf, 0.9], [220, R.Yf, 0.9]], '#e8c060', OP(0.8));
    for (i = 0; i < 4; i++) { var mo = R.obj(0, R.Yf, 0.1 + i * 0.22); s += EL(mo.x, mo.y - 4 * mo.s, 120 * mo.s, 26 * mo.s, 'none', 'stroke="#f0c868" stroke-width="' + f1(5 * mo.s) + '" ' + OP(0.65)) + EL(mo.x, mo.y - 4 * mo.s, 60 * mo.s, 12 * mo.s, '#f0c868', OP(0.5)); }
    /* back: great phoenix screen + seat on a dais */
    s += dais(c, R, 0.84, 0.94, 330, [26, 52], ['#9a1a18', '#6a1210', '#e8c060']);
    var tb = R.P(0, R.Yf - 52, 0.93), cx = 800;
    s += RC(cx - 280, tb[1] - 270, 560, 270, LG(c, [[0, '#a8201c'], [1, '#6a1010']])) + RC(cx - 290, tb[1] - 282, 580, 16, '#e8c25a') + RC(cx - 290, tb[1] - 282, 16, 282, '#e8c25a') + RC(cx + 274, tb[1] - 282, 16, 282, '#e8c25a');
    s += glowE(c, cx, tb[1] - 130, 200, 130, '#ffd070', 0.3) + phoenix(c, cx + 40, tb[1] - 150, 0.8);
    /* phoenix chair */
    s += RC(cx - 66, tb[1] - 124, 132, 112, LG(c, [[0, '#f0cc66'], [1, '#a8781c']])) + RC(cx - 54, tb[1] - 112, 108, 90, '#b3261e') + RC(cx - 80, tb[1] - 46, 160, 38, LG(c, [[0, '#d8a83a'], [1, '#8a5a14']])) + RC(cx - 86, tb[1] - 62, 172, 18, '#b3261e');
    s += glowE(c, 800, 440, 380, 210, '#ffb060', 0.25);
    /* pillars */
    var pg = colGrad(c, '#a8201c');
    for (i = ds.length - 1; i >= 0; i--) {
      var pL = R.pillar(-470, ds[i], 80, pg, { baseCol: '#e8c060', baseCol2: '#b88a2a', capCol: '#e8c060' }), pr = R.pillar(470, ds[i], 80, pg, { baseCol: '#e8c060', baseCol2: '#b88a2a', capCol: '#e8c060' });
      var tp = R.P(-470, R.Yc, ds[i]), bp = R.P(-470, R.Yf, ds[i]), tq = R.P(470, R.Yc, ds[i]), sw = 80 * R.s(ds[i]);
      s += pL + pr + RC(tp[0] - sw * 0.5, tp[1] + (bp[1] - tp[1]) * 0.22, sw, (bp[1] - tp[1]) * 0.06, '#e8c25a', OP(0.8)) + RC(tq[0] - sw * 0.5, tq[1] + (bp[1] - tp[1]) * 0.22, sw, (bp[1] - tp[1]) * 0.06, '#e8c25a', OP(0.8));
    }
    /* pearl curtains + lanterns */
    var cl = R.P(-470, R.Yc, 0.3), cr = R.P(470, R.Yc, 0.3);
    var gold = '#f0c868';
    for (i = 0; i < 3; i++) { var lo = R.obj(-300 + i * 300, R.Yc + 30, 0.4 + i * 0.0); s += lantern(c, lo.x, lo.y, lo.s * 1.5, { night: true, cord: 0, col: '#d8281c', glow: 0.9 }); }
    var ob = R.obj(-330, R.Yf, 0.62), ob2 = R.obj(330, R.Yf, 0.62);
    s += censer(c, ob.x, ob.y, ob.s * 2.4, { col: '#c8a030' }) + censer(c, ob2.x, ob2.y, ob2.s * 2.4, { col: '#c8a030' }) + smoke(c, ob.x, ob.y - 140 * ob.s, 180, '#f0e4d0', 0.3) + smoke(c, ob2.x, ob2.y - 140 * ob2.s, 180, '#f0e4d0', 0.3);
    s += tintWash(c, 0.8) + fall(c, 'dust', 40, { y1: 700, col: '#ffd890' });
    s += endcap(c, { v: 0.5, f: 0.3 });
    return s;
  };

  /* ---------- Great Selection hall ---------- */
  SCENES.selection_hall = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 380, sb: 0.34, Xw: 840, Yf: 500, Yc: -400 }), ds = [0.02, 0.17, 0.32, 0.47, 0.62, 0.77];
    var lt0 = ['#fff4d8', '#fffae0', '#ffe4a8', '#e4ecff'][se];
    s += R.back(LG(c, [[0, '#3a1810'], [1, '#5a2a1a']]));
    /* bright open doors at the back */
    var br = R.backRect();
    s += RC(br.x + br.w * 0.12, br.y + br.h * 0.1, br.w * 0.76, br.h * 0.9, LG(c, [[0, lt0], [1, '#f8e8c0']]));
    s += hall(c, { cx: 800, gy: br.y + br.h * 0.88, w: 190, tier: 2, far: true, glaze: '#e2ac2c', farWall: '#9a2e26', snow: se === 3 });
    s += RC(br.x + br.w * 0.12, br.y + br.h * 0.1, br.w * 0.76, br.h * 0.9, latPat(c, 0.35, '#4a120d'), OP(0.9));
    s += R.wallL(LG(c, [[0, '#7a1c18'], [1, '#4a0e0c']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#4a0e0c'], [1, '#7a1c18']], [0, 0, 1, 0]));
    s += wallWindows(c, R, -1, [0, 0.25, 0.5, 0.75, 1], -300, 50, { c1: lt0, c2: '#f0c070', lit: 0.8 }) + wallWindows(c, R, 1, [0, 0.25, 0.5, 0.75, 1], -300, 50, { c1: lt0, c2: '#f0c070', lit: 0.8 });
    /* wooden plank floor */
    s += R.floor(LG(c, [[0, '#2a160c'], [0.6, '#6a4222'], [1, '#9a6a38']]));
    var pl = '';
    for (i = -9; i <= 9; i++) { var a = R.P(i * 110, R.Yf, -0.25), b = R.P(i * 110, R.Yf, 1); pl += 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]); }
    s += ST(pl, '#1a0c06', 1.4, OP(0.45));
    s += floorLight(c, R, -1, [0.04, 0.29, 0.54, 0.79], lt0, 0.22, 400) + floorLight(c, R, 1, [0.04, 0.29, 0.54, 0.79], lt0, 0.22, 400);
    s += coffers(c, R, [0.06, 0.24, 0.42, 0.6, 0.78, 0.96], { c0: '#2a0e0a', c1: '#5a2214', bt: 54 });
    /* long red carpet to the dais */
    s += R.quad([[-170, R.Yf, -0.2], [170, R.Yf, -0.2], [120, R.Yf, 0.8], [-120, R.Yf, 0.8]], LG(c, [[0, '#6a0c10'], [1, '#a82220']]));
    /* rows of stools */
    for (i = 0; i < 6; i++) {
      var dd = 0.06 + i * 0.13, o1 = R.obj(-290, R.Yf, dd), o2 = R.obj(290, R.Yf, dd), o3 = R.obj(-420, R.Yf, dd), o4 = R.obj(420, R.Yf, dd);
      [o1, o2, o3, o4].forEach(function (o) { s += EL(o.x, o.y + 2, 34 * o.s, 7 * o.s, '#000', OP(0.3)) + RC(o.x - 28 * o.s, o.y - 56 * o.s, 56 * o.s, 12 * o.s, '#7a2a1a') + RC(o.x - 24 * o.s, o.y - 44 * o.s, 6 * o.s, 44 * o.s, '#5a1a10') + RC(o.x + 18 * o.s, o.y - 44 * o.s, 6 * o.s, 44 * o.s, '#5a1a10') + RC(o.x - 28 * o.s, o.y - 58 * o.s, 56 * o.s, 4 * o.s, '#c8402a'); });
    }
    /* dais with three seats and screen */
    s += dais(c, R, 0.8, 0.92, 360, [34, 68], ['#9a1a18', '#5a1210', '#e8c060']);
    var tb = R.P(0, R.Yf - 68, 0.9), cx = 800;
    s += RC(cx - 220, tb[1] - 210, 440, 210, LG(c, [[0, '#d8a83a'], [1, '#8a5a14']])) + RC(cx - 220, tb[1] - 210, 440, 10, '#b3261e');
    s += paintLand(c, cx - 190, tb[1] - 190, 380, 160, { ink: '#3a4a54' });
    s += RC(cx - 52, tb[1] - 110, 104, 100, LG(c, [[0, '#f0cc66'], [1, '#a8781c']])) + RC(cx - 42, tb[1] - 100, 84, 70, '#b3261e') + RC(cx - 60, tb[1] - 40, 120, 28, '#d8a83a');
    var pg = colGrad(c, '#b3261e');
    for (i = ds.length - 1; i >= 0; i--) s += R.pillar(-470, ds[i], 70, pg) + R.pillar(470, ds[i], 70, pg);
    for (i = 0; i < 3; i++) { var lo = R.obj(-300, R.Yc + 40, 0.18 + i * 0.26), ro = R.obj(300, R.Yc + 40, 0.18 + i * 0.26); s += lantern(c, lo.x, lo.y, lo.s * 1.3, { night: false, cord: 0, glow: 0.35 }) + lantern(c, ro.x, ro.y, ro.s * 1.3, { night: false, cord: 0, glow: 0.35 }); }
    s += shaft(c, 40, 240, 30, 440, 700, 760, lt0, 0.16) + shaft(c, 1360, 1560, 30, 1160, 900, 760, lt0, 0.16);
    s += tintWash(c, 1) + fall(c, 'dust', 40, { y1: 700, col: '#fff0b0' });
    s += endcap(c, { v: 0.5, f: 0.3 });
    return s;
  };

  /* ======================================================================
     11. furniture / interior pieces for flat interiors
     ====================================================================== */
  function bookshelf(c, x, y, w, h, o) {
    o = o || {}; var s = '', wood = o.wood || '#4a2416', rows = o.rows || 5, i;
    s += RC(x - 8, y - 8, w + 16, h + 8, wood) + RC(x, y, w, h, '#1c0e08');
    s += RC(x, y, w, h, PT(c, 'books', h / rows / 34, 52, 34, '<rect x="1" y="8" width="5" height="22" fill="#8a2a22"/><rect x="6" y="4" width="6" height="26" fill="#2a5a6a"/><rect x="12" y="10" width="5" height="20" fill="#c8a050"/><rect x="17" y="6" width="7" height="24" fill="#4a3a6a"/><rect x="24" y="9" width="5" height="21" fill="#3a6a4a"/><rect x="29" y="3" width="6" height="27" fill="#b86a30"/><rect x="35" y="8" width="5" height="22" fill="#e8dcc0"/><rect x="40" y="5" width="6" height="25" fill="#5a2a1a"/><rect x="46" y="9" width="5" height="21" fill="#2a4a7a"/><rect y="30" width="52" height="4" fill="#4a2416"/><rect x="2" y="12" width="3" height="1.4" fill="#f2cf74"/><rect x="18" y="10" width="5" height="1.4" fill="#f2cf74"/>'));
    s += RC(x, y, w, h * 0.04, '#000', OP(0.4)) + RC(x - 8, y - 14, w + 16, 12, lt(wood, 0.12)) + RC(x + w / 2 - 2, y, 4, h, wood, OP(0.9));
    return s;
  }
  /* window with an outside view (seasonal branch). night: moonlit */
  function outView(c, x, y, w, h, o) {
    o = o || {}; var se = c.se, night = o.night, id = CPR(c, x, y, w, h), s = '<g clip-path="url(#' + id + ')">';
    s += RC(x, y, w, h, LG(c, night ? [[0, '#0a1236'], [1, '#2a3a6e']] : (se === 3 ? [[0, '#c8d2e6'], [1, '#eef0f8']] : se === 2 ? [[0, '#a8c4de'], [1, '#fbe2b8']] : [[0, '#a8d4f0'], [1, '#f2f4e4']])));
    if (night) s += stars(c, 24, y + h * 0.5, 0.8) + moon(c, x + w * 0.7, y + h * 0.3, Math.min(w, h) * 0.12);
    s += ridge(c, y + h * 0.78, h * 0.18, night ? '#1a2250' : (o.hill || seasonHill(se)[0]), night ? '#2c3270' : (o.hill2 || seasonHill(se)[1]), { step: 80, bottom: y + h });
    s += branchCorner(c, x + w + 20, y + h * 0.1, w * 0.85, -1.95, { seed: o.seed || 5, k: 0.9, bark: night ? '#10101e' : '#3a2a24' });
    return s + '</g>';
  }
  /* embroidered rug seen in perspective (flattened ellipse medallion) */
  function rug(c, cx, cy, rx, ry, c1, c2) {
    return EL(cx, cy, rx, ry, c1) + EL(cx, cy, rx * 0.92, ry * 0.9, 'none', 'stroke="' + c2 + '" stroke-width="3" ' + OP(0.8)) + EL(cx, cy, rx * 0.7, ry * 0.68, c2, OP(0.28)) + EL(cx, cy, rx * 0.4, ry * 0.38, 'none', 'stroke="' + c2 + '" stroke-width="2" ' + OP(0.7)) + EL(cx, cy, rx * 0.16, ry * 0.15, c2, OP(0.6));
  }
  /* canopy bed (拔步床) front view; (cx, yb) = bottom centre, w, h total */
  function canopyBed(c, cx, yb, w, h) {
    var s = '', x0 = cx - w / 2, wood = '#4a1c12', i;
    s += EL(cx, yb + 6, w * 0.55, 14, '#000', OP(0.35));
    s += RC(x0 + w * 0.04, yb - h * 0.82, w * 0.92, h * 0.74, LG(c, [[0, '#2a0a0e'], [1, '#4a1418']]));
    /* back embroidered panel */
    s += RC(x0 + w * 0.1, yb - h * 0.74, w * 0.8, h * 0.4, LG(c, [[0, '#7a1620'], [1, '#a82a28']])) + EL(cx, yb - h * 0.54, w * 0.16, w * 0.16, 'none', 'stroke="#e8c060" stroke-width="3" ' + OP(0.7)) + phoenix(c, cx + 26, yb - h * 0.5, 0.36, { gold: '#e8c060' });
    /* mattress & quilt */
    s += RC(x0 + w * 0.05, yb - h * 0.34, w * 0.9, h * 0.22, LG(c, [[0, '#b82a2a'], [1, '#7a1418']])) + RC(x0 + w * 0.05, yb - h * 0.34, w * 0.9, h * 0.035, '#e8c060');
    s += RC(x0 + w * 0.05, yb - h * 0.34, w * 0.9, h * 0.22, PT(c, 'quilt', 0.9, 40, 24, '<circle cx="20" cy="12" r="7" fill="none" stroke="#f0c868" stroke-width="1.4" opacity=".6"/><circle cx="20" cy="12" r="2" fill="#f0c868" opacity=".6"/><path d="M0 0L6 6M40 0L34 6M0 24L6 18M40 24L34 18" stroke="#f0c868" stroke-width="1" opacity=".4"/>'));
    s += EL(x0 + w * 0.22, yb - h * 0.37, w * 0.1, h * 0.05, '#f2e4cc') + EL(x0 + w * 0.78, yb - h * 0.37, w * 0.1, h * 0.05, '#f2e4cc') + EL(x0 + w * 0.22, yb - h * 0.37, w * 0.1, h * 0.05, 'none', 'stroke="#e8c060" stroke-width="2"');
    s += RC(x0, yb - h * 0.12, w, h * 0.12, wood) + RC(x0, yb - h * 0.12, w, 4, lt(wood, 0.3));
    /* posts + canopy */
    var pw = w * 0.035;
    s += RC(x0, yb - h, pw, h, colGrad(c, '#6a2a1a')) + RC(x0 + w - pw, yb - h, pw, h, colGrad(c, '#6a2a1a')) + RC(x0 + w * 0.12, yb - h * 0.9, pw * 0.7, h * 0.78, colGrad(c, '#6a2a1a'), OP(0.0));
    s += RC(x0 - w * 0.03, yb - h - h * 0.06, w * 1.06, h * 0.1, LG(c, [[0, '#5a2416'], [1, '#2a0e08']])) + RC(x0 - w * 0.03, yb - h - h * 0.06, w * 1.06, 4, '#e8c060');
    s += RC(x0, yb - h + h * 0.04, w, h * 0.12, '#2a0c08') + RC(x0, yb - h + h * 0.04, w, h * 0.12, iceCrack(c, 0.5, '#d8a84a'), OP(0.85)) + RC(x0, yb - h + h * 0.16, w, 5, '#e8c060');
    /* curtains tied back */
    var cl = 'M' + f1(x0 + pw) + ' ' + f1(yb - h + h * 0.16) + 'L' + f1(x0 + w * 0.17) + ' ' + f1(yb - h + h * 0.16) + 'Q' + f1(x0 + w * 0.2) + ' ' + f1(yb - h * 0.5) + ' ' + f1(x0 + w * 0.09) + ' ' + f1(yb - h * 0.5) + 'Q' + f1(x0 + w * 0.12) + ' ' + f1(yb - h * 0.3) + ' ' + f1(x0 + w * 0.16) + ' ' + f1(yb - h * 0.14) + 'L' + f1(x0 + pw) + ' ' + f1(yb - h * 0.14) + 'Z';
    s += PA(cl, LG(c, [[0, '#a82024'], [0.5, '#d8403a'], [1, '#7a1216']], [0, 0, 1, 0])) + PA('M' + f1(x0 + w - pw) + ' ' + f1(yb - h + h * 0.16) + 'L' + f1(x0 + w * 0.83) + ' ' + f1(yb - h + h * 0.16) + 'Q' + f1(x0 + w * 0.8) + ' ' + f1(yb - h * 0.5) + ' ' + f1(x0 + w * 0.91) + ' ' + f1(yb - h * 0.5) + 'Q' + f1(x0 + w * 0.88) + ' ' + f1(yb - h * 0.3) + ' ' + f1(x0 + w * 0.84) + ' ' + f1(yb - h * 0.14) + 'L' + f1(x0 + w - pw) + ' ' + f1(yb - h * 0.14) + 'Z', LG(c, [[0, '#7a1216'], [0.5, '#d8403a'], [1, '#a82024']], [0, 0, 1, 0]));
    s += ST('M' + f1(x0 + w * 0.1) + ' ' + f1(yb - h * 0.5) + 'h' + f1(w * 0.1) + 'M' + f1(x0 + w * 0.8) + ' ' + f1(yb - h * 0.5) + 'h' + f1(w * 0.1), '#e8c060', 5, 'stroke-linecap="round"');
    return s;
  }
  /* pearl-bead curtain across width */
  function pearls(c, x0, x1, y0, len, n) {
    var s = '', i, d = '', step = (x1 - x0) / n;
    for (i = 0; i <= n; i++) d += 'M' + f1(x0 + i * step) + ' ' + f1(y0) + 'v' + f1(len * (0.85 + 0.15 * Math.sin(i * 1.7)));
    s += ST(d, '#fff0d0', 4, 'stroke-linecap="round" stroke-dasharray="0 9" ' + OP(0.85)) + ST(d, '#c8a850', 1, OP(0.5));
    return s + RC(x0 - 6, y0 - 8, x1 - x0 + 12, 10, '#e8c060');
  }
  /* seated Buddha with aureole at (cx, base) of height h */
  function buddha(c, cx, yb, h) {
    var s = '', k = h / 300, gold = '#e4b840', gd = '#a8761c';
    s += glow(c, cx, yb - h * 0.62, h * 0.8, '#ffd070', 0.5);
    s += CI(cx, yb - h * 0.62, h * 0.4, 'none', 'stroke="#f2d070" stroke-width="' + f1(5 * k) + '" ' + OP(0.7)) + CI(cx, yb - h * 0.62, h * 0.33, RG(c, [[0, '#ffe08a', 0.3], [1, '#e4b840', 0.12]]));
    /* lotus throne */
    for (var i = -3; i <= 3; i++) s += PA('M' + f1(cx + i * 40 * k) + ' ' + f1(yb) + 'Q' + f1(cx + i * 44 * k - 18 * k) + ' ' + f1(yb - 40 * k) + ' ' + f1(cx + i * 40 * k + 6 * k) + ' ' + f1(yb - 52 * k) + 'Q' + f1(cx + i * 44 * k + 26 * k) + ' ' + f1(yb - 30 * k) + ' ' + f1(cx + i * 40 * k + 30 * k) + ' ' + f1(yb) + 'Z', i % 2 ? '#e8a0b4' : '#f4c0cc', 'stroke="#b8607a" stroke-width="1.2"');
    s += RC(cx - 120 * k, yb - 70 * k, 240 * k, 22 * k, gd);
    /* body */
    s += PA('M' + f1(cx - 100 * k) + ' ' + f1(yb - 52 * k) + 'Q' + f1(cx - 130 * k) + ' ' + f1(yb - 100 * k) + ' ' + f1(cx - 70 * k) + ' ' + f1(yb - 130 * k) + 'Q' + f1(cx - 60 * k) + ' ' + f1(yb - 200 * k) + ' ' + f1(cx - 34 * k) + ' ' + f1(yb - 220 * k) + 'L' + f1(cx + 34 * k) + ' ' + f1(yb - 220 * k) + 'Q' + f1(cx + 60 * k) + ' ' + f1(yb - 200 * k) + ' ' + f1(cx + 70 * k) + ' ' + f1(yb - 130 * k) + 'Q' + f1(cx + 130 * k) + ' ' + f1(yb - 100 * k) + ' ' + f1(cx + 100 * k) + ' ' + f1(yb - 52 * k) + 'Z', LG(c, [[0, lt(gold, 0.2)], [0.5, gold], [1, gd]], [0, 0, 1, 0]));
    s += ST('M' + f1(cx - 60 * k) + ' ' + f1(yb - 130 * k) + 'Q' + f1(cx) + ' ' + f1(yb - 100 * k) + ' ' + f1(cx + 60 * k) + ' ' + f1(yb - 130 * k) + 'M' + f1(cx - 90 * k) + ' ' + f1(yb - 76 * k) + 'Q' + f1(cx) + ' ' + f1(yb - 96 * k) + ' ' + f1(cx + 90 * k) + ' ' + f1(yb - 76 * k), gd, 2.4 * k, OP(0.7));
    /* head: serene face, long ears, hair knot with curls */
    var hy = yb - 254 * k, hair = '#232a5c';
    s += RC(cx - 13 * k, yb - 232 * k, 26 * k, 20 * k, gd) + EL(cx - 31 * k, hy + 8 * k, 5.5 * k, 17 * k, lt(gold, 0.1)) + EL(cx + 31 * k, hy + 8 * k, 5.5 * k, 17 * k, lt(gold, 0.1));
    s += EL(cx, hy, 28 * k, 36 * k, LG(c, [[0, lt(gold, 0.28)], [1, gd]], [0, 0, 1, 0]));
    s += PA('M' + f1(cx - 29 * k) + ' ' + f1(hy - 4 * k) + 'Q' + f1(cx - 31 * k) + ' ' + f1(hy - 40 * k) + ' ' + f1(cx) + ' ' + f1(hy - 40 * k) + 'Q' + f1(cx + 31 * k) + ' ' + f1(hy - 40 * k) + ' ' + f1(cx + 29 * k) + ' ' + f1(hy - 4 * k) + 'Q' + f1(cx + 22 * k) + ' ' + f1(hy - 16 * k) + ' ' + f1(cx + 12 * k) + ' ' + f1(hy - 15 * k) + 'Q' + f1(cx) + ' ' + f1(hy - 21 * k) + ' ' + f1(cx - 12 * k) + ' ' + f1(hy - 15 * k) + 'Q' + f1(cx - 22 * k) + ' ' + f1(hy - 16 * k) + ' ' + f1(cx - 29 * k) + ' ' + f1(hy - 4 * k) + 'Z', hair);
    s += EL(cx, hy - 44 * k, 15 * k, 12 * k, hair) + CI(cx, hy - 52 * k, 5 * k, '#c83a2a') + ST('M' + f1(cx - 24 * k) + ' ' + f1(hy - 20 * k) + 'h.1M' + f1(cx - 14 * k) + ' ' + f1(hy - 30 * k) + 'h.1M' + f1(cx) + ' ' + f1(hy - 34 * k) + 'h.1M' + f1(cx + 14 * k) + ' ' + f1(hy - 30 * k) + 'h.1M' + f1(cx + 24 * k) + ' ' + f1(hy - 20 * k) + 'h.1M' + f1(cx - 7 * k) + ' ' + f1(hy - 40 * k) + 'h.1M' + f1(cx + 7 * k) + ' ' + f1(hy - 40 * k) + 'h.1', '#6a78c8', 4 * k, 'stroke-linecap="round" ' + OP(0.8));
    s += CI(cx, hy - 10 * k, 2.6 * k, '#c83a2a') + ST('M' + f1(cx - 17 * k) + ' ' + f1(hy - 2 * k) + 'q' + f1(7 * k) + ' ' + f1(6 * k) + ' ' + f1(14 * k) + ' 0M' + f1(cx + 3 * k) + ' ' + f1(hy - 2 * k) + 'q' + f1(7 * k) + ' ' + f1(6 * k) + ' ' + f1(14 * k) + ' 0', '#3a2008', 2 * k, 'stroke-linecap="round"');
    s += ST('M' + f1(cx - 18 * k) + ' ' + f1(hy - 8 * k) + 'q' + f1(8 * k) + ' ' + f1(-5 * k) + ' ' + f1(15 * k) + ' ' + f1(-1 * k) + 'M' + f1(cx + 3 * k) + ' ' + f1(hy - 9 * k) + 'q' + f1(8 * k) + ' ' + f1(-4 * k) + ' ' + f1(15 * k) + ' ' + f1(1 * k), '#3a2008', 1.6 * k, OP(0.7)) + ST('M' + f1(cx) + ' ' + f1(hy + 2 * k) + 'v' + f1(9 * k) + 'q' + f1(-3 * k) + ' ' + f1(3 * k) + ' ' + f1(-5 * k) + ' ' + f1(2 * k), gd, 1.6 * k, OP(0.8)) + ST('M' + f1(cx - 8 * k) + ' ' + f1(hy + 21 * k) + 'q' + f1(8 * k) + ' ' + f1(4 * k) + ' ' + f1(16 * k) + ' 0', '#b04a30', 2.2 * k, 'stroke-linecap="round"');
    /* hands */
    s += EL(cx, yb - 96 * k, 28 * k, 16 * k, lt(gold, 0.15));
    return s;
  }
  /* herb cabinet drawers pattern rect */
  function drawers(c, x, y, w, h, sc) {
    return RC(x, y, w, h, '#2a160c') + RC(x, y, w, h, PT(c, 'drw', sc, 44, 34, '<rect x="2" y="2" width="40" height="30" rx="1.5" fill="#6a3a1c"/><rect x="2" y="2" width="40" height="5" fill="#8a5426" opacity=".6"/><rect x="14" y="8" width="16" height="7" fill="#efe2bc"/><rect x="16" y="9.5" width="12" height="1.2" fill="#3a2a1a" opacity=".6"/><rect x="16" y="12" width="9" height="1.2" fill="#3a2a1a" opacity=".5"/><circle cx="22" cy="22" r="3.2" fill="#c8a040"/><circle cx="22" cy="22" r="1.6" fill="#3a2410"/>'));
  }

  /* side-wall bookcases in perspective */
  function sideBooks(c, R, side, d0, d1, y0, y1, rows) {
    var s = '', r = rngf(5 + (side > 0 ? 3 : 0)), X = side * R.Xw, pal = ['#8a2a22', '#2a5a6a', '#c8a050', '#4a3a6a', '#3a6a4a', '#b86a30', '#e8dcc0', '#5a2a1a', '#2a4a7a'], i, j, n = 14;
    s += R.quad([[X, y0 - 14, d0], [X, y1 + 14, d0], [X, y1 + 14, d1], [X, y0 - 14, d1]], '#2a1408');
    for (i = 0; i < rows; i++) {
      var ya = y0 + (y1 - y0) * (i / rows), yb = y0 + (y1 - y0) * ((i + 1) / rows);
      for (j = 0; j < n; j++) {
        var da = d0 + (d1 - d0) * (j / n), db = d0 + (d1 - d0) * ((j + 0.78) / n), hh = (yb - ya) * (0.58 + r() * 0.3);
        s += R.quad([[X, yb - 8 - hh, da], [X, yb - 8, da], [X, yb - 8, db], [X, yb - 8 - hh, db]], pal[Math.floor(r() * pal.length)], OP(0.9));
      }
      s += R.quad([[X, yb - 8, d0], [X, yb - 2, d0], [X, yb - 2, d1], [X, yb - 8, d1]], '#5a3418');
    }
    return s;
  }

  /* ---------- Yangxin study ---------- */
  SCENES.study = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 400, sb: 0.58, Xw: 860, Yf: 520, Yc: -430 }), b = R.backRect(), lt0 = ['#fff0cc', '#fff6d8', '#ffd890', '#dfe8ff'][se];
    s += R.back(LG(c, [[0, '#f2e0b4'], [1, '#d2b484']]));
    s += RC(b.x, b.y, b.w, b.h * 0.8, PT(c, 'panel', 1, 70, 70, '<path d="M0 0V70M35 0V70" stroke="#a88a58" stroke-width="1" opacity=".3"/>'));
    s += RC(b.x, b.y + b.h * 0.8, b.w, b.h * 0.2, LG(c, [[0, '#5a361e'], [1, '#2a1409']])) + RC(b.x, b.y + b.h * 0.8, b.w, 4, '#e8c060', OP(0.8));
    s += R.wallL(LG(c, [[0, '#9a7650'], [1, '#6a4a30']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#6a4a30'], [1, '#9a7650']], [0, 0, 1, 0]));
    s += sideBooks(c, R, -1, 0.06, 0.98, -250, 340, 5);
    s += R.floor(LG(c, [[0, '#22120a'], [0.55, '#54321c'], [1, '#7a5030']]));
    var pl = ''; for (i = -9; i <= 9; i++) { var a = R.P(i * 110, R.Yf, -0.25), bb = R.P(i * 110, R.Yf, 1); pl += 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(bb[0]) + ' ' + f1(bb[1]); }
    s += ST(pl, '#0e0804', 1.2, OP(0.35));
    s += R.ceil(LG(c, [[0, '#3a2010'], [1, '#6a4428']]));
    for (i = 0; i < 2; i++) s += R.beam(0.18 + i * 0.5, 30, LG(c, [[0, '#18606e'], [1, '#0e3a4c']]));
    s += bookshelf(c, b.x + 20, b.y + 50, 330, b.h * 0.72, { rows: 5 });
    /* plaque + scroll */
    s += RC(b.x + 410, b.y + 6, 320, 46, '#2a120a') + RC(b.x + 416, b.y + 12, 308, 34, '#1a0a06', 'stroke="#e8c060" stroke-width="3"');
    s += ST('M' + (b.x + 450) + ' ' + (b.y + 34) + 'q20 -16 40 0t40 0M' + (b.x + 560) + ' ' + (b.y + 24) + 'l30 20M' + (b.x + 590) + ' ' + (b.y + 24) + 'l-30 20M' + (b.x + 620) + ' ' + (b.y + 30) + 'h70M' + (b.x + 655) + ' ' + (b.y + 22) + 'v26', '#e8c060', 4, 'stroke-linecap="round"');
    s += RC(b.x + 466, b.y + 70, 200, 330, '#efe0b8') + RC(b.x + 466, b.y + 70, 200, 8, '#6a2a18') + RC(b.x + 466, b.y + 392, 200, 12, '#6a2a18') + RC(b.x + 450, b.y + 68, 232, 4, '#c8a040');
    s += paintLand(c, b.x + 480, b.y + 90, 172, 290, { ink: '#3a4a54' });
    s += RC(b.x + 540, b.y + 392, 4, 20, '#c8a040') + RC(b.x + 596, b.y + 392, 4, 20, '#c8a040');
    /* right window with seasonal outside */
    s += RC(b.x + 782, b.y + 60, 238, 330, '#3a1a10') + outView(c, b.x + 792, b.y + 70, 218, 310, { seed: 4 });
    s += RC(b.x + 792, b.y + 70, 218, 310, latPat(c, 0.9, '#3a1a10'), OP(0.9)) + RC(b.x + 792, b.y + 70, 218, 310, LG(c, [[0, lt0, 0.3], [1, lt0, 0.08]]));
    /* imperial chair, desk, objects */
    s += RC(b.x + 440, b.y + 270, 150, 280, LG(c, [[0, '#f0c030'], [1, '#c8941c']])) + RC(b.x + 450, b.y + 280, 130, 120, '#e8b028') + medal(c, b.x + 515, b.y + 340, 34, '#fff0a8', { bg: '#c8381e' });
    s += table(c, b.x + 516, b.y + 450, 560, 150, { wood: '#4a1c10' });
    s += RC(b.x + 300, b.y + 446, 150, 6, '#f0e8d0') + RC(b.x + 330, b.y + 428, 70, 18, '#c8381e') + RC(b.x + 335, b.y + 432, 60, 3, '#f2cf74', OP(0.8)) + RC(b.x + 340, b.y + 438, 46, 3, '#f2cf74', OP(0.6));
    s += RC(b.x + 600, b.y + 436, 80, 14, '#2a2a2a') + RC(b.x + 604, b.y + 430, 72, 6, '#5a5a5a') + RC(b.x + 700, b.y + 420, 34, 30, '#3a2a1a') + ST('M' + (b.x + 706) + ' ' + (b.y + 420) + 'l-4 -34M' + (b.x + 714) + ' ' + (b.y + 420) + 'l0 -42M' + (b.x + 722) + ' ' + (b.y + 420) + 'l5 -36', '#7a5a38', 3, 'stroke-linecap="round"');
    s += candle(c, b.x + 800, b.y + 450, 1.0, { h: 38 }) + vase(c, b.x + 880, b.y + 450, 1.0, '#e8eef4') + censer(c, b.x + 940, b.y + 450, 0.9) + smoke(c, b.x + 940, b.y + 384, 160, '#f0e8d8', 0.3, { n: 2 });
    s += RC(b.x + 90, b.y + 560, 14, 110, '#4a1c10', OP(0.0));
    s += table(c, b.x + 940, b.y + 560, 220, 110, { wood: '#3a1608' }) + RC(b.x + 850, b.y + 548, 180, 12, '#1a0c08') + RC(b.x + 850, b.y + 548, 180, 3, '#6a4a2a') + ST('M' + (b.x + 856) + ' ' + (b.y + 553) + 'h168', '#e8d8b0', 0.8, OP(0.6));
    s += rug(c, 780, 800, 500, 62, '#c8901c', '#fff0a8') + rug(c, 780, 800, 280, 34, '#a8281e', '#f0d890');
    s += POLY([1010, 400, 1240, 400, 1180, 770, 760, 770], LG(c, [[0, lt0, 0.0], [1, lt0, 0.26]]), BL(c, 6));
    s += shaft(c, 1000, 1180, 120, 700, 1000, 740, lt0, 0.24);
    s += glowE(c, b.x + 800, b.y + 440, 180, 100, '#ffc766', 0.35) + glowE(c, 800, 420, 560, 230, '#ffe0a0', 0.14);
    s += tintWash(c, 1) + fall(c, 'dust', 44, { y1: 650, col: '#fff0b0' });
    s += endcap(c, { v: 0.46, f: 0.3 });
    return s;
  };

  /* ---------- bedchamber at night ---------- */
  SCENES.bedchamber = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 392, sb: 0.6, Xw: 860, Yf: 520, Yc: -420 }), b = R.backRect();
    s += R.back(LG(c, [[0, '#2a1218'], [1, '#4a1c20']]));
    s += R.wallL(LG(c, [[0, '#3a1418'], [1, '#1a0a0e']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#1a0a0e'], [1, '#3a1418']], [0, 0, 1, 0]));
    s += R.floor(LG(c, [[0, '#0e0608'], [0.6, '#2a1210'], [1, '#4a2016']])) + R.ceil(LG(c, [[0, '#120608'], [1, '#2a1410']]));
    /* moon window (back-left) and lattice window (right) with cold light */
    s += moonWindow(c, b.x + 84, b.y + 180, 104, { fr: '#4a1c10' });
    s += outView(c, b.x + 84 - 98, b.y + 180 - 98, 196, 196, { night: true, seed: 9 });
    s += CI(b.x + 84, b.y + 180, 104, 'none', 'stroke="#e8c060" stroke-width="6" ' + OP(0.6)) + CI(b.x + 84, b.y + 180, 98, 'none', 'stroke="#3a1008" stroke-width="3"');
    s += RC(b.x + 800, b.y + 70, 190, 300, '#3a1410') + RC(b.x + 810, b.y + 80, 170, 280, LG(c, [[0, '#3a4a8a', 0.9], [1, '#1c2a5a', 0.9]])) + RC(b.x + 810, b.y + 80, 170, 280, iceCrack(c, 0.8, '#1a0806'));
    s += shaft(c, b.x + 10, b.x + 160, b.y + 100, b.x - 40, b.x + 360, b.y + 560, '#8a9ae8', 0.18);
    s += shaft(c, b.x + 810, b.x + 980, b.y + 90, b.x + 700, b.x + 1010, b.y + 560, '#8a9ae8', 0.16);
    s += canopyBed(c, 800, b.y + b.h * 0.9, 640, 520);
    /* mirror stand left */
    s += RC(b.x + 74, b.y + 400, 8, 150, '#4a1c10') + CI(b.x + 78, b.y + 400, 52, '#3a1810') + CI(b.x + 78, b.y + 400, 45, RG(c, [[0, '#a8b4c0'], [1, '#6a7482']])) + RC(b.x + 30, b.y + 540, 96, 24, '#3a1610');
    /* candle stands */
    var cp = [[b.x + 250, b.y + b.h * 0.9], [b.x + 960, b.y + b.h * 0.9]];
    for (i = 0; i < 2; i++) { s += RC(cp[i][0] - 4, cp[i][1] - 130, 8, 130, '#5a2416') + RC(cp[i][0] - 22, cp[i][1] - 6, 44, 8, '#5a2416') + candle(c, cp[i][0], cp[i][1] - 130, 1.3, { h: 44, g: 1.3 }); }
    s += glowE(c, 800, 520, 700, 300, '#ff8a3c', 0.2);
    s += censer(c, b.x + 1040, b.y + b.h * 0.9 - 6, 1.0, { col: '#7a5a22' }) + smoke(c, b.x + 1040, b.y + b.h * 0.9 - 64, 170, '#d8d0e0', 0.28);
    s += rug(c, 800, 800, 560, 70, '#6a0e14', '#e8c060');
    s += mist(c, 600, 90, '#ff9a4a', 0.08) + tintWash(c, 0.35);
    s += fall(c, 'ember', 26, { y0: 300, y1: 600 });
    s += endcap(c, { v: 0.62, f: 0.3 });
    return s;
  };

  /* ---------- own hall, mid rank ---------- */
  SCENES.chamber_mid = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 396, sb: 0.58, Xw: 860, Yf: 520, Yc: -430 }), b = R.backRect(), lt0 = ['#fff2d4', '#fff8de', '#ffe0a8', '#e4ecff'][se];
    s += R.back(LG(c, [[0, '#e8d6b0'], [1, '#c8aa78']]));
    s += RC(b.x, b.y + b.h * 0.76, b.w, b.h * 0.24, LG(c, [[0, '#6a3a22'], [1, '#3a1c10']])) + RC(b.x, b.y + b.h * 0.76, b.w, 5, '#e8c060', OP(0.8));
    s += R.wallL(LG(c, [[0, '#b89a6a'], [1, '#7a5e3c']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#7a5e3c'], [1, '#b89a6a']], [0, 0, 1, 0]));
    s += R.floor(LG(c, [[0, '#2a160c'], [0.55, '#5a3420'], [1, '#7a4c2c']])) + R.ceil(LG(c, [[0, '#3a1e12'], [1, '#6a4028']]));
    for (i = 0; i < 3; i++) s += R.beam(0.1 + i * 0.4, 44, LG(c, [[0, '#2a8a86'], [1, '#17536e']]));
    /* paired lattice windows with garden view, painting between */
    s += RC(b.x + 40, b.y + 70, 230, 300, '#4a2016') + outView(c, b.x + 52, b.y + 82, 206, 276, { seed: 11 }) + RC(b.x + 52, b.y + 82, 206, 276, iceCrack(c, 0.55, '#4a2016'), OP(0.95)) + RC(b.x + 52, b.y + 82, 206, 276, LG(c, [[0, lt0, 0.3], [1, lt0, 0.05]]));
    s += RC(b.x + 762, b.y + 70, 230, 300, '#4a2016') + outView(c, b.x + 774, b.y + 82, 206, 276, { seed: 13 }) + RC(b.x + 774, b.y + 82, 206, 276, iceCrack(c, 0.55, '#4a2016'), OP(0.95)) + RC(b.x + 774, b.y + 82, 206, 276, LG(c, [[0, lt0, 0.3], [1, lt0, 0.05]]));
    s += frame(c, b.x + 372, b.y + 56, 290, 360, { fr: '#5a2c14' }) + paintLand(c, b.x + 376, b.y + 60, 282, 352, { ink: '#4a5a64' });
    /* long side table + vase + censer */
    s += table(c, b.x + 516, b.y + 462, 460, 110, { wood: '#5a2a18' });
    s += vase(c, b.x + 390, b.y + 462, 1.15, '#e8eef4') + censer(c, b.x + 640, b.y + 462, 0.95) + smoke(c, b.x + 640, b.y + 394, 150, '#f0e8d8', 0.28, { n: 2 });
    s += branchCorner(c, b.x + 392, b.y + 376, 90, -0.2, { seed: 3, k: 0.55, bark: '#3a2418' });
    /* couplets + hanging lanterns */
    s += RC(b.x + 306, b.y + 70, 44, 330, '#f0e4c8') + RC(b.x + 306, b.y + 70, 44, 330, 'none', 'stroke="#8a3a20" stroke-width="3"') + RC(b.x + 684, b.y + 70, 44, 330, '#f0e4c8') + RC(b.x + 684, b.y + 70, 44, 330, 'none', 'stroke="#8a3a20" stroke-width="3"');
    s += ST('M' + (b.x + 328) + ' ' + (b.y + 100) + 'v26m-10 0h20M' + (b.x + 328) + ' ' + (b.y + 150) + 'l-10 20m10 -20l10 20M' + (b.x + 318) + ' ' + (b.y + 200) + 'h20v20h-20zM' + (b.x + 328) + ' ' + (b.y + 250) + 'v40m-10 -20h20M' + (b.x + 318) + ' ' + (b.y + 320) + 'q10 -14 20 0t-20 24', '#2a1a10', 3.5, 'stroke-linecap="round" opacity=".8"') + ST('M' + (b.x + 706) + ' ' + (b.y + 100) + 'v26m-10 0h20M' + (b.x + 706) + ' ' + (b.y + 150) + 'l-10 20m10 -20l10 20M' + (b.x + 696) + ' ' + (b.y + 200) + 'h20v20h-20zM' + (b.x + 706) + ' ' + (b.y + 250) + 'v40m-10 -20h20M' + (b.x + 696) + ' ' + (b.y + 320) + 'q10 -14 20 0t-20 24', '#2a1a10', 3.5, 'stroke-linecap="round" opacity=".8"');
    s += lantern(c, b.x + 200, b.y - 60 + 30, 1.4, { cord: 0, night: false, glow: 0.5 }) + lantern(c, b.x + 830, b.y - 60 + 30, 1.4, { cord: 0, night: false, glow: 0.5 });
    s += rug(c, 800, 790, 520, 66, '#2a5a52', '#e8c880') + rug(c, 800, 790, 300, 40, '#b04a5a', '#f0d890');
    s += shaft(c, 130, 300, 100, 330, 560, 760, lt0, 0.2) + shaft(c, 1280, 1440, 100, 1060, 880, 760, lt0, 0.16);
    s += glowE(c, 800, 420, 560, 240, '#ffd890', 0.14);
    s += tintWash(c, 1) + fall(c, 'dust', 36, { y1: 650, col: '#fff0b0' });
    s += endcap(c, { v: 0.46, f: 0.3 });
    return s;
  };

  /* ---------- luxurious private hall (rank 6-9) ---------- */
  SCENES.chamber_grand = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 396, sb: 0.58, Xw: 860, Yf: 520, Yc: -440 }), b = R.backRect(), lt0 = ['#fff0d0', '#fff6dc', '#ffdc90', '#e0e8ff'][se];
    s += R.back(LG(c, [[0, '#b02a26'], [1, '#6a1214']]));
    s += RC(b.x, b.y, b.w, b.h * 0.76, PT(c, 'flr', 0.7, 60, 60, '<circle cx="30" cy="30" r="12" fill="none" stroke="#f0c868" stroke-width="1.6" opacity=".5"/><circle cx="30" cy="30" r="4" fill="#f0c868" opacity=".5"/><path d="M0 0Q14 14 0 30M60 0Q46 14 60 30M0 60Q14 46 0 30M60 60Q46 46 60 30" stroke="#f0c868" stroke-width="1.2" fill="none" opacity=".45"/>'));
    s += RC(b.x, b.y + b.h * 0.76, b.w, b.h * 0.24, LG(c, [[0, '#5a1814'], [1, '#2a0a0a']])) + RC(b.x, b.y + b.h * 0.76, b.w, 6, '#f0c868');
    s += R.wallL(LG(c, [[0, '#8a2020'], [1, '#4a0e10']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#4a0e10'], [1, '#8a2020']], [0, 0, 1, 0]));
    s += R.floor(LG(c, [[0, '#2a0a0a'], [0.55, '#5a1a14'], [1, '#8a2c1c']])) + coffers(c, R, [0.08, 0.5, 0.95], { c0: '#3a0c0c', c1: '#7a2418', gold: '#f0c868', bt: 40 });
    /* central phoenix screen */
    var cx = 800;
    s += RC(cx - 250, b.y + 30, 500, b.h * 0.7, '#3a0c0c') + RC(cx - 238, b.y + 42, 476, b.h * 0.7 - 24, LG(c, [[0, '#c8201e'], [1, '#7a1010']]));
    for (i = 1; i < 3; i++) s += RC(cx - 238 + i * 158.7 - 3, b.y + 42, 6, b.h * 0.7 - 24, '#3a0c0c');
    s += glowE(c, cx, b.y + 220, 220, 150, '#ffd070', 0.32) + phoenix(c, cx + 40, b.y + 215, 0.92) + EL(cx + 150, b.y + 80, 16, 16, '#f0c868', OP(0.0));
    s += ST('M' + (cx - 224) + ' ' + (b.y + b.h * 0.7 - 40) + 'q30 -30 60 0t60 0t60 0t60 0t60 0t60 0t60 0', '#f0c868', 3, OP(0.6));
    s += RC(cx - 250, b.y + 22, 500, 14, '#e8c060') + RC(cx - 262, b.y + b.h * 0.7 + 6, 524, 14, '#4a1410');
    /* luohan couch */
    s += RC(cx - 210, b.y + b.h * 0.76 - 96, 420, 24, '#5a1a10') + RC(cx - 210, b.y + b.h * 0.76 - 120, 420, 26, LG(c, [[0, '#7a2418'], [1, '#4a1008']])) + RC(cx - 210, b.y + b.h * 0.76 - 120, 420, 4, '#e8c060');
    s += RC(cx - 190, b.y + b.h * 0.76 - 74, 380, 22, LG(c, [[0, '#e8b040'], [1, '#b8781c']])) + RC(cx - 190, b.y + b.h * 0.76 - 52, 380, 52, LG(c, [[0, '#4a1810'], [1, '#2a0a06']]));
    s += EL(cx - 120, b.y + b.h * 0.76 - 82, 40, 18, '#c8301e') + EL(cx + 120, b.y + b.h * 0.76 - 82, 40, 18, '#2a7a6a') + EL(cx - 120, b.y + b.h * 0.76 - 82, 40, 18, 'none', 'stroke="#f0c868" stroke-width="2"');
    s += RC(cx - 90, b.y + b.h * 0.76 - 88, 180, 36, '#5a1a10') + RC(cx - 90, b.y + b.h * 0.76 - 90, 180, 6, '#e8c060') + EL(cx - 30, b.y + b.h * 0.76 - 94, 18, 8, '#e8a030') + EL(cx + 4, b.y + b.h * 0.76 - 96, 15, 7, '#c8301e') + EL(cx + 34, b.y + b.h * 0.76 - 94, 16, 7, '#7ab030');
    /* windows with sheer drapes */
    var wxs = [b.x + 60, b.x + 782];
    for (i = 0; i < 2; i++) {
      s += RC(wxs[i], b.y + 60, 190, 330, '#3a0c0a') + outView(c, wxs[i] + 10, b.y + 70, 170, 310, { seed: 3 + i * 5 }) + RC(wxs[i] + 10, b.y + 70, 170, 310, iceCrack(c, 0.5, '#3a0c0a'), OP(0.9)) + RC(wxs[i] + 10, b.y + 70, 170, 310, LG(c, [[0, lt0, 0.3], [1, lt0, 0.05]]));
      s += PA('M' + (wxs[i] - 16) + ' ' + (b.y + 44) + 'h222v340q-30 -60 -50 -340zM' + (wxs[i] - 16) + ' ' + (b.y + 44) + 'v300q20 -150 60 -300z', '#f0c868', OP(0.5));
      s += RC(wxs[i] - 22, b.y + 36, 234, 14, '#e8c060');
    }
    /* big vases, braziers, lanterns */
    s += vase(c, b.x + 135, b.y + b.h * 0.76 + 4, 2.1, '#2a5aa8') + vase(c, b.x + 899, b.y + b.h * 0.76 + 4, 2.1, '#2a5aa8');
    s += brazier(c, b.x + 30, b.y + b.h * 0.9, 1.5, { g: 0.7 });
    s += lantern(c, b.x + 250, b.y - 70, 1.7, { cord: 0, night: true, glow: 0.8, col: '#e83020' }) + lantern(c, b.x + 780, b.y - 70, 1.7, { cord: 0, night: true, glow: 0.8, col: '#e83020' });
    s += pearls(c, b.x + 20, b.x + b.w - 20, b.y + 6, 70, 34);
    s += rug(c, 800, 800, 600, 74, '#7a0e16', '#f0c868') + rug(c, 800, 800, 330, 40, '#2a6a5a', '#f0d890');
    s += glowE(c, 800, 460, 640, 260, '#ffb060', 0.16);
    s += shaft(c, 150, 310, 100, 300, 540, 760, lt0, 0.16) + shaft(c, 1290, 1450, 100, 1060, 880, 760, lt0, 0.16);
    s += tintWash(c, 0.9) + fall(c, 'dust', 36, { y1: 650, col: '#ffd890' });
    s += endcap(c, { v: 0.5, f: 0.32 });
    return s;
  };

  /* ---------- Dowager's Cining hall ---------- */
  SCENES.cining = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 400, sb: 0.56, Xw: 860, Yf: 520, Yc: -430 }), b = R.backRect(), cx = 800;
    var lt0 = ['#f6e8c8', '#f8eccc', '#f4d898', '#d8e0f4'][se];
    s += R.back(LG(c, [[0, '#4a1c26'], [1, '#2a0e18']]));
    s += R.wallL(LG(c, [[0, '#5a2230'], [1, '#2a0e18']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#2a0e18'], [1, '#5a2230']], [0, 0, 1, 0]));
    s += R.floor(LG(c, [[0, '#120810'], [0.55, '#32162a'], [1, '#52263a']])) + R.ceil(LG(c, [[0, '#1a0a10'], [1, '#42202a']]));
    s += R.beam(0.2, 36, LG(c, [[0, '#4a2a5a'], [1, '#2a1a3a']])) + R.beam(0.7, 36, LG(c, [[0, '#4a2a5a'], [1, '#2a1a3a']]));
    /* alcove with gilded arch */
    var ax = cx - 190, aw = 380, ay = b.y + 40, ah = b.h * 0.76;
    s += RC(ax - 22, ay - 16, aw + 44, ah + 16, '#1a0a0e') + PA('M' + ax + ' ' + (ay + ah) + 'V' + (ay + 120) + 'Q' + ax + ' ' + ay + ' ' + cx + ' ' + ay + 'Q' + (ax + aw) + ' ' + ay + ' ' + (ax + aw) + ' ' + (ay + 120) + 'V' + (ay + ah) + 'Z', LG(c, [[0, '#6a2a2a'], [1, '#3a1218']]), 'stroke="#e8c060" stroke-width="8"');
    s += PA('M' + (ax + 20) + ' ' + (ay + ah) + 'V' + (ay + 130) + 'Q' + (ax + 20) + ' ' + (ay + 22) + ' ' + cx + ' ' + (ay + 22) + 'Q' + (ax + aw - 20) + ' ' + (ay + 22) + ' ' + (ax + aw - 20) + ' ' + (ay + 130) + 'V' + (ay + ah) + 'Z', RG(c, [[0, '#8a4a3a'], [1, '#2a0e14']], [0.5, 0.45, 0.7]));
    s += buddha(c, cx, ay + ah - 40, 360);
    /* altar table with red cloth */
    s += RC(cx - 250, ay + ah - 40, 500, 54, '#2a0a10') + PA('M' + (cx - 262) + ' ' + (ay + ah - 52) + 'h524l-8 96h-508z', LG(c, [[0, '#b01e24'], [1, '#6a1014']]));
    s += RC(cx - 262, ay + ah - 52, 524, 10, '#e8c060') + ST('M' + (cx - 240) + ' ' + (ay + ah - 8) + 'q20 -14 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0', '#f0c868', 3, OP(0.7));
    s += candle(c, cx - 190, ay + ah - 52, 1.25, { h: 44, g: 1.2 }) + candle(c, cx + 190, ay + ah - 52, 1.25, { h: 44, g: 1.2 });
    s += censer(c, cx, ay + ah - 52, 1.1, { col: '#c8a030' }) + smoke(c, cx + 70, ay + ah - 112, 190, '#e8dcec', 0.26, { n: 2, w: 8, sw: 22 });
    s += EL(cx - 100, ay + ah - 58, 36, 10, '#e8c060') + EL(cx - 100, ay + ah - 66, 26, 10, '#e84a30') + EL(cx - 92, ay + ah - 70, 14, 8, '#e8a030') + EL(cx + 100, ay + ah - 58, 36, 10, '#e8c060') + EL(cx + 100, ay + ah - 66, 26, 10, '#a8c040') + EL(cx + 110, ay + ah - 70, 14, 8, '#e8a0b0');
    /* yellow silk drapes */
    var dy = b.y - 40;
    s += PA('M' + (b.x + 20) + ' ' + dy + 'H' + (ax - 30) + 'Q' + (ax - 80) + ' ' + (ay + ah * 0.5) + ' ' + (ax - 40) + ' ' + (b.y + b.h * 0.78) + 'L' + (ax - 120) + ' ' + (b.y + b.h * 0.78) + 'Q' + (b.x + 70) + ' ' + (ay + ah * 0.4) + ' ' + (b.x + 20) + ' ' + dy + 'Z', LG(c, [[0, '#d8a020'], [0.5, '#f0c848'], [1, '#a87810']], [0, 0, 1, 0]));
    s += PA('M' + (b.x + b.w - 20) + ' ' + dy + 'H' + (ax + aw + 30) + 'Q' + (ax + aw + 80) + ' ' + (ay + ah * 0.5) + ' ' + (ax + aw + 40) + ' ' + (b.y + b.h * 0.78) + 'L' + (ax + aw + 120) + ' ' + (b.y + b.h * 0.78) + 'Q' + (b.x + b.w - 70) + ' ' + (ay + ah * 0.4) + ' ' + (b.x + b.w - 20) + ' ' + dy + 'Z', LG(c, [[0, '#a87810'], [0.5, '#f0c848'], [1, '#d8a020']], [0, 0, 1, 0]));
    s += RC(b.x, dy - 4, b.w, 18, '#e8c060') + RC(b.x, dy - 4, b.w, 4, '#fff0b0', OP(0.6));
    /* window w/ cold light at right */
    s += RC(b.x + 830, b.y + 80, 160, 250, '#2a0e18') + outView(c, b.x + 840, b.y + 90, 140, 230, { seed: 8 }) + RC(b.x + 840, b.y + 90, 140, 230, iceCrack(c, 0.5, '#2a0e18'), OP(0.95)) + RC(b.x + 840, b.y + 90, 140, 230, LG(c, [[0, lt0, 0.3], [1, lt0, 0.05]]));
    s += shaft(c, b.x + 840, b.x + 990, b.y + 100, b.x + 450, b.x + 830, b.y + 560, lt0, 0.2);
    s += rug(c, 800, 790, 540, 64, '#3a1a4e', '#d8b050') + rug(c, 800, 790, 300, 36, '#6a1a2a', '#e8c868');
    for (i = 0; i < 2; i++) { var bx = i ? b.x + 910 : b.x + 70; s += RC(bx, b.y - 30, 70, 250, '#d8a020') + RC(bx, b.y - 30, 70, 250, 'none', 'stroke="#8a1c1c" stroke-width="5"') + ST('M' + (bx + 35) + ' ' + (b.y + 10) + 'v30m-14 0h28M' + (bx + 35) + ' ' + (b.y + 70) + 'q-16 12 0 24t0 24M' + (bx + 20) + ' ' + (b.y + 140) + 'h30M' + (bx + 35) + ' ' + (b.y + 128) + 'v50', '#6a1a10', 4, 'stroke-linecap="round" ' + OP(0.75)); }
    /* prayer cushions, wooden fish */
    s += EL(cx - 60, 800, 62, 18, '#2a0a10', OP(0.5)) + EL(cx - 60, 792, 54, 16, LG(c, [[0, '#f0c030'], [1, '#c8901c']])) + EL(cx + 70, 806, 62, 18, '#2a0a10', OP(0.5)) + EL(cx + 70, 798, 54, 16, LG(c, [[0, '#f0c030'], [1, '#c8901c']]));
    s += glowE(c, cx, 460, 520, 280, '#ffb060', 0.18);
    s += tintWash(c, 0.7) + fall(c, 'dust', 44, { y1: 700, col: '#ffe0a0' });
    s += endcap(c, { v: 0.6, f: 0.28 });
    return s;
  };

  /* ---------- Imperial Hospital ---------- */
  SCENES.clinic = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 396, sb: 0.58, Xw: 860, Yf: 520, Yc: -430 }), b = R.backRect(), lt0 = ['#e8f6e8', '#f0faea', '#f8ecc0', '#e4f0fa'][se];
    s += R.back('#3a2414');
    s += drawers(c, b.x + 40, b.y + 40, b.w - 80, b.h * 0.7, 0.9);
    s += RC(b.x + 40, b.y + 40, b.w - 80, b.h * 0.7, LG(c, [[0, '#000', 0.4], [0.3, '#000', 0], [0.7, '#000', 0], [1, '#000', 0.4]], [0, 0, 1, 0]));
    s += RC(b.x + 34, b.y + 32, b.w - 68, 12, '#5a3418') + RC(b.x + 34, b.y + 40 + b.h * 0.7, b.w - 68, 14, '#5a3418');
    s += R.wallL(LG(c, [[0, '#6a4a2c'], [1, '#3a2414']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#3a2414'], [1, '#6a4a2c']], [0, 0, 1, 0]));
    s += R.floor(LG(c, [[0, '#14201c'], [0.55, '#3a4a44'], [1, '#56665c']])) + R.floorGrid('#0a1210', 0.4, 10, 6, 0) + R.ceil(LG(c, [[0, '#1e130a'], [1, '#4a3420']]));
    for (i = 0; i < 2; i++) s += R.beam(0.16 + i * 0.5, 40, LG(c, [[0, '#4a6a5a'], [1, '#2a4a3e']]));
    /* window on the right wall with green light */
    s += R.quad([[R.Xw, -300, 0.1], [R.Xw, 20, 0.1], [R.Xw, 20, 0.6], [R.Xw, -300, 0.6]], '#2a1a10') + R.quad([[R.Xw, -280, 0.13], [R.Xw, 0, 0.13], [R.Xw, 0, 0.57], [R.Xw, -280, 0.57]], LG(c, [[0, lt0, 0.9], [1, '#c8e0b8', 0.8]]));
    s += shaft(c, 1330, 1500, 60, 1180, 1000, 780, lt0, 0.2);
    /* hanging herbs on a rope */
    var hr = '';
    s += LN(b.x - 60, b.y + 18, b.x + b.w + 60, b.y + 18, '#3a2a18', 3);
    for (i = 0; i < 11; i++) {
      var hx = b.x + 20 + i * ((b.w - 40) / 10), hl = 70 + (i * 37 % 60), hc = ['#6a8a3a', '#a8a050', '#8a5a2a', '#4a7a4a'][i % 4];
      s += LN(hx, b.y + 18, hx, b.y + 18 + hl * 0.4, '#3a2a18', 1.6) + PA('M' + f1(hx - 10) + ' ' + f1(b.y + 18 + hl * 0.4) + 'Q' + f1(hx - 14) + ' ' + f1(b.y + 18 + hl) + ' ' + f1(hx) + ' ' + f1(b.y + 18 + hl + 16) + 'Q' + f1(hx + 14) + ' ' + f1(b.y + 18 + hl) + ' ' + f1(hx + 10) + ' ' + f1(b.y + 18 + hl * 0.4) + 'Z', hc, OP(0.92)) + ST('M' + f1(hx) + ' ' + f1(b.y + 18 + hl * 0.4) + 'v' + f1(hl * 0.6), dk(hc, 0.35), 1, OP(0.6));
    }
    /* counter with scale, mortar, jars */
    s += RC(b.x + 80, b.y + b.h * 0.78, b.w - 160, 20, LG(c, [[0, '#8a5a30'], [1, '#5a3418']])) + RC(b.x + 90, b.y + b.h * 0.78 + 20, b.w - 180, b.h * 0.2, '#3a2010') + RC(b.x + 80, b.y + b.h * 0.78, b.w - 160, 3, '#c8a060', OP(0.7));
    var cy = b.y + b.h * 0.78;
    s += RC(cx_(b, 0.2) - 3, cy - 120, 6, 120, '#7a5a30') + RC(cx_(b, 0.2) - 52, cy - 124, 104, 5, '#8a6a38') + ST('M' + (cx_(b, 0.2) - 52) + ' ' + (cy - 120) + 'L' + (cx_(b, 0.2) - 52) + ' ' + (cy - 74) + 'M' + (cx_(b, 0.2) + 52) + ' ' + (cy - 120) + 'L' + (cx_(b, 0.2) + 52) + ' ' + (cy - 74), '#c8a060', 1.4) + EL(cx_(b, 0.2) - 52, cy - 72, 24, 5, '#c8a060') + EL(cx_(b, 0.2) + 52, cy - 72, 24, 5, '#c8a060');
    s += PA('M' + (cx_(b, 0.4) - 28) + ' ' + (cy - 36) + 'q0 36 28 36q28 0 28 -36z', '#6a6a6a') + RC(cx_(b, 0.4) - 32, cy - 40, 64, 6, '#8a8a8a') + RC(cx_(b, 0.4) + 8, cy - 80, 8, 52, '#7a5a30');
    for (i = 0; i < 4; i++) { var jx = cx_(b, 0.58) + i * 56; s += PA('M' + (jx - 20) + ' ' + cy + 'v-40q0 -20 12 -24h16q12 4 12 24v40z', ['#e8eef4', '#8aa8c8', '#e8eef4', '#c8a870'][i]) + RC(jx - 14, cy - 66, 28, 8, '#a8201c') + (i % 2 ? '' : ST('M' + (jx - 16) + ' ' + (cy - 30) + 'q16 -10 32 0', '#2a5a9a', 2, OP(0.8))); }
    s += RC(cx_(b, 0.86), cy - 46, 70, 46, '#e8d8a8') + RC(cx_(b, 0.86), cy - 46, 70, 4, '#a8402a') + ST('M' + (cx_(b, 0.86) + 10) + ' ' + (cy - 30) + 'h50M' + (cx_(b, 0.86) + 10) + ' ' + (cy - 18) + 'h36', '#3a2a1a', 1.4, OP(0.6));
    /* clay stove with steaming pot (left) */
    s += PA('M' + (b.x - 110) + ' ' + (b.y + b.h * 0.98) + 'Q' + (b.x - 120) + ' ' + (b.y + b.h * 0.78) + ' ' + (b.x - 60) + ' ' + (b.y + b.h * 0.72) + 'L' + (b.x + 20) + ' ' + (b.y + b.h * 0.72) + 'Q' + (b.x + 76) + ' ' + (b.y + b.h * 0.78) + ' ' + (b.x + 70) + ' ' + (b.y + b.h * 0.98) + 'Z', LG(c, [[0, '#8a5a3a'], [1, '#4a2a1a']], [0, 0, 1, 0]));
    s += EL(b.x - 20, b.y + b.h * 0.72, 60, 12, '#2a1a10') + PA('M' + (b.x - 56) + ' ' + (b.y + b.h * 0.72) + 'q-6 -60 24 -70h64q30 10 24 70z', '#3a3a3e') + EL(b.x + 4, b.y + b.h * 0.72 - 68, 40, 8, '#1a1a1c') + RC(b.x - 40, b.y + b.h * 0.86, 40, 20, '#ff8a2a', OP(0.0)) + glowE(c, b.x - 20, b.y + b.h * 0.9, 70, 40, '#ff8a2a', 0.5);
    s += smoke(c, b.x + 4, b.y + b.h * 0.72 - 74, 220, '#eef2ee', 0.34, { n: 3, w: 10, sw: 32, bl: 5 });
    s += lantern(c, b.x + b.w * 0.5, b.y - 70, 1.2, { cord: 0, night: false, glow: 0.6, col: '#c8341e' });
    s += glowE(c, b.x + b.w * 0.5, b.y + b.h * 0.5, 500, 240, '#ffc880', 0.12);
    s += tintWash(c, 0.8) + fall(c, 'dust', 32, { y1: 650, col: '#f0ffd8' });
    s += endcap(c, { v: 0.5, f: 0.32 });
    return s;
  };
  function cx_(b, f) { return b.x + b.w * f; }

  /* ---------- open pavilion (4 pillars, pyramid roof) ---------- */
  function pavilion(c, cx, gy, w, o) {
    o = o || {}; var s = '', hp = w * 0.09, pw = w * 0.034, ph = w * 0.42, gl = o.glaze || '#2f8f78', x0 = cx - w * 0.36, x1 = cx + w * 0.36, yt = gy - hp - ph, i;
    s += RC(cx - w * 0.5, gy - hp, w, hp, LG(c, [[0, '#d8d0bc'], [1, '#8a8474']])) + RC(cx - w * 0.52, gy - hp - 4, w * 1.04, 8, '#e6dfcc');
    for (i = 0; i < 6; i++) s += RC(cx - w * 0.3 + i * w * 0.12, gy - hp, 3, hp, '#6a6454', OP(0.4));
    s += RC(x0 - pw / 2, yt, x1 - x0 + pw, ph * 0.1, '#17536e');
    var inner = o.inner == null ? '#2a1812' : o.inner;
    s += RC(x0 + pw / 2, yt + ph * 0.1, x1 - x0 - pw, ph * 0.9, o.see || LG(c, [[0, inner, 0.0], [1, inner, 0.0]]));
    s += RC(x0 + pw / 2, yt + ph * 0.68, x1 - x0 - pw, ph * 0.07, '#8a1c16') + RC(x0 + pw / 2, yt + ph * 0.75, x1 - x0 - pw, ph * 0.25, 'none', 'stroke="#8a1c16" stroke-width="3"');
    s += RC(x0 + pw / 2, yt + ph * 0.75, x1 - x0 - pw, ph * 0.25, PT(c, 'rail', w / 700, 18, 18, '<path d="M0 0H18M9 0V18" stroke="#8a1c16" stroke-width="2.6" fill="none"/>'));
    var cg = colGrad(c, '#b3261e');
    s += RC(x0 - pw / 2, yt, pw, ph, cg) + RC(x1 - pw / 2, yt, pw, ph, cg) + RC(cx - w * 0.14 - pw / 2, yt, pw * 0.8, ph * 0.76, cg, OP(0.6)) + RC(cx + w * 0.14 - pw / 2, yt, pw * 0.8, ph * 0.76, cg, OP(0.6));
    s += RC(x0 - pw * 0.8, gy - hp - pw * 0.6, pw * 1.6, pw * 0.6, '#2a1a14') + RC(x1 - pw * 0.8, gy - hp - pw * 0.6, pw * 1.6, pw * 0.6, '#2a1a14');
    s += RC(x0 - pw * 0.5, yt, x1 - x0 + pw, ph * 0.12, '#14405e') + RC(x0 - pw * 0.5, yt + ph * 0.12, x1 - x0 + pw, ph * 0.03, '#e0b24a');
    s += lantern(c, cx, yt + ph * 0.15, w / 420, { night: !!o.night, cord: yt + ph * 0.12, glow: o.night ? 1 : 0.3 });
    s += roof(c, cx, yt + ph * 0.02, w * 1.05, w * 0.34, { glaze: gl, det: 2, night: o.night, snow: c.se === 3, rw: 0.045 });
    s += CI(cx, yt - w * 0.36, w * 0.022, GOLDL) + RC(cx - 1.5, yt - w * 0.36, 3, w * 0.06, GOLDD);
    return s;
  }

  /* ---------- family home: courtyard house at golden hour ---------- */
  SCENES.family_home = function (c) {
    var se = c.se, s = '', i, rr = rngf(77);
    var sk = [[[0, '#9ccbea'], [0.6, '#f0e6d6'], [1, '#ffe8c8']], [[0, '#4aa0dc'], [0.6, '#cfe8f0'], [1, '#fff0d0']], [[0, '#8ab4d8'], [0.5, '#f6d8a8'], [1, '#ffd49a']], [[0, '#a4b2c8'], [0.6, '#dcdcea'], [1, '#f4e4d8']]][se];
    s += sky(c, sk) + glow(c, 260, 120, 460, '#fff0c0', 0.6) + cloud(c, 1100, 140, 1.2, '#fff', 0.5) + cloud(c, 600, 220, 0.8, '#fff', 0.35);
    var hl = seasonHill(se); s += ridge(c, 470, 90, hl[0], hl[1], { step: 150 }) + mist(c, 466, 24, '#fff', 0.35);
    var gr = '#6a7078', rf = '#6e747c';
    /* neighbouring roofs behind the wall */
    s += hall(c, { cx: 190, gy: 520, w: 300, tier: 1, far: true, glaze: rf, farWall: '#5a4a40', snow: se === 3 }) + hall(c, { cx: 1440, gy: 520, w: 340, tier: 1, far: true, glaze: rf, farWall: '#5a4a40', snow: se === 3 });
    /* main hall + wings */
    s += hall(c, { cx: 800, gy: 640, w: 720, tier: 1, glaze: rf, red: '#7a3a26', lit: 0.5, snow: se === 3, rw: 0.3, door: 1, rh: 0.22 });
    s += hall(c, { cx: 250, gy: 650, w: 440, tier: 1, glaze: rf, red: '#7a3a26', lit: 0.4, snow: se === 3, rh: 0.2, cols: 4 });
    s += hall(c, { cx: 1350, gy: 650, w: 440, tier: 1, glaze: rf, red: '#7a3a26', lit: 0.4, snow: se === 3, rh: 0.2, cols: 4 });
    /* grey brick compound wall in front of wings */
    s += RC(0, 640, W, 20, '#8a8a84', OP(0.0));
    /* courtyard */
    s += RC(0, 650, W, 250, LG(c, [[0, '#8a8478'], [0.5, '#a8a090'], [1, '#78726a']]));
    var gp = ''; for (i = 0; i < 14; i++) { var yy = 650 + Math.pow(i / 14, 1.6) * 250; gp += 'M0 ' + f1(yy) + 'H1600'; }
    for (i = -10; i <= 10; i++) gp += 'M' + (800 + i * 30) + ' 650L' + (800 + i * 150) + ' 900';
    s += ST(gp, '#3a362e', 1, OP(0.28));
    s += PA('M690 650H910L1180 900H420Z', '#d8cfb8', OP(0.25));
    /* long afternoon shadows */
    s += POLY([430, 656, 780, 656, 1180, 900, 640, 900], '#1a2a4a', OP(0.14) + ' ' + BL(c, 8));
    /* ginkgo / pear tree left, stone table right, pots */
    s += GR(tree(c, 250, 760, 480, se === 0 ? 'blossom' : se === 2 ? 'ginkgo' : 'broad', { r: rngf(41), n: 12 }), RO(c, 6, '.03'));
    s += RC(1340, 690, 110, 14, '#9a9488') + RC(1356, 704, 78, 40, '#807a70') + RC(1330, 744, 130, 12, '#9a9488') + EL(1395, 686, 56, 12, '#b0aa9c');
    s += EL(1300, 750, 22, 8, '#8a847a') + EL(1490, 750, 22, 8, '#8a847a') + vase(c, 1397, 684, 0.6, '#e8eef4', { blue: true });
    s += peony(c, 520, 800, 1.0, { r: rngf(2) }) + peony(c, 1130, 810, 0.9, { r: rngf(3) });
    s += tufts(c, 770, 890, 18, { col: '#6a8a52' });
    /* round moon-window gate on far left wall: pot with bamboo */
    s += bamboo(c, 60, 780, 260, 4, { r: rngf(9) });
    s += (se !== 3 ? birds(c, 6, 700, 1300, 80, 250) : '') + shaft(c, 140, 280, 0, 420, 700, 800, '#fff0c0', 0.24);
    s += seasonAir(c, { n: 34, y1: 760 });
    s += endcap(c, { v: 0.4, f: 0.3 });
    return s;
  };

  /* ---------- servants' quarters / laundry yard ---------- */
  SCENES.servants_quarters = function (c) {
    var se = c.se, s = '', i, r = rngf(31);
    var sk = [[[0, '#aab6c0'], [0.6, '#d4d2c8'], [1, '#e6dcc8']], [[0, '#a0b8c8'], [0.6, '#e0e0d0'], [1, '#f0e4c4']], [[0, '#a8a8a8'], [0.6, '#d6c8b0'], [1, '#e2c8a0']], [[0, '#8e98a6'], [0.6, '#c0c6d2'], [1, '#d8d8e0']]][se];
    s += sky(c, sk) + cloud(c, 500, 130, 1.5, '#e8e8ea', 0.5) + cloud(c, 1200, 100, 1.3, '#dcdcde', 0.45);
    /* tall palace wall looming at back */
    s += wall(c, -10, 1610, 220, 330, { red: '#8a3028', glaze: '#a8842c', snow: se === 3 });
    s += hall(c, { cx: 1330, gy: 220, w: 420, tier: 2, far: true, glaze: '#b08a30', farWall: '#7a2a24', snow: se === 3 });
    s += mist(c, 400, 50, '#d8d4c8', 0.3);
    /* low servants' buildings */
    s += hall(c, { cx: 330, gy: 640, w: 640, tier: 1, glaze: '#5a5c60', red: '#5a2c20', lit: 0.12, snow: se === 3, rh: 0.17, hw: 0.12, door: 0, det: 1 });
    s += RC(560, 520, 360, 126, '#6a4a38') + RC(560, 520, 360, 126, PT(c, 'brk2', 0.8, 40, 16, '<path d="M0 .6H40M0 8.6H40M0 8V16M20 0V8" stroke="#000" stroke-width="1" fill="none" opacity=".25"/>')) + RC(568, 536, 52, 60, '#1a0e0a') + RC(700, 536, 52, 60, '#1a0e0a') + RC(826, 536, 52, 60, '#ffb866', OP(0.6)) + RC(826, 536, 52, 60, latPat(c, 0.5, '#2a1208'));
    s += roof(c, 740, 524, 420, 70, { glaze: '#5a5c60', det: 1, snow: se === 3, rw: 0.3 });
    s += glowE(c, 852, 566, 70, 60, '#ffb060', 0.35);
    /* ground: wet flagstones */
    s += RC(0, 640, W, 260, LG(c, [[0, '#6a665c'], [0.5, '#4a4640'], [1, '#34322e']]));
    s += cobbles(c, 0, W, 660, 890, '#6a665c', 60);
    s += PA('M300 760Q500 740 640 780Q700 840 520 850Q320 850 300 760Z', '#9aa8b4', OP(0.28)) + PA('M1000 800Q1200 780 1300 820Q1260 880 1100 870Z', '#9aa8b4', OP(0.25));
    /* clothesline with laundry */
    s += LN(40, 380, 1560, 420, '#4a3a2a', 3);
    s += RC(30, 380, 14, 270, '#5a4030') + RC(1556, 420, 14, 270, '#5a4030');
    var lc = ['#e8e4da', '#8a9ab0', '#d2cab8', '#6a7e94', '#ece8e0', '#a8b4c0'];
    for (i = 0; i < 12; i++) {
      var lx = 90 + i * 118 + (i % 3) * 8, lw = 70 + (i % 4) * 12, ly = 381 + lx * 0.0245, lh = 110 + (i * 53 % 80), sway = 6 * Math.sin(i * 1.3);
      s += PA('M' + lx + ' ' + f1(ly) + 'h' + lw + 'l' + f1(sway) + ' ' + lh + 'q' + f1(-lw / 4) + ' 8 ' + f1(-lw / 2) + ' 0t' + f1(-lw / 2) + ' 0z', lc[i % 6], OP(0.94)) + ST('M' + (lx + lw * 0.3) + ' ' + f1(ly + 4) + 'l' + f1(sway * 0.5) + ' ' + (lh - 10) + 'M' + (lx + lw * 0.7) + ' ' + f1(ly + 4) + 'l' + f1(sway * 0.5) + ' ' + (lh - 10), '#000', 1, OP(0.12));
    }
    /* well (left foreground), wooden tubs, boiling cauldron */
    s += RC(1180, 660, 12, 130, '#4a3020') + RC(1330, 660, 12, 130, '#4a3020') + RC(1170, 650, 182, 14, '#5a3a28') + ST('M1261 664v34', '#2a1a10', 2) + PA('M1250 698h22l-3 22h-16z', '#6a4a30');
    s += EL(1262, 790, 92, 26, '#3a3a3e') + PA('M1170 790v-24q92 -38 184 0v24z', '#6a665c') + EL(1262, 766, 92, 22, '#2a2a2e') + EL(1262, 768, 74, 14, '#1a2230');
    s += EL(420, 800, 64, 20, '#000', OP(0.3)) + PA('M356 770h128l-10 44h-108z', '#7a5a38') + EL(420, 770, 64, 14, '#5a3e28') + EL(420, 772, 54, 9, '#9aa6b0') + EL(560, 830, 58, 16, '#000', OP(0.3)) + PA('M502 800h116l-8 40h-100z', '#6a4a30') + EL(560, 800, 58, 12, '#4a3220') + EL(560, 802, 48, 8, '#a4b0ba');
    s += PA('M720 790q0 -42 40 -42h60q40 0 40 42z', '#2e2e32') + EL(800, 748, 62, 10, '#1a1a1e') + RC(700, 790, 200, 44, '#6a3a26') + glowE(c, 800, 812, 120, 40, '#ff8a2a', 0.4);
    s += smoke(c, 800, 745, 260, '#f2f2f0', 0.4, { n: 3, w: 12, sw: 30, bl: 6 });
    s += lantern(c, 1060, 560, 0.9, { cord: 520, night: true, glow: 0.5 });
    if (se === 3) { s += RC(0, 640, W, 260, LG(c, [[0, '#e8eef8', 0.55], [1, '#cdd8ee', 0.65]])) + tufts(c, 650, 880, 26, {}); s += EL(1262, 766, 92, 22, '#e8eef8'); s += EL(420, 770, 54, 8, '#fff') + EL(560, 800, 48, 7, '#fff'); }
    else if (se === 0) { s += tufts(c, 646, 700, 20, { col: '#6a9a48', x0: 0, x1: 1600 }) + CI(120, 668, 4, '#f6d0e0') + CI(1480, 676, 4, '#f6d0e0') + CI(900, 660, 3, '#fff6c0'); }
    if (se === 3) s += fall(c, 'snow', 110, { y1: 860 });
    else if (se === 2) s += fall(c, 'leaf', 24, { y1: 860 });
    else if (se === 0) s += fall(c, 'petal', 16, { y1: 860 });
    else s += fall(c, 'dust', 36, { y1: 700, col: '#fff2c0' });
    s += tintWash(c, 0.9) + RC(0, 0, W, H, '#202838', OP(0.1));
    s += endcap(c, { v: 0.55, f: 0.34 });
    return s;
  };

  /* ---------- small side court of a low-rank concubine ---------- */
  SCENES.small_court = function (c) {
    var se = c.se, s = '', i;
    var sk = [[[0, '#a8c4e0'], [0.55, '#f4dcd0'], [1, '#ffe2c0']], [[0, '#58a4dc'], [0.55, '#d6e8e8'], [1, '#fff0cc']], [[0, '#98aed0'], [0.5, '#f4c8a0'], [1, '#ffcc88']], [[0, '#a0a8c0'], [0.6, '#d6d0dc'], [1, '#eedcd4']]][se];
    s += sky(c, sk) + glow(c, 1300, 150, 420, '#ffe8c0', 0.5) + cloud(c, 400, 160, 1.3, '#fff', 0.4);
    s += ridge(c, 450, 70, seasonHill(se)[0], seasonHill(se)[1], { step: 160 });
    /* pale-red enclosing wall with a round gate */
    s += wall(c, -10, 1610, 440, 230, { red: '#a8483a', glaze: '#b8943c', snow: se === 3, det: 1 });
    var gx = 1280, gy = 560;
    s += CI(gx, gy, 96, '#2a1a14') + CI(gx, gy, 84, LG(c, [[0, '#9fc79a'], [1, '#d8e8b8']])) + crown(c, gx + 20, gy + 10, 70, 50, se === 3 ? ['#9aa8bc', '#c0ccde', '#eef2fa'] : se === 2 ? ['#b8501c', '#e0802a', '#f4c050'] : ['#3f8a4a', '#5aa856', '#9cd078'], 5, { r: rngf(4) }) + CI(gx, gy, 90, 'none', 'stroke="#c8c0aa" stroke-width="14"');
    /* small green-tiled hall */
    s += hall(c, { cx: 640, gy: 650, w: 600, tier: 1, glaze: '#3f8a74', red: '#a8301f', lit: 0.62, snow: se === 3, rh: 0.2, door: 1 });
    s += hall(c, { cx: 150, gy: 640, w: 280, tier: 1, far: true, glaze: '#3f8a74', farWall: '#8a2a1e', snow: se === 3 });
    /* ground: pale brick with path */
    s += RC(0, 650, W, 250, LG(c, [[0, se === 3 ? '#dfe5f0' : '#a89e88'], [1, se === 3 ? '#b8c4dc' : '#6e6654']]));
    s += PA('M520 650H760L1060 900H340Z', se === 3 ? '#cdd6ea' : '#c8bea6', OP(0.55));
    s += cobbles(c, 360, 1040, 672, 890, se === 3 ? '#9fb0d0' : '#8a8068', 22);
    /* gnarled old tree + chrysanthemum pots + well */
    s += GR(tree(c, 1060, 790, 400, se === 3 || se === 0 ? 'plum' : 'maple', { r: rngf(52), depth: 5, n: 15, wide: 1.0 }), RO(c, 5, '.03'));
    for (i = 0; i < 3; i++) { var px = 280 + i * 70; s += PA('M' + (px - 18) + ' 770h36l-6 34h-24z', '#a8603a') + (se === 3 ? EL(px, 766, 24, 8, '#fff') : crown(c, px, 756, 22, 16, se === 2 ? ['#b8801a', '#e0a82a', '#f6d060'] : ['#3a7a44', '#58a050', '#9cd078'], 3, { r: rngf(i + 3) })); }
    s += tufts(c, 760, 890, 16, {});
    s += lantern(c, 360, 560, 0.85, { cord: 480, night: false, glow: 0.45 });
    s += (se !== 3 ? birds(c, 4, 300, 900, 100, 260) : '') + shaft(c, 1180, 1320, 0, 900, 1100, 720, '#fff0c0', 0.2);
    s += seasonAir(c, { n: 30, y1: 760 });
    s += endcap(c, { v: 0.42, f: 0.3 });
    return s;
  };

  /* ---------- lakeside pavilion, golden hour ---------- */
  SCENES.pavilion_lake = function (c) {
    var se = c.se, s = '', i, r = rngf(23);
    var sk = [[[0, '#8fb4e0'], [0.45, '#f2cfd8'], [1, '#ffe4b8']], [[0, '#4a9ae0'], [0.45, '#f6dcc0'], [1, '#ffd890']], [[0, '#7a96c8'], [0.45, '#f6b890'], [1, '#ffc070']], [[0, '#9aa4c4'], [0.45, '#e4d4dc'], [1, '#f4e0d0']]][se];
    s += sky(c, sk, 0, 480) + glow(c, 1000, 420, 380, '#fff0b8', 0.8) + CI(1000, 420, 52, '#fffae0', OP(0.9)) + cloud(c, 380, 150, 1.5, '#fff0e0', 0.5) + cloud(c, 1280, 110, 1.2, '#ffe0d0', 0.45) + streaks(c, 330, '#fff', 0.3, 4);
    var hl = seasonHill(se);
    /* far scenery group (reflected) */
    var far = peaks(c, 470, 120, se === 3 ? '#b4bed4' : '#8ea6c0', se === 3 ? '#dce2ee' : '#d2dcdc', { n: 6, r: rngf(5) }) + mist(c, 450, 40, '#fff', 0.45);
    far += hall(c, { cx: 1180, gy: 478, w: 260, tier: 2, far: true, glaze: '#c89a34', farWall: '#8a2e24', snow: se === 3 }) + pine(c, 1040, 484, 110, { pads: 3 }) + pine(c, 1320, 486, 140, { pads: 4 });
    far += ridge(c, 490, 40, se === 3 ? '#a8b4cc' : '#6f9a7a', se === 3 ? '#d6deec' : '#b8d0b8', { step: 100 });
    s += far;
    /* lake */
    s += water(c, 478, 900, se === 3 ? '#cdd6e8' : '#a8c4cc', se === 3 ? '#9aa8c4' : '#3e6a78', { glints: true, nr: 36, gcol: '#fff0d0' });
    s += reflect(c, 'lakefar', far, 478, se === 3 ? 0.3 : 0.45, 4);
    if (se === 3) s += RC(0, 478, W, 422, LG(c, [[0, '#fff', 0.5], [1, '#dfe8f8', 0.3]])) + ST('M0 560L420 600L700 570M900 540L1200 600L1600 560M200 700L600 760L1000 720L1500 780M700 570L760 640M1200 600L1260 700', '#fff', 1.6, OP(0.55)) + PA('M160 640q120 -30 260 -6t-20 60q-120 20 -240 -54z', '#fff', OP(0.5)) + PA('M1100 760q140 -40 300 -4t-10 70q-160 20 -290 -66z', '#fff', OP(0.5));
    s += EL(1000, 560, 60, 130, RG(c, [[0, '#fff2c0', 0.7], [1, '#fff2c0', 0]]), BL(c, 3));
    s += LN(1000, 480, 1000, 780, '#fff0b0', 38, OP(0.1) + ' ' + BL(c, 14));
    /* pavilion on a platform at left, reaching into the lake */
    s += RC(110, 560, 520, 30, LG(c, [[0, '#d8d0bc'], [1, '#6a6454']])) + RC(100, 552, 540, 10, '#e6dfcc');
    s += pavilion(c, 330, 558, 380, { glaze: '#d09a30', see: '#f8d8a0', night: false });
    s += RC(110, 590, 520, 46, LG(c, [[0, '#000', 0.35], [1, '#000', 0]])) ;
    /* zig-zag bridge from right */
    var bp = 'M1560 660L1300 640L1110 650L930 626L700 600';
    s += ST(bp, '#6a5a4a', 24, 'stroke-linejoin="miter"') + ST(bp, '#cfc6b0', 18) + ST(bp, '#a8201c', 3, 'transform="translate(0 -10)"');
    for (i = 0; i < 6; i++) { var bx = 1520 - i * 160; s += RC(bx, 646 - (i % 2) * 20 - i * 6, 6, 28, '#8a1c16'); }
    /* shores: willows and rocks, lotus */
    s += GR(willow(c, 90, 800, 520, { n: 30 }), RO(c, 4, '.04')) + GR(willow(c, 1540, 760, 440, { n: 26 }), RO(c, 4, '.04'));
    s += rock(c, 260, 868, 220, 140, { col: '#7a7e90', r: rngf(8), holes: 0 }) + rock(c, 1380, 860, 200, 120, { col: '#7a7e90', r: rngf(9), holes: 0 });
    s += lotus(c, 520, 1260, 700, 840, se === 1 ? 20 : 12, { r: rngf(6) });
    s += EL(800, 760, 360, 34, 'none', 'stroke="#fff" stroke-width="1" ' + OP(0.25));
    s += mist(c, 480, 36, '#ffe8d0', 0.4) + (se === 2 ? geese(c, 640, 190, 7, '#4a3a4a') : birds(c, 5, 300, 1200, 120, 300, '#3a3a4a'));
    s += seasonAir(c, { n: 30, y1: 740 });
    s += endcap(c, { v: 0.4, f: 0.32 });
    return s;
  };

  /* ---------- Cold Palace: ruined, overgrown, moonlit ---------- */
  SCENES.cold_palace = function (c) {
    var se = c.se, s = '', i, r = rngf(66);
    var skyS = sky(c, [[0, '#080c1a'], [0.5, '#18223c'], [1, '#34405e']]), rdS = ridge(c, 500, 80, '#121a32', '#222a46', { step: 150 }) + mist(c, 500, 40, '#5a6490', 0.3);
    s += skyS + stars(c, 70, 330, 0.8);
    s += moon(c, 360, 170, 46, '#e4ecf6') + cloud(c, 460, 190, 1.4, '#3a4468', 0.5) + streaks(c, 280, '#5a6490', 0.2, 4);
    s += rdS;
    /* ruined wall with a collapsed gap and rubble */
    var wl = se === 3 ? '#4a3a40' : '#58302e';
    s += wall(c, -10, 1610, 470, 230, { red: wl, glaze: '#5a5648', snow: se === 3, det: 0 });
    for (i = 0; i < 16; i++) { var px = r() * 1500, py = 480 + r() * 190; s += PA('M' + f1(px) + ' ' + f1(py) + 'l' + f1(30 + r() * 50) + ' ' + f1((r() - 0.5) * 12) + 'l' + f1((r() - 0.5) * 20) + ' ' + f1(20 + r() * 30) + 'l' + f1(-40 - r() * 30) + ' ' + f1((r() - 0.5) * 8) + 'z', '#8a7a6a', OP(0.3)); }
    var gapD = 'M1040 420L1060 500L1100 480L1090 540L1140 560L1120 620L1170 650L1180 700L1340 700L1330 640L1290 600L1310 540L1270 500L1290 420Z', gcid = CP(c, gapD);
    s += '<g transform="translate(160 0)"><g clip-path="url(#' + gcid + ')"><g transform="translate(-160 0)">' + skyS + rdS + '</g>' + RC(1000, 560, 400, 160, LG(c, [[0, '#0c1222', 0], [1, '#0c1222', 0.7]])) + '</g>' + ST(gapD, '#a88a72', 2.2, OP(0.5)) + '</g>';
    for (i = 0; i < 18; i++) { var rx = 1220 + r() * 280, ry = 640 + r() * 70; s += PA('M' + f1(rx) + ' ' + f1(ry) + 'l' + f1(14 + r() * 26) + ' ' + f1(-6 - r() * 10) + 'l' + f1(10 + r() * 14) + ' ' + f1(8 + r() * 8) + 'l' + f1(-20 - r() * 12) + ' ' + f1(6) + 'z', i % 3 ? '#6a5e56' : '#7a3a34', OP(0.95)); }
    /* hall: faded, tilted, with holes in the roof and dead vines */
    s += '<g transform="translate(150 0) rotate(-1.1 640 640)">' + hall(c, { cx: 640, gy: 660, w: 640, tier: 1, glaze: '#5c5c50', red: '#5a302e', night: true, lit: 0.0, snow: se === 3, rh: 0.2, det: 2, glass: '#141a2a', glass2: '#0c101c' });
    s += PA('M520 452l16 -20l14 10l16 -16l10 22l-14 8l6 16l-22 -6l-12 12z', '#0a0f1e', OP(0.92)) + ST('M526 448l30 -8M530 460l40 -10', '#4a3424', 2.2, OP(0.8)) + PA('M706 420l20 -12l8 14l18 -8l-4 24l-18 6l-10 -10z', '#0a0f1e', OP(0.92)) + ST('M710 418l30 -4', '#4a3424', 2, OP(0.8));
    s += PA('M830 468q30 -6 46 22q-26 6 -50 -4z', '#0a0f1e', OP(0.9));
    s += PA('M360 564q60 -40 120 -10t140 -20t160 10t130 -10l30 30h-600z', se === 3 ? '#e8eef8' : '#3a4a30', OP(0.55));
    var vn = '', ic = '';
    for (i = 0; i < 24; i++) { var vx = 332 + i * 28 + r() * 10; vn += 'M' + Math.round(vx) + ' 497q' + Math.round((r() - 0.5) * 12) + ' ' + Math.round(14 + r() * 20) + ' ' + Math.round((r() - 0.5) * 14) + ' ' + Math.round(30 + r() * 50); ic += 'M' + Math.round(vx) + ' 497v' + Math.round(10 + r() * 24); }
    if (se === 3) s += ST(ic, '#e8f0ff', 3, 'stroke-linecap="round" ' + OP(0.85)); else s += ST(vn, se === 2 ? '#8a7a3a' : se === 1 ? '#3f7a3a' : '#4a6a34', 3, 'stroke-linecap="round" stroke-dasharray="1 5" ' + OP(0.9)) + ST(vn, se === 2 ? '#6a5a2a' : '#2a4a28', 1.4, OP(0.85));
    s += glowE(c, 640, 600, 80, 56, '#ffb04a', 0.3) + RC(620, 570, 40, 50, '#ffc060', OP(0.4)) + RC(620, 570, 40, 50, latPat(c, 0.45, '#10141e'));
    s += ST('M500 560L560 620M520 600L580 560M720 560l50 60M740 610l50 -50', '#10141e', 3, OP(0.85));
    s += '</g>';
    /* ground: overgrown */
    s += RC(0, 660, W, 240, LG(c, [[0, se === 3 ? '#9aa8c4' : '#26342f'], [1, se === 3 ? '#6a7898' : '#121a1a']]));
    s += PA('M460 660H820L1100 900H300Z', '#2e3446', OP(0.7)) + cobbles(c, 320, 1080, 680, 890, '#454a5e', 22);
    s += tufts(c, 660, 890, 80, { col: se === 2 ? '#8a7a3a' : se === 3 ? '#e8edf6' : '#4a7a40' });
    if (se !== 3) { s += GR(crown(c, 140, 690, 160, 60, se === 2 ? ['#4a3a1a', '#6a5424', '#8a7430'] : ['#16301e', '#24502c', '#3a7a3c'], 9, { r: rngf(5) }), RO(c, 4, '.05')) + GR(crown(c, 1480, 700, 150, 56, se === 2 ? ['#4a3a1a', '#6a5424', '#8a7430'] : ['#16301e', '#24502c', '#3a7a3c'], 8, { r: rngf(6) }), RO(c, 4, '.05')); }
    if (se === 0) for (i = 0; i < 14; i++) s += CI(60 + r() * 1480, 690 + r() * 180, 3, i % 2 ? '#f6d0e0' : '#c8d0e8', OP(0.8));
    /* dead tree on the left of the gap */
    var bt = branches(c, 980, 880, 300, 0.1, 5, { r: rngf(13), spread: 0.62 }), wd = [14, 9, 6, 4, 2.6, 1.6];
    s += '<g transform="translate(330 0)"><g ' + RO(c, 4, '.05') + '>' + PA('M960 890Q976 770 972 650L996 650Q992 770 1008 890Z', '#0e101a');
    for (i = 0; i <= 5; i++) s += SU(c, bt.lv[i], '#0e101a', wd[i], 'stroke-linecap="round"');
    if (se === 3) for (i = 1; i <= 4; i++) s += SU(c, bt.lv[i], '#fff', 3.2, 'stroke-linecap="round" stroke-dasharray="12 24" ' + OP(0.9));
    if (se === 1) for (i = 2; i <= 5; i++) s += SU(c, bt.lv[i], '#2a4a30', 9, 'stroke-linecap="round" stroke-dasharray="0 15" ' + OP(0.7));
    s += '</g>';
    var cr = [[880, 350], [980, 390], [1060, 330]];
    for (i = 0; i < 3; i++) s += PA('M' + cr[i][0] + ' ' + cr[i][1] + 'q10 -14 22 -2q8 -10 22 0q-14 4 -22 12q-12 -6 -22 -10z', '#080a12');
    s += '</g>' + ST('M1386 450q10 -20 24 -4q6 -14 22 0', '#080a12', 6, 'stroke-linecap="round"') + PA('M1390 450l-6 -10l14 4z', '#080a12');
    s += ST('M0 0Q60 70 160 90M0 0Q90 40 170 20M0 0Q40 110 70 170M0 40Q50 50 100 90M30 0Q60 40 120 50', '#c8d0e8', 1, OP(0.35));
    s += mist(c, 700, 80, '#6a78a8', 0.25) + mist(c, 820, 70, '#8a98c8', 0.2);
    s += fall(c, 'dust', 36, { y1: 740, col: '#aab4e0' });
    if (se === 3) s += fall(c, 'snow', 90, { y1: 860 }); else if (se === 2) s += fall(c, 'leaf', 20, { y1: 860, cols: ['#8a5a22', '#6a4a1c', '#a8782a'] });
    s += RC(0, 0, W, H, '#10182e', OP(0.2));
    s += endcap(c, { v: 0.74, f: 0.34 });
    return s;
  };

  /* ---------- hill temple in morning mist ---------- */
  SCENES.temple = function (c) {
    var se = c.se, s = '', i, r = rngf(88);
    var sk = [[[0, '#b8cce4'], [0.5, '#f0dcd8'], [1, '#fff0d8']], [[0, '#8cbce4'], [0.5, '#f2e8d0'], [1, '#fff4d8']], [[0, '#a8b8d4'], [0.5, '#f6dcb8'], [1, '#ffecc8']], [[0, '#b4bccc'], [0.5, '#e0dce0'], [1, '#f2ece4']]][se];
    s += sky(c, sk) + glow(c, 1180, 300, 420, '#fff2cc', 0.85) + CI(1180, 300, 48, '#fffbe8', OP(0.95)) + streaks(c, 200, '#fff', 0.4, 5);
    var m1 = se === 3 ? ['#bcc6dc', '#e4e8f2'] : ['#9ab2c4', '#dfe8e8'], m2 = se === 3 ? ['#a4b0cc', '#d6dcec'] : ['#7c9aae', '#c8d8d8'], m3 = se === 3 ? ['#8e9cba', '#c8d0e4'] : ['#5f8498', '#b4c8c8'];
    s += peaks(c, 470, 220, m1[0], m1[1], { n: 5, r: rngf(3) }) + mist(c, 450, 60, '#fff', 0.5);
    s += peaks(c, 580, 250, m2[0], m2[1], { n: 6, r: rngf(8) }) + mist(c, 560, 70, '#fff', 0.55);
    /* far pagoda on a distant peak */
    var pg = '';
    for (i = 0; i < 5; i++) pg += roof(c, 300, 408 - i * 34, 90 - i * 10, 26, { glaze: '#7a7a82', det: 0, rw: 0.3 }) + RC(300 - (30 - i * 3), 408 - i * 34, (60 - i * 6), 10, '#8a4a3a');
    s += GR(pg, OP(0.55)) + mist(c, 420, 40, '#fff', 0.35);
    s += peaks(c, 700, 260, m3[0], m3[1], { n: 5, r: rngf(2) }) + mist(c, 690, 60, '#fff', 0.45);
    /* temple on terraces: gate hall + main hall */
    s += RC(760, 640, 760, 40, '#8a8678') + RC(760, 636, 760, 8, '#b8b4a2');
    s += hall(c, { cx: 1140, gy: 640, w: 520, tier: 2, glaze: '#6a6c72', red: '#8a2e26', lit: 0.2, snow: se === 3, rh: 0.2, door: 1 });
    s += hall(c, { cx: 1500, gy: 650, w: 260, tier: 1, far: true, glaze: '#6a6c72', farWall: '#7a2a22', snow: se === 3 });
    /* long stair descending to the left */
    for (i = 0; i < 12; i++) { var sy = 680 + i * 18, sx = 790 - i * 46; s += PA('M' + f1(sx) + ' ' + sy + 'h' + f1(560 + i * 26) + 'l' + f1(-22) + ' 18h' + f1(-560 - i * 26 - 22) + 'z', lt('#a8a494', (i % 2) * 0.1), OP(0.95)) + RC(sx - 22, sy + 14, 560 + i * 26, 4, '#5a564a', OP(0.5)); }
    s += PA('M760 680h-30L540 900H900L1000 680z', '#a8a494', OP(0.0));
    /* ancient pines + ginkgo */
    s += GR(pine(c, 560, 700, 520, { pads: 7 }), RO(c, 4, '.04')) + GR(pine(c, 420, 760, 400, { pads: 5 }), RO(c, 4, '.04'));
    s += GR(tree(c, 880, 700, 360, se === 0 ? 'blossom' : 'ginkgo', { r: rngf(14), n: 11 }), RO(c, 5, '.03'));
    s += rock(c, 700, 730, 160, 130, { col: '#8a8e9a', r: rngf(4), holes: 0 });
    /* bell tower + incense smoke */
    s += censer(c, 1000, 690, 1.3, { col: '#6a5a3a' }) + smoke(c, 1000, 640, 200, '#fff', 0.5, { n: 2, w: 8 });
    s += lantern(c, 970, 520, 0.9, { cord: 470, night: false, glow: 0.45, col: '#c8341e' });
    s += RC(0, 760, W, 140, LG(c, [[0, se === 3 ? '#cfd6e6' : '#8a9a78', 0], [1, se === 3 ? '#cfd6e6' : '#6a7a58', 0.9]]));
    s += mist(c, 700, 60, '#fff', 0.35) + mist(c, 800, 50, '#fff', 0.25) + (se === 3 ? '' : geese(c, 380, 200, 7, '#5a6a7a'));
    s += seasonAir(c, { n: 36, y1: 800 });
    s += endcap(c, { v: 0.32, f: 0.24 });
    return s;
  };

  /* ---------- palace gate and the road away ---------- */
  SCENES.gate = function (c) {
    var se = c.se, s = '', i;
    var sk = [[[0, '#6a82c0'], [0.45, '#e8a8a0'], [1, '#ffd49a']], [[0, '#4a76c8'], [0.45, '#f0a870'], [1, '#ffcf80']], [[0, '#5a6aa8'], [0.45, '#e8887a'], [1, '#ffb868']], [[0, '#6a78a8'], [0.45, '#d8a4a8'], [1, '#f2c8b0']]][se];
    s += sky(c, sk, 0, 640) + glow(c, 1280, 470, 520, '#ffe0a0', 0.85) + CI(1280, 470, 60, '#fff2cc', OP(0.95)) + streaks(c, 250, '#ffd0b0', 0.4, 6) + cloud(c, 700, 180, 1.8, '#ffb8a0', 0.4) + cloud(c, 1350, 300, 1.2, '#ffcfae', 0.4);
    s += ridge(c, 560, 90, se === 3 ? '#8a90b0' : '#6a5a86', se === 3 ? '#c4c8dc' : '#d89a88', { step: 150 }) + ridge(c, 600, 60, se === 3 ? '#7a82a4' : '#4f4a72', se === 3 ? '#b4bad0' : '#a87480', { step: 120 });
    s += mist(c, 590, 40, '#ffd8b8', 0.4);
    /* the road: winds toward the distant hills */
    s += RC(0, 600, W, 300, LG(c, [[0, se === 3 ? '#cdd2e4' : '#7a6a58'], [1, se === 3 ? '#9aa4c4' : '#3a3228']]));
    s += PA('M1040 612Q1180 640 1260 626Q1330 612 1420 622L1480 628Q1380 636 1320 650Q1200 668 1160 700Q1020 760 1000 900H300Q460 780 700 720Q900 680 1040 612Z', LG(c, [[0, '#c8b898'], [1, '#8a7a62']], [0, 0, 1, 1]), OP(0.9));
    s += PA('M1040 612Q1180 640 1260 626Q1330 612 1420 622L1480 628Q1380 636 1320 650Q1200 668 1160 700Q1020 760 1000 900H300Q460 780 700 720Q900 680 1040 612Z', se === 3 ? '#fff' : 'none', OP(0.55));
    var ru = 'M1100 720Q900 770 720 900M1000 700Q850 740 560 900M1240 650Q1100 700 1000 800';
    s += ST(ru, '#5a4a38', 3, OP(0.4));
    s += tufts(c, 640, 880, 40, { x0: 0, x1: 1500 });
    /* gate complex (centre-left) */
    s += wall(c, 940, 1610, 604, 120, { red: '#8e2e28', glaze: '#c8962c', snow: se === 3 }) + wall(c, -10, 300, 604, 120, { red: '#8e2e28', glaze: '#c8962c', snow: se === 3 });
    s += '<g transform="translate(300 0)">';
    s += hall(c, { cx: 330, gy: 524, w: 600, tier: 2, glaze: '#d4a230', red: '#8e2e28', lit: 0.3, snow: se === 3, rh: 0.17, door: 0 });
    /* terrace with three arched gateways */
    s += RC(-20, 524, 700, 206, LG(c, [[0, '#a83228'], [1, '#6a1c18']])) + RC(-20, 524, 700, 206, PT(c, 'brk', 0.9, 40, 16, '<path d="M0 .6H40M0 8.6H40M0 8V16M20 0V8" stroke="#000" stroke-width=".8" fill="none" opacity=".15"/>'));
    s += RC(-30, 514, 720, 16, '#d8c8a0') + RC(-30, 718, 720, 20, LG(c, [[0, '#d8d0bc'], [1, '#8a8474']]));
    var ar = [[110, 92, 140], [330, 132, 196], [550, 92, 140]];
    for (i = 0; i < 3; i++) {
      var a = ar[i], ax = a[0] - a[1] / 2, ay = 718 - a[2], dd = 'M' + f1(ax + 6) + ' 718V' + f1(ay + a[1] / 2) + 'Q' + f1(ax + 6) + ' ' + f1(ay + 6) + ' ' + f1(a[0]) + ' ' + f1(ay + 6) + 'Q' + f1(ax + a[1] - 6) + ' ' + f1(ay + 6) + ' ' + f1(ax + a[1] - 6) + ' ' + f1(ay + a[1] / 2) + 'V718Z';
      s += PA('M' + f1(ax) + ' 718V' + f1(ay + a[1] / 2) + 'Q' + f1(ax) + ' ' + f1(ay) + ' ' + f1(a[0]) + ' ' + f1(ay) + 'Q' + f1(ax + a[1]) + ' ' + f1(ay) + ' ' + f1(ax + a[1]) + ' ' + f1(ay + a[1] / 2) + 'V718Z', '#1a0a08');
      s += PA(dd, LG(c, [[0, '#a02820'], [1, '#6a1410']])) + PA(dd, studPat(c, a[1] / 240), OP(0.85)) + LN(a[0], ay + 6, a[0], 718, '#3a0a08', 3);
    }
    s += PA('M330 718V516Q268 516 262 590V718Z', '#0e0606') + glowE(c, 330, 690, 56, 110, '#ffb060', 0.5);
    for (i = 0; i < 3; i++) s += lantern(c, 110 + i * 220, 534, 0.9, { night: true, drop: 8, glow: 0.8 });
    s += '</g>';
    s += ST('M1200 604V424', '#3a2a20', 5) + PA('M1200 428h70l-14 26l14 26h-70z', '#c8261c');
    /* lone willow by the road + traveller */
    s += GR(willow(c, 1500, 800, 440, { n: 28 }), RO(c, 4, '.04'));
    s += PA('M1130 730q-4 -22 4 -34t14 0q8 12 4 34z', '#1a1220') + CI(1140, 686, 7, '#1a1220') + PA('M1128 732h28l-4 -4z', '#0a0810') + ST('M1150 690l16 -4', '#1a1220', 3);
    s += mist(c, 610, 36, '#ffd8b8', 0.4) + (se === 2 ? geese(c, 760, 230, 9, '#4a2a4a') : birds(c, 4, 400, 1000, 140, 320, '#4a2a4a'));
    s += seasonAir(c, { n: 36, y1: 800 });
    s += RC(0, 0, W, H, '#3a1a3a', OP(0.06));
    s += endcap(c, { v: 0.46, f: 0.3 });
    return s;
  };

  /* a flaming torch on a stand */
  function torch(c, x, y, s_, o) {
    o = o || {};
    return glow(c, x, y - 120 * s_, 200 * s_, '#ff8a2a', 0.55 * (o.g == null ? 1 : o.g)) + RC(x - 3 * s_, y - 110 * s_, 6 * s_, 110 * s_, '#2a1a10') + RC(x - 14 * s_, y - 8 * s_, 28 * s_, 8 * s_, '#2a1a10') + PA('M' + f1(x - 12 * s_) + ' ' + f1(y - 110 * s_) + 'h' + f1(24 * s_) + 'l' + f1(-4 * s_) + ' ' + f1(-18 * s_) + 'h' + f1(-16 * s_) + 'z', '#3a2a1a') + PA('M' + f1(x - 12 * s_) + ' ' + f1(y - 126 * s_) + 'Q' + f1(x - 14 * s_) + ' ' + f1(y - 160 * s_) + ' ' + f1(x - 2 * s_) + ' ' + f1(y - 190 * s_) + 'Q' + f1(x + 2 * s_) + ' ' + f1(y - 160 * s_) + ' ' + f1(x + 14 * s_) + ' ' + f1(y - 172 * s_) + 'Q' + f1(x + 18 * s_) + ' ' + f1(y - 144 * s_) + ' ' + f1(x + 12 * s_) + ' ' + f1(y - 126 * s_) + 'Z', LG(c, [[0, '#fff0a0'], [0.5, '#ff9a2a'], [1, '#d83a14']]), OP(0.95));
  }

  /* ---------- Interrogation hall ---------- */
  SCENES.prison = function (c) {
    var se = c.se, s = '', i, R = room(c, { vx: 800, vy: 384, sb: 0.46, Xw: 860, Yf: 520, Yc: -400 }), b = R.backRect();
    s += R.back(LG(c, [[0, '#302a26'], [1, '#1a1512']]));
    var brick = PT(c, 'stone', 0.9, 48, 24, '<path d="M0 .6H48M0 12.6H48M0 12V24M24 0V12M12 12V24" stroke="#000" stroke-width="1.4" fill="none" opacity=".5"/><rect x="2" y="2" width="20" height="9" fill="#fff" opacity=".05"/><rect x="26" y="14" width="20" height="9" fill="#fff" opacity=".06"/>');
    s += R.wallL(LG(c, [[0, '#564c44'], [1, '#26201c']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#26201c'], [1, '#564c44']], [0, 0, 1, 0]));
    s += R.wallL(brick, OP(0.5)) + R.wallR(brick, OP(0.5)) + RC(b.x, b.y, b.w, b.h, brick, OP(0.6));
    s += R.floor(LG(c, [[0, '#120f0c'], [0.6, '#322c26'], [1, '#52483e']])) + R.floorGrid('#0a0806', 0.5, 10, 6, 0) + R.ceil(LG(c, [[0, '#0a0806'], [1, '#2a221a']]));
    for (i = 0; i < 3; i++) s += R.beam(0.1 + i * 0.36, 40, LG(c, [[0, '#33220f'], [1, '#150c06']]));
    /* back: magistrate's dais, wave screen, plaque */
    var cx = 800;
    s += RC(cx - 250, b.y + 10, 500, 200, '#1a1410') + RC(cx - 240, b.y + 20, 480, 180, LG(c, [[0, '#3a3a52'], [1, '#22223a']]));
    var wv = ''; for (i = 0; i < 6; i++) wv += 'M' + (cx - 230) + ' ' + (b.y + 150 + i * 8) + 'q20 -26 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0';
    s += ST(wv, '#7a8ab0', 2.4, OP(0.5)) + PA('M' + (cx - 40) + ' ' + (b.y + 150) + 'l40 -100l40 100z', '#8a2a2a', OP(0.7)) + CI(cx, b.y + 60, 22, '#c8402a', OP(0.7));
    s += RC(cx - 150, b.y - 40, 300, 42, '#12100e') + RC(cx - 144, b.y - 34, 288, 30, 'none', 'stroke="#b8963c" stroke-width="3"') + ST('M' + (cx - 100) + ' ' + (b.y - 14) + 'h60M' + (cx - 70) + ' ' + (b.y - 26) + 'v26M' + (cx - 10) + ' ' + (b.y - 24) + 'q20 -6 40 0M' + (cx + 10) + ' ' + (b.y - 24) + 'v24M' + (cx + 60) + ' ' + (b.y - 24) + 'h40v22h-40z', '#b8963c', 3.4, 'stroke-linecap="round" ' + OP(0.85));
    s += dais(c, R, 0.8, 0.95, 400, [30, 60], ['#3a1612', '#1c0a08', '#8a6a30']);
    var tb = R.P(0, R.Yf - 60, 0.93);
    s += RC(cx - 70, tb[1] - 130, 140, 130, LG(c, [[0, '#3a1810'], [1, '#1c0a06']])) + RC(cx - 58, tb[1] - 118, 116, 80, '#5a1a14') + RC(cx - 200, tb[1] - 46, 400, 14, '#5a2418') + RC(cx - 200, tb[1] - 32, 400, 32, LG(c, [[0, '#8a1c18'], [1, '#4a0c0a']])) + RC(cx - 200, tb[1] - 46, 400, 3, '#b8963c', OP(0.7));
    s += RC(cx - 40, tb[1] - 62, 70, 14, '#1a1210') + RC(cx + 40, tb[1] - 64, 6, 16, '#8a1c18') + RC(cx - 80, tb[1] - 60, 24, 12, '#6a1410');
    /* left wall: rack of canes and paddles */
    s += R.quad([[-R.Xw, -120, 0.1], [-R.Xw, -100, 0.1], [-R.Xw, -100, 0.62], [-R.Xw, -120, 0.62]], '#4a3220') + R.quad([[-R.Xw, 250, 0.1], [-R.Xw, 270, 0.1], [-R.Xw, 270, 0.62], [-R.Xw, 250, 0.62]], '#4a3220');
    for (i = 0; i < 8; i++) { var dd = 0.13 + i * 0.062, q = R.P(-R.Xw, -100, dd), q2 = R.P(-R.Xw, 250, dd - (i % 2) * 0.0), w = Math.max(3, (i % 3 === 0 ? 30 : 16) * R.s(dd)); s += LN(q[0], q[1], q2[0], q2[1] - (i % 2) * 40 * R.s(dd), i % 3 === 0 ? '#8a6a44' : '#6a4a2c', w, 'stroke-linecap="round"') + LN(q[0] + w * 0.25, q[1], q2[0] + w * 0.25, q2[1] - (i % 2) * 40 * R.s(dd), '#c8a070', 1.4, OP(0.35)); }
    /* hanging chains with shackles */
    var chx = [[-150, 0.36], [140, 0.5], [330, 0.3]], ch = '', rg = '';
    for (i = 0; i < chx.length; i++) { var cc = R.obj(chx[i][0], R.Yc, chx[i][1]), n = 8 + i; for (var k = 0; k < n; k++) ch += 'M' + f1(cc.x - 4 * cc.s) + ' ' + f1(cc.y + k * 22 * cc.s) + 'h' + f1(8 * cc.s) + 'v' + f1(16 * cc.s) + 'h' + f1(-8 * cc.s) + 'z'; rg += 'M' + f1(cc.x - 22 * cc.s) + ' ' + f1(cc.y + n * 22 * cc.s + 8 * cc.s) + 'a' + f1(22 * cc.s) + ' ' + f1(14 * cc.s) + ' 0 1 0 ' + f1(44 * cc.s) + ' 0'; }
    s += ST(ch, '#6a665e', 2.6, OP(0.95)) + ST(rg, '#7a766e', 4, OP(0.95));
    /* beating bench (left) and stocks (right) */
    var b1 = R.obj(-330, R.Yf, 0.3), b2 = R.obj(380, R.Yf, 0.36), k1 = b1.s, k2 = b2.s;
    s += EL(b1.x, b1.y + 4, 150 * k1, 12 * k1, '#000', OP(0.4)) + RC(b1.x - 130 * k1, b1.y - 88 * k1, 260 * k1, 22 * k1, LG(c, [[0, '#7a5a3a'], [1, '#4a3220']])) + RC(b1.x - 118 * k1, b1.y - 66 * k1, 18 * k1, 66 * k1, '#3a2614') + RC(b1.x + 100 * k1, b1.y - 66 * k1, 18 * k1, 66 * k1, '#3a2614') + RC(b1.x - 130 * k1, b1.y - 88 * k1, 260 * k1, 3 * k1, '#c8a070', OP(0.5)) + RC(b1.x - 60 * k1, b1.y - 92 * k1, 14 * k1, 10 * k1, '#1a1410') + RC(b1.x + 40 * k1, b1.y - 92 * k1, 14 * k1, 10 * k1, '#1a1410');
    s += EL(b2.x, b2.y + 4, 120 * k2, 10 * k2, '#000', OP(0.4)) + RC(b2.x - 100 * k2, b2.y - 190 * k2, 18 * k2, 190 * k2, '#3a2614') + RC(b2.x + 82 * k2, b2.y - 190 * k2, 18 * k2, 190 * k2, '#3a2614') + RC(b2.x - 100 * k2, b2.y - 190 * k2, 200 * k2, 22 * k2, LG(c, [[0, '#7a5a3a'], [1, '#4a3220']])) + RC(b2.x - 100 * k2, b2.y - 140 * k2, 200 * k2, 22 * k2, LG(c, [[0, '#6a4a2c'], [1, '#3a2614']])) + EL(b2.x - 30 * k2, b2.y - 158 * k2, 13 * k2, 9 * k2, '#0e0a06') + EL(b2.x + 30 * k2, b2.y - 158 * k2, 13 * k2, 9 * k2, '#0e0a06') + RC(b2.x - 100 * k2, b2.y - 190 * k2, 200 * k2, 3 * k2, '#c8a070', OP(0.5));
    /* torches */
    var t1 = R.obj(-330, R.Yf, 0.9), t2 = R.obj(330, R.Yf, 0.9), t3 = R.obj(-560, R.Yf, 0.52), t4 = R.obj(560, R.Yf, 0.52);
    s += torch(c, t1.x, t1.y, t1.s * 2.0) + torch(c, t2.x, t2.y, t2.s * 2.0) + torch(c, t3.x, t3.y, t3.s * 2.0, { g: 0.8 }) + torch(c, t4.x, t4.y, t4.s * 2.0, { g: 0.8 });
    s += glowE(c, 800, 560, 800, 270, '#ff8a3a', 0.15);
    s += EL(560, 800, 130, 18, '#4a5a78', OP(0.28)) + EL(1120, 770, 100, 13, '#4a5a78', OP(0.25)) + glowE(c, 800, 700, 160, 16, '#ff9a4a', 0.2);
    s += POLY([130, 0, 250, 0, 700, 700, 420, 700], LG(c, [[0, '#a8bcf0', 0.34], [1, '#a8bcf0', 0]]), BL(c, 6));
    var bars = ''; for (i = 0; i < 5; i++) bars += 'M' + (150 + i * 24) + ' 50v90';
    s += RC(116, 36, 140, 110, '#06060a') + RC(126, 46, 120, 90, LG(c, [[0, '#b8c8f0'], [1, '#7a8ab8']])) + ST(bars, '#0a0a10', 5);
    s += fall(c, 'ember', 22, { y0: 300, y1: 700 }) + mist(c, 700, 70, '#8a7a6a', 0.14);
    s += RC(0, 0, W, H, '#100a08', OP(0.16));
    s += endcap(c, { v: 0.78, f: 0.4 });
    return s;
  };

  /* ---------- night banquet hall ---------- */
  SCENES.banquet = function (c) {
    var se = c.se, s = '', i, k, R = room(c, { vx: 800, vy: 380, sb: 0.34, Xw: 880, Yf: 540, Yc: -420 }), b = R.backRect();
    s += R.back(LG(c, [[0, '#4a0e12'], [1, '#6a1618']]));
    s += R.wallL(LG(c, [[0, '#7a1a1c'], [1, '#3a0a0e']], [0, 0, 1, 0])) + R.wallR(LG(c, [[0, '#3a0a0e'], [1, '#7a1a1c']], [0, 0, 1, 0]));
    var wd = [0.02, 0.22, 0.42, 0.62, 0.82, 1];
    s += wallWindows(c, R, -1, wd, -300, 60, { c1: '#3a4a8a', c2: '#1c2858', lit: 0.8, fr: '#3a0a08' }) + wallWindows(c, R, 1, wd, -300, 60, { c1: '#3a4a8a', c2: '#1c2858', lit: 0.8, fr: '#3a0a08' });
    s += R.floor(LG(c, [[0, '#2a1208'], [0.55, '#6a3a1c'], [1, '#a0682c']])) + R.floorGrid('#1a0a04', 0.35, 14, 8, 0);
    s += coffers(c, R, [0.08, 0.3, 0.52, 0.74, 0.96], { c0: '#2a0a0c', c1: '#5a1a14', bt: 40 });
    s += R.quad([[-190, R.Yf, -0.2], [190, R.Yf, -0.2], [120, R.Yf, 0.82], [-120, R.Yf, 0.82]], LG(c, [[0, '#6a0c10'], [1, '#a82220']]));
    /* throne dais & screen at the back */
    s += dais(c, R, 0.82, 0.95, 330, [26, 52], ['#9a1a18', '#5a1210', '#e8c060']);
    var tb = R.P(0, R.Yf - 52, 0.94), cx = 800;
    s += RC(cx - 200, tb[1] - 210, 400, 210, LG(c, [[0, '#e8c25a'], [1, '#a8781c']])) + medal(c, cx, tb[1] - 120, 60, '#f4d878', { bg: '#a8201c' }) + RC(cx - 52, tb[1] - 80, 104, 80, LG(c, [[0, '#f0cc66'], [1, '#a8781c']])) + RC(cx - 42, tb[1] - 70, 84, 40, '#b3261e');
    s += glowE(c, cx, tb[1] - 100, 280, 160, '#ffd070', 0.3);
    /* low tables, 2 rows each side, with dishes */
    var rows = [-300, -520, 300, 520];
    for (var rI = 0; rI < 4; rI++) {
      var X = rows[rI], sd = X < 0 ? 1 : -1, x0 = X - 90, x1 = X + 90, th = 86;
      s += R.quad([[x0, R.Yf - th, 0.05], [x1, R.Yf - th, 0.05], [x1, R.Yf - th, 0.74], [x0, R.Yf - th, 0.74]], LG(c, [[0, '#8a1c1c'], [1, '#c83a2a']]));
      var fx = X < 0 ? x1 : x0;
      s += R.quad([[fx, R.Yf - th, 0.05], [fx, R.Yf, 0.05], [fx, R.Yf, 0.74], [fx, R.Yf - th, 0.74]], LG(c, [[0, '#a0221e'], [1, '#5a0e0e']], [0, 0, 1, 0]));
      s += R.quad([[fx, R.Yf - th, 0.05], [fx, R.Yf - th + 8, 0.05], [fx, R.Yf - th + 8, 0.74], [fx, R.Yf - th, 0.74]], '#e8c060', OP(0.8));
      var pl = '', cu = '', fd = '';
      for (k = 0; k < 9; k++) { var dd = 0.09 + k * 0.073, p = R.P(X - 36, R.Yf - th, dd), p2 = R.P(X + 36, R.Yf - th, dd), q = R.s(dd); pl += 'M' + f1(p[0] - 14 * q) + ' ' + f1(p[1]) + 'a' + f1(14 * q) + ' ' + f1(4.4 * q) + ' 0 1 0 ' + f1(28 * q) + ' 0a' + f1(14 * q) + ' ' + f1(4.4 * q) + ' 0 1 0 ' + f1(-28 * q) + ' 0'; fd += 'M' + f1(p[0] - 8 * q) + ' ' + f1(p[1] - 1) + 'a' + f1(8 * q) + ' ' + f1(2.6 * q) + ' 0 1 0 ' + f1(16 * q) + ' 0a' + f1(8 * q) + ' ' + f1(2.6 * q) + ' 0 1 0 ' + f1(-16 * q) + ' 0'; cu += 'M' + f1(p2[0]) + ' ' + f1(p2[1] - 3 * q) + 'h.1'; }
      s += PA(pl, '#f4ecd8') + PA(fd, k % 2 ? '#c8602a' : '#7a9a3a', OP(0.85)) + ST(cu, '#e8c060', 6, 'stroke-linecap="round"');
    }
    /* red lantern ceiling rows */
    var lrows = [-520, -200, 200, 520];
    for (var lr = 0; lr < 4; lr++) for (i = 0; i < 8; i++) { var o = R.obj(lrows[lr], R.Yc + 30, 0.05 + i * 0.12 + (lr % 2) * 0.05); s += lantern(c, o.x, o.y, o.s * 1.7, { night: true, cord: 0, glow: 0.7 }); }
    /* pillars */
    var pg = colGrad(c, '#b3261e'), pd = [0.1, 0.34, 0.58, 0.82];
    for (i = 3; i >= 0; i--) s += R.pillar(-700, pd[i], 84, pg, { baseCol: '#e8c060', baseCol2: '#b88a2a', capCol: '#e8c060' }) + R.pillar(700, pd[i], 84, pg, { baseCol: '#e8c060', baseCol2: '#b88a2a', capCol: '#e8c060' });
    s += glowE(c, 800, 600, 900, 280, '#ff9a3a', 0.2);
    /* bokeh sparkles */
    var bk = c.r2, bo = '';
    for (i = 0; i < 28; i++) bo += glow(c, bk() * W, 120 + bk() * 520, 8 + bk() * 18, '#ffd890', 0.35);
    s += bo + tintWash(c, 0.3) + fall(c, 'ember', 26, { y0: 100, y1: 600 });
    s += endcap(c, { v: 0.5, f: 0.3 });
    return s;
  };

  /* ======================================================================
     12. public entry
     ====================================================================== */
  function shorten(svg) { /* trim long decimals to keep every scene small */
    return svg.replace(/-?\d+\.\d{3,}/g, function (m) { var v = parseFloat(m); return String(Math.abs(v) < 3 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10); });
  }
  function render(key, opts) {
    opts = opts || {}; key = String(key || '');
    var fn = SCENES[key] || SCENES.small_court, c = newCtx(SCENES[key] ? key : 'small_court', opts);
    var body = fn(c);
    return shorten('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs>' + c.defs.join('') + '</defs>' + body + '</svg>');
  }
  return { render: render, keys: Object.keys(SCENES) };
})();
