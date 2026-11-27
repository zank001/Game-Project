#!/usr/bin/env node
/* validate.js — static + dynamic checks for content files.
   Usage:
     node tools/validate.js js/data/c02_rank1.js [more files...]   # per-file mode (cross-file refs → warnings)
     node tools/validate.js --all                                  # every js/data/*.js, full cross-file checks
     add --quiet to hide warnings, --walks=N to change random-walk count (default 40)
   Exit code 1 when any ERROR is found. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const QUIET = args.includes('--quiet');
const WALKS = (args.find(a => a.startsWith('--walks=')) || '--walks=40').split('=')[1] | 0;
const fileArgs = args.filter(a => !a.startsWith('--'));
let dataFiles;
if (ALL) dataFiles = fs.readdirSync(path.join(ROOT, 'js/data')).filter(f => f.endsWith('.js')).sort().map(f => path.join(ROOT, 'js/data', f));
else dataFiles = fileArgs.map(f => path.resolve(f));
if (!dataFiles.length) { console.error('usage: node tools/validate.js <files...> | --all'); process.exit(2); }

const errors = [], warns = [];
const E = (where, msg) => errors.push(where + ': ' + msg);
const W = (where, msg) => warns.push(where + ': ' + msg);

/* ---------- load into a vm context ---------- */
const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error } });
function run(file) {
  try { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file }); return true; }
  catch (e) { E(path.relative(ROOT, file), 'LOAD ERROR: ' + (e.message || e)); return false; }
}
if (!run(path.join(ROOT, 'js/core_data.js')) || !run(path.join(ROOT, 'js/logic.js'))) { report(); }
let fileOf = {};   // event id → file
for (const f of dataFiles) {
  const before = vm.runInContext('Q.events.length', ctx);
  if (!fs.existsSync(f)) { E(f, 'file not found'); continue; }
  run(f);
  const after = vm.runInContext('Q.events.length', ctx);
  vm.runInContext('Q.events.slice(' + before + ').forEach(function(e){ e.__file = ' + JSON.stringify(path.basename(f)) + '; })', ctx);
}
const Q = ctx.Q, QL = ctx.QL;
QL.reindex(); QL.setStrict(true);
const dups = Q.dups || [];
dups.forEach(d => E('duplicate', 'event id registered twice: ' + d));

/* ---------- constants ---------- */
const KINDS = ['random', 'chapter', 'chain', 'festival', 'promo', 'ending'];
const NODE_KEYS = ['who', 'x', 'text', 'card', 'bg', 'cast', 'fx', 'next', 'jump', 'choices', 'branch', 'promote', 'demote', 'ending'];
const CHOICE_KEYS = ['text', 'cond', 'req', 'why', 'hint', 'cost', 'fx', 'check', 'win', 'lose', 'winFx', 'loseFx', 'next', 'jump'];
const EV_KEYS = ['id', 'kind', 'title', 'minRank', 'maxRank', 'tags', 'season', 'weight', 'cond', 'trigger', 'prio', 'once', 'cooldown', 'bg', 'cast', 'start', 'nodes', 'ending', 'desc', '__file'];
const FX_KEYS = Q.STAT_KEYS.concat(['rel', 'set', 'unset', 'inc', 'queue', 'ap', 'log', 'note', 'give']);
const WHO = ['narrator'].concat(Object.keys(Q.CHARS).filter(k => k !== 'narrator'));
const PLACEHOLDERS = ['PLAYER', 'RANK', 'HEIR', 'YEAR', 'SEASON'];
const THAI = /[฀-๿]/;
const ids = new Set(Q.events.map(e => e.id));
const flagsRead = new Map(), flagsSet = new Set(Q.GLOBAL_FLAGS || []);
Object.keys(Q.INIT_FLAGS || {}).forEach(k => flagsSet.add(k));
Object.values(Q.ORIGINS).forEach(o => Object.keys(o.start.F || {}).forEach(k => flagsSet.add(k)));

