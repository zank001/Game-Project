/* =============================================================
   sprites.js — วาดกราฟิกพิกเซลทั้งหมดด้วย canvas fillRect
   (สนามแข่ง ผู้ชม นักกีฬาหลายท่าทาง ลูกบอล ฉากไตเติล)
   ============================================================= */
'use strict';

const Sprites = {

  px(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  },

  shade(c, amt) {
    /* ปรับความสว่างของสี hex อย่างง่าย */
    const n = parseInt(c.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  },

  /* ---------- สนามแข่ง (canvas 384x216) ---------- */
  drawCourt(ctx, frame = 0, crowdSeed = 1) {
    const P = this.px.bind(this, ctx);

    /* ผนังยิม + แบนเนอร์ */
    P(0, 0, 384, 58, '#5a4a3c');
    P(0, 54, 384, 4, '#43372c');
    for (let i = 0; i < 8; i++) {
      const bx = 8 + i * 48;
      P(bx, 6, 36, 10, ['#c04a4a', '#3f6cd0', '#3fa05a', '#c07a2e'][i % 4]);
      P(bx + 2, 8, 32, 2, 'rgba(255,255,255,.5)');
    }

    /* อัฒจันทร์ + ผู้ชม (ขยับตาม frame) */
    P(0, 20, 384, 34, '#6b5947');
    let s = crowdSeed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const crowdCols = ['#e0b088', '#f2c9a0', '#d6a06b', '#c98f5f'];
    const shirtCols = ['#c04a4a', '#3f6cd0', '#3fa05a', '#e8862e', '#9b6bd6', '#f0d060', '#5a8a9a', '#c05a9a'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 42; i++) {
        const cx = 4 + i * 9 + (row % 2) * 4;
        const jump = rnd() < 0.18 && ((frame >> 3) + i + row) % 4 === 0 ? -2 : 0;
        const cy = 24 + row * 11 + jump;
        P(cx, cy, 4, 3, crowdCols[Math.floor(rnd() * 4)]);     /* หัว */
        P(cx - 1, cy + 3, 6, 4, shirtCols[Math.floor(rnd() * 8)]); /* ตัว */
      }
    }

    /* พื้นไม้ */
    for (let y = 58; y < 216; y += 8) {
      P(0, y, 384, 8, y % 16 === 2 ? '#c8874e' : '#c07f47');
      P(0, y + 7, 384, 1, '#a86b3a');
    }

    /* คอร์ท (สีฟ้า + ขอบส้ม) */
    P(30, 92, 324, 112, '#e8a05a');
    P(46, 100, 292, 96, '#4a7ab5');
    /* เส้นขาว */
    P(46, 100, 292, 2, '#f2ead8'); P(46, 194, 292, 2, '#f2ead8');
    P(46, 100, 2, 96, '#f2ead8'); P(336, 100, 2, 96, '#f2ead8');
    P(140, 100, 2, 96, 'rgba(242,234,216,.55)');   /* เส้นรุก ซ้าย */
    P(242, 100, 2, 96, 'rgba(242,234,216,.55)');   /* เส้นรุก ขวา */

    /* เน็ต */
    P(189, 88, 6, 108, 'rgba(0,0,0,.12)');          /* เงาใต้เน็ต */
    P(190, 84, 4, 110, 'rgba(255,255,255,.25)');
    for (let y = 84; y < 194; y += 4) P(190, y, 4, 1, '#f2ead8');
    P(190, 84, 4, 3, '#f2ead8');                    /* แถบขอบบนเน็ต */
    P(188, 82, 2, 114, '#43372c'); P(194, 82, 2, 114, '#43372c'); /* เสา */
    P(187, 80, 4, 4, '#5a5a5a'); P(193, 80, 4, 4, '#5a5a5a');
  },

  /* ---------- นักกีฬา ----------
     x, y = จุดกึ่งกลางปลายเท้า  pose: idle|ready|set|spike|block|serve|cheer|sad
     opts = { skin, hair, jersey, flip, frame } */
  drawPlayer(ctx, x, y, pose = 'idle', opts = {}) {
    const { skin = '#f2c9a0', hair = '#26221f', jersey = '#e8862e', flip = false, frame = 0 } = opts;
    const P = (dx, dy, w, h, c) => {
      const rx = flip ? -dx - w : dx;
      this.px(ctx, x + rx, y + dy, w, h, c);
    };
    const dark = this.shade(jersey, -40);
    const shorts = '#3a3a4a';
    const bob = (pose === 'idle' || pose === 'ready') ? ((frame >> 4) % 2) : 0;
    let jump = 0;
    if (pose === 'spike') jump = 7;
    if (pose === 'block') jump = 5;

    /* เงา */
    this.px(ctx, x - 5, y - 1, 10, 2, 'rgba(0,0,0,.22)');

    const oy = -jump + bob;

    if (pose === 'ready') {
      /* ย่อตัวรับบอล แขนเหยียดไปหน้า */
      P(-4, -6 + oy, 3, 5, skin); P(1, -6 + oy, 3, 5, skin);          /* ขา */
      P(-5, -10 + oy, 10, 4, shorts);
      P(-5, -15 + oy, 10, 6, jersey); P(-5, -15 + oy, 10, 1, dark);
      P(4, -13 + oy, 5, 2, skin); P(8, -14 + oy, 2, 3, skin);          /* แขนเหยียด */
      P(-3, -21 + oy, 7, 6, skin);                                     /* หัว */
      P(-4, -23 + oy, 9, 3, hair); P(-4, -21 + oy, 2, 3, hair);
      P(2, -19 + oy, 1, 1, '#26221f');                                 /* ตา */
    } else if (pose === 'set') {
      P(-4, -8 + oy, 3, 7, skin); P(1, -8 + oy, 3, 7, skin);
      P(-4, -12 + oy, 8, 4, shorts);
      P(-4, -18 + oy, 8, 6, jersey); P(-4, -18 + oy, 8, 1, dark);
      P(-6, -22 + oy, 2, 5, skin); P(4, -22 + oy, 2, 5, skin);         /* แขนชูสองข้าง */
      P(-3, -24 + oy, 7, 6, skin);
      P(-4, -26 + oy, 9, 3, hair); P(-4, -24 + oy, 2, 3, hair);
      P(2, -22 + oy, 1, 1, '#26221f');
    } else if (pose === 'block') {
      P(-4, -8 + oy, 3, 7, skin); P(1, -8 + oy, 3, 7, skin);
      P(-4, -12 + oy, 8, 4, shorts);
      P(-4, -18 + oy, 8, 6, jersey); P(-4, -18 + oy, 8, 1, dark);
      P(-6, -25 + oy, 2, 8, skin); P(4, -25 + oy, 2, 8, skin);         /* แขนชูตรงสูง */
      P(-3, -24 + oy, 7, 6, skin);
      P(-4, -26 + oy, 9, 3, hair); P(-4, -24 + oy, 2, 3, hair);
      P(2, -22 + oy, 1, 1, '#26221f');
    } else if (pose === 'spike') {
      P(-4, -7 + oy, 3, 5, skin); P(1, -8 + oy, 3, 6, skin);           /* ขาลอย */
      P(-4, -12 + oy, 8, 4, shorts);
      P(-4, -18 + oy, 8, 6, jersey); P(-4, -18 + oy, 8, 1, dark);
      P(4, -26 + oy, 2, 9, skin);                                      /* แขนตบชูสูง */
      P(-6, -16 + oy, 2, 4, skin);                                     /* แขนถ่วง */
      P(-3, -24 + oy, 7, 6, skin);
      P(-4, -26 + oy, 9, 3, hair); P(-4, -24 + oy, 2, 3, hair);
      P(2, -22 + oy, 1, 1, '#26221f');
    } else if (pose === 'serve') {
      P(-4, -7 + oy, 3, 6, skin); P(1, -7 + oy, 3, 6, skin);
      P(-4, -11 + oy, 8, 4, shorts);
      P(-4, -17 + oy, 8, 6, jersey); P(-4, -17 + oy, 8, 1, dark);
      P(3, -25 + oy, 2, 9, skin);                                      /* แขนง้างเสิร์ฟ */
      P(-3, -23 + oy, 7, 6, skin);
      P(-4, -25 + oy, 9, 3, hair); P(-4, -23 + oy, 2, 3, hair);
      P(2, -21 + oy, 1, 1, '#26221f');
    } else if (pose === 'cheer') {
      const up = (frame >> 3) % 2 ? -1 : 0;
      P(-4, -7, 3, 6, skin); P(1, -7, 3, 6, skin);
      P(-4, -11, 8, 4, shorts);
      P(-4, -17, 8, 6, jersey); P(-4, -17, 8, 1, dark);
      P(-6, -22 + up, 2, 5, skin); P(4, -22 + up, 2, 5, skin);
      P(-3, -23, 7, 6, skin);
      P(-4, -25, 9, 3, hair); P(-4, -23, 2, 3, hair);
      P(2, -21, 1, 1, '#26221f');
    } else if (pose === 'sad') {
      P(-4, -7, 3, 6, skin); P(1, -7, 3, 6, skin);
      P(-4, -11, 8, 4, shorts);
      P(-4, -17, 8, 6, jersey);
      P(-6, -15, 2, 5, skin); P(4, -15, 2, 5, skin);                   /* แขนตก */
      P(-3, -22, 7, 6, skin);
      P(-4, -23, 9, 3, hair); P(-4, -21, 2, 3, hair);
    } else { /* idle */
      P(-4, -7 + oy, 3, 6, skin); P(1, -7 + oy, 3, 6, skin);
      P(-4, -11 + oy, 8, 4, shorts);
      P(-4, -17 + oy, 8, 6, jersey); P(-4, -17 + oy, 8, 1, dark);
      P(-6, -16 + oy, 2, 5, skin); P(4, -16 + oy, 2, 5, skin);
      P(-3, -23 + oy, 7, 6, skin);
      P(-4, -25 + oy, 9, 3, hair); P(-4, -23 + oy, 2, 3, hair);
      P(2, -21 + oy, 1, 1, '#26221f');
    }
  },

  /* ---------- ลูกบอล  (x,y = จุดบนพื้น, h = ความสูงลอย) ---------- */
  drawBall(ctx, x, y, h) {
    const sw = Math.max(2, 6 - h / 18);
    this.px(ctx, x - sw / 2, y - 1, sw, 2, 'rgba(0,0,0,.25)');   /* เงา */
    const by = y - h;
    this.px(ctx, x - 2, by - 4, 4, 4, '#f2ead8');
    this.px(ctx, x - 3, by - 3, 6, 2, '#f2ead8');
    this.px(ctx, x - 1, by - 4, 2, 1, '#e05252');                /* ลายแดง */
    this.px(ctx, x - 3, by - 2, 1, 1, '#3f6cd0');                /* ลายน้ำเงิน */
    this.px(ctx, x + 2, by - 3, 1, 1, '#3f6cd0');
  },

  /* ---------- รูปหน้าผู้เล่นเล็กๆ (avatar 20x22 บน canvas ย่อย) ---------- */
  drawFace(ctx, skin, hair, jersey) {
    const P = this.px.bind(this, ctx);
    P(0, 0, 20, 22, '#f7ecd2');
    P(3, 15, 14, 7, jersey);
    P(3, 15, 14, 2, this.shade(jersey, -40));
    P(5, 4, 10, 10, skin);
    P(4, 2, 12, 4, hair); P(4, 4, 2, 5, hair); P(14, 4, 2, 5, hair);
    P(8, 9, 1, 2, '#26221f'); P(12, 9, 1, 2, '#26221f');
    P(9, 12, 2, 1, '#b56a4a');
  },

  /* ---------- ฉากไตเติล (canvas 192x120) ---------- */
  drawTitle(ctx, frame = 0) {
    const P = this.px.bind(this, ctx);
    P(0, 0, 192, 120, '#2b2320');
    /* แสงสปอตไลต์ */
    P(20, 0, 40, 120, 'rgba(255,240,200,.05)');
    P(130, 0, 40, 120, 'rgba(255,240,200,.05)');
    /* พื้น */
    for (let y = 78; y < 120; y += 6) P(0, y, 192, 6, y % 12 === 6 ? '#c8874e' : '#c07f47');
    P(20, 84, 152, 32, '#4a7ab5');
    P(20, 84, 152, 2, '#f2ead8'); P(20, 114, 152, 2, '#f2ead8');
    /* เน็ต */
    for (let y = 58; y < 112; y += 4) P(94, y, 4, 1, '#f2ead8');
    P(94, 58, 4, 2, '#f2ead8');
    P(92, 56, 2, 60, '#43372c'); P(98, 56, 2, 60, '#43372c');
    /* ผู้เล่นตบ vs บล็อก */
    this.drawPlayer(ctx, 70, 108, 'spike', { jersey: '#e8862e', frame });
    this.drawPlayer(ctx, 122, 108, 'block', { jersey: '#3f6cd0', flip: true, frame });
    this.drawPlayer(ctx, 40, 112, 'cheer', { jersey: '#e8862e', frame, skin: '#e7b98d' });
    this.drawPlayer(ctx, 152, 112, 'ready', { jersey: '#3f6cd0', flip: true, frame, hair: '#733d1f' });
    /* ลูกบอลลอยเหนือเน็ต */
    const bh = 46 + Math.sin(frame / 12) * 3;
    this.drawBall(ctx, 96, 106, bh);
  },
};
