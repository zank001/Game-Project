/* sprites.js — every pixel in the game is generated here at runtime.
   • Tiles: 32x16 isometric diamonds with seasonal variants.
   • Vox: a tiny span/height-field "voxel" renderer that turns simple 3D part
     descriptions (boxes, gables, domes, spheres…) into shaded iso pixel art.
     Used for buildings, landmarks, trees, mountains.
   • Hand-placed pixel templates for characters, animals, vehicles and props. */
'use strict';
(function () {
  const U = S77.U, T = S77.T, O = S77.O, PB = S77.PixelBuffer;
  const C = (h) => U.hex(h);
  const pack = (c) => PB.pack(c);

  /* ======================= palette ======================= */
  const PAL = (S77.PAL = {
    grass: C('#6db04a'), grassD: C('#4e9338'), grassL: C('#8ccb5c'),
    dry: C('#b3b45e'), dryD: C('#958f48'), dryL: C('#cfc77a'),
    yard: C('#7cc05a'), forest: C('#3f7d3a'), forestD: C('#2f6530'), jungle: C('#2e6b3c'), hill: C('#5a9a45'),
    sand: C('#ecd9a0'), sandD: C('#d6bf82'), sandL: C('#f7ead0'),
    sea: C('#2e9bc8'), seaL: C('#5cc4e0'), deep: C('#1d6aa8'), deepL: C('#3184c0'), andaman: C('#27b3c2'),
    river: C('#5e9aa0'), riverL: C('#86b8b6'), lake: C('#3f97bf'),
    soil: C('#a8774a'), soilD: C('#8a5e38'), crop: C('#5f9d3a'), cropL: C('#7cbb48'),
    road: C('#5b5c63'), roadD: C('#4c4d54'), street: C('#6b6c72'), line: C('#f2d14b'), white: C('#f4f1e8'),
    pave: C('#cfc6b4'), paveD: C('#b6ad9a'), plaza: C('#c98a63'), plazaD: C('#a96f4d'), dirt: C('#b48c5c'), dirtD: C('#97724a'),
    mangrove: C('#4f7d5c'), mud: C('#6f6a4a'), foreign: C('#7d8a72'), foreignD: C('#6b7862'),
    bridge: C('#a9a8a6'), bridgeD: C('#86857f'), runway: C('#4a4b52'), cliff: C('#8a6644'), cliffD: C('#6c4e33'),
    concrete: C('#a7a39a'), rock: C('#8c8a80'), rockD: C('#6c6a62'), rockL: C('#b2afa4'),
    trunk: C('#7a5636'), trunkD: C('#5c3f26'), leaf: C('#3e8f3a'), leafD: C('#2d6e2e'), leafL: C('#5fb04a'),
    gold: C('#e9b83d'), goldD: C('#b9862a'), orange: C('#d9622b'), tile: C('#c24f2c'), green: C('#2f8f5f'), red: C('#c8382f'),
    glass: C('#5c86a8'), glassL: C('#9ac3dc'), lit: C('#ffd977'), litW: C('#fff2c0'), dark: C('#2b2a33'),
    wood: C('#9a6a3f'), woodD: C('#74502f'), woodL: C('#b88553'), cream: C('#efe3c6'), wallW: C('#f1ede4'),
    skinTones: ['#f3cfa8', '#e2b088', '#c98f63', '#9f6a45'].map(C),
  });

  /* ======================= tiles ======================= */
  // pixel rows of the 32x16 diamond (pixel-centre rule => seamless tiling)
  const ROWS = [];
  for (let r = 0; r < 16; r++) { const half = r < 8 ? 2 * r + 1 : 31 - 2 * r; ROWS.push([16 - half, 16 + half - 1]); }
  // local world coords for each diamond pixel (u along x, v along y; 0..1)
  const uvOf = (px, py) => { const sx = (px + 0.5 - 16) / 16, sy = (py + 0.5) / 8; return [(sx + sy) / 2, (sy - sx) / 2]; };

  const seasonOf = (month) => (month >= 11 || month <= 1 ? 'harvest' : month <= 4 ? 'dry' : month <= 7 ? 'planting' : 'green');
  S77.seasonOf = seasonOf;

  const tileCache = new Map();
  function makeTile(t, v, season, roadDir) {
    const pb = new PB(32, 16), rnd = U.rng(t * 1000 + v * 17 + 5);
    const put = (x, y, c) => pb.set(x, y, pack(c));
    const jit = (c, a) => U.shade(c, 1 + (rnd() - 0.5) * a);
    const fill = (fn) => { for (let y = 0; y < 16; y++) for (let x = ROWS[y][0]; x <= ROWS[y][1]; x++) { const c = fn(x, y); if (c) put(x, y, c); } };
    const speckle = (base, dk, lt, pd, pl) => fill(() => { const r = rnd(); return r < pd ? dk : r < pd + pl ? lt : jit(base, 0.04); });
    switch (t) {
      case T.GRASS: case T.YARD: case T.HILL: case T.FOREST: case T.JUNGLE: case T.PLANT: case T.ORCHARD: case T.DRYGRASS: {
        const base = { [T.GRASS]: PAL.grass, [T.YARD]: PAL.yard, [T.HILL]: PAL.hill, [T.FOREST]: PAL.forest, [T.JUNGLE]: PAL.jungle, [T.PLANT]: U.mix(PAL.forest, PAL.soil, 0.25), [T.ORCHARD]: U.mix(PAL.grass, PAL.forest, 0.4), [T.DRYGRASS]: PAL.dry }[t];
        const dk = U.shade(base, 0.82), lt = U.shade(base, 1.12);
        speckle(base, dk, lt, 0.16, 0.08);
        for (let k = 0; k < 4; k++) { // grass tufts
          const y = 3 + ((rnd() * 10) | 0), x = ROWS[y][0] + 2 + ((rnd() * Math.max(1, ROWS[y][1] - ROWS[y][0] - 4)) | 0);
          put(x, y, lt); put(x, y - 1, lt); put(x + 1, y, dk);
        }
        if ((t === T.GRASS || t === T.YARD) && v === 3) for (let k = 0; k < 3; k++) { const y = 4 + ((rnd() * 8) | 0), x = ROWS[y][0] + 3 + ((rnd() * (ROWS[y][1] - ROWS[y][0] - 6)) | 0); put(x, y, U.pick([C('#f6e15a'), C('#ffffff'), C('#f08ab0')], rnd())); }
        if (t === T.PLANT || t === T.FOREST || t === T.JUNGLE) for (let k = 0; k < 6; k++) { const y = 2 + ((rnd() * 12) | 0), x = ROWS[y][0] + 1 + ((rnd() * Math.max(1, ROWS[y][1] - ROWS[y][0] - 2)) | 0); put(x, y, C('#7a6a3a')); }
        break;
      }
      case T.PADDY: {
        const s = season;
        const water = C('#7fc4cf'), young = C('#8fd65a'), lush = C('#5cb43c'), gold = C('#e2c255'), goldD = C('#c9a43e'), stub = C('#c3a86c'), stubD = C('#a68a52');
        fill((x, y) => {
          const [u, w] = uvOf(x, y), row = (w * 5) % 1;
          if (s === 'planting') return row < 0.45 ? jit(water, 0.06) : (u * 9 + w * 3) % 1 < 0.5 ? young : jit(water, 0.1);
          if (s === 'green') return row < 0.25 ? U.shade(lush, 0.85) : jit(lush, 0.1);
          if (s === 'harvest') return row < 0.25 ? goldD : jit(gold, 0.1);
          return row < 0.3 ? stubD : jit(stub, 0.12);
        });
        // paddy bund (dike) along two edges
        const bund = s === 'planting' || s === 'green' ? C('#6a9a3e') : C('#9c8250');
        for (let y = 0; y < 8; y++) { put(ROWS[y][1], y, bund); put(ROWS[y][1] - 1, y, bund); }
        break;
      }
      case T.FIELD: {
        fill((x, y) => { const [u] = uvOf(x, y), row = (u * 4) % 1; return row < 0.5 ? jit(PAL.soil, 0.08) : rnd() < 0.7 ? jit(v & 1 ? PAL.crop : C('#8fae3c'), 0.12) : PAL.soilD; });
        break;
      }
      case T.SAND: speckle(PAL.sand, PAL.sandD, PAL.sandL, 0.1, 0.1); if (v === 2) { put(14, 8, C('#f3b9a0')); put(20, 6, C('#ffffff')); } break;
      case T.MANGROVE: speckle(PAL.mud, U.shade(PAL.mud, 0.8), U.mix(PAL.mud, PAL.sea, 0.4), 0.15, 0.25); break;
      case T.DIRT: speckle(PAL.dirt, PAL.dirtD, U.shade(PAL.dirt, 1.12), 0.15, 0.1); break;
      case T.FOREIGN: speckle(PAL.foreign, PAL.foreignD, U.shade(PAL.foreign, 1.08), 0.2, 0.05); break;
      case T.MOUNTAIN: speckle(PAL.forestD, U.shade(PAL.rockD, 0.9), PAL.rockD, 0.2, 0.2); break;
      case T.SEA: case T.DEEP: case T.RIVER: case T.LAKE: {
        const base = t === T.SEA ? (v & 4 ? PAL.andaman : PAL.sea) : t === T.DEEP ? PAL.deep : t === T.RIVER ? PAL.river : PAL.lake;
        const lt = t === T.DEEP ? PAL.deepL : t === T.RIVER ? PAL.riverL : PAL.seaL;
        fill(() => jit(base, 0.04));
        for (let k = 0; k < 3; k++) { const y = 3 + ((rnd() * 10) | 0), x = ROWS[y][0] + 2 + ((rnd() * Math.max(1, ROWS[y][1] - ROWS[y][0] - 6)) | 0); for (let q = 0; q < 3; q++) put(x + q, y, lt); }
        break;
      }
      case T.ROAD: case T.STREET: case T.BRIDGE: case T.RUNWAY: {
        const base = t === T.ROAD ? PAL.road : t === T.STREET ? PAL.street : t === T.BRIDGE ? PAL.bridge : PAL.runway;
        speckle(base, U.shade(base, 0.9), U.shade(base, 1.08), 0.12, 0.06);
        // centre line along the lane edge (roadDir 1: +y edge / 2: +x edge)
        const lineC = t === T.ROAD || t === T.BRIDGE ? PAL.line : PAL.white;
        if (roadDir === 1 || roadDir === 2) {
          for (let k = 2; k < 14; k++) {
            if ((k >> 1) % 2) continue;
            const px = roadDir === 1 ? 1 + k : 16 + k, py = roadDir === 1 ? 8 + (k >> 1) : 15 - (k >> 1);
            put(px, py - 1, lineC); put(px + 1, py - 1, lineC);
          }
        }
        if (t === T.RUNWAY && v < 2) for (let k = 6; k < 26; k += 1) if (k % 6 < 3) put(k, 8, PAL.white);
        if (t === T.BRIDGE) { for (let y = 0; y < 8; y++) { put(ROWS[y][0], y, PAL.bridgeD); put(ROWS[y][1], y, PAL.bridgeD); } }
        break;
      }
      case T.PAVE: {
        fill((x, y) => { const [u, w] = uvOf(x, y); const g = (u * 2) % 1 < 0.08 || (w * 2) % 1 < 0.08; return g ? PAL.paveD : jit(PAL.pave, 0.05); });
        break;
      }
      case T.PLAZA: {
        fill((x, y) => { const [u, w] = uvOf(x, y); const g = (u * 4) % 1 < 0.12 || (w * 2 + (Math.floor(u * 4) % 2) * 0.5) % 1 < 0.1; return g ? PAL.plazaD : jit(PAL.plaza, 0.06); });
        break;
      }
      default: speckle(PAL.grass, PAL.grassD, PAL.grassL, 0.15, 0.08);
    }
    return pb.toCanvas();
  }
  function tile(t, v, season, roadDir) {
    const k = t + ':' + v + ':' + (t === T.PADDY ? season : '') + ':' + (roadDir || 0);
    let c = tileCache.get(k);
    if (!c) { c = makeTile(t, v, season, roadDir); tileCache.set(k, c); }
    return c;
  }
  // 4px cliff strips below the south (+y) / east (+x) edges of land next to water
  const cliffCache = {};
  function cliff(side, kind) {
    const k = side + kind;
    if (cliffCache[k]) return cliffCache[k];
    const pb = new PB(16, 13);
    const base = kind === 'sand' ? C('#c9ae73') : kind === 'stone' ? PAL.concrete : PAL.cliff;
    for (let x = 0; x < 16; x++) {
      const y0 = side === 's' ? (x >> 1) : 7 - (x >> 1);
      for (let d = 0; d < 5; d++) pb.set(x, y0 + d + 1, pack(U.shade(base, d < 1 ? 1.1 : d > 3 ? 0.7 : 0.9 - (side === 'e' ? 0.12 : 0))));
    }
    return (cliffCache[k] = pb.toCanvas());
  }
  // shoreline foam overlay for a water tile; mask bits: 1=-x 2=-y 4=+x 8=+y land neighbours
  const foamCache = {};
  function foam(mask) {
    if (foamCache[mask]) return foamCache[mask];
    const pb = new PB(32, 16), c = pack(C('#e7f6f6')), c2 = pack(C('#bfe6ec'));
    for (let y = 0; y < 16; y++) for (let x = ROWS[y][0]; x <= ROWS[y][1]; x++) {
      const [u, w] = uvOf(x, y);
      let d = 9;
      if (mask & 1) d = Math.min(d, u); if (mask & 2) d = Math.min(d, w); if (mask & 4) d = Math.min(d, 1 - u); if (mask & 8) d = Math.min(d, 1 - w);
      if (d < 0.09) pb.set(x, y, c); else if (d < 0.17 && (x + y) % 3) pb.set(x, y, c2);
    }
    return (foamCache[mask] = pb.toCanvas());
  }

  /* ======================= voxel / span renderer ======================= */
  const R = 16; // samples per tile
  // material: { top: rgb | fn(i,j,z), side: rgb | fn(face,along,z,i,j), noise }
  const M = (top, side, noise, extra) => Object.assign({ top, side: side || top, noise: noise === undefined ? 0.06 : noise }, extra || {});
  function renderVox(fw, fd, maxZ, parts, opts) {
    opts = opts || {};
    const NI = Math.round(fw * R), NJ = Math.round(fd * R);
    const W = (fw + fd) * 16 + 4, H = Math.ceil((fw + fd) * 8 + maxZ + 8);
    const ox = fd * 16 + 2, oy = maxZ + 4;
    const pb = new PB(W, H);
    const sp = new Array(NI * NJ), top = new Float32Array(NI * NJ).fill(-1);
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      let list = null;
      for (const p of parts) { const s = p(i + 0.5, j + 0.5); if (s) { (list = list || []).push(s); } }
      if (list) { list.sort((a, b) => a[0] - b[0]); sp[j * NI + i] = list; let m = -1; for (const s of list) if (s[1] > m) m = s[1]; top[j * NI + i] = m; }
    }
    const tz = (i, j) => (i < 0 || j < 0 || i >= NI || j >= NJ ? -1 : top[j * NI + i]);
    const rnd = U.rng(opts.seed || 1);
    for (let d = 0; d < NI + NJ - 1; d++) {
      for (let i = Math.max(0, d - NJ + 1); i <= Math.min(NI - 1, d); i++) {
        const j = d - i, k = j * NI + i, list = sp[k];
        if (!list) continue;
        const sx = ox + (i - j), sy = oy + (i + j + 1) / 2;
        const zt = top[k];
        for (const [z0, z1, mat] of list) {
          const yTop = Math.floor(sy - z1), yBot = Math.floor(sy - z0);
          const nz = 1 + (rnd() - 0.5) * mat.noise;
          // body: left px = south face, right px = east face
          for (let y = yTop + 1; y <= yBot; y++) {
            const zz = sy - y;
            let cl = typeof mat.side === 'function' ? mat.side(0, i, zz, i, j) : mat.side;
            let cr = typeof mat.side === 'function' ? mat.side(1, j, zz, i, j) : mat.side;
            if (cl) pb.set(sx - 1, y, pack(U.shade(cl, 0.9 * nz)));
            if (cr) pb.set(sx, y, pack(U.shade(cr, 0.7 * nz)));
          }
          // top cap (shaded by slope of the height field)
          let c = typeof mat.top === 'function' ? mat.top(i, j, z1) : mat.top;
          if (!c) continue;
          let b = 1;
          if (z1 >= zt - 0.01) {
            const gi = tz(i + 1, j) - tz(i - 1, j), gj = tz(i, j + 1) - tz(i, j - 1);
            if (tz(i + 1, j) >= 0 && tz(i - 1, j) >= 0) b += 0.045 * gi * (mat.slopeK || 1);
            if (tz(i, j + 1) >= 0 && tz(i, j - 1) >= 0) b -= 0.05 * gj * (mat.slopeK || 1);
            if (tz(i, j + 1) < z1 - 3 || tz(i + 1, j) < z1 - 3) b += mat.rim === undefined ? 0.12 : mat.rim;
          }
          b = U.clamp(b, 0.55, 1.35) * nz;
          pb.set(sx - 1, yTop, pack(U.shade(c, b)));
          pb.set(sx, yTop, pack(U.shade(c, b * 0.97)));
        }
      }
    }
    if (opts.outline !== false) pb.outline(opts.outlineK || 0.5);
    const cv = pb.toCanvas();
    cv.ax = ox; cv.ay = oy; // pixel of footprint top corner (world tile (x,y) top corner)
    cv.fw = fw; cv.fd = fd;
    return cv;
  }
  // ---- part helpers (coords in samples; tile = 16 samples) ----
  const P = {
    box: (i0, j0, i1, j1, z0, z1, m) => (i, j) => (i >= i0 && i < i1 && j >= j0 && j < j1 ? [z0, z1, m] : null),
    // gable roof, ridge along axis ('x' => along i)
    gable: (i0, j0, i1, j1, zb, rise, axis, m, solid) => {
      const ci = (i0 + i1) / 2, cj = (j0 + j1) / 2, hi = (i1 - i0) / 2, hj = (j1 - j0) / 2;
      return (i, j) => {
        if (i < i0 || i >= i1 || j < j0 || j >= j1) return null;
        const t = axis === 'x' ? Math.abs(j - cj) / hj : Math.abs(i - ci) / hi;
        const z = zb + rise * (1 - t);
        return [solid ? zb - 1 : Math.max(zb - 2, z - 3), z, m];
      };
    },
    hip: (i0, j0, i1, j1, zb, rise, m, k) => {
      const ci = (i0 + i1) / 2, cj = (j0 + j1) / 2, hi = (i1 - i0) / 2, hj = (j1 - j0) / 2;
      return (i, j) => {
        if (i < i0 || i >= i1 || j < j0 || j >= j1) return null;
        const di = (hi - Math.abs(i - ci)), dj = (hj - Math.abs(j - cj));
        const z = zb + Math.min(rise, Math.min(di, dj) * (k || 1));
        return [zb - 1, z, m];
      };
    },
    dome: (ci, cj, r, zb, h, m) => (i, j) => { const d = Math.hypot(i - ci, j - cj); if (d >= r) return null; return [zb - 1, zb + h * Math.sqrt(1 - (d / r) ** 2), m]; },
    cyl: (ci, cj, r, z0, z1, m) => (i, j) => (Math.hypot(i - ci, j - cj) < r ? [z0, z1, m] : null),
    cone: (ci, cj, r, zb, h, m, pw) => (i, j) => { const d = Math.hypot(i - ci, j - cj); if (d >= r) return null; return [zb - 1, zb + h * Math.pow(1 - d / r, pw || 1), m]; },
    sphere: (ci, cj, cz, r, m, zs) => (i, j) => { const d2 = (i - ci) ** 2 + (j - cj) ** 2; if (d2 >= r * r) return null; const h = Math.sqrt(r * r - d2) * (zs || 1.25); return [cz - h, cz + h, m]; },
    // square stepped pyramid (chedi bases, prang bases)
    steps: (ci, cj, r0, zb, levels, dz, dr, m) => (i, j) => {
      const d = Math.max(Math.abs(i - ci), Math.abs(j - cj));
      let z = -1;
      for (let l = 0; l < levels; l++) if (d < r0 - l * dr) z = zb + (l + 1) * dz;
      return z < 0 ? null : [zb - 1, z, m];
    },
    // bell / profile around an axis: prof(t) gives radius at height t (0..1)
    lathe: (ci, cj, zb, h, prof, m) => (i, j) => {
      const d = Math.hypot(i - ci, j - cj);
      // highest z whose profile radius > d
      let best = -1;
      for (let s = 40; s >= 0; s--) { const t = s / 40; if (prof(t) > d) { best = zb + t * h; break; } }
      return best < 0 ? null : [zb - 1, best, m];
    },
  };
  // window/door facade helper -> side colour function
  function facade(wall, opts) {
    opts = opts || {};
    const win = opts.win || PAL.glass, period = opts.period || 8, ww = opts.ww || 4, floors = opts.floors || [], night = opts.night;
    const litChance = opts.lit === undefined ? 0.6 : opts.lit;
    return (face, along, z, i, j) => {
      if (opts.band && z >= opts.band[0] && z < opts.band[1]) return typeof opts.band[2] === 'function' ? opts.band[2](face, along) : opts.band[2];
      if (opts.door && face === opts.door.face && along >= opts.door.a0 && along < opts.door.a1 && z < opts.door.h) return z > opts.door.h - 2 ? U.shade(wall, 0.7) : opts.door.c || PAL.dark;
      for (const [f0, f1] of floors) {
        if (z >= f0 && z < f1) {
          const a = ((along + (opts.offset || 0)) % period + period) % period;
          if (a >= (period - ww) / 2 && a < (period + ww) / 2) {
            const cell = Math.floor((along + 64) / period) * 7 + Math.floor(f0) * 13 + face * 3;
            if (night) return U.hash2(cell, 3, 77) < litChance ? (z > f1 - 2 ? PAL.litW : PAL.lit) : U.shade(win, 0.45);
            return z > f1 - 2 ? U.shade(win, 1.25) : win;
          }
        }
      }
      if (opts.trim && z < 2) return opts.trim;
      return wall;
    };
  }

  /* ======================= building styles ======================= */
  const VAR = {
    wall: ['#f1ede4', '#f3e2b8', '#d9e6ec', '#f2d2c8', '#e1ecd2', '#efe0f0'].map(C),
    roof: ['#c24f2c', '#b5452f', '#3f6fa6', '#4f8a4f', '#8a4f8f', '#a0522d'].map(C),
    sign: ['#d23a3a', '#2f72c9', '#2e9e5b', '#e8a32c', '#8d4fc2', '#e05b9c'].map(C),
    sino: ['#f2c9c4', '#bfe0d6', '#f6e3a4', '#c8d8f0', '#e9c2e6', '#c9ecc0'].map(C),
  };
  // door descriptor (in samples) for facade()
  const doorOf = (b, w) => {
    if (!b.door) return null;
    if (b.door.side === 's') { const k = b.door.x - b.x; return { face: 0, a0: k * R + 5, a1: k * R + 11, h: w || 12 }; }
    if (b.door.side === 'e') { const k = b.door.y - b.y; return { face: 1, a0: k * R + 5, a1: k * R + 11, h: w || 12 }; }
    return null;
  };
  const STYLES = {};
  // ---- houses ----
  STYLES.house = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, v = b.variant, arch = b.arch || 'central';
    const parts = [];
    let h = 15, maxZ = 40;
    if (arch === 'isan' || (arch === 'central' && v % 3 === 0)) {
      // wooden stilt house: posts, open ground floor, wooden walls above
      const wall = arch === 'isan' ? PAL.wood : PAL.woodL;
      for (const [pi, pj] of [[2, 2], [fw - 3, 2], [2, fd - 3], [fw - 3, fd - 3], [fw / 2, fd - 3]]) parts.push(P.box(pi - 1, pj - 1, pi + 1, pj + 1, 0, 9, M(PAL.woodD)));
      parts.push(P.box(1, 1, fw - 1, fd - 1, 9, 22, M(wall, facade(wall, { floors: [[12, 18]], period: 10, ww: 4, win: PAL.woodD, night, lit: 0.5 }), 0.05)));
      const roof = arch === 'isan' ? (v & 1 ? C('#8f8f94') : C('#a0583a')) : PAL.tile;
      parts.push(P.gable(-1, -1, fw + 1, fd + 1, 22, 13, 'x', M(roof, U.shade(roof, 0.8), 0.04, { slopeK: 0.8 })));
      maxZ = 40;
    } else if (arch === 'lanna') {
      const wall = v & 1 ? PAL.wood : PAL.woodL;
      parts.push(P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[5, 11]], period: 11, ww: 4, win: PAL.woodD, door: doorOf(b, 11), night }))));
      const roof = C('#6b4a32');
      parts.push(P.gable(-1, -1, fw + 1, fd + 1, h, 15, 'x', M(roof, U.shade(roof, 0.8), 0.05)));
      // kalae: crossed horns at gable ends
      for (const gi of [0, fw - 1]) parts.push(P.box(gi, fd / 2 - 1, gi + 1, fd / 2 + 1, h + 14, h + 20, M(PAL.woodD)));
      maxZ = 42;
    } else {
      const sino = arch === 'sino' || arch === 'south';
      const wall = sino ? VAR.sino[v % 6] : VAR.wall[v % 6];
      parts.push(P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[5, 11]], period: 9, ww: 4, door: doorOf(b, 11), trim: U.shade(wall, 0.8), night }), 0.03)));
      const roof = VAR.roof[(v >> 3) % 6];
      parts.push(P.hip(-1, -1, fw + 1, fd + 1, h, 11, M(roof, U.shade(roof, 0.75), 0.05), 0.9));
      maxZ = 32;
    }
    return { parts, maxZ };
  };
  STYLES.grocery = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#c99a62');
    const parts = [
      P.box(1, 1, fw - 1, fd - 1, 0, 15, M(wall, facade(wall, { door: { face: 0, a0: 4, a1: fw - 4, h: 11, c: C('#3c3a40') }, night }))),
      P.box(0, fd - 4, fw, fd + 2, 11, 12, M(C('#2f72c9'), C('#2f72c9'), 0)), // awning
      P.gable(-1, -1, fw + 1, fd - 2, 15, 9, 'x', M(C('#8f8f94'))),
      P.box(4, fd + 1, 9, fd + 4, 0, 4, M(C('#d23a3a'))), // drink crates
    ];
    return { parts, maxZ: 30 };
  };
  STYLES.barn = () => {
    const fw = b0(16), parts = [];
    for (const [pi, pj] of [[2, 2], [13, 2], [2, 13], [13, 13]]) parts.push(P.box(pi - 1, pj - 1, pi + 1, pj + 1, 0, 5, M(PAL.woodD)));
    parts.push(P.box(1, 1, 15, 15, 5, 14, M(PAL.wood)));
    parts.push(P.gable(-1, -1, 17, 17, 14, 9, 'x', M(C('#c4a465'), C('#a88a50'))));
    return { parts, maxZ: 26 };
  };
  const b0 = (x) => x;
  // ---- shophouse rows (ตึกแถว) ----
  STYLES.shophouse = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, v = b.variant, sino = b.arch === 'sino';
    const wall = sino ? VAR.sino[v % 6] : [C('#e9e3d6'), C('#d8d2c4'), C('#efe6cf'), C('#dcd6cc')][v % 4];
    const h = b.h || 34;
    const units = Math.max(1, Math.round(b.fw / 2));
    const signC = (face, along) => VAR.sign[(Math.floor(along / (2 * R)) + v) % 6];
    const side = (face, along, z) => {
      if (face === 0 || (face === 1 && false)) {
        const u = along % (2 * R);
        if (z < 11) { // roll-up shutters / open shops
          if (u < 1 || u > 2 * R - 2) return U.shade(wall, 0.8);
          const open = (Math.floor(along / (2 * R)) + v) % 3 !== 0;
          if (open) return night ? PAL.lit : C('#4a4650');
          return (Math.floor(z) % 2 ? C('#a9adb4') : C('#8e9299'));
        }
        if (z >= 11 && z < 14) return signC(face, along);
        const fl = z < 24 ? [16, 22] : [26, 32];
        if (z >= fl[0] && z < fl[1] && u > 4 && u < 2 * R - 4 && (u < 13 || u > 19)) return night ? (U.hash2(Math.floor(along / 8), fl[0], v) < 0.55 ? PAL.lit : U.shade(PAL.glass, 0.45)) : sino && z > fl[1] - 2 ? U.shade(wall, 0.7) : PAL.glass;
        return (u < 1) ? U.shade(wall, 0.85) : wall;
      }
      // east face (end wall)
      if (z >= 11 && z < 14) return signC(face, along);
      return wall;
    };
    const parts = [P.box(0, 1, fw, fd, 0, h, M(wall, side, 0.02))];
    // parapet & roof
    parts.push(P.box(0, 1, fw, fd, h, h + 2, M(U.shade(wall, 0.9))));
    if (sino) parts.push(P.gable(0, 2, fw, fd - 1, h, 6, 'x', M(PAL.tile)));
    else for (let k = 0; k < units; k++) parts.push(P.box(k * 2 * R + 4, 5, k * 2 * R + 9, 10, h, h + 4, M(C('#c0c4c8')))); // water tanks
    // awnings
    parts.push(P.box(0, fd - 1, fw, fd + 3, 10, 11, M((face) => C('#3f7fbf'), C('#2f6aa8'), 0)));
    return { parts, maxZ: h + 12 };
  };
  // ---- towers / condos / offices ----
  STYLES.tower = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, v = b.variant, h = b.h || 60;
    const glass = [C('#4f8fb0'), C('#5f7f9a'), C('#3f9a9a'), C('#7a8fb0')][v % 4];
    const side = (face, along, z) => {
      if (z < 6) return along % 8 < 6 ? (night ? PAL.lit : C('#33404f')) : C('#cfd3d6');
      if (Math.floor(z) % 6 === 0) return C('#cfd3d6');
      const lit = night && U.hash2(Math.floor(along / 4), Math.floor(z / 6), v + face) < 0.45;
      return lit ? PAL.lit : (z % 6) > 4 ? U.shade(glass, 1.3) : glass;
    };
    const parts = [P.box(2, 2, fw - 2, fd - 2, 0, h, M(C('#cfd3d6'), side, 0.02)), P.box(5, 5, fw - 5, fd - 5, h, h + 5, M(C('#9aa0a6')))];
    if (v % 3 === 0) parts.push(P.cyl(fw / 2, fd / 2, 1, h, h + 18, M(C('#d0d0d0'))));
    return { parts, maxZ: h + 22 };
  };
  STYLES.condo = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, v = b.variant, h = b.h || 60, wall = VAR.wall[v % 6];
    const side = (face, along, z) => {
      if (Math.floor(z) % 8 < 2) return C('#ffffff');
      const a = along % 8;
      if (a > 1 && a < 7) return night && U.hash2(Math.floor(along / 8), Math.floor(z / 8), v + face) < 0.5 ? PAL.lit : PAL.glass;
      return wall;
    };
    return { parts: [P.box(2, 2, fw - 2, fd - 2, 0, h, M(wall, side, 0.02)), P.box(4, 4, fw - 4, fd - 4, h, h + 4, M(C('#b8b8b8')))], maxZ: h + 8 };
  };
  STYLES.office = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = b.h || 24, wall = C('#c7d3dc');
    return { parts: [P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[4, 10], [13, 19], [22, h - 2]], period: 6, ww: 4, door: doorOf(b), night, win: C('#4a7ea6') }), 0.02)), P.box(1, 1, fw - 1, fd - 1, h, h + 2, M(C('#8a96a0')))], maxZ: h + 6 };
  };
  // ---- civic ----
  STYLES.hall = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#f3ecd8'), h = 22;
    const parts = [
      P.box(0, 2, fw, fd, 0, 2, M(C('#d6d0c0'))),
      P.box(2, 3, fw - 2, fd - 2, 0, h, M(wall, facade(wall, { floors: [[4, 9], [13, 18]], period: 7, ww: 3, door: doorOf(b, 13), night, win: C('#6a7f94') }), 0.02)),
      P.gable(0, 1, fw, fd - 1, h, 14, 'x', M(C('#b84a2a'), C('#d9b45a'), 0.04)),
      // central gable (portico) with gold pediment
      P.box(fw / 2 - 12, fd - 6, fw / 2 + 12, fd + 2, 0, h - 2, M(wall, facade(wall, { floors: [[0, 14]], period: 6, ww: 2, win: U.shade(wall, 0.75) }))),
      P.gable(fw / 2 - 13, fd - 8, fw / 2 + 13, fd + 3, h - 2, 14, 'y', M(C('#b84a2a'), PAL.gold)),
    ];
    return { parts, maxZ: h + 30 };
  };
  STYLES.temple = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, big = b.type === 'landmark';
    const wall = C('#f6f1e6'), h = fw > 40 ? 16 : 13;
    const hi = fw * 0.72;
    const roofM = M((i, j) => (j < 3 || j > fd - 4 || i < 2 || i > hi - 3 ? PAL.green : PAL.orange), PAL.gold, 0.03, { rim: 0.2 });
    const parts = [
      P.box(0, 1, hi, fd - 1, 0, 3, M(C('#e8dcc4'))),
      P.box(3, 4, hi - 3, fd - 4, 3, h + 3, M(wall, facade(wall, { floors: [[6, h]], period: 8, ww: 3, win: C('#7a3b2a'), door: doorOf(b, h), night, lit: 0.8 }), 0.02)),
      P.gable(1, 2, hi - 1, fd - 2, h + 3, 13, 'x', roofM),
      P.gable(6, 5, hi - 6, fd - 5, h + 11, 12, 'x', roofM),
      // chofa (gold finials) at the ridge ends
      P.box(1, fd / 2 - 1, 3, fd / 2 + 1, h + 14, h + 23, M(PAL.gold)),
      P.box(hi - 3, fd / 2 - 1, hi - 1, fd / 2 + 1, h + 14, h + 23, M(PAL.gold)),
    ];
    // small chedi in the free corner
    const ci = hi + (fw - hi) / 2, cj = fd / 2, cr = Math.min((fw - hi) / 2, fd / 2) - 1;
    if (cr > 3) {
      parts.push(P.steps(ci, cj, cr, 0, 2, 3, 2, M(C('#f1ece2'))));
      parts.push(P.lathe(ci, cj, 6, 26, (t) => (t < 0.45 ? cr * 0.75 * (1 - t * 0.5) : t < 0.55 ? cr * 0.4 : cr * 0.35 * (1 - (t - 0.55) / 0.45) + 0.4), M(big ? PAL.gold : C('#f4efe6'), null, 0.03)));
    }
    return { parts, maxZ: h + 40 };
  };
  STYLES.mosque = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#f2f0ea'), h = 16, dome = b.variant & 1 ? C('#2f9a5f') : C('#d8b23a');
    const parts = [
      P.box(2, 2, fw - 2, fd - 2, 0, h, M(wall, facade(wall, { floors: [[4, 12]], period: 8, ww: 4, win: C('#2f7a5a'), door: doorOf(b, 12), night }), 0.02)),
      P.box(2, 2, fw - 2, fd - 2, h, h + 2, M(C('#e0dcd0'))),
      P.dome(fw / 2, fd / 2, Math.min(fw, fd) / 2 - 6, h + 2, 18, M(dome, null, 0.03)),
      P.cyl(fw / 2, fd / 2, 1, h + 18, h + 24, M(PAL.gold)),
      P.cyl(fw - 4, fd - 4, 2.2, 0, h + 26, M(wall)),
      P.dome(fw - 4, fd - 4, 3, h + 26, 4, M(dome)),
    ];
    return { parts, maxZ: h + 34 };
  };
  STYLES.cjshrine = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#c8382f'), h = 12;
    return {
      parts: [
        P.box(0, 1, fw, fd, 0, 2, M(C('#cfc6b4'))),
        P.box(2, 3, fw - 2, fd - 2, 2, h + 2, M(wall, facade(wall, { floors: [[4, 10]], period: 10, ww: 4, win: PAL.gold, door: doorOf(b, 10), night }))),
        P.gable(0, 1, fw, fd, h + 2, 9, 'x', M(C('#2f8f5f'), PAL.gold)),
        P.box(-1, fd / 2 - 1, 2, fd / 2 + 1, h + 6, h + 12, M(PAL.gold)), P.box(fw - 2, fd / 2 - 1, fw + 1, fd / 2 + 1, h + 6, h + 12, M(PAL.gold)),
      ], maxZ: h + 22,
    };
  };
  STYLES.pillar = (b) => { // ศาลหลักเมือง: small pavilion with prang spire
    const fw = b.fw * R, fd = b.fd * R, c = fw / 2, wall = C('#f4efe6');
    return {
      parts: [
        P.steps(c, c, fw / 2 - 1, 0, 2, 2, 2, M(C('#e0d6c0'))),
        P.box(8, 8, fw - 8, fd - 8, 4, 14, M(wall, facade(wall, { floors: [[4, 12]], period: 16, ww: 6, win: C('#b0302a') }))),
        P.hip(5, 5, fw - 5, fd - 5, 14, 6, M(C('#c24f2c'), PAL.gold)),
        P.lathe(c, c, 18, 22, (t) => 6 * (1 - t) + 0.6, M(PAL.gold)),
      ], maxZ: 44,
    };
  };
  STYLES.market = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, roof = b.variant & 1 ? C('#4f7fae') : C('#b06a3a');
    const parts = [];
    for (let i = 3; i < fw; i += 16) for (const j of [3, fd - 3]) parts.push(P.box(i - 1, j - 1, i + 1, j + 1, 0, 14, M(C('#8a8a90'))));
    // stalls with colourful goods
    const stall = (face, along, z) => (z > 6 ? null : VAR.sign[(Math.floor(along / 5) + face) % 6]);
    parts.push(P.box(4, 4, fw - 4, fd - 4, 0, 6, M((i, j) => U.hash2(i >> 2, j >> 2, 3) < 0.5 ? C('#e8c14a') : C('#d9573a'), stall, 0.1)));
    parts.push(P.gable(-1, -1, fw + 1, fd + 1, 14, 10, 'x', M(roof, U.shade(roof, 0.75))));
    return { parts, maxZ: 30 };
  };
  STYLES.store = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 16, wall = C('#f4f4f2');
    const band = [C('#2e9e5b'), C('#e8732c'), C('#d23a3a')][b.variant % 3];
    const side = (face, along, z) => {
      if (z >= 11 && z < 13) return band;
      if (z >= 13 && z < 14) return C('#e8a32c');
      if (z < 10 && along % 12 > 1) return night ? PAL.litW : C('#9cc4d8');
      return wall;
    };
    return { parts: [P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, side, 0.01)), P.box(1, 1, fw - 1, fd - 1, h, h + 1, M(C('#d8d8d8'))), P.box(4, 4, 10, 10, h, h + 4, M(C('#b8bcc0')))], maxZ: h + 8 };
  };
  STYLES.restaurant = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 15, wall = [C('#f3d38a'), C('#e8b77a'), C('#f2e2c0')][b.variant % 3];
    const parts = [
      P.box(1, 1, fw - 1, fd - 4, 0, h, M(wall, facade(wall, { floors: [[2, 11]], period: 10, ww: 7, win: night ? PAL.lit : C('#5a3e2e'), night }))),
      P.gable(-1, -1, fw + 1, fd - 3, h, 9, 'x', M(PAL.tile)),
      P.box(0, fd - 5, fw, fd + 1, 10, 11, M((i) => ((i >> 2) % 2 ? C('#d23a3a') : C('#f4f1e8')), C('#d23a3a'), 0)),
    ];
    for (let i = 6; i < fw - 4; i += 10) parts.push(P.box(i, fd - 2, i + 4, fd + 1, 0, 4, M(C('#c8c8c8')))); // tables
    return { parts, maxZ: h + 14 };
  };
  STYLES.lodge = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 40, wall = [C('#f2ece0'), C('#e7f0f3'), C('#f6e7d0'), C('#e9e2f2')][b.variant % 4];
    return {
      parts: [
        P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[4, 10], [13, 18], [21, 26], [29, 34]], period: 8, ww: 5, door: doorOf(b, 10), night, lit: 0.55, band: [10, 12, C('#c49a4a')] }), 0.02)),
        P.box(1, 1, fw - 1, fd - 1, h, h + 2, M(C('#a8a19a'))),
        P.box(fw / 2 - 6, fd - 2, fw / 2 + 6, fd, h - 6, h + 2, M(C('#d23a3a'))), // sign
      ], maxZ: h + 6,
    };
  };
  STYLES.bus = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#e9e4d8');
    const parts = [P.box(1, 1, fw / 3, fd - 1, 0, 14, M(wall, facade(wall, { floors: [[3, 10]], period: 6, ww: 4, door: doorOf(b, 10), night })))];
    for (let i = fw / 3 + 6; i < fw; i += 14) parts.push(P.box(i - 1, 2, i + 1, 4, 0, 13, M(C('#9a9aa0'))));
    parts.push(P.box(fw / 3, 0, fw, fd, 13, 15, M(C('#3f7fbf'), C('#2f6aa8'))));
    parts.push(P.gable(0, 0, fw / 3 + 1, fd, 14, 6, 'x', M(C('#3f7fbf'))));
    // parked buses
    const busM = (c) => M(c, (face, along, z) => (z > 6 && z < 10 ? (night ? PAL.lit : C('#2a3a4a')) : c));
    parts.push(P.box(fw / 3 + 4, 6, fw - 4, 13, 1, 11, busM(C('#e8732c'))));
    parts.push(P.box(fw / 3 + 4, 16, fw - 8, 23, 1, 11, busM(C('#2f72c9'))));
    return { parts, maxZ: 28 };
  };
  STYLES.train = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, wall = C('#f2df9a');
    return {
      parts: [
        P.box(0, fd - 6, fw, fd, 0, 2, M(C('#c8c0b0'))),
        P.box(4, 2, fw - 18, fd - 6, 0, 14, M(wall, facade(wall, { floors: [[3, 11]], period: 8, ww: 4, win: C('#7a4a2a'), door: doorOf(b, 11), night }), 0.03)),
        P.gable(2, 0, fw - 16, fd - 4, 14, 9, 'x', M(C('#b5452f'))),
        P.box(fw - 18, 2, fw, fd - 2, 12, 13, M(C('#8a3a2a'))),
        P.box(fw - 16, 3, fw - 15, 4, 0, 12, M(PAL.woodD)), P.box(fw - 3, 3, fw - 2, 4, 0, 12, M(PAL.woodD)),
      ], maxZ: 30,
    };
  };
  STYLES.airport = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, glass = C('#6fa6c8');
    const side = (face, along, z) => (z < 3 ? C('#d8dde0') : night ? (U.hash2(along >> 3, 1, face) < 0.7 ? PAL.litW : glass) : (along % 10 < 1 ? C('#e8eef2') : glass));
    return {
      parts: [
        P.box(1, 2, fw - 14, fd - 1, 0, 18, M(C('#e8eef2'), side, 0.01)),
        P.gable(0, 1, fw - 13, fd, 18, 5, 'y', M(C('#f4f6f8'))),
        P.cyl(fw - 7, fd / 2, 4, 0, 40, M(C('#e8eef2'), facade(C('#e8eef2'), { floors: [[10, 14], [20, 24]], period: 5, ww: 2, night }))),
        P.cyl(fw - 7, fd / 2, 6, 40, 47, M(C('#4f6f8a'), (f, a, z) => (night ? PAL.litW : C('#6f9fbf')))),
        P.cyl(fw - 7, fd / 2, 5, 47, 50, M(C('#d8dde0'))),
      ], maxZ: 54,
    };
  };
  STYLES.hospital = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 34, wall = C('#f6f7f8');
    const parts = [
      P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[4, 10], [13, 19], [22, 28]], period: 7, ww: 4, door: doorOf(b, 10), night, band: [11, 12, C('#3a9ad0')] }), 0.01)),
      P.box(1, 1, fw - 1, fd - 1, h, h + 2, M(C('#c8ccd0'))),
      // blue cross sign on roof
      P.box(fw / 2 - 2, fd / 2 - 6, fw / 2 + 2, fd / 2 + 6, h + 2, h + 10, M(C('#2f7fd0'))),
      P.box(fw / 2 - 6, fd / 2 - 2, fw / 2 + 6, fd / 2 + 2, h + 2, h + 10, M(C('#2f7fd0'))),
    ];
    return { parts, maxZ: h + 14 };
  };
  STYLES.school = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 26, wall = C('#f3e4a8');
    return {
      parts: [
        P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[3, 9], [12, 18], [20, 25]], period: 9, ww: 5, door: doorOf(b, 9), night, lit: 0.2, band: [10, 11, C('#ffffff')] }), 0.02)),
        P.hip(-1, -1, fw + 1, fd + 1, h, 9, M(C('#b5452f'), C('#8a3a2a')), 0.8),
      ], maxZ: h + 14,
    };
  };
  STYLES.police = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 20, wall = C('#efe6d2');
    return {
      parts: [
        P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[4, 9], [12, 17]], period: 8, ww: 4, door: doorOf(b, 9), night, band: [9, 11, C('#6b3a1f')] }), 0.02)),
        P.hip(-1, -1, fw + 1, fd + 1, h, 8, M(C('#6b3a1f')), 0.8),
      ], maxZ: h + 12,
    };
  };
  STYLES.bank = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 20, wall = C('#e8e8ea');
    const sign = VAR.sign[b.variant % 6];
    return {
      parts: [
        P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, facade(wall, { floors: [[3, 10], [13, 17]], period: 6, ww: 3, door: doorOf(b, 10), night, band: [10, 13, sign] }), 0.01)),
        P.box(1, 1, fw - 1, fd - 1, h, h + 2, M(sign)),
      ], maxZ: h + 6,
    };
  };
  STYLES.sala = (b) => {
    const fw = b.fw * R, fd = b.fd * R, parts = [P.box(1, 1, fw - 1, fd - 1, 0, 2, M(C('#d6c8a8')))];
    for (const i of [3, fw - 4, fw / 2]) for (const j of [3, fd - 4]) parts.push(P.box(i - 1, j - 1, i + 1, j + 1, 2, 12, M(C('#f1ece2'))));
    parts.push(P.gable(-1, -1, fw + 1, fd + 1, 12, 11, 'x', M((i, j) => (j < 3 || j > fd - 3 ? PAL.green : PAL.tile), PAL.gold)));
    parts.push(P.box(-1, fd / 2 - 1, 1, fd / 2 + 1, 18, 24, M(PAL.gold)), P.box(fw - 1, fd / 2 - 1, fw + 1, fd / 2 + 1, 18, 24, M(PAL.gold)));
    return { parts, maxZ: 30 };
  };
  STYLES.mall = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 36, wall = C('#e7e3dc');
    const side = (face, along, z) => {
      if (z > 14 && z < 30 && along % 40 > 6 && along % 40 < 30) return VAR.sign[(Math.floor(along / 40) + face) % 6];
      if (z < 9) return night ? PAL.litW : C('#9cc4d8');
      if (Math.floor(z) % 10 < 2) return C('#bfb8ae');
      return wall;
    };
    return { parts: [P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, side, 0.01)), P.box(8, 8, fw - 8, fd - 8, h, h + 6, M(C('#8fb8d0'))), P.box(fw - 14, 4, fw - 6, 12, h, h + 4, M(C('#b8bcc0')))], maxZ: h + 10 };
  };
  STYLES.factory = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 18, wall = C('#c9cdd2');
    const parts = [P.box(1, 1, fw - 1, fd - 1, 0, h, M(wall, (f, a, z) => (z > 12 && z < 16 && a % 10 < 6 ? (night ? PAL.lit : C('#6a8aa0')) : Math.floor(a) % 4 === 0 ? U.shade(wall, 0.85) : wall), 0.02))];
    for (let i = 1; i < fw - 1; i += 12) parts.push(P.gable(i, 1, i + 12, fd - 1, h, 6, 'y', M(C('#8f959c'))));
    parts.push(P.cyl(fw - 6, 6, 3, 0, 46, M(C('#b0a090'), (f, a, z) => (z > 40 ? C('#c8382f') : C('#b0a090')))));
    return { parts, maxZ: 52 };
  };
  STYLES.parliament = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 26, wall = C('#efe7d2');
    return {
      parts: [
        P.steps(fw / 2, fd / 2, Math.min(fw, fd) / 2, 0, 2, 2, 3, M(C('#d6ccb4'))),
        P.box(8, 8, fw - 8, fd - 8, 4, h, M(wall, facade(wall, { floors: [[8, 20]], period: 5, ww: 2, win: PAL.goldD, door: doorOf(b, 18), night }), 0.01)),
        P.box(8, 8, fw - 8, fd - 8, h, h + 3, M(PAL.gold)),
        P.box(fw / 2 - 16, fd / 2 - 10, fw / 2 + 16, fd / 2 + 10, h + 3, h + 14, M(PAL.gold, PAL.goldD)),
      ], maxZ: h + 20,
    };
  };
  STYLES.govhouse = (b, night) => {
    const fw = b.fw * R, fd = b.fd * R, h = 20, wall = C('#f2e9d6');
    return {
      parts: [
        P.box(2, 2, fw - 2, fd - 2, 0, h, M(wall, facade(wall, { floors: [[4, 10], [13, 18]], period: 7, ww: 3, door: doorOf(b, 11), night, win: C('#7a6a5a') }), 0.02)),
        P.hip(0, 0, fw, fd, h, 10, M(C('#c26a3a'), C('#a0522d')), 0.7),
        P.cone(fw / 2, fd / 2, 6, h + 6, 22, M(PAL.gold), 1.4),
      ], maxZ: h + 32,
    };
  };

  /* ---------- landmarks ---------- */
  const LM = {};
  LM.swing = () => { // Giant Swing
    const red = C('#c8382f');
    return {
      parts: [P.steps(24, 24, 20, 0, 2, 2, 4, M(C('#d0c6b0'))), P.box(10, 22, 13, 26, 4, 64, M(red)), P.box(35, 22, 38, 26, 4, 64, M(red)), P.box(8, 21, 40, 27, 60, 66, M(red)), P.box(5, 22, 43, 26, 66, 68, M(red))],
      maxZ: 72,
    };
  };
  LM.tower = (b) => { // clock tower (gold for Chiang Rai)
    const gold = b.prov === S77.PROV_BY_KEY.chiangrai.idx, c = gold ? PAL.gold : C('#f2ece0');
    const side = (face, along, z) => (z > 34 && z < 42 && (along % 16) > 4 && (along % 16) < 12 ? C('#ffffff') : z > 34 && z < 42 ? U.shade(c, 0.8) : c);
    return { parts: [P.steps(24, 24, 18, 0, 2, 2, 4, M(C('#d0c6b0'))), P.box(16, 16, 32, 32, 4, 46, M(c, side, 0.02)), P.box(14, 14, 34, 34, 46, 48, M(U.shade(c, 0.85))), P.cone(24, 24, 11, 48, 22, M(gold ? C('#f0c84a') : C('#c24f2c')), 1)], maxZ: 74 };
  };
  LM.chedi = (b, night, goldOverride) => {
    const gold = goldOverride || b.lm === 'goldchedi', body = gold ? PAL.gold : C('#f6f2ea');
    return {
      parts: [
        P.steps(24, 24, 22, 0, 3, 3, 4, M(gold ? C('#efe3c0') : C('#e6dece'))),
        P.lathe(24, 24, 9, 62, (t) => (t < 0.08 ? 15 : t < 0.42 ? 14 * Math.cos((t - 0.08) * 2.6) + 2 : t < 0.5 ? 5 : 4.2 * (1 - (t - 0.5) / 0.5) + 0.5), M(body, null, 0.02, { rim: 0.25 })),
      ], maxZ: 76,
    };
  };
  LM.goldchedi = (b, n) => LM.chedi(b, n, true);
  LM.prang = () => {
    const stone = C('#c9a27a');
    return { parts: [P.steps(24, 24, 22, 0, 3, 4, 3, M(U.shade(stone, 0.9))), P.box(14, 14, 34, 34, 12, 30, M(stone, (f, a, z) => (z > 14 && z < 24 && a % 20 > 7 && a % 20 < 13 ? C('#3a2a22') : stone))), P.lathe(24, 24, 30, 36, (t) => 10 * Math.pow(1 - t, 0.8) * (1 + 0.12 * Math.sin(t * 28)) + 0.5, M(stone, null, 0.08))], maxZ: 72 };
  };
  LM.ruins = () => {
    const brick = C('#b8644a'), parts = [P.box(2, 2, 46, 46, 0, 2, M(C('#9a8a6a')))];
    parts.push(P.steps(30, 18, 14, 2, 3, 4, 3, M(brick)));
    parts.push(P.lathe(30, 18, 14, 32, (t) => (t < 0.4 ? 8 * (1 - t) : 5 * (1 - (t - 0.4) / 0.6) + 0.3) * (t > 0.85 ? 0 : 1), M(brick, null, 0.12)));
    for (let k = 0; k < 6; k++) { const i = 6 + k * 6, j = 36, hh = 10 + ((k * 37) % 13); parts.push(P.cyl(i, j, 2, 2, hh, M(brick, null, 0.12))); }
    for (let k = 0; k < 3; k++) parts.push(P.cyl(8, 8 + k * 9, 2, 2, 8 + k * 4, M(brick, null, 0.12)));
    return { parts, maxZ: 52 };
  };
  const figure = (ci, cj, zb, scale, c) => [ // simple standing statue silhouette
    P.cyl(ci, cj, 2.6 * scale, zb, zb + 12 * scale, M(c)), P.box(ci - 4 * scale, cj - 2 * scale, ci + 4 * scale, cj + 2 * scale, zb + 10 * scale, zb + 22 * scale, M(c)),
    P.sphere(ci, cj, zb + 26 * scale, 3.2 * scale, M(c), 1.2), P.box(ci + 3 * scale, cj - 1, ci + 5 * scale, cj + 1, zb + 12 * scale, zb + 21 * scale, M(c)),
  ];
  LM.statue = (b) => {
    const bronze = C('#6f5a3a');
    return { parts: [P.steps(24, 24, 18, 0, 2, 3, 4, M(C('#d8d0c0'))), P.box(17, 17, 31, 31, 6, 22, M(C('#c8c0b0'))), ...figure(24, 24, 22, 1.4, bronze)], maxZ: 80 };
  };
  LM.gate = () => {
    const brick = C('#b5583e');
    return { parts: [P.box(0, 18, 18, 30, 0, 30, M(brick, null, 0.1)), P.box(30, 18, 48, 30, 0, 30, M(brick, null, 0.1)), P.box(0, 18, 48, 30, 22, 32, M(brick, null, 0.1)), P.gable(14, 16, 34, 32, 32, 12, 'x', M(C('#6b4a32'))), P.box(0, 16, 48, 18, 30, 33, M(U.shade(brick, 0.85)))], maxZ: 50 };
  };
  LM.pavilion = (b) => {
    const parts = [P.box(0, 0, 48, 48, 0, 2, M(PAL.wood))];
    for (const i of [8, 40]) for (const j of [8, 40]) parts.push(P.box(i - 1, j - 1, i + 1, j + 1, 2, 18, M(PAL.woodD)));
    parts.push(P.gable(2, 2, 46, 46, 18, 18, 'x', M((i, j) => (j < 6 || j > 42 ? PAL.green : PAL.tile), PAL.gold)));
    parts.push(P.box(2, 23, 5, 25, 32, 42, M(PAL.gold)), P.box(43, 23, 46, 25, 32, 42, M(PAL.gold)));
    return { parts, maxZ: 48 };
  };
  LM.lighthouse = (b, night) => {
    const side = (f, a, z) => (Math.floor(z / 10) % 2 ? C('#c8382f') : C('#f4f1e8'));
    return { parts: [P.cyl(24, 24, 14, 0, 4, M(C('#c0b8a8'))), P.lathe(24, 24, 4, 56, (t) => 9 - t * 4, M(C('#f4f1e8'), side, 0.02)), P.cyl(24, 24, 6, 60, 68, M(night ? PAL.litW : C('#ffe9a0'))), P.cone(24, 24, 7, 68, 8, M(C('#2f2f38')))], maxZ: 82 };
  };
  LM.bridge = () => {
    const steel = C('#4c5058'), parts = [P.box(0, 20, 48, 28, 6, 9, M(C('#7a7a80')))];
    for (const i of [2, 46]) parts.push(P.box(i - 2, 20, i + 2, 28, 0, 9, M(C('#9a9a9a'))));
    // truss arches
    parts.push((i, j) => { if (j < 20 || j >= 28 || (j > 21 && j < 26)) return null; const t = (i % 24) / 24, z = 9 + 18 * Math.sin(t * Math.PI); return [z - 2, z, M(steel)]; });
    parts.push((i, j) => (j >= 20 && j < 28 && !(j > 21 && j < 26) && i % 6 < 1.5 ? [9, 9 + 18 * Math.sin(((i % 24) / 24) * Math.PI), M(steel)] : null));
    return { parts, maxZ: 34 };
  };
  LM.waterfall = (b, night) => {
    const parts = [P.cone(30, 18, 18, 0, 46, M(PAL.rock, null, 0.15), 0.7), P.cone(14, 12, 12, 0, 30, M(PAL.forest, null, 0.15), 0.8)];
    parts.push((i, j) => (i > 26 && i < 32 && j > 30 && j < 34 ? [0, 40, M(C('#e8f6ff'), (f, a, z) => (Math.floor(z + a) % 5 ? C('#cfeefa') : C('#ffffff')), 0.02)] : null));
    parts.push(P.cyl(29, 40, 9, 0, 1.5, M(C('#5cb8d8'))));
    return { parts, maxZ: 52 };
  };
  LM.karst = () => ({ parts: [P.lathe(24, 24, 0, 70, (t) => 12 + 3 * Math.sin(t * 9) - t * 4, M((i, j, z) => (z > 64 ? PAL.leaf : PAL.rockL), (f, a, z) => (Math.floor(z * 0.4 + a * 0.7) % 7 === 0 ? PAL.rockD : U.hash2(a >> 1, z >> 2, 4) < 0.15 ? PAL.leafD : PAL.rockL), 0.1))], maxZ: 76 });
  LM.rock = () => ({ parts: [P.sphere(16, 26, 10, 12, M(PAL.rock, null, 0.12)), P.sphere(32, 20, 14, 12, M(PAL.rock, null, 0.12)), P.sphere(26, 34, 8, 9, M(PAL.rockL, null, 0.12))], maxZ: 34 });
  LM.mermaid = () => ({ parts: [P.sphere(24, 28, 4, 14, M(PAL.rock, null, 0.15), 0.8), ...figure(24, 26, 14, 1.2, PAL.gold)], maxZ: 56 });
  LM.dino = () => {
    const g = C('#5f8f4a');
    return { parts: [P.box(4, 4, 44, 44, 0, 3, M(C('#c8b890'))), P.sphere(24, 28, 16, 10, M(g), 1.0), P.cyl(16, 30, 2.5, 3, 12, M(g)), P.cyl(32, 30, 2.5, 3, 12, M(g)), P.cyl(18, 22, 2.5, 3, 12, M(g)), P.cyl(30, 22, 2.5, 3, 12, M(g)), (i, j) => { if (j < 26 || j > 30) return null; if (i >= 4 && i < 18) return [18 + (18 - i) * 1.6, 22 + (18 - i) * 1.6, M(g)]; return null; }, P.sphere(4, 28, 44, 4, M(g)), (i, j) => (i > 32 && i < 46 && j > 26 && j < 30 ? [12, 16 - (i - 32) * 0.6, M(g)] : null)], maxZ: 56 };
  };
  LM.mosque = (b, night) => {
    const r = STYLES.mosque(Object.assign({}, b, { fw: 3, fd: 3, variant: 1 }), night);
    return r;
  };
  LM.shrine = (b, night) => STYLES.cjshrine(Object.assign({}, b, { fw: 3, fd: 3 }), night);
  LM.templebig = (b, night) => STYLES.temple(Object.assign({}, b, { fw: 3, fd: 3 }), night);

  /* ---------- building sprite cache ---------- */
  const bCache = new Map();
  function building(b, night) {
    const lmKey = b.type === 'landmark' ? b.lm + b.prov : '';
    const dk = b.door ? b.door.side + (b.door.side === 's' ? b.door.x - b.x : b.door.y - b.y) : '';
    const key = b.style + ':' + b.fw + 'x' + b.fd + ':' + (b.h || 0) + ':' + (b.variant % 6) + ':' + (b.arch || '') + ':' + dk + ':' + lmKey + (night ? ':n' : '');
    let c = bCache.get(key);
    if (c) return c;
    let def;
    if (b.type === 'landmark') def = (LM[b.lm] || LM.statue)(b, night);
    else def = (STYLES[b.style] || STYLES.house)(b, night);
    c = renderVox(b.fw, b.fd, def.maxZ, def.parts, { seed: b.variant + 3 });
    bCache.set(key, c);
    return c;
  }

  /* ======================= nature objects ======================= */
  const objCache = new Map();
  const leafM = (c, extra) => M((i, j, z) => (U.hash2(i >> 1, j >> 1, z | 0) < 0.12 ? U.shade(c, 1.2) : c), U.shade(c, 0.85), 0.12, Object.assign({ slopeK: 1.6, rim: 0.05 }, extra || {}));
  function treeParts(type, v) {
    const r = U.rng(type * 31 + v * 7 + 1), cx = 8, cy = 8; // on a 1x1 footprint (16 samples)
    const trunk = (h, rr) => P.cyl(cx, cy, rr || 1.3, 0, h, M(PAL.trunk, PAL.trunk, 0.05));
    const blob = (c, n, rad, cz, spread, zs) => { const out = []; for (let k = 0; k < n; k++) { const a = r() * 6.28, d = r() * spread; out.push(P.sphere(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cz + (r() - 0.3) * rad * 0.8, rad * (0.7 + r() * 0.4), leafM(c), zs)); } return out; };
    const S = 0.85 + v * 0.12;
    switch (type) {
      case O.TREE_RAIN: return { parts: [trunk(14 * S), ...blob(U.mix(PAL.leaf, PAL.leafL, 0.2), 6, 7 * S, 20 * S, 5, 0.9)], maxZ: 36 };
      case O.TREE_MANGO: return { parts: [trunk(10 * S), ...blob(PAL.leafD, 5, 6.5 * S, 17 * S, 3.5, 1.2), (i, j) => (U.hash2(i | 0, j | 0, 9) < 0.03 ? [12 * S, 14 * S, M(C('#e9a43a'))] : null)], maxZ: 34 };
      case O.TREE_GOLDEN: return { parts: [trunk(12 * S), ...blob(C('#5aa63a'), 4, 6 * S, 18 * S, 3, 1.1), ...blob(C('#f3cf2e'), 4, 3.5 * S, 15 * S, 4.5, 1.6)], maxZ: 34 };
      case O.TREE_FLAME: return { parts: [trunk(12 * S), ...blob(C('#e2552c'), 5, 6.5 * S, 18 * S, 4, 0.8), ...blob(C('#4f8f3a'), 2, 4 * S, 16 * S, 3, 0.8)], maxZ: 32 };
      case O.TREE_SAKURA: return { parts: [trunk(11 * S), ...blob(C('#f2a7c3'), 6, 5.5 * S, 17 * S, 4, 1.0)], maxZ: 32 };
      case O.TREE_TEAK: return { parts: [trunk(18 * S), ...blob(C('#3f7f35'), 5, 6 * S, 26 * S, 3, 1.1)], maxZ: 42 };
      case O.TREE_JUNGLE: return { parts: [trunk(28 * S, 1.8), ...blob(C('#2f6f35'), 6, 7.5 * S, 34 * S, 5, 0.75), ...blob(C('#3f8a3a'), 3, 5 * S, 20 * S, 4, 0.8)], maxZ: 50 };
      case O.TREE_DRY: return { parts: [trunk(12 * S), ...blob(C('#8f9a4a'), 3, 5 * S, 17 * S, 4, 0.8)], maxZ: 30 };
      case O.TREE_PINE: return { parts: [trunk(8), P.cone(cx, cy, 7 * S, 6, 14 * S, leafM(C('#2f5f3a')), 1), P.cone(cx, cy, 5.5 * S, 15 * S, 13 * S, leafM(C('#336a3e')), 1), P.cone(cx, cy, 4 * S, 24 * S, 12 * S, leafM(C('#3a7544')), 1)], maxZ: 46 };
      case O.TREE_RUBBER: return { parts: [trunk(20, 1.1), ...blob(C('#4a8a3a'), 4, 4.5, 24, 2.5, 1.2)], maxZ: 36 };
      case O.TREE_MANGROVE: return { parts: [P.cyl(cx - 3, cy, 0.8, 0, 6, M(PAL.trunkD)), P.cyl(cx + 3, cy, 0.8, 0, 6, M(PAL.trunkD)), P.cyl(cx, cy + 3, 0.8, 0, 6, M(PAL.trunkD)), trunk(10), ...blob(C('#3d7a45'), 4, 5, 13, 3, 0.9)], maxZ: 26 };
      case O.TREE_BAMBOO: {
        const parts = [];
        for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = r() * 3.5, h = 22 + r() * 14; parts.push(P.cyl(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.7, 0, h, M(C('#8fbf4a'), C('#7aa83f')))); parts.push(P.sphere(cx + Math.cos(a) * (d + 2), cy + Math.sin(a) * (d + 2), h, 3, leafM(C('#6faa3a')), 0.6)); }
        return { parts, maxZ: 44 };
      }
      case O.TREE_BANANA: {
        const parts = [P.cyl(cx, cy, 1.4, 0, 9, M(C('#8fae4a')))];
        for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + r(); parts.push((i, j) => { const di = i - cx, dj = j - cy, d = Math.hypot(di, dj); if (d > 8) return null; const ang = Math.atan2(dj, di), da = Math.abs(((ang - a + 9.42) % 6.28) - 3.14); if (da > 0.45 * (1 - d / 10)) return null; const z = 12 + d * 0.6 - d * d * 0.09; return [z - 1, z, M(C('#7ccf4a'), C('#5aa83a'), 0.05)]; }); }
        return { parts, maxZ: 26 };
      }
      case O.TREE_PALM: case O.TREE_OILPALM: case O.TREE_SUGARPALM: {
        const oil = type === O.TREE_OILPALM, sugar = type === O.TREE_SUGARPALM;
        const h = oil ? 12 : sugar ? 30 : 24 + v * 3, lean = oil || sugar ? 0 : (r() - 0.5) * 6;
        const parts = [(i, j) => { // curved trunk: column of short spans
          const out = [];
          return null;
        }];
        for (let z = 0; z < h; z += 2) { const t = z / h, oi = lean * t * t; parts.push(P.box(cx + oi - 1.2, cy - 1.2, cx + oi + 1.2, cy + 1.2, z, z + 2.2, M(C(oil ? '#6a5a3a' : '#8a7050'), null, 0.1))); }
        const tx = cx + lean, fc = sugar ? C('#4f8f3a') : oil ? C('#3f8a35') : C('#4f9f3a');
        const fr = sugar ? 6 : oil ? 10 : 9, nf = sugar ? 12 : 8;
        for (let k = 0; k < nf; k++) {
          const a = (k / nf) * 6.28 + r() * 0.3;
          parts.push((i, j) => { const di = i - tx, dj = j - cy, d = Math.hypot(di, dj); if (d > fr || d < 0.5) return null; const ang = Math.atan2(dj, di), da = Math.abs(((ang - a + 9.42) % 6.28) - 3.14); if (da > (sugar ? 0.35 : 0.22) + 0.1 * (1 - d / fr)) return null; const z = h + 3 - (sugar ? d * 0.2 : d * d * 0.07); return [z - 1.2, z, M(fc, U.shade(fc, 0.8), 0.08)]; });
        }
        if (!oil && !sugar) parts.push(P.sphere(tx, cy, h, 1.6, M(C('#7a6a2a'))));
        return { parts, maxZ: h + 10 };
      }
      case O.BUSH: return { parts: blob(C('#4f9a3a'), 3, 3.5, 3, 2.5, 1.0), maxZ: 12 };
      case O.ROCK: return { parts: [P.sphere(cx, cy, 1, 5 + v, M(PAL.rock, null, 0.15), 0.8), P.sphere(cx + 4, cy + 2, 0, 3, M(PAL.rockL, null, 0.15), 0.8)], maxZ: 14 };
      case O.CORN: { const parts = []; for (let k = 0; k < 5; k++) { const i = 3 + r() * 10, j = 3 + r() * 10; parts.push(P.cyl(i, j, 0.6, 0, 9 + r() * 4, M(C('#7aaa3a')))); parts.push(P.sphere(i, j, 9, 2, leafM(C('#8fbf4a')), 0.7)); } return { parts, maxZ: 18 }; }
      case O.TALLGRASS: { const parts = []; for (let k = 0; k < 8; k++) { const i = 2 + r() * 12, j = 2 + r() * 12; parts.push(P.cyl(i, j, 0.5, 0, 3 + r() * 5, M(C('#9abf4a'), C('#7aa83a')))); } return { parts, maxZ: 12 }; }
      case O.FLOWERS: { const parts = []; const fc = [C('#f6e15a'), C('#f08ab0'), C('#ffffff'), C('#e8572f')][v % 4]; for (let k = 0; k < 7; k++) { const i = 3 + r() * 10, j = 3 + r() * 10; parts.push(P.cyl(i, j, 0.5, 0, 2, M(C('#5f9f3a')))); parts.push(P.box(i - 0.8, j - 0.8, i + 0.8, j + 0.8, 2, 3, M(fc))); } return { parts, maxZ: 8 }; }
    }
    return null;
  }
  function peakParts(v, hgt) {
    const r = U.rng(v * 13 + 7), parts = [];
    const H = hgt, cx = 16 + (r() - 0.5) * 6, cy = 16 + (r() - 0.5) * 6, rad = 15 + r() * 4;
    const top = (i, j, z) => (z > H * 0.72 ? (U.hash2(i >> 1, j >> 1, 5) < 0.4 ? PAL.rockL : PAL.rock) : z > H * 0.45 ? (U.hash2(i >> 1, j >> 1, 6) < 0.5 ? C('#4f7a45') : PAL.rockD) : U.hash2(i >> 1, j >> 1, 7) < 0.6 ? C('#3f7a3a') : C('#336b33'));
    const side = (f, a, z) => (z > H * 0.6 ? PAL.rockD : C('#2f5f30'));
    parts.push((i, j) => {
      const d = Math.hypot(i - cx, (j - cy) * 1.1);
      if (d >= rad) return null;
      const n = U.vnoise(i / 5, j / 5, v) * 0.25 + U.vnoise(i / 2.5, j / 2.5, v + 3) * 0.1;
      const z = H * Math.pow(1 - d / rad, 1.15) * (0.8 + n);
      return [0, z, M(top, side, 0.05, { slopeK: 1.8, rim: 0 })];
    });
    // shoulder peak for a broken ridge look
    const sx = cx + (r() - 0.5) * 14, sy = cy + (r() - 0.5) * 14, sr = rad * 0.6, sh = H * (0.4 + r() * 0.3);
    parts.push((i, j) => { const d = Math.hypot(i - sx, j - sy); if (d >= sr) return null; return [0, sh * Math.pow(1 - d / sr, 1.1), M(top, side, 0.05, { slopeK: 1.8, rim: 0 })]; });
    return { parts, maxZ: H + 8 };
  }
  // pixel props drawn by hand
  function propCanvas(id, v, night) {
    const W = 32, H = 40, pb = new PB(W, H), ax = 16, ay = 34;
    const p = (x, y, c) => pb.set(ax + x, ay + y, pack(c));
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p(x + i, y + j, c); };
    switch (id) {
      case O.LAMP: rect(0, -24, 1, 24, C('#5a5e66')); rect(0, -25, 4, 1, C('#5a5e66')); rect(3, -24, 2, 2, night ? C('#fff2b0') : C('#e8e0c0')); rect(-1, 0, 3, 1, C('#4a4e56')); break;
      case O.POLE: rect(0, -28, 2, 28, C('#8a8a86')); rect(-4, -26, 10, 1, C('#6a6a66')); rect(-4, -27, 1, 1, C('#d8d8d0')); rect(5, -27, 1, 1, C('#d8d8d0')); break;
      case O.SPIRIT: rect(0, -10, 2, 10, C('#e8e0d0')); rect(-4, -12, 10, 2, C('#e8e0d0')); rect(-3, -18, 8, 6, C('#f4efe6')); rect(-1, -16, 4, 4, C('#b0302a')); rect(-4, -21, 10, 3, C('#c24f2c')); rect(0, -25, 2, 4, C('#e9b83d')); rect(-3, -12, 2, 1, C('#e8572f')); rect(3, -12, 2, 1, C('#f6e15a')); break;
      case O.JAR: rect(-4, -10, 9, 10, C('#6a3f2a')); rect(-3, -11, 7, 1, C('#5a3420')); rect(-4, -7, 9, 1, C('#e9b83d')); rect(-2, -5, 2, 2, C('#e9b83d')); rect(2, -4, 2, 2, C('#e9b83d')); break;
      case O.FLAG: {
        rect(0, -34, 1, 34, C('#d0d0d0'));
        const st = [C('#c8382f'), C('#f4f1e8'), C('#2b3f8f'), C('#2b3f8f'), C('#f4f1e8'), C('#c8382f')];
        for (let k = 0; k < 6; k++) for (let i = 0; i < 10; i++) p(1 + i, -33 + k + ((i + v) % 4 === 0 ? 1 : 0), st[k]);
        break;
      }
      case O.BENCH: rect(-6, -4, 12, 2, PAL.wood); rect(-5, -2, 1, 2, PAL.woodD); rect(4, -2, 1, 2, PAL.woodD); rect(-6, -7, 12, 1, PAL.woodD); break;
      case O.SCARECROW: rect(0, -18, 1, 18, PAL.woodD); rect(-5, -14, 11, 1, PAL.woodD); rect(-3, -14, 7, 6, C('#3f5fa8')); rect(-2, -19, 5, 4, C('#e8d0a0')); rect(-4, -21, 9, 2, C('#c4a465')); break;
      case O.PARASOL: rect(0, -16, 1, 16, C('#e8e0d0')); for (let i = -7; i <= 7; i++) { const h = 3 - Math.abs(i) / 3; rect(i, -18 + Math.abs(i) / 3, 1, Math.max(1, h), (i + 8) % 4 < 2 ? C('#e8572f') : C('#f4f1e8')); } rect(3, -4, 7, 2, C('#f4f1e8')); break;
      case O.STALL: {
        rect(-9, -10, 18, 7, C('#a87a4a')); rect(-9, -3, 2, 3, C('#2b2a33')); rect(7, -3, 2, 3, C('#2b2a33'));
        for (let k = 0; k < 4; k++) rect(-7 + k * 4, -12, 3, 2, VAR.sign[(k + v) % 6]);
        rect(0, -22, 1, 12, C('#d0d0d0'));
        const uc = [C('#e8572f'), C('#2f72c9'), C('#2e9e5b')][v % 3];
        for (let i = -11; i <= 11; i++) rect(i, -24 + Math.abs(i) / 3, 1, 2, (i + 12) % 6 < 3 ? uc : C('#f4f1e8'));
        break;
      }
      case O.HUT: {
        rect(-7, -8, 1, 8, PAL.woodD); rect(6, -8, 1, 8, PAL.woodD); rect(-1, -6, 1, 6, PAL.woodD);
        rect(-8, -9, 16, 2, PAL.wood);
        for (let i = -10; i <= 10; i++) rect(i, -18 + Math.abs(i) * 0.7, 1, 4, C('#c4a465'));
        break;
      }
      case O.BOAT: {
        const hull = v & 1 ? C('#8a5a32') : C('#3f6fa6');
        for (let i = -11; i <= 11; i++) { const y = -3 + (i * 0.5) | 0; rect(i, y, 1, 3 - (Math.abs(i) > 9 ? 1 : 0), hull); }
        rect(-11, -9, 1, 4, VAR.sign[v % 6]); rect(-10, -9, 1, 2, VAR.sign[(v + 2) % 6]);
        rect(-3, -6, 6, 2, C('#e8d0a0'));
        break;
      }
      case O.PIER: {
        for (let k = 0; k < 4; k++) { rect(-14 + k * 7, -2 + ((k * 3.5) | 0), 1, 6, PAL.woodD); }
        for (let i = -15; i <= 12; i++) rect(i, -4 + (((i + 15) * 0.5) | 0), 1, 2, PAL.woodL);
        rect(-6, -10, 10, 3, C('#3f6fa6')); rect(-6, -11, 2, 1, C('#d23a3a'));
        break;
      }
    }
    pb.outline(0.45);
    const c = pb.toCanvas(); c.ax = ax; c.ay = ay;
    return c;
  }
  function object(id, v, night, elev) {
    const PROP = id === O.LAMP || id === O.POLE || id === O.SPIRIT || id === O.JAR || id === O.FLAG || id === O.BENCH || id === O.SCARECROW || id === O.PARASOL || id === O.STALL || id === O.HUT || id === O.BOAT || id === O.PIER;
    if (id === O.PEAK) { const hv = Math.min(5, Math.max(0, ((elev - 130) / 22) | 0)); v = (v % 4) * 8 + hv; }
    const key = id + ':' + v + (night && (id === O.LAMP) ? 'n' : '');
    let c = objCache.get(key);
    if (c) return c;
    if (PROP) c = propCanvas(id, v, night && id === O.LAMP);
    else if (id === O.PEAK) { const d = peakParts(v >> 3, 34 + (v & 7) * 9); c = renderVox(2, 2, d.maxZ, d.parts, { seed: v }); c.ax -= 16; c.ay += 8; }
    else if (id === O.KARST) { const d = LM.karst(); c = renderVox(3, 3, d.maxZ, d.parts.map((p) => p), { seed: v }); c.ax += 0; c.ay += 16; }
    else {
      const d = treeParts(id, v % 3);
      if (!d) return null;
      c = renderVox(1, 1, d.maxZ, d.parts, { seed: v * 7 + id });
    }
    objCache.set(key, c);
    return c;
  }

  /* ======================= characters ======================= */
  // appearance: { skin, hair, hairC, top, topC, bottom, bottomC, hat, kind }
  const HAIRC = ['#1e1a1a', '#3b2a20', '#5a3a26', '#8a5a3a', '#c9a35a', '#9a9a9a', '#e8e8e8', '#7a3fa0', '#c84a6a'].map(C);
  const CLOTH = ['#d23a3a', '#2f72c9', '#2e9e5b', '#e8a32c', '#8d4fc2', '#e05b9c', '#f4f1e8', '#2b2a33', '#3f5fa8', '#7a5a3a', '#e8732c', '#5fb0c0', '#6b3a1f', '#c8b08a'].map(C);
  S77.APPEAR = { HAIRC, CLOTH, hairStyles: ['short', 'spiky', 'long', 'bob', 'pony', 'bun', 'bald'], tops: ['tee', 'collar', 'robe', 'tank', 'uniform', 'dress'], bottoms: ['pants', 'shorts', 'skirt', 'sarong'], hats: ['none', 'cap', 'ngob', 'helmet', 'hijab', 'kopiah', 'sunhat'] };
  function drawChar(pb, a, back, frame, ox) {
    const p = (x, y, c) => { if (c) pb.set(ox + x, y, pack(c)); };
    const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p(x + i, y + j, c); };
    const skin = PAL.skinTones[a.skin || 0], hairC = HAIRC[a.hairC || 0], top = CLOTH[a.topC === undefined ? 1 : a.topC], bot = CLOTH[a.bottomC === undefined ? 7 : a.bottomC];
    const kid = a.kind === 'kid', yo = kid ? 5 : 0;
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const shoe = C('#2b2a33');
    // legs
    const robe = a.top === 'robe' || a.top === 'dress';
    const legTop = 19 + yo, legLen = kid ? 4 : 5;
    if (a.bottom === 'skirt' || a.bottom === 'sarong' || robe) {
      const skirtC = robe ? top : bot;
      rect(4, legTop - 1, 8, a.bottom === 'skirt' && !robe ? 4 : legLen, skirtC);
      rect(5 + (step > 0 ? -1 : 0), legTop + (a.bottom === 'skirt' && !robe ? 3 : legLen - 1), 2, 1, a.bottom === 'skirt' && !robe ? skin : skirtC);
      rect(9 + (step < 0 ? 1 : 0), legTop + (a.bottom === 'skirt' && !robe ? 3 : legLen - 1), 2, 1, a.bottom === 'skirt' && !robe ? skin : skirtC);
      rect(5 + (step > 0 ? -1 : 0), legTop + legLen, 2, 1, shoe); rect(9 + (step < 0 ? 1 : 0), legTop + legLen, 2, 1, shoe);
    } else {
      const shorts = a.bottom === 'shorts';
      const L = (x, dy, len) => { rect(x, legTop + dy, 2, len, bot); if (shorts) rect(x, legTop + dy + 2, 2, len - 2, skin); rect(x, legTop + dy + len, 2, 1, shoe); };
      L(5, step > 0 ? -1 : 0, legLen + (step > 0 ? 1 : 0));
      L(9, step < 0 ? -1 : 0, legLen + (step < 0 ? 1 : 0));
    }
    // torso
    const ty = 12 + yo;
    rect(4, ty, 8, 8, top);
    if (a.top === 'collar' || a.top === 'uniform') { if (!back) { p(7, ty, C('#ffffff')); p(8, ty, C('#ffffff')); rect(7, ty + 1, 2, 5, U.shade(top, 0.85)); } }
    if (a.top === 'uniform' && !back) { p(5, ty + 2, PAL.gold); p(10, ty + 2, PAL.gold); }
    if (a.top === 'tank') { p(4, ty, skin); p(11, ty, skin); }
    if (a.apron && !back) rect(5, ty + 3, 6, 6, C('#f4f1e8'));
    if (a.vest) rect(4, ty, 8, 6, C('#e8732c'));
    if (a.top === 'robe') { rect(4, ty, 8, 1, top); if (!back) { p(10, ty + 1, skin); p(11, ty + 1, skin); p(11, ty + 2, skin); } }
    // arms
    const sw = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const sleeve = a.top === 'tank' ? skin : top;
    rect(3, ty + 1 + sw, 1, 3, sleeve); rect(3, ty + 4 + sw, 1, 3, skin);
    rect(12, ty + 1 - sw, 1, 3, a.top === 'robe' ? skin : sleeve); rect(12, ty + 4 - sw, 1, 3, skin);
    if (a.bag) rect(back ? 5 : 11, ty + 1, 3, 5, C('#7a5a3a'));
    // head
    const hy = 2 + yo;
    rect(4, hy + 1, 8, 9, skin); rect(3, hy + 2, 10, 7, skin);
    if (!back) {
      const ex = a.faceLeft ? -1 : 0;
      rect(6 + ex, hy + 5, 1, 2, C('#2b2a33')); rect(9 + ex, hy + 5, 1, 2, C('#2b2a33'));
      p(5 + ex, hy + 7, U.shade(skin, 0.92)); p(10 + ex, hy + 7, C('#f0a090'));
      p(7 + ex, hy + 8, U.shade(skin, 0.75)); p(8 + ex, hy + 8, U.shade(skin, 0.75));
    }
    // hair
    const hs = a.hair || 'short';
    if (a.hat === 'hijab') {
      const hc = CLOTH[a.hatC === undefined ? 2 : a.hatC];
      rect(3, hy, 10, 3, hc); rect(2, hy + 2, 2, 9, hc); rect(12, hy + 2, 2, 9, hc); rect(3, hy + 9, 10, 3, hc);
      if (back) rect(3, hy, 10, 12, hc);
    } else if (hs !== 'bald') {
      rect(4, hy, 8, 2, hairC); rect(3, hy + 1, 10, 2, hairC);
      if (back) rect(3, hy + 1, 10, hs === 'short' || hs === 'spiky' ? 7 : 9, hairC);
      else { p(3, hy + 3, hairC); p(12, hy + 3, hairC); p(3, hy + 4, hairC); p(12, hy + 4, hairC); rect(4, hy + 2, 3, 1, hairC); }
      if (hs === 'spiky') { p(5, hy - 1, hairC); p(8, hy - 1, hairC); p(10, hy - 1, hairC); }
      if (hs === 'long') { rect(2, hy + 3, 2, 10, hairC); rect(12, hy + 3, 2, 10, hairC); if (back) rect(3, hy + 9, 10, 4, hairC); }
      if (hs === 'bob') { rect(2, hy + 3, 2, 6, hairC); rect(12, hy + 3, 2, 6, hairC); }
      if (hs === 'pony') { rect(12, hy + 2, 2, 2, hairC); rect(13, hy + 4, 2, 5, hairC); }
      if (hs === 'bun') { rect(6, hy - 2, 4, 3, hairC); }
    } else if (a.kind === 'monk') { rect(4, hy, 8, 2, U.shade(skin, 0.9)); }
    // hats
    if (a.hat === 'cap') { const hc = CLOTH[a.hatC || 0]; rect(3, hy - 1, 10, 3, hc); if (!back) rect(9, hy + 1, 5, 1, U.shade(hc, 0.8)); }
    if (a.hat === 'ngob') { const hc = C('#c9a865'); rect(5, hy - 3, 6, 2, hc); rect(2, hy - 1, 12, 2, hc); rect(0, hy + 1, 16, 1, U.shade(hc, 0.85)); }
    if (a.hat === 'helmet') { const hc = CLOTH[a.hatC || 0]; rect(3, hy - 1, 10, 5, hc); if (!back) rect(4, hy + 3, 8, 1, C('#2b2a33')); }
    if (a.hat === 'kopiah') { rect(4, hy - 1, 8, 3, C('#f4f1e8')); }
    if (a.hat === 'sunhat') { const hc = C('#e8d8a8'); rect(4, hy - 2, 8, 3, hc); rect(1, hy + 1, 14, 1, hc); }
    if (a.hat === 'nurse') { rect(5, hy - 2, 6, 2, C('#ffffff')); }
    if (a.hat === 'police') { rect(3, hy - 1, 10, 3, C('#5a3a20')); rect(3, hy + 1, 11, 1, C('#2b2a33')); }
  }
  const charCache = new Map();
  // returns { canvas, fw:16, fh:28 } with frames laid out: [front f0..f3, back f0..f3] x [right, left]
  function character(a) {
    const key = JSON.stringify(a);
    let c = charCache.get(key);
    if (c) return c;
    const FW = 16, FH = 28, pb = new PB(FW * 8, FH * 2);
    for (let mir = 0; mir < 2; mir++) for (let back = 0; back < 2; back++) for (let f = 0; f < 4; f++) {
      const tmp = new PB(FW, FH);
      drawChar(tmp, a, !!back, f, 0);
      tmp.outline(0.4);
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        const col = tmp.data[y * FW + x]; if (!col) continue;
        const dx = mir ? FW - 1 - x : x;
        pb.data[(mir * FH + y) * pb.w + (back * 4 + f) * FW + dx] = col;
      }
    }
    c = pb.toCanvas(); c.fw = FW; c.fh = FH;
    charCache.set(key, c);
    return c;
  }
  // animals
  const animalCache = {};
  function animal(type, color) {
    const k = type + (color || 0);
    if (animalCache[k]) return animalCache[k];
    const FW = type === 'buffalo' ? 28 : type === 'chicken' ? 10 : 16, FH = type === 'buffalo' ? 20 : type === 'chicken' ? 10 : 14;
    const pb = new PB(FW * 4, FH);
    for (let f = 0; f < 4; f++) {
      const t = new PB(FW, FH), rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) t.set(x + i, y + j, pack(c)); };
      const st = f % 2;
      if (type === 'dog') {
        const c = [C('#c9935a'), C('#2b2a33'), C('#f1ede4'), C('#8a6a4a')][color || 0];
        rect(3, 5, 9, 4, c); rect(10, 2, 4, 4, c); rect(13, 4, 2, 1, U.shade(c, 0.7)); rect(10, 1, 1, 2, U.shade(c, 0.8)); rect(1, 4 - st, 2, 2, c);
        rect(4 + st, 9, 1, 3, c); rect(10 - st, 9, 1, 3, c); rect(6 - st, 9, 1, 3, U.shade(c, 0.8)); rect(12, 3, 1, 1, C('#1a1a1a'));
      } else if (type === 'buffalo') {
        const c = C('#4a4a50');
        rect(4, 6, 17, 8, c); rect(20, 5, 6, 6, c); rect(19, 3, 2, 3, C('#d8d0c0')); rect(25, 3, 2, 3, C('#d8d0c0')); rect(22, 8, 1, 1, C('#1a1a1a'));
        rect(6 + st, 14, 2, 5, c); rect(18 - st, 14, 2, 5, c); rect(10 - st, 14, 2, 5, U.shade(c, 0.8)); rect(15 + st, 14, 2, 5, U.shade(c, 0.8)); rect(2, 7, 2, 4, c);
      } else {
        const c = color ? C('#f4f1e8') : C('#b5583e');
        rect(2, 3, 5, 4, c); rect(6, 1, 3, 3, c); rect(7, 0, 1, 1, C('#d23a3a')); rect(9, 2, 1, 1, PAL.gold); rect(3 + st, 7, 1, 2, PAL.gold); rect(5 - st, 7, 1, 2, PAL.gold);
      }
      t.outline(0.45);
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const col = t.data[y * FW + x]; if (col) pb.data[y * pb.w + f * FW + x] = col; }
    }
    // mirrored frames appended
    const out = new PB(FW * 8, FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW * 4; x++) { const col = pb.data[y * pb.w + x]; if (!col) continue; out.data[y * out.w + x] = col; const f = (x / FW) | 0, lx = x % FW; out.data[y * out.w + (4 + f) * FW + (FW - 1 - lx)] = col; }
    const c = out.toCanvas(); c.fw = FW; c.fh = FH;
    return (animalCache[k] = c);
  }
  // vehicle drawn under a riding character: 'bicycle' | 'motorbike'; dir: 0 front-right,1 back-right (mirror for left)
  const vehCache = {};
  function vehicle(type, back, mirror) {
    const k = type + back + mirror;
    if (vehCache[k]) return vehCache[k];
    const pb = new PB(28, 18), rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pb.set(mirror ? 27 - (x + i) : x + i, y + j, pack(c)); };
    const wheel = (cx, cy) => { for (let a = 0; a < 6.28; a += 0.3) rect(Math.round(cx + Math.cos(a) * 3), Math.round(cy + Math.sin(a) * 2.4), 1, 1, C('#2b2a33')); };
    const f = back ? [[19, 7], [7, 13]] : [[7, 7], [19, 13]];
    wheel(f[0][0], f[0][1]); wheel(f[1][0], f[1][1]);
    if (type === 'motorbike') {
      const body = C('#c8382f');
      for (let t = 0; t <= 1; t += 0.08) rect(Math.round(f[0][0] + (f[1][0] - f[0][0]) * t) - 1, Math.round(f[0][1] + (f[1][1] - f[0][1]) * t) - 4, 4, 3, body);
      rect(Math.round((f[0][0] + f[1][0]) / 2) - 3, Math.round((f[0][1] + f[1][1]) / 2) - 6, 7, 2, C('#2b2a33'));
    } else {
      for (let t = 0; t <= 1; t += 0.1) rect(Math.round(f[0][0] + (f[1][0] - f[0][0]) * t), Math.round(f[0][1] + (f[1][1] - f[0][1]) * t) - 3, 1, 1, C('#2f72c9'));
    }
    pb.outline(0.5);
    return (vehCache[k] = pb.toCanvas());
  }
  // soft round light for the night light-map
  const lightCache = {};
  function light(r, col) {
    const k = r + col;
    if (lightCache[k]) return lightCache[k];
    const c = document.createElement('canvas'); c.width = c.height = r * 2;
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return (lightCache[k] = c);
  }

  S77.Sprites = { tile, cliff, foam, building, object, character, animal, vehicle, light, renderVox, P, M, ROWS, seasonOf, cacheSizes: () => ({ tiles: tileCache.size, bld: bCache.size, obj: objCache.size, chars: charCache.size }) };
})();