function checkCond(where, expr, label) {
  if (expr === undefined || expr === null) return;
  if (typeof expr !== 'string') { E(where, label + ' must be a string expression'); return; }
  try {
    const ast = QL.parse(expr);
    // probe-evaluate with a throw-on-unknown-identifier env
    const st = QL.newState({ name: 'ทดสอบ', origin: 'noble', seed: 1 });
    QL.cond(expr, st);
  } catch (e) { E(where, label + ' bad expression "' + expr + '": ' + e.message); return; }
  (expr.match(/\bF\.([A-Za-z0-9_]+)/g) || []).forEach(m => { const n = m.slice(2); (flagsRead.get(n) || flagsRead.set(n, new Set()).get(n)).add(where); });
  (expr.match(/\bF\['([A-Za-z0-9_]+)'\]/g) || []).forEach(m => { const n = m.slice(3, -2); (flagsRead.get(n) || flagsRead.set(n, new Set()).get(n)).add(where); });
}
function checkFx(where, fx, label) {
  if (fx === undefined) return;
  if (!fx || typeof fx !== 'object' || Array.isArray(fx)) { E(where, label + ' must be an object'); return; }
  for (const k of Object.keys(fx)) {
    if (FX_KEYS.indexOf(k) < 0) { E(where, label + ' unknown fx key "' + k + '"'); continue; }
    const v = fx[k];
    if (Q.STAT_KEYS.indexOf(k) >= 0) {
      const nums = Array.isArray(v) ? v : [v];
      if (!nums.length || nums.length > 2 || nums.some(n => typeof n !== 'number' || !isFinite(n))) { E(where, label + '.' + k + ' must be number or [min,max]'); continue; }
      const lim = k === 'silver' ? 3000 : 30;
      if (nums.some(n => Math.abs(n) > lim)) W(where, label + '.' + k + ' = ' + JSON.stringify(v) + ' is very large (limit ' + lim + ')');
    } else if (k === 'rel') {
      Object.keys(v || {}).forEach(r => {
        if (Q.REL_KEYS.indexOf(r) < 0) E(where, label + '.rel unknown key "' + r + '"');
        const nums = Array.isArray(v[r]) ? v[r] : [v[r]];
        if (nums.some(n => typeof n !== 'number')) E(where, label + '.rel.' + r + ' must be number or [min,max]');
        else if (nums.some(n => Math.abs(n) > 40)) W(where, label + '.rel.' + r + ' very large');
      });
    } else if (k === 'set') {
      if (Array.isArray(v)) v.forEach(n => { if (typeof n !== 'string') E(where, label + '.set entries must be strings'); else flagsSet.add(n); });
      else if (v && typeof v === 'object') Object.keys(v).forEach(n => flagsSet.add(n));
      else E(where, label + '.set must be array or object');
    } else if (k === 'unset') { if (!Array.isArray(v)) E(where, label + '.unset must be an array'); }
    else if (k === 'inc') { if (!v || typeof v !== 'object') E(where, label + '.inc must be object'); else Object.keys(v).forEach(n => flagsSet.add(n)); }
    else if (k === 'queue') {
      if (!Array.isArray(v)) { E(where, label + '.queue must be an array of {id,in}'); continue; }
      v.forEach(q => {
        if (!q || typeof q.id !== 'string') E(where, label + '.queue entry needs id');
        else if (!ids.has(q.id)) (ALL ? E : W)(where, label + '.queue → unknown event "' + q.id + '"');
        if (q && q['in'] !== undefined && (!Number.isInteger(q['in']) || q['in'] < 0)) E(where, label + '.queue.in must be int >= 0');
      });
    } else if (k === 'give') {
      if (!Array.isArray(v)) E(where, label + '.give must be an array of wardrobe item ids');
      else v.forEach(id => { if (!(Q.WARDROBE && Q.WARDROBE.byId[id])) E(where, label + '.give unknown wardrobe item "' + id + '"'); });
    } else if (k === 'ap') { if (typeof v !== 'number') E(where, label + '.ap must be number'); }
    else if (k === 'log' || k === 'note') { if (typeof v !== 'string') E(where, label + '.' + k + ' must be a string'); else checkText(where, v, label + '.' + k, 140); }
  }
}
function checkText(where, text, label, max) {
  if (typeof text !== 'string' || !text.trim()) { E(where, label + ' must be a non-empty string'); return; }
  if (text.length > max * 1.6) E(where, label + ' too long (' + text.length + ' > ' + Math.round(max * 1.6) + ')');
  else if (text.length > max) W(where, label + ' long (' + text.length + ' > ' + max + ')');
  (text.match(/\{\{[^}]*\}\}/g) || []).forEach(p => { const n = p.slice(2, -2); if (PLACEHOLDERS.indexOf(n) < 0) E(where, label + ' unknown placeholder ' + p); });
  if (!THAI.test(text) && !/^[\s\W\d]*$/.test(text)) W(where, label + ' has no Thai characters');
  if (/<[a-z\/][^>]*>/i.test(text)) E(where, label + ' contains HTML — use plain text');
}

