/* worldgen.js — deterministic generation of the 77-province world.
   Tile grid: ~1018 x 1842 tiles (≈0.9 km per tile). Layers are typed arrays:
     ter  terrain id        prov  province idx+1 (0 = none)
     obj  decoration id     bld   building id+1 occupying the tile
     elev 0..255 height     zone  town (prov idx+1) / village (100+id)
     road highway lane-direction hint for centre lines, flag bitfield */
'use strict';
(function () {
  const U = S77.U, GEO = S77.GEO;

  const T = (S77.T = {
    DEEP: 0, SEA: 1, RIVER: 2, LAKE: 3, SAND: 4, GRASS: 5, PADDY: 6, FIELD: 7, FOREST: 8, JUNGLE: 9, HILL: 10,
    MOUNTAIN: 11, PLANT: 12, ORCHARD: 13, ROAD: 14, STREET: 15, PAVE: 16, PLAZA: 17, DIRT: 18, MANGROVE: 19,
    FOREIGN: 20, BRIDGE: 21, YARD: 22, RUNWAY: 23, DRYGRASS: 24,
  });
  S77.T_NAMES = ['ทะเลลึก', 'ทะเล', 'แม่น้ำ', 'ทะเลสาบ', 'ชายหาด', 'ทุ่งหญ้า', 'ทุ่งนา', 'ไร่', 'ป่าไม้', 'ป่าดิบชื้น', 'เนินเขา', 'ภูเขา', 'สวนยาง', 'สวนผลไม้', 'ทางหลวง', 'ถนน', 'ทางเท้า', 'ลานเมือง', 'ทางดิน', 'ป่าชายเลน', 'ต่างประเทศ', 'สะพาน', 'สนามหญ้า', 'รันเวย์', 'ทุ่งหญ้าแห้ง'];
  const WATER = new Uint8Array(32);
  [T.DEEP, T.SEA, T.RIVER, T.LAKE].forEach((t) => (WATER[t] = 1));
  const NOWALK = new Uint8Array(32);
  [T.DEEP, T.SEA, T.RIVER, T.LAKE, T.MOUNTAIN, T.FOREIGN].forEach((t) => (NOWALK[t] = 1));
  const PAVED = new Uint8Array(32);
  [T.ROAD, T.STREET, T.PAVE, T.PLAZA, T.DIRT, T.BRIDGE, T.RUNWAY].forEach((t) => (PAVED[t] = 1));
  S77.isWater = (t) => WATER[t] === 1;
  S77.isPaved = (t) => PAVED[t] === 1;

  // decoration objects. block: 0 = none, 1 = small trunk collider, 2 = whole tile
  const O = (S77.O = {
    NONE: 0, TREE_RAIN: 1, TREE_PALM: 2, TREE_PINE: 3, TREE_TEAK: 4, TREE_BANANA: 5, TREE_RUBBER: 6, TREE_OILPALM: 7,
    TREE_BAMBOO: 8, TREE_MANGO: 9, TREE_JUNGLE: 10, TREE_MANGROVE: 11, TREE_GOLDEN: 12, TREE_SAKURA: 13, TREE_FLAME: 14,
    TREE_SUGARPALM: 15, BUSH: 16, FLOWERS: 17, TALLGRASS: 18, ROCK: 19, PEAK: 20, KARST: 21, LAMP: 22, SPIRIT: 23,
    POLE: 24, SCARECROW: 25, STALL: 26, BENCH: 27, HUT: 28, BOAT: 29, JAR: 30, FLAG: 31, PIER: 32, PARASOL: 33,
    TREE_DRY: 34, CORN: 35,
  });
  const OBJ_BLOCK = (S77.OBJ_BLOCK = new Uint8Array(64));
  for (let i = 1; i <= 15; i++) OBJ_BLOCK[i] = 1;
  OBJ_BLOCK[O.TREE_DRY] = 1; OBJ_BLOCK[O.ROCK] = 1; OBJ_BLOCK[O.PEAK] = 2; OBJ_BLOCK[O.KARST] = 2; OBJ_BLOCK[O.LAMP] = 1;
  OBJ_BLOCK[O.SPIRIT] = 1; OBJ_BLOCK[O.POLE] = 1; OBJ_BLOCK[O.STALL] = 2; OBJ_BLOCK[O.HUT] = 2; OBJ_BLOCK[O.JAR] = 1;
  OBJ_BLOCK[O.FLAG] = 1; OBJ_BLOCK[O.SCARECROW] = 1; OBJ_BLOCK[O.PARASOL] = 1; OBJ_BLOCK[O.BENCH] = 1;

  const F_DOOR = 1, F_NODECOR = 2;

  /* ---------------- tiny binary heap for A* ---------------- */
  class Heap {
    constructor() { this.k = []; this.v = []; this.n = 0; }
    push(key, val) {
      const k = this.k, v = this.v; let i = this.n++;
      while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= val) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, top = k[0], n = --this.n;
      if (n > 0) {
        const lk = k[n], lv = v[n]; let i = 0;
        for (;;) {
          let c = 2 * i + 1; if (c >= n) break;
          if (c + 1 < n && v[c + 1] < v[c]) c++;
          if (v[c] >= lv) break;
          k[i] = k[c]; v[i] = v[c]; i = c;
        }
        k[i] = lk; v[i] = lv;
      }
      return top;
    }
    get size() { return this.n; }
  }
  S77.Heap = Heap;

  class World {
    constructor(seed) {
      this.seed = seed || 77;
      this.TPD_Y = 120;
      this.TPD_X = 120 * Math.cos((13 * Math.PI) / 180);
      this.W = Math.ceil((GEO.LON_MAX - GEO.LON_MIN) * this.TPD_X);
      this.H = Math.ceil((GEO.LAT_MAX - GEO.LAT_MIN) * this.TPD_Y);
      this.N = this.W * this.H;
      this.buildings = [];
      this.towns = [];
      this.villages = [];
      this.pois = []; // piers etc.
      this.CH = 16; // chunk size (tiles) for spatial indexing
      this.CW = Math.ceil(this.W / this.CH);
      this.CHH = Math.ceil(this.H / this.CH);
      this.bldChunks = [];
    }
    lonToX(lon) { return (lon - GEO.LON_MIN) * this.TPD_X; }
    latToY(lat) { return (GEO.LAT_MAX - lat) * this.TPD_Y; }
    xToLon(x) { return x / this.TPD_X + GEO.LON_MIN; }
    yToLat(y) { return GEO.LAT_MAX - y / this.TPD_Y; }
    toTile(p) { return [this.lonToX(p[0]), this.latToY(p[1])]; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
    id(x, y) { return y * this.W + x; }

    /* ---------- public queries ---------- */
    terrain(x, y) { return this.inb(x, y) ? this.ter[y * this.W + x] : T.DEEP; }
    province(x, y) { if (!this.inb(x, y)) return null; const p = this.prov[y * this.W + x]; return p ? S77.PROVINCES[p - 1] : null; }
    blockedTile(x, y) {
      if (!this.inb(x, y)) return true;
      const i = y * this.W + x;
      if (this.bld[i]) return true;
      if (NOWALK[this.ter[i]]) return true;
      return OBJ_BLOCK[this.obj[i]] === 2;
    }
    // building lookup
    buildingAt(x, y) { if (!this.inb(x, y)) return null; const b = this.bld[y * this.W + x]; return b ? this.buildings[b - 1] : null; }
    buildingsNearChunk(cx, cy) { return (cx >= 0 && cy >= 0 && cx < this.CW && cy < this.CHH && this.bldChunks[cy * this.CW + cx]) || null; }
    zoneName(x, y) {
      if (!this.inb(x, y)) return '';
      const z = this.zone[y * this.W + x];
      if (!z) return '';
      if (z < 100) return 'ตัวเมือง' + S77.PROVINCES[z - 1].th;
      const v = this.villages[z - 100];
      return v ? v.name : '';
    }

    /* =========================================================
       GENERATION
       ========================================================= */
    async generate(progress) {
      const t0 = performance.now();
      const step = async (msg, frac, fn) => { if (progress) progress(msg, frac); await S77.nextFrame(); const s = performance.now(); fn.call(this); this.timings[msg] = Math.round(performance.now() - s); };
      this.timings = {};
      const N = this.N;
      this.ter = new Uint8Array(N); this.prov = new Uint8Array(N); this.obj = new Uint8Array(N);
      this.bld = new Uint16Array(N); this.elev = new Uint8Array(N); this.zone = new Uint16Array(N);
      this.road = new Uint8Array(N); this.flag = new Uint8Array(N);
      this.land = new Uint8Array(N); // 0 sea, 1 thai, 2 foreign
      this.isle = new Uint8Array(N); // island province override (idx+1)

      await step('วาดเส้นขอบประเทศ', 0.05, this.genMask);
      await step('สร้างแม่น้ำและทะเลสาบ', 0.15, this.genWater);
      await step('คำนวณชายฝั่ง', 0.22, this.genCoast);
      await step('ยกเทือกเขา', 0.3, this.genElevation);
      await step('วางผังตัวเมือง 77 จังหวัด', 0.38, this.placeTowns);
      await step('แบ่งเขตจังหวัด', 0.45, this.genProvinces);
      await step('ปลูกป่าและทุ่งนา', 0.55, this.genBiomes);
      await step('สร้างถนนในเมือง', 0.62, this.stampTowns);
      await step('ตัดทางหลวงเชื่อมจังหวัด', 0.7, this.genHighways);
      await step('สร้างอาคาร', 0.78, this.buildTowns);
      await step('ตั้งหมู่บ้าน', 0.86, this.genVillages);
      await step('ตกแต่งธรรมชาติ', 0.93, this.genDecor);
      await step('จัดทำดัชนี', 0.98, this.indexBuildings);
      this.genTime = Math.round(performance.now() - t0);
      return this;
    }

    // scanline polygon fill (poly in tile coords)
    fillPoly(poly, cb) {
      const W = this.W, H = this.H, n = poly.length;
      let ymin = Infinity, ymax = -Infinity;
      for (const p of poly) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
      ymin = Math.max(0, Math.floor(ymin)); ymax = Math.min(H - 1, Math.ceil(ymax));
      const xs = [];
      for (let y = ymin; y <= ymax; y++) {
        const yc = y + 0.5; xs.length = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if (yi > yc !== yj > yc) xs.push(poly[i][0] + ((yc - yi) * (poly[j][0] - poly[i][0])) / (yj - yi));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
          for (let x = x0; x <= x1; x++) cb(y * W + x, x, y);
        }
      }
    }

    genMask() {
      const land = this.land; land.fill(2);
      // jitter the outline slightly so coasts aren't straight lines
      const jitter = (poly, amp, s) => U.spline(poly.map((p) => this.toTile(p)), 3).map((p) => [p[0] + (U.fbm(p[0] / 18, p[1] / 18, s, 2) - 0.5) * amp, p[1] + (U.fbm(p[0] / 18, p[1] / 18, s + 9, 2) - 0.5) * amp]);
      for (const sea of GEO.SEAS) this.fillPoly(sea.map((p) => this.toTile(p)), (i) => (land[i] = 0));
      this.fillPoly(jitter(GEO.OUTLINE, 7, 3), (i) => (land[i] = 1));
      for (const isl of GEO.ISLANDS) {
        const pi = S77.PROV_BY_KEY[isl.prov].idx + 1;
        this.fillPoly(jitter(isl.poly, 3, 5), (i) => { land[i] = 1; this.isle[i] = pi; });
      }
      // karst islets in Phang Nga bay / Krabi: tiny islands
      const r = U.rng(this.seed * 3 + 1);
      for (const k of GEO.KARST) {
        const pts = U.spline(k.pts.map((p) => this.toTile(p)), 6);
        for (const p of pts) {
          if (r() < 0.55) continue;
          const ox = p[0] + (r() - 0.5) * k.w * 120 * 2, oy = p[1] + (r() - 0.5) * k.w * 120 * 1.2;
          const xi = ox | 0, yi = oy | 0;
          if (this.inb(xi, yi) && land[this.id(xi, yi)] === 0) {
            const rr = 1 + r() * 2.2;
            for (let y = Math.floor(oy - rr); y <= oy + rr; y++) for (let x = Math.floor(ox - rr); x <= ox + rr; x++)
              if (this.inb(x, y) && Math.hypot(x - ox, y - oy) <= rr && land[this.id(x, y)] === 0) { land[this.id(x, y)] = 1; this.isle[this.id(x, y)] = 255; }
          }
        }
      }
      const ter = this.ter;
      for (let i = 0; i < this.N; i++) ter[i] = land[i] === 0 ? T.SEA : land[i] === 2 ? T.FOREIGN : T.GRASS;
    }

    genWater() {
      const ter = this.ter, land = this.land;
      // lakes
      for (const L of GEO.LAKES) {
        const [cx, cy] = this.toTile([L[0], L[1]]), rx = L[2] * this.TPD_X, ry = L[3] * this.TPD_Y;
        for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
          if (!this.inb(x, y)) continue;
          const n = U.fbm(x / 6, y / 6, 51, 2) * 0.35;
          const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
          const i = this.id(x, y);
          if (d < 0.85 + n && land[i] === 1) ter[i] = T.LAKE;
        }
      }
      // rivers
      this.riverPaths = [];
      for (const R of GEO.RIVERS) {
        const pts = U.spline(R.pts.map((p) => this.toTile(p)), 10);
        // resample to ~0.5 tile steps with meander noise
        const out = [];
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len * 2));
          for (let s = 0; s < n; s++) {
            const t = s / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
            const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
            const m = (U.fbm(x / 22, y / 22, 61, 3) - 0.5) * (R.border ? 3 : 7);
            out.push([x + nx * m, y + ny * m]);
          }
        }
        this.riverPaths.push({ name: R.name, w: R.w, pts: out });
        const r = R.w / 2;
        for (const p of out) {
          for (let y = Math.floor(p[1] - r - 1); y <= p[1] + r + 1; y++) for (let x = Math.floor(p[0] - r - 1); x <= p[0] + r + 1; x++) {
            if (!this.inb(x, y)) continue;
            if (Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) > r + 0.15) continue;
            const i = this.id(x, y);
            if (land[i] === 0) continue;
            if (land[i] === 2 && !R.border) continue;
            ter[i] = T.RIVER;
          }
        }
      }
    }

    genCoast() {
      const W = this.W, H = this.H, N = this.N, land = this.land, ter = this.ter;
      // distance (in tiles) from sea into land, and from land into sea
      const bfs = (isSource, canEnter, cap) => {
        const d = new Uint8Array(N).fill(255), q = new Int32Array(N); let h = 0, t = 0;
        for (let i = 0; i < N; i++) if (isSource(i)) { d[i] = 0; q[t++] = i; }
        while (h < t) {
          const i = q[h++], dv = d[i]; if (dv >= cap) continue;
          const x = i % W, y = (i / W) | 0;
          if (x > 0 && d[i - 1] === 255 && canEnter(i - 1)) { d[i - 1] = dv + 1; q[t++] = i - 1; }
          if (x < W - 1 && d[i + 1] === 255 && canEnter(i + 1)) { d[i + 1] = dv + 1; q[t++] = i + 1; }
          if (y > 0 && d[i - W] === 255 && canEnter(i - W)) { d[i - W] = dv + 1; q[t++] = i - W; }
          if (y < H - 1 && d[i + W] === 255 && canEnter(i + W)) { d[i + W] = dv + 1; q[t++] = i + W; }
        }
        return d;
      };
      this.coastDist = bfs((i) => land[i] === 0, (i) => land[i] === 1, 40);
      const seaDist = bfs((i) => land[i] !== 0, (i) => land[i] === 0, 6);
      for (let i = 0; i < N; i++) if (land[i] === 0) ter[i] = seaDist[i] <= 4 ? T.SEA : T.DEEP;
      this.riverDist = bfs((i) => ter[i] === T.RIVER || ter[i] === T.LAKE, (i) => land[i] === 1, 30);
    }

    genElevation() {
      const W = this.W, H = this.H, F = 4, CWc = Math.ceil(W / F) + 1, CHc = Math.ceil(H / F) + 1;
      const ridge = new Float32Array(CWc * CHc);
      for (const R of GEO.RIDGES) {
        const pts = U.spline(R.pts.map((p) => this.toTile(p)), 4), wt = R.w * this.TPD_Y;
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1], m = wt * 2.6;
          const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - m) / F)), x1 = Math.min(CWc - 1, Math.ceil((Math.max(a[0], b[0]) + m) / F));
          const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - m) / F)), y1 = Math.min(CHc - 1, Math.ceil((Math.max(a[1], b[1]) + m) / F));
          for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
            const d = U.segDist(cx * F, cy * F, a[0], a[1], b[0], b[1]) / wt;
            const v = R.s * Math.exp(-d * d);
            const ci = cy * CWc + cx; if (v > ridge[ci]) ridge[ci] = v;
          }
        }
      }
      const elev = this.elev, land = this.land, ter = this.ter;
      const nA = U.noiseGrid(W, H, 4, 34, 21, 3), nB = U.noiseGrid(W, H, 2, 11, 22, 2), nC = U.noiseGrid(W, H, 4, 46, 23, 2);
      for (let y = 0; y < H; y++) {
        const fy = y / F, cy = Math.floor(fy), ty = fy - cy;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (land[i] !== 1) { elev[i] = 0; continue; }
          const fx = x / F, cx = Math.floor(fx), tx = fx - cx, c = cy * CWc + cx;
          const r = (ridge[c] * (1 - tx) + ridge[c + 1] * tx) * (1 - ty) + (ridge[c + CWc] * (1 - tx) + ridge[c + CWc + 1] * tx) * ty;
          let e = r * (0.38 + 0.9 * nA(x, y));
          e += (nB(x, y) - 0.5) * 0.14 * (0.3 + r);
          e += Math.max(0, nC(x, y) - 0.66) * 1.1; // scattered lone hills
          if (this.coastDist[i] < 3) e *= 0.4;
          elev[i] = U.clamp(Math.round(e * 200), 0, 255);
          if (WATER[ter[i]]) elev[i] = 0;
        }
      }
    }

    /* ---------- towns: centre + radius, pushed apart so central provinces all fit ---------- */
    placeTowns() {
      const RAD = { 1: 26, 2: 15, 3: 12, 4: 10 };
      const land = this.land, ter = this.ter, elev = this.elev;
      const good = (x, y) => { if (!this.inb(x, y)) return false; const i = this.id(x, y); return land[i] === 1 && !WATER[ter[i]] && elev[i] < 80 && !this.isle[i]; };
      const goodIsle = (x, y, pi) => { if (!this.inb(x, y)) return false; const i = this.id(x, y); return land[i] === 1 && !WATER[ter[i]] && elev[i] < 80 && this.isle[i] === pi; };
      const order = S77.PROVINCES.slice().sort((a, b) => a.tier - b.tier || b.pop - a.pop);
      const placed = [];
      for (const p of order) {
        let R = RAD[p.tier];
        let [px, py] = this.toTile([p.lon, p.lat]);
        const islandPI = GEO.ISLANDS.some((I) => I.prov === p.key && U.pointInPoly(p.lon, p.lat, I.poly)) ? p.idx + 1 : 0;
        const ok = islandPI ? (x, y) => goodIsle(x, y, islandPI) : good;
        // push away from already placed bigger towns
        for (let it = 0; it < 6; it++) {
          for (const q of placed) {
            const need = (R + q.R) * 0.92, d = Math.hypot(px - q.cx, py - q.cy);
            if (d < need) {
              const dx = (px - q.cx) / (d || 1), dy = (py - q.cy) / (d || 1);
              px = q.cx + dx * need; py = q.cy + dy * need;
            }
          }
        }
        // choose best nearby centre (lots of usable land, close to target)
        let best = null, bestS = -1e9;
        const sr = 12;
        for (let oy = -sr; oy <= sr; oy += 2) for (let ox = -sr; ox <= sr; ox += 2) {
          const cx = Math.round(px + ox), cy = Math.round(py + oy);
          if (!ok(cx, cy)) continue;
          let cnt = 0, tot = 0;
          for (let sy = -R; sy <= R; sy += 3) for (let sx = -R; sx <= R; sx += 3) {
            if (sx * sx + sy * sy > R * R) continue; tot++;
            if (ok(cx + sx, cy + sy)) cnt++;
          }
          let clash = 0;
          for (const q of placed) { const d = Math.hypot(cx - q.cx, cy - q.cy); if (d < (R + q.R) * 0.85) clash += (R + q.R) * 0.85 - d; }
          const s = (cnt / (tot || 1)) * 100 - Math.hypot(ox, oy) * 1.2 - clash * 6;
          if (s > bestS) { bestS = s; best = [cx, cy]; }
        }
        if (!best) {
          // fall back to the nearest usable tile in a wider ring
          outer: for (let r = 1; r < 40; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
            if (ok(Math.round(px + ox), Math.round(py + oy))) { best = [Math.round(px + ox), Math.round(py + oy)]; break outer; }
          }
        }
        if (!best) best = [Math.round(px), Math.round(py)];
        const town = { idx: p.idx, prov: p, cx: best[0], cy: best[1], R, S: p.tier === 1 ? 9 : 7, buildings: [], blocks: [], island: islandPI };
        placed.push(town);
      }
      this.towns = [];
      for (const t of placed) this.towns[t.idx] = t;
    }

    genProvinces() {
      const W = this.W, H = this.H, prov = this.prov, land = this.land, isle = this.isle;
      // seeds: town centres + extra shaping seeds
      const seeds = [];
      for (const t of this.towns) {
        seeds.push({ x: t.cx, y: t.cy, p: t.idx, isl: t.island });
        for (const s of t.prov.seeds) { const [x, y] = this.toTile(s); seeds.push({ x, y, p: t.idx, isl: 0 }); }
      }
      const main = seeds.filter((s) => !s.isl);
      // candidate lists per 32x32 cell to keep it fast
      const C = 32, cw = Math.ceil(W / C), ch = Math.ceil(H / C), cand = new Array(cw * ch);
      const warp = 26;
      for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        const mx = cx * C + C / 2, my = cy * C + C / 2;
        let d0 = Infinity; for (const s of main) d0 = Math.min(d0, Math.hypot(s.x - mx, s.y - my));
        const lim = d0 + C * 1.42 + warp * 1.5;
        cand[cy * cw + cx] = main.filter((s) => Math.hypot(s.x - mx, s.y - my) <= lim);
      }
      const wA = U.noiseGrid(W, H, 4, 60, 31, 2), wB = U.noiseGrid(W, H, 4, 60, 32, 2);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (land[i] !== 1) continue;
        if (isle[i] && isle[i] !== 255) { prov[i] = isle[i]; continue; }
        const wx = x + (wA(x, y) - 0.5) * warp * 2, wy = y + (wB(x, y) - 0.5) * warp * 2;
        const list = cand[((y / C) | 0) * cw + ((x / C) | 0)];
        let bd = Infinity, bp = 0;
        for (let k = 0; k < list.length; k++) { const s = list[k], dx = s.x - wx, dy = s.y - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; bp = s.p; } }
        prov[i] = bp + 1;
      }
      // small karst islets (isle=255) → nearest mainland province (from neighbours)
      for (let i = 0; i < this.N; i++) if (isle[i] === 255) {
        const x = i % W, y = (i / W) | 0; let best = 0, bd = 1e9;
        for (const t of this.towns) { const d = Math.hypot(t.cx - x, t.cy - y); if (d < bd) { bd = d; best = t.idx + 1; } }
        prov[i] = best;
      }
      // province areas (tiles) & bounding boxes for the map UI
      this.provArea = new Int32Array(77); this.provBox = S77.PROVINCES.map(() => [1e9, 1e9, -1, -1]);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = prov[y * W + x]; if (!p) continue;
        this.provArea[p - 1]++; const b = this.provBox[p - 1];
        if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
      }
    }

    genBiomes() {
      const W = this.W, H = this.H, ter = this.ter, land = this.land, elev = this.elev, prov = this.prov, cd = this.coastDist, rd = this.riverDist;
      const P = S77.PROVINCES;
      // mangrove coast zones
      const mangrove = (x, y) => {
        const lon = this.xToLon(x), lat = this.yToLat(y);
        if (lat > 13.3 && lat < 13.65 && lon > 99.9 && lon < 101.0) return true; // gulf head
        if (lon < 99.9 && lat < 10.2 && lat > 6.5) return U.fbm(x / 12, y / 12, 71, 2) > 0.52; // andaman coast
        if (lon > 101.9 && lon < 102.6 && lat < 12.7 && lat > 12.1) return U.fbm(x / 10, y / 10, 72, 2) > 0.55; // chanthaburi/trat
        return false;
      };
      const g1 = U.noiseGrid(W, H, 3, 26, 81, 3), g2 = U.noiseGrid(W, H, 2, 8, 82, 2);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (land[i] !== 1 || WATER[ter[i]]) continue;
        const e = elev[i];
        const p = prov[i] ? P[prov[i] - 1] : null, reg = p ? p.region : 'central';
        const n1 = g1(x, y), n2 = g2(x, y);
        let t;
        if (e > 132) t = T.MOUNTAIN;
        else if (e > 92) t = reg === 'south' || (reg === 'east' && n1 > 0.4) ? T.JUNGLE : T.HILL;
        else if (cd[i] <= 1) t = mangrove(x, y) ? T.MANGROVE : T.SAND;
        else if (cd[i] <= 3 && n2 > 0.58 && !mangrove(x, y)) t = T.SAND;
        else {
          const wet = rd[i] < 14;
          switch (reg) {
            case 'central':
              t = n1 < (wet ? 0.68 : 0.56) ? T.PADDY : n1 < 0.7 ? T.FIELD : n2 > 0.55 ? T.ORCHARD : T.GRASS;
              if (e > 60 && n2 > 0.4) t = T.FOREST;
              break;
            case 'north':
              t = wet && n1 < 0.6 ? T.PADDY : e > 55 ? (n2 > 0.35 ? T.FOREST : T.GRASS) : n1 < 0.42 ? T.PADDY : n1 < 0.58 ? T.FIELD : n2 > 0.5 ? T.FOREST : T.GRASS;
              break;
            case 'northeast':
              t = n1 < (wet ? 0.62 : 0.5) ? T.PADDY : n1 < 0.66 ? T.FIELD : n2 > 0.62 ? T.FOREST : T.DRYGRASS;
              break;
            case 'east':
              t = wet && n1 < 0.42 ? T.PADDY : n1 < 0.5 ? T.ORCHARD : n1 < 0.62 ? T.PLANT : n2 > 0.55 ? T.FOREST : T.FIELD;
              break;
            case 'west':
              t = wet && n1 < 0.5 ? T.PADDY : n1 < 0.5 ? T.FIELD : n2 > 0.45 ? T.FOREST : T.GRASS;
              if (e > 55) t = T.FOREST;
              break;
            default: // south
              t = wet && n1 < 0.34 ? T.PADDY : n1 < 0.62 ? T.PLANT : n2 > 0.48 ? T.JUNGLE : T.ORCHARD;
          }
        }
        ter[i] = t;
      }
    }

    /* ---------- stamp towns: zone, streets, plaza ---------- */
    stampTowns() {
      const W = this.W, ter = this.ter, zone = this.zone, prov = this.prov, land = this.land, elev = this.elev;
      const mod = (a, n) => ((a % n) + n) % n;
      for (const t of this.towns) {
        const { cx, cy, R, S } = t, z = t.idx + 1;
        t.tiles = 0;
        const Rx = R + 4;
        for (let y = cy - Rx; y <= cy + Rx; y++) for (let x = cx - Rx; x <= cx + Rx; x++) {
          if (!this.inb(x, y)) continue;
          const i = this.id(x, y);
          if (land[i] !== 1 || zone[i]) continue;
          if (t.island && this.isle[i] !== t.island) continue;
          const d = Math.hypot(x - cx, y - cy), rr = R * (0.84 + 0.32 * U.fbm(x / 7, y / 7, 41 + t.idx, 2));
          if (d > rr) continue;
          zone[i] = z; prov[i] = z;
          if (WATER[ter[i]]) continue;
          t.tiles++;
          if (elev[i] > 80) elev[i] = 40 + (elev[i] & 15);
          const dx = x - cx, dy = y - cy;
          const street = mod(dx, S) === 0 || mod(dy, S) === 0;
          ter[i] = street ? T.STREET : d < rr * 0.62 ? T.PAVE : T.YARD;
        }
        // main avenues reach outward to meet highways
        const ext = Math.round(R * 1.45);
        for (let k = -ext; k <= ext; k++) {
          for (const [x, y] of [[cx + k, cy], [cx, cy + k]]) {
            if (!this.inb(x, y)) continue;
            const i = this.id(x, y);
            if (land[i] !== 1 || (zone[i] && zone[i] !== z) || WATER[ter[i]] || ter[i] === T.MOUNTAIN) continue;
            if (t.island && this.isle[i] !== t.island) continue;
            ter[i] = T.STREET; if (!zone[i]) { zone[i] = z; prov[i] = z; }
          }
        }
        // bridge short water runs along streets
        for (let k = -Math.ceil(ext / S); k <= Math.ceil(ext / S); k++) {
          this.bridgeLine(cx - ext, cy + k * S, 1, 0, ext * 2, 7, z);
          this.bridgeLine(cx + k * S, cy - ext, 0, 1, ext * 2, 7, z);
        }
        // blocks: interior rectangles between streets
        const bmin = -Math.ceil(R / S) - 1, bmax = Math.ceil(R / S);
        for (let by = bmin; by <= bmax; by++) for (let bx = bmin; bx <= bmax; bx++) {
          const x0 = cx + bx * S + 1, y0 = cy + by * S + 1, x1 = x0 + S - 2, y1 = y0 + S - 2;
          let n = 0;
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (!this.inb(x, y)) continue; const i = this.id(x, y); if (zone[i] === z && (ter[i] === T.PAVE || ter[i] === T.YARD)) n++; }
          if (n < 6) continue;
          const bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
          t.blocks.push({ bx, by, x0, y0, x1, y1, n, d: Math.hypot(bcx - cx, bcy - cy) });
        }
        t.blocks.sort((a, b) => a.d - b.d);
        // plaza = block NW of the centre crossing
        const plaza = t.blocks.find((b) => b.bx === -1 && b.by === -1) || t.blocks[0];
        if (plaza) {
          plaza.plaza = true; t.plaza = plaza;
          for (let y = plaza.y0; y <= plaza.y1; y++) for (let x = plaza.x0; x <= plaza.x1; x++) { const i = this.id(x, y); if (zone[i] === z && !WATER[ter[i]]) ter[i] = T.PLAZA; }
        }
      }
    }
    bridgeLine(x0, y0, dx, dy, len, maxRun, z) {
      const ter = this.ter;
      let run = [], prevLand = false;
      for (let k = 0; k <= len; k++) {
        const x = x0 + dx * k, y = y0 + dy * k;
        if (!this.inb(x, y)) { run = []; prevLand = false; continue; }
        const i = this.id(x, y), t = ter[i];
        if (t === T.RIVER || t === T.LAKE) { if (prevLand) run.push(i); }
        else {
          if (run.length && run.length <= maxRun && (t === T.STREET || t === T.ROAD)) for (const j of run) { ter[j] = T.BRIDGE; this.road[j] = dx ? 1 : 2; }
          run = []; prevLand = t === T.STREET || t === T.ROAD;
        }
      }
    }

    /* ---------- highways: A* on a coarse grid (4-neighbour + turn penalty) ---------- */
    genHighways() {
      const F = 4, W = this.W, H = this.H, cw = Math.ceil(W / F), ch = Math.ceil(H / F);
      const ter = this.ter, land = this.land, elev = this.elev, zone = this.zone;
      this.hasRoadC = new Uint8Array(cw * ch);
      const costC = new Float32Array(cw * ch);
      for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        const x = Math.min(W - 1, cx * F + 2), y = Math.min(H - 1, cy * F + 2), i = this.id(x, y);
        let c;
        if (land[i] === 2) c = ter[i] === T.RIVER ? 30 : Infinity;
        else if (land[i] === 0) c = 60;
        else if (WATER[ter[i]]) c = 9;
        else if (ter[i] === T.MOUNTAIN) c = 7;
        else c = 1 + elev[i] / 60;
        if (zone[i] && zone[i] < 100) c *= 1.3;
        costC[cy * cw + cx] = c;
      }
      const towns = this.towns;
      // candidate edges: k nearest + MST for connectivity
      const edges = new Map();
      const key = (a, b) => (a < b ? a * 100 + b : b * 100 + a);
      const dist = (a, b) => Math.hypot(towns[a].cx - towns[b].cx, towns[a].cy - towns[b].cy);
      const seaCross = (a, b) => {
        const A = towns[a], B = towns[b], n = Math.ceil(dist(a, b)); let s = 0;
        for (let k = 0; k <= n; k++) { const x = Math.round(A.cx + ((B.cx - A.cx) * k) / n), y = Math.round(A.cy + ((B.cy - A.cy) * k) / n); if (land[this.id(x, y)] !== 1) s++; }
        return s;
      };
      const SC = new Int32Array(77 * 77);
      for (let a = 0; a < 77; a++) for (let b = a + 1; b < 77; b++) SC[a * 77 + b] = SC[b * 77 + a] = seaCross(a, b);
      const sea = (a, b) => SC[a * 77 + b];
      for (let a = 0; a < 77; a++) {
        const near = [];
        for (let b = 0; b < 77; b++) if (b !== a) near.push([dist(a, b), b]);
        near.sort((p, q) => p[0] - q[0]);
        let added = 0;
        for (const [d, b] of near) {
          if (added >= 3 || d > 230) break;
          if (sea(a, b) > 18) continue;
          edges.set(key(a, b), [a, b]); added++;
        }
      }
      // MST (Prim) with sea penalty to guarantee everything is reachable
      const inT = new Uint8Array(77); inT[0] = 1; let cnt = 1;
      while (cnt < 77) {
        let best = null, bd = Infinity;
        for (let a = 0; a < 77; a++) if (inT[a]) for (let b = 0; b < 77; b++) if (!inT[b]) {
          const d = dist(a, b) + sea(a, b) * 50; if (d < bd) { bd = d; best = [a, b]; }
        }
        inT[best[1]] = 1; cnt++; edges.set(key(best[0], best[1]), best);
      }
      const list = [...edges.values()].sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
      this.highwayEdges = list;
      for (const [a, b] of list) {
        const A = towns[a], B = towns[b];
        const path = this.astarC(Math.floor(A.cx / F), Math.floor(A.cy / F), Math.floor(B.cx / F), Math.floor(B.cy / F), costC, cw, ch);
        if (!path) continue;
        this.drawRoadPath(path, F, cw, A, B);
      }
    }
    astarC(sx, sy, tx, ty, cost, cw, ch) {
      const pad = 16;
      const bx0 = Math.max(0, Math.min(sx, tx) - pad), by0 = Math.max(0, Math.min(sy, ty) - pad);
      const bx1 = Math.min(cw - 1, Math.max(sx, tx) + pad), by1 = Math.min(ch - 1, Math.max(sy, ty) + pad);
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, n = bw * bh * 4;
      const g = new Float32Array(n).fill(Infinity), par = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
      const heap = new Heap();
      const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
      const sid = ((sy - by0) * bw + (sx - bx0)) * 4;
      for (let d = 0; d < 4; d++) { g[sid + d] = 0; heap.push(sid + d, 0); }
      const hasRoad = this.hasRoadC;
      let goal = -1;
      while (heap.size) {
        const s = heap.pop();
        if (closed[s]) continue; closed[s] = 1;
        const cell = s >> 2, dir = s & 3, x = (cell % bw) + bx0, y = ((cell / bw) | 0) + by0;
        if (x === tx && y === ty) { goal = s; break; }
        for (let d = 0; d < 4; d++) {
          if (d === ((dir + 2) & 3)) continue;
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
          const ci = ny * cw + nx;
          let c = cost[ci]; if (c === Infinity) continue;
          if (hasRoad[ci]) c = Math.min(c, 0.45);
          if (d !== dir) c += 2.2;
          const ns = (((ny - by0) * bw + (nx - bx0)) << 2) | d, ng = g[s] + c;
          if (ng < g[ns]) { g[ns] = ng; par[ns] = s; heap.push(ns, ng + (Math.abs(nx - tx) + Math.abs(ny - ty)) * 1.6); }
        }
      }
      if (goal < 0) return null;
      const out = [];
      for (let s = goal; s >= 0; s = par[s]) { const cell = s >> 2; out.push([(cell % bw) + bx0, ((cell / bw) | 0) + by0]); }
      return out.reverse();
    }
    drawRoadPath(path, F, cw, A, B) {
      const ter = this.ter, land = this.land;
      const lay = (x, y, dir, main) => {
        if (!this.inb(x, y)) return;
        const i = this.id(x, y), t = ter[i];
        if (land[i] === 2 && t !== T.RIVER) return;
        if (t === T.STREET || t === T.PAVE || t === T.PLAZA || t === T.YARD) { if (t !== T.STREET) ter[i] = T.STREET; return; }
        if (t === T.BRIDGE) return;
        if (WATER[t]) { ter[i] = T.BRIDGE; this.road[i] = dir; return; }
        ter[i] = T.ROAD; if (main) this.road[i] = dir; else if (!this.road[i]) this.road[i] = 4;
        this.obj[i] = 0;
      };
      const pts = path.map(([cx, cy]) => [cx * F + 2, cy * F + 2]);
      // connector from the town centres to the first/last coarse point (L-shaped)
      const conn = (x0, y0, x1, y1) => {
        const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
        for (let x = x0; x !== x1; x += sx) { lay(x, y0, 1, true); lay(x, y0 + 1, 1, false); }
        for (let y = y0; y !== y1 + sy && sy; y += sy) { lay(x1, y, 2, true); lay(x1 + 1, y, 2, false); }
      };
      conn(A.cx, A.cy, pts[0][0], pts[0][1]);
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        if (y0 === y1) { const s = Math.sign(x1 - x0); for (let x = x0; x !== x1 + s; x += s) { lay(x, y0, 1, true); lay(x, y0 + 1, 1, false); } }
        else { const s = Math.sign(y1 - y0); for (let y = y0; y !== y1 + s; y += s) { lay(x0, y, 2, true); lay(x0 + 1, y, 2, false); } }
        this.hasRoadC[path[k][1] * cw + path[k][0]] = 1;
      }
      const L = pts[pts.length - 1];
      conn(B.cx, B.cy, L[0], L[1]);
    }

    /* ---------- buildings ---------- */
    addBuilding(type, x, y, fw, fd, door, extra) {
      const def = S77.BUILDINGS[type];
      const b = Object.assign({ id: this.buildings.length, type, x, y, fw, fd, door, h: def.h, style: def.style, name: def.th, variant: (U.hash2(x, y, 9) * 1000) | 0 }, extra || {});
      this.buildings.push(b);
      for (let j = y; j < y + fd; j++) for (let k = x; k < x + fw; k++) { const i = this.id(k, j); this.bld[i] = b.id + 1; this.obj[i] = 0; }
      if (door) { const di = this.id(door.x, door.y); this.flag[di] |= F_DOOR | F_NODECOR; this.obj[di] = 0; }
      return b;
    }
    // can a fw x fd building go at (x,y)? `okTile(i)` tests footprint tiles
    canPlace(x, y, fw, fd, okTile, margin) {
      for (let j = y; j < y + fd; j++) for (let k = x; k < x + fw; k++) {
        if (!this.inb(k, j)) return false;
        const i = this.id(k, j);
        if (this.bld[i] || (this.flag[i] & F_DOOR) || !okTile(i)) return false;
      }
      if (margin) for (let j = y - 1; j <= y + fd; j++) for (let k = x - 1; k <= x + fw; k++) {
        if (!this.inb(k, j)) continue;
        if (this.bld[this.id(k, j)]) return false;
      }
      return true;
    }
    findDoor(x, y, fw, fd, walk, allSides) {
      const c = [[x + (fw >> 1), y + fd, 's'], [x + fw, y + (fd >> 1), 'e']];
      for (let k = 0; k < fw; k++) c.push([x + k, y + fd, 's']);
      for (let k = 0; k < fd; k++) c.push([x + fw, y + k, 'e']);
      if (allSides) {
        c.push([x + (fw >> 1), y - 1, 'n'], [x - 1, y + (fd >> 1), 'w']);
        for (let k = 0; k < fw; k++) c.push([x + k, y - 1, 'n']);
        for (let k = 0; k < fd; k++) c.push([x - 1, y + k, 'w']);
      }
      for (const [dx, dy, side] of c) {
        if (!this.inb(dx, dy)) continue;
        const i = this.id(dx, dy);
        if (!this.bld[i] && walk(i)) return { x: dx, y: dy, side };
      }
      return null;
    }

    buildTowns() {
      const ter = this.ter, zone = this.zone;
      const townWalk = (i) => { const t = ter[i]; return t === T.PAVE || t === T.YARD || t === T.STREET || t === T.PLAZA || t === T.ROAD || t === T.DIRT; };
      // town lots open straight onto a street, so every door is reachable
      const streetDoor = (i) => { const t = ter[i]; return t === T.STREET || t === T.ROAD || t === T.PLAZA || t === T.BRIDGE; };
      for (const t of this.towns) {
        const z = t.idx + 1, p = t.prov;
        const okTile = (i) => zone[i] === z && (ter[i] === T.PAVE || ter[i] === T.YARD);
        const okPlaza = (i) => zone[i] === z && ter[i] === T.PLAZA;
        const place = (type, opts) => {
          opts = opts || {};
          const def = S77.BUILDINGS[type];
          const fw = opts.fw || def.fw, fd = opts.fd || def.fd;
          const blocks = opts.blocks || t.blocks.filter((b) => !b.plaza);
          for (const bl of blocks) {
            for (let y = bl.y1 - fd + 1; y >= bl.y0; y--) for (let x = bl.x0; x <= bl.x1 - fw + 1; x++) {
              if (!this.canPlace(x, y, fw, fd, opts.ok || okTile, opts.margin === true)) continue;
              const door = this.findDoor(x, y, fw, fd, opts.walk || streetDoor, true);
              if (!door) continue;
              const b = this.addBuilding(type, x, y, fw, fd, door, Object.assign({ town: t.idx, prov: t.idx }, opts.extra || {}));
              t.buildings.push(b.id);
              return b;
            }
          }
          return null;
        };
        // plaza: landmark + city pillar
        if (t.plaza) {
          const lm = place('landmark', { blocks: [t.plaza], ok: okPlaza, walk: townWalk, margin: true, extra: { name: p.landmark, lm: p.lmType } });
          if (lm) t.landmark = lm.id;
          place('pillar', { blocks: [t.plaza], ok: okPlaza, walk: townWalk, margin: true });
          if (!lm) { const b2 = place('landmark', { extra: { name: p.landmark, lm: p.lmType } }); if (b2) t.landmark = b2.id; }
        }
        // outskirts: lots beside the main avenues just outside the grid
        const outskirts = (type) => {
          const def = S77.BUILDINGS[type], fw = def.fw, fd = def.fd;
          const okOut = (i) => { const tt = ter[i]; return this.land[i] === 1 && (!zone[i] || zone[i] === z) && !WATER[tt] && tt !== T.MOUNTAIN && tt !== T.ROAD && tt !== T.STREET && tt !== T.BRIDGE && tt !== T.PLAZA && tt !== T.RUNWAY && (!t.island || this.isle[i] === t.island); };
          const ext = Math.round(t.R * 1.45);
          for (let d = Math.round(t.R * 0.7); d <= ext; d++) {
            for (const [ax, ay, alongX] of [[t.cx + d, t.cy, 1], [t.cx - d, t.cy, 1], [t.cx, t.cy + d, 0], [t.cx, t.cy - d, 0]]) {
              const cands = alongX ? [[ax, ay - fd], [ax, ay + 1], [ax - fw + 1, ay - fd], [ax - fw + 1, ay + 1]] : [[ax - fw, ay], [ax + 1, ay], [ax - fw, ay - fd + 1], [ax + 1, ay - fd + 1]];
              for (const [x, y] of cands) {
                if (!this.canPlace(x, y, fw, fd, okOut, true)) continue;
                const door = this.findDoor(x, y, fw, fd, streetDoor, true);
                if (!door) continue;
                for (let j = y; j < y + fd; j++) for (let k = x; k < x + fw; k++) { const i = this.id(k, j); zone[i] = z; this.prov[i] = z; ter[i] = T.PAVE; if (this.elev[i] > 80) this.elev[i] = 40; }
                const b = this.addBuilding(type, x, y, fw, fd, door, { town: t.idx, prov: t.idx, outside: true });
                t.buildings.push(b.id);
                return b;
              }
            }
          }
          return null;
        };
        const key = ['hall', 'market', 'bus', 'lodge', 'store', 'restaurant', 'jobcenter', 'temple', 'hospital', 'school', 'police', 'bank', 'sala', 'forsale'];
        if (p.rail) key.splice(3, 0, 'train');
        if (p.muslim) key.splice(3, 0, 'mosque');
        if (p.arch === 'sino' || p.key === 'nakhonsawan' || p.key === 'bangkok') key.push('cjshrine');
        if (p.tier <= 2) key.push('mall', 'office', 'store', 'restaurant', 'lodge');
        if (p.econ.indexOf('I') >= 0) key.push('factory');
        if (p.key === 'bangkok') key.push('parliament', 'govhouse', 'mall', 'office', 'office', 'hospital', 'school', 'market', 'temple', 'lodge', 'lodge', 'bus', 'store', 'store', 'restaurant', 'restaurant');
        t.missing = [];
        const OUT_FIRST = { factory: 1, school: 1, hospital: 1 };
        for (const k of key) {
          let b = OUT_FIRST[k] ? outskirts(k) || place(k) : place(k) || outskirts(k);
          if (b) { if (t[k] === undefined) t[k] = b.id; } else t.missing.push(k);
        }
        // airport outside town (with runway) or fallback inside
        if (p.airport) this.placeAirport(t, townWalk) || ((t.airport = (place('airport', { fw: 5, fd: 3 }) || {}).id), t.airport === undefined && t.missing.push('airport'));
        // fillers
        const core = t.R * 0.55;
        for (const bl of t.blocks) {
          if (bl.plaza) continue;
          const isCore = bl.d < core;
          for (let y = bl.y0; y <= bl.y1; y++) for (let x = bl.x0; x <= bl.x1; x++) {
            const opts = [];
            if (p.tier === 1 && bl.d < t.R * 0.7) opts.push(['tower', 3, 3], ['condo', 3, 3], ['shophouse', 6, 2], ['shophouse', 4, 2]);
            else if (isCore) opts.push(['shophouse', 6, 2], ['shophouse', 4, 2], ['shophouse', 2, 2]);
            else opts.push(['house', 2, 2]);
            for (const [type, fw, fd] of opts) {
              if (U.hash2(x, y, 101) < 0.18 && type !== 'house') continue;
              if (!this.canPlace(x, y, fw, fd, okTile, false)) continue;
              const door = this.findDoor(x, y, fw, fd, streetDoor, true);
              if (!door) continue;
              const b = this.addBuilding(type, x, y, fw, fd, door, { town: t.idx, prov: t.idx, arch: p.arch, h: type === 'tower' ? 80 + ((U.hash2(x, y, 5) * 70) | 0) : type === 'condo' ? 56 + ((U.hash2(x, y, 6) * 30) | 0) : S77.BUILDINGS[type].h });
              t.buildings.push(b.id);
              break;
            }
          }
        }
        this.decorTown(t);
      }
    }
    placeAirport(t, townWalk) {
      const land = this.land, ter = this.ter, zone = this.zone;
      const free = (i) => land[i] === 1 && !WATER[ter[i]] && ter[i] !== T.MOUNTAIN && !zone[i] && ter[i] !== T.ROAD && ter[i] !== T.BRIDGE && (!t.island || this.isle[i] === t.island);
      const RW = 20, RH = 9; // area: runway row + terminal rows
      const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (let dist = t.R + 4; dist < t.R + 34; dist += 3) for (const [dx, dy] of dirs) {
        const ox = Math.round(t.cx + dx * dist - RW / 2), oy = Math.round(t.cy + dy * dist - RH / 2);
        let ok = true;
        for (let y = oy - 1; y <= oy + RH && ok; y++) for (let x = ox - 1; x <= ox + RW && ok; x++) if (!this.inb(x, y) || !free(this.id(x, y))) ok = false;
        if (!ok) continue;
        // runway: 3 rows at the top, apron, terminal 7x4 at bottom-left, door south
        for (let y = oy; y < oy + 3; y++) for (let x = ox; x < ox + RW; x++) { const i = this.id(x, y); ter[i] = T.RUNWAY; zone[i] = t.idx + 1; this.obj[i] = 0; }
        for (let y = oy + 3; y < oy + RH; y++) for (let x = ox; x < ox + RW; x++) { const i = this.id(x, y); ter[i] = T.PAVE; zone[i] = t.idx + 1; this.obj[i] = 0; }
        const bx = ox + 2, by = oy + 4;
        const door = { x: bx + 3, y: by + 4, side: 's' };
        const b = this.addBuilding('airport', bx, by, 7, 4, door, { town: t.idx, prov: t.idx, outside: true });
        t.airport = b.id; t.buildings.push(b.id);
        // road from terminal to town centre (L path)
        const lay = (x, y) => { if (!this.inb(x, y)) return; const i = this.id(x, y); if (this.bld[i]) return; if (WATER[ter[i]]) { ter[i] = T.BRIDGE; } else if (ter[i] !== T.STREET && ter[i] !== T.RUNWAY && ter[i] !== T.PLAZA) ter[i] = T.ROAD; this.obj[i] = 0; };
        const sx = door.x, sy = door.y + 1;
        for (let y = door.y; y <= sy; y++) lay(sx, y);
        const ex = t.cx, s1 = Math.sign(ex - sx);
        for (let x = sx; x !== ex; x += s1 || 1) { lay(x, sy); if (!s1) break; }
        const s2 = Math.sign(t.cy - sy);
        for (let y = sy; y !== t.cy; y += s2 || 1) { lay(ex, y); if (!s2) break; }
        return true;
      }
      return false;
    }
    decorTown(t) {
      const ter = this.ter, zone = this.zone, obj = this.obj, z = t.idx + 1;
      for (let y = t.cy - t.R - 3; y <= t.cy + t.R + 3; y++) for (let x = t.cx - t.R - 3; x <= t.cx + t.R + 3; x++) {
        if (!this.inb(x, y)) continue;
        const i = this.id(x, y);
        if (zone[i] !== z || this.bld[i] || (this.flag[i] & F_NODECOR)) continue;
        const tt = ter[i], h = U.hash2(x, y, 202);
        const nearStreet = ter[i - 1] === T.STREET || ter[i + 1] === T.STREET || ter[i - this.W] === T.STREET || ter[i + this.W] === T.STREET;
        if (tt === T.PAVE) {
          if (nearStreet && (x + y) % 5 === 0) obj[i] = O.LAMP;
          else if (h < 0.035) obj[i] = O.TREE_RAIN;
          else if (h < 0.05) obj[i] = O.JAR;
        } else if (tt === T.YARD) {
          if (nearStreet && (x + y) % 6 === 0) obj[i] = O.POLE;
          else if (h < 0.16) obj[i] = U.pick([O.TREE_RAIN, O.TREE_MANGO, O.TREE_BANANA, O.TREE_PALM, O.TREE_GOLDEN, O.TREE_FLAME], U.hash2(x, y, 203));
          else if (h < 0.2) obj[i] = O.FLOWERS;
          else if (h < 0.23) obj[i] = O.SPIRIT;
          else if (h < 0.26) obj[i] = O.BUSH;
        } else if (tt === T.PLAZA) {
          const pl = t.plaza;
          const edge = x === pl.x0 || x === pl.x1 || y === pl.y0 || y === pl.y1;
          if (edge && (x + y) % 2 === 0) obj[i] = (x + y) % 4 === 0 ? O.LAMP : O.TREE_GOLDEN;
          else if (h < 0.08) obj[i] = O.BENCH;
          else if (h < 0.12) obj[i] = O.FLOWERS;
        }
      }
      // food stalls & a flag near the market / hall
      const near = (bid, objId, n) => {
        if (bid === undefined) return;
        const b = this.buildings[bid];
        let placed = 0;
        for (let k = 0; k < 30 && placed < n; k++) {
          const x = b.x - 1 + ((U.hash2(b.id, k, 7) * (b.fw + 2)) | 0), y = b.y + b.fd + 1 + ((U.hash2(b.id, k, 8) * 2) | 0);
          if (!this.inb(x, y)) continue;
          const i = this.id(x, y);
          if (this.bld[i] || obj[i] || (this.flag[i] & F_NODECOR) || zone[i] !== z || (ter[i] !== T.PAVE && ter[i] !== T.YARD && ter[i] !== T.PLAZA)) continue;
          obj[i] = objId; placed++;
        }
      };
      near(t.market, O.STALL, 3); near(t.plaza ? undefined : undefined, O.FLAG, 1); near(t.hall, O.FLAG, 1); near(t.school, O.FLAG, 1);
    }

    /* ---------- villages ---------- */
    genVillages() {
      const ter = this.ter, land = this.land, zone = this.zone, elev = this.elev, prov = this.prov, W = this.W, H = this.H;
      const r = U.rng(this.seed * 7 + 3);
      const G = 23;
      const lowOK = (t) => t === T.GRASS || t === T.PADDY || t === T.FIELD || t === T.PLANT || t === T.ORCHARD || t === T.DRYGRASS || t === T.FOREST;
      const vgrid = new Map();
      const villageWalk = (i) => { const t = ter[i]; return t === T.DIRT || t === T.GRASS || t === T.YARD || t === T.ROAD || t === T.STREET || t === T.DRYGRASS; };
      for (let gy = 0; gy < H; gy += G) for (let gx = 0; gx < W; gx += G) {
        const vx = gx + r.int(4, G - 4), vy = gy + r.int(4, G - 4);
        if (!this.inb(vx, vy)) continue;
        const i = this.id(vx, vy);
        if (land[i] !== 1 || !lowOK(ter[i]) || elev[i] > 70 || !prov[i]) continue;
        // keep clear of towns & sea
        let bad = false;
        for (const t of this.towns) if (Math.hypot(t.cx - vx, t.cy - vy) < t.R + 10) { bad = true; break; }
        if (bad || this.coastDist[i] < 3) continue;
        const p = S77.PROVINCES[prov[i] - 1];
        const vr = r.int(4, 6);
        // check usable land around
        let usable = 0;
        for (let y = vy - vr; y <= vy + vr; y++) for (let x = vx - vr; x <= vx + vr; x++) if (this.inb(x, y) && lowOK(ter[this.id(x, y)]) && !zone[this.id(x, y)]) usable++;
        if (usable < (2 * vr + 1) * (2 * vr + 1) * 0.7) continue;
        const vid = this.villages.length;
        const pre = S77.VILLAGE_NAMES.pre[p.dialect] || S77.VILLAGE_NAMES.pre.central;
        let name = r.pick(pre) + r.pick(S77.VILLAGE_NAMES.suf);
        const v = { id: vid, x: vx, y: vy, r: vr, prov: p.idx, name, buildings: [] };
        this.villages.push(v);
        const z = 100 + vid;
        for (let y = vy - vr - 1; y <= vy + vr + 1; y++) for (let x = vx - vr - 1; x <= vx + vr + 1; x++) {
          if (!this.inb(x, y)) continue;
          const j = this.id(x, y);
          if (zone[j] || land[j] !== 1 || WATER[ter[j]] || ter[j] === T.MOUNTAIN || ter[j] === T.ROAD) continue;
          if (Math.hypot(x - vx, y - vy) > vr + 0.5 + U.hash2(x, y, 303)) continue;
          zone[j] = z;
          ter[j] = x === vx || y === vy ? T.DIRT : p.region === 'northeast' ? T.DRYGRASS : T.GRASS;
          if (elev[j] > 60) elev[j] = 40;
        }
        const okTile = (j) => zone[j] === z && (ter[j] === T.GRASS || ter[j] === T.DRYGRASS);
        const types = ['house', 'house', 'house'];
        if (r() < 0.6) types.push('house');
        if (r() < 0.4) types.push('house');
        if (r() < 0.45) types.splice(1, 0, 'grocery');
        if (r() < 0.3) types.unshift('vtemple');
        if (r() < 0.35) types.push('vsala');
        if (r() < 0.5) types.push('barn');
        for (const type of types) {
          const def = S77.BUILDINGS[type];
          for (let k = 0; k < 40; k++) {
            const x = vx + r.int(-vr, vr - def.fw + 1), y = vy + r.int(-vr, vr - def.fd + 1);
            if (!this.canPlace(x, y, def.fw, def.fd, okTile, true)) continue;
            const door = this.findDoor(x, y, def.fw, def.fd, villageWalk);
            if (!door && type !== 'barn') continue;
            const b = this.addBuilding(type, x, y, def.fw, def.fd, door, { village: vid, prov: p.idx, arch: p.arch });
            v.buildings.push(b.id);
            break;
          }
        }
        this.connectVillage(v);
      }
    }
    connectVillage(v) {
      const ter = this.ter, W = this.W;
      let best = null;
      for (let rr = v.r + 1; rr < 46 && !best; rr++) {
        for (let k = -rr; k <= rr && !best; k++) {
          for (const [x, y] of [[v.x + k, v.y - rr], [v.x + k, v.y + rr], [v.x - rr, v.y + k], [v.x + rr, v.y + k]]) {
            if (!this.inb(x, y)) continue;
            const t = ter[this.id(x, y)];
            if (t === T.ROAD || t === T.STREET) { best = [x, y]; break; }
          }
        }
      }
      if (!best) return;
      // L-path: along x then y; abort over long water or mountains
      const path = [];
      const sx = Math.sign(best[0] - v.x), sy = Math.sign(best[1] - v.y);
      for (let x = v.x; x !== best[0]; x += sx) path.push([x, v.y]);
      for (let y = v.y; y !== best[1] + sy && sy; y += sy) path.push([best[0], y]);
      let water = 0;
      for (const [x, y] of path) { const t = ter[this.id(x, y)]; if (WATER[t]) water++; else water = 0; if (water > 5 || t === T.MOUNTAIN || this.land[this.id(x, y)] !== 1 || this.bld[this.id(x, y)]) return; }
      for (const [x, y] of path) {
        const i = this.id(x, y), t = ter[i];
        if (t === T.ROAD || t === T.STREET || t === T.BRIDGE) continue;
        ter[i] = WATER[t] ? T.BRIDGE : T.DIRT;
        this.obj[i] = 0;
      }
      v.connected = true;
    }

    /* ---------- nature decoration ---------- */
    genDecor() {
      const W = this.W, H = this.H, ter = this.ter, obj = this.obj, elev = this.elev, prov = this.prov, land = this.land, bld = this.bld, flag = this.flag;
      const P = S77.PROVINCES;
      const karst = GEO.KARST.map((k) => ({ w: k.w * this.TPD_Y, pts: U.spline(k.pts.map((p) => this.toTile(p)), 4) }));
      const karstNear = (x, y) => { for (const k of karst) for (let j = 0; j < k.pts.length - 1; j++) if (U.segDist(x, y, k.pts[j][0], k.pts[j][1], k.pts[j + 1][0], k.pts[j + 1][1]) < k.w) return true; return false; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (obj[i] || bld[i] || (flag[i] & F_NODECOR)) continue;
        const t = ter[i], h = U.hash2(x, y, 401), h2 = U.hash2(x, y, 402);
        const p = prov[i] ? P[prov[i] - 1] : null, reg = p ? p.region : '';
        const lat = this.yToLat(y);
        switch (t) {
          case T.GRASS:
            if (h < 0.06) obj[i] = reg === 'north' && h2 < 0.25 ? O.TREE_SAKURA : U.pick([O.TREE_RAIN, O.TREE_MANGO, O.TREE_GOLDEN, O.TREE_FLAME, O.TREE_RAIN, O.TREE_BANANA], h2);
            else if (h < 0.1) obj[i] = O.BUSH;
            else if (h < 0.13) obj[i] = O.FLOWERS;
            else if (h < 0.16) obj[i] = O.TALLGRASS;
            break;
          case T.DRYGRASS:
            if (h < 0.05) obj[i] = h2 < 0.5 ? O.TREE_DRY : O.TREE_RAIN;
            else if (h < 0.09) obj[i] = O.TALLGRASS;
            else if (h < 0.1) obj[i] = O.ROCK;
            break;
          case T.PADDY:
            if (h < 0.004) obj[i] = O.HUT;
            else if (h < 0.009) obj[i] = O.SCARECROW;
            else if (h < 0.022 && (reg === 'central' || reg === 'west' || reg === 'northeast')) obj[i] = O.TREE_SUGARPALM;
            break;
          case T.FIELD:
            if (h < 0.012) obj[i] = O.TREE_RAIN;
            else if (reg === 'north' && h < 0.5 && (x + y) % 2 === 0) obj[i] = O.CORN;
            break;
          case T.FOREST: {
            const hi = elev[i] > 70;
            if (h < 0.42) obj[i] = reg === 'north' && hi ? (h2 < 0.6 ? O.TREE_PINE : O.TREE_TEAK) : h2 < 0.15 ? O.TREE_BAMBOO : h2 < 0.6 ? O.TREE_TEAK : O.TREE_RAIN;
            else if (h < 0.47) obj[i] = O.BUSH;
            break;
          }
          case T.HILL:
            if (h < 0.38) obj[i] = reg === 'north' ? (h2 < 0.55 ? O.TREE_PINE : O.TREE_TEAK) : h2 < 0.2 ? O.TREE_BAMBOO : O.TREE_TEAK;
            else if (h < 0.44) obj[i] = O.ROCK;
            else if (h < 0.5) obj[i] = O.BUSH;
            break;
          case T.JUNGLE:
            if (karstNear(x, y) && h < 0.07) obj[i] = O.KARST;
            else if (h < 0.55) obj[i] = h2 < 0.55 ? O.TREE_JUNGLE : h2 < 0.75 ? O.TREE_PALM : O.TREE_BAMBOO;
            else if (h < 0.6) obj[i] = O.BUSH;
            break;
          case T.MOUNTAIN:
            obj[i] = O.PEAK;
            break;
          case T.PLANT: {
            const oil = lat < 9.8 && lat > 7.7 && (p && (p.key === 'krabi' || p.key === 'surat' || p.key === 'chumphon' || p.key === 'phangnga'));
            if (karstNear(x, y) && h < 0.04) obj[i] = O.KARST;
            else if (oil ? x % 3 === 0 && y % 3 === 0 : x % 2 === 0 && y % 2 === 0) obj[i] = oil ? O.TREE_OILPALM : O.TREE_RUBBER;
            break;
          }
          case T.ORCHARD:
            if (x % 3 === 0 && y % 3 === 0) obj[i] = reg === 'south' && h2 < 0.4 ? O.TREE_PALM : O.TREE_MANGO;
            else if (h < 0.05) obj[i] = O.TREE_BANANA;
            break;
          case T.SAND:
            if (this.coastDist[i] >= 1 && h < 0.07) obj[i] = O.TREE_PALM;
            else if (h < 0.08) obj[i] = O.ROCK;
            else if (h < 0.095 && p && p.econ.indexOf('T') >= 0) obj[i] = O.PARASOL;
            break;
          case T.MANGROVE:
            if (h < 0.5) obj[i] = O.TREE_MANGROVE;
            break;
          case T.SEA:
            if (karstNear(x, y) && h < 0.03) obj[i] = O.KARST;
            else if (h < 0.003) obj[i] = O.BOAT;
            break;
          case T.RIVER:
            if (h < 0.006) obj[i] = O.BOAT;
            break;
          case T.FOREIGN:
            if (h < 0.12) obj[i] = O.TREE_TEAK;
            break;
          case T.ROAD:
            // power poles along highways
            if ((x * 7 + y * 3) % 11 === 0) {
              for (const [nx, ny] of [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]]) {
                if (!this.inb(nx, ny)) continue;
                const j = this.id(nx, ny), tj = ter[j];
                if (!obj[j] && !bld[j] && !(flag[j] & F_NODECOR) && (tj === T.GRASS || tj === T.PADDY || tj === T.FIELD || tj === T.DRYGRASS)) { obj[j] = O.POLE; break; }
              }
            }
            break;
        }
      }
      // piers for ferry routes and fishing
      for (const F of GEO.FERRIES) {
        const a = this.placePier(F.a), b = this.placePier(F.b);
        if (a && b) { a.routes.push({ to: b, name: F.name, price: F.price, mins: F.mins }); b.routes.push({ to: a, name: F.name, price: F.price, mins: F.mins }); }
      }
      // a fishing pier for each coastal town
      for (const t of this.towns) {
        if (this.coastDist[this.id(t.cx, t.cy)] < t.R + 14) {
          const lon = this.xToLon(t.cx), lat = this.yToLat(t.cy);
          const pr = this.placePier([lon, lat], 30);
          if (pr) pr.town = t.idx;
        }
      }
    }
    placePier(ll, maxR) {
      const [px, py] = this.toTile(ll).map(Math.round);
      for (const q of this.pois) if (q.type === 'pier' && Math.hypot(q.x - px, q.y - py) < 4) return q;
      const lim = maxR || 24;
      for (let r = 0; r < lim; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const x = px + ox, y = py + oy;
        if (!this.inb(x, y)) continue;
        const i = this.id(x, y);
        if (this.land[i] !== 1 || WATER[this.ter[i]] || this.bld[i] || this.ter[i] === T.MOUNTAIN) continue;
        // must touch the sea on the south or east (visible side) for the dock sprite
        const sea = [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]].find(([nx, ny]) => this.inb(nx, ny) && (this.ter[this.id(nx, ny)] === T.SEA || this.ter[this.id(nx, ny)] === T.DEEP));
        if (!sea) continue;
        const di = this.id(sea[0], sea[1]);
        this.obj[di] = O.PIER; this.obj[i] = 0; this.flag[i] |= F_NODECOR;
        const poi = { type: 'pier', x, y, dock: sea, prov: this.prov[i] - 1, routes: [] };
        this.pois.push(poi);
        return poi;
      }
      return null;
    }

    indexBuildings() {
      this.bldChunks = new Array(this.CW * this.CHH);
      for (const b of this.buildings) {
        // index by the chunk of its front (south-east) corner so it renders with the right chunk band
        const cx = Math.floor((b.x + b.fw - 1) / this.CH), cy = Math.floor((b.y + b.fd - 1) / this.CH);
        const k = cy * this.CW + cx;
        (this.bldChunks[k] = this.bldChunks[k] || []).push(b);
      }
      this.poiChunks = new Map();
      for (const p of this.pois) { const k = Math.floor(p.y / this.CH) * this.CW + Math.floor(p.x / this.CH); if (!this.poiChunks.has(k)) this.poiChunks.set(k, []); this.poiChunks.get(k).push(p); }
      // stats
      this.stats = { buildings: this.buildings.length, villages: this.villages.length, piers: this.pois.length };
    }

    // nearest walkable tile to (x,y) (spiral search)
    nearestWalkable(x, y, maxR) {
      for (let r = 0; r < (maxR || 20); r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        if (!this.blockedTile(x + ox, y + oy)) return [x + ox, y + oy];
      }
      return [x, y];
    }
  }
  S77.World = World;
  S77.F_DOOR = F_DOOR;
})();
