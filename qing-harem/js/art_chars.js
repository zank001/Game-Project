/* =============================================================
   art_chars.js — ลิขิตหงส์ · วังหลังต้าชิง
   Guofeng-anime character portraits (pure SVG strings).
   Public API:  portraitSVG(charId, expr, opts)
     opts: { rank:0..9, origin:'noble'|'scholar'|'maid', bust:bool, uid:string }
   Pure, no DOM, no external refs. Every call gets unique ids (counter).
   ============================================================= */
function portraitSVG(charId, expr, opts) { return _artRender(charId, expr, opts); }

var _artRender = (function () {
  'use strict';

  /* ---------------- colour helpers (memoised) ---------------- */
  var _cc = {};
  function h2(n) { n = n < 0 ? 0 : n > 255 ? 255 : Math.round(n); return (n < 16 ? '0' : '') + n.toString(16); }
  function rgb(c) { c = c.charAt(0) === '#' ? c.slice(1) : c; return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function mix(a, b, t) {
    var k = a + b + t; if (_cc[k]) return _cc[k];
    var x = rgb(a), y = rgb(b);
    return (_cc[k] = '#' + h2(x[0] + (y[0] - x[0]) * t) + h2(x[1] + (y[1] - x[1]) * t) + h2(x[2] + (y[2] - x[2]) * t));
  }
  function lt(c, t) { return mix(c, '#ffffff', t); }
  function dk(c, t) { return mix(c, '#000000', t); }
  function n1(v) { return Math.round(v * 10) / 10; }

  var _uidCounter = 0;

  /* tiny svg helpers */
  function pth(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>'; }
  function ln(d, stroke, w, extra) { return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + (extra ? ' ' + extra : '') + '/>'; }
  function cir(x, y, r, fill, extra) { return '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + r + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>'; }
  function ell(x, y, rx, ry, fill, extra) { return '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>'; }
  function mir(d) { // mirror a path about x=200; handles absolute and relative M L C Q H V Z
    return d.replace(/([MLCQZHVmlcqzhv])([^MLCQZHVmlcqzhv]*)/g, function (m, cmd, args) {
      var nums = args.match(/-?\d*\.?\d+/g) || [], rel = cmd === cmd.toLowerCase(), out = [], i;
      if (cmd === 'Z' || cmd === 'z') return cmd;
      if (cmd === 'V' || cmd === 'v') return cmd + nums.join(' ');
      if (cmd === 'H') return cmd + nums.map(function (x) { return n1(400 - x); }).join(' ');
      if (cmd === 'h') return cmd + nums.map(function (x) { return n1(-x); }).join(' ');
      for (i = 0; i + 1 < nums.length; i += 2) out.push(rel ? n1(-nums[i]) : n1(400 - nums[i]), nums[i + 1]);
      return cmd + out.join(' ');
    });
  }
  function G(inner, attr) { return '<g' + (attr ? ' ' + attr : '') + '>' + inner + '</g>'; }
  function both(d, fill, extra) { return pth(d, fill, extra) + pth(mir(d), fill, extra); }
  function bothL(d, stroke, w, extra) { return ln(d, stroke, w, extra) + ln(mir(d), stroke, w, extra); }

  /* shared reusable motifs, referenced with <use> (colour via currentColor) */
  function motifDefs(u) {
    return {
      fl: '<g id="fl' + u + '"><g fill="currentColor">' +
        '<ellipse cy="-8" rx="6" ry="9"/><ellipse cy="-8" rx="6" ry="9" transform="rotate(72)"/><ellipse cy="-8" rx="6" ry="9" transform="rotate(144)"/><ellipse cy="-8" rx="6" ry="9" transform="rotate(216)"/><ellipse cy="-8" rx="6" ry="9" transform="rotate(288)"/></g>' +
        '<g fill="#fff" opacity=".3"><ellipse cx="-2" cy="-10" rx="2.6" ry="5"/><ellipse cx="7" cy="-3" rx="2.4" ry="4.6" transform="rotate(72)"/><ellipse cx="-2" cy="-10" rx="2.6" ry="5" transform="rotate(144)"/></g>' +
        '<g fill="#000" opacity=".16"><path d="M0 0L-5 -13Q0 -17 5 -13Z"/><path d="M0 0L-5 -13Q0 -17 5 -13Z" transform="rotate(144)"/></g>' +
        '<circle r="3.6" fill="#f6c94a" stroke="#b9801c" stroke-width=".8"/><circle cx="-1" cy="-1" r="1.1" fill="#fff6c8"/></g>',
      lf: '<g id="lf' + u + '"><path d="M0 0C6 -7 6 -17 0 -24C-6 -17 -6 -7 0 0Z" fill="currentColor"/><path d="M0 0L0 -20" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/></g>',
      pl: '<g id="pl' + u + '"><circle r="4" fill="url(#pe' + u + ')"/><circle cx="-1.2" cy="-1.3" r="1.1" fill="#fff"/></g>'
    };
  }

  var E = {}; // expression table, filled in part 2
  var CHARS = {}; // character profiles, filled in later parts
  var HAIR = {}, HEAD = {}, BODY = {}; // part registries

  function render(charId, expr, opts) {
    opts = opts || {};
    var rank = Math.max(0, Math.min(9, opts.rank | 0)), origin = opts.origin || 'noble';
    var prof = profileFor(charId, rank, origin);
    var X = E[expr] || E.neutral;
    return build(prof, X, E[expr] ? expr : 'neutral', opts, charId);
  }

  /* ---------------- symmetric path builder ----------------
     segs: right-half cubic segments from (200,startY) going down; returns closed path mirrored on the left. */
  function sym(startY, segs) {
    var d = 'M200 ' + startY, i, j, p0 = [200, startY], list = [], sg;
    for (i = 0; i < segs.length; i++) {
      sg = segs[i].map(n1); d += 'C' + sg.join(' '); list.push({ p: p0, s: sg }); p0 = [sg[4], sg[5]];
    }
    for (i = list.length - 1; i >= 0; i--) {
      var q = list[i];
      d += 'C' + n1(400 - q.s[2]) + ' ' + q.s[3] + ' ' + n1(400 - q.s[0]) + ' ' + q.s[1] + ' ' + n1(400 - q.p[0]) + ' ' + q.p[1];
    }
    return d + 'Z';
  }

  function facePath(f) {
    var fw = f.fw, t = f.top, c = f.chin, cy = f.cy, jw = f.jw;
    return sym(t, [
      [200 + fw * .62, t, 200 + fw, t + 30, 200 + fw, cy],
      [200 + fw, cy + 36, 200 + fw * .86, c - 38, 200 + jw, c - 13],
      [200 + jw * .6, c - 5, 200 + jw * .28, c, 200, c]
    ]);
  }

  /* ---------------- expression table ---------------- */
  E = {
    neutral:   { eye: 'open',  brow: 'n',   mouth: 'soft',   blush: 0 },
    smile:     { eye: 'smile', brow: 'sm',  mouth: 'smile',  blush: .4 },
    sad:       { eye: 'sad',   brow: 'sad', mouth: 'sad',    blush: 0, fx: 'glint' },
    angry:     { eye: 'angry', brow: 'ang', mouth: 'angry',  blush: .15, fx: 'vein' },
    shy:       { eye: 'shy',   brow: 'shy', mouth: 'shy',    blush: 1, fx: 'hatch' },
    surprised: { eye: 'surp',  brow: 'surp', mouth: 'surp',  blush: .1, fx: 'sweat' },
    smirk:     { eye: 'smirk', brow: 'smk', mouth: 'smirk',  blush: .1 },
    cry:       { eye: 'cry',   brow: 'cry', mouth: 'cry',    blush: .75, fx: 'tears' }
  };

  /* eye kinds: iy/oy = inner/outer corner y, u1/u2 = upper-lid control lift, bt = lower-lid depth,
     ir = iris radius, ic = iris centre y, pr = pupil rx, gx/gy = gaze, hl = highlight scale */
  var EYEK = {
    open:  { iy: 4, oy: -3, u1: 17, u2: 20, bt: 9,  ir: 12, ic: 0,  pr: 5.2, hl: 1 },
    smile: { iy: 5, oy: -4, u1: 19, u2: 24, bt: 0, ir: 12, ic: -1, pr: 5.2, hl: 1.1 },
    sad:   { iy: 3, oy: 1,  u1: 16, u2: 7,  bt: 9,  ir: 12, ic: 2.4, pr: 5.4, hl: 1.25, wet: 1 },
    angry: { iy: 5, oy: -7, u1: 5,  u2: 15, bt: 5,  ir: 11, ic: -.5, pr: 4.6, hl: .8, sharp: 1 },
    shy:   { iy: 4, oy: -2, u1: 11, u2: 12, bt: 6,  ir: 12, ic: 3.2, pr: 5.2, hl: 1.1, gx: 5, gy: 1 },
    surp:  { iy: 4, oy: -4, u1: 25, u2: 28, bt: 13, ir: 11, ic: .5, pr: 3.6, hl: .9 },
    smirk: { iy: 4, oy: -4, u1: 10, u2: 14, bt: 5,  ir: 12, ic: -1, pr: 5.2, hl: .9, lowlid: 1 },
    cry:   { iy: 3, oy: 1,  u1: 14, u2: 6,  bt: 9,  ir: 12.5, ic: 2.4, pr: 5.4, hl: 1.4, wet: 2 }
  };

  /* One eye in local coordinates (outer corner toward +x). s = +1 right-eye orientation, -1 mirrored.
     gaze in world direction (+1 = viewer's right). */
  function eyeSVG(c, K, kind, s, clipId, gaze) {
    var P = c.P, ey = P.eye, u = c.u, sz = ey.sz || 1, tilt = ey.tilt || 0;
    var iy = K.iy, oy = K.oy - tilt, ox = 22 * (ey.w || 1), ix = -19 * (ey.w || 1);
    var md = ey.mod || {}, wg = ey.wing == null ? 1 : ey.wing;
    iy += md.iy || 0; oy += md.oy || 0;
    var u1 = Math.max(3, K.u1 * sz + (md.u1 || 0)), u2 = Math.max(3, K.u2 * sz + (md.u2 || 0)), bt = K.bt * (K.bt > 0 ? sz : 1) + (md.bt || 0);
    var lash = ey.lash, o = '';
    var gx = (K.gx || 0) * gaze * s + (c.gx || 0) * s;      // local x (mirrored for left eye)
    var gy = (K.gy || 0);
    var up = 'M' + ix + ' ' + iy + 'C' + (ix + 5) + ' ' + (iy - u1) + ' ' + (ox - 13) + ' ' + (oy - u2) + ' ' + ox + ' ' + oy;
    var lo = 'C' + (ox - 7) + ' ' + (oy + bt * 1.3) + ' ' + (ix + 11) + ' ' + (iy + bt * 1.35) + ' ' + ix + ' ' + iy;
    var scl = up + lo + 'Z';
    var irC = ey.iris, irD = dk(irC, .45);
    var irisY = K.ic + gy + (iy + oy) / 2 * .2, r = K.ir * (ey.ir || 1);
    var hs = K.hl;
    // eye-shadow smudge above lid
    if (ey.makeup) {
      o += pth('M' + (ix - 1) + ' ' + (iy - 1) + 'C' + (ix + 5) + ' ' + (iy - u1 - 9) + ' ' + (ox - 12) + ' ' + (oy - u2 - 10) + ' ' + (ox + 4) + ' ' + (oy - 3) +
        'C' + (ox - 10) + ' ' + (oy - u2 - 2) + ' ' + (ix + 6) + ' ' + (iy - u1 - 1) + ' ' + (ix - 1) + ' ' + (iy - 1) + 'Z', ey.shadow, 'opacity="' + (ey.makeup * .55) + '"');
    }
    // sclera + iris
    o += pth(scl, '#fdf8f3');
    var cl = 'ec' + u + (s > 0 ? 'r' : 'l');
    c.defs.push('<clipPath id="' + cl + '"><path d="' + scl + '"/></clipPath>');
    var ic = '<circle cx="' + n1(gx) + '" cy="' + n1(irisY) + '" r="' + r + '" fill="url(#ir' + u + ')"/>' +
      '<circle cx="' + n1(gx) + '" cy="' + n1(irisY) + '" r="' + r + '" fill="none" stroke="' + dk(irC, .55) + '" stroke-width="1.6" opacity=".7"/>' +
      ell(gx, irisY + 0.5, K.pr, K.pr * 1.18, '#150d12') +
      '<path d="M' + n1(gx - r + 2) + ' ' + n1(irisY + 3) + 'Q' + n1(gx) + ' ' + n1(irisY + r + 3) + ' ' + n1(gx + r - 2) + ' ' + n1(irisY + 3) + 'Q' + n1(gx) + ' ' + n1(irisY + r * .45) + ' ' + n1(gx - r + 2) + ' ' + n1(irisY + 3) + 'Z" fill="' + lt(irC, .5) + '" opacity=".5"/>' +
      cir(gx - 4.2 * s, irisY - 4.6, 4.3 * hs, '#fff') +
      cir(gx + 4.6 * s, irisY + 4.8, 2 * hs, '#fff', 'opacity=".92"') +
      cir(gx + 1 * s, irisY - 8, 1.2 * hs, '#fff', 'opacity=".7"');
    o += '<g clip-path="url(#' + cl + ')">' + ic;
    // top shadow of lid on eyeball
    o += pth('M' + (ix - 2) + ' ' + (iy - 2) + 'C' + (ix + 5) + ' ' + (iy - u1 - 2) + ' ' + (ox - 13) + ' ' + (oy - u2 - 2) + ' ' + (ox + 2) + ' ' + (oy - 2) + 'L' + (ox + 2) + ' ' + (oy + 6) + 'C' + (ox - 12) + ' ' + (oy - u2 + 6) + ' ' + (ix + 5) + ' ' + (iy - u1 + 8) + ' ' + (ix - 2) + ' ' + (iy + 4) + 'Z', dk(c.skin.deep, .4), 'opacity=".28"');
    if (K.wet) o += pth('M' + ix + ' ' + (iy + 3) + 'C' + (ix + 11) + ' ' + (iy + bt * 1.05) + ' ' + (ox - 7) + ' ' + (oy + bt * .9) + ' ' + (ox + 1) + ' ' + (oy + 2) + 'L' + (ox + 1) + ' ' + (oy + 14) + 'L' + ix + ' ' + (iy + 14) + 'Z', '#d7ecff', 'opacity="' + (K.wet > 1 ? .75 : .5) + '"');
    o += '</g>';
    if (K.lid) { // smiling lower-lid push: skin crescent under the eye
      o += ln('M' + (ix + 5) + ' ' + (iy + 7) + 'Q' + (ox / 2 - 1) + ' ' + (iy + 3) + ' ' + (ox - 3) + ' ' + (oy + 5), dk(c.skin.deep, .1), 1.1, 'opacity=".4"');
    }
    // lower lid line
    o += ln('M' + ox + ' ' + oy + lo, K.wet ? '#c8566a' : dk(c.skin.deep, .2), K.wet ? 1.2 : 1, 'opacity="' + (K.wet ? .5 : .45) + '"');
    // upper lash line (thick), crease and outer flick
    o += ln(up, lash, K.sharp ? 3.4 : 3.1);
    o += pth('M' + (ox - 12) + ' ' + (oy - u2 * .62 - 2) + 'C' + (ox - 5) + ' ' + (oy - u2 * .45 - 3) + ' ' + (ox + 4) + ' ' + (oy - 2) + ' ' + (ox + 1) + ' ' + (oy + .5) +
      'C' + (ox + 8 * wg) + ' ' + (oy - 2) + ' ' + (ox + 12 * wg) + ' ' + (oy - (7 + tilt * .6) * wg) + ' ' + (ox + 13 * wg) + ' ' + (oy - (9 + tilt * .8) * wg) +
      'C' + (ox + 11 * wg) + ' ' + (oy - 4) + ' ' + (ox + 7) + ' ' + (oy + 1.5) + ' ' + (ox - 1) + ' ' + (oy + 1.8) + 'Z', lash);
    o += ln('M' + (ix + 2) + ' ' + (iy - 5.5) + 'C' + (ix + 8) + ' ' + (iy - u1 - 4) + ' ' + (ox - 12) + ' ' + (oy - u2 - 4) + ' ' + (ox - 2) + ' ' + (oy - 5.5), dk(c.skin.deep, .25), 1, 'opacity=".5"');
    if (ey.lower) o += ln('M' + (ix + 4) + ' ' + (iy + 4) + 'l-3 2 M' + (ix + 11) + ' ' + (iy + bt + 3) + 'l-2 3', lash, 1, 'opacity=".5"');
    return o;
  }

  function arcEye(c, s) {  // happy closed eye ^
    var P = c.P, lash = P.eye.lash, w = P.eye.w || 1;
    return ln('M' + (-19 * w) + ' 5C' + (-8 * w) + ' -13 ' + (9 * w) + ' -14 ' + (22 * w) + ' 2', lash, 3.6) +
      pth('M' + (14 * w) + ' -8C' + (20 * w) + ' -8 ' + (26 * w) + ' -12 ' + (29 * w) + ' -16C' + (27 * w) + ' -8 ' + (23 * w) + ' -2 ' + (21 * w) + ' 2Z', lash) +
      ln('M' + (-9 * w) + ' 11Q' + (2 * w) + ' 14 ' + (13 * w) + ' 10', dk(c.skin.deep, .1), 1.2, 'opacity=".4"');
  }

  function eyesSVG(c, X) {
    var P = c.P, K = EYEK[X.eye], ex = P.eye.ex, ey = P.eye.y, o = '';
    var kind = X.eye, gaze = X.gaze || 0;
    var happy = (kind === 'smile' && P.happyEyes);
    function one(s) {
      var tx = 200 + s * ex;
      var inner = happy ? arcEye(c, s) : (kind === 'smirk' && s > 0) ? eyeSVG(c, { iy: 4, oy: -4, u1: 13, u2: 17, bt: 6, ir: 12, ic: 0, pr: 5.2, hl: 1 }, kind, s, '', 1) : eyeSVG(c, K, kind, s, '', gaze || 1);
      var sx = (P.eye.sx || 1.1) * s, sy = P.eye.sy || 1.26;
      return '<g transform="translate(' + tx + ' ' + ey + ') scale(' + n1(sx * 100) / 100 + ' ' + sy + ')">' + inner + '</g>';
    }
    o = one(-1) + one(1);
    return o;
  }

  /* ---------------- brows ----------------
     a = inner-end dy, b = outer-end dy, h = arch height, up = whole lift */
  var BROWK = {
    n:   { a: 2,  b: 3,  h: 6, up: 0 },
    sm:  { a: 1,  b: 2,  h: 7, up: -2 },
    sad: { a: -5, b: 5,  h: 3, up: 2 },
    ang: { a: 7,  b: -3, h: 2, up: 3 },
    shy: { a: -2, b: 4,  h: 5, up: 2 },
    surp:{ a: -4, b: -3, h: 9, up: -9 },
    smk: { a: 2,  b: 3,  h: 6, up: 0 },
    cry: { a: -8, b: 6,  h: 3, up: 3 }
  };
  function browSVG(c, K, s, extraUp) {
    var B = c.P.brow, ex = c.P.eye.ex, y = B.y + K.up + (extraUp || 0);
    var ixp = ex - B.len * .5, oxp = ex + B.len * .5;
    var ia = y + K.a * (B.mob || 1), ob = y + K.b * (B.mob || 1);
    var cyy = (ia + ob) / 2 - 2 * K.h * (B.arch || 1), cx = (ixp + oxp) / 2 + 2;
    var t = B.t;
    var d = 'M' + n1(200 + s * ixp) + ' ' + n1(ia) + 'Q' + n1(200 + s * cx) + ' ' + n1(cyy - t) + ' ' + n1(200 + s * oxp) + ' ' + n1(ob) +
      'Q' + n1(200 + s * cx) + ' ' + n1(cyy + t * .5) + ' ' + n1(200 + s * ixp) + ' ' + n1(ia) + 'Z';
    return pth(d, B.col, 'stroke="' + B.col + '" stroke-width="1.1" stroke-linejoin="round"');
  }
  function brows(c, X) {
    var K = BROWK[X.brow];
    var upR = X.brow === 'smk' ? -7 : 0;       // smirk: right (viewer) brow arched
    var k2 = X.brow === 'smk' ? { a: 5, b: 1, h: 5, up: 3 } : K;
    var kR = X.brow === 'smk' ? { a: 0, b: 2, h: 10, up: 0 } : K;
    return browSVG(c, k2, -1, 0) + browSVG(c, kR, 1, upR);
  }

  /* ---------------- mouth (centre 200, y = P.mouth.y) ---------------- */
  function mouthSVG(c, X) {
    var P = c.P, m = P.mouth, y = m.y, k = X.mouth, lip = m.col, lp = dk(lip, .38), hi = lt(lip, .55), s = m.w || 1, o = '';
    var up = lt(dk(lip, .12), .0);
    function T(inner) { return '<g transform="translate(200 ' + y + ') scale(' + s + ')">' + inner + '</g>'; }
    // neutral pose variants (character flavour)
    if (k === 'soft' && m.neutral === 'smile') k = 'softsmile';
    if (k === 'soft' && m.neutral === 'pout') k = 'pout';
    if (k === 'soft' && m.neutral === 'flat') k = 'flat';
    if (k === 'soft' && m.neutral === 'tight') k = 'tight';
    if (k === 'soft' && m.neutral === 'smirk') k = 'smirkLite';
    if (k === 'angry' && !m.grit) k = 'tight';
    if (k === 'smile' && m.open) k = 'grin';
    switch (k) {
      case 'soft':
        o = pth('M-11 0Q-5 -3.6 0 -1.8Q5 -3.6 11 0Q0 2 -11 0Z', dk(lip, .12)) + pth('M-9.5 .6Q0 8.2 9.5 .6Q0 3.4 -9.5 .6Z', lip) +
          pth('M-3.5 3.6Q0 5.2 3.5 3.6Q0 4.6 -3.5 3.6Z', hi, 'opacity=".8"') + ln('M-11 0Q0 2.4 11 0', lp, 1.1);
        break;
      case 'softsmile':
        o = pth('M-12 -1.2Q-5 -4.4 0 -2.6Q5 -4.4 12 -1.2Q0 2.4 -12 -1.2Z', dk(lip, .12)) + pth('M-10 .2Q0 9 10 .2Q0 4.4 -10 .2Z', lip) +
          pth('M-3.5 4Q0 5.8 3.5 4Q0 5 -3.5 4Z', hi, 'opacity=".8"') + ln('M-12.5 -1.6Q0 4 12.5 -1.6', lp, 1.1) + ln('M-13.5 -2.4Q-12.5 -.4 -11 -.2M13.5 -2.4Q12.5 -.4 11 -.2', lp, .9, 'opacity=".5"');
        break;
      case 'pout':
        o = pth('M-10 .4Q-4 -4.4 0 -2.6Q4 -4.4 10 .4Q0 2.2 -10 .4Z', dk(lip, .1)) + pth('M-9 .8Q0 10.5 9 .8Q0 4 -9 .8Z', lip) +
          pth('M-3.5 4.8Q0 6.8 3.5 4.8Q0 5.6 -3.5 4.8Z', hi, 'opacity=".9"') + ln('M-10 .4Q0 2.6 10 .4', lp, 1);
        break;
      case 'flat':
        o = pth('M-11 -.4Q-5 -3 0 -1.6Q5 -3 11 -.4Q0 1 -11 -.4Z', dk(lip, .15)) + pth('M-10 .2Q0 5.6 10 .2Q0 1.6 -10 .2Z', lip) + ln('M-11.5 -.2Q0 1.4 11.5 -.2', lp, 1.2);
        break;
      case 'smile':
        o = pth('M-13 -3Q-6 -2.4 0 -2.6Q6 -2.4 13 -3Q0 3.6 -13 -3Z', dk(lip, .1)) + pth('M-10.5 -1.4Q0 11 10.5 -1.4Q0 3.6 -10.5 -1.4Z', lip) +
          pth('M-4 5.4Q0 7.6 4 5.4Q0 6.6 -4 5.4Z', hi, 'opacity=".85"') + ln('M-14 -3.4Q-12 1.4 -9 1.2M14 -3.4Q12 1.4 9 1.2', lp, 1, 'opacity=".55"') + ln('M-13.5 -3.2Q0 4.6 13.5 -3.2', lp, 1.2);
        break;
      case 'grin':
        o = pth('M-13 -3Q0 2.4 13 -3Q11 9 0 11Q-11 9 -13 -3Z', '#7c2733') + pth('M-11.5 -2.2Q0 3 11.5 -2.2L10.4 3Q0 6.6 -10.4 3Z', '#fffaf4') +
          pth('M-6 9Q0 5 6 9Q0 12 -6 9Z', '#e8808c') + ln('M-13 -3Q0 2.6 13 -3', lp, 1.3) + ln('M-14 -3.6Q-12.5 1 -9.5 1.6M14 -3.6Q12.5 1 9.5 1.6', lp, 1, 'opacity=".5"');
        break;
      case 'sad':
        o = pth('M-9 2.4Q0 -3.4 9 2.4Q0 -.2 -9 2.4Z', dk(lip, .1)) + pth('M-7 3Q0 8.6 7 3Q0 5 -7 3Z', lip, 'opacity=".95"') + ln('M-10 3Q0 -3 10 3', lp, 1.3) +
          ln('M-12 5Q-11 3.4 -10 3M12 5Q11 3.4 10 3', lp, .9, 'opacity=".5"');
        break;
      case 'tight':
        o = ln('M-11.5 1.6Q-6 -1.6 0 -.6Q6 -1.6 11.5 1.6', lp, 2.3) + pth('M-8 2.6Q0 6 8 2.6Q0 4 -8 2.6Z', lip, 'opacity=".8"') + ln('M-13 3.4Q-12 2.4 -11.5 1.6M13 3.4Q12 2.4 11.5 1.6', lp, .9, 'opacity=".45"');
        break;
      case 'angry': // gritted teeth
        o = pth('M-12 -2.4Q0 -5.6 12 -2.4L10.6 5.4Q0 8.4 -10.6 5.4Z', '#6e1f2c') + pth('M-11 -1.8Q0 -4.6 11 -1.8L10.2 2.4Q0 .6 -10.2 2.4Z', '#fffaf2') +
          pth('M-10 3.4Q0 5.6 10 3.4L9.6 5Q0 7.4 -9.6 5Z', '#fffaf2') + ln('M-4 -3.6L-4 2M0 -4L0 2M4 -3.6L4 2M-4 3.2L-4 6M0 3.6L0 6.6M4 3.2L4 6', '#c9b9b0', .8, 'opacity=".7"') +
          ln('M-12 -2.4Q0 -5.8 12 -2.4M-10.6 5.4Q0 8.6 10.6 5.4', lp, 1.3);
        break;
      case 'shy':
        o = ln('M-6.5 .6Q-3.2 4 0 1.2Q3.2 4 6.5 .6', lp, 1.5) + pth('M-3 3.6Q0 5.4 3 3.6Q0 4.6 -3 3.6Z', lip, 'opacity=".8"');
        break;
      case 'surp':
        o = ell(0, 3.4, 4.8, 6.4, '#74232f') + ell(0, 5.6, 3, 3.2, '#d9707e') + ln('M-4.8 3.4Q-4.8 -3 0 -3Q4.8 -3 4.8 3.4Q4.8 10 0 10Q-4.8 10 -4.8 3.4Z', lp, 1.3);
        break;
      case 'smirk':
        o = pth('M-10 3Q-2 3.4 6 0Q10 -1.6 13.5 -4.4Q10 2 6 4.2Q-2 6.4 -10 3Z', dk(lip, .12)) + pth('M-8 3.8Q0 8 8 3.6Q0 5.2 -8 3.8Z', lip, 'opacity=".9"') +
          ln('M-10.5 3.2Q-2 4.2 6 .4Q10 -1.4 13.5 -4.4', lp, 1.4) + ln('M14.2 -3.2Q15.2 -1.2 13 .8', lp, 1, 'opacity=".6"');
        break;
      case 'smirkLite':
        o = pth('M-10 1.6Q-2 2 6 -.4Q10 -1.6 12 -3.2Q9 1.4 6 2.6Q-2 4.2 -10 1.6Z', dk(lip, .12)) + pth('M-8 2.2Q0 6 8 2.2Q0 3.6 -8 2.2Z', lip, 'opacity=".9"') + ln('M-10.5 1.6Q-2 2.4 6 -.4Q9 -1.4 12 -3.2', lp, 1.3);
        break;
      case 'cry':
        o = pth('M-10 6.5Q-6 -2.8 0 -2.8Q6 -2.8 10 6.5Q5 3.4 0 4.6Q-5 3.4 -10 6.5Z', '#6e1f2c') + pth('M-5 5Q0 1.4 5 5Q0 3.6 -5 5Z', '#e8808c') +
          ln('M-10 6.5Q-6 -2.8 0 -2.8Q6 -2.8 10 6.5', lp, 1.4) + ln('M-12 8.4Q-11 7.4 -10 6.5M12 8.4Q11 7.4 10 6.5', lp, .9, 'opacity=".5"');
        break;
    }
    return T(o);
  }

  /* ---------------- nose & cheeks & face detail ---------------- */
  function noseSVG(c) {
    var P = c.P, y = P.nose.y, sh = dk(c.skin.deep, .1), w = P.nose.w || 1;
    return ln('M' + (200 - 2.6 * w) + ' ' + (y - 6) + 'Q' + (200 - 4.4 * w) + ' ' + (y + 1) + ' ' + (200 - 1.4 * w) + ' ' + (y + 3.6) + 'Q200 ' + (y + 5) + ' ' + (200 + 2.6 * w) + ' ' + (y + 3.2), sh, 1.5, 'opacity=".62"') +
      ell(200 + .6, y + 2, 2.4 * w, 1.6, lt(c.skin.base, .5), 'opacity=".5"') +
      ln('M' + (200 + 4 * w) + ' ' + (y + 1) + 'Q' + (200 + 4.8 * w) + ' ' + (y + 3.4) + ' ' + (200 + 3 * w) + ' ' + (y + 4.4), sh, 1, 'opacity=".4"');
  }

  function cheeksSVG(c, X) {
    var P = c.P, b = (P.blush0 || 0) + X.blush * (P.blushK || .6), o = '', y = P.cheekY, bx = P.eye.ex + 4;
    if (b > .02) {
      var op = Math.min(1, b);
      o += '<ellipse cx="' + (200 - bx) + '" cy="' + y + '" rx="' + (P.cheekRx || 21) + '" ry="11" fill="url(#ch' + c.u + ')" opacity="' + n1(op) + '"/>' +
        '<ellipse cx="' + (200 + bx) + '" cy="' + y + '" rx="' + (P.cheekRx || 21) + '" ry="11" fill="url(#ch' + c.u + ')" opacity="' + n1(op) + '"/>';
    }
    if (X.fx === 'hatch') {
      var h = '';
      for (var i = 0; i < 3; i++) h += 'M' + (-12 + i * 9) + ' ' + (-3) + 'l-3.5 10';
      o += ln(h, '#e0607a', 1.6, 'opacity=".55" transform="translate(' + (200 - bx - 2) + ' ' + (y - 2) + ')"') + ln(h, '#e0607a', 1.6, 'opacity=".55" transform="translate(' + (200 + bx - 2) + ' ' + (y - 2) + ')"');
    }
    if (X.fx === 'vein') { // slight anger flush on nose bridge/cheeks
      o += ell(200, P.nose.y - 4, 18, 6, '#e0605a', 'opacity=".12"');
    }
    return o;
  }

  /* expression extras drawn over the face (anger vein, sweat, tears, glint) */
  function fxSVG(c, X) {
    var P = c.P, o = '', fw = P.face.fw, ex = P.eye.ex, ey = P.eye.y;
    if (X.fx === 'vein') {
      var vx = 200 + fw - 16, vy = ey - 36;
      o += '<g transform="translate(' + vx + ' ' + vy + ')" fill="none" stroke="#d2323c" stroke-width="2.6" stroke-linecap="round">' +
        '<path d="M-8 -9Q-3 -9 -3 -3M3 -9Q8 -9 8 -3M-8 9Q-3 9 -3 3M3 9Q8 9 8 3"/></g>';
    }
    if (X.fx === 'sweat') {
      var sx = 200 + fw - 12, sy = P.face.top + 40;
      o += '<g transform="translate(' + sx + ' ' + sy + ')"><path d="M0 -9C6 -1 7 4 3 8C-1 11 -7 8 -5 2C-4 -1 -1 -4 0 -9Z" fill="#cfe9ff" stroke="#6fa8d8" stroke-width="1.1"/><path d="M-1.6 2Q-3 5 -1 6.4" stroke="#fff" stroke-width="1.3" fill="none" opacity=".9"/></g>';
    }
    if (X.fx === 'glint') {
      o += pth('M' + (200 - ex - 15) + ' ' + (ey + 10) + 'Q' + (200 - ex - 18) + ' ' + (ey + 15) + ' ' + (200 - ex - 14) + ' ' + (ey + 17) + 'Q' + (200 - ex - 11) + ' ' + (ey + 14) + ' ' + (200 - ex - 15) + ' ' + (ey + 10) + 'Z', '#d7ecff', 'opacity=".85"');
    }
    if (X.fx === 'tears') {
      var tear = function (sx) {
        var x0 = 200 + sx * (ex + 4), y0 = ey + 14;
        return '<path d="M' + x0 + ' ' + y0 + 'C' + (x0 + sx * 5) + ' ' + (y0 + 14) + ' ' + (x0 + sx * 5) + ' ' + (y0 + 30) + ' ' + (x0 + sx * 1) + ' ' + (y0 + 46) + 'C' + (x0 - sx * 2) + ' ' + (y0 + 30) + ' ' + (x0 - sx * 2) + ' ' + (y0 + 14) + ' ' + x0 + ' ' + y0 + 'Z" fill="#d9ecff" opacity=".55"/>' +
          '<path d="M' + (x0 + sx * 1.4) + ' ' + (y0 + 4) + 'Q' + (x0 + sx * 2.4) + ' ' + (y0 + 22) + ' ' + (x0 + sx * .8) + ' ' + (y0 + 38) + '" stroke="#fff" stroke-width="1.3" fill="none" opacity=".8" stroke-linecap="round"/>' +
          '<path d="M' + (x0 + sx * 1) + ' ' + (y0 + 47) + 'C' + (x0 + sx * 5) + ' ' + (y0 + 53) + ' ' + (x0 + sx * 5) + ' ' + (y0 + 59) + ' ' + (x0 + sx * 1) + ' ' + (y0 + 60) + 'C' + (x0 - sx * 3) + ' ' + (y0 + 59) + ' ' + (x0 - sx * 3) + ' ' + (y0 + 53) + ' ' + (x0 + sx * 1) + ' ' + (y0 + 47) + 'Z" fill="#d4e9ff" stroke="#86b7e2" stroke-width=".9"/>';
      };
      o += tear(-1) + tear(1);
    }
    return o;
  }

  /* =================== HAIR =================== */
  function hairHiGrad(c, hi) {
    c.defs.push('<linearGradient id="hh' + c.u + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + hi + '" stop-opacity="0"/><stop offset=".5" stop-color="' + hi + '" stop-opacity=".9"/><stop offset="1" stop-color="' + hi + '" stop-opacity="0"/></linearGradient>');
  }
  var HAIRFILL = function (c) { return 'url(#hr' + c.u + ')'; };

  /* skull + optional long back hair — drawn BEFORE the face (behind it) */
  function hairBack(c, o) {
    var f = c.P.face, fw = f.fw, top = o.top || 56, wd = fw + (o.wd || 12), col = HAIRFILL(c), s = '';
    if (o.long) { // long hair falling behind shoulders
      var ly = o.long, lw = wd + (o.lw || 14);
      s += pth('M' + (200 - wd + 6) + ' 150C' + (200 - lw - 10) + ' 200 ' + (200 - lw - 6) + ' ' + (ly - 40) + ' ' + (200 - lw + 12) + ' ' + ly + 'Q200 ' + (ly + 24) + ' ' + (200 + lw - 12) + ' ' + ly + 'C' + (200 + lw + 6) + ' ' + (ly - 40) + ' ' + (200 + lw + 10) + ' 200 ' + (200 + wd - 6) + ' 150Z', col);
      s += ln('M' + (200 - lw + 8) + ' 230C' + (200 - lw - 2) + ' 290 ' + (200 - lw + 4) + ' ' + (ly - 30) + ' ' + (200 - lw + 18) + ' ' + (ly - 4), lt(c.P.hair.col, .3), 2, 'opacity=".35"') + ln('M' + (200 + lw - 8) + ' 230C' + (200 + lw + 2) + ' 290 ' + (200 + lw - 4) + ' ' + (ly - 30) + ' ' + (200 + lw - 18) + ' ' + (ly - 4), lt(c.P.hair.col, .3), 2, 'opacity=".35"');
    }
    s += pth('M' + (200 - wd) + ' ' + (f.cy + 40) + 'C' + (200 - wd - 8) + ' ' + (top + 60) + ' ' + (200 - wd + 20) + ' ' + top + ' 200 ' + top + 'C' + (200 + wd - 20) + ' ' + top + ' ' + (200 + wd + 8) + ' ' + (top + 60) + ' ' + (200 + wd) + ' ' + (f.cy + 40) + 'Z', col);
    return s;
  }

  /* front hair with hairline (美人尖 dip) — drawn AFTER the face.
     o: {top, peak (dip depth), bangs:0..1, sw (side-sweep px), lockLen, lockW, gray} */
  function hairFront(c, o) {
    var f = c.P.face, fw = f.fw, top = o.top || 56, col = HAIRFILL(c), H = c.P.hair, s = '';
    var hl = o.hl || 104;                   // hairline height at forehead centre
    var tipY = o.tipY || 196;               // bottom of the side locks beside the face
    var peak = o.peak == null ? 6 : o.peak; // widow's peak dip
    var inner = [
      [200 + fw - 12, tipY - 22, 200 + fw - 8, 150, 200 + 34, hl + 4],
      [200 + 22, hl - 6, 200 + 9, hl - 8, 200, hl + peak]
    ];
    var segs = [
      [200 + fw * .6, top - 2, 200 + fw + 12, top + 34, 200 + fw + 9, 150],
      [200 + fw + 7, 176, 200 + fw + 2, tipY - 6, 200 + fw - 8, tipY]
    ].concat(inner);
    var shape = sym(top - 2, segs);
    // forehead shadow cast by the fringe
    s += '<path d="' + shape + '" transform="translate(0 6)" fill="' + c.skin.deep + '" opacity=".3" clip-path="url(#fc' + c.u + ')"/>';
    s += pth(shape, col);
    // sheen + strand lines
    hairHiGrad(c, H.hi);
    s += '<path d="M' + (200 - fw + 6) + ' ' + (top + 40) + 'Q200 ' + (top - 12) + ' ' + (200 + fw - 6) + ' ' + (top + 40) + 'Q200 ' + (top + 8) + ' ' + (200 - fw + 6) + ' ' + (top + 40) + 'Z" fill="url(#hh' + c.u + ')" opacity=".75"/>';
    var sc = H.hi, sd = dk(H.col, .4);
    s += bothL('M' + (200 + 30) + ' ' + (hl + 2) + 'C' + (200 + 52) + ' ' + (hl - 14) + ' ' + (200 + fw + 2) + ' ' + (top + 70) + ' ' + (200 + fw + 4) + ' ' + (tipY - 40), sc, 1.4, 'opacity=".55"');
    s += bothL('M' + (200 + 12) + ' ' + (hl) + 'C' + (200 + 36) + ' ' + (hl - 30) + ' ' + (200 + 58) + ' ' + (top + 24) + ' ' + (200 + fw - 2) + ' ' + (top + 62), sc, 1.1, 'opacity=".4"');
    s += bothL('M' + (200 + 38) + ' ' + (hl + 10) + 'C' + (200 + 58) + ' ' + (hl + 4) + ' ' + (200 + fw - 2) + ' ' + (hl + 40) + ' ' + (200 + fw - 4) + ' ' + (tipY - 6), sd, 1.2, 'opacity=".5"');
    // glossy ribbons on the side curtains + crescent above the brow
    s += both('M' + (200 + fw + 4) + ' 128C' + (200 + fw + 8) + ' 150 ' + (200 + fw + 6) + ' 176 ' + (200 + fw - 2) + ' ' + (tipY - 2) + 'C' + (200 + fw) + ' 176 ' + (200 + fw - 1) + ' 150 ' + (200 + fw - 5) + ' 134Z', H.hi, 'opacity=".26"');
    s += pth('M' + (200 - 44) + ' ' + (hl - 2) + 'Q200 ' + (hl - 16) + ' ' + (200 + 44) + ' ' + (hl - 2) + 'Q200 ' + (hl - 9) + ' ' + (200 - 44) + ' ' + (hl - 2) + 'Z', H.hi, 'opacity=".32"');
    if (o.gray) { // silver strands
      var g = '#d9d6e0';
      s += bothL('M' + (200 + 14) + ' ' + (hl) + 'C' + (200 + 40) + ' ' + (hl - 26) + ' ' + (200 + 60) + ' ' + (top + 28) + ' ' + (200 + fw) + ' ' + (top + 70), g, 1.6, 'opacity="' + (.35 + o.gray * .5) + '"') +
        bothL('M' + (200 + 26) + ' ' + (hl + 4) + 'C' + (200 + 50) + ' ' + (hl - 10) + ' ' + (200 + fw - 4) + ' ' + (hl + 10) + ' ' + (200 + fw + 4) + ' ' + (hl + 56), g, 1.4, 'opacity="' + (.3 + o.gray * .5) + '"');
    }
    // long side locks (鬓发)
    if (o.lockLen) {
      var ll = o.lockLen, lw = o.lockW || 8;
      var lk = 'M' + (200 + fw - 6) + ' ' + (tipY - 40) + 'C' + (200 + fw + 4) + ' ' + (tipY) + ' ' + (200 + fw + 4) + ' ' + (tipY + ll * .6) + ' ' + (200 + fw - 4 + (o.lockOut || 0)) + ' ' + (tipY + ll) +
        'C' + (200 + fw - 2) + ' ' + (tipY + ll * .55) + ' ' + (200 + fw - 4 - lw) + ' ' + (tipY + 16) + ' ' + (200 + fw - 10 - lw) + ' ' + (tipY - 30) + 'Z';
      s += both(lk, col) + bothL('M' + (200 + fw - 3) + ' ' + (tipY - 10) + 'Q' + (200 + fw + 2) + ' ' + (tipY + ll * .5) + ' ' + (200 + fw - 4) + ' ' + (tipY + ll * .9), sc, 1.2, 'opacity=".45"');
    }
    return s;
  }

  /* short wispy bangs (空气刘海) for young girls */
  function bangs(c, o) {
    var f = c.P.face, fw = f.fw, col = HAIRFILL(c), y = o.y || 126, H = c.P.hair;
    var d = 'M' + (200 - fw + 6) + ' ' + (y - 40) + 'C' + (200 - fw + 6) + ' ' + (y + 6) + ' ' + (200 - 46) + ' ' + (y + 12) + ' ' + (200 - 34) + ' ' + (y + 22) + 'C' + (200 - 30) + ' ' + (y + 8) + ' ' + (200 - 18) + ' ' + (y + 16) + ' ' + (200 - 10) + ' ' + (y + 26) + 'C' + (200 - 6) + ' ' + (y + 12) + ' ' + (200 + 4) + ' ' + (y + 14) + ' ' + (200 + 8) + ' ' + (y + 24) +
      'C' + (200 + 14) + ' ' + (y + 10) + ' ' + (200 + 28) + ' ' + (y + 14) + ' ' + (200 + 34) + ' ' + (y + 22) + 'C' + (200 + 38) + ' ' + (y + 10) + ' ' + (200 + 50) + ' ' + (y + 8) + ' ' + (200 + fw - 6) + ' ' + (y - 40) + 'Z';
    return '<path d="' + d + '" transform="translate(0 5)" fill="' + c.skin.deep + '" opacity=".25" clip-path="url(#fc' + c.u + ')"/>' + pth(d, col) +
      ln('M' + (200 - 34) + ' ' + (y + 18) + 'Q' + (200 - 40) + ' ' + (y - 10) + ' ' + (200 - 56) + ' ' + (y - 30) + 'M' + (200 - 10) + ' ' + (y + 22) + 'Q' + (200 - 12) + ' ' + (y - 8) + ' ' + (200 - 20) + ' ' + (y - 34) + 'M' + (200 + 8) + ' ' + (y + 20) + 'Q' + (200 + 12) + ' ' + (y - 8) + ' ' + (200 + 22) + ' ' + (y - 34) + 'M' + (200 + 34) + ' ' + (y + 18) + 'Q' + (200 + 40) + ' ' + (y - 10) + ' ' + (200 + 56) + ' ' + (y - 30), lt(H.col, .3), 1.1, 'opacity=".4"');
  }

  /* =================== ORNAMENT LIBRARY =================== */
  var GOLD = '#e2b24a', GOLDD = '#a87420';
  function fl(c, x, y, s, col, rot) { return '<use href="#fl' + c.u + '" transform="translate(' + n1(x) + ' ' + n1(y) + ')' + (rot ? ' rotate(' + rot + ')' : '') + ' scale(' + s + ')" color="' + col + '"/>'; }
  function lf(c, x, y, s, rot, col) { return '<use href="#lf' + c.u + '" transform="translate(' + n1(x) + ' ' + n1(y) + ') rotate(' + rot + ') scale(' + s + ')" color="' + col + '"/>'; }
  function pr(c, x, y, s) {
    if (s && s !== 1) return '<use href="#pl' + c.u + '" transform="translate(' + Math.round(x) + ' ' + Math.round(y) + ') scale(' + s + ')"/>';
    return '<use href="#pl' + c.u + '" x="' + Math.round(x) + '" y="' + Math.round(y) + '"/>';
  }
  function qpt(x0, y0, bx, by, x1, y1, t) { var m = 1 - t; return [m * m * x0 + 2 * m * t * bx + t * t * x1, m * m * y0 + 2 * m * t * by + t * t * y1]; }
  /* string of pearls along a quadratic curve (plus the gold thread) */
  function pstring(c, x0, y0, bx, by, x1, y1, n, s, noThread) {
    var o = noThread ? '' : ln('M' + n1(x0) + ' ' + n1(y0) + 'Q' + n1(bx) + ' ' + n1(by) + ' ' + n1(x1) + ' ' + n1(y1), GOLD, .9, 'opacity=".9"');
    for (var i = 0; i <= n; i++) { var p = qpt(x0, y0, bx, by, x1, y1, i / n); o += pr(c, p[0], p[1], s || 1); }
    return o;
  }
  /* tassel: several pearl strings hanging from an anchor, ending in a silk tuft */
  function tassel(c, x, y, len, strands, spread, silk, sway) {
    var o = '', i, sw = sway || 0;
    for (i = 0; i < strands; i++) {
      var k = strands === 1 ? 0 : (i / (strands - 1) - .5) * 2, l = len * (1 - Math.abs(k) * .16);
      var ex = x + k * spread + sw, ey = y + l;
      o += pstring(c, x, y, x + k * spread * .3 + sw * .2, y + l * .55, ex, ey, Math.round(l / (strands > 2 ? 15 : 13)), .8);
      o += pth('M' + n1(ex) + ' ' + n1(ey + 2) + 'l-3 12l3 -3l3 3z', silk || '#c2456b', 'opacity=".95"');
    }
    return o;
  }
  /* golden phoenix (faces +x, ~110 wide); goes into defs once, referenced via <use> */
  function phoenixDef(c) {
    if (c.phDef) return; c.phDef = 1;
    var g = 'url(#gd' + c.u + ')', st = 'stroke="#9a6414" stroke-width=".9" stroke-linejoin="round"';
    c.defs.push('<g id="ph' + c.u + '">' +
      '<path d="M-26 14C-16 14 -8 8 -4 -2C-1 -9 3 -15 9 -21C13 -25 20 -26 23 -22C25 -19 23 -16 20 -15C16 -13 13 -7 13 -1C13 9 5 18 -9 22C-17 24 -24 22 -26 14Z" fill="' + g + '" ' + st + '/>' +
      '<path d="M13 -25C10 -33 14 -39 20 -41C17 -35 19 -31 20 -26ZM18 -24C19 -31 25 -35 30 -34C26 -31 25 -28 24 -23Z" fill="' + g + '" ' + st + '/>' +
      '<path d="M23 -21L35 -18L23 -15.5Z" fill="#f6d46a" ' + st + '/><circle cx="18" cy="-20" r="1.7" fill="#7a1f2a"/>' +
      '<path d="M-6 -2C-16 -12 -30 -32 -33 -50C-20 -44 -9 -32 -1 -17Z" fill="' + g + '" ' + st + '/><path d="M-12 6C-28 -2 -42 -20 -47 -38C-32 -35 -20 -23 -9 -10Z" fill="' + g + '" ' + st + '/>' +
      '<path d="M-24 16C-42 20 -58 34 -68 58C-54 46 -42 40 -26 28Z" fill="' + g + '" ' + st + '/><path d="M-20 20C-32 32 -38 50 -38 74C-30 58 -24 44 -16 28Z" fill="' + g + '" ' + st + '/>' +
      '<path d="M-6 6C-12 8 -16 12 -18 18M-4 -4C-14 -14 -22 -26 -26 -38" stroke="#9a6414" stroke-width=".8" fill="none" opacity=".7"/>' +
      '<circle cx="2" cy="6" r="3.2" fill="#d83a52" stroke="#9a6414" stroke-width=".8"/></g>');
  }
  function phoenix(c, x, y, s, flip) { return '<use href="#ph' + c.u + '" transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')"/>'; }

  /* gold hairpin (bu-yao): stem + a small head, optional pearl drop */
  function hairpin(c, x0, y0, x1, y1, head, drop) {
    var o = ln('M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1, GOLDD, 3.2) + ln('M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1, '#f5d672', 1.6);
    if (head === 'jade') o += ell(x1, y1, 5, 8, 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width=".8" transform="rotate(' + n1(Math.atan2(y1 - y0, x1 - x0) * 57.3 - 90) + ' ' + x1 + ' ' + y1 + ')"');
    else if (head === 'pearl') o += pr(c, x1, y1, 1.5);
    else if (head === 'ruby') o += cir(x1, y1, 4.6, '#d83a52', 'stroke="' + GOLDD + '" stroke-width="1.4"') + cir(x1 - 1.2, y1 - 1.4, 1.3, '#fff', 'opacity=".8"');
    if (drop) o += pstring(c, x1, y1, x1 + drop[0] * .3, y1 + drop[1] * .6, x1 + drop[0], y1 + drop[1], Math.round(drop[1] / 10), .75);
    return o;
  }
  function butterfly(c, x, y, s, col, rot) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')"><path d="M0 0C-8 -14 -22 -12 -20 -2C-18 6 -8 4 0 0ZM0 0C8 -14 22 -12 20 -2C18 6 8 4 0 0ZM0 1C-6 8 -12 14 -8 17C-4 18 0 10 0 1ZM0 1C6 8 12 14 8 17C4 18 0 10 0 1Z" fill="' + col + '" stroke="' + GOLDD + '" stroke-width=".9"/><path d="M0 -3L0 7" stroke="' + GOLDD + '" stroke-width="1.6"/><circle cx="-10" cy="-4" r="2" fill="#fff" opacity=".7"/><circle cx="10" cy="-4" r="2" fill="#fff" opacity=".7"/></g>';
  }
  /* kidney-shaped jade ruyi / plain jade plaque */
  function jadePlate(c, x, y, w, h, rot) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (rot || 0) + ')"><path d="M' + (-w) + ' 0C' + (-w) + ' ' + (-h) + ' ' + w + ' ' + (-h) + ' ' + w + ' 0C' + w + ' ' + h + ' ' + (-w) + ' ' + h + ' ' + (-w) + ' 0Z" fill="url(#jd' + c.u + ')" stroke="#2f7a60" stroke-width=".9"/><path d="M' + (-w * .5) + ' ' + (-h * .3) + 'Q0 ' + (-h * .7) + ' ' + (w * .5) + ' ' + (-h * .3) + '" fill="none" stroke="#fff" stroke-width="1.2" opacity=".6"/></g>';
  }

  /* =================== QITOU / DALACHI BOARD =================== */
  /* o: {yt, h, wt, wb, col, trim, sat (satin gradient id suffix)} */
  function boardPath(o) {
    var yt = o.yt, h = o.h, wt = o.wt, wb = o.wb, yb = yt + h, rs = o.rise || 0;
    return sym(yt + 3, [
      [200 + wt * .45, yt + 2, 200 + wt * .82, yt, 200 + wt - 5, yt - rs],
      [200 + wt + 3, yt - rs + 4, 200 + wt + 1, yt + h * .5, 200 + wb + 6, yb - 5],
      [200 + wb * .6, yb + 5, 200 + wb * .3, yb + 8, 200, yb + 7]
    ]);
  }
  function qitouBoard(c, o) {
    var u = c.u, col = o.col, d = boardPath(o), yt = o.yt, yb = yt + o.h, s = '', rs = o.rise || 0;
    c.defs.push('<linearGradient id="bd' + u + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + lt(col, .26) + '"/><stop offset=".3" stop-color="' + col + '"/><stop offset="1" stop-color="' + dk(col, .45) + '"/></linearGradient>');
    s += '<path d="' + d + '" transform="translate(0 4)" fill="#000" opacity=".25"/>';
    s += pth(d, 'url(#bd' + u + ')', 'stroke="' + dk(col, .6) + '" stroke-width="1.3" stroke-linejoin="round"');
    if (o.emb) {
      var pid = patternDef(c, 'cloud', o.emb, col);
      s += pth(d, 'url(#' + pid + ')', 'opacity=".55"');
    }
    // lit top rim (gives the board thickness)
    s += ln('M' + (200 - o.wt + 7) + ' ' + (yt + 1 - rs) + 'Q200 ' + (yt + 6) + ' ' + (200 + o.wt - 7) + ' ' + (yt + 1 - rs), lt(col, .5), 2.6, 'opacity=".55"');
    // satin sheen
    s += pth('M' + (200 - o.wt * .7) + ' ' + (yt + 9) + 'Q200 ' + (yt + 14) + ' ' + (200 + o.wt * .7) + ' ' + (yt + 9) + 'L' + (200 + o.wt * .6) + ' ' + (yt + 15) + 'Q200 ' + (yt + 21) + ' ' + (200 - o.wt * .6) + ' ' + (yt + 15) + 'Z', '#fff', 'opacity=".13"');
    // gold band along the lower edge
    var lowE = 'M' + (200 - o.wb - 2) + ' ' + (yb - 4) + 'Q' + (200 - o.wb * .4) + ' ' + (yb + 8) + ' 200 ' + (yb + 7) + 'Q' + (200 + o.wb * .4) + ' ' + (yb + 8) + ' ' + (200 + o.wb + 2) + ' ' + (yb - 4);
    s += ln(lowE, GOLDD, 5) + ln(lowE, GOLD, 3.4) + ln(lowE, '#fff2a8', 1, 'opacity=".8"');
    return s;
  }

  /* =================== COSTUME LIBRARY =================== */
  function patternDef(c, kind, col, bg) {
    c.pn = (c.pn || 0) + 1;
    var id = 'pt' + c.u + kind.charAt(0) + c.pn, u = c.u;
    var t = '';
    if (kind === 'cloud') {
      t = '<pattern id="' + id + '" width="46" height="34" patternUnits="userSpaceOnUse"><g fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linecap="round">' +
        '<path d="M5 20Q5 11 13 11Q17 5 24 9Q31 5 35 11Q43 11 41 20"/><path d="M13 20Q13 16 18 16M33 20Q33 16 28 16"/><path d="M-4 3Q-4 -3 2 -3M42 3Q42 -3 48 -3" /></g><circle cx="23" cy="28" r="1.6" fill="' + col + '"/><circle cx="2" cy="26" r="1.2" fill="' + col + '"/><circle cx="44" cy="26" r="1.2" fill="' + col + '"/></pattern>';
    } else if (kind === 'flower') {
      t = '<pattern id="' + id + '" width="40" height="40" patternUnits="userSpaceOnUse"><g fill="' + col + '"><circle cx="10" cy="10" r="3.2"/><circle cx="10" cy="4" r="3"/><circle cx="16" cy="10" r="3"/><circle cx="10" cy="16" r="3"/><circle cx="4" cy="10" r="3"/>' +
        '<circle cx="30" cy="30" r="3.2"/><circle cx="30" cy="24" r="3"/><circle cx="36" cy="30" r="3"/><circle cx="30" cy="36" r="3"/><circle cx="24" cy="30" r="3"/></g><g fill="' + bg + '"><circle cx="10" cy="10" r="1.6"/><circle cx="30" cy="30" r="1.6"/></g>' +
        '<path d="M22 14Q30 8 34 14Q28 18 22 14ZM6 30Q12 24 18 28Q12 34 6 30Z" fill="' + col + '" opacity=".7"/></pattern>';
    } else if (kind === 'wave') {
      t = '<pattern id="' + id + '" width="40" height="22" patternUnits="userSpaceOnUse"><g fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round"><path d="M0 14Q10 2 20 14Q30 26 40 14"/><path d="M0 6Q10 -6 20 6Q30 18 40 6" opacity=".7"/></g></pattern>';
    } else if (kind === 'bamboo') {
      t = '<pattern id="' + id + '" width="44" height="44" patternUnits="userSpaceOnUse"><g fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round"><path d="M10 2L10 40M10 14Q18 8 22 10M10 26Q2 20 -2 22M10 32Q18 26 22 28"/><path d="M34 6L34 44M34 20Q42 14 46 16M34 32Q26 26 22 28"/></g></pattern>';
    } else if (kind === 'dots') {
      t = '<pattern id="' + id + '" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.1" fill="' + col + '"/><circle cx="12" cy="12" r="1.1" fill="' + col + '"/></pattern>';
    } else if (kind === 'lattice') {
      t = '<pattern id="' + id + '" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0L18 18M18 0L0 18" stroke="' + col + '" stroke-width=".8" fill="none"/></pattern>';
    }
    c.defs.push(t);
    return id;
  }

  /* robe base — returns body (behind neck) markup.  o = {col, sh, pat, patCol, trim, hem, lapel, ...} */
  function robeBody(c, o) {
    var u = c.u, sh = o.sh || 112, col = o.col, s = '', nb = o.nb || 280;
    var d = sym(nb, [
      [200 + 38, nb, 200 + sh - 56, nb + 8, 200 + sh - 8, nb + 36],
      [200 + sh + 2, nb + 42, 200 + sh + 8, nb + 62, 200 + sh + 10, nb + 94],
      [200 + sh + 14, nb + 210, 200 + sh + 26, 500, 200 + sh + 34, 600],
      [200 + sh * .5, 600, 200 + sh * .2, 600, 200, 600]
    ]);
    c.defs.push('<linearGradient id="rb' + u + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + dk(col, .36) + '"/><stop offset=".22" stop-color="' + col + '"/><stop offset=".5" stop-color="' + lt(col, .1) + '"/><stop offset=".78" stop-color="' + col + '"/><stop offset="1" stop-color="' + dk(col, .4) + '"/></linearGradient>');
    s += pth(d, 'url(#rb' + u + ')', 'stroke="' + dk(col, .5) + '" stroke-width="1.4"');
    if (o.pat) {
      var pid = patternDef(c, o.pat, o.patCol, col);
      s += pth(d, 'url(#' + pid + ')', 'opacity="' + (o.patOp || .55) + '"');
    }
    // soft folds, chest shadow and shoulder light
    s += ell(200, nb + 28, 52, 16, dk(col, .55), 'opacity=".13"') + both('M' + (200 + 44) + ' ' + (nb + 70) + 'Q' + (200 + 40) + ' 460 ' + (200 + 30) + ' 600', dk(col, .45), 'opacity="0"');
    s += bothL('M' + (200 + 52) + ' ' + (nb + 60) + 'Q' + (200 + 50) + ' 460 ' + (200 + 44) + ' 600', dk(col, .5), 5, 'opacity=".1"') + bothL('M' + (200 + 80) + ' ' + (nb + 70) + 'Q' + (200 + 84) + ' 470 ' + (200 + 90) + ' 600', lt(col, .5), 4, 'opacity=".1"');
    s += ell(200 - sh * .62, nb + 40, 30, 9, '#fff', 'opacity=".1" transform="rotate(14 ' + (200 - sh * .62) + ' ' + (nb + 40) + ')"') + ell(200 + sh * .62, nb + 40, 30, 9, '#fff', 'opacity=".1" transform="rotate(-14 ' + (200 + sh * .62) + ' ' + (nb + 40) + ')"');
    // sleeve fold shading
    s += both('M' + (200 + sh - 6) + ' ' + (nb + 60) + 'Q' + (200 + sh + 6) + ' 440 ' + (200 + sh + 30) + ' 600L' + (200 + sh - 24) + ' 600Q' + (200 + sh - 20) + ' 460 ' + (200 + sh - 24) + ' ' + (nb + 80) + 'Z', dk(col, .25), 'opacity=".3"');
    s += bothL('M' + (200 + sh - 6) + ' ' + (nb + 52) + 'Q' + (200 + sh - 12) + ' 440 ' + (200 + sh - 14) + ' 600', dk(col, .5), 1.3, 'opacity=".5"');
    return s;
  }

  /* sleeve-hem band + sash + lower-body decoration */
  function robeTrims(c, o) {
    var sh = o.sh || 112, s = '', tr = o.trim, t2 = o.trim2 || GOLD, nb = o.nb || 280;
    // lapel curve (大襟) running from collar down the viewer's left
    if (o.lapel) {
      var lp = 'M200 ' + (nb + 16) + 'C170 ' + (nb + 40) + ' ' + (200 - sh + 34) + ' ' + (nb + 70) + ' ' + (200 - sh + 20) + ' 470L' + (200 - sh + 8) + ' 600';
      s += ln(lp, dk(tr, .3), 15, 'opacity=".5" transform="translate(1.5 2)"') + ln(lp, tr, 12) + ln(lp, t2, 1.6, 'transform="translate(-3.4 0)"') + ln(lp, t2, 1.6, 'transform="translate(3.4 0)"');
      // buttons
      for (var i = 0; i < 4; i++) { var p = qpt(200, nb + 16, 150, nb + 70, 200 - sh + 24, 470, .12 + i * .2); s += cir(p[0], p[1], 2.4, t2, 'stroke="' + GOLDD + '" stroke-width=".7"'); }
    }
    // hem bands on the lower sleeves
    if (o.sleeveBand) {
      var sb = o.sleeveBand;
      s += both('M' + (200 + sh + 8) + ' 540L' + (200 + sh + 26) + ' 540L' + (200 + sh + 30) + ' 600L' + (200 + sh + 12) + ' 600Z', sb, 'opacity=".95"');
    }
    return s;
  }

  /* collars */
  function standCollar(c, o) {
    var nw = c.P.neck.w, col = o.col, u = c.u, y = o.y || 262, tr = o.trim || GOLD, s = '';
    var top = 'M' + (200 - nw - 5) + ' ' + y + 'Q200 ' + (y + 15) + ' ' + (200 + nw + 5) + ' ' + y;
    var d = 'M' + (200 - nw - 5) + ' ' + y + 'L' + (200 - nw - 13) + ' ' + (y + 26) + 'Q200 ' + (y + 46) + ' ' + (200 + nw + 13) + ' ' + (y + 26) + 'L' + (200 + nw + 5) + ' ' + y + 'Q200 ' + (y + 15) + ' ' + (200 - nw - 5) + ' ' + y + 'Z';
    s += pth(d, col, 'stroke="' + dk(col, .45) + '" stroke-width="1.2"');
    s += pth(d, 'url(#sh' + u + ')', 'opacity=".5"');
    s += ln(top, dk(col, .3), 1.2, 'opacity=".7"');
    s += ln('M' + (200 - nw - 10) + ' ' + (y + 20) + 'Q200 ' + (y + 40) + ' ' + (200 + nw + 10) + ' ' + (y + 20), tr, 2.6) + ln('M' + (200 - nw - 9) + ' ' + (y + 15) + 'Q200 ' + (y + 33) + ' ' + (200 + nw + 9) + ' ' + (y + 15), tr, 1, 'opacity=".7"');
    // stud button
    s += cir(200 + nw - 4, y + 22, 2.4, tr, 'stroke="' + GOLDD + '" stroke-width=".7"');
    return s;
  }
  /* cross collar (Han y-collar), layered */
  function crossCollar(c, o) {
    var nw = c.P.neck.w, col = o.col, inner = o.inner || '#f7f1e6', y = o.y || 268, tr = o.trim, s = '', u = c.u;
    // inner under-collar peeking
    s += ln('M' + (200 - nw - 2) + ' ' + y + 'Q' + (200 - 6) + ' ' + (y + 30) + ' 200 ' + (y + 46), inner, 7) + ln('M' + (200 + nw + 2) + ' ' + y + 'Q' + (200 + 6) + ' ' + (y + 30) + ' 200 ' + (y + 46), inner, 7);
    // left band (goes under)
    var l = 'M' + (200 - nw - 8) + ' ' + (y - 2) + 'Q' + (200 - 20) + ' ' + (y + 34) + ' ' + (200 + 8) + ' ' + (y + 74);
    var r = 'M' + (200 + nw + 8) + ' ' + (y - 2) + 'Q' + (200 + 30) + ' ' + (y + 40) + ' ' + (200 - 40) + ' ' + (y + 130);
    s += ln(l, dk(col, .35), 13) + ln(l, col, 11) + ln(l, tr, 1.4, 'transform="translate(-3 0)" opacity=".9"');
    s += ln(r, dk(col, .35), 14) + ln(r, col, 12) + ln(r, tr, 1.4, 'transform="translate(3 0)" opacity=".9"');
    return s;
  }
  /* cloud collar / shawl */
  function cloudShawl(c, o) {
    var col = o.col, tr = o.trim, u = c.u, s = '', y0 = o.y || 286;
    var d = sym(y0 - 8, [
      [200 + 44, y0 - 6, 200 + 92, y0 + 4, 200 + 112, y0 + 34],
      [200 + 126, y0 + 50, 200 + 116, y0 + 78, 200 + 96, y0 + 88],
      [200 + 92, y0 + 104, 200 + 72, y0 + 112, 200 + 58, y0 + 106],
      [200 + 50, y0 + 122, 200 + 28, y0 + 124, 200 + 16, y0 + 112],
      [200 + 10, y0 + 118, 200 + 4, y0 + 118, 200, y0 + 112]
    ]);
    s += '<path d="' + d + '" transform="translate(0 4)" fill="#000" opacity=".25"/>';
    s += pth(d, col, 'stroke="' + dk(col, .5) + '" stroke-width="1.3" stroke-linejoin="round"');
    var pid = patternDef(c, 'cloud', tr, col);
    s += pth(d, 'url(#' + pid + ')', 'opacity=".75"');
    // gold scallop edge
    s += ln('M' + (200 + 112) + ' ' + (y0 + 34) + 'C' + (200 + 126) + ' ' + (y0 + 50) + ' ' + (200 + 116) + ' ' + (y0 + 78) + ' ' + (200 + 96) + ' ' + (y0 + 88) + 'C' + (200 + 92) + ' ' + (y0 + 104) + ' ' + (200 + 72) + ' ' + (y0 + 112) + ' ' + (200 + 58) + ' ' + (y0 + 106) + 'C' + (200 + 50) + ' ' + (y0 + 122) + ' ' + (200 + 28) + ' ' + (y0 + 124) + ' ' + (200 + 16) + ' ' + (y0 + 112), tr, 2.4) +
      ln('M' + (200 - 112) + ' ' + (y0 + 34) + 'C' + (200 - 126) + ' ' + (y0 + 50) + ' ' + (200 - 116) + ' ' + (y0 + 78) + ' ' + (200 - 96) + ' ' + (y0 + 88) + 'C' + (200 - 92) + ' ' + (y0 + 104) + ' ' + (200 - 72) + ' ' + (y0 + 112) + ' ' + (200 - 58) + ' ' + (y0 + 106) + 'C' + (200 - 50) + ' ' + (y0 + 122) + ' ' + (200 - 28) + ' ' + (y0 + 124) + ' ' + (200 - 16) + ' ' + (y0 + 112), tr, 2.4);
    // fringe beads at lobe tips
    var tips = [[112, 34], [96, 88], [58, 106], [16, 112]], i;
    for (i = 0; i < tips.length; i++) {
      var tx = tips[i][0], ty = y0 + tips[i][1];
      s += pr(c, 200 + tx, ty + 3, .9) + pr(c, 200 - tx, ty + 3, .9);
      if (i < 3) s += ln('M' + (200 + tx) + ' ' + (ty + 4) + 'l0 9M' + (200 - tx) + ' ' + (ty + 4) + 'l0 9', o.fringe || '#d83a52', 2);
    }
    return s;
  }
  /* court beads (朝珠) — a loop of beads hanging from the collar */
  function courtBeads(c, o) {
    var s = '', n = o.n || 26, col = o.col, x0 = 200 - 30, y0 = 284, depth = o.depth || 150, i, u = c.u, r = o.r || 3.6, R = o.bigR || 5.2, bc = o.bigCol || '#e8b43e';
    c.defs.push('<g id="bs' + u + '"><circle r="' + r + '" fill="' + col + '" stroke="' + dk(col, .55) + '" stroke-width=".7"/><circle cx="' + n1(-r * .3) + '" cy="' + n1(-r * .33) + '" r="1" fill="#fff" opacity=".55"/></g>' +
      '<g id="bg' + u + '"><circle r="' + R + '" fill="' + bc + '" stroke="' + dk(bc, .55) + '" stroke-width=".8"/><circle cx="-1.4" cy="-1.5" r="1.4" fill="#fff" opacity=".6"/></g>');
    var bigs = [0, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n];
    s += ln('M' + x0 + ' ' + y0 + 'Q200 ' + (y0 + depth * 1.5) + ' ' + (400 - x0) + ' ' + y0, dk(col, .5), 1);
    for (i = 0; i <= n; i++) {
      var p = qpt(x0, y0, 200, y0 + depth * 1.5, 400 - x0, y0, i / n);
      s += '<use href="#' + (bigs.indexOf(i) >= 0 ? 'bg' : 'bs') + u + '" x="' + Math.round(p[0]) + '" y="' + Math.round(p[1]) + '"/>';
    }
    var bp = qpt(x0, y0, 200, y0 + depth * 1.5, 400 - x0, y0, .5);
    if (o.pendant) s += ln('M200 ' + Math.round(bp[1] + 4) + 'l0 18', o.pendant, 2) + ell(200, Math.round(bp[1] + 28), 6, 8, o.pendant, 'stroke="' + dk(o.pendant, .5) + '" stroke-width=".8"') + pth('M196 ' + Math.round(bp[1] + 36) + 'l-3 22l6 -5l-3 5l6 -5l-3 5l6 -5z', o.tuft || '#d83a52');
    return s;
  }
  /* round embroidered medallion (团花 / 团龙 / 团凤) */
  function medallion(c, x, y, r, o) {
    var s = '', col = o.col, g = 'url(#gd' + c.u + ')';
    s += cir(x, y, r + 2, dk(col, .3)) + cir(x, y, r, o.bg || col, 'stroke="' + GOLD + '" stroke-width="2"');
    s += cir(x, y, r - 7, 'none', 'stroke="' + GOLD + '" stroke-width="1" stroke-dasharray="2 3" opacity=".8"');
    if (o.kind === 'dragon') {
      s += '<path d="M' + (x - r * .5) + ' ' + (y + r * .3) + 'C' + (x - r * .9) + ' ' + (y - r * .2) + ' ' + (x - r * .4) + ' ' + (y - r * .8) + ' ' + x + ' ' + (y - r * .5) + 'C' + (x + r * .5) + ' ' + (y - r * .4) + ' ' + (x + r * .4) + ' ' + (y + r * .1) + ' ' + (x + r * .1) + ' ' + (y + r * .1) + 'C' + (x - r * .1) + ' ' + (y + r * .1) + ' ' + (x - r * .1) + ' ' + (y + r * .45) + ' ' + (x + r * .4) + ' ' + (y + r * .5) + '" fill="none" stroke="' + g + '" stroke-width="' + (r * .2) + '" stroke-linecap="round"/>' +
        cir(x + r * .1, y - r * .48, r * .17, g) + ln('M' + (x + r * .2) + ' ' + (y - r * .55) + 'l' + r * .28 + ' ' + (-r * .12), g, r * .06) + cir(x + r * .07, y - r * .5, r * .045, '#7a1f2a');
      s += ln('M' + (x - r * .55) + ' ' + (y + r * .55) + 'q' + r * .3 + ' ' + (-r * .15) + ' ' + r * .6 + ' 0', '#bfe3f0', 1.4, 'opacity=".7"');
    } else if (o.kind === 'phoenix') {
      phoenixDef(c);
      s += phoenix(c, x - r * .05, y - r * .08, r / 78, false);
    } else {
      s += fl(c, x, y, r / 12, o.flower || '#f06a8a') + lf(c, x - r * .45, y + r * .3, r / 40, -100, o.leaf || '#4a9a70') + lf(c, x + r * .45, y + r * .3, r / 40, 100, o.leaf || '#4a9a70');
    }
    return s;
  }

  /* =================== HEADDRESS ASSEMBLIES (female) =================== */
  /* flower cluster: array of [dx,dy,scale,colour,rot] + leaves */
  function cluster(c, x, y, list, leafCol) {
    var s = '', i, L = list;
    s += lf(c, x - 18, y + 6, 1.1, -110, leafCol || '#4a9a70') + lf(c, x + 18, y + 6, 1.1, 110, leafCol || '#4a9a70') + lf(c, x, y + 14, 1.1, 180, leafCol || '#4a9a70');
    for (i = 0; i < L.length; i++) s += fl(c, x + L[i][0], y + L[i][1], L[i][2], L[i][3], L[i][4]);
    return s;
  }

  /* liangbatou-lite: two hair wings + bun knot (ranks 1-2 / candidates) */
  function headWings(c, o) {
    var s = '', col = HAIRFILL(c), H = c.P.hair, y = o.y || 70, w = o.w || 62, sc = lt(H.col, .3);
    var wing = 'M200 ' + (y + 26) + 'C' + (200 + 20) + ' ' + (y + 30) + ' ' + (200 + w * .7) + ' ' + (y + 34) + ' ' + (200 + w) + ' ' + (y + 12) + 'C' + (200 + w + 16) + ' ' + (y - 8) + ' ' + (200 + w * .5) + ' ' + (y - 26) + ' ' + (200 + 8) + ' ' + (y - 6) + 'C' + (200 + 2) + ' ' + (y - 2) + ' 200 ' + (y + 6) + ' 200 ' + (y + 26) + 'Z';
    s += both(wing, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"');
    s += bothL('M' + (200 + 14) + ' ' + (y + 8) + 'C' + (200 + w * .5) + ' ' + (y - 10) + ' ' + (200 + w * .9) + ' ' + (y - 8) + ' ' + (200 + w) + ' ' + (y + 6), sc, 1.8, 'opacity=".55"');
    s += bothL('M' + (200 + 10) + ' ' + (y + 16) + 'C' + (200 + w * .5) + ' ' + (y + 2) + ' ' + (200 + w * .8) + ' ' + (y + 6) + ' ' + (200 + w - 4) + ' ' + (y + 22), sc, 1.2, 'opacity=".4"');
    // centre knot
    s += ell(200, y + 8, 17, 20, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"') + ln('M190 ' + (y + 2) + 'Q200 ' + (y - 8) + ' 210 ' + (y + 2), sc, 1.4, 'opacity=".5"');
    return s;
  }

  /* general qitou: lvl 3 (small) … 7 (grand) */
  var QCFG = {
    3: { yt: 48, h: 46, wt: 88, wb: 66 }, 4: { yt: 38, h: 56, wt: 104, wb: 72 }, 5: { yt: 32, h: 62, wt: 114, wb: 74 },
    6: { yt: 28, h: 68, wt: 122, wb: 76 }, 7: { yt: 26, h: 72, wt: 130, wb: 78 }, 8: { yt: 24, h: 74, wt: 140, wb: 80 }
  };
  function headQitou(c, o) {
    var s = '', lvl = o.lvl, col = o.board || '#221b30', flowers = o.flowers || '#e5708c', accent = o.accent || '#e8c75a', ccol = o.silk || '#d83a52';
    var cfg = QCFG[lvl];
    var b = { yt: cfg.yt, h: cfg.h, wt: cfg.wt, wb: cfg.wb, col: col, emb: o.emb === undefined ? (lvl >= 4 ? '#d9b04a' : null) : o.emb, rise: lvl >= 6 ? 4 : 0 };
    var yt = b.yt, yb = yt + b.h, wt = b.wt, mid = yt + b.h * .5;
    if (lvl >= 6) phoenixDef(c);
    s += qitouBoard(c, b);
    var gar = o.garland || flowers;
    // lower-edge flower garland on higher boards
    if (lvl >= 4) {
      var gi, gn = Math.round(b.wb / 14);
      for (gi = -gn; gi <= gn; gi++) { var gx = 200 + gi * (b.wb - 6) / gn; s += fl(c, gx, yb - 8 + Math.abs(gi) * .8, .52, gi % 2 ? lt(gar, .25) : gar, gi * 14); }
    }
    if (lvl >= 4) s += pstring(c, 200 - wt + 12, yt + 8 - b.rise, 200, yt + 16, 200 + wt - 12, yt + 8 - b.rise, Math.round(wt / 10), .75, true);
    if (o.minimal) {
      s += fl(c, 200 - wt + 26, yt + 26, 1.1, flowers, 0) + lf(c, 200 - wt + 14, yt + 32, .9, -110, o.leaf || '#4a9a70') + lf(c, 200 - wt + 38, yt + 34, .9, 110, o.leaf || '#4a9a70');
      s += hairpin(c, 200 + 34, yb - 10, 200 + 60, yt + 8, 'jade', null);
    } else if (lvl === 3) {
      s += cluster(c, 200 - wt + 24, yt + 24, [[0, 0, 1.25, flowers, 0], [15, -9, .85, lt(flowers, .3), 40]], o.leaf);
      s += hairpin(c, 200 + 30, yb - 10, 200 + 62, yt + 6, o.pinHead || 'pearl', [4, 44]);
      s += tassel(c, 200 + wt - 12, yb - 8, 64, 2, 14, ccol, 4);
    } else if (lvl === 4 || lvl === 5) {
      s += cluster(c, 200 - wt + 30, yt + 26, [[0, 0, 1.4, flowers, 0], [-18, 8, 1, lt(flowers, .25), -30], [20, 6, 1.05, dk(flowers, .1), 40], [4, -15, .85, lt(flowers, .4), 10]], o.leaf);
      s += cluster(c, 200 + wt - 32, yt + 28, [[0, 0, 1.15, lt(flowers, .1), 0], [-15, 6, .85, flowers, -20]], o.leaf);
      s += jadePlate(c, 200, mid - 6, 14, 8, 0) + pr(c, 200 - 26, mid - 4, 1.2) + pr(c, 200 + 26, mid - 4, 1.2);
      s += hairpin(c, 200 + 18, yb - 8, 200 + 56, yt - 6, o.pinHead || 'jade', [3, 40]);
      s += hairpin(c, 200 - 24, yb - 8, 200 - 60, yt - 8, 'pearl', [-3, 36]);
      s += tassel(c, 200 + wt - 10, yb - 6, 96, 3, 18, ccol, 6) + tassel(c, 200 - wt + 10, yb - 6, 74, 2, 12, ccol, -4);
    } else {
      s += cluster(c, 200 - wt + 32, yt + 30, [[0, 0, 1.6, flowers, 0], [-20, 10, 1.1, lt(flowers, .25), -30], [22, 8, 1.15, dk(flowers, .1), 40], [4, -17, .95, lt(flowers, .4), 10]], o.leaf);
      s += cluster(c, 200 + wt - 34, yt + 32, [[0, 0, 1.5, flowers, 0], [18, 8, 1.05, lt(flowers, .25), 30], [-16, 8, 1, dk(flowers, .1), -40]], o.leaf);
      s += phoenix(c, 200 - 4, mid - 8, .56, false);
      s += pstring(c, 200 + 16, mid - 24, 200 + 26, mid - 6, 200 + 18, mid + 18, 4, .75);
      s += jadePlate(c, 200 - 36, mid + 8, 9, 6, -10) + jadePlate(c, 200 + 40, mid + 8, 9, 6, 10);
      s += hairpin(c, 200 + 48, yb - 8, 200 + 84, yt - 4, 'ruby', [4, 46]) + hairpin(c, 200 - 48, yb - 8, 200 - 86, yt - 6, 'jade', [-4, 46]);
      if (lvl >= 7) s += phoenix(c, 200 - 78, mid + 6, .26, true) + phoenix(c, 200 + 78, mid + 6, .26, false);
      else s += butterfly(c, 200 - 54, yt + 10, .62, accent, -20);
      s += tassel(c, 200 + wt - 14, yb - 6, 118, 4, 18, ccol, 4) + tassel(c, 200 - wt + 14, yb - 6, 100, 3, 14, ccol, -4);
    }
    return s;
  }

  /* phoenix crown (rank 8) / grand crown (rank 9) */
  function headCrown(c, o) {
    var s = '', g = 'url(#gd' + c.u + ')', grand = o.grand, u = c.u, i;
    phoenixDef(c);
    var yb = 98, gem = o.gem || '#d83a52', blue = o.blue || '#35a7c9';
    var half = '';
    // lower tier (kingfisher enamel with gold frame)
    half += pth('M200 ' + (yb - 36) + 'C' + (200 + 40) + ' ' + (yb - 38) + ' ' + (200 + 76) + ' ' + (yb - 30) + ' ' + (200 + 84) + ' ' + (yb - 4) + 'L' + (200 + 80) + ' ' + (yb + 8) + 'C' + (200 + 50) + ' ' + (yb + 12) + ' 200 ' + (yb + 12) + ' 200 ' + (yb + 12) + 'Z', blue, 'stroke="#1a6f8a" stroke-width="1.2"');
    half += pth('M200 ' + (yb - 36) + 'C' + (200 + 40) + ' ' + (yb - 38) + ' ' + (200 + 76) + ' ' + (yb - 30) + ' ' + (200 + 84) + ' ' + (yb - 4) + 'L' + (200 + 80) + ' ' + (yb + 8) + 'C' + (200 + 50) + ' ' + (yb + 12) + ' 200 ' + (yb + 12) + ' 200 ' + (yb + 12) + 'Z', '#fff', 'opacity=".14"');
    half += ln('M' + (200 + 8) + ' ' + (yb - 10) + 'C' + (200 + 30) + ' ' + (yb - 26) + ' ' + (200 + 52) + ' ' + (yb - 24) + ' ' + (200 + 70) + ' ' + (yb - 8), '#ffe27a', 1.6, 'opacity=".9"');
    // gold rim band
    half += pth('M200 ' + (yb + 2) + 'L' + (200 + 84) + ' ' + (yb - 8) + 'L' + (200 + 82) + ' ' + (yb + 14) + 'Q' + (200 + 50) + ' ' + (yb + 22) + ' 200 ' + (yb + 22) + 'Z', g, 'stroke="#9a6414" stroke-width="1.2"');
    // wing feathers (fan)
    var fan = grand ? 6 : 5;
    for (i = 0; i < fan; i++) {
      var a = -4 - i * (grand ? 9 : 10), len = (grand ? 78 : 72) - i * 7, bx = 200 + 14 + i * 3, by = yb - 28 - i * 2;
      var rad = a * Math.PI / 180, tx = bx + Math.cos(rad) * len + 40, ty = by + Math.sin(rad) * len * 1.05 - 4;
      half += '<path d="M' + bx + ' ' + by + 'Q' + n1((bx + tx) / 2 + 6) + ' ' + n1(by - 18 - i * 4) + ' ' + n1(tx) + ' ' + n1(ty) + 'Q' + n1((bx + tx) / 2 - 2) + ' ' + n1(by - 4 - i * 2) + ' ' + bx + ' ' + by + 'Z" fill="' + g + '" stroke="#9a6414" stroke-width=".9"/>';
    }
    // jewels on rim
    half += cir(200 + 28, yb + 10, 4.6, gem, 'stroke="#9a6414" stroke-width="1"') + cir(200 + 56, yb + 6, 4, blue, 'stroke="#9a6414" stroke-width="1"') + cir(200 + 74, yb, 3.4, gem, 'stroke="#9a6414" stroke-width="1"');
    for (i = 0; i < 4; i++) half += pr(c, 200 + 14 + i * 18, yb - 14 - (i > 2 ? 3 : 0), 1);
    // side phoenix (small) + flowers
    half += phoenix(c, 200 + 92, yb - 52, .36, false) + fl(c, 200 + 74, yb - 22, 1.0, gem, 20) + lf(c, 200 + 88, yb - 14, .8, 70, '#35a7c9');
    // temple panel (bo-bin) and long pendants
    half += pth('M' + (200 + 80) + ' ' + (yb + 4) + 'C' + (200 + 100) + ' ' + (yb + 8) + ' ' + (200 + 108) + ' ' + (yb + 34) + ' ' + (200 + 96) + ' ' + (yb + 58) + 'C' + (200 + 88) + ' ' + (yb + 42) + ' ' + (200 + 82) + ' ' + (yb + 28) + ' ' + (200 + 78) + ' ' + (yb + 14) + 'Z', g, 'stroke="#9a6414" stroke-width="1"');
    half += tassel(c, 200 + 86, yb + 38, grand ? 140 : 120, 3, 16, o.silk || '#d83a52', 6);
    half += pstring(c, 200 + 70, yb + 10, 200 + 82, yb + 34, 200 + 72, yb + 60, 5, .7);
    c.defs.push('<g id="crh' + u + '">' + half + '</g>');
    s += '<use href="#crh' + u + '"/><use href="#crh' + u + '" transform="matrix(-1 0 0 1 400 0)"/>';
    // centre: large frontal phoenix + crest
    s += '<g transform="translate(200 ' + (yb - 34) + ') scale(.72)">' + '<path d="M-14 6C-26 -20 -10 -44 0 -58C10 -44 26 -20 14 6C8 14 -8 14 -14 6Z" fill="' + g + '" stroke="#9a6414" stroke-width="1.2"/>' +
      '<path d="M0 -50L0 -2M-8 -36Q-3 -22 -3 -6M8 -36Q3 -22 3 -6" stroke="#9a6414" stroke-width=".9" fill="none" opacity=".7"/>' + cir(0, -8, 5, gem, 'stroke="#9a6414" stroke-width="1.2"') + cir(-1.4, -9.4, 1.5, '#fff', 'opacity=".8"') + cir(0, -62, 4.5, 'url(#pe' + u + ')', 'stroke="#b9a98f" stroke-width=".6"') + '</g>';
    s += pstring(c, 200, yb - 8, 200 + 3, yb + 4, 200, yb + 14, 3, .9);
    return s;
  }

  /* simple braid (rank-0 maid) hanging over the viewer's right shoulder */
  function braidSVG(c, o) {
    var s = '', col = HAIRFILL(c), H = c.P.hair, tie = o.tie || '#9a7a60', x = 262, y = 214, i, hl = lt(H.col, .3);
    var cx = [], n = 11;
    var d = 'M' + (x - 8) + ' ' + y + 'C' + (x + 18) + ' ' + (y + 40) + ' ' + (x + 30) + ' ' + (y + 120) + ' ' + (x + 14) + ' ' + (y + 220) + 'L' + (x - 6) + ' ' + (y + 220) + 'C' + (x + 6) + ' ' + (y + 120) + ' ' + (x - 6) + ' ' + (y + 50) + ' ' + (x - 22) + ' ' + (y - 6) + 'Z';
    s += pth(d, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"');
    for (i = 0; i < n; i++) {
      var t = (i + .5) / n, p = qpt(x - 10, y + 2, x + 28, y + 100, x + 4, y + 220, t);
      s += pth('M' + n1(p[0] - 11) + ' ' + n1(p[1] - 8) + 'Q' + n1(p[0]) + ' ' + n1(p[1] + 8) + ' ' + n1(p[0] + 11) + ' ' + n1(p[1] - 8) + 'Q' + n1(p[0]) + ' ' + n1(p[1] + 2) + ' ' + n1(p[0] - 11) + ' ' + n1(p[1] - 8) + 'Z', dk(H.col, .3), 'opacity=".7"') + ln('M' + n1(p[0] - 8) + ' ' + n1(p[1] - 6) + 'Q' + n1(p[0] - 1) + ' ' + n1(p[1] + 2) + ' ' + n1(p[0] + 6) + ' ' + n1(p[1] - 6), hl, 1.1, 'opacity=".4"');
    }
    s += pth('M' + (x - 2) + ' ' + (y + 206) + 'L' + (x + 16) + ' ' + (y + 206) + 'L' + (x + 18) + ' ' + (y + 220) + 'L' + (x - 4) + ' ' + (y + 220) + 'Z', tie) + pth('M' + (x - 4) + ' ' + (y + 220) + 'l-4 22l8 -8l6 8l6 -8l4 8l-2 -22z', tie, 'opacity=".95"');
    return s;
  }

  /* =================== PROFILE HELPERS =================== */
  function ext(t, s) {
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) {
      var v = s[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function' && t[k] && typeof t[k] === 'object') ext(t[k], v); else t[k] = v;
    }
    return t;
  }
  function tmplF(o) { // female template
    return ext({
      skinTone: '#f8dcc6',
      face: { fw: 66, top: 90, chin: 258, cy: 158, jw: 18 }, neck: { w: 19, base: 284 },
      eye: { ex: 36, y: 172, iris: '#8a5a3a', lash: '#2a1c24', shadow: '#e89aa0', makeup: .5, sz: 1, w: 1, tilt: 1 },
      brow: { col: '#2c2226', y: 147, len: 46, t: 3.2, arch: 1, mob: 1 },
      mouth: { y: 230, col: '#cc5566', w: 1 }, nose: { y: 205, w: 1 }, cheek: '#f28c88', cheekY: 200, blush0: .12,
      hair: { col: '#1b1724', hi: '#8a88b0' }
    }, o || {});
  }

  function tmplM(o) { // male template
    return ext(tmplF({
      face: { fw: 61, chin: 264, cy: 160, jw: 26 }, neck: { w: 21, base: 286 },
      eye: { sx: 1.04, sy: 1.1, sz: .86, wing: .3, makeup: 0, tilt: 0 },
      brow: { t: 4.6, len: 50, y: 146, arch: .8 }, mouth: { col: '#b8605e', w: .96 }, nose: { w: 1.2 }, cheek: '#e8a090', blush0: .02
    }), o || {});
  }

  /* player palette by rank/origin */
  function playerPal(rank, origin) {
    var m = origin === 'maid', s = origin === 'scholar';
    var T = [
      /*0*/ m ? ['#7f93a6', '#5d7185', 'dots', '#9fb2c4'] : s ? ['#c9e1e8', '#7fb0bc', 'bamboo', '#9cc4cc'] : ['#f2c9c0', '#d98c8c', 'flower', '#e8a7a2'],
      /*1*/ m ? ['#cdc0dc', '#8a6fa8', 'dots', '#a994c4'] : s ? ['#c0e2d4', '#4f8f86', 'bamboo', '#8fc2b2'] : ['#f6c3b2', '#c95a58', 'flower', '#e8928a'],
      /*2*/ m ? ['#c8aad6', '#7a5a9a', 'dots', '#a384bc'] : s ? ['#a9d4de', '#3f7f9a', 'bamboo', '#78b0c4'] : ['#f2a9bc', '#b83a66', 'flower', '#e07a98'],
      /*3*/ m ? ['#aa7cc2', '#5a3a7a', 'cloud', '#d4b0e8'] : s ? ['#5aaab4', '#1f5f6a', 'cloud', '#a8e0e4'] : ['#e5708c', '#8a2a52', 'cloud', '#f6b4c4'],
      /*4*/ ['#7ea8e2', '#2f5fa8', 'cloud', '#cfe0ff'],
      /*5*/ ['#9d82e2', '#5a3fa0', 'cloud', '#dcd0ff'],
      /*6*/ ['#d880c4', '#8a2a78', 'cloud', '#ffd0ee'],
      /*7*/ ['#ec9540', '#a8501a', 'cloud', '#ffe0a0'],
      /*8*/ ['#f4c93c', '#c02a3a', 'cloud', '#e0902a'],
      /*9*/ ['#5e3490', '#c89a2a', 'cloud', '#d8b8ff']
    ][rank];
    return { col: T[0], trim: T[1], pat: T[2], patCol: T[3] };
  }

  CHARS.player = function (rank, origin) {
    var m = origin === 'maid', sch = origin === 'scholar', pal = playerPal(rank, origin);
    var P = tmplF({
      skinTone: m ? '#f0d1b4' : sch ? '#f8e1ce' : '#f8dcc6',
      eye: { iris: '#8a5a3a' }, mouth: { col: '#cc5566' },
      cheek: m ? '#e88a80' : '#f28c88', blush0: m ? .18 : .12
    });
    if (rank >= 9) { P.skinTone = '#f6dfcc'; P.hair.col = '#4a4658'; P.hair.hi = '#e4e2f0'; P.mouth.col = '#b8505e'; P.eye.makeup = .35; P.brow.t = 2.8; }
    P.faceDetail = rank >= 9 ? function (c) {
      return bothL('M' + (200 + 8) + ' 214Q' + (200 + 22) + ' 226 ' + (200 + 20) + ' 244', c.skin.deep, 1.1, 'opacity=".28"') +
        bothL('M' + (200 + 55) + ' 178q8 2 10 7M' + (200 + 55) + ' 183q8 4 9 10', c.skin.deep, .9, 'opacity=".3"');
    } : null;
    var maidTone = m ? 1 : 0;
    var hf = { top: 58, lockLen: 34, tipY: 198 };
    var silk = rank >= 6 ? '#d83a52' : rank >= 4 ? (sch ? '#4f9ab0' : '#c2456b') : '#e07a98';
    var flowers = m ? '#ead7a8' : sch ? '#f4f0e6' : (rank >= 6 ? '#e8455f' : '#ee7f9a');
    var gray = rank >= 9 ? .85 : 0;

    P.back = function (c) { return rank === 0 && m ? hairBack(c, { top: 60, wd: 10 }) : hairBack(c, { top: rank >= 3 ? 56 : 60, wd: 12 }); };
    P.pre = function (c) {
      var s = '';
      if (rank >= 6) s += cloudShawl(c, { col: rank === 8 ? '#c02a3a' : rank === 9 ? '#3e2166' : pal.trim, trim: rank >= 8 ? '#f0cc58' : '#f4d672', fringe: rank === 9 ? '#c89a2a' : '#d83a52' });
      s += standCollar(c, { col: rank === 0 && m ? dk(pal.col, .12) : (rank >= 8 ? '#f6e7c0' : lt(pal.col, .35)), trim: rank === 0 && m ? pal.trim : GOLD, y: 262 });
      if (rank >= 4) s += courtBeads(c, { col: rank >= 8 ? '#f4efe6' : (rank >= 6 ? '#e6d9c4' : '#f4efe6'), n: rank >= 6 ? 30 : 22, depth: rank >= 6 ? 130 : 96, bigCol: rank >= 8 ? '#e8b43e' : '#7ccaa0', pendant: rank >= 6 ? '#e8b43e' : null, tuft: '#d83a52', r: rank >= 6 ? 3.4 : 3 });
      return s;
    };
    P.body = function (c) {
      var o = { sh: rank === 0 ? 104 : 112, col: pal.col, pat: pal.pat, patCol: pal.patCol, patOp: rank === 0 ? .35 : .5 };
      var s = robeBody(c, o);
      if (rank >= 1) s += robeTrims(c, { sh: o.sh, trim: pal.trim, trim2: GOLD, lapel: true, sleeveBand: pal.trim });
      if (rank >= 6) s += medallion(c, 200, 470, 36, { col: pal.trim, bg: rank === 8 ? '#e8a82a' : pal.col, kind: rank >= 8 ? 'dragon' : 'flower', flower: rank >= 8 ? '#e8455f' : '#ffd6ee' });
      return s;
    };
    P.hairFront = function (c) {
      if (rank === 0 && m) return hairFront(c, { top: 60, peak: 0, lockLen: 40, tipY: 196, hl: 98 }) + braidSVG(c, { tie: '#a88a68' });
      var s = hairFront(c, { top: hf.top, peak: 5, lockLen: rank >= 3 ? 44 : 36, tipY: 198, gray: gray });
      return s;
    };
    P.head = function (c) {
      var o = { flowers: flowers, silk: silk, leaf: sch ? '#5aa08a' : '#4a9a70', pinHead: m ? 'pearl' : 'jade' };
      if (rank === 0) {
        if (m) return ln('M' + (200 - 62) + ' 118Q200 78 ' + (200 + 62) + ' 118', '#9a8a78', 5, 'opacity=".9"');
        return headWings(c, { y: 74, w: 52 }) + cluster(c, 200 - 46, 92, [[0, 0, 1, flowers, 0]], o.leaf) + hairpin(c, 200 + 30, 92, 200 + 56, 66, 'pearl', [3, 30]);
      }
      if (rank <= 2) {
        var s = headWings(c, { y: 72, w: rank === 1 ? 56 : 62 });
        s += cluster(c, 200 - 50, 90, [[0, 0, 1.2, flowers, 0], [12, -8, .8, lt(flowers, .3), 40]], o.leaf);
        if (rank === 2) s += cluster(c, 200 + 52, 88, [[0, 0, 1, lt(flowers, .1), 0]], o.leaf);
        s += hairpin(c, 200 + 26, 98, 200 + 62, 62, o.pinHead, [3, rank === 2 ? 40 : 28]);
        if (rank === 2) s += tassel(c, 200 + 66, 90, 56, 2, 10, silk, 3);
        return s;
      }
      if (rank <= 7) return headQitou(c, { lvl: rank, board: rank === 9 ? '#2a1a40' : '#201a2e', flowers: flowers, silk: silk, leaf: o.leaf, pinHead: o.pinHead, accent: '#f4d672' });
      return headCrown(c, { grand: rank === 9, silk: silk, gem: rank === 9 ? '#8a3cc8' : '#d83a52', blue: rank === 9 ? '#6a4cc0' : '#35a7c9' });
    };
    return P;
  };

  /* ---------------- build ---------------- */
  function skinPal(base) {
    return { base: base, hi: lt(base, .16), sh: mix(base, '#d68a82', .38), deep: mix(base, '#a85a56', .55) };
  }
  var _profCache = {};
  function profileFor(charId, rank, origin) {
    var p = CHARS[charId] || CHARS.__missing;
    if (typeof p === 'function') {
      var k = charId + '|' + rank + '|' + origin;
      return _profCache[k] || (_profCache[k] = p(rank, origin));
    }
    return p;
  }

  function build(P, X, exprName, opts, charId) {
    var u = opts.uid || ('a' + (++_uidCounter).toString(36));
    var c = { u: u, P: P, X: X, defs: [], rank: opts.rank | 0, origin: opts.origin || 'noble', bust: !!opts.bust, skin: skinPal(P.skinTone) };
    var f = P.face, fp = facePath(f), eyeY = P.eye.y;
    var D = c.defs;
    D.push('<radialGradient id="sk' + u + '" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="' + c.skin.hi + '"/><stop offset=".55" stop-color="' + c.skin.base + '"/><stop offset="1" stop-color="' + c.skin.sh + '"/></radialGradient>');
    D.push('<linearGradient id="sh' + u + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + c.skin.deep + '" stop-opacity=".42"/><stop offset=".2" stop-color="' + c.skin.sh + '" stop-opacity="0"/><stop offset=".78" stop-color="' + c.skin.sh + '" stop-opacity="0"/><stop offset="1" stop-color="' + c.skin.deep + '" stop-opacity=".5"/></linearGradient>');
    D.push('<linearGradient id="ir' + u + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + dk(P.eye.iris, .5) + '"/><stop offset=".45" stop-color="' + P.eye.iris + '"/><stop offset="1" stop-color="' + lt(P.eye.iris, .42) + '"/></linearGradient>');
    D.push('<radialGradient id="ch' + u + '"><stop offset="0" stop-color="' + P.cheek + '" stop-opacity=".85"/><stop offset=".6" stop-color="' + P.cheek + '" stop-opacity=".35"/><stop offset="1" stop-color="' + P.cheek + '" stop-opacity="0"/></radialGradient>');
    D.push('<clipPath id="fc' + u + '"><path d="' + fp + '"/></clipPath>');
    var hairCol = P.hair ? P.hair.col : '#1c1824';
    D.push('<linearGradient id="hr' + u + '" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="' + lt(hairCol, .12) + '"/><stop offset=".5" stop-color="' + hairCol + '"/><stop offset="1" stop-color="' + dk(hairCol, .35) + '"/></linearGradient>');

    var L = '';
    if (P.back) L += P.back(c);
    var body = P.body ? P.body(c) : '';
    L += body;
    // neck
    var nk = P.neck, nw = nk.w;
    L += pth('M' + (200 - nw) + ' ' + (f.chin - 30) + 'L' + (200 - nw - 2) + ' ' + (nk.base) + 'Q200 ' + (nk.base + 10) + ' ' + (200 + nw + 2) + ' ' + nk.base + 'L' + (200 + nw) + ' ' + (f.chin - 30) + 'Z', c.skin.base) +
      pth('M' + (200 - nw) + ' ' + (f.chin - 30) + 'L' + (200 - nw - 2) + ' ' + nk.base + 'Q200 ' + (nk.base + 10) + ' ' + (200 + nw + 2) + ' ' + nk.base + 'L' + (200 + nw) + ' ' + (f.chin - 30) + 'Z', 'url(#sh' + u + ')') +
      '<g clip-path="url(#nc' + u + ')">' + ell(200, f.chin + 2, 30, 15, c.skin.deep, 'opacity=".32"') + '</g>';
    D.push('<clipPath id="nc' + u + '"><path d="M' + (200 - nw) + ' ' + (f.chin - 30) + 'L' + (200 - nw - 2) + ' ' + nk.base + 'Q200 ' + (nk.base + 10) + ' ' + (200 + nw + 2) + ' ' + nk.base + 'L' + (200 + nw) + ' ' + (f.chin - 30) + 'Z"/></clipPath>');
    if (P.pre) L += P.pre(c);
    if (P.ears) L += P.ears(c);
    // face
    L += '<path d="' + fp + '" fill="url(#sk' + u + ')" stroke="' + c.skin.deep + '" stroke-opacity=".55" stroke-width="1"/>' +
      '<g clip-path="url(#fc' + u + ')"><rect x="' + (200 - f.fw - 2) + '" y="' + f.top + '" width="' + (f.fw * 2 + 4) + '" height="' + (f.chin - f.top + 2) + '" fill="url(#sh' + u + ')"/>' +
      ell(200, f.top + 40, 30, 12, '#fff', 'opacity=".16"') + ell(200, f.chin - 6, 22, 16, c.skin.deep, 'opacity=".22"') +
      (P.faceDetail ? P.faceDetail(c) : '') + '</g>';
    L += cheeksSVG(c, X) + noseSVG(c);
    L += eyesSVG(c, X) + brows(c, X);
    L += mouthSVG(c, X);
    if (P.mole) L += cir(P.mole[0], P.mole[1], 1.5, '#5a3a3a', 'opacity=".75"');
    if (P.hairFront) L += P.hairFront(c);
    if (P.head) L += P.head(c);
    if (P.over) L += P.over(c);
    L += fxSVG(c, X);

    var OPT = {
      pe: '<radialGradient id="pe' + u + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f1e8dc"/><stop offset="1" stop-color="#b9a98f"/></radialGradient>',
      gd: '<linearGradient id="gd' + u + '" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".45" stop-color="#e8b43e"/><stop offset="1" stop-color="#a8701c"/></linearGradient>',
      jd: '<linearGradient id="jd' + u + '" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d4f5dc"/><stop offset=".5" stop-color="#7ccaa0"/><stop offset="1" stop-color="#3a8f72"/></linearGradient>'
    };
    var txt = L + D.join(''), mo = motifDefs(u);
    if (txt.indexOf('#fl' + u) >= 0) D.push(mo.fl);
    if (txt.indexOf('#lf' + u) >= 0) D.push(mo.lf);
    if (txt.indexOf('#pl' + u) >= 0) D.push(mo.pl);
    txt = L + D.join('');
    for (var ok in OPT) if (txt.indexOf('#' + ok + u) >= 0) D.push(OPT[ok]);
    var vb = c.bust ? '40 10 320 320' : '0 0 400 600';
    var maskAttr = '';
    if (!c.bust) {
      D.push('<linearGradient id="mg' + u + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="mk' + u + '" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="600"><rect width="400" height="600" fill="url(#mg' + u + ')"/></mask>');
      maskAttr = ' mask="url(#mk' + u + ')"';
    }
    if (P.xf) L = '<g transform="' + (typeof P.xf === 'function' ? P.xf(c) : P.xf) + '">' + L + '</g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" preserveAspectRatio="' + (c.bust ? 'xMidYMid meet' : 'xMidYMax meet') + '" class="qp-svg" stroke-linecap="round" stroke-linejoin="round"><defs>' + D.join('') + '</defs><g' + maskAttr + '>' + L + '</g></svg>';
  }

  /* =================== STYLE FACTORIES =================== */
  /* age lines (forehead, crow's feet, nasolabial) — drawn inside the face clip */
  function agedLines(c, k, o) {
    o = o || {};
    var d = c.skin.deep, ex = c.P.eye.ex, ey = c.P.eye.y, s = '', op = n1(.16 + k * .22), top = c.P.face.top;
    s += bothL('M' + (200 + 56) + ' ' + (ey + 4) + 'l11 -2M' + (200 + 56) + ' ' + (ey + 9) + 'l11 3M' + (200 + 55) + ' ' + (ey - 2) + 'l10 -6', d, 1, 'opacity="' + op + '"');
    if (k > .3) s += bothL('M' + (200 + 10) + ' ' + (c.P.nose.y + 6) + 'Q' + (200 + 24) + ' ' + (c.P.nose.y + 22) + ' ' + (200 + 20) + ' ' + (c.P.mouth.y + 4), d, 1.1, 'opacity="' + op + '"');
    if (!o.noForehead) s += ln('M' + (200 - 30) + ' ' + (top + 40) + 'Q200 ' + (top + 36) + ' ' + (200 + 30) + ' ' + (top + 40) + 'M' + (200 - 24) + ' ' + (top + 48) + 'Q200 ' + (top + 44) + ' ' + (200 + 24) + ' ' + (top + 48), d, 1, 'opacity="' + n1(op * .8) + '"');
    s += bothL('M' + (200 + 40) + ' ' + (c.P.mouth.y - 2) + 'q4 6 2 14', d, .9, 'opacity="' + n1(op * .8) + '"');
    if (o.bags) s += ell(200 - ex, ey + 15, 20, 5, d, 'opacity="' + n1(.12 + k * .12) + '"') + ell(200 + ex, ey + 15, 20, 5, d, 'opacity="' + n1(.12 + k * .12) + '"');
    return s;
  }

  /* female outfit/headdress wiring */
  function femaleStyle(P, S) {
    var R = S.robe;
    P.back = function (c) { return hairBack(c, S.back || { top: 56, wd: 12 }); };
    P.pre = function (c) {
      var s = '';
      if (S.shawl) s += cloudShawl(c, S.shawl);
      s += standCollar(c, S.collar);
      if (S.beads) s += courtBeads(c, S.beads);
      return s;
    };
    P.body = function (c) {
      var s = robeBody(c, R);
      if (S.trims !== false) s += robeTrims(c, { sh: R.sh, trim: R.trim, trim2: R.trim2, lapel: S.lapel !== false, sleeveBand: R.trim });
      if (S.medallion) s += medallion(c, 200, 472, 36, S.medallion);
      return s;
    };
    P.hairFront = function (c) { return hairFront(c, S.hair || {}) + (S.hairExtra ? S.hairExtra(c) : ''); };
    P.head = S.head;
    if (S.over) P.over = S.over;
    return P;
  }

  /* two ring buns (双丫髻) */
  function headRingBuns(c, o) {
    var s = '', col = HAIRFILL(c), H = c.P.hair, y = o.y || 78, dx = o.dx || 58, r = o.r || 25, rib = o.ribbon || '#f4a08a', sc = lt(H.col, .32), i;
    for (i = -1; i <= 1; i += 2) {
      var x = 200 + i * dx;
      s += pth('M' + (x - i * 16) + ' ' + (y + 34) + 'C' + (x - i * 40) + ' ' + (y + 20) + ' ' + (x - i * 6) + ' ' + (y + 26) + ' ' + (x - i * 6) + ' ' + (y + 40) + 'Z', col);
      s += ell(x, y, r, r * .9, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"') + ell(x, y + 2, r * .5, r * .42, dk(H.col, .25)) + ell(x, y + 3, r * .26, r * .22, '#000', 'opacity=".25"');
      s += ln('M' + (x - r * .75) + ' ' + (y - r * .25) + 'Q' + (x - r * .2) + ' ' + (y - r * .95) + ' ' + (x + r * .7) + ' ' + (y - r * .4), sc, 1.8, 'opacity=".6"');
      // ribbon wrap + bow + tails
      s += pth('M' + (x - i * 14) + ' ' + (y + 22) + 'Q' + x + ' ' + (y + 30) + ' ' + (x + i * 16) + ' ' + (y + 18) + 'L' + (x + i * 17) + ' ' + (y + 26) + 'Q' + x + ' ' + (y + 38) + ' ' + (x - i * 15) + ' ' + (y + 30) + 'Z', rib, 'stroke="' + dk(rib, .3) + '" stroke-width=".8"');
      s += pth('M' + (x + i * 6) + ' ' + (y + 30) + 'C' + (x + i * 20) + ' ' + (y + 40) + ' ' + (x + i * 24) + ' ' + (y + 60) + ' ' + (x + i * 20) + ' ' + (y + 84) + 'L' + (x + i * 15) + ' ' + (y + 80) + 'C' + (x + i * 18) + ' ' + (y + 58) + ' ' + (x + i * 14) + ' ' + (y + 44) + ' ' + (x + i * 2) + ' ' + (y + 34) + 'Z', rib, 'opacity=".92"');
      if (o.flower) s += fl(c, x + i * 6, y - 8, .9, o.flower, i * 20);
    }
    return s;
  }
  /* flat side coils (双平髻) */
  function headSideCoils(c, o) {
    var s = '', col = HAIRFILL(c), H = c.P.hair, y = o.y || 118, dx = o.dx || 70, r = o.r || 24, tie = o.tie || '#a88a68', i;
    for (i = -1; i <= 1; i += 2) {
      var x = 200 + i * dx;
      s += ell(x, y, r, r * .95, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"');
      s += ln('M' + (x - r * .6) + ' ' + (y - r * .3) + 'Q' + x + ' ' + (y - r * .9) + ' ' + (x + r * .6) + ' ' + (y - r * .2) + 'M' + (x - r * .5) + ' ' + (y + r * .2) + 'Q' + x + ' ' + (y - r * .4) + ' ' + (x + r * .5) + ' ' + (y + r * .3) + 'M' + (x - r * .2) + ' ' + (y + r * .1) + 'Q' + x + ' ' + (y - r * .1) + ' ' + (x + r * .2) + ' ' + (y + r * .2), lt(H.col, .3), 1.3, 'opacity=".5"');
      s += pth('M' + (x - r * .5) + ' ' + (y + r * .55) + 'Q' + x + ' ' + (y + r * .95) + ' ' + (x + r * .5) + ' ' + (y + r * .55) + 'L' + (x + r * .56) + ' ' + (y + r * .78) + 'Q' + x + ' ' + (y + r * 1.2) + ' ' + (x - r * .56) + ' ' + (y + r * .78) + 'Z', tie);
      s += pth('M' + x + ' ' + (y + r) + 'l' + (-i * 3) + ' 24l8 -7z', tie, 'opacity=".9"');
    }
    return s;
  }
  /* black cap (eunuch) */
  function headCap(c, o) {
    var s = '', col = o.col || '#1c1c24', g = 'url(#hr' + c.u + ')';
    var d = sym(56, [[200 + 44, 54, 200 + 74, 70, 200 + 76, 112], [200 + 78, 118, 200 + 70, 124, 200 + 56, 122], [200 + 30, 130, 200 + 12, 132, 200, 130]]);
    s += pth(d, col, 'stroke="#000" stroke-width="1.2"') + pth(d, 'url(#hr' + c.u + ')', 'opacity=".5"');
    s += bothL('M200 58Q' + (200 + 18) + ' 80 ' + (200 + 28) + ' 126M200 58Q' + (200 + 46) + ' 76 ' + (200 + 62) + ' 118', lt(col, .25), 1, 'opacity=".7"');
    s += ln('M' + (200 - 70) + ' 112Q200 134 ' + (200 + 70) + ' 112', o.band || '#3a3a48', 9) + ln('M' + (200 - 70) + ' 112Q200 134 ' + (200 + 70) + ' 112', '#0e0e14', 1.2, 'opacity=".7"');
    s += ln('M' + (200 - 66) + ' 108Q200 128 ' + (200 + 66) + ' 108', o.trim || '#c9a14a', 1.2);
    s += cir(200, 54, 7, '#c0273a', 'stroke="#7a1520" stroke-width="1"') + cir(198, 52, 2, '#fff', 'opacity=".6"');
    return s;
  }
  /* emperor's court hat (朝冠) */
  function headCourtHat(c, o) {
    var s = '', g = 'url(#gd' + c.u + ')', i;
    var dome = sym(36, [[200 + 14, 36, 200 + 30, 46, 200 + 40, 62], [200 + 54, 82, 200 + 68, 92, 200 + 72, 104], [200 + 50, 110, 200 + 20, 112, 200, 112]]);
    s += pth(dome, '#1d2236', 'stroke="#0a0c14" stroke-width="1.2"');
    // red silk tassel fringe radiating from the finial
    for (i = -9; i <= 9; i++) {
      var a = i * 7.4 * Math.PI / 180, x1 = 200 + Math.sin(a) * 6, y1 = 44, x2 = 200 + Math.sin(a) * 78, y2 = 44 + Math.cos(a) * 68;
      s += ln('M' + n1(x1) + ' ' + y1 + 'Q' + n1(x1 + (x2 - x1) * .35) + ' ' + n1(y1 + 14 + Math.abs(i) * 1.2) + ' ' + n1(x2) + ' ' + n1(Math.min(y2, 108)), i % 2 ? '#d9283c' : '#b01a2c', 2.6, 'opacity=".95"');
    }
    s += pth('M' + (200 - 74) + ' 100Q200 120 ' + (200 + 74) + ' 100L' + (200 + 80) + ' 112Q200 134 ' + (200 - 80) + ' 112Z', '#12121a', 'stroke="#000" stroke-width="1"');
    s += ln('M' + (200 - 78) + ' 106Q200 128 ' + (200 + 78) + ' 106', '#7a6a5a', 2.4, 'opacity=".6"') + ln('M' + (200 - 80) + ' 111Q200 133 ' + (200 + 80) + ' 111', GOLD, 1.8);
    s += pth('M194 40L206 40L204 28L196 28Z', g, 'stroke="#9a6414" stroke-width=".9"') + cir(200, 22, 7, 'url(#pe' + c.u + ')', 'stroke="#b9a98f" stroke-width=".7"') + pth('M189 44Q200 36 211 44L208 50Q200 44 192 50Z', g, 'stroke="#9a6414" stroke-width=".8"');
    // yellow chin ribbons
    s += bothL('M' + (200 + 76) + ' 112Q' + (200 + 82) + ' 190 ' + (200 + 66) + ' 252', '#e8b43e', 2.6, 'opacity=".95"');
    s += both('M' + (200 + 66) + ' 252l-4 6l4 -2l4 2z', '#d83a52') + both('M' + (200 + 66) + ' 252l-3 22l3 -4l3 4z', '#e8b43e');
    return s;
  }
  /* male topknot + crown/headband variants */
  function maleHairFront(c, o) { // hair swept back, hairline, long locks
    return hairFront(c, { top: o.top || 58, peak: o.peak == null ? 3 : o.peak, hl: o.hl || 100, tipY: o.tipY || 190, lockLen: o.lockLen || 0, lockW: o.lockW || 6, lockOut: o.lockOut || 0, gray: o.gray });
  }
  function jadeCrown(c, o) { // small jade-gold crown on a visible topknot, with a cross pin
    var s = '', g = 'url(#gd' + c.u + ')', H = c.P.hair, col = HAIRFILL(c);
    s += ell(200, 46, 17, 21, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"') + ln('M189 38Q200 28 211 38', H.hi, 1.8, 'opacity=".6"');
    s += pth('M' + (200 - 24) + ' 78L' + (200 - 19) + ' 56Q200 50 ' + (200 + 19) + ' 56L' + (200 + 24) + ' 78Q200 86 ' + (200 - 24) + ' 78Z', g, 'stroke="#9a6414" stroke-width="1.2"');
    s += pth('M' + (200 - 14) + ' 74L' + (200 - 10) + ' 60Q200 56 ' + (200 + 10) + ' 60L' + (200 + 14) + ' 74Q200 80 ' + (200 - 14) + ' 74Z', 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width=".9"');
    s += cir(200, 66, 4, o.gem || '#3f6ad8', 'stroke="#9a6414" stroke-width="1"') + cir(199, 65, 1.2, '#fff', 'opacity=".8"');
    s += ln('M' + (200 - 46) + ' 52L' + (200 + 46) + ' 52', '#9a6414', 4) + ln('M' + (200 - 46) + ' 52L' + (200 + 46) + ' 52', GOLD, 2.2) + cir(200 + 46, 52, 3.4, 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width=".8"') + cir(200 - 46, 52, 3.4, 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width=".8"');
    return s;
  }
  function topknot(c, o) { // doctor's simple knot + teal headband
    var s = '', H = c.P.hair, col = HAIRFILL(c);
    s += ell(200, 52, 20, 17, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"') + ln('M188 46Q200 36 212 46', lt(H.col, .35), 1.6, 'opacity=".6"');
    s += pth('M' + (200 - 18) + ' 62L' + (200 + 18) + ' 62L' + (200 + 15) + ' 72L' + (200 - 15) + ' 72Z', o.band, 'stroke="' + dk(o.band, .4) + '" stroke-width="1"');
    s += ln('M' + (200 - 66) + ' 114Q200 86 ' + (200 + 66) + ' 114', o.band, 8) + ln('M' + (200 - 66) + ' 111Q200 83 ' + (200 + 66) + ' 111', lt(o.band, .45), 1.4, 'opacity=".8"');
    s += ln('M' + (200 + 4) + ' 40L' + (200 + 30) + ' 74', '#cfd6dc', 3) + cir(200 + 4, 40, 3, '#e8eef2');
    return s;
  }

  /* =================== FEMALE CAST =================== */
  function hanBody(c, o) {
    var sh = o.sh || 104, s = robeBody(c, { sh: sh, col: o.col, pat: o.pat, patCol: o.patCol, patOp: o.patOp || .45 });
    s += pth('M' + (200 - sh + 14) + ' 396Q200 410 ' + (200 + sh - 14) + ' 396L' + (200 + sh - 16) + ' 424Q200 438 ' + (200 - sh + 16) + ' 424Z', o.sash, 'stroke="' + dk(o.sash, .4) + '" stroke-width="1.2"');
    s += ln('M' + (200 - sh + 18) + ' 402Q200 416 ' + (200 + sh - 18) + ' 402', lt(o.sash, .5), 1.2, 'opacity=".7"');
    s += pth('M196 418L180 520L192 512L200 530L208 512L220 520L204 418Z', o.ribbon || o.sash, 'stroke="' + dk(o.sash, .4) + '" stroke-width="1" opacity=".95"');
    s += pth('M190 414Q200 404 210 414Q200 424 190 414Z', dk(o.sash, .15));
    return s;
  }

  /* ---- Empress Fuca ---- */
  CHARS.empress = femaleStyle(tmplF({
    skinTone: '#f8e1cf', eye: { iris: '#5a3a34', sz: .97, tilt: 2, shadow: '#e87a70', makeup: .65, mod: { u1: -1, u2: -1 } },
    brow: { y: 146, len: 50, t: 3, arch: 1.1 }, mouth: { col: '#c0394f' }, cheek: '#f08a80', blush0: .1
  }), {
    robe: { sh: 112, col: '#c42a3a', trim: '#f0c648', trim2: GOLD, pat: 'cloud', patCol: '#f2c94c', patOp: .5 },
    shawl: { col: '#e8b230', trim: '#c42a3a', fringe: '#c42a3a' },
    collar: { col: '#f6ead0', trim: '#c42a3a' },
    beads: { col: '#f4efe6', n: 30, depth: 130, bigCol: '#d83a52', pendant: '#e8b43e', tuft: '#d83a52', r: 3.4 },
    medallion: { col: '#f0c648', bg: '#c42a3a', kind: 'phoenix' },
    hair: { top: 56, peak: 6, lockLen: 40, tipY: 198 },
    head: function (c) { return headQitou(c, { lvl: 6, board: '#8a1a2a', emb: '#f0c648', flowers: '#e8455f', garland: '#f2c94c', silk: '#d83a52', accent: '#f4d672', pinHead: 'ruby' }); }
  });

  /* ---- Dowager Wenxian ---- */
  CHARS.dowager = (function () {
    var P = tmplF({
      skinTone: '#f1dbc8', face: { fw: 64, chin: 258, jw: 19 },
      eye: { iris: '#4a3a40', sz: .86, tilt: -1.2, shadow: '#c9a0a0', makeup: .15, wing: .5, mod: { u1: -3, u2: -4, oy: 1.5 } },
      brow: { col: '#8a8794', y: 148, len: 46, t: 2.6, arch: .8 }, mouth: { col: '#a8505e', neutral: 'flat' }, cheek: '#e8a090', blush0: .05,
      hair: { col: '#c4c1d0', hi: '#ffffff' }
    });
    P.faceDetail = function (c) { return agedLines(c, .85); };
    return femaleStyle(P, {
      robe: { sh: 112, col: '#4a2a72', trim: '#c9a02c', trim2: GOLD, pat: 'cloud', patCol: '#8a6ac0', patOp: .5 },
      shawl: { col: '#2e1a4a', trim: '#d8b04a', fringe: '#8a6ac0' },
      collar: { col: '#e6dcc8', trim: '#c9a02c' },
      beads: { col: '#5a3420', n: 26, depth: 170, bigCol: '#7ccaa0', pendant: '#7ccaa0', tuft: '#6b3fa0', r: 4, bigR: 5.6 },
      medallion: { col: '#c9a02c', bg: '#5a3490', kind: 'flower', flower: '#e8d8a0' },
      hair: { top: 56, peak: 4, lockLen: 30, tipY: 198 },
      head: function (c) { return headQitou(c, { lvl: 6, board: '#2b1a44', emb: '#c9b8e8', flowers: '#ece6f8', garland: '#cfc0ee', silk: '#6b3fa0', accent: '#d8d0f0', pinHead: 'jade' }); }
    });
  })();

  /* ---- Imperial Noble Consort Niohuru ---- */
  CHARS.consort = femaleStyle(tmplF({
    skinTone: '#f8e0cc', eye: { iris: '#6a2a2a', sz: .94, tilt: 3.6, shadow: '#ee6a3a', makeup: .95, wing: 1.3, mod: { u1: -4, u2: 3, iy: 1 } },
    brow: { y: 143, len: 52, t: 3.8, arch: 1.5, mob: 1.25 }, mouth: { col: '#c8283a', neutral: 'flat', w: 1.05 }, cheek: '#f0907a', blush0: .1
  }), {
    robe: { sh: 114, col: '#e24a1c', trim: '#8a1f10', trim2: GOLD, pat: 'cloud', patCol: '#ffc24a', patOp: .55 },
    shawl: { col: '#e8a82a', trim: '#a8280f', fringe: '#c8283a' },
    collar: { col: '#fbe9c0', trim: '#a8280f' },
    beads: { col: '#e0583a', n: 30, depth: 140, bigCol: '#e8b43e', pendant: '#e8b43e', tuft: '#d83a52', r: 3.6 },
    medallion: { col: '#f0c648', bg: '#c8381a', kind: 'phoenix' },
    hair: { top: 56, peak: 8, lockLen: 34, tipY: 198 },
    head: function (c) { return headQitou(c, { lvl: 8, board: '#1c1420', emb: '#f0c648', flowers: '#f2b52a', garland: '#ff7a2a', silk: '#d8282a', accent: '#f4d672', pinHead: 'ruby' }); }
  });

  /* ---- Chu Guiren ---- */
  CHARS.chu = femaleStyle(tmplF({
    skinTone: '#f9e1d2', eye: { iris: '#a04a62', sy: 1.32, sx: 1.12, tilt: 2.6, shadow: '#e060a0', makeup: .9, wing: 1.2, mod: { u1: 1, u2: 3 } },
    brow: { y: 143, len: 46, t: 2.6, arch: 1.35, mob: 1.1 }, mouth: { col: '#e0407a', neutral: 'pout' }, cheek: '#f56a8a', blush0: .24, cheekRx: 23
  }), {
    robe: { sh: 110, col: '#d93d8c', trim: '#7a1f55', trim2: GOLD, pat: 'flower', patCol: '#ffbfdf', patOp: .5 },
    collar: { col: '#ffe2ef', trim: GOLD },
    beads: { col: '#ffd6ea', n: 22, depth: 100, bigCol: '#e8b43e', pendant: '#e8b43e', tuft: '#ff5fa2', r: 3.2 },
    hair: { top: 56, peak: 7, lockLen: 38, tipY: 198 },
    head: function (c) {
      return headQitou(c, { lvl: 4, board: '#2c1230', emb: '#f4c0e0', flowers: '#ff4fa0', garland: '#ffd0e8', silk: '#ff5fa2', accent: '#ffe08a', pinHead: 'ruby' }) +
        butterfly(c, 200 + 62, 50, .8, '#ff9ccf', 18) + butterfly(c, 200 - 84, 38, .7, '#ffd36a', -22);
    }
  });

  /* ---- Lu Pin ---- */
  CHARS.lu = (function () {
    var P = tmplF({
      skinTone: '#f9e4d4', face: { fw: 62, chin: 262, jw: 15 }, neck: { w: 17 },
      eye: { iris: '#4e7a98', tilt: -.8, shadow: '#d6a6c0', makeup: .45, wing: .7, mod: { u1: 1, u2: -3, oy: 1.5, bt: 1 } },
      brow: { y: 148, len: 46, t: 2.8, arch: .9 }, mouth: { col: '#d4707c', neutral: 'smile' }, cheek: '#f4a09a', blush0: .16
    });
    return femaleStyle(P, {
      robe: { sh: 108, col: '#7da7d6', trim: '#3f6a9f', trim2: '#e8eefa', pat: 'cloud', patCol: '#eaf3ff', patOp: .55 },
      collar: { col: '#f4f8ff', trim: '#9fc0e8' },
      hair: { top: 56, peak: 7, lockLen: 74, lockW: 6, lockOut: 8, tipY: 200 },
      head: function (c) {
        return headQitou(c, { lvl: 3, board: '#222a44', flowers: '#f4f8ff', silk: '#9fc0e8', leaf: '#6aa890', pinHead: 'pearl', accent: '#cfe0f4' }) +
          butterfly(c, 200 - 70, 54, .75, '#cfe0f4', -18) + tassel(c, 200 - 78, 96, 118, 3, 14, '#9fc0e8', -6);
      }
    });
  })();

  /* ---- Shu Fei ---- */
  CHARS.shu = (function () {
    var P = tmplF({
      skinTone: '#f6dec8', eye: { iris: '#3f6a60', sz: .9, tilt: .4, shadow: '#b8c8b8', makeup: .3, wing: .8, mod: { u1: -5, u2: -5, bt: -1 } },
      brow: { y: 149, len: 48, t: 3, arch: .6 }, mouth: { col: '#b86068', neutral: 'flat' }, cheek: '#e8988a', blush0: .06
    });
    return femaleStyle(P, {
      robe: { sh: 110, col: '#3f9a86', trim: '#1f5f52', trim2: '#d8ece4', pat: 'lattice', patCol: '#9fe0cc', patOp: .4 },
      collar: { col: '#f4f1e6', trim: '#9fd4c4' },
      hair: { top: 56, peak: 5, lockLen: 22, lockW: 5, tipY: 198 },
      head: function (c) { return headQitou(c, { lvl: 3, minimal: true, board: '#16221f', emb: null, flowers: '#f6f6ee', leaf: '#5aa08a' }); }
    });
  })();

  /* ---- Meixing (best friend, 15) ---- */
  CHARS.friend = (function () {
    var P = tmplF({
      skinTone: '#fbe5d4', face: { fw: 68, chin: 254, cy: 156, jw: 21 }, neck: { w: 18, base: 282 },
      eye: { iris: '#8a5430', y: 175, ex: 37, sx: 1.16, sy: 1.36, tilt: .5, shadow: '#f0b0a0', makeup: .2 },
      brow: { y: 149, len: 42, t: 2.8, arch: 1 }, mouth: { y: 229, col: '#e0707a', open: true, w: 1.05 }, nose: { y: 206, w: .85 },
      cheek: '#ff9a90', cheekY: 202, blush0: .24, cheekRx: 23, hair: { col: '#2e2020', hi: '#a08078' }, happyEyes: true
    });
    P.back = function (c) { return hairBack(c, { top: 58, wd: 12, long: 430, lw: 8 }); };
    P.pre = function (c) { return crossCollar(c, { col: '#f6b4a0', inner: '#fff6ea', trim: '#e8806a', y: 260 }); };
    P.body = function (c) { return hanBody(c, { sh: 102, col: '#f8bfaa', pat: 'flower', patCol: '#ffe0d0', patOp: .4, sash: '#f6d680', ribbon: '#f4a08a' }); };
    P.hairFront = function (c) { return hairFront(c, { top: 62, peak: 0, hl: 112, lockLen: 40, lockW: 6, tipY: 196 }) + bangs(c, { y: 124 }); };
    P.head = function (c) { return headRingBuns(c, { y: 74, dx: 60, r: 26, ribbon: '#f4a08a', flower: '#ff8fa8' }); };
    return P;
  })();

  /* ---- Chuntao (maid, 16) ---- */
  CHARS.maid = (function () {
    var P = tmplF({
      skinTone: '#efcfae', face: { fw: 67, chin: 255, cy: 156, jw: 21 }, neck: { w: 18, base: 282 },
      eye: { iris: '#6a4630', y: 175, ex: 37, sx: 1.14, sy: 1.34, tilt: .3, makeup: 0 },
      brow: { y: 149, len: 44, t: 3.4, arch: .8 }, mouth: { y: 229, col: '#c86a60', open: true }, nose: { y: 206, w: .9 },
      cheek: '#e88a6a', cheekY: 202, blush0: .2, cheekRx: 22, hair: { col: '#2a1c16', hi: '#8a6a5a' }, happyEyes: true
    });
    P.faceDetail = function (c) {
      var s = '', x, i; for (i = 0; i < 3; i++) { x = 200 - 44 + i * 9; s += cir(x, 196 + (i % 2) * 5, 1.1, '#b9805a', 'opacity=".55"') + cir(400 - x, 196 + (i % 2) * 5, 1.1, '#b9805a', 'opacity=".55"'); }
      return s;
    };
    P.back = function (c) { return hairBack(c, { top: 60, wd: 12 }); };
    P.pre = function (c) { return standCollar(c, { col: '#f0e0c0', trim: '#7a4a24', y: 262 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 108, col: '#be7a40', pat: 'dots', patCol: '#e8b070', patOp: .45 });
      s += robeTrims(c, { sh: 108, trim: '#7a4a24', trim2: '#e8c488', lapel: true, sleeveBand: '#7a4a24' });
      return s;
    };
    P.hairFront = function (c) { return hairFront(c, { top: 60, peak: 0, hl: 100, lockLen: 30, lockW: 6, tipY: 196 }); };
    P.head = function (c) { return headSideCoils(c, { y: 106, dx: 68, r: 21, tie: '#a88a68' }); };
    return P;
  })();

  /* =================== MALE / OTHER CAST =================== */
  function earsSVG(c) {
    var f = c.P.face, y = c.P.eye.y + 6, fw = f.fw, d = c.skin.deep, b = c.skin.base;
    function ear(s) { var x = 200 + s * (fw + 1); return pth('M' + (x - s * 4) + ' ' + (y - 16) + 'C' + (x + s * 10) + ' ' + (y - 20) + ' ' + (x + s * 12) + ' ' + (y + 12) + ' ' + (x - s * 2) + ' ' + (y + 18) + 'Z', b, 'stroke="' + d + '" stroke-width="1"') + ln('M' + (x + s * 1) + ' ' + (y - 8) + 'Q' + (x + s * 7) + ' ' + y + ' ' + (x + s * 2) + ' ' + (y + 8), d, 1.2, 'opacity=".55"'); }
    return ear(-1) + ear(1);
  }
  function cranes(c, x, y, s, col) { // tiny crane badge motif
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round"><path d="M-14 6Q-6 -4 2 0Q10 4 18 -10"/><path d="M-6 -4Q-12 -14 -4 -16"/><path d="M-12 8L-16 20M-6 8L-8 20"/></g>' + ell(x + 8 * s, y - 8 * s, 8 * s, 4 * s, col, 'opacity=".9" transform="rotate(-30 ' + (x + 8 * s) + ' ' + (y - 8 * s) + ')"');
  }

  /* ---- Emperor Chengping ---- */
  CHARS.emperor = (function () {
    var P = tmplM({
      skinTone: '#f6ddc4', face: { fw: 60, chin: 266, jw: 24 },
      eye: { iris: '#2f2a38', sz: .88, tilt: .5, lash: '#1e1a22', mod: { u1: -2, u2: -2, oy: 1 } },
      brow: { col: '#1e1a20', y: 146, len: 48, t: 4.8, arch: .8 }, mouth: { col: '#b8605e', neutral: 'flat' }, hair: { col: '#14121a', hi: '#6a6890' }
    });
    P.faceDetail = function (c) { return agedLines(c, .12, { noForehead: true, bags: true }); };
    P.ears = earsSVG;
    P.pre = function (c) {
      var s = cloudShawl(c, { col: '#1f4a5a', trim: '#e8b43e', y: 286, fringe: '#e8b43e' });
      s += standCollar(c, { col: '#1b3f4e', trim: '#e8b43e', y: 262 });
      s += courtBeads(c, { col: '#e0a43a', n: 27, depth: 140, bigCol: '#d83a52', r: 3.6, pendant: '#e8b43e', tuft: '#e8b43e' });
      return s;
    };
    P.body = function (c) {
      var s = robeBody(c, { sh: 120, col: '#f2bf2e', pat: 'cloud', patCol: '#ffe49a', patOp: .55 });
      s += pth('M' + (200 - 126) + ' 560L' + (200 + 126) + ' 560L' + (200 + 150) + ' 600L' + (200 - 150) + ' 600Z', '#2f7a9a', 'opacity=".9"') + pth('M' + (200 - 126) + ' 560L' + (200 + 126) + ' 560L' + (200 + 150) + ' 600L' + (200 - 150) + ' 600Z', 'url(#' + patternDef(c, 'wave', '#bfe8f0', '#2f7a9a') + ')', 'opacity=".8"');
      s += medallion(c, 200, 470, 40, { col: '#1f4a5a', bg: '#2a5f78', kind: 'dragon' });
      s += medallion(c, 200 - 78, 392, 20, { col: '#1f4a5a', bg: '#2a5f78', kind: 'dragon' }) + medallion(c, 200 + 78, 392, 20, { col: '#1f4a5a', bg: '#2a5f78', kind: 'dragon' });
      return s;
    };
    P.hairFront = function (c) { return ''; };
    P.head = function (c) { return headCourtHat(c, {}); };
    return P;
  })();

  /* ---- Prince Rui ---- */
  CHARS.prince = (function () {
    var P = tmplM({
      skinTone: '#f4dcc6', face: { fw: 61, chin: 264, jw: 21 },
      eye: { iris: '#4a3a82', sz: .9, tilt: 3.4, shadow: '#d86a7a', makeup: .45, wing: .8, lash: '#1a1620', mod: { u1: -1, u2: 1 } },
      brow: { col: '#1a1620', y: 145, len: 50, t: 4.6, arch: 1.25, mob: 1.2 }, mouth: { col: '#b8606c', neutral: 'smirk' },
      hair: { col: '#16141e', hi: '#7a78c0' }
    });
    P.ears = null;
    P.back = function (c) {
      var rb = '#3a52a8';
      return hairBack(c, { top: 54, wd: 10, long: 470, lw: 22 }) + both('M' + (200 + 20) + ' 64C' + (200 + 50) + ' 100 ' + (200 + 84) + ' 170 ' + (200 + 88) + ' 262L' + (200 + 80) + ' 258C' + (200 + 78) + ' 180 ' + (200 + 46) + ' 108 ' + (200 + 14) + ' 70Z', rb, 'opacity=".92"');
    };
    P.pre = function (c) { return crossCollar(c, { col: '#2e3d7a', inner: '#e8eefc', trim: '#c8d4f4', y: 260 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 118, col: '#2e3d7a', pat: 'cloud', patCol: '#aab8e8', patOp: .5 });
      s += pth('M' + (200 - 118 + 14) + ' 402Q200 416 ' + (200 + 118 - 14) + ' 402L' + (200 + 118 - 16) + ' 420Q200 434 ' + (200 - 118 + 16) + ' 420Z', '#1c264f', 'stroke="#aab8e8" stroke-width="1.2"');
      s += cir(200 + 40, 452, 8, 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width="1"') + ln('M' + (200 + 40) + ' 420l0 24', '#aab8e8', 1.6) + pth('M' + (200 + 36) + ' 460l-3 30l6 -6l-3 6l6 -6z', '#aab8e8');
      return s;
    };
    P.hairFront = function (c) { return maleHairFront(c, { top: 56, peak: 2, hl: 102, tipY: 192, lockLen: 120, lockW: 6, lockOut: 4 }); };
    P.head = function (c) { return jadeCrown(c, { gem: '#3f6ad8', ribbon: '#3a52a8' }); };
    return P;
  })();

  /* ---- Zhang Fu (eunuch) ---- */
  CHARS.eunuch = (function () {
    var P = tmplM({
      skinTone: '#f3dcc6', face: { fw: 63, chin: 258, jw: 25 }, neck: { w: 22 },
      eye: { iris: '#3a2e28', sz: .76, sx: 1.04, sy: 1.05, tilt: 1.4, lash: '#1e1a1a', wing: .5, mod: { u1: -2, u2: -3, oy: 1 } },
      brow: { col: '#2a2224', y: 151, len: 44, t: 2.6, arch: .9 }, mouth: { col: '#b86a64', neutral: 'smile', w: 1.05 }, cheek: '#eaa090', blush0: .06, hair: { col: '#1a1a22', hi: '#555' }
    });
    P.ears = earsSVG;
    P.pre = function (c) { return standCollar(c, { col: '#2f3744', trim: '#c9a14a', y: 262 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 114, col: '#5f7389', pat: 'dots', patCol: '#9ab0c8', patOp: .5 });
      s += robeTrims(c, { sh: 114, trim: '#3d4a5c', trim2: '#c9a14a', lapel: true, sleeveBand: '#3d4a5c' });
      s += pth('M170 392L230 392L230 452L170 452Z', '#e8d9b8', 'stroke="#c9a14a" stroke-width="3"') + pth('M174 396L226 396L226 448L174 448Z', 'none', 'stroke="#8a6a3a" stroke-width="1"') + cranes(c, 200, 426, 1, '#3d4a5c');
      return s;
    };
    P.hairFront = function (c) { return ''; };
    P.head = function (c) { return headCap(c, {}); };
    return P;
  })();

  /* ---- Dr. Xie ---- */
  CHARS.doctor = (function () {
    var P = tmplM({
      skinTone: '#f6e0cc', face: { fw: 61, chin: 263, jw: 22 }, neck: { w: 20 },
      eye: { iris: '#3f7a70', sz: .96, sx: 1.08, sy: 1.14, tilt: -.6, lash: '#2a2a30', wing: .3, mod: { u2: -3, oy: 1.5 } },
      brow: { col: '#2a2428', y: 148, len: 46, t: 4, arch: .9, mob: 1.1 }, mouth: { col: '#c8706c', neutral: 'smile' }, cheek: '#eaa09a', blush0: .05, hair: { col: '#1b1a22', hi: '#6a7a9a' }
    });
    P.ears = null;
    P.back = function (c) { return hairBack(c, { top: 54, wd: 10, long: 400, lw: 12 }); };
    P.pre = function (c) { return crossCollar(c, { col: '#cde8e4', inner: '#fbfdfc', trim: '#3f8f9a', y: 260 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 112, col: '#cfe9e5', pat: 'bamboo', patCol: '#8fc4c0', patOp: .45 });
      s += pth('M' + (200 - 112 + 14) + ' 410Q200 424 ' + (200 + 112 - 14) + ' 410L' + (200 + 112 - 16) + ' 428Q200 442 ' + (200 - 112 + 16) + ' 428Z', '#3f8f9a', 'stroke="#2a6a74" stroke-width="1.2"');
      s += both('M' + (200 + 112 + 6) + ' 540L' + (200 + 112 + 32) + ' 540L' + (200 + 112 + 34) + ' 600L' + (200 + 112 + 12) + ' 600Z', '#3f8f9a', 'opacity=".95"');
      return s;
    };
    P.over = function (c) { // medicine-box strap + box
      var s = '', d = 'M' + (200 + 56) + ' 292L' + (200 - 78) + ' 560';
      s += ln(d, '#5a3a22', 15) + ln(d, '#8a5a34', 12) + ln(d, '#c49a64', 1.2, 'transform="translate(-3 0)" opacity=".7"');
      s += pth('M' + (200 + 38) + ' 330l16 -5l4 14l-16 5z', '#d8b04a', 'stroke="#8a6414" stroke-width="1.2"');
      s += pth('M' + (200 - 150) + ' 520L' + (200 - 84) + ' 508L' + (200 - 70) + ' 600L' + (200 - 150) + ' 600Z', '#8a5a34', 'stroke="#4a2e18" stroke-width="1.6"') + ln('M' + (200 - 150) + ' 540L' + (200 - 80) + ' 528', '#d8b04a', 3) + cir(200 - 112, 540, 5, '#d8b04a', 'stroke="#8a6414" stroke-width="1"');
      return s;
    };
    P.hairFront = function (c) { return maleHairFront(c, { top: 54, peak: 3, hl: 100, tipY: 192, lockLen: 70, lockW: 6, lockOut: 3 }); };
    P.head = function (c) { return topknot(c, { band: '#3f8f9a' }); };
    return P;
  })();

  /* ---- Mama Qin ---- */
  CHARS.mama = (function () {
    var P = tmplF({
      skinTone: '#edd3ba', face: { fw: 62, chin: 258, cy: 160, jw: 22 }, neck: { w: 20, base: 284 },
      eye: { iris: '#3a2a22', sz: .84, sx: 1.04, tilt: -1.6, makeup: 0, lash: '#2a2220' },
      brow: { col: '#6a6670', y: 146, len: 46, t: 3.4, arch: .5, mob: 1.4 }, mouth: { col: '#a85a58', neutral: 'tight', w: .95 }, cheek: '#dca090', blush0: .03,
      hair: { col: '#8e8b99', hi: '#f0eef8' }
    });
    P.faceDetail = function (c) { return agedLines(c, .8); };
    P.back = function (c) { return hairBack(c, { top: 58, wd: 10 }); };
    P.pre = function (c) { return standCollar(c, { col: '#d9c8a8', trim: '#8a6a3a', y: 262 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 112, col: '#6b5444', pat: 'dots', patCol: '#9a8068', patOp: .5 });
      s += robeTrims(c, { sh: 112, trim: '#3a2b22', trim2: '#b89a64', lapel: true, sleeveBand: '#3a2b22' });
      return s;
    };
    P.hairFront = function (c) { return hairFront(c, { top: 58, peak: 2, hl: 104, tipY: 190, gray: .6 }); };
    P.head = function (c) {
      var H = c.P.hair, col = HAIRFILL(c), s = '';
      s += ell(200, 52, 24, 19, col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"') + ln('M184 46Q200 36 216 46', '#fff', 1.6, 'opacity=".5"') + ln('M176 52Q200 60 224 52', dk(H.col, .3), 1, 'opacity=".5"');
      s += ln('M' + (200 + 4) + ' 38L' + (200 + 36) + ' 74', '#cfd2d8', 3.2) + cir(200 + 4, 38, 3.4, '#e8eef2');
      s += ln('M' + (200 - 68) + ' 116Q200 92 ' + (200 + 68) + ' 116', '#3a2b22', 11) + ln('M' + (200 - 68) + ' 111Q200 87 ' + (200 + 68) + ' 111', '#7a6048', 1.2, 'opacity=".8"') + cir(200, 100, 5, 'url(#jd' + c.u + ')', 'stroke="#2f7a60" stroke-width="1"');
      return s;
    };
    return P;
  })();

  /* ---- Little prince ---- */
  CHARS.child = (function () {
    var P = tmplF({
      skinTone: '#fbe3d0', face: { fw: 70, top: 80, chin: 248, cy: 154, jw: 27 }, neck: { w: 16, base: 280 },
      eye: { y: 182, ex: 38, iris: '#4a2e1c', sx: 1.2, sy: 1.5, tilt: 0, makeup: 0, wing: .45 },
      brow: { y: 157, len: 36, t: 2.6, arch: .8 }, mouth: { y: 224, col: '#e0707a', open: true, w: .85 }, nose: { y: 203, w: .7 },
      cheek: '#ff9a90', cheekY: 208, blush0: .3, cheekRx: 24, hair: { col: '#17141a', hi: '#6a6880' }, happyEyes: true
    });
    P.xf = function (c) { return c.bust ? 'translate(8 -6) scale(.96)' : 'translate(8 24) scale(.96)'; };
    P.ears = earsSVG;
    P.pre = function (c) { return standCollar(c, { col: '#c42a3a', trim: GOLD, y: 262 }); };
    P.body = function (c) {
      var s = robeBody(c, { sh: 92, col: '#f4c94a', pat: 'cloud', patCol: '#ffe9a0', patOp: .55 });
      s += robeTrims(c, { sh: 92, trim: '#c42a3a', trim2: GOLD, lapel: true, sleeveBand: '#c42a3a' });
      s += medallion(c, 200, 450, 30, { col: '#c42a3a', bg: '#e8a82a', kind: 'dragon' });
      return s;
    };
    P.hairFront = function (c) {
      var s = '', f = c.P.face, fw = f.fw, col = HAIRFILL(c), H = c.P.hair;
      // shaved scalp: bluish stubble band + back hair rim + queue
      s += '<path d="M' + (200 - fw + 4) + ' 150C' + (200 - fw) + ' 100 ' + (200 - 40) + ' 76 200 76C' + (200 + 40) + ' 76 ' + (200 + fw) + ' 100 ' + (200 + fw - 4) + ' 150C' + (200 + fw - 16) + ' 110 ' + (200 + 30) + ' 92 200 92C' + (200 - 30) + ' 92 ' + (200 - fw + 16) + ' 110 ' + (200 - fw + 4) + ' 150Z" fill="#6a7088" opacity=".28"/>';
      s += pth('M' + (200 - fw - 2) + ' 176C' + (200 - fw - 8) + ' 120 ' + (200 - fw + 6) + ' 96 ' + (200 - fw + 16) + ' 88C' + (200 - fw + 8) + ' 120 ' + (200 - fw + 4) + ' 150 ' + (200 - fw + 8) + ' 182Z', col) + pth('M' + (200 + fw + 2) + ' 176C' + (200 + fw + 8) + ' 120 ' + (200 + fw - 6) + ' 96 ' + (200 + fw - 16) + ' 88C' + (200 + fw - 8) + ' 120 ' + (200 + fw - 4) + ' 150 ' + (200 + fw - 8) + ' 182Z', col);
      s += pth('M' + (200 - fw + 14) + ' 92Q200 62 ' + (200 + fw - 14) + ' 92Q200 76 ' + (200 - fw + 14) + ' 92Z', col);
      // queue (braid) over the viewer's right shoulder
      var qx = 200 + fw - 2, i;
      s += pth('M' + (qx - 6) + ' 150C' + (qx + 12) + ' 210 ' + (qx + 18) + ' 290 ' + (qx + 6) + ' 372L' + (qx - 1) + ' 372C' + (qx + 7) + ' 290 ' + (qx + 4) + ' 214 ' + (qx - 12) + ' 160Z', col, 'stroke="' + dk(H.col, .3) + '" stroke-width="1"');
      for (i = 0; i < 9; i++) { var qp = qpt(qx - 8, 160, qx + 20, 260, qx + 3, 368, (i + .5) / 9); s += ln('M' + n1(qp[0] - 6) + ' ' + n1(qp[1] - 4) + 'l6 7l6 -7', lt(H.col, .3), 1.1, 'opacity=".5"'); }
      s += pth('M' + (qx - 4) + ' 366L' + (qx + 9) + ' 366L' + (qx + 9) + ' 378L' + (qx - 4) + ' 378Z', '#c42a3a') + pth('M' + (qx - 3) + ' 378l-3 20l5 -5l3 5l2 -20z', '#c42a3a');
      s += cir(200, 104, 3.4, '#d8333a', 'opacity=".9"');
      return s;
    };
    P.head = function (c) { return ''; };
    return P;
  })();

  CHARS.__missing = CHARS.friend;

  return render;
})();