/* ---------- per-event static checks ---------- */
const promoHasPromote = {};
Q.events.forEach(ev => {
  const W0 = ev.id + (ev.__file ? ' [' + ev.__file + ']' : '');
  if (!/^[a-z0-9_]+$/.test(ev.id)) E(W0, 'id must match /^[a-z0-9_]+$/');
  Object.keys(ev).forEach(k => { if (EV_KEYS.indexOf(k) < 0) E(W0, 'unknown event field "' + k + '"'); });
  if (KINDS.indexOf(ev.kind) < 0) { E(W0, 'kind must be one of ' + KINDS.join('|')); return; }
  if (ev.kind !== 'ending' && (!ev.title || typeof ev.title !== 'string')) E(W0, 'title required');
  const lo = ev.minRank === undefined ? 1 : ev.minRank, hi = ev.maxRank === undefined ? 8 : ev.maxRank;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 0 || hi > 9 || lo > hi) E(W0, 'bad minRank/maxRank ' + lo + '..' + hi);
  if (ev.tags) ev.tags.forEach(t => { if (Q.TAGS.indexOf(t) < 0) E(W0, 'unknown tag "' + t + '"'); });
  if (ev.season) { if (!Array.isArray(ev.season) || ev.season.some(s => !(s >= 0 && s <= 3))) E(W0, 'season must be array of 0..3'); }
  if (ev.weight !== undefined && !(typeof ev.weight === 'number' && ev.weight > 0)) E(W0, 'weight must be > 0');
  checkCond(W0, ev.cond, 'cond'); checkCond(W0, ev.trigger, 'trigger');
  if (ev.kind === 'chapter' && !ev.trigger) W(W0, 'chapter without trigger will never start by itself (only via queue/jump)');
  if (ev.kind === 'festival' && !ev.season) E(W0, 'festival needs season:[..]');
  if (ev.kind === 'promo' && !/^promo_[1-8]_[2-9]$/.test(ev.id)) E(W0, 'promo id must be promo_<from>_<to>');
  if (ev.kind === 'ending') {
    const m = ev.ending;
    if (!m || ['good', 'neutral', 'bad', 'true'].indexOf(m.type) < 0 || !m.title || !m.hint) E(W0, 'ending event needs ending:{type:good|neutral|bad|true, title, hint}');
  }
  if (ev.kind === 'random' && !ev.bg) W(W0, 'bg missing');
  if (!ev.bg && ev.kind !== 'random') W(W0, 'bg missing');
  if (ev.bg && Q.BGS.indexOf(ev.bg) < 0) E(W0, 'unknown bg "' + ev.bg + '"');
  const checkCast = (cast, label) => { (cast || []).forEach(c => {
    if (!c || !Q.CHARS[c.c] || c.c === 'narrator') E(W0, label + ' bad cast char ' + (c && c.c));
    if (Q.POS.indexOf(c.pos) < 0) E(W0, label + ' bad cast pos ' + c.pos);
    if (c.x && Q.EXPRS.indexOf(c.x) < 0) E(W0, label + ' bad expression ' + c.x);
  }); };
  checkCast(ev.cast, 'cast');
  if (!ev.nodes || typeof ev.nodes !== 'object' || !Object.keys(ev.nodes).length) { E(W0, 'nodes missing'); return; }
  if (!ev.nodes[ev.start]) { E(W0, 'start node "' + ev.start + '" missing'); return; }

  const edges = {};
  Object.keys(ev.nodes).forEach(nid => {
    const n = ev.nodes[nid], w = W0 + '#' + nid;
    edges[nid] = [];
    Object.keys(n).forEach(k => { if (NODE_KEYS.indexOf(k) < 0) E(w, 'unknown node field "' + k + '"'); });
    if (n.who && WHO.indexOf(n.who) < 0) E(w, 'unknown speaker "' + n.who + '"');
    if (n.x && Q.EXPRS.indexOf(n.x) < 0) E(w, 'bad expression x:"' + n.x + '"');
    if (n.bg && Q.BGS.indexOf(n.bg) < 0) E(w, 'unknown bg "' + n.bg + '"');
    if (n.cast) checkCast(n.cast, nid + '.cast');
    if (n.text !== undefined) checkText(w, n.text, 'text', 200);
    if (n.card !== undefined) checkText(w, n.card, 'card', 120);
    if (n.who && n.who !== 'narrator' && n.who !== 'player' && n.text !== undefined) {
      const castIds = [].concat(ev.cast || [], n.cast || []).map(c => c.c);
      // speaker should usually be on stage somewhere in the event; soft check only
      const anyCast = Object.values(ev.nodes).some(m => (m.cast || []).some(c => c.c === n.who));
      if (castIds.indexOf(n.who) < 0 && !anyCast) W(w, 'speaker "' + n.who + '" is never in cast');
    }
    checkFx(w, n.fx, 'fx');
    if (n.next !== undefined) { if (!ev.nodes[n.next]) E(w, 'next → missing node "' + n.next + '"'); else edges[nid].push(n.next); }
    if (n.jump !== undefined) { if (!ids.has(n.jump)) (ALL ? E : W)(w, 'jump → unknown event "' + n.jump + '"'); }
    if (n.ending !== undefined && !ids.has(n.ending)) (ALL ? E : W)(w, 'ending → unknown event "' + n.ending + '"');
    if (n.promote && ev.kind === 'promo') promoHasPromote[ev.id] = true;
    if (n.promote && n.text === undefined && !n.next && !n.jump) W(w, 'promote on a silent terminal node — add a text line so the player sees the ceremony in context');
    if (n.branch) {
      if (n.text || n.card) W(w, 'branch node should be silent (no text)');
      if (!Array.isArray(n.branch) || !n.branch.length) E(w, 'branch must be a non-empty array');
      else n.branch.forEach((b, i) => {
        checkCond(w, b.cond, 'branch[' + i + '].cond');
        if (!ev.nodes[b.next]) E(w, 'branch[' + i + '].next → missing node "' + b.next + '"'); else edges[nid].push(b.next);
        if (!b.cond && i < n.branch.length - 1) W(w, 'unconditional branch entry before the last one');
      });
      if (n.branch[n.branch.length - 1].cond) W(w, 'last branch entry has a cond — add an unconditional fallback');
    }
    if (n.choices) {
      if (!Array.isArray(n.choices) || n.choices.length < 1) E(w, 'choices must be a non-empty array');
      else {
        if (n.choices.length < 2) W(w, 'only one choice');
        if (n.choices.length > 4) E(w, 'more than 4 choices');
        if (!n.text) E(w, 'choice node needs a prompt text');
        if (n.next) W(w, 'node has both next and choices — next is ignored');
        let safe = false;
        n.choices.forEach((c, i) => {
          const cw = w + '.choices[' + i + ']';
          Object.keys(c).forEach(k => { if (CHOICE_KEYS.indexOf(k) < 0) E(cw, 'unknown choice field "' + k + '"'); });
          checkText(cw, c.text, 'text', 60);
          if (c.text && c.text.length > 90) E(cw, 'choice text too long');
          checkCond(cw, c.cond, 'cond'); checkCond(cw, c.req, 'req');
          checkFx(cw, c.fx, 'fx'); checkFx(cw, c.winFx, 'winFx'); checkFx(cw, c.loseFx, 'loseFx');
          if (c.cost) { if (!c.cost.silver || c.cost.silver < 0) E(cw, 'cost must be {silver:n>0}'); else if (c.cost.silver > 3000) W(cw, 'cost huge'); }
          if (!c.req && !c.cost && !c.cond) safe = true;
          if (c.check) {
            const st = [].concat(c.check.stat);
            if (!c.check.stat || st.some(s => Q.STAT_KEYS.indexOf(s) < 0 && s !== 'luck')) E(cw, 'check.stat must be stat key(s) or "luck"');
            if (typeof c.check.dc !== 'number' || c.check.dc < 0 || c.check.dc > 100) E(cw, 'check.dc must be 0..100');
            (c.check.mods || []).forEach(m => { checkCond(cw, m.cond, 'check.mods.cond'); if (typeof m.add !== 'number') E(cw, 'check.mods.add must be number'); });
            if (!ev.nodes[c.win]) E(cw, 'win → missing node "' + c.win + '"'); else edges[nid].push(c.win);
            if (!ev.nodes[c.lose]) E(cw, 'lose → missing node "' + c.lose + '"'); else edges[nid].push(c.lose);
            if (c.next) W(cw, 'next ignored when check is present');
          } else {
            if (c.win || c.lose || c.winFx || c.loseFx) E(cw, 'win/lose/winFx/loseFx only valid with check');
            if (c.jump) { if (!ids.has(c.jump)) (ALL ? E : W)(cw, 'jump → unknown event "' + c.jump + '"'); }
            else if (!c.next) W(cw, 'choice has no next/jump → ends the event');
            else if (!ev.nodes[c.next]) E(cw, 'next → missing node "' + c.next + '"'); else edges[nid].push(c.next);
          }
        });
        if (!safe) W(w, 'no always-available choice (all have req/cost/cond)');
      }
    }
    if (!n.text && !n.card && !n.choices && !n.branch && !n.next && !n.jump && !n.fx && !n.promote && !n.demote && !n.ending) W(w, 'empty node');
  });
  // reachability
  const seen = new Set([ev.start]), stack = [ev.start];
  while (stack.length) { const c = stack.pop(); (edges[c] || []).forEach(t => { if (!seen.has(t)) { seen.add(t); stack.push(t); } }); }
  Object.keys(ev.nodes).forEach(n => { if (!seen.has(n)) W(W0 + '#' + n, 'unreachable node'); });
});

