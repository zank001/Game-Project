/* systems.js — simulation systems. Each system is registered in
   S77.SYSTEMS with optional hooks: init(game) update(dt) onHour(h) onDay(d)
   save() load(data). Phase 2 (politics) plugs in by registering more systems
   and listening to S77.Events — nothing here needs to be rewritten. */
'use strict';
(function () {
  const U = S77.U, T = S77.T, O = S77.O, E = S77.Events;
  const SYSTEMS = (S77.SYSTEMS = []);
  S77.registerSystem = (sys) => { SYSTEMS.push(sys); return sys; };

  /* ======================= time & calendar ======================= */
  const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const FESTIVALS = { '11-24': 'เทศกาลลอยกระทง', '12-31': 'วันสิ้นปี', '1-1': 'วันขึ้นปีใหม่', '4-13': 'สงกรานต์', '4-14': 'สงกรานต์', '4-15': 'สงกรานต์', '2-14': 'วันวาเลนไทน์' };
  class GameTime {
    constructor() { this.total = 7 * 60; this.realSec = 0; this.rate = 1; this.paused = false; this.base = new Date(2026, 10, 1); }
    get day() { return Math.floor(this.total / 1440); }
    get minuteOfDay() { return this.total - this.day * 1440; }
    get hour() { return this.minuteOfDay / 60; }
    date() { const d = new Date(this.base); d.setDate(d.getDate() + this.day); return d; }
    month() { return this.date().getMonth() + 1; }
    isNight() { const h = this.hour; return h < 5.6 || h >= 18.9; }
    clock() { const m = Math.floor(this.minuteOfDay); return U.pad2(Math.floor(m / 60)) + ':' + U.pad2(m % 60); }
    dateStr(full) { const d = this.date(); return (full ? '' : TH_DAY[d.getDay()] + ' ') + d.getDate() + ' ' + (full ? TH_MONTH_FULL : TH_MONTH)[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
    season() { const m = this.month(); return m >= 3 && m <= 5 ? 'hot' : m >= 6 && m <= 10 ? 'rainy' : 'cool'; }
    seasonTh() { return { hot: 'ฤดูร้อน', rainy: 'ฤดูฝน', cool: 'ฤดูหนาว' }[this.season()]; }
    festival() { const d = this.date(); return FESTIVALS[d.getMonth() + 1 + '-' + d.getDate()] || null; }
    lighting() {
      const h = this.hour;
      const night = [62, 74, 138], dawn = [255, 196, 160], day = [255, 255, 255], eve = [255, 210, 168], dusk = [168, 120, 170];
      const lerp3 = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
      let c, dark;
      if (h < 4.6 || h >= 20) { c = night; dark = 1; }
      else if (h < 5.8) { const t = (h - 4.6) / 1.2; c = lerp3(night, dawn, t); dark = 1 - t * 0.7; }
      else if (h < 6.8) { const t = h - 5.8; c = lerp3(dawn, day, t); dark = 0.3 - t * 0.3; }
      else if (h < 16.5) { c = day; dark = 0; }
      else if (h < 18) { c = lerp3(day, eve, (h - 16.5) / 1.5); dark = 0; }
      else if (h < 19) { c = lerp3(eve, dusk, h - 18); dark = (h - 18) * 0.4; }
      else { c = lerp3(dusk, night, h - 19); dark = 0.4 + (h - 19) * 0.6; }
      return { r: c[0], g: c[1], b: c[2], dark, tint: c[0] < 255 || c[1] < 255 || c[2] < 255 };
    }
  }
  S77.GameTime = GameTime;

  /* ======================= weather ======================= */
  S77.registerSystem({
    id: 'weather',
    init(g) { g.weather = { rain: 0, rainTarget: 0, rainLeft: 0, haze: 0, mist: 0 }; },
    update(dt, g) {
      const w = g.weather;
      w.rain += (w.rainTarget - w.rain) * Math.min(1, dt * 0.5);
      const p = g.currentProv, h = g.time.hour, m = g.time.month();
      let haze = 0;
      if (p && g.provState[p.idx].issues.some((i) => i.id === 'haze')) haze = p.region === 'north' ? 1 : 0.5;
      w.haze += (haze - w.haze) * Math.min(1, dt * 0.3);
      const mist = p && (p.region === 'north' || p.key === 'loei') && (m >= 11 || m <= 2) && h > 4.5 && h < 8.5 ? 1 - Math.abs(h - 6.5) / 2 : 0;
      w.mist += (mist - w.mist) * Math.min(1, dt * 0.3);
    },
    onHour(h, g) {
      const w = g.weather, s = g.time.season();
      if (w.rainLeft > 0) { w.rainLeft--; if (w.rainLeft <= 0) w.rainTarget = 0; return; }
      const chance = s === 'rainy' ? (h >= 13 && h <= 19 ? 0.22 : 0.08) : s === 'hot' ? (h >= 15 && h <= 18 ? 0.06 : 0.01) : 0.012;
      const south = g.currentProv && g.currentProv.region === 'south';
      if (Math.random() < chance * (south ? 1.5 : 1)) { w.rainTarget = 0.5 + Math.random() * 0.5; w.rainLeft = 1 + ((Math.random() * 3) | 0); }
    },
    save(g) { return { rainTarget: g.weather.rainTarget, rainLeft: g.weather.rainLeft }; },
    load(d, g) { Object.assign(g.weather, d || {}); g.weather.rain = g.weather.rainTarget; },
  });

  /* ======================= player needs ======================= */
  S77.registerSystem({
    id: 'needs',
    update(dt, g) {
      const pl = g.player, mins = g.minutesThisFrame;
      if (!mins) return;
      const s = pl.stats;
      const move = pl.moving ? (pl.running ? 2.2 : 1.3) : 1;
      s.hunger = U.clamp(s.hunger - mins * 0.1, 0, 100);
      s.energy = U.clamp(s.energy - mins * 0.075 * (pl.riding ? 0.8 : move), 0, 100);
      let moodTarget = 55 + (s.hunger > 60 ? 6 : 0) - (s.hunger < 20 ? 15 : 0) - (s.energy < 15 ? 12 : 0);
      if (g.weather.rain > 0.3 && !pl.inv.umbrella && !g.indoors) moodTarget -= 10;
      s.mood += (moodTarget - s.mood) * Math.min(1, mins * 0.004);
      if (s.hunger <= 0 || s.energy <= 0) s.health = U.clamp(s.health - mins * 0.05, 0, 100);
      else if (s.hunger > 40 && s.energy > 30) s.health = U.clamp(s.health + mins * 0.01, 0, 100);
      if (s.energy <= 0 && !g.fainting) g.faint('energy');
      else if (s.health <= 0 && !g.fainting) g.faint('health');
    },
  });

  /* ======================= province simulation (Phase-2 foundation) ======================= */
  // Each province carries economic/social state + issues; daily tick nudges them.
  function initProvinceState(p) {
    const rnd = U.rng(U.hashStr(p.key));
    const econ = { 1: 1.55, 2: 1.15, 3: 0.95, 4: 0.85 }[p.tier] + (p.econ.indexOf('I') >= 0 ? 0.12 : 0) + (p.econ.indexOf('T') >= 0 ? 0.08 : 0) + (p.econ.indexOf('O') >= 0 ? 0.1 : 0);
    const base = (v) => U.clamp(v + (rnd() - 0.5) * 16, 15, 90);
    const st = {
      key: p.key, econ: +econ.toFixed(2), happiness: base(58), development: base(35 + (5 - p.tier) * 10), environment: base(62 - (p.econ.indexOf('I') >= 0 ? 14 : 0)),
      safety: base(60), education: base(45 + (5 - p.tier) * 6), health: base(52 + (5 - p.tier) * 5), unemployment: +(2 + rnd() * 3 + (p.tier === 4 ? 1.5 : 0)).toFixed(1),
      issues: [], priceMul: 1, history: [], governor: null, seats: 0,
    };
    st.wageMul = +(0.75 + econ * 0.32).toFixed(2);
    // permanent-ish structural issues
    const add = (id, sev) => st.issues.push({ id, sev, days: 999 });
    if (p.tier === 1) add('traffic', 0.8), add('costliving', 0.6);
    if (p.tier === 2 && rnd() < 0.5) add('traffic', 0.4);
    if (p.econ.indexOf('A') >= 0 && rnd() < 0.55) add('cropprice', 0.4 + rnd() * 0.3);
    if (p.tier === 4 && rnd() < 0.6) add('jobs', 0.5);
    if (p.econ.indexOf('F') >= 0 && rnd() < 0.4) add('fishery', 0.4);
    if (p.econ.indexOf('B') >= 0 && rnd() < 0.4) add('border', 0.35);
    if (p.econ.indexOf('I') >= 0 && rnd() < 0.5) add('environment', 0.45);
    if (rnd() < 0.3) add(U.pick(['roads', 'health', 'education'], rnd()), 0.3 + rnd() * 0.3);
    return st;
  }
  // seasonal issues by region/month
  function seasonalIssues(p, month) {
    const out = [];
    if (p.region === 'north' && month >= 1 && month <= 4) out.push(['haze', month >= 2 && month <= 3 ? 0.9 : 0.5]);
    if (p.key === 'bangkok' && (month === 1 || month === 2)) out.push(['haze', 0.4]);
    if (p.region === 'northeast' && month >= 3 && month <= 5) out.push(['drought', 0.7]);
    if ((p.region === 'central' || p.region === 'northeast' || p.region === 'north') && month >= 8 && month <= 10 && p.econ.indexOf('A') >= 0) out.push(['flood', month === 9 ? 0.7 : 0.45]);
    if (p.region === 'south' && (month === 11 || month === 12) && p.econ.indexOf('A') >= 0) out.push(['flood', 0.5]);
    if (p.econ.indexOf('T') >= 0) out.push(month >= 11 || month <= 2 ? ['tourism_up', 0.4] : month >= 6 && month <= 9 ? ['tourism_down', 0.5] : null);
    return out.filter(Boolean);
  }
  S77.registerSystem({
    id: 'provinces',
    init(g) {
      g.provState = S77.PROVINCES.map(initProvinceState);
      // seats: largest remainder over population (Phase 2: constituency elections)
      const tot = S77.PROVINCES.reduce((a, p) => a + p.pop, 0), q = tot / S77.TOTAL_SEATS;
      const raw = S77.PROVINCES.map((p) => p.pop / q), seats = raw.map((r) => Math.max(1, Math.floor(r)));
      let left = S77.TOTAL_SEATS - seats.reduce((a, b) => a + b, 0);
      raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { seats[i]++; left--; } });
      g.provState.forEach((s, i) => (s.seats = seats[i]));
      this.refreshSeasonal(g);
    },
    refreshSeasonal(g) {
      const m = g.time.month();
      S77.PROVINCES.forEach((p, i) => {
        const st = g.provState[i];
        st.issues = st.issues.filter((x) => x.days >= 999);
        for (const [id, sev] of seasonalIssues(p, m)) st.issues.push({ id, sev, days: 30 });
        st.issues.sort((a, b) => b.sev - a.sev);
      });
    },
    onDay(d, g) {
      this.refreshSeasonal(g);
      for (const st of g.provState) {
        const pressure = st.issues.reduce((a, x) => a + x.sev, 0);
        const target = 66 - pressure * 9 + (st.econ - 1) * 10;
        st.happiness = U.clamp(st.happiness + (target - st.happiness) * 0.05 + (Math.random() - 0.5) * 1.5, 5, 95);
        st.priceMul = U.clamp(st.priceMul + (Math.random() - 0.5) * 0.04, 0.85, 1.2);
        st.history.push(Math.round(st.happiness)); if (st.history.length > 60) st.history.shift();
      }
      E.emit('provinceTick', { day: d });
    },
    save(g) { return g.provState.map((s) => ({ happiness: s.happiness, priceMul: s.priceMul, history: s.history, development: s.development })); },
    load(d, g) { if (Array.isArray(d)) d.forEach((s, i) => Object.assign(g.provState[i], s)); this.refreshSeasonal(g); },
  });
  // popularity of the (fictional) parties in a province, derived from its people — shown as a Phase-2 preview
  S77.partySupport = function (g, pi) {
    const p = S77.PROVINCES[pi], st = g.provState[pi];
    const rural = p.tier >= 3 ? 1 : p.tier === 2 ? 0.5 : 0;
    const v = { econ: -0.2 * rural + 0.25 * (1 - rural), social: (st.education - 50) / 80 - 0.1 * rural, local: p.key === 'bangkok' ? -0.1 : 0.25 };
    const sc = S77.PARTIES.map((pt) => { const d = Math.hypot(pt.econ - v.econ, pt.social - v.social, (pt.local - v.local) * 0.7); return Math.exp(-d * 2.2) * (0.8 + U.hash2(pi, pt.id.length, 3) * 0.4); });
    const s = sc.reduce((a, b) => a + b, 0);
    return S77.PARTIES.map((pt, i) => ({ party: pt, share: sc[i] / s }));
  };

  /* ======================= economy helpers ======================= */
  const tileDist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  S77.Econ = {
    // price of an item when BUYING in province pi
    buyPrice(g, id, pi) {
      const it = S77.ITEMS[id], st = g.provState[pi];
      let p = it.price * (it.kind === 'vehicle' || it.kind === 'tool' ? 1 : 0.85 + st.econ * 0.15) * (it.kind === 'food' || it.kind === 'drink' ? st.priceMul : 1);
      if (it.prov && S77.PROV_BY_KEY[it.prov].idx === pi) p *= 0.85;
      else if (it.prov) p *= 1 + tileDist(g.world.towns[S77.PROV_BY_KEY[it.prov].idx], g.world.towns[pi]) / 700;
      return Math.max(1, Math.round(p));
    },
    // what a market in province pi pays for an item
    sellPrice(g, id, pi) {
      const it = S77.ITEMS[id], st = g.provState[pi];
      let p = it.price * 0.62 * st.priceMul * (0.8 + st.econ * 0.2);
      if (it.prov) {
        const src = S77.PROV_BY_KEY[it.prov].idx;
        if (src === pi) p = it.price * 0.55;
        else p = it.price * 0.75 * (1 + Math.min(1.6, tileDist(g.world.towns[src], g.world.towns[pi]) / 520)) * st.priceMul;
      }
      return Math.max(1, Math.round(p));
    },
    wage(g, job, pi) {
      const J = S77.JOBS[job], st = g.provState[pi], sk = J.skill ? g.player.skills[J.skill] || 0 : 0;
      return Math.round(J.pay * st.wageMul * (1 + sk * 0.012));
    },
    lodging(g, pi) { const p = S77.PROVINCES[pi]; return { 1: 900, 2: 550, 3: 380, 4: 280 }[p.tier]; },
    housePrice(g, pi) { const p = S77.PROVINCES[pi]; return { 1: 2500000, 2: 900000, 3: 550000, 4: 380000 }[p.tier]; },
  };

  /* ======================= NPCs ======================= */
  const OUTFITS = {
    farmer: (r, f) => ({ top: 'collar', topC: 8, bottom: f && r() < 0.5 ? 'sarong' : 'pants', bottomC: 7, hat: r() < 0.7 ? 'ngob' : 'none' }),
    vendor: (r, f) => ({ top: 'tee', topC: r.int(0, 5), bottom: f ? 'sarong' : 'pants', bottomC: r.int(7, 9), apron: true }),
    student: (r, f) => ({ top: 'collar', topC: 6, bottom: f ? 'skirt' : 'shorts', bottomC: 8 }),
    office: (r, f) => ({ top: 'collar', topC: r() < 0.5 ? 6 : 11, bottom: f && r() < 0.5 ? 'skirt' : 'pants', bottomC: 7 }),
    official: (r, f) => ({ top: 'uniform', topC: 13, bottom: f && r() < 0.4 ? 'skirt' : 'pants', bottomC: 13 }),
    monk: () => ({ top: 'robe', topC: 10, bottom: 'sarong', bottomC: 10, hair: 'bald', kind: 'monk' }),
    fisher: (r) => ({ top: 'tank', topC: r.int(0, 11), bottom: 'shorts', bottomC: 7, hat: r() < 0.5 ? 'cap' : 'none', hatC: r.int(0, 5) }),
    driver: (r) => ({ top: 'tee', topC: 7, vest: true, bottom: 'pants', bottomC: 7, hat: r() < 0.4 ? 'helmet' : 'none', hatC: 1 }),
    elder: (r, f) => ({ top: 'collar', topC: r.pick([6, 13, 3]), bottom: f ? 'sarong' : 'pants', bottomC: r.pick([9, 7]), hairC: r() < 0.6 ? 5 : 6 }),
    nurse: () => ({ top: 'dress', topC: 6, bottom: 'skirt', bottomC: 6, hat: 'nurse' }),
    police: () => ({ top: 'uniform', topC: 12, bottom: 'pants', bottomC: 12, hat: 'police' }),
    tourist: (r) => ({ top: 'tee', topC: r.int(0, 11), bottom: 'shorts', bottomC: r.int(0, 13), hat: r() < 0.5 ? 'sunhat' : 'none', bag: true, skin: r() < 0.5 ? 0 : undefined, hairC: r() < 0.5 ? 4 : undefined }),
    worker: (r) => ({ top: 'collar', topC: 1, bottom: 'pants', bottomC: 8, hat: r() < 0.5 ? 'cap' : 'none', hatC: 1 }),
    kid: (r, f) => ({ top: 'tee', topC: r.int(0, 11), bottom: f ? 'skirt' : 'shorts', bottomC: r.int(0, 9), kind: 'kid' }),
    imam: () => ({ top: 'robe', topC: 6, bottom: 'sarong', bottomC: 6, hat: 'kopiah' }),
  };
  function makeLook(r, occ, female, muslim) {
    const out = (OUTFITS[S77.OCCUPATIONS[occ].outfit] || OUTFITS.vendor)(r, female);
    const look = Object.assign({ skin: r.int(0, 3), hair: female ? r.pick(['long', 'bob', 'pony', 'bun']) : r.pick(['short', 'short', 'spiky']), hairC: r() < 0.85 ? 0 : r.int(1, 3), top: 'tee', topC: 1, bottom: 'pants', bottomC: 7, hat: 'none' }, out);
    if (muslim && female && occ !== 'nurse') { look.hat = 'hijab'; look.hatC = r.int(0, 11); }
    if (muslim && !female && r() < 0.4 && look.hat === 'none') look.hat = 'kopiah';
    return look;
  }
  function makeName(r, female, muslim) {
    const N = S77.NAMES;
    const first = muslim ? r.pick(female ? N.mFemale : N.mMale) : r.pick(female ? N.female : N.male);
    const last = muslim ? r.pick(N.mSur) : r.pick(N.surA) + r.pick(N.surB);
    return { first, last, nick: r.pick(N.nick) };
  }
  const honor = (n) => {
    if (n.occ === 'monk') return 'หลวงพี่' + n.nick;
    if (n.occ === 'governor') return 'ท่านผู้ว่าฯ ' + n.first;
    if (n.occ === 'headman') return 'ผู้ใหญ่' + n.first;
    if (n.occ === 'imam') return 'โต๊ะอิหม่าม' + n.first;
    if (n.age >= 65) return (n.female ? 'ยาย' : 'ตา') + n.nick;
    if (n.age >= 45) return (n.female ? 'ป้า' : 'ลุง') + n.nick;
    if (n.age < 14) return 'น้อง' + n.nick;
    return 'พี่' + n.nick;
  };
  S77.registerSystem({
    id: 'npcs',
    init(g) {
      g.npcs = []; g.animals = []; g.npcMem = g.npcMem || {};
      this.loadedZones = new Map(); // zone -> {npcs, animals}
      this.pathBudget = 0;
    },
    // deterministic population for a town (prov idx) or village (100+id)
    populate(g, z) {
      const w = g.world, r = U.rng(z * 7919 + 13);
      const npcs = [], animals = [];
      let center, buildings, prov, count, occs, village = null;
      if (z < 100) {
        const t = w.towns[z - 1]; prov = t.prov; center = [t.cx, t.cy]; buildings = t.buildings.map((id) => w.buildings[id]);
        count = { 1: 46, 2: 26, 3: 18, 4: 13 }[prov.tier];
        occs = ['vendor', 'vendor', 'office', 'student', 'student', 'elder', 'driver', 'official', 'kid', 'farmer', 'teacher', 'nurse', 'police', 'cook', 'worker', 'monk'];
        if (prov.econ.indexOf('T') >= 0) occs.push('tourist', 'tourist');
        if (prov.econ.indexOf('F') >= 0) occs.push('fisher');
        if (prov.tier === 1) occs.push('office', 'office', 'tourist', 'driver');
      } else {
        village = w.villages[z - 100]; prov = S77.PROVINCES[village.prov]; center = [village.x, village.y]; buildings = village.buildings.map((id) => w.buildings[id]);
        count = 2 + r.int(1, 3);
        occs = prov.region === 'south' ? ['tapper', 'tapper', 'elder', 'kid', 'farmer'] : ['farmer', 'farmer', 'elder', 'kid', 'vendor'];
        if (prov.econ.indexOf('F') >= 0) occs.push('fisher');
      }
      const homes = buildings.filter((b) => b.type === 'house' || b.type === 'shophouse' || b.type === 'condo' || b.type === 'forsale');
      const provIssues = g.provState ? g.provState[prov.idx].issues.map((x) => x.id) : [];
      const byType = (t) => buildings.find((b) => b.type === t);
      const workFor = (occ) => {
        const m = { vendor: 'market', cook: 'restaurant', office: 'jobcenter', official: 'hall', student: 'school', teacher: 'school', nurse: 'hospital', police: 'police', monk: 'temple', worker: 'factory', imam: 'mosque', tourist: 'landmark', driver: 'bus' };
        return byType(m[occ]) || byType('market') || buildings[0];
      };
      const mk = (occ, idx, extra) => {
        const muslim = prov.muslim && (occ === 'imam' || r() < 0.75) && occ !== 'monk';
        const female = occ === 'monk' || occ === 'governor' || occ === 'headman' || occ === 'imam' ? r() < 0.15 && occ === 'governor' : occ === 'nurse' ? r() < 0.85 : occ === 'cook' || occ === 'vendor' ? r() < 0.7 : r() < 0.5;
        const nm = makeName(r, female, muslim && occ !== 'monk');
        const age = occ === 'kid' ? r.int(6, 12) : occ === 'student' ? r.int(13, 18) : occ === 'elder' ? r.int(65, 85) : occ === 'governor' ? r.int(50, 59) : r.int(20, 62);
        const home = homes.length ? homes[idx % homes.length] : buildings[0];
        const work = occ === 'farmer' || occ === 'tapper' || occ === 'elder' || occ === 'kid' || occ === 'headman' ? null : workFor(occ);
        const n = Object.assign({
          id: (z < 100 ? 't' : 'v') + z + '-' + idx, z, prov: prov.idx, occ, female, age, muslim, dialect: prov.dialect,
          first: nm.first, last: nm.last, nick: nm.nick, look: makeLook(r, occ === 'governor' || occ === 'headman' || occ === 'teacher' ? 'official' : occ, female, muslim),
          home: home ? home.id : null, work: work ? work.id : null, friendly: 0.3 + r() * 0.7,
          // Phase 2: political profile (axes in [-1,1]) and the issue they care most about
          politics: { econ: +(r() * 2 - 1).toFixed(2), social: +(r() * 2 - 1).toFixed(2), local: +(r() * 2 - 1).toFixed(2), turnout: +(0.4 + r() * 0.6).toFixed(2), issue: provIssues.length && r() < 0.7 ? r.pick(provIssues) : r.pick(['costliving', 'education', 'health', 'roads', 'jobs']) },
          center, village: village ? village.id : null, wanderR: z < 100 ? 6 : 4,
        }, extra || {});
        if (occ === 'kid') n.look.kind = 'kid';
        n.name = honor(n);
        return n;
      };
      let idx = 0;
      if (z < 100) {
        npcs.push(mk('governor', idx++, { work: byType('hall') && byType('hall').id }));
        if (prov.muslim && byType('mosque')) npcs.push(mk('imam', idx++));
      } else npcs.push(mk('headman', idx++));
      while (npcs.length < count) npcs.push(mk(r.pick(occs), idx++));
      // animals
      const nd = z < 100 ? 3 : 1;
      for (let k = 0; k < nd; k++) animals.push({ id: 'a' + z + '-' + k, kind: 'animal', species: 'dog', color: r.int(0, 3), home: center.slice(), wanderR: z < 100 ? 10 : 5 });
      if (z >= 100) {
        animals.push({ id: 'c' + z, kind: 'animal', species: 'chicken', color: r.int(0, 1), home: center.slice(), wanderR: 3 });
        // buffalo in a nearby paddy
        for (let k = 0; k < 40; k++) {
          const x = center[0] + r.int(-9, 9), y = center[1] + r.int(-9, 9);
          if (w.terrain(x, y) === T.PADDY) { animals.push({ id: 'b' + z, kind: 'animal', species: 'buffalo', home: [x, y], wanderR: 3, shadow: 11 }); break; }
        }
      }
      return { npcs, animals };
    },
    spawn(g, n) {
      const w = g.world, home = n.home !== null ? w.buildings[n.home] : null;
      const sp = this.scheduleSpot(g, n) || (home && home.door ? [home.door.x, home.door.y] : n.center);
      const [x, y] = w.nearestWalkable(Math.round(sp[0]), Math.round(sp[1]), 8);
      return Object.assign(n, { kind: 'npc', x: x + 0.5, y: y + 0.5, path: null, pi: 0, moving: false, anim: 0, faceLeft: false, faceBack: false, wait: Math.random() * 3, hidden: false, target: null, mem: g.npcMem[n.id] || (g.npcMem[n.id] = { f: 0, met: 0, lastTalk: -1 }) });
    },
    // where should this NPC be right now?
    scheduleSpot(g, n) {
      const w = g.world, h = g.time.hour;
      const B = (id) => (id !== null && id !== undefined ? w.buildings[id] : null);
      const door = (b) => (b && b.door ? [b.door.x, b.door.y] : null);
      const home = B(n.home), work = B(n.work);
      if (n.occ === 'tourist') return h >= 8 && h < 21 ? door(work) || n.center : door(home) || n.center;
      if (h < 5.5 || h >= 21) return { inside: door(home) || n.center };
      if (n.occ === 'monk' && h < 8) return n.center; // morning alms round
      if (n.occ === 'tapper' && h < 8) return n.center;
      const working = (n.occ === 'student' || n.occ === 'teacher') ? h >= 7.5 && h < 15.5 : h >= 8 && h < 17;
      if (working && work) return door(work);
      if (working && (n.occ === 'farmer' || n.occ === 'headman' || n.occ === 'tapper')) return n.field || (n.field = this.findNear(g, n.center, n.occ === 'tapper' ? T.PLANT : T.PADDY, 10) || n.center);
      if (h >= 17 && h < 20.5) return n.occ === 'kid' || n.occ === 'elder' || U.hash2(n.id.length, g.time.day, 3) < 0.5 ? n.center : door(home) || n.center;
      return door(home) || n.center;
    },
    findNear(g, c, t, r) {
      for (let k = 0; k < 30; k++) { const x = c[0] + ((Math.random() * 2 - 1) * r) | 0, y = c[1] + ((Math.random() * 2 - 1) * r) | 0; if (g.world.terrain(x, y) === t) return [x, y]; }
      return null;
    },
    update(dt, g) {
      const w = g.world, pl = g.player;
      // load / unload zones near the player (towns & villages within ~40 tiles)
      if ((this.zt = (this.zt || 0) - dt) <= 0) {
        this.zt = 0.7;
        const want = new Set();
        for (const t of w.towns) if (Math.hypot(t.cx - pl.x, t.cy - pl.y) < t.R + 34) want.add(t.idx + 1);
        const vc = 46;
        for (const v of w.villages) if (Math.abs(v.x - pl.x) < vc && Math.abs(v.y - pl.y) < vc) want.add(100 + v.id);
        for (const z of [...this.loadedZones.keys()]) if (!want.has(z)) this.loadedZones.delete(z);
        for (const z of want) if (!this.loadedZones.has(z)) {
          const pop = this.populate(g, z);
          pop.npcs.forEach((n) => this.spawn(g, n));
          pop.animals.forEach((a) => { const [x, y] = w.nearestWalkable(a.home[0], a.home[1], 6); Object.assign(a, { x: x + 0.5, y: y + 0.5, moving: false, wait: Math.random() * 4, faceLeft: false }); });
          this.loadedZones.set(z, pop);
        }
        g.npcs = []; g.animals = [];
        for (const pop of this.loadedZones.values()) { g.npcs.push(...pop.npcs); g.animals.push(...pop.animals); }
      }
      this.pathBudget = 3;
      for (const n of g.npcs) this.stepNpc(g, n, dt);
      for (const a of g.animals) this.stepAnimal(g, a, dt);
    },
    stepNpc(g, n, dt) {
      const w = g.world;
      if (g.talkingTo === n) { n.moving = false; return; }
      n.wait -= dt;
      if (n.path && n.pi < n.path.length) {
        const [tx, ty] = n.path[n.pi], dx = tx + 0.5 - n.x, dy = ty + 0.5 - n.y, d = Math.hypot(dx, dy);
        const sp = (n.occ === 'kid' ? 2.0 : n.age > 64 ? 1.1 : 1.5) * dt * Math.min(g.timeScale || 1, 8);
        if (d <= sp) { n.x = tx + 0.5; n.y = ty + 0.5; n.pi++; }
        else { n.x += (dx / d) * sp; n.y += (dy / d) * sp; }
        n.moving = true; n.anim += dt;
        const sdx = dx - dy, sdy = dx + dy;
        if (Math.abs(sdx) > 0.05) n.faceLeft = sdx < 0;
        n.faceBack = sdy < 0;
        if (n.pi >= n.path.length) { n.path = null; n.moving = false; n.wait = 1 + Math.random() * 4; if (n.goInside) { n.hidden = true; } }
        return;
      }
      n.moving = false;
      if (n.wait > 0) return;
      const spot = this.scheduleSpot(g, n);
      let target, inside = false;
      if (spot && spot.inside) { target = spot.inside; inside = true; } else target = spot || n.center;
      if (n.hidden) {
        if (inside) { n.wait = 5; return; }
        n.hidden = false; // come out of the door
      }
      const far = Math.hypot(target[0] + 0.5 - n.x, target[1] + 0.5 - n.y);
      let goal = target;
      if (!inside && far < 3) {
        // idle wander around the spot
        goal = [target[0] + ((Math.random() * 2 - 1) * 3) | 0, target[1] + ((Math.random() * 2 - 1) * 3) | 0];
        if (w.blockedTile(goal[0], goal[1])) { n.wait = 1 + Math.random() * 3; return; }
      }
      if (far > 60) { // too far: teleport (off-screen relocation)
        const [x, y] = w.nearestWalkable(target[0], target[1], 6); n.x = x + 0.5; n.y = y + 0.5; n.hidden = inside; n.wait = 3; return;
      }
      if (this.pathBudget <= 0) { n.wait = 0.2 + Math.random() * 0.5; return; }
      this.pathBudget--;
      const path = S77.findPath(w, Math.floor(n.x), Math.floor(n.y), goal[0], goal[1], 70);
      if (path && path.length) { n.path = path; n.pi = 0; n.goInside = inside; }
      else n.wait = 2 + Math.random() * 4;
    },
    stepAnimal(g, a, dt) {
      const w = g.world;
      a.wait -= dt;
      if (a.tx !== undefined) {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = (a.species === 'buffalo' ? 0.5 : a.species === 'chicken' ? 1.2 : 1.8) * dt;
        if (d < sp) { a.tx = undefined; a.moving = false; a.wait = 1 + Math.random() * 5; return; }
        const nx = a.x + (dx / d) * sp, ny = a.y + (dy / d) * sp;
        if (w.blockedTile(Math.floor(nx), Math.floor(ny))) { a.tx = undefined; a.moving = false; a.wait = 1; return; }
        a.x = nx; a.y = ny; a.moving = true; a.faceLeft = dx - dy < 0;
        return;
      }
      if (a.wait > 0) return;
      a.tx = a.home[0] + 0.5 + (Math.random() * 2 - 1) * a.wanderR; a.ty = a.home[1] + 0.5 + (Math.random() * 2 - 1) * a.wanderR;
    },
    save(g) { return g.npcMem; },
    load(d, g) { g.npcMem = d || {}; this.loadedZones.clear(); },
  });

  // tile A* (8-neighbour, no corner cutting) within a window around start
  S77.findPath = function (w, sx, sy, tx, ty, maxR) {
    if (sx === tx && sy === ty) return [];
    const R = maxR || 60, x0 = Math.max(0, Math.min(sx, tx) - 12), y0 = Math.max(0, Math.min(sy, ty) - 12);
    const x1 = Math.min(w.W - 1, Math.max(sx, tx) + 12), y1 = Math.min(w.H - 1, Math.max(sy, ty) + 12);
    if (x1 - x0 > R * 2 || y1 - y0 > R * 2) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, n = bw * bh;
    const g = new Float32Array(n).fill(Infinity), par = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const blocked = (x, y) => w.blockedTile(x, y);
    if (blocked(tx, ty)) { // door tiles etc. are fine; otherwise step to a free neighbour
      let ok = false;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (!blocked(tx + dx, ty + dy)) { tx += dx; ty += dy; ok = true; break; }
      if (!ok) return null;
    }
    const heap = new S77.Heap(), id = (x, y) => (y - y0) * bw + (x - x0);
    const s = id(sx, sy); g[s] = 0; heap.push(s, 0);
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    let goal = -1, it = 0;
    while (heap.size && it++ < 6000) {
      const c = heap.pop();
      if (closed[c]) continue; closed[c] = 1;
      const cx = (c % bw) + x0, cy = ((c / bw) | 0) + y0;
      if (cx === tx && cy === ty) { goal = c; break; }
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || blocked(nx, ny)) continue;
        if (k >= 4 && (blocked(cx + DX[k], cy) || blocked(cx, cy + DY[k]))) continue;
        const ni = id(nx, ny), oi = ny * w.W + nx;
        const cost = (k >= 4 ? 1.414 : 1) * (S77.OBJ_BLOCK[w.obj[oi]] === 1 ? 2.5 : S77.isPaved(w.ter[oi]) ? 0.85 : 1);
        const ng = g[c] + cost;
        if (ng < g[ni]) { g[ni] = ng; par[ni] = c; heap.push(ni, ng + Math.hypot(nx - tx, ny - ty)); }
      }
    }
    if (goal < 0) return null;
    const out = [];
    for (let c = goal; c >= 0 && c !== s; c = par[c]) out.push([(c % bw) + x0, ((c / bw) | 0) + y0]);
    return out.reverse();
  };

  /* ======================= dialogue ======================= */
  S77.Talk = {
    fill(g, s, n) {
      const p = S77.PROVINCES[n.prov], st = g.provState[n.prov], is = st.issues[0];
      const v = n.village !== null ? g.world.villages[n.village] : null;
      return s.replace(/\{prov\}/g, p.th).replace(/\{dish\}/g, p.dish).replace(/\{good\}/g, p.good).replace(/\{lm\}/g, p.landmark)
        .replace(/\{nick\}/g, n.nick).replace(/\{player\}/g, g.player.name).replace(/\{issue\}/g, is ? S77.ISSUES[is.id].th : 'ค่าครองชีพ')
        .replace(/\{issueLine\}/g, is ? S77.ISSUES[is.id].line : S77.ISSUES.costliving.line).replace(/\{village\}/g, v ? v.name : p.th).replace(/\{season\}/g, g.time.seasonTh());
    },
    greet(g, n) {
      const D = S77.DIALOGUE, r = Math.random();
      if (n.mem.f >= 25 && r < 0.5) return this.fill(g, U.pick(D.friend), n);
      if (n.muslim && r < 0.6) return U.pick(D.greet.deepsouth);
      return U.pick(D.greet[n.dialect] || D.greet.central);
    },
    chat(g, n) {
      const D = S77.DIALOGUE, pool = [];
      (D.occ[n.occ] || []).forEach((l) => pool.push(l, l));
      D.prov.forEach((l) => pool.push(l));
      (D.provDialect[n.dialect] || []).forEach((l) => pool.push(l, l));
      if (g.weather.rain > 0.3) pool.push(...D.weather.rain);
      else if (g.time.isNight()) pool.push(...D.weather.night);
      else if (g.time.season() === 'hot') pool.push(...D.weather.hot);
      else if (g.time.season() === 'cool') pool.push(...D.weather.cool);
      if (g.provState[n.prov].issues.length && n.age >= 18) pool.push(...D.issue);
      if (n.age >= 18 && Math.random() < 0.25) pool.push(...D.phase2);
      const fest = g.time.festival();
      if (fest) pool.push('สุขสันต์' + fest + 'นะ!', fest + 'ปีนี้คึกคักกว่าทุกปีเลย');
      return this.fill(g, U.pick(pool), n);
    },
    aboutProvince(g, n) {
      const p = S77.PROVINCES[n.prov], st = g.provState[n.prov];
      const lines = [this.fill(g, U.pick(S77.DIALOGUE.prov), n), `ของขึ้นชื่อที่นี่คือ "${p.good}" ส่วนอาหารต้องลอง "${p.dish}"`, `ที่เที่ยวสำคัญคือ${p.landmark} อยู่แถวใจกลางเมือง`];
      if (st.issues.length) lines.push(this.fill(g, '{issueLine}', n));
      return U.pick(lines);
    },
  };

  /* ======================= quests ======================= */
  S77.registerSystem({
    id: 'quests',
    init(g) { g.quests = g.quests || []; g.questSeq = g.questSeq || 1; },
    offer(g, n) {
      if (n.mem.quest) return null;
      if (g.quests.filter((q) => !q.done).length >= 5) return 'full';
      const tpl = U.pick(S77.QUEST_TEMPLATES);
      const here = g.world.towns[n.prov];
      const cands = S77.PROVINCES.filter((p) => { const d = Math.hypot(g.world.towns[p.idx].cx - here.cx, g.world.towns[p.idx].cy - here.cy); return p.idx !== n.prov && d > 40 && d < 420; });
      const tp = U.pick(cands.length ? cands : S77.PROVINCES);
      const reward = Math.round(U.rnd(tpl.reward[0], tpl.reward[1]) / 10) * 10;
      const q = { id: g.questSeq++, type: tpl.type, title: tpl.th, giver: n.id, giverName: n.name, giverProv: n.prov, target: tp.idx, reward, rep: tpl.rep, done: false, started: g.time.day };
      if (q.type === 'fetch') q.item = 'good_' + tp.key;
      q.text = tpl.text.replace('{target}', tp.th).replace('{item}', tp.good).replace('{lm}', tp.landmark);
      if (q.type === 'deliver') g.addItem('parcel_' + q.id, 1, { th: 'ห่อของฝากถึง' + tp.th, kind: 'quest', price: 0, icon: '📦' });
      return q;
    },
    accept(g, q, n) { g.quests.push(q); n.mem.quest = q.id; E.emit('questStart', q); },
    complete(g, q) {
      q.done = true; q.doneDay = g.time.day;
      g.earn(q.reward, 'รางวัลภารกิจ');
      g.addRep(q.giverProv, q.rep); if (q.target !== q.giverProv) g.addRep(q.target, 1);
      const m = g.npcMem[q.giver]; if (m) { m.quest = null; m.f = Math.min(100, m.f + 10); }
      g.player.counters.quests = (g.player.counters.quests || 0) + 1;
      E.emit('questDone', q);
      S77.UI.toast('✅ ภารกิจสำเร็จ: ' + q.title + ' +' + U.fmtMoney(q.reward), 'good');
    },
    save(g) { return { quests: g.quests, seq: g.questSeq }; },
    load(d, g) { g.quests = (d && d.quests) || []; g.questSeq = (d && d.seq) || 1; },
  });

  /* ======================= travel graph ======================= */
  S77.Travel = {
    kmBetween(g, a, b) { const A = g.world.towns[a], B = g.world.towns[b]; return Math.round(Math.hypot(A.cx - B.cx, A.cy - B.cy) * 0.92 * 1.25); },
    options(g, mode, from) {
      const out = [];
      if (mode === 'rail') {
        // BFS over rail lines
        const adj = {};
        for (const l of S77.RAIL_LINES) for (let i = 0; i < l.length - 1; i++) { (adj[l[i]] = adj[l[i]] || []).push(l[i + 1]); (adj[l[i + 1]] = adj[l[i + 1]] || []).push(l[i]); }
        const start = S77.PROVINCES[from].key, seen = new Set([start]), q = [start];
        while (q.length) { const k = q.shift(); for (const n of adj[k] || []) if (!seen.has(n)) { seen.add(n); q.push(n); } }
        seen.delete(start);
        for (const k of seen) { const p = S77.PROV_BY_KEY[k], km = this.kmBetween(g, from, p.idx); out.push({ to: p.idx, km, price: Math.round(40 + km * 0.42), hours: +(km / 48 + 0.5).toFixed(1) }); }
      } else if (mode === 'air') {
        for (const p of S77.PROVINCES) if (p.airport && p.idx !== from) { const km = this.kmBetween(g, from, p.idx); out.push({ to: p.idx, km, price: Math.round(950 + km * 1.3), hours: +(1.5 + km / 650).toFixed(1) }); }
      } else {
        for (const p of S77.PROVINCES) if (p.idx !== from) { const km = this.kmBetween(g, from, p.idx); out.push({ to: p.idx, km, price: Math.round(60 + km * 0.85), hours: +(km / 62 + 0.4).toFixed(1) }); }
      }
      return out.sort((a, b) => a.km - b.km);
    },
    arrivalSpot(g, to, mode) {
      const t = g.world.towns[to];
      const bid = mode === 'air' ? t.airport : mode === 'rail' ? (t.train !== undefined ? t.train : t.bus) : t.bus;
      const b = bid !== undefined ? g.world.buildings[bid] : null;
      if (b && b.door) return [b.door.x, b.door.y];
      return [t.cx, t.cy];
    },
  };
})();
