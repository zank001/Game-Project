/* game.js — the Game object: player, movement & collision, interactions,
   building actions (shops, jobs, sleep, travel…), save/load and the loop glue. */
'use strict';
(function () {
  const U = S77.U, T = S77.T, O = S77.O, E = S77.Events;
  const SAVE_PREFIX = 's77_save_';
  const VERSION = 1;

  class Game {
    constructor(world, renderer) {
      this.world = world; this.renderer = renderer;
      this.time = new S77.GameTime();
      this.camera = { x: 0, y: 0 };
      this.target = null; this.talkingTo = null; this.paused = true;
      this.floaters = [];
      this.settings = Object.assign({ timeRate: 1, labels: true, sound: true, viewW: 600 }, JSON.parse(S77.Store.get('s77_settings') || '{}'));
      this.time.rate = this.settings.timeRate;
      renderer.setTargetWidth(this.settings.viewW);
      for (const s of S77.SYSTEMS) if (s.init) s.init(this);
    }

    /* ---------------- lifecycle ---------------- */
    newGame(opt) {
      const t = this.world.towns[opt.home];
      this.player = {
        isPlayer: true, kind: 'player', name: opt.name || 'ผู้เล่น', look: opt.look, x: 0, y: 0, moving: false, anim: 0, faceLeft: false, faceBack: false,
        money: 3000, bank: 0, stats: { hunger: 80, energy: 90, mood: 60, health: 100 },
        skills: { labor: 0, trade: 0, charisma: 0, knowledge: 10 }, rep: new Array(77).fill(0), inv: { water: 2, bread: 1 }, itemDefs: {},
        vehicles: {}, riding: null, umbrella: false, homes: [], regProv: opt.home, hometown: opt.home,
        visited: [], landmarks: [], dishes: [], counters: { jobs: 0, earned: 0, km: 0, talks: 0, days: 0 }, daily: {},
      };
      this.quests = []; this.questSeq = 1; this.npcMem = {};
      for (const s of S77.SYSTEMS) if (s.init) s.init(this);
      const [dx, dy] = this.world.nearestWalkable(t.cx + 1, t.cy + 1, 10);
      this.teleport(dx + 0.5, dy + 0.5);
      this.time.total = 7 * 60;
      this.lastHour = Math.floor(this.time.total / 60); this.lastDay = this.time.day;
      this.paused = false;
      this.checkLocation(true);
      E.emit('newGame', this);
    }
    serialize() {
      const sys = {};
      for (const s of S77.SYSTEMS) if (s.save) sys[s.id] = s.save(this);
      const pl = Object.assign({}, this.player);
      return { v: VERSION, savedAt: Date.now(), time: this.time.total, player: pl, sys, owned: this.player.homes };
    }
    save(slot, silent) {
      const data = this.serialize();
      const ok = S77.Store.set(SAVE_PREFIX + slot, JSON.stringify(data));
      if (!silent) S77.UI.toast(ok ? '💾 บันทึกเกมแล้ว' : '💾 บันทึกไว้ชั่วคราว (เบราว์เซอร์ไม่อนุญาตที่เก็บถาวร)', 'info');
      return ok;
    }
    static readSave(slot) { try { const s = S77.Store.get(SAVE_PREFIX + slot); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
    load(data) {
      for (const s of S77.SYSTEMS) if (s.init) s.init(this);
      this.time.total = data.time;
      this.player = Object.assign({ isPlayer: true, kind: 'player', moving: false, anim: 0 }, data.player);
      this.player.riding = null;
      for (const s of S77.SYSTEMS) if (s.load && data.sys && data.sys[s.id] !== undefined) s.load(data.sys[s.id], this);
      for (const bid of this.player.homes || []) this.markHome(bid);
      this.teleport(this.player.x, this.player.y);
      this.lastHour = Math.floor(this.time.total / 60); this.lastDay = this.time.day;
      this.paused = false;
      this.checkLocation(true);
    }
    teleport(x, y) {
      const p = this.player; p.x = x; p.y = y;
      this.camera.x = x; this.camera.y = y;
      this.lastLocCheck = 0;
    }

    /* ---------------- helpers ---------------- */
    itemDef(id) { return S77.ITEMS[id] || this.player.itemDefs[id]; }
    addItem(id, n, def) {
      if (def) this.player.itemDefs[id] = def;
      this.player.inv[id] = (this.player.inv[id] || 0) + (n || 1);
      if (id === 'umbrella') this.player.umbrella = true;
    }
    removeItem(id, n) { const inv = this.player.inv; inv[id] = (inv[id] || 0) - (n || 1); if (inv[id] <= 0) delete inv[id]; }
    invCount() { return Object.entries(this.player.inv).reduce((a, [k, v]) => a + (S77.ITEMS[k] && S77.ITEMS[k].kind === 'vehicle' ? 0 : v), 0); }
    invCap() { return 30 + (this.player.vehicles.motorbike ? 30 : this.player.vehicles.bicycle ? 10 : 0); }
    earn(n, why) { if (n <= 0) return; this.player.money += n; this.player.counters.earned += n; this.float('+' + U.fmtMoney(n), '#ffe066'); E.emit('money', { delta: n, why }); }
    spend(n, why) {
      if (this.player.money < n) { S77.UI.toast('เงินไม่พอ (ต้องการ ' + U.fmtMoney(n) + ')', 'bad'); S77.Sound.play('error'); return false; }
      this.player.money -= n; E.emit('money', { delta: -n, why }); S77.Sound.play('coin'); return true;
    }
    addRep(pi, n) { const r = this.player.rep; r[pi] = U.clamp((r[pi] || 0) + n, -100, 100); if (n > 0) this.float('ชื่อเสียง +' + n, '#9fe0ff'); E.emit('repChange', { prov: pi, delta: n }); }
    addSkill(k, n) { const s = this.player.skills; s[k] = U.clamp((s[k] || 0) + n, 0, 100); }
    stat(k, n) { const s = this.player.stats; s[k] = U.clamp(s[k] + n, 0, 100); }
    float(text, color) { this.floaters.push({ text, color, t: 0, x: this.player.x, y: this.player.y }); }
    get currentProvIdx() { const p = this.currentProv; return p ? p.idx : this.player.regProv; }
    // once-per-day gates for repeatable bonuses
    daily(key) { const d = this.player.daily; if (d[key] === this.time.day) return false; d[key] = this.time.day; return true; }

    // advance game time instantly (sleep, work, travel)
    advanceTime(mins, opts) {
      opts = opts || {};
      const s = this.player.stats;
      this.time.total += mins;
      if (!opts.sleep) {
        s.hunger = U.clamp(s.hunger - mins * 0.1 * (opts.hungerK || 1), 0, 100);
        s.energy = U.clamp(s.energy - mins * 0.06 * (opts.energyK || 1), 0, 100);
      } else s.hunger = U.clamp(s.hunger - mins * 0.04, 0, 100);
      this.tickClock(true);
    }
    tickClock(silent) {
      const h = Math.floor(this.time.total / 60), d = this.time.day;
      let hops = 0;
      while (this.lastHour < h && hops++ < 200) { this.lastHour++; for (const s of S77.SYSTEMS) if (s.onHour) s.onHour(this.lastHour % 24, this); E.emit('hour', this.lastHour % 24); }
      this.lastHour = h;
      if (d !== this.lastDay) {
        const n = d - this.lastDay; this.lastDay = d;
        for (let k = 0; k < Math.min(n, 30); k++) { for (const s of S77.SYSTEMS) if (s.onDay) s.onDay(d, this); }
        this.player.counters.days += n;
        this.renderer.setSeason(S77.seasonOf(this.time.month()));
        E.emit('day', d);
        const f = this.time.festival();
        if (f && !silent) S77.UI.banner('🎉 ' + f, this.time.dateStr(true));
      }
    }
    faint(why) {
      this.fainting = true;
      const pi = this.currentProvIdx, t = this.world.towns[pi];
      const hosp = t.hospital !== undefined ? this.world.buildings[t.hospital] : null;
      const fee = why === 'health' ? 1500 : 300;
      S77.UI.fade(why === 'health' ? '😵 คุณหมดสติ... ถูกนำส่งโรงพยาบาล' : '😴 คุณเหนื่อยจนหลับไปกลางทาง...', () => {
        this.advanceTime(why === 'health' ? 12 * 60 : 8 * 60, { sleep: true });
        const s = this.player.stats; s.energy = 70; s.health = Math.max(s.health, 60); s.hunger = Math.max(s.hunger, 30); s.mood = Math.max(10, s.mood - 15);
        const paid = Math.min(fee, this.player.money); this.player.money -= paid;
        if (hosp && hosp.door) this.teleport(hosp.door.x + 0.5, hosp.door.y + 0.5);
        S77.UI.toast('ค่ารักษาพยาบาล ' + U.fmtMoney(paid) + ' — อย่าลืมกินและพักผ่อนนะ', 'bad');
        this.fainting = false;
      });
    }

    /* ---------------- per-frame update ---------------- */
    update(dt) {
      if (!this.player) return;
      this.time.realSec += dt;
      const before = this.time.total;
      if (!this.paused && !S77.UI.modalOpen()) this.time.total += dt * this.time.rate;
      this.minutesThisFrame = this.time.total - before;
      this.timeScale = this.time.rate;
      if (!this.paused && !S77.UI.modalOpen()) this.movePlayer(dt);
      else this.player.moving = false;
      for (const s of S77.SYSTEMS) if (s.update) s.update(dt, this);
      this.tickClock();
      // camera follow
      const c = this.camera, p = this.player, k = Math.min(1, dt * 7);
      c.x += (p.x - c.x) * k; c.y += (p.y - c.y) * k;
      if ((this.lastLocCheck -= dt) <= 0) { this.lastLocCheck = 0.3; this.checkLocation(false); }
      this.findTarget();
      for (const f of this.floaters) f.t += dt;
      this.floaters = this.floaters.filter((f) => f.t < 1.6);
      if (this.delivery) this.checkDelivery();
    }
    movePlayer(dt) {
      const p = this.player, inp = S77.Input.vector();
      let sx = inp.x, sy = inp.y * 0.5;
      let wx = sx + 2 * sy, wy = 2 * sy - sx;
      const len = Math.hypot(wx, wy);
      p.moving = len > 0.01;
      if (!p.moving) { p.anim = 0; return; }
      wx /= len; wy /= len;
      const mag = Math.min(1, Math.hypot(inp.x, inp.y));
      const w = this.world, t = w.terrain(Math.floor(p.x), Math.floor(p.y));
      let sp = 3.3 * mag;
      p.running = S77.Input.running() && !p.riding;
      if (p.running) sp *= 1.6;
      if (p.riding) sp *= S77.ITEMS[p.riding].speed;
      if (t === T.ROAD || t === T.STREET || t === T.BRIDGE) sp *= 1.12;
      else if (t === T.FOREST || t === T.JUNGLE || t === T.HILL) sp *= p.riding ? 0.55 : 0.8;
      else if (t === T.MANGROVE) sp *= 0.6;
      else if (t === T.SAND || t === T.PADDY) sp *= p.riding ? 0.6 : 0.9;
      const dx = wx * sp * dt, dy = wy * sp * dt;
      const ox = p.x, oy = p.y;
      if (!this.collides(p.x + dx, p.y)) p.x += dx;
      if (!this.collides(p.x, p.y + dy)) p.y += dy;
      const moved = Math.hypot(p.x - ox, p.y - oy);
      p.counters.km += moved * 0.92;
      p.anim += dt * (p.running ? 1.4 : 1);
      // facing in screen space
      const sdx = wx - wy, sdy = wx + wy;
      if (Math.abs(sdx) > 0.15) p.faceLeft = sdx < 0;
      p.faceBack = sdy < -0.05;
      S77.Sound.step(p.running);
    }
    collides(x, y) {
      const w = this.world, r = 0.26;
      for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (!w.inb(tx, ty)) return true;
        const i = ty * w.W + tx;
        const blocked = w.bld[i] || (S77.isWater(w.ter[i])) || w.ter[i] === T.MOUNTAIN || w.ter[i] === T.FOREIGN || S77.OBJ_BLOCK[w.obj[i]] === 2;
        if (blocked) {
          const cx = U.clamp(x, tx, tx + 1), cy = U.clamp(y, ty, ty + 1);
          if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
        } else if (S77.OBJ_BLOCK[w.obj[i]] === 1) {
          if ((x - tx - 0.5) ** 2 + (y - ty - 0.5) ** 2 < (r + 0.14) ** 2) return true;
        }
      }
      return false;
    }
    checkLocation(first) {
      const w = this.world, p = this.player, x = Math.floor(p.x), y = Math.floor(p.y);
      const prov = w.province(x, y);
      if (prov && prov !== this.currentProv) {
        this.currentProv = prov;
        const firstVisit = p.visited.indexOf(prov.idx) < 0;
        if (firstVisit) { p.visited.push(prov.idx); this.addRep(prov.idx, 1); }
        S77.UI.banner(prov.th, (firstVisit ? '📮 ประทับตราพาสปอร์ตใหม่! · ' : '') + S77.REGIONS[prov.region].th + ' · ' + prov.tagline);
        if (firstVisit && !first) S77.Sound.play('stamp');
        E.emit('enterProvince', { prov, firstVisit });
        if (!first) this.save('auto', true);
      }
      const zn = w.zoneName(x, y);
      if (zn !== this.zoneName) { this.zoneName = zn; E.emit('enterZone', zn); }
      this.areaName = zn || (prov ? S77.T_NAMES[w.terrain(x, y)] : '');
      this.indoors = false;
    }

    /* ---------------- interaction ---------------- */
    findTarget() {
      const p = this.player, w = this.world;
      let best = null, bd = 1.6;
      // NPCs & animals
      for (const n of this.npcs || []) {
        if (n.hidden) continue;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bd) { bd = d; best = { type: 'npc', npc: n, label: 'คุยกับ ' + n.name, hl: null }; }
      }
      if (!best) for (const a of this.animals || []) {
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d < 1.2 && a.species === 'dog') { best = { type: 'dog', animal: a, label: 'ลูบหัวน้องหมา 🐶' }; break; }
      }
      // building doors
      if (!best) {
        const px = Math.floor(p.x), py = Math.floor(p.y);
        let bb = null, bdd = 1.45;
        for (let ty = py - 2; ty <= py + 2; ty++) for (let tx = px - 2; tx <= px + 2; tx++) {
          if (!w.inb(tx, ty) || !(w.flag[ty * w.W + tx] & S77.F_DOOR)) continue;
          const d = Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y);
          if (d < bdd) {
            // which building owns this door?
            for (const [nx, ny] of [[tx, ty - 1], [tx - 1, ty], [tx, ty + 1], [tx + 1, ty]]) {
              const b = w.buildingAt(nx, ny);
              if (b && b.door && b.door.x === tx && b.door.y === ty && S77.BUILDINGS[b.type].acts.length) { bb = b; bdd = d; }
            }
          }
        }
        if (bb) best = { type: 'building', b: bb, label: (bb.type === 'landmark' ? '📍 ' : '🚪 ') + bb.name, hl: [bb.door.x, bb.door.y] };
      }
      // piers
      if (!best) for (const q of w.pois) if (Math.abs(q.x - p.x) < 3 && Math.abs(q.y - p.y) < 3) {
        const d = Math.hypot(q.x + 0.5 - p.x, q.y + 0.5 - p.y);
        if (d < 1.5) { best = { type: 'pier', poi: q, label: '⛴️ ท่าเรือ', hl: [q.x, q.y] }; break; }
      }
      // objects / terrain activities
      if (!best) {
        const px = Math.floor(p.x), py = Math.floor(p.y);
        const near = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]];
        for (const [ox, oy] of near) {
          const tx = px + ox, ty = py + oy;
          if (!w.inb(tx, ty)) continue;
          const o = w.obj[ty * w.W + tx];
          if (o === O.SPIRIT) { best = { type: 'spirit', label: '🙏 ไหว้ศาลพระภูมิ', hl: [tx, ty] }; break; }
        }
        if (!best) {
          const t = w.terrain(px, py), prov = this.currentProv;
          const seaNear = near.some(([ox, oy]) => { const tt = w.terrain(px + ox, py + oy); return tt === T.SEA || tt === T.DEEP; });
          if (t === T.PADDY) best = { type: 'job', job: 'farm', label: '🌾 ทำนา (' + S77.JOBS.farm.hours + ' ชม.)', hl: [px, py] };
          else if ((t === T.SAND || t === T.MANGROVE) && seaNear) best = { type: 'job', job: 'fishing', label: '🎣 ออกหาปลา (' + S77.JOBS.fishing.hours + ' ชม.)', hl: [px, py] };
          else if (t === T.PLANT && prov && prov.region === 'south') best = { type: 'job', job: 'rubber', label: '🌳 กรีดยาง (' + S77.JOBS.rubber.hours + ' ชม.)', hl: [px, py] };
          else if (t === T.ORCHARD) best = { type: 'job', job: 'orchard', label: '🍈 เก็บผลไม้ (' + S77.JOBS.orchard.hours + ' ชม.)', hl: [px, py] };
        }
      }
      this.target = best;
    }
    interact() {
      const t = this.target;
      if (!t || this.paused || S77.UI.modalOpen()) return;
      S77.Sound.play('click');
      if (t.type === 'npc') return S77.UI.talk(this, t.npc);
      if (t.type === 'building') return this.openBuilding(t.b);
      if (t.type === 'pier') return this.openPier(t.poi);
      if (t.type === 'dog') { if (this.daily('dog' + t.animal.id)) { this.stat('mood', 4); S77.UI.toast('🐶 น้องหมากระดิกหางดีใจ อารมณ์ดีขึ้น', 'good'); } else S77.UI.toast('🐶 น้องหมานอนหลับสบาย'); return; }
      if (t.type === 'spirit') { if (this.daily('spirit')) { this.stat('mood', 3); S77.UI.toast('🙏 ไหว้ศาลพระภูมิ ขอให้โชคดี (อารมณ์ +3)', 'good'); } else S77.UI.toast('🙏 วันนี้ไหว้ไปแล้ว'); return; }
      if (t.type === 'job') return this.confirmJob(t.job, this.currentProvIdx);
    }

    /* ---------------- buildings ---------------- */
    openBuilding(b) {
      const def = S77.BUILDINGS[b.type], pi = b.prov !== undefined ? b.prov : this.currentProvIdx;
      const opts = [];
      for (const a of def.acts) { const A = ACTS[a]; if (!A) continue; const o = A.opt(this, b, pi); if (o) opts.push(Object.assign({ act: a }, o)); }
      // quest deliveries
      for (const q of this.quests) if (!q.done && q.type === 'deliver' && q.target === pi && b.type === 'market') opts.unshift({ label: '📦 ส่งของฝาก (ภารกิจของ ' + q.giverName + ')', run: () => { this.removeItem('parcel_' + q.id, 1); S77.SYSTEMS.find((s) => s.id === 'quests').complete(this, q); } });
      const title = b.name + (b.town !== undefined && b.type !== 'landmark' ? ' · ' + S77.PROVINCES[b.town].th : '');
      S77.UI.menu(title, opts, { icon: buildingIcon(b) });
    }
    openPier(q) {
      const opts = q.routes.map((r) => ({
        label: '⛴️ ' + r.name, sub: U.fmtMoney(r.price) + ' · ' + r.mins + ' นาที',
        run: () => { if (!this.spend(r.price, 'ferry')) return; S77.UI.fade('⛴️ กำลังล่องเรือ...', () => { this.advanceTime(r.mins, { energyK: 0.5 }); const [x, y] = this.world.nearestWalkable(r.to.x, r.to.y, 6); this.teleport(x + 0.5, y + 0.5); E.emit('travel', { mode: 'ferry' }); }); },
      }));
      const prov = S77.PROVINCES[q.prov] || this.currentProv;
      if (prov && prov.econ.indexOf('F') >= 0 || q.town !== undefined) opts.push({ label: '🎣 ออกเรือหาปลา', sub: S77.JOBS.fishing.hours + ' ชม.', run: () => this.confirmJob('fishing', this.currentProvIdx) });
      if (!opts.length) opts.push({ label: 'ไม่มีเรือออกตอนนี้', disabled: true });
      S77.UI.menu('ท่าเรือ', opts, { icon: '⛴️' });
    }
    confirmJob(job, pi) {
      const J = S77.JOBS[job], p = this.player;
      if (J.req) for (const k in J.req) if ((p.skills[k] || 0) < J.req[k]) return S77.UI.toast('ต้องมีทักษะ' + SKILL_TH[k] + ' อย่างน้อย ' + J.req[k], 'bad');
      const pay = S77.Econ.wage(this, job, pi);
      S77.UI.menu('💼 ' + J.th, [
        { label: 'เริ่มทำงาน ' + J.hours + ' ชั่วโมง', sub: (pay ? 'ค่าแรง ~' + U.fmtMoney(pay) : 'ไม่มีค่าแรง แต่ได้ชื่อเสียง') + ' · ใช้พลังงาน ' + J.energy, run: () => this.doJob(job, pi) },
        { label: 'ยกเลิก', run: () => {} },
      ], { icon: '💼' });
    }
    doJob(job, pi) {
      const J = S77.JOBS[job], p = this.player, s = p.stats;
      if (s.energy < J.energy * 0.8) return S77.UI.toast('เหนื่อยเกินไปที่จะทำงาน ไปพักผ่อนก่อนนะ', 'bad');
      if (s.hunger < 12) return S77.UI.toast('หิวจนไม่มีแรง กินอะไรก่อนเถอะ', 'bad');
      if (job === 'rubber' && !(this.time.hour < 9 || this.time.hour >= 22)) S77.UI.toast('💡 กรีดยางตอนเช้ามืดจะได้น้ำยางมากกว่า', 'info');
      S77.UI.fade('💼 ' + J.th + '...', () => {
        this.advanceTime(J.hours * 60, { energyK: 0, hungerK: 1.3 });
        this.stat('energy', -J.energy);
        let pay = S77.Econ.wage(this, job, pi);
        if (job === 'rubber' && (this.time.hour < 10)) pay = Math.round(pay * 1.3);
        const tip = Math.random() < 0.15 && pay ? Math.round(pay * 0.2) : 0;
        if (pay) this.earn(pay + tip, 'job');
        if (J.skill) this.addSkill(J.skill, J.gain);
        if (J.rep) this.addRep(pi, J.rep);
        if (J.mood) this.stat('mood', J.mood);
        let got = '';
        if (J.item) { const n = U.clamp(Math.round(U.rnd(J.items[0], J.items[1] + 0.99) - 0.49), 0, 9); if (n > 0) { this.addItem(J.item, n); got = ' · ได้' + S77.ITEMS[J.item].th + ' ×' + n; } }
        p.counters.jobs++;
        S77.UI.toast('✅ ' + J.th + ' เสร็จแล้ว' + (pay ? ' ได้ ' + U.fmtMoney(pay + tip) : '') + (tip ? ' (รวมทิป)' : '') + got, 'good');
        E.emit('jobDone', { job, prov: pi, pay });
      });
    }
    sleep(cost, where) {
      if (cost && !this.spend(cost, 'lodging')) return;
      const h = this.time.hour;
      const mins = h >= 18 || h < 5 ? ((24 - h + 7) % 24) * 60 : 8 * 60;
      S77.UI.fade('🌙 ฝันดี...', () => {
        this.advanceTime(Math.max(120, Math.round(mins)), { sleep: true });
        const s = this.player.stats; s.energy = 100; this.stat('health', 15); this.stat('mood', 6);
        this.save('auto', true);
        S77.UI.toast('☀️ ตื่นนอนแล้ว พลังเต็มเปี่ยม! (บันทึกเกมอัตโนมัติ)', 'good');
        E.emit('sleep', { where });
      });
    }
    markHome(bid) { const b = this.world.buildings[bid]; if (b) { b.type = 'home'; b.name = 'บ้านของ' + this.player.name; } }

    /* delivery-rider mini-job */
    startDelivery(pi) {
      const t = this.world.towns[pi], cands = t.buildings.map((id) => this.world.buildings[id]).filter((b) => b.door && (b.type === 'house' || b.type === 'shophouse' || b.type === 'condo') && Math.hypot(b.door.x - this.player.x, b.door.y - this.player.y) > 6);
      if (!cands.length) return S77.UI.toast('ไม่มีออเดอร์ตอนนี้', 'info');
      const b = U.pick(cands), dist = Math.hypot(b.door.x - this.player.x, b.door.y - this.player.y);
      this.delivery = { bid: b.id, x: b.door.x, y: b.door.y, reward: Math.round((50 + dist * 4) * this.provState[pi].wageMul), deadline: this.time.total + 30 + dist * 1.2, prov: pi };
      S77.UI.toast('🛵 รับออเดอร์แล้ว! ไปส่งที่ประตูบ้านตามลูกศร ภายใน ' + Math.round(this.delivery.deadline - this.time.total) + ' นาทีเกม', 'info');
    }
    checkDelivery() {
      const d = this.delivery, p = this.player;
      if (this.time.total > d.deadline) { this.delivery = null; S77.UI.toast('⌛ ส่งไม่ทันเวลา ลูกค้ายกเลิกออเดอร์', 'bad'); return; }
      if (Math.hypot(d.x + 0.5 - p.x, d.y + 0.5 - p.y) < 1.3) {
        this.delivery = null; this.earn(d.reward, 'delivery'); this.addSkill('charisma', 0.5); this.addRep(d.prov, 0.5); p.counters.jobs++;
        S77.UI.toast('🛵 ส่งอาหารสำเร็จ! ลูกค้าให้ดาว ⭐⭐⭐⭐⭐', 'good');
        E.emit('jobDone', { job: 'delivery', prov: d.prov, pay: d.reward });
      }
    }

    /* ---------------- items ---------------- */
    useItem(id) {
      const it = this.itemDef(id); if (!it || !this.player.inv[id]) return;
      if (it.kind === 'vehicle') { this.toggleRide(id); return; }
      if (it.kind === 'book') {
        this.removeItem(id); S77.UI.fade('📘 กำลังอ่านหนังสือ...', () => { this.advanceTime(120); this.addSkill('knowledge', 3); S77.UI.toast('📘 ความรู้ +3', 'good'); });
        return;
      }
      if (it.kind === 'tool' || it.kind === 'produce' || it.kind === 'quest' || (it.kind === 'good' && !it.hunger)) { S77.UI.toast(it.desc || 'ใช้ไม่ได้ตอนนี้ — ลองขายที่ตลาดดูสิ', 'info'); return; }
      this.removeItem(id);
      if (it.hunger) this.stat('hunger', it.hunger);
      if (it.energy) this.stat('energy', it.energy);
      if (it.mood) this.stat('mood', it.mood);
      if (it.health) this.stat('health', it.health);
      let extra = '';
      if (it.dish && this.player.dishes.indexOf(id) < 0) { this.player.dishes.push(id); this.stat('mood', 6); extra = ' · ได้ลองอาหารขึ้นชื่อครั้งแรก! 😋'; }
      S77.Sound.play('eat');
      S77.UI.toast(it.icon + ' ' + it.th + extra, 'good');
      E.emit('useItem', { id });
    }
    toggleRide(pref) {
      const p = this.player;
      if (p.riding) { p.riding = null; S77.UI.toast('ลงจากรถแล้ว'); return; }
      const v = pref && p.vehicles[pref] ? pref : p.vehicles.motorbike ? 'motorbike' : p.vehicles.bicycle ? 'bicycle' : null;
      if (!v) { S77.UI.toast('ยังไม่มียานพาหนะ — ซื้อได้ที่ห้างสรรพสินค้าในเมืองใหญ่', 'info'); return; }
      p.riding = v; S77.UI.toast((v === 'motorbike' ? '🛵' : '🚲') + ' ขี่' + S77.ITEMS[v].th);
    }

    /* ---------------- rendering helpers ---------------- */
    visibleEntities() {
      const out = [];
      for (const n of this.npcs || []) if (!n.hidden) out.push(n);
      for (const a of this.animals || []) out.push(a);
      if (this.player) out.push(this.player);
      return out;
    }
  }
  const SKILL_TH = (S77.SKILL_TH = { labor: 'แรงงาน', trade: 'การค้า', charisma: 'การพูด/เสน่ห์', knowledge: 'ความรู้' });
  const buildingIcon = (b) => ({ hall: '🏛️', temple: '🛕', vtemple: '🛕', market: '🧺', store: '🏪', restaurant: '🍲', lodge: '🏨', bus: '🚌', train: '🚆', airport: '✈️', hospital: '🏥', school: '🏫', police: '👮', jobcenter: '💼', bank: '🏦', sala: '🛖', vsala: '🛖', mall: '🛍️', factory: '🏭', office: '🏢', parliament: '🏛️', govhouse: '🏛️', forsale: '🏠', home: '🏠', grocery: '🏪', mosque: '🕌', cjshrine: '🏮', pillar: '🙏', landmark: '📍' }[b.type] || '🏠');
  S77.buildingIcon = buildingIcon;

  /* ======================= building actions ======================= */
  // each: opt(game, building, provIdx) -> {label, sub, disabled, run} | null
  const job = (id) => ({ opt: (g, b, pi) => { const J = S77.JOBS[id]; return { label: '💼 ทำงาน: ' + J.th, sub: J.hours + ' ชม. · ~' + U.fmtMoney(S77.Econ.wage(g, id, pi)) + (J.req ? ' · ต้องมี' + Object.keys(J.req).map((k) => SKILL_TH[k] + ' ' + J.req[k]).join(',') : ''), run: () => g.confirmJob(id, pi) }; } });
  const shop = (list) => ({ opt: (g, b, pi) => ({ label: '🛒 ซื้อของ', run: () => S77.UI.shop(g, b.name, (typeof list === 'function' ? list(g, b, pi) : list), pi) }) });
  const ACTS = (S77.ACTS = {
    info: { opt: (g, b, pi) => ({ label: '📊 ข้อมูลจังหวัด & ปัญหาของประชาชน', run: () => S77.UI.provinceInfo(g, pi) }) },
    gov_job: job('gov'),
    register: {
      opt: (g, b, pi) => ({
        label: '🪪 ย้ายทะเบียนบ้านมาที่' + S77.PROVINCES[pi].th, sub: g.player.regProv === pi ? 'ทะเบียนบ้านของคุณอยู่ที่นี่แล้ว' : 'ต้องมีบ้านในจังหวัดนี้ หรือชื่อเสียง 20+ · ค่าธรรมเนียม ฿20', disabled: g.player.regProv === pi,
        run: () => {
          const owns = g.player.homes.some((id) => g.world.buildings[id].prov === pi);
          if (!owns && (g.player.rep[pi] || 0) < 20) return S77.UI.toast('ยังไม่มีสิทธิ์ย้ายทะเบียนบ้านมาที่นี่', 'bad');
          if (!g.spend(20, 'register')) return;
          g.player.regProv = pi; S77.UI.toast('🪪 ย้ายทะเบียนบ้านมา' + S77.PROVINCES[pi].th + 'แล้ว (สำคัญต่อสิทธิ์การเลือกตั้งใน Phase 2)', 'good'); E.emit('register', { prov: pi });
        },
      }),
    },
    petition: {
      opt: (g, b, pi) => {
        const is = g.provState[pi].issues[0];
        return {
          label: '✉️ ยื่นข้อเสนอแก้ปัญหา' + (is ? '"' + S77.ISSUES[is.id].th + '"' : ''), sub: 'ใช้เวลา 1 ชม. · ได้ชื่อเสียง (วันละครั้ง)', disabled: !is,
          run: () => {
            if (!g.daily('petition' + pi)) return S77.UI.toast('วันนี้ยื่นเรื่องไปแล้ว รอผลก่อนนะ', 'info');
            g.advanceTime(60); g.addRep(pi, 2); g.addSkill('knowledge', 0.5); g.addSkill('charisma', 0.5);
            is.sev = Math.max(0.1, is.sev - 0.03); g.provState[pi].happiness += 0.3;
            S77.UI.toast('✉️ ข้อเสนอของคุณถูกส่งถึงผู้ว่าฯ แล้ว ชาวบ้านเริ่มรู้จักคุณมากขึ้น', 'good'); E.emit('petition', { prov: pi, issue: is.id });
          },
        };
      },
    },
    pray: { opt: (g, b) => ({ label: '🙏 สักการะ', run: () => { if (g.daily('pray' + b.id)) { g.stat('mood', 5); S77.UI.toast('🙏 จิตใจสงบ อารมณ์ +5', 'good'); } else S77.UI.toast('วันนี้สักการะแล้ว'); } }) },
    merit: {
      opt: (g, b, pi) => ({
        label: '🪷 ทำบุญ ฿50', sub: 'อารมณ์ +8 · ชื่อเสียง +1 (วันละครั้ง)',
        run: () => { if (!g.daily('merit' + b.id)) return S77.UI.toast('วันนี้ทำบุญที่นี่แล้ว อนุโมทนาบุญ 🙏'); if (!g.spend(50, 'merit')) return; g.stat('mood', 8); g.addRep(pi, 1); S77.UI.toast('🪷 ทำบุญแล้ว สาธุ จิตใจผ่องใส', 'good'); E.emit('merit', { prov: pi }); },
      }),
    },
    volunteer: job('volunteer'),
    visit_mosque: { opt: (g, b, pi) => ({ label: '🕌 เยี่ยมชมด้วยความเคารพ', run: () => { if (g.daily('mosque' + b.id)) { g.stat('mood', 5); g.addRep(pi, 1); S77.UI.toast('🕌 ได้เรียนรู้วัฒนธรรมท้องถิ่น อารมณ์ +5', 'good'); } else S77.UI.toast('วันนี้มาเยี่ยมแล้ว'); } }) },
    shop_market: shop((g, b, pi) => ['sticky_pork', 'somtam', 'chicken_rice', 'noodles', 'fruit', 'thaitea', 'mango_sticky', 'flowers', 'umbrella', 'good_' + S77.PROVINCES[pi].key]),
    sell: { opt: (g, b, pi) => ({ label: '💰 ขายของ', sub: 'ผลผลิตและของดีต่างถิ่น', run: () => S77.UI.sell(g, pi) }) },
    job_vendor: job('vendor'),
    shop_store: shop(['bento', 'sandwich', 'noodle_cup', 'bread', 'water', 'coffee', 'medicine', 'umbrella']),
    job_clerk: job('clerk'),
    shop_food: shop((g, b, pi) => ['dish_' + S77.PROVINCES[pi].key, 'fried_rice', 'noodles', 'chicken_rice', 'thaitea', 'water']),
    job_kitchen: job('kitchen'),
    sleep: { opt: (g, b, pi) => { const c = S77.Econ.lodging(g, pi); return { label: '🛏️ พักค้างคืน', sub: U.fmtMoney(c) + ' · ฟื้นพลังงาน + บันทึกเกม', run: () => g.sleep(c, 'lodge') }; } },
    job_hotel: job('hotel'),
    travel_bus: { opt: (g, b, pi) => ({ label: '🚌 ซื้อตั๋วรถโดยสาร', sub: 'ไปได้ทุกจังหวัด', run: () => S77.UI.travel(g, 'bus', pi) }) },
    travel_train: { opt: (g, b, pi) => ({ label: '🚆 ซื้อตั๋วรถไฟ', sub: 'ราคาถูก ชมวิวสองข้างทาง', run: () => S77.UI.travel(g, 'rail', pi) }) },
    travel_air: { opt: (g, b, pi) => ({ label: '✈️ ซื้อตั๋วเครื่องบิน', sub: 'เร็วที่สุด', run: () => S77.UI.travel(g, 'air', pi) }) },
    heal: { opt: (g) => ({ label: '🩺 ตรวจรักษา ฿250', sub: 'สุขภาพเต็ม 100', run: () => { if (g.player.stats.health >= 99) return S77.UI.toast('คุณแข็งแรงดีอยู่แล้ว 💪'); if (!g.spend(250, 'heal')) return; g.advanceTime(60); g.player.stats.health = 100; S77.UI.toast('🩺 หายดีแล้ว', 'good'); } }) },
    job_hospital: job('hospital'),
    study: { opt: (g) => ({ label: '📚 เรียนคอร์สภาคค่ำ ฿80', sub: '3 ชม. · ความรู้ +2', run: () => { if (!g.spend(80, 'study')) return; S77.UI.fade('📚 กำลังเรียน...', () => { g.advanceTime(180); g.addSkill('knowledge', 2); S77.UI.toast('📚 ความรู้ +2', 'good'); }); } }) },
    job_teacher: job('teacher'),
    police_talk: { opt: (g, b, pi) => ({ label: '👮 สอบถามความปลอดภัย', run: () => S77.UI.toast('👮 "' + S77.PROVINCES[pi].th + 'ปลอดภัยดีครับ ดัชนีความปลอดภัย ' + Math.round(g.provState[pi].safety) + '/100 ขับขี่ระวังด้วยนะครับ"', 'info') }) },
    jobs: { opt: (g, b, pi) => ({ label: '📋 ดูตำแหน่งงานในจังหวัด', run: () => S77.UI.jobBoard(g, pi) }) },
    bank: { opt: (g) => ({ label: '🏦 ฝาก/ถอนเงิน', sub: 'เงินฝาก ' + U.fmtMoney(g.player.bank), run: () => S77.UI.bank(g) }) },
    townhall: {
      opt: (g, b, pi) => {
        const h = g.time.hour, open = h >= 17 && h < 20.5;
        return {
          label: '🗣️ ร่วมประชุมประชาคม', sub: open ? 'กำลังประชุมอยู่! 1 ชม. · ชื่อเสียง +2' : 'มีประชุมช่วง 17:00–20:30', disabled: !open,
          run: () => {
            if (!g.daily('townhall' + pi)) return S77.UI.toast('วันนี้ร่วมประชุมแล้ว');
            const is = g.provState[pi].issues[0];
            g.advanceTime(60); g.addRep(pi, 2); g.addSkill('charisma', 1);
            S77.UI.toast('🗣️ ที่ประชุมคุยกันเรื่อง "' + (is ? S77.ISSUES[is.id].th : 'การพัฒนาชุมชน') + '" — คุณได้แสดงความคิดเห็น', 'good'); E.emit('townhall', { prov: pi });
          },
        };
      },
    },
    shop_mall: shop((g, b, pi) => {
      const extra = []; const r = U.rng(pi * 31 + g.time.day);
      for (let k = 0; k < 4; k++) extra.push('good_' + S77.PROVINCES[r.int(0, 76)].key);
      return ['camera', 'bicycle', 'motorbike', 'umbrella', 'book', 'coffee', 'mango_sticky', ...extra];
    }),
    job_factory: job('factory'),
    job_office: job('office'),
    parliament: { opt: (g, b, pi) => ({ label: '🏛️ เยี่ยมชมอาคาร', sub: 'ระบบการเมืองเต็มรูปแบบจะเปิดใน Phase 2', run: () => { if (g.daily('parl')) { g.addSkill('knowledge', 1); g.addRep(pi, 1); } S77.UI.toast('🏛️ คุณเดินชมอาคาร... สักวันหนึ่งคุณอาจได้ทำงานที่นี่ (Phase 2)', 'info'); } }) },
    buy_house: {
      opt: (g, b, pi) => {
        const price = S77.Econ.housePrice(g, pi);
        return { label: '🏠 ซื้อบ้านหลังนี้', sub: U.fmtMoney(price) + ' · นอนฟรี + ย้ายทะเบียนบ้านได้', run: () => { if (!g.spend(price, 'house')) return; g.player.homes.push(b.id); g.markHome(b.id); g.renderer.chunks.clear(); S77.UI.toast('🏠 ยินดีด้วย! คุณมีบ้านเป็นของตัวเองแล้ว', 'good'); E.emit('buyHouse', { b: b.id, prov: pi }); } };
      },
    },
    sleep_home: { opt: (g) => ({ label: '🛏️ นอนที่บ้าน', sub: 'ฟรี · ฟื้นพลังงาน + บันทึกเกม', run: () => g.sleep(0, 'home') }) },
    shop_grocery: shop(['water', 'noodle_cup', 'bread', 'coffee', 'flowers', 'sticky_pork']),
    photo: {
      opt: (g, b, pi) => {
        const has = g.player.landmarks.indexOf(b.id) >= 0;
        return {
          label: has ? '📸 ถ่ายรูปอีกครั้ง' : '📸 ถ่ายรูปเก็บเป็นที่ระลึก', sub: b.name + (has ? ' (สะสมแล้ว)' : ' · ปลดล็อกแลนด์มาร์ก'),
          run: () => {
            S77.Sound.play('shutter');
            if (!has) { g.player.landmarks.push(b.id); g.addRep(pi, g.player.inv.camera ? 5 : 3); g.stat('mood', 10); S77.UI.toast('📸 สะสมแลนด์มาร์ก "' + b.name + '" แล้ว! (' + g.player.landmarks.length + '/77)', 'good'); }
            else { g.stat('mood', 2); S77.UI.toast('📸 สวยเหมือนเดิม!'); }
            for (const q of g.quests) if (!q.done && q.type === 'visit' && q.target === pi) { q.seen = true; S77.UI.toast('📝 ถ่ายรูปให้ ' + q.giverName + ' แล้ว กลับไปเล่าให้ฟังกัน', 'info'); }
            E.emit('photo', { b: b.id, prov: pi });
          },
        };
      },
    },
  });
  // job board also offers delivery rides
  S77.Game = Game;
})();