/* ---------- dynamic random-walk probe ---------- */
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function collectFlags(ev) {
  const names = new Set(); const s = JSON.stringify(ev);
  (s.match(/F\.([A-Za-z0-9_]+)/g) || []).forEach(m => names.add(m.slice(2)));
  (s.match(/F\[\\?'([A-Za-z0-9_]+)\\?'\]/g) || []).forEach(m => names.add(m.replace(/F\[\\?'|\\?'\]/g, '')));
  return Array.from(names);
}
let walkCount = 0, walkSteps = 0;
Q.events.forEach(ev => {
  if (!ev.nodes || !ev.nodes[ev.start]) return;
  const flagNames = collectFlags(ev);
  const lo = ev.minRank === undefined ? 1 : ev.minRank, hi = ev.maxRank === undefined ? 8 : ev.maxRank;
  const W0 = ev.id + (ev.__file ? ' [' + ev.__file + ']' : '');
  for (let w = 0; w < WALKS; w++) {
    const rng = mulberry(w * 7919 + ev.id.length * 31 + 17);
    const st = QL.newState({ name: 'ทดสอบ', origin: ['noble', 'scholar', 'maid'][w % 3], seed: w + 1 });
    st.rank = lo + Math.floor(rng() * (hi - lo + 1)); st.sir = Math.floor(rng() * 8); st.t = Math.floor(rng() * 60);
    Q.STAT_KEYS.forEach(k => { st.S[k] = k === 'silver' ? Math.floor(rng() * 400) : Math.floor(rng() * 101); });
    Q.REL_KEYS.forEach(k => { st.R[k] = Math.floor(rng() * 160) - 60; });
    flagNames.forEach(n => { if (rng() < 0.5) st.F[n] = true; });
    try {
      QL.startEvent(st, ev.id);
      let steps = 0, v;
      while ((v = QL.view(st))) {
        if (++steps > 300) { E(W0, 'random walk exceeded 300 steps (infinite loop?)'); break; }
        if (v.kind === 'choice') {
          const en = v.choices.filter(c => !c.disabled);
          if (!en.length) { E(W0 + '#' + v.node, 'no enabled choice'); break; }
          QL.choose(st, en[Math.floor(rng() * en.length)].i);
        } else QL.advance(st);
      }
      walkSteps += steps; walkCount++;
      if (ev.kind === 'promo' && w === 0 && !promoHasPromote[ev.id]) E(W0, 'promo event has no promote:true node');
    } catch (e) { E(W0, 'random walk crashed: ' + e.message); break; }
  }
});

