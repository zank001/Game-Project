/* =============================================================
   logic.js — pure game logic for "ลิขิตหงส์ · วังหลังต้าชิง"
   No DOM. Runs in the browser AND in Node (vm) for validation / bots.
   Depends on core_data.js (global Q) and content files (Q.add).
   The UI (engine.js) is a thin layer over this API.  See docs/DESIGN.md.
   ============================================================= */
var QL = (function () {
  'use strict';
  var G = (typeof globalThis !== 'undefined') ? globalThis : window;
  var Q = G.Q;
  var C = Q.CONST;
  var EV = {};
  var ACT = {};
  var strict = false;           // validator sets true → cond errors throw

  function reindex() {
    EV = {}; ACT = {};
    Q.events.forEach(function (e) { EV[e.id] = e; });
    Q.ACTIONS.forEach(function (a) { ACT[a.id] = a; });
  }
  function warn() { if (!strict && typeof console !== 'undefined') console.warn.apply(console, arguments); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- RNG (mulberry32, seed lives in state) ---------------- */
  function rnd(st) {
    var t = (st.seed = (st.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function ri(st, a, b) { return a + Math.floor(rnd(st) * (b - a + 1)); }

  /* ---------------- tiny expression language (CSP-safe, no eval) ----------------
     Supports: numbers 'strings' true/false/null, identifiers, a.b a['b'],
     ! - + * / %  < <= > >= == != === !==  && || ??  ?:  ( )  and min/max/abs/floor().
     Variables: S F R rank sir season year t age origin                          */
  function tokenize(src) {
    var toks = [], i = 0, n = src.length, c, j;
    while (i < n) {
      c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        j = i; while (j < n && /[0-9.]/.test(src[j])) j++;
        toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
        toks.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
      }
      if (c === "'" || c === '"') {
        var q = c, s = ''; j = i + 1;
        while (j < n && src[j] !== q) { if (src[j] === '\\' && j + 1 < n) j++; s += src[j]; j++; }
        if (j >= n) throw new Error('unterminated string in: ' + src);
        toks.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '===' || three === '!==') { toks.push({ t: 'op', v: three }); i += 3; continue; }
      if (['&&', '||', '==', '!=', '<=', '>=', '??'].indexOf(two) >= 0) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/%<>!().[]?:,'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('bad character "' + c + '" in: ' + src);
    }
    return toks;
  }
  var BINPREC = { '||': 1, '??': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
  var FUNCS = { min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor };
  function parse(src) {
    var toks = tokenize(src), p = 0;
    function isOp(v) { var t = toks[p]; return !!t && t.t === 'op' && t.v === v; }
    function expect(v) { if (!isOp(v)) throw new Error('expected "' + v + '" in: ' + src); p++; }
    function primary() {
      var t = toks[p++];
      if (!t) throw new Error('unexpected end in: ' + src);
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'str') return { k: 'str', v: t.v };
      if (t.t === 'id') return { k: 'id', v: t.v };
      if (t.t === 'op' && t.v === '(') { var e = expr(0); expect(')'); return e; }
      throw new Error('unexpected "' + t.v + '" in: ' + src);
    }
    function postfix() {
      var n = primary();
      for (;;) {
        if (isOp('.')) { p++; var id = toks[p++]; if (!id || id.t !== 'id') throw new Error('bad member in: ' + src); n = { k: 'mem', o: n, p: id.v, c: false }; }
        else if (isOp('[')) { p++; var e = expr(0); expect(']'); n = { k: 'mem', o: n, p: e, c: true }; }
        else if (isOp('(')) {
          if (n.k !== 'id' || !FUNCS[n.v]) throw new Error('unknown function in: ' + src);
          p++; var args = [];
          if (!isOp(')')) { do { args.push(expr(0)); } while (isOp(',') && p++); }
          expect(')'); n = { k: 'call', f: n.v, args: args };
        } else break;
      }
      return n;
    }
    function unary() {
      if (isOp('!') || isOp('-') || isOp('+')) { var op = toks[p++].v; return { k: 'un', op: op, a: unary() }; }
      return postfix();
    }
    function expr(minPrec) {
      var left = unary();
      for (;;) {
        var t = toks[p];
        if (!t || t.t !== 'op') break;
        if (t.v === '?' && minPrec <= 0) {
          p++; var a = expr(0); expect(':'); var b = expr(0);
          left = { k: 'cond', c: left, a: a, b: b }; continue;
        }
        var pr = BINPREC[t.v];
        if (pr === undefined || pr < minPrec) break;
        p++;
        var right = expr(pr + 1);
        left = { k: 'bin', op: t.v, a: left, b: right };
      }
      return left;
    }
    var ast = expr(0);
    if (p < toks.length) throw new Error('trailing tokens in: ' + src);
    return ast;
  }
  var HAS = Object.prototype.hasOwnProperty;
  function evalAst(n, env) {
    switch (n.k) {
      case 'num': case 'str': return n.v;
      case 'id':
        if (n.v === 'true') return true; if (n.v === 'false') return false;
        if (n.v === 'null') return null; if (n.v === 'undefined') return undefined;
        if (!HAS.call(env, n.v)) throw new Error('unknown identifier: ' + n.v);
        return env[n.v];
      case 'mem': {
        var o = evalAst(n.o, env); if (o === null || o === undefined) return undefined;
        var key = n.c ? evalAst(n.p, env) : n.p;
        return HAS.call(Object(o), key) ? o[key] : undefined;
      }
      case 'un': { var v = evalAst(n.a, env); return n.op === '!' ? !v : n.op === '-' ? -v : +v; }
      case 'cond': return evalAst(n.c, env) ? evalAst(n.a, env) : evalAst(n.b, env);
      case 'call': return FUNCS[n.f].apply(null, n.args.map(function (a) { return evalAst(a, env); }));
      case 'bin': {
        if (n.op === '&&') { var l = evalAst(n.a, env); return l ? evalAst(n.b, env) : l; }
        if (n.op === '||') { var l2 = evalAst(n.a, env); return l2 ? l2 : evalAst(n.b, env); }
        if (n.op === '??') { var l3 = evalAst(n.a, env); return (l3 === null || l3 === undefined) ? evalAst(n.b, env) : l3; }
        var x = evalAst(n.a, env), y = evalAst(n.b, env);
        switch (n.op) {
          case '==': return x == y; case '!=': return x != y; case '===': return x === y; case '!==': return x !== y; // eslint-disable-line eqeqeq
          case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y;
          case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return x / y; case '%': return x % y;
        }
      }
    }
    throw new Error('bad ast');
  }
  var astCache = {};
  function getAst(expr) { return astCache[expr] || (astCache[expr] = parse(String(expr))); }
  function envOf(st) {
    return { S: st.S, F: st.F, R: st.R, rank: st.rank, sir: st.sir, season: st.t % 4,
             year: Math.floor(st.t / 4) + 1, t: st.t, age: C.startAge + Math.floor(st.t / 4), origin: st.origin };
  }
  function cond(expr, st) {
    if (expr === undefined || expr === null || expr === '' || expr === true) return true;
    if (expr === false) return false;
    try { return !!evalAst(getAst(expr), envOf(st)); }
    catch (e) { if (strict) throw e; warn('[cond]', expr, e.message); return false; }
  }

  /* ---------------- text helpers ---------------- */
  function rankTitle(st, r) {
    r = (r === undefined || r === null) ? st.rank : r;
    var R = Q.RANKS[r];
    return (r === 0 && st.origin !== 'maid') ? R.alt : R.th;
  }
  function fill(st, text) {
    if (text === undefined || text === null) return '';
    return String(text)
      .replace(/\{\{PLAYER\}\}/g, st.name)
      .replace(/\{\{RANK\}\}/g, rankTitle(st))
      .replace(/\{\{HEIR\}\}/g, (st.F && typeof st.F.heir_name === 'string' && st.F.heir_name) || 'องค์ชาย')
      .replace(/\{\{YEAR\}\}/g, String(Math.floor(st.t / 4) + 1))
      .replace(/\{\{SEASON\}\}/g, Q.SEASONS[st.t % 4]);
  }
  function dateInfo(st) {
    var year = Math.floor(st.t / 4) + 1, season = st.t % 4;
    return { year: year, season: season, seasonName: Q.SEASONS[season], icon: Q.SEASON_ICON[season],
             age: C.startAge + Math.floor(st.t / 4), label: 'รัชศก' + Q.ERA + ' ปีที่ ' + year + ' · ' + Q.SEASONS[season] };
  }

  /* ---------------- state ---------------- */
  function newState(opts) {
    opts = opts || {};
    var origin = Q.ORIGINS[opts.origin] ? opts.origin : 'noble';
    var o = Q.ORIGINS[origin];
    var st = {
      v: 1, name: String(opts.name || 'หลันซี').slice(0, 12), origin: origin, gift: opts.gift || null,
      seed: ((opts.seed !== undefined && opts.seed !== null) ? opts.seed : Math.floor(Math.random() * 4294967296)) | 0,
      rank: 0, t: 0, sir: 0, ap: C.apPerSeason,
      S: { favor: 0, prestige: 0, wit: 40, charm: 40, talent: 40, virtue: 50, health: 70, silver: 50, threat: 10 },
      R: {}, F: {}, seen: {}, queue: [], pending: [], cur: null,
      scene: { bg: null, cast: [] }, log: [], phase: 'events', ending: null, pendingEnding: null,
      flash: null, promoted: null, promoReady: null, promoRetry: 0, lastResult: null,
      stats: { events: 0, actions: 0 },
    };
    Q.REL_KEYS.forEach(function (k) { st.R[k] = 0; });
    Object.keys(o.start.S).forEach(function (k) { st.S[k] = o.start.S[k]; });
    Object.keys(o.start.R || {}).forEach(function (k) { st.R[k] = o.start.R[k]; });
    Object.keys(Q.INIT_FLAGS).forEach(function (k) { st.F[k] = Q.INIT_FLAGS[k]; });
    Object.keys(o.start.F || {}).forEach(function (k) { st.F[k] = o.start.F[k]; });
    if (opts.gift && Q.GIFTS[opts.gift]) applyFx(st, Q.GIFTS[opts.gift].fx);
    st.flash = null;
    return st;
  }
  function newGame(opts) {
    var st = newState(opts);
    beginSeason(st);
    return st;
  }

  /* ---------------- effects ---------------- */
  function roll(st, v) { return Array.isArray(v) ? ri(st, v[0], v[1]) : v; }
  function clampStat(k, v) { return k === 'silver' ? Math.max(0, Math.round(v)) : Math.max(0, Math.min(100, Math.round(v))); }
  function flashAdd(st, bucket, k, d) {
    if (!d) return;
    var f = st.flash || (st.flash = { S: {}, R: {}, notes: [] });
    f[bucket][k] = (f[bucket][k] || 0) + d;
  }
  function applyFx(st, fx) {
    if (!fx) return;
    Q.STAT_KEYS.forEach(function (k) {
      if (fx[k] === undefined) return;
      var old = st.S[k]; st.S[k] = clampStat(k, old + roll(st, fx[k])); flashAdd(st, 'S', k, st.S[k] - old);
    });
    if (fx.rel) Object.keys(fx.rel).forEach(function (k) {
      var old = st.R[k] || 0, nv = Math.max(-100, Math.min(100, old + roll(st, fx.rel[k])));
      st.R[k] = nv; flashAdd(st, 'R', k, nv - old);
    });
    if (fx.set) {
      if (Array.isArray(fx.set)) fx.set.forEach(function (n) { st.F[n] = true; });
      else Object.keys(fx.set).forEach(function (n) { st.F[n] = fx.set[n]; });
    }
    if (fx.unset) fx.unset.forEach(function (n) { delete st.F[n]; });
    if (fx.inc) Object.keys(fx.inc).forEach(function (n) { st.F[n] = (Number(st.F[n]) || 0) + fx.inc[n]; });
    if (fx.queue) fx.queue.forEach(function (q) { st.queue.push({ id: q.id, due: st.t + 1 + (q['in'] || 0) }); });
    if (fx.ap) st.ap = Math.max(0, st.ap + fx.ap);
    if (fx.log) st.log.push({ t: st.t, text: fill(st, fx.log) });
    if (fx.note) { var f = st.flash || (st.flash = { S: {}, R: {}, notes: [] }); f.notes.push(fill(st, fx.note)); }
  }

  /* ---------------- ranks ---------------- */
  function promote(st) {
    var from = st.rank; if (from >= 9) return;
    st.rank = from + 1; st.sir = 0; st.promoRetry = 0; st.promoReady = null;
    st.promoted = { from: from, to: st.rank, title: rankTitle(st), zh: Q.RANKS[st.rank].zh };
    st.F['rank' + st.rank] = true;
    var r = Q.RANKS[st.rank];
    if (r.onPromote) applyFx(st, r.onPromote);
    st.log.push({ t: st.t, text: 'เลื่อนขั้นเป็น' + r.th + ' (' + r.zh + ')' });
  }
  function demote(st, n) {
    var from = st.rank;
    st.rank = Math.max(0, st.rank - n); st.sir = 0; st.promoReady = null;
    if (st.rank < 1) { st.rank = 1; if (!st.pendingEnding) st.pendingEnding = 'end_cold_palace'; }
    st.log.push({ t: st.t, text: 'ถูกลดขั้นเหลือ' + Q.RANKS[st.rank].th });
    st.demoted = { from: from, to: st.rank };
  }
  function gate(st) {
    var g = Q.GATES[st.rank]; if (!g) return null;
    var need = [
      { k: 'time', label: 'อยู่ในตำแหน่งครบ (ฤดู)', have: st.sir, want: g.minSeasons, ok: st.sir >= g.minSeasons },
      { k: 'favor', label: 'ความโปรดปราน', have: st.S.favor, want: g.favor, ok: st.S.favor >= g.favor },
      { k: 'prestige', label: 'ศักดิ์ศรี', have: st.S.prestige, want: g.prestige, ok: st.S.prestige >= g.prestige },
    ];
    if (g.req) need.push({ k: 'req', label: g.reqLabel || 'บททดสอบประจำขั้น', ok: cond(g.req, st) });
    return { ok: need.every(function (n) { return n.ok; }), need: need, from: st.rank, to: st.rank + 1 };
  }
  function checkPromotion(st) {
    if (st.rank < 1 || st.rank > 8 || st.promoReady) return;
    if (st.promoRetry && st.t < st.promoRetry) return;
    var g = gate(st); if (!g || !g.ok) return;
    var id = 'promo_' + st.rank + '_' + (st.rank + 1);
    if (EV[id]) { st.promoReady = id; st.promoRetry = st.t + C.promoRetryGap; }
    else { promote(st); st.F['auto_promo_' + st.rank] = true; }   // content missing → never deadlock
  }

  /* ---------------- event selection ---------------- */
  function inRank(ev, rank) {
    var lo = (ev.minRank === undefined || ev.minRank === null) ? 1 : ev.minRank;
    var hi = (ev.maxRank === undefined || ev.maxRank === null) ? 8 : ev.maxRank;
    return rank >= lo && rank <= hi;
  }
  function isOnce(ev) { return (ev.once !== undefined && ev.once !== null) ? ev.once : (ev.kind === 'chapter' || ev.kind === 'chain' || ev.kind === 'ending'); }
  function cooldownOf(ev) { return (ev.cooldown !== undefined && ev.cooldown !== null) ? ev.cooldown : (ev.kind === 'festival' ? 8 : 6); }
  function eligible(st, ev, exclude) {
    if (exclude && exclude.indexOf(ev.id) >= 0) return false;
    if (st.F.finale && (ev.kind === 'random' || ev.kind === 'festival')) return false;   // succession crisis: only scripted chapters run
    if (!inRank(ev, st.rank)) return false;
    if (ev.season && ev.season.indexOf(st.t % 4) < 0) return false;
    var last = st.seen[ev.id];
    if (last !== undefined) { if (isOnce(ev)) return false; if (st.t - last < cooldownOf(ev)) return false; }
    if (ev.cond && !cond(ev.cond, st)) return false;
    return true;
  }
  function isGeneral(ev) { return ev.kind === 'random' && (!ev.tags || !ev.tags.length || ev.tags.indexOf('general') >= 0); }
  function poolOf(st, o) {
    var exclude = o.exclude || [];
    return Q.events.filter(function (ev) {
      if (o.tag) { if (ev.kind !== 'random' || !ev.tags || ev.tags.indexOf(o.tag) < 0) return false; }
      else if (o.kind === 'festival') { if (ev.kind !== 'festival') return false; }
      else { if (!isGeneral(ev)) return false; }
      return eligible(st, ev, exclude);
    });
  }
  function pickEvent(st, o) {
    var pool = poolOf(st, o || {});
    if (!pool.length) return null;
    var total = 0; pool.forEach(function (e) { total += (e.weight === undefined ? 10 : e.weight); });
    var r = rnd(st) * total;
    for (var i = 0; i < pool.length; i++) { r -= (pool[i].weight === undefined ? 10 : pool[i].weight); if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function pickChapter(st, exclude) {
    var best = null;
    Q.events.forEach(function (ev) {
      if (ev.kind !== 'chapter' || !ev.trigger) return;
      if (!eligible(st, ev, exclude)) return;
      if (!cond(ev.trigger, st)) return;
      if (!best || (ev.prio || 0) > (best.prio || 0)) best = ev;
    });
    return best;
  }
  function attackChance(st) {
    if (st.rank < 1) return 0;
    var p = (st.S.threat - C.attackFloor) / C.attackScale;
    return Math.max(0, Math.min(C.attackMax, p));
  }

  /* ---------------- seasons ---------------- */
  function beginSeason(st) {
    var L = [];
    if (st.promoReady && EV[st.promoReady]) { L.push(st.promoReady); }
    st.promoReady = null;
    var ch = pickChapter(st, L); if (ch) L.push(ch.id);
    var keep = [];
    st.queue.forEach(function (q) { if (q.due <= st.t) { if (EV[q.id] && L.indexOf(q.id) < 0) L.push(q.id); } else keep.push(q); });
    st.queue = keep;
    if (st.rank >= 1 && rnd(st) < attackChance(st)) { var ae = pickEvent(st, { tag: 'attack', exclude: L }); if (ae) L.push(ae.id); }
    if (L.length < 2) {
      if (rnd(st) < C.pFestival) { var fe = pickEvent(st, { kind: 'festival', exclude: L }); if (fe) L.push(fe.id); }
      if (!L.length && rnd(st) < C.pRandom) { var ge = pickEvent(st, { exclude: L }); if (ge) L.push(ge.id); }
    }
    st.pending = L.slice(0, C.eventsPerSeasonCap);
    st.phase = (st.pending.length || st.pendingEnding) ? 'events' : 'hub';
  }
  function systemEnd(st) {
    if (st.S.health <= 0) return st.F.poisoned ? 'end_death_poison' : 'end_death_illness';
    if (st.t >= C.maxSeasons) return 'end_twilight';
    return null;
  }
  function endSeason(st) {
    var rep = { stipend: 0, favorLoss: 0, healthDelta: 0, threatDelta: 0, notes: [] };
    st.flash = null;
    var rk = Q.RANKS[st.rank];
    st.S.silver += rk.stipend; rep.stipend = rk.stipend;
    var f0 = st.S.favor; st.S.favor = Math.max(0, f0 - C.favorDecay); rep.favorLoss = f0 - st.S.favor;
    var th0 = st.S.threat;
    var dTh = -C.threatDecay + (st.S.favor >= 50 ? 2 : 0) + (st.S.prestige >= 50 ? 1 : 0) + (st.rank >= 6 ? 1 : 0);
    st.S.threat = clampStat('threat', th0 + dTh); rep.threatDelta = st.S.threat - th0;
    var h0 = st.S.health;
    if (st.F.poisoned) {
      st.S.health = clampStat('health', st.S.health - C.poisonDrain); rep.notes.push('พิษในกายยังกัดกินสุขภาพของท่าน');
      var cure = C.poisonSelfCure + (st.R.doctor >= 30 ? 0.25 : 0);
      if (rnd(st) < cure) { delete st.F.poisoned; rep.notes.push('พิษจางลงจนหมดไปเอง'); }
    } else if (st.S.health < 70) st.S.health = clampStat('health', st.S.health + C.healthRegen);
    if (st.t % 4 === 3 && st.rank <= 2) { st.S.health = clampStat('health', st.S.health - C.winterChill); rep.notes.push('ฤดูหนาวเยือกเย็นเกินกว่าเสื้อผ้าบางๆ จะต้านไหว'); }
    rep.healthDelta = st.S.health - h0;
    st.t++; st.sir++; st.ap = C.apPerSeason;
    checkPromotion(st);
    if (!st.pendingEnding) { var se = systemEnd(st); if (se) st.pendingEnding = se; }
    beginSeason(st);
    rep.date = dateInfo(st); rep.pending = st.pending.length; rep.promo = !!(st.pending.length && /^promo_/.test(st.pending[0]));
    return rep;
  }

  /* ---------------- actions / hub ---------------- */
  function actions(st) {
    return Q.ACTIONS.filter(function (a) {
      var lo = a.minRank || 0, hi = (a.maxRank === undefined) ? 9 : a.maxRank;
      return st.rank >= lo && st.rank <= hi && (!a.cond || cond(a.cond, st));
    }).map(function (a) {
      var dis = false, why = null;
      if (st.ap <= 0) { dis = true; why = 'หมดแรงในฤดูนี้แล้ว'; }
      else if (a.cost && a.cost.silver && st.S.silver < a.cost.silver) { dis = true; why = 'เงินตำลึงไม่พอ'; }
      return { id: a.id, grp: a.grp, icon: a.icon, th: a.th, desc: a.desc, cost: a.cost || null, draw: a.draw || null, disabled: dis, why: why };
    });
  }
  function doAction(st, id) {
    var a = ACT[id]; if (!a) return { ok: false, why: 'unknown action' };
    var view = actions(st).filter(function (x) { return x.id === id; })[0];
    if (!view || view.disabled) return { ok: false, why: view ? view.why : 'ไม่สามารถทำได้' };
    st.flash = null; st.ap--; st.stats.actions++;
    if (a.cost && a.cost.silver) applyFx(st, { silver: -a.cost.silver });
    applyFx(st, a.fx);
    var ev = a.draw ? pickEvent(st, { tag: a.draw }) : null;
    var line = null;
    if (ev) st.pending.unshift(ev.id);
    else if (a.lines && a.lines.length) line = fill(st, a.lines[Math.floor(rnd(st) * a.lines.length)]);
    st.phase = ev ? 'events' : 'hub';
    return { ok: true, action: a.id, th: a.th, line: line, flash: st.flash, event: ev ? ev.id : null };
  }
  function hub(st) {
    return { date: dateInfo(st), rank: st.rank, rankTitle: rankTitle(st), ap: st.ap, actions: actions(st), gate: gate(st), attack: attackChance(st) };
  }

  /* ---------------- event runtime ---------------- */
  function nextPending(st) {
    if (st.cur || st.phase === 'ended') return null;
    if (st.pendingEnding) { var e = st.pendingEnding; st.pendingEnding = null; if (EV[e]) return e; warn('missing ending event', e); }
    while (st.pending.length) { var id = st.pending.shift(); if (EV[id]) return id; warn('missing pending event', id); }
    st.phase = 'hub';
    return null;
  }
  function startEvent(st, id) {
    var ev = EV[id];
    if (!ev) { warn('startEvent: unknown event', id); st.cur = null; return false; }
    st.seen[id] = st.t; st.stats.events++;
    st.cur = { ev: id, node: ev.start };
    if (ev.bg) st.scene.bg = ev.bg;
    st.scene.cast = ev.cast ? copy(ev.cast) : [];
    st.phase = 'events';
    enterNode(st); settle(st);
    return true;
  }
  function enterNode(st) {
    var ev = EV[st.cur.ev], node = ev.nodes[st.cur.node];
    if (!node) return;
    if (node.bg) st.scene.bg = node.bg;
    if (node.cast) st.scene.cast = copy(node.cast);
    if (node.fx) applyFx(st, node.fx);
    if (node.promote) promote(st);
    if (node.demote) demote(st, node.demote === true ? 1 : node.demote);
    if (node.ending) st.pendingEnding = node.ending;
  }
  function gotoNode(st, id) { st.cur.node = id; enterNode(st); }
  /* skip silent nodes (branch / pure jump / pure fx) until something visible or the event ends */
  function settle(st) {
    var guard = 0;
    while (st.cur && guard++ < 60) {
      var ev = EV[st.cur.ev], node = ev.nodes[st.cur.node];
      if (!node) { warn('missing node', st.cur.ev, st.cur.node); finishEvent(st); return; }
      if (node.text || node.card || (node.choices && node.choices.length)) return;
      if (node.branch) {
        var hit = null;
        for (var i = 0; i < node.branch.length; i++) { if (!node.branch[i].cond || cond(node.branch[i].cond, st)) { hit = node.branch[i]; break; } }
        if (!hit) { finishEvent(st); return; }
        gotoNode(st, hit.next); continue;
      }
      if (node.jump) { startEvent(st, node.jump); return; }
      if (node.next) { gotoNode(st, node.next); continue; }
      finishEvent(st); return;
    }
    if (st.cur) { warn('settle: runaway in', st.cur.ev); finishEvent(st); }
  }
  function finishEvent(st) {
    var ev = st.cur && EV[st.cur.ev];
    st.cur = null;
    if (ev && ev.kind === 'ending') { st.phase = 'ended'; st.ending = ev.id; st.pending = []; st.pendingEnding = null; return; }
    if (!st.pendingEnding) { var se = systemEnd(st); if (se) st.pendingEnding = se; }
    if (!st.pendingEnding && st.rank >= 9) st.pendingEnding = 'end_taihou_gentle';   // safety net
  }
  function chance(st, ch) {
    var stats = Array.isArray(ch.stat) ? ch.stat : [ch.stat], sum = 0;
    stats.forEach(function (k) { sum += (k === 'luck') ? 50 : (st.S[k] !== undefined ? st.S[k] : 50); });
    var v = sum / stats.length, mod = 0;
    (ch.mods || []).forEach(function (m) { if (cond(m.cond, st)) mod += m.add; });
    return Math.max(0.05, Math.min(0.95, 0.5 + (v + mod - ch.dc) / C.checkDivisor));
  }
  function view(st) {
    if (!st.cur) return null;
    var ev = EV[st.cur.ev], node = ev && ev.nodes[st.cur.node];
    if (!node) return null;
    var v = {
      ev: ev.id, title: ev.title || '', node: st.cur.node, kind: 'line', who: node.who || 'narrator', x: node.x || null,
      text: fill(st, node.text), card: node.card ? fill(st, node.card) : null,
      bg: st.scene.bg, cast: st.scene.cast, choices: null, flash: st.flash, promoted: st.promoted,
      isEnding: ev.kind === 'ending', last: !(node.next || node.jump || (node.choices && node.choices.length)),
    };
    if (node.card && !node.text) v.kind = 'card';
    if (node.choices && node.choices.length) {
      var list = [];
      node.choices.forEach(function (c, idx) {
        if (c.cond && !cond(c.cond, st)) return;
        var dis = false, why = null;
        if (c.req && !cond(c.req, st)) { dis = true; why = c.why || 'ยังไม่เข้าเงื่อนไข'; }
        if (c.cost && c.cost.silver && st.S.silver < c.cost.silver) { dis = true; why = 'เงินตำลึงไม่พอ'; }
        list.push({ i: list.length, idx: idx, text: fill(st, c.text), disabled: dis, why: why, hint: c.hint || null,
                    cost: c.cost || null, pct: c.check ? Math.round(chance(st, c.check) * 100) : null, risky: !!c.check, stat: c.check ? c.check.stat : null });
      });
      if (list.length && list.every(function (c) { return c.disabled; })) { list[list.length - 1].disabled = false; list[list.length - 1].why = null; list[list.length - 1].forced = true; }
      if (list.length) { v.kind = 'choice'; v.choices = list; }
    }
    return v;
  }
  function advance(st) {
    if (!st.cur) return;
    var v = view(st);
    if (v && v.kind === 'choice') return;                // must choose
    st.flash = null;
    var node = EV[st.cur.ev].nodes[st.cur.node];
    if (node.jump) { startEvent(st, node.jump); return; }
    if (node.next) { gotoNode(st, node.next); settle(st); return; }
    finishEvent(st);
  }
  function choose(st, i) {
    var v = view(st);
    if (!v || v.kind !== 'choice' || !v.choices[i] || v.choices[i].disabled) return null;
    var node = EV[st.cur.ev].nodes[st.cur.node];
    var raw = node.choices[v.choices[i].idx];
    st.flash = null;
    if (raw.cost && raw.cost.silver) applyFx(st, { silver: -raw.cost.silver });
    var result = { success: null, pct: null }, nextId = raw.next;
    if (raw.check) {
      var p = chance(st, raw.check), ok = rnd(st) < p;
      result = { success: ok, pct: Math.round(p * 100) };
      nextId = ok ? raw.win : raw.lose;
      applyFx(st, raw.fx); applyFx(st, ok ? raw.winFx : raw.loseFx);
    } else applyFx(st, raw.fx);
    st.lastResult = result;
    if (raw.jump) { startEvent(st, raw.jump); return result; }
    if (nextId) { gotoNode(st, nextId); settle(st); } else finishEvent(st);
    return result;
  }
  function ackPromotion(st) { st.promoted = null; st.demoted = null; }

  /* ---------------- summary for the ending screen ---------------- */
  function summary(st) {
    var ev = EV[st.ending] || {};
    var meta = ev.ending || {};
    return {
      id: st.ending, type: meta.type || 'neutral', title: meta.title || ev.title || 'จบเรื่อง', hint: meta.hint || '',
      rank: st.rank, rankTitle: rankTitle(st), zh: Q.RANKS[st.rank].zh,
      seasons: st.t, years: Math.floor(st.t / 4), age: C.startAge + Math.floor(st.t / 4),
      S: copy(st.S), R: copy(st.R), heir: !!st.F.has_heir, name: st.name, origin: st.origin,
    };
  }

  reindex();
  return {
    reindex: reindex, setStrict: function (b) { strict = !!b; }, parse: parse, getAst: getAst,
    cond: cond, fill: fill, rankTitle: rankTitle, dateInfo: dateInfo,
    newState: newState, newGame: newGame, applyFx: applyFx, promote: promote, demote: demote,
    gate: gate, checkPromotion: checkPromotion, chance: chance, attackChance: attackChance,
    pickEvent: pickEvent, pickChapter: pickChapter, eligible: eligible, beginSeason: beginSeason, endSeason: endSeason,
    actions: actions, doAction: doAction, hub: hub,
    nextPending: nextPending, startEvent: startEvent, view: view, advance: advance, choose: choose, ackPromotion: ackPromotion,
    systemEnd: systemEnd, summary: summary, rnd: rnd,
    event: function (id) { return EV[id]; }, action: function (id) { return ACT[id]; },
  };
})();
