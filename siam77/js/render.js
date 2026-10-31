/* render.js — isometric renderer.
   World is drawn into a low-resolution buffer (true pixel art) which is then
   scaled up with nearest-neighbour onto the screen canvas; text/labels are
   drawn afterwards at full resolution so Thai text stays crisp.
   Projection: tile (x,y) top corner -> screen ((x-y)*16, (x+y)*8). */
'use strict';
(function () {
  const U = S77.U, T = S77.T, O = S77.O, SP = S77.Sprites;
  const CH = 16, CW_PX = 512, CH_PX = 16 * 16 + 24, C_OX = 256;

  class Renderer {
    constructor(canvas, world) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d');
      this.lcv = document.createElement('canvas'); this.lctx = this.lcv.getContext('2d');
      this.world = world;
      this.chunks = new Map();
      this.maxChunks = 72;
      this.season = 'harvest';
      this.targetW = 600;
      this.zoom = 2;
      this.frame = 0;
      this.offX = 0; this.offY = 0;
      this.lights = [];
      this.labels = [];
      this.resize();
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
      this.cv.width = w; this.cv.height = h;
      this.cv.style.width = window.innerWidth + 'px'; this.cv.style.height = window.innerHeight + 'px';
      this.dpr = dpr;
      const mobile = window.innerWidth < 700;
      const target = mobile ? Math.min(this.targetW, 360) : this.targetW;
      this.zoom = Math.max(1, Math.round(w / target));
      this.buf.width = Math.ceil(w / this.zoom); this.buf.height = Math.ceil(h / this.zoom);
      this.lcv.width = this.buf.width; this.lcv.height = this.buf.height;
    }
    setTargetWidth(px) { this.targetW = px; this.resize(); }
    setSeason(s) { if (s !== this.season) { this.season = s; this.chunks.clear(); } }
    invalidateAt(x, y) { const k = Math.floor(x / CH) + ',' + Math.floor(y / CH); this.chunks.delete(k); }

    /* ---------- ground chunks ---------- */
    buildChunk(ccx, ccy) {
      const w = this.world, cv = document.createElement('canvas');
      cv.width = CW_PX; cv.height = CH_PX;
      const g = cv.getContext('2d');
      const x0 = ccx * CH, y0 = ccy * CH, ter = w.ter, W = w.W;
      const isW = (x, y) => { if (!w.inb(x, y)) return true; return S77.isWater(ter[y * W + x]); };
      // pass 1: water (lowered by 4px) + foam
      for (let s = 0; s < CH * 2 - 1; s++) for (let tx = Math.max(0, s - CH + 1); tx <= Math.min(CH - 1, s); tx++) {
        const ty = s - tx, x = x0 + tx, y = y0 + ty;
        if (!w.inb(x, y)) continue;
        const t = ter[y * W + x];
        if (!S77.isWater(t)) continue;
        const px = C_OX + (tx - ty) * 16, py = (tx + ty) * 8;
        const and = t === T.SEA && x < w.lonToX(99.9) ? 4 : 0;
        g.drawImage(SP.tile(t, (U.hash2(x, y, 11) * 4 | 0) + and, this.season), px - 16, py + 4);
        let m = 0;
        if (!isW(x - 1, y)) m |= 1; if (!isW(x, y - 1)) m |= 2; if (!isW(x + 1, y)) m |= 4; if (!isW(x, y + 1)) m |= 8;
        if (m) g.drawImage(SP.foam(m), px - 16, py + 4);
      }
      // pass 2: land + cliffs + door mats
      for (let s = 0; s < CH * 2 - 1; s++) for (let tx = Math.max(0, s - CH + 1); tx <= Math.min(CH - 1, s); tx++) {
        const ty = s - tx, x = x0 + tx, y = y0 + ty;
        if (!w.inb(x, y)) continue;
        const i = y * W + x, t = ter[i];
        if (S77.isWater(t)) continue;
        const px = C_OX + (tx - ty) * 16, py = (tx + ty) * 8;
        const rd = t === T.ROAD || t === T.BRIDGE || t === T.RUNWAY ? w.road[i] : 0;
        g.drawImage(SP.tile(t, U.hash2(x, y, 11) * 4 | 0, this.season, rd === 4 ? 0 : rd), px - 16, py);
        const kind = t === T.SAND ? 'sand' : S77.isPaved(t) ? 'stone' : 'earth';
        if (isW(x, y + 1) && w.inb(x, y + 1)) g.drawImage(SP.cliff('s', kind), px - 16, py + 8);
        if (isW(x + 1, y) && w.inb(x + 1, y)) g.drawImage(SP.cliff('e', kind), px, py + 8);
        if (w.flag[i] & S77.F_DOOR) { g.fillStyle = 'rgba(70,45,30,0.55)'; g.fillRect(px - 4, py + 7, 8, 2); g.fillRect(px - 2, py + 6, 4, 4); }
      }
      return cv;
    }
    chunk(ccx, ccy) {
      const k = ccx + ',' + ccy;
      let c = this.chunks.get(k);
      if (c) { this.chunks.delete(k); this.chunks.set(k, c); return c; }
      c = this.buildChunk(ccx, ccy);
      this.chunks.set(k, c);
      if (this.chunks.size > this.maxChunks) this.chunks.delete(this.chunks.keys().next().value);
      return c;
    }

    /* ---------- helpers ---------- */
    toBuf(px, py) { return [(px - py) * 16 + this.offX, (px + py) * 8 + this.offY]; }
    toScreen(px, py, z) { const [bx, by] = this.toBuf(px, py); return [bx * this.zoom, (by - (z || 0)) * this.zoom]; }
    fromScreen(sx, sy) { // screen px (device) -> world tile coords
      const X = sx / this.zoom - this.offX, Y = sy / this.zoom - this.offY;
      return [(X / 16 + Y / 8) / 2, (Y / 8 - X / 16) / 2];
    }

    /* ---------- main draw ---------- */
    render(game, dt) {
      this.frame++;
      const w = this.world, b = this.bctx, bw = this.buf.width, bh = this.buf.height;
      const cam = game.camera;
      this.offX = Math.floor(bw / 2) - Math.round((cam.x - cam.y) * 16);
      this.offY = Math.floor(bh / 2) - Math.round((cam.x + cam.y) * 8);
      const offX = this.offX, offY = this.offY;
      const night = game.time.isNight();
      b.globalCompositeOperation = 'source-over';
      b.fillStyle = '#1d6aa8'; b.fillRect(0, 0, bw, bh);
      // visible tile bounds
      const corners = [[0, -40], [bw, -40], [0, bh + 140], [bw, bh + 140]].map(([sx, sy]) => this.fromScreen(sx * this.zoom, sy * this.zoom));
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const [x, y] of corners) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
      minx = Math.max(0, Math.floor(minx) - 2); miny = Math.max(0, Math.floor(miny) - 2); maxx = Math.min(w.W - 1, Math.ceil(maxx) + 2); maxy = Math.min(w.H - 1, Math.ceil(maxy) + 2);
      // ground
      const cl = [];
      for (let cy = Math.floor(miny / CH); cy <= Math.floor(maxy / CH); cy++) for (let cx = Math.floor(minx / CH); cx <= Math.floor(maxx / CH); cx++) {
        const X0 = (cx * CH - cy * CH) * 16 + offX - C_OX, Y0 = (cx * CH + cy * CH) * 8 + offY;
        if (X0 > bw || X0 + CW_PX < 0 || Y0 > bh || Y0 + CH_PX < 0) continue;
        cl.push([cx, cy, X0, Y0]);
      }
      cl.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
      let built = 0;
      for (const [cx, cy, X0, Y0] of cl) {
        const k = cx + ',' + cy;
        if (!this.chunks.has(k) && built > 3 && this.frame > 2) continue; // spread chunk building over frames
        if (!this.chunks.has(k)) built++;
        b.drawImage(this.chunk(cx, cy), X0, Y0);
      }
      // water sparkle + collect objects
      const items = [];
      const lights = (this.lights = []);
      const tsec = game.time.realSec;
      const ter = w.ter, obj = w.obj, W = w.W;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const X = (x - y) * 16 + offX, Y = (x + y) * 8 + offY;
        if (X < -48 || X > bw + 48 || Y < -60 || Y > bh + 130) continue;
        const i = y * W + x, o = obj[i], t = ter[i];
        if (S77.isWater(t) && Y < bh + 8 && U.hash2(x, y, (tsec * 1.5) | 0) < 0.05) {
          const sx = X - 8 + ((U.hash2(x, y, 5) * 16) | 0), sy = Y + 8 + ((U.hash2(x, y, 6) * 6) | 0);
          b.fillStyle = 'rgba(255,255,255,0.75)'; b.fillRect(sx, sy, 2, 1);
        }
        if (!o) continue;
        const spr = SP.object(o, U.hash2(x, y, 13) * 4 | 0, night, w.elev[i]);
        if (!spr) continue;
        const wy = S77.isWater(t) ? 4 : 0;
        const dx = o >= O.LAMP || o === O.KARST || o === O.PEAK ? X - spr.ax : X - spr.ax;
        items.push({ d: x + y + 1, img: spr, x: dx, y: Y - spr.ay + wy + (o === O.PEAK || o === O.KARST ? 0 : 0) });
        if (night && o === O.LAMP) lights.push([X + 3, Y + 8 - 24, 34, 'rgba(255,214,140,0.9)']);
      }
      // buildings as depth strips
      const seen = this.seenStamp = (this.seenStamp || 0) + 1;
      for (let cy = Math.floor(miny / CH) - 1; cy <= Math.floor(maxy / CH) + 1; cy++) for (let cx = Math.floor(minx / CH) - 1; cx <= Math.floor(maxx / CH) + 1; cx++) {
        const list = w.buildingsNearChunk(cx, cy);
        if (!list) continue;
        for (const bd of list) {
          if (bd._seen === seen) continue; bd._seen = seen;
          const X = (bd.x - bd.y) * 16 + offX, Y = (bd.x + bd.y) * 8 + offY;
          const spr = SP.building(bd, night);
          const sx = X - spr.ax, sy = Y - spr.ay;
          if (sx > bw || sx + spr.width < 0 || sy > bh || sy + spr.height < 0) continue;
          const n = bd.fw + bd.fd;
          for (let j = 0; j < n; j++) {
            const x0 = j === 0 ? 0 : 2 + 16 * j, x1 = j === n - 1 ? spr.width : 2 + 16 * (j + 1);
            const d = j < bd.fw ? bd.x + j + bd.y + bd.fd - 1 + 1 : bd.x + bd.fw - 1 + bd.y + bd.fd - 1 - (j - bd.fw) + 1;
            items.push({ d: d - 0.01, img: spr, sx: x0, sw: x1 - x0, x: sx + x0, y: sy });
          }
          if (night) {
            const big = bd.type === 'tower' || bd.type === 'condo' || bd.type === 'mall' || bd.type === 'lodge' || bd.type === 'hospital';
            lights.push([X + (bd.fw - bd.fd) * 8, Y + (bd.fw + bd.fd) * 4 - 6, big ? 56 : 30, 'rgba(255,200,120,0.75)']);
            if (bd.lm === 'lighthouse') lights.push([X, Y - 40, 90, 'rgba(255,240,180,0.9)']);
          }
        }
      }
      // entities (npcs, animals, player, remote vehicles)
      for (const e of game.visibleEntities()) {
        const [X, Y] = [(e.x - e.y) * 16 + offX, (e.x + e.y) * 8 + offY];
        if (X < -40 || X > bw + 40 || Y < -40 || Y > bh + 40) continue;
        items.push({ d: e.x + e.y, ent: e, X, Y });
        if (night && e.isPlayer) lights.push([X, Y - 10, 46, 'rgba(255,230,180,0.65)']);
      }
      items.sort((p, q) => p.d - q.d);
      for (const it of items) {
        if (it.ent) this.drawEntity(b, it.ent, it.X, it.Y, game);
        else if (it.sw) b.drawImage(it.img, it.sx, 0, it.sw, it.img.height, it.x, it.y, it.sw, it.img.height);
        else b.drawImage(it.img, it.x, it.y);
      }
      // interaction target highlight
      if (game.target && game.target.hl) {
        const [hx, hy] = this.toBuf(game.target.hl[0] + 0.5, game.target.hl[1] + 0.5);
        b.strokeStyle = 'rgba(255,240,120,' + (0.55 + 0.35 * Math.sin(tsec * 6)) + ')';
        b.beginPath(); b.moveTo(hx, hy - 8); b.lineTo(hx + 16, hy); b.lineTo(hx, hy + 8); b.lineTo(hx - 16, hy); b.closePath(); b.stroke();
      }
      this.drawAtmosphere(game, dt);
      // blit
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, 0, 0, bw * this.zoom, bh * this.zoom);
    }

    drawEntity(b, e, X, Y, game) {
      // shadow
      b.fillStyle = 'rgba(0,0,0,0.22)';
      b.beginPath(); b.ellipse(X, Y, e.shadow || 6, (e.shadow || 6) / 2.2, 0, 0, 6.283); b.fill();
      if (e.kind === 'animal') {
        const spr = SP.animal(e.species, e.color);
        const f = (e.moving ? (Math.floor(game.time.realSec * 6) % 2) : 0) + (e.faceLeft ? 4 : 0);
        b.drawImage(spr, f * spr.fw, 0, spr.fw, spr.fh, Math.round(X - spr.fw / 2), Math.round(Y - spr.fh + 2), spr.fw, spr.fh);
        return;
      }
      const spr = SP.character(e.look);
      const back = e.faceBack ? 1 : 0, mir = e.faceLeft ? 1 : 0;
      let f = 0;
      if (e.moving && !e.riding) f = Math.floor(e.anim * 8) % 4;
      const riseY = e.riding ? -3 : 0;
      if (e.riding) {
        const v = SP.vehicle(e.riding, back, mir);
        b.drawImage(v, Math.round(X - 14), Math.round(Y - 14));
      }
      b.drawImage(spr, (back * 4 + f) * spr.fw, mir * spr.fh, spr.fw, spr.fh, Math.round(X - spr.fw / 2), Math.round(Y - spr.fh + 1 + riseY), spr.fw, spr.fh);
      if (e.umbrella && game.weather.rain > 0.2) {
        b.fillStyle = '#d23a3a'; b.fillRect(Math.round(X - 9), Math.round(Y - 33), 18, 3); b.fillRect(Math.round(X - 6), Math.round(Y - 35), 12, 2); b.fillStyle = '#555'; b.fillRect(Math.round(X), Math.round(Y - 31), 1, 10);
      }
    }

    drawAtmosphere(game, dt) {
      const b = this.bctx, bw = this.buf.width, bh = this.buf.height;
      const L = game.time.lighting();
      const wx = game.weather;
      // haze / mist
      if (wx.haze > 0) { b.fillStyle = `rgba(196,176,140,${0.28 * wx.haze})`; b.fillRect(0, 0, bw, bh); }
      if (wx.mist > 0) { b.fillStyle = `rgba(235,240,245,${0.22 * wx.mist})`; b.fillRect(0, 0, bw, bh); }
      if (wx.rain > 0) { b.fillStyle = `rgba(40,55,80,${0.18 * wx.rain})`; b.fillRect(0, 0, bw, bh); }
      // lighting
      if (L.dark > 0.01 || L.tint) {
        const l = this.lctx;
        l.globalCompositeOperation = 'source-over';
        l.fillStyle = `rgb(${L.r},${L.g},${L.b})`; l.fillRect(0, 0, bw, bh);
        if (L.dark > 0.25) {
          l.globalCompositeOperation = 'lighter';
          for (const [x, y, r, c] of this.lights) { if (x < -r || y < -r || x > bw + r || y > bh + r) continue; l.drawImage(SP.light(r, c), x - r, y - r); }
        }
        b.globalCompositeOperation = 'multiply';
        b.drawImage(this.lcv, 0, 0);
        b.globalCompositeOperation = 'source-over';
      }
      // rain drops
      if (wx.rain > 0) {
        const n = Math.floor(160 * wx.rain), t = performance.now() / 1000;
        b.fillStyle = 'rgba(200,220,255,0.55)';
        for (let k = 0; k < n; k++) {
          const sx = (U.hash2(k, 1, 3) * bw + t * 120) % bw, sy = (U.hash2(k, 2, 3) * bh + t * 420 + k * 7) % bh;
          b.fillRect(sx | 0, sy | 0, 1, 4);
        }
      }
    }

    /* ---------- overview map (1px per tile) ---------- */
    buildMapCanvas() {
      const w = this.world, cv = document.createElement('canvas');
      cv.width = w.W; cv.height = w.H;
      const g = cv.getContext('2d'), img = g.createImageData(w.W, w.H), d = new Uint32Array(img.data.buffer);
      const col = {};
      const set = (t, h) => (col[t] = S77.PixelBuffer.pack(h));
      set(T.DEEP, '#1f5f9a'); set(T.SEA, '#2f86bd'); set(T.RIVER, '#4aa3c8'); set(T.LAKE, '#4aa3c8'); set(T.SAND, '#e6d39a'); set(T.GRASS, '#79b453');
      set(T.PADDY, '#9ccc5a'); set(T.FIELD, '#b7b46a'); set(T.FOREST, '#4a8a44'); set(T.JUNGLE, '#3a7a46'); set(T.HILL, '#6a9e52'); set(T.MOUNTAIN, '#8c8a76');
      set(T.PLANT, '#4f8a42'); set(T.ORCHARD, '#6faa4f'); set(T.ROAD, '#e6c24a'); set(T.STREET, '#8a8a90'); set(T.PAVE, '#c9c1b0'); set(T.PLAZA, '#d58a5a');
      set(T.DIRT, '#b58f60'); set(T.MANGROVE, '#55806a'); set(T.FOREIGN, '#9aa391'); set(T.BRIDGE, '#e6c24a'); set(T.YARD, '#8cc46a'); set(T.RUNWAY, '#555'); set(T.DRYGRASS, '#b9b468');
      const border = S77.PixelBuffer.pack('#2b2a33'), bld = S77.PixelBuffer.pack('#c0533f');
      const W = w.W;
      for (let i = 0; i < w.N; i++) {
        let c = col[w.ter[i]];
        if (w.bld[i]) c = bld;
        const p = w.prov[i];
        if (p && ((i % W > 0 && w.prov[i - 1] && w.prov[i - 1] !== p) || (i >= W && w.prov[i - W] && w.prov[i - W] !== p))) c = border;
        d[i] = c;
      }
      g.putImageData(img, 0, 0);
      this.mapCanvas = cv;
      return cv;
    }
  }
  S77.Renderer = Renderer;
})();
