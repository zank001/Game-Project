/* =============================================================
   game.js — สถานะเกมและกฎทั้งหมด (ไม่แตะ DOM)
   ============================================================= */
'use strict';

/* ที่เก็บเซฟที่ทนต่อ sandbox: ใช้ localStorage ถ้าใช้ได้ ไม่งั้นเก็บในหน่วยความจำ */
const Store = (() => {
  let ok = false;
  const mem = {};
  try { const k = '__vcs_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
  return {
    persistent: ok,
    get(k) { try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
    remove(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } },
  };
})();

const SAVE_KEY = 'vcs_save_v1';

const Game = {
  state: null,

  /* ================= เริ่ม / เซฟ / โหลด ================= */

  hasSave() { return !!Store.get(SAVE_KEY); },

  save() {
    if (!this.state) return;
    try { Store.set(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* เต็ม/ผิดพลาด: ข้าม */ }
  },

  load() {
    const raw = Store.get(SAVE_KEY);
    if (!raw) return false;
    try {
      const st = JSON.parse(raw);
      if (!st || !Array.isArray(st.players) || !st.club) return false;
      this.state = st;
      return true;
    } catch (e) { return false; }
  },

  reset() { Store.remove(SAVE_KEY); this.state = null; },

  newGame(clubName) {
    const usedNames = [];
    const mk = (pos, bonus) => this._makePlayer(pos, 14 + bonus, usedNames);
    this.state = {
      v: 1,
      club: clubName || 'วอลเลย์คลับ',
      year: 1, month: 1, week: 1,
      money: 12000, fans: 60,
      chem: 40, morale: 70,
      nextPid: 1,
      players: [],
      starterIds: [],
      facilities: { gym: 0, machine: 0, video: 0, spa: 0, canteen: 0, shop: 0 },
      trophies: [],
      record: { w: 0, l: 0 },
      bestFinish: {},
      played: {},            /* played[year] = [tournamentId] */
      pendingCandidates: null,
      scoutDiscount: false,
      worldChampion: false,
      log: [],
    };
    /* ทีมเริ่มต้น 7 คน: ตัวจริง 6 + สำรอง 1 */
    const roster = [mk('S', 4), mk('OH', 5), mk('OH', 3), mk('MB', 4), mk('MB', 2), mk('OP', 5), mk('LB', 3)];
    roster.forEach(p => this.state.players.push(p));
    this.state.starterIds = roster.slice(0, 6).map(p => p.id);
    this.pushLog('🏐 ก่อตั้งสโมสร "' + this.state.club + '" — เป้าหมาย: แชมป์โลก!');
    this.save();
  },

  _makePlayer(pos, base, usedNames) {
    const st = this.state;
    const name = this._uniqueName(usedNames);
    const g = DATA.positions[pos].growth;
    const stats = {};
    for (const k of ['srv', 'atk', 'blk', 'rcv', 'set', 'sta']) {
      stats[k] = Math.max(5, Math.min(99, base + R.int(-4, 4) + (g[k] ? g[k] * 2 : 0)));
    }
    return {
      id: st.nextPid++,
      name, pos,
      lv: 1, exp: 0,
      pot: R.int(1, 3),
      stats,
      cond: R.int(80, 100),
      skin: R.pick(DATA.skins),
      hair: R.pick(DATA.hairs),
    };
  },

  _uniqueName(used) {
    const taken = new Set([...(this.state ? this.state.players.map(p => p.name) : []), ...used]);
    const free = DATA.names.filter(n => !taken.has(n));
    const name = free.length ? R.pick(free) : R.pick(DATA.names) + '​' + R.int(2, 9);
    used.push(name);
    return name;
  },

  /* ================= ตัวช่วยอ่านค่า ================= */

  fmtMoney(n) { return '฿' + Math.round(n).toLocaleString('en-US'); },
  fmtNum(n) { return Math.round(n).toLocaleString('en-US'); },
  dateStr() { const s = this.state; return `ปี ${s.year} เดือน ${s.month} สัปดาห์ ${s.week}`; },

  playerById(id) { return this.state.players.find(p => p.id === id); },
  starters() { return this.state.starterIds.map(id => this.playerById(id)).filter(Boolean); },
  bench() { return this.state.players.filter(p => !this.state.starterIds.includes(p.id)); },

  playerPower(p) {
    const s = p.stats;
    return Math.round((s.srv + s.atk + s.blk + s.rcv + s.set + s.sta) / 6);
  },

  teamPower() {
    const st = this.starters();
    if (!st.length) return 0;
    const avg = st.reduce((a, p) => a + this.playerPower(p), 0) / st.length;
    return Math.round(avg * (0.9 + 0.2 * this.state.chem / 100));
  },

  salaryOf(p) { return 15 + p.lv * 12 + p.pot * 8; },
  totalSalary() { return this.state.players.reduce((a, p) => a + this.salaryOf(p), 0); },

  sponsorsActive() { return DATA.sponsors.filter(sp => this.state.fans >= sp.fans); },
  sponsorIncome() { return this.sponsorsActive().reduce((a, sp) => a + sp.weekly, 0); },
  shopIncome() {
    const lvl = this.state.facilities.shop;
    return lvl ? lvl * (100 + Math.floor(this.state.fans * 0.04)) : 0;
  },

  facilityLevel(fid) { return this.state.facilities[fid] || 0; },

  expNeed(lv) { return 50 + lv * 30; },

  pushLog(msg) {
    this.state.log.unshift(`[ปี${this.state.year} ด.${this.state.month} สป.${this.state.week}] ${msg}`);
    if (this.state.log.length > 40) this.state.log.length = 40;
  },

  /* ================= การกระทำรายสัปดาห์ ================= */

  /* ฝึกซ้อม: ทั้งทีมได้สเตตัส ตัดเงิน+ความสดชื่น แล้วเวลาเดินหน้า 1 สัปดาห์ */
  actTraining(tid) {
    const t = DATA.trainings.find(x => x.id === tid);
    if (!t || this.state.money < t.cost) return null;
    this.state.money -= t.cost;
    const facMult = 1 + 0.25 * this.facilityLevel(t.fac);
    const results = [];
    for (const p of this.state.players) {
      const tired = p.cond < 25;
      const gains = {};
      for (const [k, v] of Object.entries(t.stats)) {
        let g = v * facMult * (0.8 + p.pot * 0.1);
        if (p.stats[k] >= 90) g *= 0.2;
        else if (p.stats[k] >= 70) g *= 0.5;
        else if (p.stats[k] >= 50) g *= 0.75;
        if (tired) g *= 0.4;
        g = Math.max(p.stats[k] >= 99 ? 0 : 1, Math.round(g + (Math.random() - 0.5)));
        p.stats[k] = Math.min(99, p.stats[k] + g);
        gains[k] = g;
      }
      p.cond = Math.max(0, p.cond - (t.cond + R.int(0, 4)));
      const lvls = this.giveExp(p, 6);
      results.push({ p, gains, lvls, tired });
    }
    if (t.chem) {
      const bonus = t.chem + this.facilityLevel('video');
      this.state.chem = Math.min(100, this.state.chem + bonus);
    }
    this.pushLog(`${t.icon} ${t.name} (−${this.fmtMoney(t.cost)})`);
    const weekly = this.advanceWeek();
    return { training: t, results, weekly };
  },

  /* พักผ่อน: ฟื้นความสดชื่น + กำลังใจ */
  actRest() {
    const spa = this.facilityLevel('spa'), canteen = this.facilityLevel('canteen');
    const condUp = 30 + spa * 6;
    const morUp = 10 + canteen * 3;
    for (const p of this.state.players) p.cond = Math.min(100, p.cond + condUp + R.int(0, 6));
    this.state.morale = Math.min(100, this.state.morale + morUp);
    this.pushLog(`😴 พักผ่อนทั้งทีม (+ความสดชื่น ${condUp})`);
    const weekly = this.advanceWeek();
    return { condUp, morUp, weekly };
  },

  /* แมวมอง: จ่ายเงินเพื่อสุ่มผู้เล่นใหม่ 3 คนมาให้เลือกเซ็น */
  scoutCost() { return this.state.scoutDiscount ? 400 : 800; },

  actScout() {
    const cost = this.scoutCost();
    if (this.state.money < cost) return null;
    this.state.money -= cost;
    this.state.scoutDiscount = false;
    const tp = Math.max(14, this.teamPower());
    const positions = ['S', 'OH', 'OH', 'MB', 'OP', 'LB'];
    const cands = [];
    const used = [];
    for (let i = 0; i < 3; i++) {
      const pos = R.pick(positions);
      const base = tp + R.int(-5, 7);
      const c = this._makePlayer(pos, base, used);
      c.pot = Math.min(5, R.int(1, 3) + (R.chance(0.3) ? 1 : 0) + (R.chance(0.1) ? 1 : 0));
      c.fee = Math.max(500, this.playerPower(c) * 130 + c.pot * 400);
      cands.push(c);
    }
    this.state.pendingCandidates = cands;
    this.pushLog(`🕵️ ส่งแมวมองเสาะหานักกีฬา (−${this.fmtMoney(cost)})`);
    const weekly = this.advanceWeek();
    return { cands, weekly };
  },

  signCandidate(idx) {
    const cands = this.state.pendingCandidates;
    if (!cands || !cands[idx]) return { ok: false, why: 'ไม่พบผู้เล่น' };
    if (this.state.players.length >= 10) return { ok: false, why: 'ทีมเต็มแล้ว (สูงสุด 10 คน)' };
    const c = cands[idx];
    if (this.state.money < c.fee) return { ok: false, why: 'เงินไม่พอจ่ายค่าเซ็นสัญญา' };
    this.state.money -= c.fee;
    const p = { ...c };
    delete p.fee;
    p.id = this.state.nextPid++;
    this.state.players.push(p);
    cands.splice(idx, 1);
    if (!cands.length) this.state.pendingCandidates = null;
    this.state.chem = Math.max(0, this.state.chem - 4);
    this.pushLog(`✍️ เซ็นสัญญา "${p.name}" (${DATA.positions[p.pos].name}) เข้าทีม`);
    this.save();
    return { ok: true, p };
  },

  dismissCandidates() { this.state.pendingCandidates = null; this.save(); },

  releasePlayer(id) {
    if (this.state.players.length <= 6) return { ok: false, why: 'ทีมต้องมีอย่างน้อย 6 คน' };
    if (this.state.starterIds.includes(id) && this.bench().length === 0)
      return { ok: false, why: 'ไม่มีตัวสำรองมาแทน' };
    const p = this.playerById(id);
    if (!p) return { ok: false, why: 'ไม่พบผู้เล่น' };
    this.state.players = this.state.players.filter(x => x.id !== id);
    if (this.state.starterIds.includes(id)) {
      const sub = this.bench()[0] || this.state.players.find(x => !this.state.starterIds.includes(x.id));
      this.state.starterIds = this.state.starterIds.map(x => x === id ? sub.id : x);
    }
    this.state.starterIds = this.state.starterIds.filter(x => this.playerById(x));
    this.pushLog(`👋 "${p.name}" ออกจากทีม`);
    this.save();
    return { ok: true };
  },

  swapStarter(starterId, benchId) {
    const ids = this.state.starterIds;
    const i = ids.indexOf(starterId);
    if (i < 0 || ids.includes(benchId) || !this.playerById(benchId)) return false;
    ids[i] = benchId;
    this.save();
    return true;
  },

  upgradeFacility(fid) {
    const f = DATA.facilities.find(x => x.id === fid);
    const lvl = this.facilityLevel(fid);
    if (!f || lvl >= f.costs.length) return { ok: false, why: 'อัปเกรดสูงสุดแล้ว' };
    const cost = f.costs[lvl];
    if (this.state.money < cost) return { ok: false, why: 'เงินไม่พอ' };
    this.state.money -= cost;
    this.state.facilities[fid] = lvl + 1;
    this.pushLog(`🔨 อัปเกรด "${f.name}" เป็นระดับ ${lvl + 1}`);
    this.save();
    return { ok: true, lvl: lvl + 1, cost };
  },

  /* ================= เวลาเดินหน้า 1 สัปดาห์ ================= */

  advanceWeek() {
    const s = this.state;
    const msgs = [];

    /* รายรับ-รายจ่าย */
    const income = this.sponsorIncome() + this.shopIncome();
    const salary = this.totalSalary();
    s.money += income - salary;
    if (s.money < 0) { s.money = 0; s.morale = Math.max(0, s.morale - 5); msgs.push('💸 เงินหมด! ค้างค่าเหนื่อยนักกีฬา กำลังใจลด'); }

    /* ฟื้นตัวเล็กน้อยตามธรรมชาติ + สิ่งปลูกสร้าง */
    const spa = this.facilityLevel('spa'), canteen = this.facilityLevel('canteen');
    for (const p of s.players) p.cond = Math.min(100, p.cond + 6 + spa * 4);
    s.morale = Math.min(100, s.morale + 1 + canteen * 3);

    /* แฟนคลับเพิ่มเองช้าๆ ตามชื่อเสียง */
    const fanGrow = Math.floor(1 + s.fans * 0.002 + this.facilityLevel('shop') * 3);
    s.fans += fanGrow;

    /* อีเวนต์สุ่ม */
    if (R.chance(0.22)) {
      const ev = R.pick(DATA.events);
      this.applyEvent(ev, msgs);
    }

    /* เดินปฏิทิน */
    s.week++;
    if (s.week > 4) {
      s.week = 1; s.month++;
      if (s.month > 12) { s.month = 1; s.year++; msgs.push(`🎆 ขึ้นปีที่ ${s.year} แล้ว! คู่แข่งทั่วประเทศแข็งแกร่งขึ้น`); }
    }

    const t = this.monthTournament();
    if (t && s.week === 1) msgs.push(`${t.icon} เดือนนี้มีศึก "${t.name}"! เข้าร่วมได้จากหน้าหลัก`);

    msgs.push(`📊 รายรับ ${this.fmtMoney(income)} · ค่าเหนื่อย ${this.fmtMoney(salary)}`);
    this.save();
    return { income, salary, msgs, fanGrow };
  },

  applyEvent(ev, msgs) {
    const s = this.state;
    let txt = `${ev.icon} ${ev.text}`;
    if (ev.money) { s.money = Math.max(0, s.money + ev.money); }
    if (ev.moneyPerFan) { const m = Math.max(ev.moneyMin || 0, Math.floor(s.fans * ev.moneyPerFan)); s.money += m; txt += ` (+${this.fmtMoney(m)})`; }
    if (ev.morale) s.morale = Math.min(100, Math.max(0, s.morale + ev.morale));
    if (ev.chem) s.chem = Math.min(100, Math.max(0, s.chem + ev.chem));
    if (ev.cond) for (const p of s.players) p.cond = Math.min(100, Math.max(0, p.cond + ev.cond));
    if (ev.fansPct) { const f = Math.max(ev.fansMin || 0, Math.floor(s.fans * ev.fansPct)); s.fans += f; txt += ` (+แฟนคลับ ${this.fmtNum(f)})`; }
    if (ev.statUp) {
      const p = R.pick(s.players);
      const k = R.pick(['srv', 'atk', 'blk', 'rcv', 'set', 'sta']);
      p.stats[k] = Math.min(99, p.stats[k] + ev.statUp);
      txt += ` (${p.name}: ${DATA.statNames[k]} +${ev.statUp})`;
    }
    if (ev.scoutSale) s.scoutDiscount = true;
    this.pushLog(txt);
    msgs.push(txt);
  },

  /* ================= ทัวร์นาเมนต์ ================= */

  monthTournament() {
    const s = this.state;
    return DATA.tournaments.find(t =>
      t.month === s.month &&
      s.year >= t.minYear &&
      this.tournamentUnlocked(t) &&
      !(s.played[s.year] || []).includes(t.id)
    ) || null;
  },

  tournamentUnlocked(t) {
    if (!t.unlock) return true;
    return this.state.trophies.some(tr => tr.tid === t.unlock);
  },

  nextTournament() {
    const s = this.state;
    let best = null;
    for (const t of DATA.tournaments) {
      if (!this.tournamentUnlocked(t)) continue;
      for (let off = 0; off <= 12; off++) {
        let m = s.month + off, y = s.year;
        while (m > 12) { m -= 12; y++; }
        if (t.month === m && y >= t.minYear && !(s.played[y] || []).includes(t.id)) {
          if (off === 0 && s.week > 4) continue;
          if (!best || off < best.off) best = { t, off };
          break;
        }
      }
    }
    return best;
  },

  startTournament(tid) {
    const t = DATA.tournaments.find(x => x.id === tid);
    if (!t) return null;
    const s = this.state;
    const rounds = Math.log2(t.teams);           /* 4 ทีม = 2 รอบ, 8 ทีม = 3 รอบ */
    const names = R.shuffle(DATA.rivals[t.tier].teams);
    const opponents = [];
    for (let rIdx = 0; rIdx < rounds; rIdx++) {
      /* คู่แข่งรอบแรกอยู่ขอบล่างของระดับ รอบลึกแข็งขึ้นเรื่อยๆ */
      const power = Math.min(95, this.tourRoundPower(t, rIdx) + R.int(-2, 2));
      opponents.push(this.buildRivalTeam(names[rIdx], power));
    }
    s.tour = { tid, round: 0, rounds, opponents: opponents, out: false };
    (s.played[s.year] = s.played[s.year] || []).push(tid);
    this.pushLog(`${t.icon} เข้าร่วมศึก "${t.name}"!`);
    this.save();
    return s.tour;
  },

  tourRoundPower(t, rIdx) {
    const [lo, hi] = DATA.rivals[t.tier].power;
    const rounds = Math.log2(t.teams);
    const yearBoost = Math.min(18, (this.state.year - 1) * 4);
    return Math.round(lo + ((hi - lo) * rIdx) / rounds + yearBoost);
  },

  /* ช่วงพลังคู่แข่งจริงของรายการนี้ (รวมความแข็งแกร่งตามปี) ไว้โชว์ก่อนสมัคร */
  tourPowerRange(t) {
    const rounds = Math.log2(t.teams);
    return [this.tourRoundPower(t, 0), this.tourRoundPower(t, rounds - 1)];
  },

  tourInfo() {
    const s = this.state;
    if (!s.tour) return null;
    const t = DATA.tournaments.find(x => x.id === s.tour.tid);
    const roundNames = s.tour.rounds === 2 ? ['รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'] : ['รอบแรก', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];
    return { t, tour: s.tour, roundName: roundNames[s.tour.round] || 'รอบพิเศษ', opponent: s.tour.opponents[s.tour.round] };
  },

  /* บันทึกผลหนึ่งแมตช์ในทัวร์นาเมนต์ → คืนสถานะ ('next'|'champion'|'out') */
  tourMatchDone(won) {
    const s = this.state;
    const info = this.tourInfo();
    if (!info) return 'none';
    const { t, tour } = info;
    if (!won) {
      tour.out = true;
      const finish = tour.round === tour.rounds - 1 ? 'รองแชมป์' : (tour.round === tour.rounds - 2 ? 'รอบรองชนะเลิศ' : 'รอบแรก');
      this._recordFinish(t, finish);
      const consolation = Math.floor(t.reward * 0.15 * (tour.round + 1) / tour.rounds);
      s.money += consolation;
      s.fans += Math.floor(t.fans * 0.15);
      s.tour = null;
      this.pushLog(`😢 ตกรอบ${finish === 'รองแชมป์' ? 'ชิงฯ ได้รองแชมป์' : ''} "${t.name}" (ปลอบใจ ${this.fmtMoney(consolation)})`);
      const weekly = this.advanceWeek();
      return { status: 'out', finish, consolation, weekly };
    }
    tour.round++;
    if (tour.round >= tour.rounds) {
      /* แชมป์! */
      this._recordFinish(t, 'ชนะเลิศ');
      s.trophies.push({ tid: t.id, year: s.year });
      s.money += t.reward;
      s.fans += t.fans;
      s.morale = Math.min(100, s.morale + 20);
      if (t.id === 'world') s.worldChampion = true;
      s.tour = null;
      this.pushLog(`🏆 คว้าแชมป์ "${t.name}"! (+${this.fmtMoney(t.reward)}, +แฟนคลับ ${this.fmtNum(t.fans)})`);
      const weekly = this.advanceWeek();
      return { status: 'champion', t, weekly };
    }
    this.save();
    return { status: 'next', info: this.tourInfo() };
  },

  _recordFinish(t, finish) {
    const rankOrder = ['รอบแรก', 'รอบรองชนะเลิศ', 'รองแชมป์', 'ชนะเลิศ'];
    const cur = this.state.bestFinish[t.id];
    if (!cur || rankOrder.indexOf(finish) > rankOrder.indexOf(cur)) this.state.bestFinish[t.id] = finish;
  },

  /* ================= สร้างทีมสำหรับแข่ง ================= */

  buildRivalTeam(name, power) {
    const positions = ['S', 'OH', 'OH', 'MB', 'MB', 'OP'];
    const used = [];
    const players = positions.map(pos => {
      const g = DATA.positions[pos].growth;
      const stats = {};
      for (const k of ['srv', 'atk', 'blk', 'rcv', 'set', 'sta']) {
        stats[k] = Math.max(5, Math.min(99, Math.round(power + R.int(-6, 6) + (g[k] ? g[k] * 1.5 : -2))));
      }
      const nm = R.pick(DATA.names.filter(n => !used.includes(n)) || DATA.names);
      used.push(nm);
      return {
        name: nm, pos, stats,
        cond: R.int(75, 100),
        skin: R.pick(DATA.skins), hair: R.pick(DATA.hairs),
      };
    });
    return { name, jersey: R.pick(DATA.rivalJerseys), players, power: Math.round(power), chem: 50, morale: 70 };
  },

  buildPracticeRival() {
    const tp = this.teamPower();
    const pools = DATA.rivals;
    let tier = 0;
    for (const k of [4, 3, 2, 1, 0]) { if (tp >= pools[k].power[0] - 4) { tier = k; break; } }
    const name = R.pick(pools[tier].teams);
    return this.buildRivalTeam(name, Math.max(12, tp + R.int(-6, 5)));
  },

  homeTeam() {
    const s = this.state;
    return {
      name: s.club,
      jersey: '#e8862e',
      players: this.starters().map(p => ({
        ref: p, name: p.name, pos: p.pos,
        stats: { ...p.stats }, cond: p.cond,
        skin: p.skin, hair: p.hair,
      })),
      chem: s.chem, morale: s.morale, isHome: true,
    };
  },

  /* ================= หลังจบแมตช์ ================= */

  giveExp(p, amt) {
    p.exp += amt;
    const ups = [];
    while (p.lv < 30 && p.exp >= this.expNeed(p.lv)) {
      p.exp -= this.expNeed(p.lv);
      p.lv++;
      const g = DATA.positions[p.pos].growth;
      const gained = {};
      /* โตตามตำแหน่ง + โบนัสพรสวรรค์ */
      for (const [k, w] of Object.entries(g)) {
        const inc = Math.max(1, Math.round(w * 0.7)) + (R.chance(p.pot * 0.12) ? 1 : 0);
        p.stats[k] = Math.min(99, p.stats[k] + inc);
        gained[k] = inc;
      }
      ups.push({ lv: p.lv, gained });
    }
    return ups;
  },

  /* result มาจาก Match: { win, homeScore, awayScore, mvpName, scorers } */
  afterMatch(result, ctx) {
    const s = this.state;
    const summary = { exp: [], money: 0, fans: 0, msgs: [] };
    const starters = this.starters();

    if (result.win) { s.record.w++; s.morale = Math.min(100, s.morale + 8); }
    else { s.record.l++; s.morale = Math.max(0, s.morale - 6); }
    s.chem = Math.min(100, s.chem + (result.win ? 3 : 1));

    for (const p of starters) {
      const isMvp = result.mvpName === p.name;
      const exp = (result.win ? 40 : 18) + R.int(0, 10) + (isMvp ? 20 : 0);
      const ups = this.giveExp(p, exp);
      p.cond = Math.max(0, p.cond - R.int(12, 18));
      summary.exp.push({ p, exp, ups, isMvp });
    }

    if (ctx.kind === 'practice') {
      const oppPower = ctx.opponent.power;
      if (result.win) {
        summary.money = 400 + oppPower * 12;
        summary.fans = R.int(15, 40) + Math.floor(oppPower / 4);
      } else {
        summary.money = 150;
        summary.fans = R.int(3, 10);
      }
      s.money += summary.money;
      s.fans += summary.fans;
      this.pushLog(result.win
        ? `✅ ชนะนัดอุ่นเครื่องกับ ${ctx.opponent.name} ${result.homeScore}-${result.awayScore}`
        : `❌ แพ้นัดอุ่นเครื่องกับ ${ctx.opponent.name} ${result.homeScore}-${result.awayScore}`);
    } else if (ctx.kind === 'tour') {
      this.pushLog(result.win
        ? `✅ ชนะ ${ctx.opponent.name} ${result.homeScore}-${result.awayScore} (${ctx.roundName})`
        : `❌ แพ้ ${ctx.opponent.name} ${result.homeScore}-${result.awayScore} (${ctx.roundName})`);
    }
    this.save();
    return summary;
  },
};