/* ---------- cross-file checks (--all) ---------- */
let coverage = null;
if (ALL) {
  (Q.ENDINGS_REQUIRED || []).forEach(id => { if (!ids.has(id)) E('endings', 'required ending missing: ' + id); else if (Q._byId[id].kind !== 'ending') E('endings', id + ' must have kind:"ending"'); });
  for (let r = 1; r <= 8; r++) if (!ids.has('promo_' + r + '_' + (r + 1))) E('promo', 'missing promo_' + r + '_' + (r + 1));
  flagsRead.forEach((where, name) => {
    if (!flagsSet.has(name) && !/^rank\d$/.test(name)) W('flags', 'F.' + name + ' is read in ' + Array.from(where).slice(0, 2).join(', ') + ' but never set');
  });
  // coverage matrix: rank × pool
  const pools = ['general', 'festival', 'chapter', 'promo'].concat(Q.TAGS.filter(t => t !== 'general'));
  coverage = {};
  for (let r = 0; r <= 9; r++) {
    coverage[r] = {};
    pools.forEach(p => {
      coverage[r][p] = Q.events.filter(e => {
        const lo = e.minRank === undefined ? 1 : e.minRank, hi = e.maxRank === undefined ? 8 : e.maxRank;
        if (r < lo || r > hi) return false;
        if (p === 'general') return e.kind === 'random' && (!e.tags || !e.tags.length || e.tags.indexOf('general') >= 0);
        if (p === 'festival') return e.kind === 'festival';
        if (p === 'chapter') return e.kind === 'chapter';
        if (p === 'promo') return e.kind === 'promo';
        return e.kind === 'random' && e.tags && e.tags.indexOf(p) >= 0;
      }).length;
    });
  }
  // actions that draw: each rank in their range should have at least 2 events
  Q.ACTIONS.forEach(a => {
    if (!a.draw) return;
    for (let r = Math.max(1, a.minRank || 0); r <= Math.min(8, a.maxRank === undefined ? 8 : a.maxRank); r++) {
      const n = coverage[r][a.draw];
      if (n < 2) W('coverage', 'action ' + a.id + ' (draw:' + a.draw + ') has only ' + n + ' event(s) at rank ' + r);
    }
  });
  for (let r = 1; r <= 8; r++) {
    if (coverage[r].general + coverage[r].festival < 8) W('coverage', 'rank ' + r + ' has only ' + (coverage[r].general + coverage[r].festival) + ' general+festival events');
    if (coverage[r].attack < 3) W('coverage', 'rank ' + r + ' has only ' + coverage[r].attack + ' attack events');
  }
}

