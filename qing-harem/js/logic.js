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
  var WI = {};                  // wardrobe item index
  var strict = false;           // validator sets true → cond errors throw

  function reindex() {
    EV = {}; ACT = {};
    Q.events.forEach(function (e) { EV[e.id] = e; });
    Q.ACTIONS.forEach(function (a) { ACT[a.id] = a; });
    WI = {}; if (Q.WARDROBE) Q.WARDROBE.items.forEach(function (i) { WI[i.id] = i; });
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
  function envOf(st, needW) {
    var e = { S: st.S, F: st.F, R: st.R, rank: st.rank, sir: st.sir, season: st.t % 4,
              year: Math.floor(st.t / 4) + 1, t: st.t, age: C.startAge + Math.floor(st.t / 4), origin: st.origin };
    if (needW && needW.indexOf('W') >= 0) e.W = wardrobeEnv(st);
    if (needW && needW.indexOf('X') >= 0) e.X = xnEnv(st);
    if (needW && needW.indexOf('T') >= 0) e.T = tabletEnv(st);
    return e;
  }
  var USES_W = /\bW\b/, USES_X = /\bX\b/, USES_T = /\bT\b/;
  function cond(expr, st) {
    if (expr === undefined || expr === null || expr === '' || expr === true) return true;
    if (expr === false) return false;
    try { var need = (USES_W.test(expr) ? 'W' : '') + (USES_X.test(expr) ? 'X' : '') + (USES_T.test(expr) ? 'T' : ''); return !!evalAst(getAst(expr), envOf(st, need)); }
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
      .replace(/\{\{SEASON\}\}/g, Q.SEASONS[st.t % 4])
      .replace(/\{\{XN(RANK|CLAN)?([123])?\}\}/g, function (m, kind, idx) { return xnFill(st, kind, idx); });
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
    ensureW(st); ensureX(st); ensureT(st);
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
      var d = roll(st, fx[k]);
      if (k === 'prestige' && d > 0 && C.prestigeScale) d = Math.max(1, Math.round(d * C.prestigeScale));
      var old = st.S[k]; st.S[k] = clampStat(k, old + d); flashAdd(st, 'S', k, st.S[k] - old);
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
    if (fx.give) fx.give.forEach(function (id) { giveItem(st, id); });
    if (fx.xn) applyXn(st, fx.xn);
    if (fx.tablet) applyTablet(st, fx.tablet);
    if (fx.log) st.log.push({ t: st.t, text: fill(st, fx.log) });
    if (fx.note) { var f = st.flash || (st.flash = { S: {}, R: {}, notes: [] }); f.notes.push(fill(st, fx.note)); }
  }


  /* ---------------- wardrobe (ตู้เสื้อผ้า) ---------------- */
  var CHK_TH = { charm: 'โฉมงาม', talent: 'พรสวรรค์', wit: 'ปัญญา' };
  function ensureW(st) {
    if (!st.W || typeof st.W !== 'object') { st.W = { own: {}, eq: {}, fr: {} }; initWardrobe(st); }
    if (!st.W.own) st.W.own = {}; if (!st.W.eq) st.W.eq = {}; if (!st.W.fr) st.W.fr = {};
    return st.W;
  }
  function wearable(st, it) { return !!it && st.rank >= it.minRank; }
  function slotItem(st, slot) { var id = ensureW(st).eq[slot]; return id ? WI[id] : null; }
  function flashNote(st, text) { var f = st.flash || (st.flash = { S: {}, R: {}, notes: [] }); f.notes.push(text); }
  function giveItem(st, id, quiet) {
    var it = WI[id];
    if (!it) { warn('give: unknown wardrobe item', id); return false; }
    var W = ensureW(st);
    if (W.own[id]) return false;
    W.own[id] = true;
    var cur = slotItem(st, it.slot);
    var auto = wearable(st, it) && (!cur || !wearable(st, cur) || it.tier >= cur.tier);
    if (auto) W.eq[it.slot] = id;
    if (!quiet) {
      flashNote(st, 'ได้รับ ' + it.th + (auto ? ' · สวมใส่ให้แล้ว' : ' · เก็บเข้าตู้เสื้อผ้า'));
      st.log.push({ t: st.t, text: 'ได้รับ' + it.th });
    }
    return true;
  }
  function grantsFor(st, rank, quiet) {
    var got = [];
    Q.WARDROBE.items.forEach(function (it) { if (it.grant === rank && giveItem(st, it.id, quiet)) got.push(it.id); });
    return got;
  }
  function initWardrobe(st) {
    (Q.WARDROBE.kits[st.origin] || []).forEach(function (id) { giveItem(st, id, true); });
    for (var r = 1; r <= st.rank; r++) grantsFor(st, r, true);
  }
  function validateWardrobe(st) {
    var W = ensureW(st);
    Q.WARDROBE.slots.forEach(function (s) {
      var it = slotItem(st, s.id);
      if (it && !wearable(st, it)) { delete W.eq[s.id]; it = null; }
      if (!it && (s.id === 'robe' || s.id === 'head')) {
        var best = null;
        Object.keys(W.own).forEach(function (id) { var c = WI[id]; if (c && c.slot === s.id && wearable(st, c) && (!best || c.tier > best.tier)) best = c; });
        if (best) W.eq[s.id] = best.id;
      }
    });
  }
  function wardrobeEff(st) {
    var out = { chk: { charm: 0, talent: 0, wit: 0 }, thr: 0, pre: 0, vir: 0, fav: 0, set: null, setTh: null, tier: 0, style: 'plain', flash: 0, parts: {} };
    function addEff(e) {
      if (!e) return;
      if (e.chk) Object.keys(e.chk).forEach(function (k) { out.chk[k] = (out.chk[k] || 0) + e.chk[k]; });
      ['thr', 'pre', 'vir', 'fav'].forEach(function (k) { if (e[k]) out[k] += e[k]; });
    }
    var sets = {};
    Q.WARDROBE.slots.forEach(function (s) {
      var it = slotItem(st, s.id);
      if (!wearable(st, it)) return;
      out.parts[s.id] = it; addEff(it.eff);
      if (it.set) (sets[it.set] = sets[it.set] || {})[s.id] = true;
      if (it.style === 'bright' || it.style === 'grand') out.flash++;
    });
    Object.keys(sets).forEach(function (k) {
      var o = sets[k];
      if (!out.set && o.robe && o.head && (o.neck || o.ear || o.charm)) { out.set = k; out.setTh = Q.WARDROBE.sets[k].th; addEff(Q.WARDROBE.sets[k].eff); }
    });
    var rb = out.parts.robe, hd = out.parts.head;
    out.tier = rb && hd ? Math.round((rb.tier + hd.tier) / 2) : (rb ? rb.tier : 0);
    out.style = rb ? rb.style : 'plain';
    return out;
  }
  function wardrobeEnv(st) {
    var e = wardrobeEff(st), W = ensureW(st);
    return { tier: e.tier, dress: e.tier - st.rank, style: e.style, set: e.set, flash: e.flash,
             robe: W.eq.robe, head: W.eq.head, neck: W.eq.neck, ear: W.eq.ear, charm: W.eq.charm, own: W.own };
  }
  function effLines(e) {
    var L = [];
    if (!e) return L;
    if (e.chk) Object.keys(e.chk).forEach(function (k) { if (e.chk[k]) L.push({ t: CHK_TH[k] + ' +' + e.chk[k] + ' เมื่อทอยเต๋า', good: true }); });
    function f(v) { return (Math.round(v * 100) / 100) + ''; }
    if (e.pre) L.push({ t: 'ศักดิ์ศรี +' + f(e.pre) + ' ต่อฤดู', good: true });
    if (e.fav) L.push({ t: 'ความโปรดปราน +' + f(e.fav) + ' ต่อฤดู', good: true });
    if (e.vir) L.push({ t: 'คุณธรรม +' + f(e.vir) + ' ต่อฤดู', good: true });
    if (e.thr) L.push({ t: 'ภัยรอบกาย ' + (e.thr > 0 ? '+' : '') + f(e.thr) + ' ต่อฤดู', good: e.thr < 0 });
    return L;
  }
  function look(st) {
    var out = {};
    Q.WARDROBE.slots.forEach(function (s) { var it = slotItem(st, s.id); out[s.id] = wearable(st, it) ? it.look : null; });
    return out;
  }
  function equip(st, id) {
    var it = WI[id], W = ensureW(st);
    if (!it) return { ok: false, why: 'ไม่พบสิ่งของชิ้นนี้' };
    if (!W.own[id]) return { ok: false, why: 'ยังไม่มีชิ้นนี้ในตู้เสื้อผ้า' };
    if (!wearable(st, it)) return { ok: false, why: 'ฐานะยังไม่ถึง — ต้องเป็น' + Q.RANKS[it.minRank].th };
    W.eq[it.slot] = id;
    return { ok: true };
  }
  function unequip(st, slot) {
    var W = ensureW(st);
    if (slot === 'robe' || slot === 'head') return { ok: false, why: 'ชุดและเครื่องหัวต้องสวมเสมอ' };
    delete W.eq[slot];
    return { ok: true };
  }
  function buy(st, id) {
    var it = WI[id], W = ensureW(st);
    if (!it || !(it.price > 0)) return { ok: false, why: 'ชิ้นนี้ไม่มีขาย' };
    if (W.own[id]) return { ok: false, why: 'มีชิ้นนี้แล้ว' };
    if (!wearable(st, it)) return { ok: false, why: 'ฐานะยังไม่ถึง — ต้องเป็น' + Q.RANKS[it.minRank].th };
    if (st.S.silver < it.price) return { ok: false, why: 'เงินตำลึงไม่พอ' };
    st.S.silver -= it.price; W.own[id] = true;
    st.log.push({ t: st.t, text: 'ซื้อ' + it.th + ' (' + it.price + ' ตำลึง)' });
    return { ok: true, price: it.price };
  }
  function wardrobe(st) {
    var W = ensureW(st), eff = wardrobeEff(st);
    var slots = Q.WARDROBE.slots.map(function (s) {
      var list = Q.WARDROBE.items.filter(function (it) {
        if (it.slot !== s.id) return false;
        if (W.own[it.id]) return true;
        if (it.src === 'shop') return true;
        if (it.src === 'rank') return it.grant <= st.rank + 1;
        return false;
      }).sort(function (a, b) { return a.tier - b.tier || (a.id < b.id ? -1 : 1); }).map(function (it) {
        var owned = !!W.own[it.id], ok = wearable(st, it), why = null;
        if (!ok) why = 'ต้องเป็น' + Q.RANKS[it.minRank].th;
        return { id: it.id, th: it.th, desc: it.desc || '', tier: it.tier, minRank: it.minRank, rankTh: Q.RANKS[it.minRank].th, price: it.price, src: it.src, grant: it.grant,
                 style: it.style, styleTh: Q.WARDROBE.styles[it.style] || '', set: it.set || null, setTh: it.set ? Q.WARDROBE.sets[it.set].th : null,
                 owned: owned, equipped: W.eq[it.slot] === it.id, wearable: ok, why: why, buyable: !owned && it.price > 0 && ok && st.S.silver >= it.price,
                 tooPoor: !owned && it.price > 0 && ok && st.S.silver < it.price, eff: effLines(it.eff), look: it.look, sw: it.sw || null };
      });
      return { id: s.id, th: s.th, icon: s.icon, cat: s.cat, equipped: W.eq[s.id] || null, items: list };
    });
    var setLines = eff.set ? effLines(Q.WARDROBE.sets[eff.set].eff) : [];
    return { slots: slots, eff: eff, effLines: effLines({ chk: eff.chk, thr: eff.thr, pre: eff.pre, vir: eff.vir, fav: eff.fav }), set: eff.set, setTh: eff.setTh, setLines: setLines,
             silver: st.S.silver, sets: Q.WARDROBE.sets };
  }


  /* ---------------- xiunü (秀女) — new-concubine batches ---------------- */
  function ensureX(st) {
    if (!st.X || typeof st.X !== 'object') st.X = { next: Q.XIUNU.firstAt, batches: 0, seq: 0, girls: {}, order: [], pending: null, focus: null, last: null, fr: {} };
    var X = st.X;
    if (!X.girls) X.girls = {}; if (!X.order) X.order = []; if (!X.fr) X.fr = {};
    return X;
  }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pickOf(st, arr) { return arr[Math.floor(rnd(st) * arr.length)]; }
  function rr(st, r) { return ri(st, r[0], r[1]); }
  function galive(g) { return g.status === 'kept' || g.status === 'sponsored' || g.status === 'maid'; }
  function genLook(st, arch, han) {
    var A = Q.XIUNU, r = pickOf(st, A.robes), h = pickOf(st, A.hair);
    return { skin: pickOf(st, A.skin), hair: h[0], hairHi: h[1], iris: pickOf(st, A.iris), robe: { col: r.col, trim: r.trim, pat: r.pat, patCol: r.patCol },
             flowers: r.fl, style: pickOf(st, arch.style), han: han, fw: ri(st, 64, 70), jw: ri(st, 18, 23), mole: rnd(st) < 0.18, blush: ri(st, 12, 26) / 100 };
  }
  function pickAgent(st, g, arch) {
    if (rnd(st) >= arch.agentP) return null;
    var opts = [];
    if (!st.F.empress_down) opts.push('empress');
    if (!st.F.niohuru_down) opts.push('consort');
    if (g.arch === 'highborn') { var pref = g.side === 'military' ? 'consort' : g.side === 'civil' ? 'empress' : null; if (pref && opts.indexOf(pref) >= 0) return pref; }
    return opts.length ? pickOf(st, opts) : null;
  }
  function genGirl(st, X) {
    var A = Q.XIUNU, keys = Object.keys(A.archetypes), tot = 0, key = keys[0], i;
    keys.forEach(function (k) { tot += A.archetypes[k].weight; });
    var r = rnd(st) * tot;
    for (i = 0; i < keys.length; i++) { r -= A.archetypes[keys[i]].weight; if (r <= 0) { key = keys[i]; break; } }
    var arch = A.archetypes[key];
    var han = (key === 'bright' || key === 'artist' || key === 'humble') ? rnd(st) < 0.65 : rnd(st) < 0.35;
    var clan = key === 'humble' ? { th: 'สามัญชน', side: 'neutral', power: 0 }
      : key === 'highborn' ? pickOf(st, A.manchu.filter(function (c) { return c.power >= 2; })) : pickOf(st, han ? A.han : A.manchu);
    var used = {}; X.order.forEach(function (id) { used[X.girls[id].name] = 1; });
    var pool = A.names.filter(function (n) { return !used[n]; }); if (!pool.length) pool = A.names;
    var g = { id: 'x' + (++X.seq), name: pickOf(st, pool), clan: clan.th, side: clan.side, power: clan.power, han: han, banner: pickOf(st, A.banners),
      age: ri(st, 15, 17), arch: key, t0: st.t, batch: X.batches, charm: rr(st, arch.charm), wit: rr(st, arch.wit), talent: rr(st, arch.talent),
      ambition: rr(st, arch.ambition), loyalty: rr(st, arch.loyalty), favor: 0, rank: 0, status: 'pending', agent: null, faction: 'none',
      turned: false, known: {}, blurb: pickOf(st, arch.blurbs), look: null };
    g.agent = pickAgent(st, g, arch);
    g.look = genLook(st, arch, han);
    return g;
  }
  function sponsorCost(g) { return g.arch === 'humble' ? 40 : 60 + 40 * g.power; }
  function xnQuota(st) { var q = Q.XIUNU.quota; return q[Math.min(8, Math.max(0, st.rank))] || 0; }
  function newBatch(st) {
    var X = ensureX(st), A = Q.XIUNU, n = rr(st, A.batchSize), ids = [], i;
    X.batches++;
    for (i = 0; i < n; i++) { var g = genGirl(st, X); X.girls[g.id] = g; X.order.push(g.id); ids.push(g.id); }
    X.last = { no: X.batches, ids: ids, t: st.t };
    X.next = st.t + A.interval;
    st.F.xn_fresh = true;
    if (st.rank >= A.participateRank) X.pending = { no: X.batches, ids: ids, deadline: st.t + A.deadline, quota: xnQuota(st), sponsored: 0 };
    else autoPlace(st, ids);
    return ids;
  }
  function autoPlace(st, ids) {
    var X = ensureX(st);
    ids.forEach(function (id) { var g = X.girls[id]; if (g.status !== 'pending') return; g.status = 'kept'; g.rank = 1; g.faction = g.agent || 'none'; });
  }
  function autoResolve(st) { var X = ensureX(st), P = X.pending; if (!P) return; autoPlace(st, P.ids); X.pending = null; }
  function xnInvestigate(st, id) {
    var X = ensureX(st), g = X.girls[id], cost = Q.XIUNU.investigateCost;
    if (!g || g.status !== 'pending') return { ok: false, why: 'ไม่สามารถสืบประวัติได้' };
    if (g.known.done) return { ok: false, why: 'สืบประวัติผู้นี้ไปแล้ว' };
    if (st.S.silver < cost) return { ok: false, why: 'เงินตำลึงไม่พอ' };
    st.flash = null; applyFx(st, { silver: -cost });
    var p = clampN(0.5 + (st.S.wit - 45) / 80, 0.3, 0.95);
    g.known.done = true; g.known.arch = true;
    var b = g.ambition < 35 ? 0 : g.ambition < 65 ? 1 : 2;
    if (rnd(st) > p) b = clampN(b + (rnd(st) < 0.5 ? -1 : 1), 0, 2);
    g.known.ambition = b;
    g.known.agent = (rnd(st) < p * 0.85) ? (g.agent ? 'yes' : 'no') : null;
    return { ok: true, flash: st.flash };
  }
  function xnDecide(st, id, choice) {
    var X = ensureX(st), P = X.pending, g = X.girls[id], note = '';
    if (!P || !g || g.status !== 'pending' || P.ids.indexOf(id) < 0) return { ok: false, why: 'ไม่อยู่ในรายชื่อที่รอพิจารณา' };
    st.flash = null;
    if (choice === 'sponsor') {
      var cost = sponsorCost(g);
      if (P.sponsored >= P.quota) return { ok: false, why: 'โควตารับเข้าสังกัดของรุ่นนี้เต็มแล้ว' };
      if (st.S.silver < cost) return { ok: false, why: 'เงินตำลึงไม่พอ (ต้องใช้ ' + cost + ' ตำลึง)' };
      applyFx(st, { silver: -cost, prestige: g.power >= 2 ? 2 : 1 });
      g.status = 'sponsored'; g.rank = 1; g.loyalty = clampN(g.loyalty + 22, 0, 100); P.sponsored++;
      note = g.name + ' เข้าสังกัดของท่าน และจะจดจำว่าใครยื่นมือให้';
    } else if (choice === 'neutral') {
      g.status = 'kept'; g.rank = 1; g.faction = g.agent || 'none';
      note = g.name + ' ถูกจัดเข้าวังตามชะตา';
    } else if (choice === 'maid') {
      g.status = 'maid'; g.loyalty = clampN(g.loyalty + 35, 0, 100); g.faction = 'none';
      note = g.name + ' มาเป็นนางกำนัลข้างกายท่าน';
    } else if (choice === 'reject') {
      g.status = 'rejected';
      if (g.power >= 2) { g.revenge = true; applyFx(st, { threat: g.power >= 3 ? 4 : 2 }); note = 'ตระกูล' + g.clan + 'จะจดจำเรื่องนี้'; }
      if (g.arch === 'humble') { applyFx(st, { virtue: -2 }); note = g.name + ' ถูกส่งกลับสู่ความยากจน'; }
      if (g.agent && g.known.agent === 'yes') { applyFx(st, { prestige: 2, threat: -2 }); note = 'ท่านปัดสายสืบออกจากวังได้ก่อนที่นางจะเข้ามา'; }
      if (!note) note = g.name + ' ถูกส่งกลับบ้าน';
    } else return { ok: false, why: 'คำสั่งไม่ถูกต้อง' };
    g.decided = true;
    if (P.ids.every(function (i) { return X.girls[i].status !== 'pending'; })) X.pending = null;
    flashNote(st, note);
    return { ok: true, note: note, flash: st.flash };
  }
  function xnGift(st, id) {
    var X = ensureX(st), g = X.girls[id], cost = Q.XIUNU.giftCost;
    if (!g || !galive(g) || g.turned) return { ok: false, why: 'ไม่สามารถมอบของขวัญให้ได้' };
    if (g.giftT === st.t) return { ok: false, why: 'มอบของขวัญแก่นางแล้วในฤดูนี้' };
    if (st.S.silver < cost) return { ok: false, why: 'เงินตำลึงไม่พอ' };
    st.flash = null; applyFx(st, { silver: -cost });
    g.loyalty = clampN(g.loyalty + (g.agent ? 3 : 6), 0, 100); g.giftT = st.t;
    return { ok: true, flash: st.flash };
  }
  function xnDismiss(st, id) {
    var X = ensureX(st), g = X.girls[id];
    if (!g || !galive(g)) return { ok: false, why: 'ไม่สามารถทำได้' };
    st.flash = null;
    var wasLoyal = !g.turned && g.loyalty >= 60 && !g.agent;
    g.status = 'gone';
    if (g.turned) applyFx(st, { threat: -2 }); else if (g.agent) applyFx(st, { threat: -1 });
    if (wasLoyal) applyFx(st, { virtue: -2 });
    return { ok: true, flash: st.flash };
  }
  function applyXn(st, o) {
    var X = ensureX(st), g = X.focus && X.girls[X.focus];
    if (!g) return;
    ['loyalty', 'ambition', 'favor'].forEach(function (k) { if (o[k] !== undefined) g[k] = clampN(g[k] + roll(st, o[k]), 0, 100); });
    if (o.rank) g.rank = Math.max(1, g.rank + o.rank);
    if (o.status) g.status = o.status;
    if (o.turned !== undefined) { g.turned = !!o.turned; if (!o.turned) g.faction = 'none'; }
    if (o.expose) { g.exposed = true; g.known.agent = 'yes'; g.known.arch = true; }
    if (o.graduated) g.graduated = true;
  }
  var GSEL = {
    any: function (g) { return galive(g); },
    ally: function (g) { return galive(g) && !g.turned && g.loyalty >= 55; },
    ally_court: function (g) { return (g.status === 'sponsored' || g.status === 'kept') && !g.turned && g.loyalty >= 55; },
    sponsored: function (g) { return g.status === 'sponsored' && !g.turned; },
    ambitious: function (g) { return g.status === 'sponsored' && !g.turned && g.ambition >= 60; },
    rising: function (g) { return (g.status === 'sponsored' || g.status === 'kept') && !g.turned && g.favor >= 22; },
    graduate: function (g) { return g.status === 'sponsored' && !g.turned && g.rank >= 3 && g.loyalty >= 62 && !g.graduated; },
    turning: function (g) { return g.turned && !g.turnSeen && galive(g); },
    rival_fav: function (g) { return g.status === 'kept' && g.favor >= 28 && (g.turned || g.agent || g.faction === 'empress' || g.faction === 'consort'); },
    rejected_noble: function (g) { return g.status === 'rejected' && g.power >= 2 && g.revenge && !g.revengeSeen; },
    maid_girl: function (g) { return g.status === 'maid' && g.loyalty >= 50; },
    maid_spy: function (g) { return g.status === 'maid' && g.agent && !g.exposed; },
  };
  function pickGirl(st, sel, peek) {
    var X = st.X; if (!X || !X.order) return null;
    var f = GSEL[sel]; if (!f) return null;
    var list = [], i;
    for (i = 0; i < X.order.length; i++) { var g = X.girls[X.order[i]]; if (g && f(g)) { if (peek) return g; list.push(g); } }
    if (!list.length) return null;
    return list[Math.floor(rnd(st) * list.length)];
  }
  function xnEnv(st) {
    var X = ensureX(st), n = 0, allies = 0, rivals = 0, sponsored = 0;
    X.order.forEach(function (id) {
      var g = X.girls[id]; if (!galive(g)) return;
      n++; if (GSEL.ally(g)) allies++; if (g.turned || (g.agent && g.status === 'kept' && g.favor >= 30)) rivals++; if (g.status === 'sponsored') sponsored++;
    });
    var fg = X.focus && X.girls[X.focus];
    var f = fg ? { status: fg.status, ambition: Math.round(fg.ambition), loyalty: Math.round(fg.loyalty), favor: Math.round(fg.favor), rank: fg.rank, agent: !!fg.agent, turned: !!fg.turned, arch: fg.arch, power: fg.power }
      : { status: '', ambition: 0, loyalty: 0, favor: 0, rank: 0, agent: false, turned: false, arch: '', power: 0 };
    return { pending: !!X.pending, n: n, allies: allies, rivals: rivals, sponsored: sponsored, batches: X.batches, quota: X.pending ? X.pending.quota - X.pending.sponsored : 0, f: f };
  }
  function xnFill(st, kind, idx) {
    var X = st.X; if (!X) return kind ? '' : 'น้องใหม่';
    if (idx) { var id = X.last && X.last.ids[+idx - 1]; return (id && X.girls[id]) ? X.girls[id].name : ''; }
    var g = X.focus && X.girls[X.focus];
    if (!g) return kind ? '' : 'น้องใหม่';
    if (kind === 'RANK') return g.rank ? Q.RANKS[Math.min(9, g.rank)].th : 'ผู้เข้าคัดเลือก';
    if (kind === 'CLAN') return g.clan;
    return g.name;
  }
  function focusLook(st) { var X = st.X, g = X && X.focus && X.girls[X.focus]; return g ? g.look : null; }
  function xnTick(st, rep) {
    var X = ensureX(st), A = Q.XIUNU, notes = [];
    if (st.rank >= 1 && !st.F.finale && st.t >= X.next) { newBatch(st); notes.push('รุ่นซิ่วหนี่ปีที่ ' + X.batches + ' เข้าวังแล้ว'); }
    if (X.pending && st.t > X.pending.deadline) { autoResolve(st); notes.push('ฮองเฮาจัดสรรผู้เข้าคัดเลือกที่ท่านยังไม่ได้ตัดสิน'); }
    var allyFav = 0, allyThr = 0, rivFav = 0, rivThr = 0, spyThr = 0;
    X.order.forEach(function (id) {
      var g = X.girls[id]; if (!galive(g)) return;
      if (st.t % 4 === 0) g.age++;
      if (g.status !== 'maid') {
        var pot = (g.charm + g.talent) / 2;
        g.favor = clampN(g.favor + Math.max(0, (pot - 30) / 12 * rnd(st) * 1.8) - 0.6, 0, 100);
        var cap = Math.min(6, Math.max(1, st.rank - 1));
        while (g.rank < cap && g.favor >= A.rankThr[g.rank]) {
          g.rank++; g.favor -= 4;
          if (g.status === 'sponsored' && !g.turned) notes.push(g.name + ' ในสังกัดได้เลื่อนเป็น' + Q.RANKS[g.rank].th);
        }
      }
      if (g.arch === 'schemer' || g.agent) g.ambition = clampN(g.ambition + 1.2 * rnd(st), 0, 100);
      else if (g.arch === 'highborn' || g.arch === 'beauty') g.ambition = clampN(g.ambition + 0.5 * rnd(st), 0, 100);
      if (g.status === 'sponsored') g.loyalty = clampN(g.loyalty + ((g.ambition > 70 && g.rank >= st.rank - 2) ? -2.2 : 0.35), 0, 100);
      else if (g.status === 'maid') g.loyalty = clampN(g.loyalty + 0.2, 0, 95);
      else g.loyalty = clampN(g.loyalty + (g.loyalty > 40 ? -0.15 : 0.15), 0, 100);
      if (!g.turned && g.status !== 'maid' && g.rank >= 2 && g.ambition >= 75 && g.loyalty < 45) {
        g.turned = true; g.faction = g.agent || 'rival'; st.queue.push({ id: 'xn_turn', due: st.t });
      }
      if (!g.turned && g.loyalty >= 55) {
        if (g.status === 'sponsored' && g.favor >= 20) allyFav += 0.25;
        if ((g.status === 'sponsored' || g.status === 'maid') && g.loyalty >= 60) allyThr -= 0.35;
      }
      if ((g.turned || (g.agent && g.status === 'kept')) && g.favor >= 30 && g.rank <= st.rank) { rivFav -= 0.4; rivThr += 0.3; }
      if (g.agent && !g.exposed && (g.status === 'sponsored' || g.status === 'maid')) spyThr += 0.4;
    });
    var fr = X.fr;
    fr.favor = (fr.favor || 0) + clampN(allyFav, 0, 0.75) + clampN(rivFav, -1.2, 0);
    fr.threat = (fr.threat || 0) + clampN(allyThr, -1.05, 0) + clampN(rivThr, 0, 0.9) + clampN(spyThr, 0, 0.8);
    var out = {};
    ['favor', 'threat'].forEach(function (k) { var v = fr[k], n = v >= 0 ? Math.floor(v) : Math.ceil(v); if (n) { fr[k] = v - n; out[k] = n; } });
    if (out.favor) notes.push(out.favor > 0 ? 'สนมในสังกัดช่วยกราบทูลเรื่องดีๆ ของท่านแก่ฮ่องเต้ (ความโปรดปราน +' + out.favor + ')' : 'รัศมีของสนมหน้าใหม่บดบังท่านต่อพระเนตรฮ่องเต้ (ความโปรดปราน ' + out.favor + ')');
    if (out.threat) notes.push(out.threat < 0 ? 'คนของท่านคอยดูต้นทางให้ ภัยรอบกายลดลง' : 'มีสายตาจากรุ่นใหม่จับจ้องท่านอยู่ (ภัยรอบกาย +' + out.threat + ')');
    if (Object.keys(out).length) applyFx(st, out);
    st.flash = null;
    if (rep) rep.xn = notes;
  }
  function bucketAmb(v) { return v < 35 ? 0 : v < 65 ? 1 : 2; }
  function xnCard(st, g) {
    var A = Q.XIUNU, a = A.archetypes[g.arch], k = g.known || {};
    var seen = (g.status === 'sponsored' || g.status === 'maid') && st.t - g.t0 >= 4;
    var knowArch = !!k.arch || seen || g.turned;
    var amb = k.ambition !== undefined ? k.ambition : ((g.status === 'sponsored' && st.t - g.t0 >= 8) || g.turned ? bucketAmb(g.ambition) : null);
    var showLoy = g.status === 'sponsored' || g.status === 'maid' || !!k.done;
    return { id: g.id, name: g.name, clan: g.clan, banner: g.banner, side: g.side, sideTh: A.sideTh[g.side], power: g.power, age: g.age, han: g.han, blurb: g.blurb,
      status: g.status, statusTh: A.statusTh[g.status], rank: g.rank, rankTh: g.rank ? Q.RANKS[Math.min(9, g.rank)].th : 'ผู้เข้าคัดเลือก',
      charm: g.charm, wit: g.wit, talent: g.talent, arch: knowArch ? g.arch : null, archTh: knowArch ? a.th : null, ambition: amb,
      agentKnown: k.agent === 'yes' ? 'yes' : (k.agent === 'no' ? 'no' : null), agentTh: g.agent ? A.agentTh[g.agent] : null,
      favor: Math.round(g.favor), loyalty: showLoy ? Math.round(g.loyalty) : null, turned: !!g.turned, giftOk: g.giftT !== st.t, look: g.look, batch: g.batch,
      sponsorCost: sponsorCost(g), investigated: !!k.done, graduated: !!g.graduated };
  }
  function xiunu(st) {
    var X = ensureX(st), P = X.pending, A = Q.XIUNU;
    var cards = X.order.map(function (id) { return xnCard(st, X.girls[id]); });
    var by = function (f) { return cards.filter(f); };
    return {
      batches: X.batches, nextIn: Math.max(0, X.next - st.t), silver: st.S.silver, investigateCost: A.investigateCost, giftCost: A.giftCost, participateRank: A.participateRank,
      pending: P ? { no: P.no, deadlineIn: Math.max(0, P.deadline - st.t), quota: P.quota, left: P.quota - P.sponsored, ids: P.ids.slice() } : null,
      pendingCards: P ? by(function (c) { return P.ids.indexOf(c.id) >= 0 && c.status === 'pending'; }) : [],
      mine: by(function (c) { return c.status === 'sponsored' || c.status === 'maid'; }),
      palace: by(function (c) { return c.status === 'kept'; }),
      gone: by(function (c) { return c.status === 'rejected' || c.status === 'gone'; }),
      all: cards,
    };
  }
  /* validator helper: create one girl for every selector so xn events can be probed */
  function xnProbe(st) {
    var X = ensureX(st), mk = function (o) { var g = genGirl(st, X); X.girls[g.id] = g; X.order.push(g.id); Object.keys(o).forEach(function (k) { g[k] = o[k]; }); return g; };
    mk({ status: 'sponsored', loyalty: 70, favor: 30, rank: 3, ambition: 65, turned: false, agent: null });
    mk({ status: 'kept', turned: true, turnSeen: false, favor: 40, rank: 2, faction: 'consort' });
    mk({ status: 'rejected', power: 3, revenge: true, clan: 'ว่านหยาน' });
    mk({ status: 'maid', loyalty: 70, agent: null });
    mk({ status: 'maid', loyalty: 55, agent: 'empress', exposed: false });
    X.focus = X.order[0];
    X.last = { no: 1, ids: X.order.slice(0, 3), t: st.t };
    return X;
  }


  /* ---------------- tablet (พลิกป้าย) — state, env, fx (round logic below) ---------------- */
  function ensureT(st) {
    if (!st.T || typeof st.T !== 'object') st.T = { mood: Q.TABLET.moodStart, hist: [], boost: 0, struck: 0, miss: 0, me: false, meNow: false, lastMe: false, boughtT: -1 };
    var T = st.T; if (!T.hist) T.hist = [];
    return T;
  }
  function moodTh(m) { var L = Q.TABLET.moodTh, i; for (i = 0; i < L.length; i++) if (m < L[i][0]) return L[i][1]; return L[L.length - 1][1]; }
  function tabletEnv(st) {
    var T = ensureT(st);
    return { mood: Math.round(T.mood), me: !!T.me, miss: T.miss || 0, struck: T.struck || 0, boost: T.boost || 0, nights: Number(st.F.tb_nights) || 0 };
  }
  function applyTablet(st, o) {
    var T = ensureT(st), TB = Q.TABLET;
    if (o.mood !== undefined) T.mood = clampN(T.mood + roll(st, o.mood), TB.moodMin, TB.moodMax);
    if (o.boost) T.boost = clampN((T.boost || 0) + o.boost, 0, TB.boostCap);
    if (o.strike) T.struck = Math.max(0, (T.struck || 0) + o.strike);
  }


  /* ---------------- tablet round (พลิกป้าย) ---------------- */
  var TB_NPC = ['consort', 'lu', 'shu', 'chu', 'friend'];
  function tbNpcOk(st, id) {
    var F = st.F;
    if (id === 'consort') return !F.niohuru_down;
    if (id === 'lu') return !F.lu_exposed;
    if (id === 'chu') return !!F.chu_alive && !F.chu_down;
    if (id === 'friend') return !!F.friend_alive;
    return true;
  }
  function tabletCandidates(st) {
    var out = [], TB = Q.TABLET, X = ensureX(st);
    TB_NPC.forEach(function (id) { if (tbNpcOk(st, id)) out.push({ id: id, kind: 'npc', name: Q.CHARS[id].short, w: TB.npc[id] }); });
    X.order.forEach(function (gid) {
      var g = X.girls[gid];
      if (!g || !galive(g) || g.status === 'maid' || g.rank < 2) return;
      out.push({ id: g.id, kind: 'girl', name: g.name, gid: g.id, w: Math.max(1, 4 + g.favor * 0.45 + (g.charm - 40) * 0.3 + g.rank * 1.8 + (g.turned ? 3 : 0)) });
    });
    return out;
  }
  function myTabletParts(st) {
    var T = ensureT(st), TB = Q.TABLET, S = st.S, R = st.R, we = wardrobeEff(st), parts = [], blocked = null;
    function add(label, v) { parts.push({ label: label, v: Math.round(v * 10) / 10 }); }
    var charmK = T.mood >= 65 ? 0.32 : 0.25, talentK = T.mood < 45 ? 0.28 : 0.15;
    add('พื้นฐาน', 6);
    add('ความโปรดปราน', S.favor * 0.45);
    add('ฐานันดร', st.rank * 1.5);
    add('โฉมงาม', (S.charm - 40) * charmK);
    add('พรสวรรค์', (S.talent - 40) * talentK);
    add('ขันทีจางฝู', R.eunuch * 0.12);
    add('เครื่องแต่งกาย', we.chk.charm * 0.5 + (we.set ? 3 : 0));
    if (T.boost) add('ฝากขันทีจัดคิว', T.boost);
    if (R.empress < 0) add('ฮองเฮาไม่พอพระทัย', R.empress * 0.2);
    if (R.dowager < 0) add('ไทเฮาไม่พอพระทัย', R.dowager * 0.15);
    var total = 0; parts.forEach(function (p) { total += p.v; });
    total = Math.max(1, total);
    if (T.lastMe) { var before = total; total = before * TB.repeatPenalty; add('เพิ่งถูกเรียกเข้าเฝ้า (ฮ่องเต้โปรดความหลากหลาย)', total - before); }
    if (T.struck > 0) blocked = 'ชื่อถูกขีดออกจากป้าย';
    else if (S.health < 25 || st.F.poisoned) blocked = 'ป่วยหนัก — ป้ายถูกพลิกคว่ำ';
    else if (st.rank < TB.minRank) blocked = 'ยังไม่มีป้ายชื่อ';
    return { parts: parts, total: total, blocked: blocked };
  }
  function tbPickCount(mood) { var P = Q.TABLET.picks; return mood >= 70 ? P.hi : mood < 35 ? P.lo : P.base; }
  function tbSample(rng, list, n) {
    var pool = list.slice(), out = [], i, tot, r;
    while (out.length < n && pool.length) {
      tot = 0; pool.forEach(function (c) { tot += c.w; });
      r = rnd(rng) * tot;
      for (i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) break; }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }
  function tabletRound(st, rep) {
    var T = ensureT(st), TB = Q.TABLET, X = ensureX(st), notes = [], picks = [], mw = null;
    T.me = false; T.meNow = false;
    if (st.F.emperor_dead || st.F.finale || st.rank < TB.minRank) { if (rep) rep.tablet = notes; return; }
    T.mood = clampN(T.mood + ri(st, -8, 8) + Math.round((50 - T.mood) * 0.15), TB.moodMin, TB.moodMax);
    if (T.struck > 0) T.struck--;
    if (st.rank >= TB.empressRank) {
      if (rnd(st) < TB.empressChance) T.me = true;
    } else {
      var cands = tabletCandidates(st); mw = myTabletParts(st);
      if (!mw.blocked) cands.push({ id: 'me', kind: 'me', name: st.name, w: mw.total });
      picks = tbSample(st, cands, tbPickCount(T.mood));
      picks.forEach(function (c) {
        if (c.kind === 'me') T.me = true;
        else if (c.kind === 'girl') { var g = X.girls[c.gid]; g.favor = clampN(g.favor + ri(st, 3, 6), 0, 100); }
      });
    }
    T.boost = 0;
    if (!T.me && T.struck <= 0 && st.rank < TB.empressRank && (st.R.empress <= -25 || (st.R.dowager <= -25 && !st.F.dowager_dead)) && rnd(st) < 0.45) {
      T.struck = 2;
      if (EV['tb_o_struck']) st.queue.push({ id: 'tb_o_struck', due: st.t });
      notes.push('ฮองเฮาหรือไทเฮาสั่งขีดชื่อของท่านออกจากป้ายชั่วคราว');
    }
    T.lastMe = T.me; T.miss = T.me ? 0 : (T.miss || 0) + 1;
    if (T.me) { st.F.tb_nights = (Number(st.F.tb_nights) || 0) + 1; T.meNow = true; }
    var names = picks.filter(function (c) { return c.kind !== 'me'; }).map(function (c) { return c.name; });
    if (st.rank >= TB.empressRank) notes.push(T.me ? 'ฮ่องเต้เสด็จตำหนักขุนหนิงตามวาระ' : 'ฤดูนี้ฮ่องเต้ไม่ได้เสด็จตำหนักขุนหนิง');
    else {
      notes.push('อารมณ์ฮ่องเต้: ' + moodTh(T.mood) + (names.length ? ' · ทรงพลิกป้ายของ ' + names.join(', ') : ''));
      notes.push(T.me ? 'ป้ายของท่านถูกพลิก — ท่านจะถูกเรียกเข้าเฝ้า' : 'ป้ายของท่านไม่ถูกพลิกในฤดูนี้' + (mw && mw.blocked ? ' (' + mw.blocked + ')' : ''));
    }
    T.hist.push({ t: st.t, mood: Math.round(T.mood), me: T.me, empress: st.rank >= TB.empressRank, blocked: mw && mw.blocked || null,
                  picks: picks.filter(function (c) { return c.kind !== 'me'; }).map(function (c) { return { id: c.id, name: c.name, kind: c.kind }; }) });
    while (T.hist.length > TB.hist) T.hist.shift();
    if (rep) rep.tablet = notes;
  }
  function tabletOdds(st) {
    var T = ensureT(st), TB = Q.TABLET, mw = myTabletParts(st);
    if (st.rank >= TB.empressRank) return { empress: true, rows: [], myPct: Math.round(TB.empressChance * 100), mw: mw, picks: 0 };
    var list = tabletCandidates(st);
    if (!mw.blocked && st.rank >= TB.minRank) list.push({ id: 'me', kind: 'me', name: st.name, w: mw.total });
    var n = tbPickCount(T.mood), cnt = {}, r = { seed: (st.seed ^ Math.imul(st.t + 7, 2654435761)) | 0 }, i;
    list.forEach(function (c) { cnt[c.id] = 0; });
    for (i = 0; i < TB.trials; i++) tbSample(r, list, n).forEach(function (c) { cnt[c.id]++; });
    var rows = list.map(function (c) { return { id: c.id, name: c.name, kind: c.kind, pct: Math.round(cnt[c.id] / TB.trials * 100), w: Math.round(c.w) }; })
      .sort(function (a, b) { return b.pct - a.pct; });
    var me = rows.filter(function (x) { return x.id === 'me'; })[0];
    return { empress: false, rows: rows, myPct: me ? me.pct : 0, mw: mw, picks: n };
  }
  function tabletInfo(st) {
    var T = ensureT(st), TB = Q.TABLET, o = tabletOdds(st), locked = st.rank < TB.minRank;
    var canBoost = !locked && !o.empress && !T.struck && T.boughtT !== st.t && (T.boost || 0) < TB.boostCap && st.S.silver >= TB.boostCost;
    return {
      locked: locked, lockedWhy: locked ? 'ต้าอิ้งยังไม่มีป้ายชื่อ — เมื่อเลื่อนเป็น' + Q.RANKS[TB.minRank].th + ' ท่านจะมีป้ายชื่อเขียวของตนเอง' : null,
      empress: o.empress, mood: Math.round(T.mood), moodTh: moodTh(T.mood), picks: o.picks, rows: o.rows, myPct: o.myPct,
      parts: o.mw.parts, total: Math.round(o.mw.total * 10) / 10, blocked: o.mw.blocked, boost: T.boost || 0, boostCost: TB.boostCost, boostGain: TB.boostGain,
      canBoost: canBoost, boostWhy: T.boughtT === st.t ? 'ฝากขันทีไว้แล้วในฤดูนี้' : (T.boost || 0) >= TB.boostCap ? 'ฝากเต็มเพดานแล้ว' : T.struck ? 'ชื่อถูกขีดอยู่' : st.S.silver < TB.boostCost ? 'เงินตำลึงไม่พอ' : null,
      hist: T.hist.slice().reverse(), miss: T.miss || 0, nights: Number(st.F.tb_nights) || 0, struck: T.struck || 0, silver: st.S.silver,
    };
  }
  function tabletBoost(st) {
    var T = ensureT(st), TB = Q.TABLET;
    if (st.rank < TB.minRank || st.rank >= TB.empressRank) return { ok: false, why: 'ใช้ไม่ได้ในขั้นนี้' };
    if (T.struck > 0) return { ok: false, why: 'ชื่อของท่านถูกขีดอยู่ การฝากขันทีไม่ช่วยอะไร' };
    if (T.boughtT === st.t) return { ok: false, why: 'ฝากขันทีไว้แล้วในฤดูนี้' };
    if ((T.boost || 0) >= TB.boostCap) return { ok: false, why: 'ฝากเต็มเพดานแล้ว' };
    if (st.S.silver < TB.boostCost) return { ok: false, why: 'เงินตำลึงไม่พอ' };
    st.flash = null; applyFx(st, { silver: -TB.boostCost, rel: { eunuch: 2 } });
    T.boost = Math.min(TB.boostCap, (T.boost || 0) + TB.boostGain); T.boughtT = st.t;
    return { ok: true, flash: st.flash };
  }

  /* ---------------- ranks ---------------- */
  function promote(st) {
    var from = st.rank; if (from >= 9) return;
    st.rank = from + 1; st.sir = 0; st.promoRetry = 0; st.promoReady = null;
    st.promoted = { from: from, to: st.rank, title: rankTitle(st), zh: Q.RANKS[st.rank].zh };
    st.F['rank' + st.rank] = true;
    var r = Q.RANKS[st.rank];
    if (r.onPromote) applyFx(st, r.onPromote);
    var gifts = grantsFor(st, st.rank, false);
    validateWardrobe(st);
    st.promoted.gifts = gifts.map(function (id) { return WI[id].th; });
    st.log.push({ t: st.t, text: 'เลื่อนขั้นเป็น' + r.th + ' (' + r.zh + ')' });
  }
  function demote(st, n) {
    var from = st.rank;
    st.rank = Math.max(0, st.rank - n); st.sir = 0; st.promoReady = null;
    if (st.rank < 1) { st.rank = 1; if (!st.pendingEnding) st.pendingEnding = 'end_cold_palace'; }
    validateWardrobe(st);
    st.log.push({ t: st.t, text: 'ถูกลดขั้นเหลือ' + Q.RANKS[st.rank].th });
    st.demoted = { from: from, to: st.rank };
  }
  function gate(st) {
    var g = Q.GATES[st.rank]; if (!g) return null;
    var favHave = st.S.favor; (st.fh || []).forEach(function (v) { if (v > favHave) favHave = v; });
    var need = [
      { k: 'time', label: 'อยู่ในตำแหน่งครบ (ฤดู)', have: st.sir, want: g.minSeasons, ok: st.sir >= g.minSeasons },
      { k: 'favor', label: 'ความโปรดปราน', have: favHave, want: g.favor, ok: favHave >= g.favor },
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
    if (ev.girl && !pickGirl(st, ev.girl, true)) return false;
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
    var Tn = ensureT(st);
    if (Tn.meNow) {
      Tn.meNow = false;
      var te = pickEvent(st, { tag: 'tablet', exclude: L });
      if (te) L.push(te.id);
      else { applyFx(st, { favor: 4, threat: 1 }); st.flash = null; st.log.push({ t: st.t, text: 'ท่านถูกเรียกเข้าเฝ้ายามค่ำ' }); }
    }
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
    st.fh = (st.fh || []).concat([st.S.favor]).slice(-3);   // recent favor peaks count toward promotion gates
    var f0 = st.S.favor; st.S.favor = Math.max(0, f0 - C.favorDecay); rep.favorLoss = f0 - st.S.favor;
    var th0 = st.S.threat;
    var dTh = -C.threatDecay + Math.floor(st.S.favor / C.threatFavorDiv) + Math.floor(st.S.prestige / C.threatPrestigeDiv) + (st.rank >= C.threatRankFrom ? 1 : 0);
    st.S.threat = clampStat('threat', th0 + dTh); rep.threatDelta = st.S.threat - th0;
    // wardrobe drift (fractions accumulate until they reach a whole point)
    var we = wardrobeEff(st), fr = ensureW(st).fr, wfl = {};
    fr.threat = (fr.threat || 0) + we.thr; fr.prestige = (fr.prestige || 0) + we.pre; fr.virtue = (fr.virtue || 0) + we.vir; fr.favor = (fr.favor || 0) + we.fav;
    ['threat', 'prestige', 'virtue', 'favor'].forEach(function (k) {
      var v = fr[k], n = v >= 0 ? Math.floor(v) : Math.ceil(v);
      if (n) { fr[k] = v - n; wfl[k] = n; }
    });
    if (Object.keys(wfl).length) { applyFx(st, wfl); rep.wardrobe = wfl; }
    st.flash = null;
    var h0 = st.S.health;
    if (st.F.poisoned) {
      st.S.health = clampStat('health', st.S.health - C.poisonDrain); rep.notes.push('พิษในกายยังกัดกินสุขภาพของท่าน');
      var cure = C.poisonSelfCure + (st.R.doctor >= 30 ? 0.25 : 0);
      if (rnd(st) < cure) { delete st.F.poisoned; rep.notes.push('พิษจางลงจนหมดไปเอง'); }
    } else if (st.S.health > 0 && st.S.health < 70) st.S.health = clampStat('health', st.S.health + C.healthRegen);
    if (st.t % 4 === 3 && st.rank <= 2) { st.S.health = clampStat('health', st.S.health - C.winterChill); rep.notes.push('ฤดูหนาวเยือกเย็นเกินกว่าเสื้อผ้าบางๆ จะต้านไหว'); }
    rep.healthDelta = st.S.health - h0;
    st.t++; st.sir++; st.ap = C.apPerSeason;
    xnTick(st, rep);
    tabletRound(st, rep);
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
    if (!st.pendingEnding) { var se = systemEnd(st); if (se) st.pendingEnding = se; }
    st.phase = (ev || st.pendingEnding) ? 'events' : 'hub';
    return { ok: true, action: a.id, th: a.th, line: line, flash: st.flash, event: ev ? ev.id : null };
  }
  function hub(st) {
    return { date: dateInfo(st), rank: st.rank, rankTitle: rankTitle(st), ap: st.ap, actions: actions(st), gate: gate(st), attack: attackChance(st) };
  }

  /* ---------------- event runtime ---------------- */
  function nextPending(st) {
    if (st.cur || st.phase === 'ended') return null;
    if (st.pendingEnding) { var e = st.pendingEnding; st.pendingEnding = null; if (EV[e]) return e; warn('missing ending event', e); }
    while (st.pending.length) {
      var id = st.pending.shift();
      if (!EV[id]) { warn('missing pending event', id); continue; }
      if (st.F.finale && (EV[id].kind === 'random' || EV[id].kind === 'festival')) continue;   // finale started after this was queued
      return id;
    }
    st.phase = 'hub';
    return null;
  }
  function startEvent(st, id) {
    var ev = EV[id];
    if (!ev) { warn('startEvent: unknown event', id); st.cur = null; return false; }
    if (ev.girl) {
      var gg = pickGirl(st, ev.girl);
      if (!gg) { st.cur = null; return false; }
      ensureX(st).focus = gg.id;
      if (ev.girl === 'turning') { gg.turnSeen = true; if (pickGirl(st, 'turning', true)) st.queue.push({ id: 'xn_turn', due: st.t + 1 }); }
      if (ev.girl === 'rejected_noble') gg.revengeSeen = true;
    }
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
    var wb = null;
    stats.forEach(function (k) {
      var base = (k === 'luck') ? 50 : (st.S[k] !== undefined ? st.S[k] : 50);
      if (k !== 'luck') { wb = wb || wardrobeEff(st); base += wb.chk[k] || 0; }
      sum += base;
    });
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
    tabletInfo: tabletInfo, tabletBoost: tabletBoost, ensureT: ensureT, tabletRound: tabletRound,
    xiunu: xiunu, xnInvestigate: xnInvestigate, xnDecide: xnDecide, xnGift: xnGift, xnDismiss: xnDismiss, focusLook: focusLook, ensureX: ensureX, xnProbe: xnProbe, xnQuota: xnQuota,
    wardrobe: wardrobe, wardrobeEff: wardrobeEff, equip: equip, unequip: unequip, buy: buy, give: giveItem, look: look, ensureW: ensureW, effLines: effLines,
    event: function (id) { return EV[id]; }, action: function (id) { return ACT[id]; },
  };
})();
