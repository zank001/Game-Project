/* util.js — namespace, math, RNG, noise, event bus, pixel buffer, storage.
   Every other file attaches to the global `S77` namespace (no ES modules so the
   game also runs from file:// and from the bundled standalone.html). */
'use strict';
const S77 = (globalThis.S77 = globalThis.S77 || {});

/* ---------------- math ---------------- */
const U = (S77.U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (t) => t * t * (3 - 2 * t),
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  rnd: (a, b) => a + Math.random() * (b - a),
  pick: (arr, r) => arr[Math.floor((r === undefined ? Math.random() : r) * arr.length) % arr.length],
  fmtMoney: (n) => '฿' + Math.round(n).toLocaleString('en-US'),
  fmtNum: (n) => Math.round(n).toLocaleString('en-US'),
  pad2: (n) => (n < 10 ? '0' : '') + n,
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
});

/* ---------------- deterministic hashing / RNG ---------------- */
// 32-bit integer hash of (x, y, seed) -> [0, 1)
U.hash2 = function (x, y, s) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
};
U.hashStr = function (str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
// mulberry32 seeded RNG -> function returning [0,1)
U.rng = function (seed) {
  let a = seed >>> 0;
  const f = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (a0, b0) => a0 + Math.floor(f() * (b0 - a0 + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
};

/* ---------------- value noise / fbm ---------------- */
U.vnoise = function (x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
  const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
U.fbm = function (x, y, seed, oct) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < (oct || 4); i++) { s += amp * U.vnoise(x * f, y * f, seed + i * 101); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
};

// low-frequency fbm sampled on a coarse grid + bilinear lookup (much faster for big maps)
U.noiseGrid = function (W, H, step, scale, seed, oct) {
  const gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2, g = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) g[gy * gw + gx] = U.fbm((gx * step) / scale, (gy * step) / scale, seed, oct);
  return function (x, y) {
    const fx = x / step, fy = y / step, cx = fx | 0, cy = fy | 0, tx = fx - cx, ty = fy - cy, i = cy * gw + cx;
    return (g[i] * (1 - tx) + g[i + 1] * tx) * (1 - ty) + (g[i + gw] * (1 - tx) + g[i + gw + 1] * tx) * ty;
  };
};

/* ---------------- geometry ---------------- */
U.pointInPoly = function (x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
U.segDist = function (px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
// Catmull-Rom resample of a polyline (array of [x,y]) -> denser polyline
U.spline = function (pts, stepsPer) {
  if (pts.length < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < stepsPer; s++) {
      const t = s / stepsPer, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/* ---------------- color ---------------- */
U.hex = function (h) {
  if (typeof h !== 'string') return h;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
U.shade = function (c, f) { // f>1 lighter, <1 darker
  c = U.hex(c);
  if (f >= 1) { const t = f - 1; return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t].map((v) => U.clamp(Math.round(v), 0, 255)); }
  return [c[0] * f, c[1] * f, c[2] * f].map((v) => U.clamp(Math.round(v), 0, 255));
};
U.mix = function (a, b, t) { a = U.hex(a); b = U.hex(b); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)); };
U.css = function (c, a) { c = U.hex(c); return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

/* ---------------- PixelBuffer: fast pixel painting into ImageData ---------------- */
class PixelBuffer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
  }
  static pack(c, a) { c = U.hex(c); return (((a === undefined ? 255 : a) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  set(x, y, col) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = col; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : 0; }
  rect(x, y, w, h, col) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, col); }
  // 1px "selective outline": transparent pixels touching opaque ones get a darkened neighbour colour
  outline(factor, onlyBelow) {
    const w = this.w, h = this.h, src = this.data.slice(), f = factor || 0.45;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24) continue;
      let n = 0;
      if (x > 0 && src[y * w + x - 1] >>> 24) n = src[y * w + x - 1];
      else if (x < w - 1 && src[y * w + x + 1] >>> 24) n = src[y * w + x + 1];
      else if (y > 0 && src[(y - 1) * w + x] >>> 24) n = src[(y - 1) * w + x];
      else if (!onlyBelow && y < h - 1 && src[(y + 1) * w + x] >>> 24) n = src[(y + 1) * w + x];
      if (n) {
        const r = (n & 255) * f, g = ((n >> 8) & 255) * f, b = ((n >> 16) & 255) * f;
        this.data[y * w + x] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
    }
  }
  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
S77.PixelBuffer = PixelBuffer;

/* ---------------- Event bus (decouples systems; Phase 2 hooks in here) ---------------- */
S77.Events = {
  _h: {},
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return () => this.off(ev, fn); },
  off(ev, fn) { const a = this._h[ev]; if (a) this._h[ev] = a.filter((f) => f !== fn); },
  emit(ev, data) { const a = this._h[ev]; if (a) for (const f of a.slice()) { try { f(data); } catch (e) { console.error('[event ' + ev + ']', e); } } },
};

/* ---------------- storage that survives sandboxed iframes / private mode ---------------- */
S77.Store = (() => {
  const mem = {};
  let ok = false;
  try { const k = '__s77_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
  return {
    available: ok,
    get(k) { try { return ok ? localStorage.getItem(k) : k in mem ? mem[k] : null; } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; return true; } catch (e) { mem[k] = v; return false; } },
    remove(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } },
  };
})();

S77.nextFrame = () => new Promise((r) => setTimeout(r, 0));