report();

function report() {
  const rel = s => s;
  if (!QUIET) warns.slice(0, 400).forEach(w => console.log('  WARN  ' + rel(w)));
  if (warns.length > 400 && !QUIET) console.log('  ... ' + (warns.length - 400) + ' more warnings');
  errors.slice(0, 300).forEach(e => console.log('  ERROR ' + rel(e)));
  if (errors.length > 300) console.log('  ... ' + (errors.length - 300) + ' more errors');
  const evs = ctx.Q ? ctx.Q.events : [];
  const byKind = {}; evs.forEach(e => { byKind[e.kind] = (byKind[e.kind] || 0) + 1; });
  let nodes = 0; evs.forEach(e => { nodes += Object.keys(e.nodes || {}).length; });
  console.log('\n' + (errors.length ? '✗' : '✓') + ' ' + evs.length + ' events, ' + nodes + ' nodes ' + JSON.stringify(byKind) +
    ' | walks: ' + walkCount + ' | warnings: ' + warns.length + ' | errors: ' + errors.length);
  if (coverage) {
    const pools = Object.keys(coverage[1]);
    console.log('\ncoverage (events available per rank):');
    console.log('rank  ' + pools.map(p => p.slice(0, 8).padEnd(9)).join(''));
    for (let r = 0; r <= 9; r++) console.log(String(r).padEnd(6) + pools.map(p => String(coverage[r][p]).padEnd(9)).join(''));
  }
  process.exit(errors.length ? 1 : 0);
}
