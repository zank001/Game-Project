/* =============================================================
   match.js — จำลองการแข่งขันทีละแรลลี่ + วาดแอนิเมชันบน canvas
   ใช้: Match.play({ home, away, pointsTo, label, onEnd })
   ============================================================= */
'use strict';

const Match = {
  cv: null, ctx: null,
  frame: 0, speed: 1, skip: false, playing: false,
  scene: null, crowdSeed: 1,

  /* ตำแหน่งยืนบนคอร์ท (ฝั่งซ้าย) — [x, y] แถวหน้าใกล้เน็ต 3 คน แถวหลัง 3 คน */
  slotsL: [[160, 122], [150, 152], [160, 186], [80, 118], [64, 152], [80, 188]],

  els() {
    return {
      overlay: document.getElementById('matchOverlay'),
      homeName: document.getElementById('mhHomeName'),
      awayName: document.getElementById('mhAwayName'),
      homeScore: document.getElementById('mhHomeScore'),
      awayScore: document.getElementById('mhAwayScore'),
      label: document.getElementById('mhLabel'),
      comment: document.getElementById('matchComment'),
      btnSpeed: document.getElementById('btnSpeed'),
      btnSkip: document.getElementById('btnSkip'),
    };
  },

  /* ---------- คำนวณค่าพลังจริงตามความสดชื่น/กำลังใจ/ความเข้าขา ---------- */
  effTeam(team) {
    const moraleF = 0.92 + 0.16 * ((team.morale ?? 70) / 100);
    const chemF = 0.92 + 0.16 * ((team.chem ?? 50) / 100);
    /* ฟอร์มประจำแมตช์: วันดีวันร้าย เปิดโอกาสให้ทีมรองล้มยักษ์ */
    const formF = 0.86 + Math.random() * 0.28;
    return {
      ...team,
      eff: team.players.map(p => {
        const condF = 0.8 + 0.2 * ((p.cond ?? 90) / 100);
        const f = condF * moraleF * chemF * formF;
        return {
          name: p.name, pos: p.pos, skin: p.skin, hair: p.hair,
          srv: p.stats.srv * f, atk: p.stats.atk * f, blk: p.stats.blk * f,
          rcv: p.stats.rcv * f, set: p.stats.set * f, sta: p.stats.sta * f,
        };
      }),
      serveIdx: 0,
    };
  },

  pickWeighted(players, key, exceptIdx = -1) {
    let total = 0;
    const ws = players.map((p, i) => {
      const w = i === exceptIdx ? 0 : Math.max(1, p[key]);
      total += w;
      return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; }
    return 0;
  },
  bestIdx(players, key) {
    let bi = 0;
    players.forEach((p, i) => { if (p[key] > players[bi][key]) bi = i; });
    return bi;
  },

  /* ---------- จำลอง 1 แรลลี่ → รายการเหตุการณ์สำหรับแอนิเมชัน ---------- */
  simRally(A, B, servingSide) {
    const S = servingSide === 'A' ? A : B;
    const O = servingSide === 'A' ? B : A;
    const sSide = servingSide, oSide = servingSide === 'A' ? 'B' : 'A';
    const ev = [];
    const srvIdx = S.serveIdx % 6;
    S.serveIdx++;
    const server = S.eff[srvIdx];

    ev.push({ t: 'serve', side: sSide, i: srvIdx, name: server.name });
    const sq = server.srv * (0.65 + Math.random() * 0.75);
    const errRate = Math.max(0.02, 0.11 - server.srv * 0.0008);
    if (Math.random() < errRate) {
      ev.push({ t: 'serveError', side: sSide, i: srvIdx });
      return { winner: oSide, reason: 'serveError', scorer: null, ev };
    }
    const rcvIdx = this.pickWeighted(O.eff, 'rcv');
    const rq = O.eff[rcvIdx].rcv * (0.7 + Math.random() * 0.6);
    ev.push({ t: 'serveFly', from: { side: sSide, i: srvIdx }, to: { side: oSide, i: rcvIdx } });
    if (sq > rq * 1.45) {
      ev.push({ t: 'ace', side: sSide });
      return { winner: sSide, reason: 'ace', scorer: server.name, ev };
    }

    /* แรลลี่โต้กันไปมา */
    let atkTeam = O, atkSide = oSide, defTeam = S, defSide = sSide;
    let lastRcv = rcvIdx;
    for (let touch = 0; touch < 8; touch++) {
      const setIdx = this.bestIdx(atkTeam.eff, 'set');
      const atkIdx = this.pickWeighted(atkTeam.eff, 'atk', setIdx);
      const atk = atkTeam.eff[atkIdx], setter = atkTeam.eff[setIdx];
      ev.push({ t: 'receive', side: atkSide, i: lastRcv, name: atkTeam.eff[lastRcv].name });
      ev.push({ t: 'set', side: atkSide, i: setIdx, name: setter.name });
      ev.push({ t: 'spike', side: atkSide, i: atkIdx, name: atk.name });

      const fatigue = Math.max(0.75, 1 - touch * 0.035);
      const aq = (0.6 * atk.atk + 0.25 * setter.set + 0.15 * atk.sta) * (0.7 + Math.random() * 0.65) * fatigue;
      const blkIdx = this.bestIdx(defTeam.eff, 'blk');
      const digIdx = this.pickWeighted(defTeam.eff, 'rcv');
      const dq = (0.45 * defTeam.eff[blkIdx].blk + 0.55 * defTeam.eff[digIdx].rcv) * (0.7 + Math.random() * 0.6);
      const atkErr = Math.max(0.02, 0.085 - atk.atk * 0.0005);

      if (Math.random() < atkErr) {
        ev.push({ t: 'atkError', side: atkSide, i: atkIdx });
        return { winner: defSide, reason: 'atkError', scorer: null, ev };
      }
      const killTh = 1.12 - touch * 0.05;   /* ยิ่งแรลลี่ยาว ยิ่งปิดแต้มง่ายขึ้น */
      if (aq > dq * killTh) {
        ev.push({ t: 'kill', side: atkSide, i: atkIdx, blockerI: blkIdx });
        return { winner: atkSide, reason: 'kill', scorer: atk.name, ev };
      }
      if (dq > aq * 1.5 && Math.random() < 0.45) {
        ev.push({ t: 'blocked', side: defSide, i: blkIdx, atkI: atkIdx, name: defTeam.eff[blkIdx].name });
        return { winner: defSide, reason: 'block', scorer: defTeam.eff[blkIdx].name, ev };
      }
      /* ป้องกันไว้ได้ สลับฝั่งบุก */
      ev.push({ t: 'dig', side: defSide, i: digIdx, atkI: atkIdx, atkSide, name: defTeam.eff[digIdx].name });
      lastRcv = digIdx;
      [atkTeam, defTeam] = [defTeam, atkTeam];
      [atkSide, defSide] = [defSide, atkSide];
    }
    /* แรลลี่ยาวสุดๆ: สุ่มผู้ชนะตามพลังรุกรวม */
    const aPow = A.eff.reduce((x, p) => x + p.atk, 0);
    const bPow = B.eff.reduce((x, p) => x + p.atk, 0);
    const winner = Math.random() < aPow / (aPow + bPow) ? 'A' : 'B';
    ev.push({ t: 'longRally', side: winner });
    return { winner, reason: 'rally', scorer: null, ev };
  },

  /* ---------- ตัวช่วยแอนิเมชัน ---------- */
  slotPos(side, i) {
    const [x, y] = this.slotsL[i];
    return side === 'A' ? { x, y } : { x: 384 - x, y };
  },

  async wait(ms) {
    if (this.skip) return;
    await new Promise(r => setTimeout(r, ms / this.speed));
  },

  /* บอลลอยจาก a ไป b พร้อมวาดฉากทุกเฟรม
     h0/h1 = ความสูงต้น/ปลายทาง (ลูกที่จบแต้มให้ h1 = 0 จะได้ตกถึงพื้นจริง) */
  async flight(a, b, peak, dur, h0 = 12, h1 = 12) {
    const sc = this.scene;
    if (this.skip) { sc.ball = { x: b.x, y: b.y, h: h1, show: true }; return; }
    const t0 = performance.now();
    const total = dur / this.speed;
    return new Promise(res => {
      const step = (now) => {
        if (this.skip) { sc.ball = { x: b.x, y: b.y, h: h1, show: true }; res(); return; }
        const t = Math.min(1, (now - t0) / total);
        sc.ball = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          h: h0 + (h1 - h0) * t + Math.sin(t * Math.PI) * peak,
          show: true,
        };
        this.render();
        if (t >= 1) res(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  },

  say(kind, name) {
    const lines = DATA.commentary[kind];
    if (!lines) return;
    const txt = R.pick(lines).replace('{p}', name || '');
    const el = this.els().comment;
    if (el) el.textContent = '🏐 ' + txt;
  },

  setPose(side, i, pose) { this.scene.poses[side][i] = pose; },
  resetPoses() {
    for (const s of ['A', 'B']) for (let i = 0; i < 6; i++) this.scene.poses[s][i] = i < 3 ? 'idle' : 'ready';
  },

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.frame++;
    Sprites.drawCourt(ctx, this.frame, this.crowdSeed);
    const sc = this.scene;
    /* วาดผู้เล่นเรียงจากแถวบนก่อนเพื่อการซ้อนที่ถูกต้อง */
    const order = [];
    for (const side of ['A', 'B']) {
      for (let i = 0; i < 6; i++) {
        const pos = this.slotPos(side, i);
        order.push({ side, i, pos });
      }
    }
    order.sort((a, b) => a.pos.y - b.pos.y);
    for (const o of order) {
      const team = o.side === 'A' ? sc.home : sc.away;
      const p = team.eff[o.i];
      Sprites.drawPlayer(ctx, o.pos.x, o.pos.y, sc.poses[o.side][o.i], {
        skin: p.skin, hair: p.hair, jersey: team.jersey,
        flip: o.side === 'B', frame: this.frame + o.i * 7,
      });
    }
    if (sc.ball && sc.ball.show) Sprites.drawBall(ctx, sc.ball.x, sc.ball.y, sc.ball.h);
    if (sc.flash) {
      ctx.fillStyle = 'rgba(43,35,32,.75)';
      ctx.fillRect(112, 96, 160, 26);
      ctx.fillStyle = '#f7ecd2';
      ctx.font = 'bold 13px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sc.flash, 192, 113);
      ctx.textAlign = 'left';
    }
  },

  updateScore() {
    const e = this.els();
    e.homeScore.textContent = this.scoreA;
    e.awayScore.textContent = this.scoreB;
  },

  /* ---------- เล่นแอนิเมชันตามเหตุการณ์ของแรลลี่ ---------- */
  async playRallyEvents(rally) {
    const sc = this.scene;
    this.resetPoses();
    sc.ball = null;
    for (const e of rally.ev) {
      if (this.skip) break;
      switch (e.t) {
        case 'serve': {
          const p = this.slotPos(e.side, e.i);
          this.setPose(e.side, e.i, 'serve');
          this.say('serve', e.name);
          sc.ball = { x: p.x, y: p.y, h: 20, show: true };
          this.render();
          await this.wait(550);
          Sound.hit();
          break;
        }
        case 'serveFly': {
          const a = this.slotPos(e.from.side, e.from.i);
          const b = this.slotPos(e.to.side, e.to.i);
          this.setPose(e.to.side, e.to.i, 'ready');
          await this.flight(a, b, 60, 700);
          break;
        }
        case 'serveError': {
          const a = this.slotPos(e.side, e.i ?? 0);
          Sound.hit();
          await this.flight({ x: a.x, y: a.y }, { x: 192, y: 150 }, 30, 500, 20, 0);
          this.say('serveError');
          Sound.bounce();
          await this.wait(650);
          break;
        }
        case 'ace': {
          this.say('ace');
          Sound.bounce();
          await this.wait(650);
          break;
        }
        case 'receive': {
          this.setPose(e.side, e.i, 'ready');
          this.say('receive', e.name);
          Sound.hit();
          await this.wait(220);
          break;
        }
        case 'set': {
          const from = this.slotPos(e.side, this._lastTouch ?? 0);
          const to = this.slotPos(e.side, e.i);
          this.setPose(e.side, e.i, 'set');
          await this.flight(from, to, 34, 420);
          this.say('set', e.name);
          Sound.hit();
          break;
        }
        case 'spike': {
          const setIdx = this.scene.poses[e.side].indexOf('set');
          const from = this.slotPos(e.side, setIdx >= 0 ? setIdx : e.i);
          const to = this.slotPos(e.side, e.i);
          await this.flight(from, to, 40, 380);
          this.setPose(e.side, e.i, 'spike');
          this.say('spike', e.name);
          Sound.hit();
          this._lastSpike = { side: e.side, i: e.i };
          await this.wait(140);
          break;
        }
        case 'kill': {
          const from = this.slotPos(e.side, e.i);
          const oside = e.side === 'A' ? 'B' : 'A';
          const target = { x: oside === 'A' ? 60 + Math.random() * 90 : 234 + Math.random() * 90, y: 120 + Math.random() * 70 };
          this.setPose(oside, e.blockerI, 'block');
          await this.flight(from, target, 26, 300, 22, 0);
          Sound.bounce();
          this.say('kill');
          await this.wait(650);
          break;
        }
        case 'blocked': {
          const atkSide = e.side === 'A' ? 'B' : 'A';
          const from = this.slotPos(atkSide, e.atkI);
          this.setPose(e.side, e.i, 'block');
          await this.flight(from, { x: from.x, y: from.y + 8 }, 30, 300, 22, 0);
          Sound.hit();
          this.say('blocked');
          Sound.bounce();
          await this.wait(650);
          break;
        }
        case 'atkError': {
          const from = this.slotPos(e.side, e.i);
          const oside = e.side === 'A' ? 'B' : 'A';
          const out = { x: oside === 'A' ? 20 : 364, y: 205 };
          await this.flight(from, out, 45, 450, 22, 0);
          this.say('atkError');
          Sound.bounce();
          await this.wait(650);
          break;
        }
        case 'dig': {
          const from = this.slotPos(e.atkSide, e.atkI);
          const to = this.slotPos(e.side, e.i);
          this.setPose(e.side, e.i, 'ready');
          this.setPose(e.atkSide, e.atkI, 'idle');   /* ตัวตบลงพื้นแล้ว ไม่ค้างท่ากลางอากาศ */
          await this.flight(from, to, 34, 420);
          this.say('dig');
          Sound.hit();
          this._lastTouch = e.i;
          await this.wait(160);
          break;
        }
        case 'longRally': {
          await this.wait(300);
          break;
        }
      }
      if (e.t === 'receive') this._lastTouch = e.i;
    }
  },

  /* ---------- เล่นทั้งแมตช์ ---------- */
  async play({ home, away, pointsTo = 15, label = 'แมตช์', onEnd }) {
    if (this.playing) return;
    this.playing = true;
    this.skip = false;
    this.speed = 1;
    this.crowdSeed = R.int(2, 99999);

    this.cv = document.getElementById('matchCanvas');
    this.ctx = this.cv.getContext('2d');
    const e = this.els();
    const gameRoot = document.getElementById('gameRoot');
    try { if (gameRoot) gameRoot.inert = true; } catch (err) { /* เบราว์เซอร์เก่า: ข้าม */ }
    e.overlay.hidden = false;
    try {
    e.homeName.textContent = home.name;
    e.awayName.textContent = away.name;
    e.label.textContent = label;
    e.btnSpeed.textContent = '⏩ x1';
    e.btnSkip.textContent = '⏭ ข้ามไปดูผล';
    e.btnSkip.disabled = false;

    e.btnSpeed.onclick = () => {
      this.speed = this.speed >= 4 ? 1 : this.speed * 2;
      e.btnSpeed.textContent = '⏩ x' + this.speed;
      Sound.click();
    };
    e.btnSkip.onclick = () => { this.skip = true; e.btnSkip.disabled = true; Sound.click(); };

    const A = this.effTeam(home);
    const B = this.effTeam(away);
    this.scene = {
      home: A, away: B,
      poses: { A: Array(6).fill('idle'), B: Array(6).fill('idle') },
      ball: null, flash: null,
    };
    this.scoreA = 0; this.scoreB = 0;
    this.updateScore();
    this.render();

    Sound.whistle();
    this.say('serve', A.eff[0].name);
    await this.wait(600);

    /* นับแต้มฝั่งเราจากคนทำแต้ม เพื่อหา MVP */
    const ourScorers = {};
    let serving = 'A';
    let guard = 0;
    while (guard++ < 200) {
      const rally = this.simRally(A, B, serving);
      await this.playRallyEvents(rally);
      if (rally.winner === 'A') this.scoreA++; else this.scoreB++;
      if (rally.winner === 'A' && rally.scorer) ourScorers[rally.scorer] = (ourScorers[rally.scorer] || 0) + 1;
      serving = rally.winner;
      this.updateScore();
      if (!this.skip) { if (rally.winner === 'A') Sound.point(); else Sound.losePoint(); }

      const a = this.scoreA, b = this.scoreB;
      const over = (Math.max(a, b) >= pointsTo && Math.abs(a - b) >= 2) || Math.max(a, b) >= pointsTo + 4;
      if (over) break;
      if (!this.skip) {
        this.resetPoses();          /* จบแต้มแล้ว ทุกคนกลับท่ายืนปกติ */
        this.scene.ball = null;
        this.scene.flash = `${a} - ${b}`;
        this.render();
        await this.wait(450);
        this.scene.flash = null;
      }
    }

    const win = this.scoreA > this.scoreB;
    let mvpName = null, mvpPts = 0;
    for (const [n, c] of Object.entries(ourScorers)) if (c > mvpPts) { mvpName = n; mvpPts = c; }

    /* ฉากจบ: ทีมชนะเฮ ทีมแพ้คอตก */
    this.skip = false;
    for (let i = 0; i < 6; i++) {
      this.setPose('A', i, win ? 'cheer' : 'sad');
      this.setPose('B', i, win ? 'sad' : 'cheer');
    }
    this.scene.ball = null;
    this.scene.flash = win ? '🎉 ชนะ!' : '😢 แพ้...';
    this.say('setWin');
    Sound.whistle();
    if (win) Sound.win(); else Sound.lose();

    /* แอนิเมชันฉลองสั้นๆ */
    const endT = performance.now();
    await new Promise(res => {
      const loop = (now) => {
        this.render();
        if (now - endT > 1600) res(); else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    const result = { win, homeScore: this.scoreA, awayScore: this.scoreB, mvpName, mvpPts };
    if (onEnd) onEnd(result);
    return result;
    } finally {
      e.overlay.hidden = true;
      this.playing = false;
      try { if (gameRoot) gameRoot.inert = false; } catch (err) { /* ข้าม */ }
    }
  },
};
