#!/usr/bin/env node
/* bot.js — headless playthrough simulator for balance + dead-end detection.
   Usage:
     node tools/bot.js --runs=300 --policy=smart|random|gentle|ruthless --origin=all|noble|scholar|maid [--sample] [--seed=1]
     node tools/bot.js --trace --seed=7 --origin=maid --policy=smart     # print one run, event by event
   Reports: ending distribution, rank reached, seasons per rank, never-seen events, stuck runs, crashes. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const flag = n => process.argv.includes('--' + n);
const RUNS = +arg('runs', 200), POLICY = arg('policy', 'smart'), ORIGIN = arg('origin', 'all'), SEED0 = +arg('seed', 1), TRACE = flag('trace');
const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error } });
const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('js/core_data.js'); load('js/logic.js');
fs.readdirSync(path.join(ROOT, 'js/data')).filter(f => f.endsWith('.js') && (flag('sample') || f !== '00_sample.js')).sort().forEach(f => load('js/data/' + f));
const { Q, QL } = ctx; QL.reindex();

let rs = SEED0 * 7919;
const rr = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const pickR = arr => arr[Math.floor(rr() * arr.length)];

function choiceScore(st, raw, vch, pol) {
  const fxScore = fx => {
    if (!fx) return 0; let s = 0;
    const m = v => Array.isArray(v) ? (v[0] + v[1]) / 2 : v;
    const W = { favor: 1, prestige: 1.2, wit: 0.6, charm: 0.4, talent: 0.4, virtue: pol === 'ruthless' ? -0.3 : pol === 'gentle' ? 0.9 : 0.2, health: 0.5, silver: 0.03, threat: -0.5 };
    Object.keys(W).forEach(k => { if (fx[k] !== undefined) s += W[k] * m(fx[k]); });
    if (fx.rel) Object.keys(fx.rel).forEach(k => { s += 0.35 * m(fx.rel[k]); });
    if (fx.set) s += 0.5; if (fx.queue) s += 0.2;
    return s;
  };
  let s;
  if (raw.check) { const p = vch.pct / 100; s = p * fxScore(raw.winFx) + (1 - p) * fxScore(raw.loseFx) + fxScore(raw.fx) + (p - 0.5) * 6; }
  else s = fxScore(raw.fx);
  if (raw.cost) s -= (raw.cost.silver || 0) * 0.04;
  return s + rr() * 1.5;
}
function pickChoice(st, v) {
  const en = v.choices.filter(c => !c.disabled);
  if (POLICY === 'random') return pickR(en).i;
  const node = QL.event(v.ev).nodes[v.node];
  let best = null, bs = -1e9;
  en.forEach(c => { const s = choiceScore(st, node.choices[c.idx], c, POLICY); if (s > bs) { bs = s; best = c; } });
  return best.i;
}
function pickAction(st, acts) {
  if (POLICY === 'random') return pickR(acts);
  const g = QL.gate(st), unmet = k => g && g.need.some(n => n.k === k && !n.ok);
  const has = id => acts.find(a => a.id === id);
  if (st.S.health < 40) return has('a_tonic') || has('a_rest') || pickR(acts);
  if (st.S.threat > 40 && has('a_guard')) return has('a_guard');
  const order = [];
  if (unmet('favor')) order.push('a_serve', 'a_garden', 'a_dance', 'a_music');
  if (unmet('prestige')) order.push('a_empress', 'a_charity', 'a_palace', 'a_embroider', 'a_family', 'a_befriend');
  if (st.S.silver < 40) order.push('a_work');
  order.push('a_befriend', 'a_poetry', 'a_read', 'a_music', 'a_rest', 'a_investigate', 'a_dowager', 'a_reward');
  if (POLICY === 'ruthless') order.unshift('a_scheme');
  // weighted: earlier = likelier, with randomness
  const cand = order.map(id => has(id)).filter(Boolean);
  if (!cand.length) return pickR(acts);
  const i = Math.min(cand.length - 1, Math.floor(Math.pow(rr(), 1.8) * cand.length));
  return cand[i];
}

const seenGlobal = {};
function runGame(origin, seed) {
  const st = QL.newGame({ name: 'บอท', origin, gift: pickR(Object.keys(Q.GIFTS)), seed });
  const trace = [];
  const log = s => { if (TRACE) console.log(s); };
  let guard = 0; const rankSeasons = {}; let lastRank = st.rank, stuckAt = null;
  const play = () => {
    let id;
    while ((id = QL.nextPending(st))) {
      QL.startEvent(st, id); seenGlobal[id] = (seenGlobal[id] || 0) + 1;
      log('  ▶ event ' + id + ' [' + QL.event(id).kind + ']');
      let v, n = 0;
      while ((v = QL.view(st))) {
        if (n++ > 400) throw new Error('infinite loop in ' + id);
        if (v.promoted) { log('  ★ PROMOTED → ' + v.promoted.title); QL.ackPromotion(st); }
        if (v.kind === 'choice') { const i = pickChoice(st, v); log('    ? ' + v.choices[i].text.slice(0, 40) + (v.choices[i].pct != null ? ' (' + v.choices[i].pct + '%)' : '')); const r = QL.choose(st, i); if (r && r.success !== null) log('      → ' + (r.success ? 'success' : 'fail')); }
        else QL.advance(st);
      }
      if (st.phase === 'ended') return;
    }
  };
  try {
    while (st.phase !== 'ended' && guard++ < 400) {
      play(); if (st.phase === 'ended') break;
      const hub = QL.hub(st);
      log('S' + st.t + ' rank ' + st.rank + ' fav ' + st.S.favor + ' pre ' + st.S.prestige + ' hp ' + st.S.health + ' thr ' + st.S.threat + ' ¥' + st.S.silver);
      while (st.ap > 0) {
        const acts = QL.actions(st).filter(a => !a.disabled); if (!acts.length) break;
        const a = pickAction(st, acts); log('  • action ' + a.id);
        const r = QL.doAction(st, a.id); if (!r.ok) break;
        play(); if (st.phase === 'ended') break;
      }
      if (st.phase === 'ended') break;
      rankSeasons[st.rank] = (rankSeasons[st.rank] || 0) + 1;
      QL.endSeason(st);
    }
  } catch (e) { return { crash: e.message, st }; }
  return { st, rankSeasons };
}

const origins = ORIGIN === 'all' ? ['noble', 'scholar', 'maid'] : [ORIGIN];
const endings = {}, ranks = {}, byOrigin = {}, crashes = [], seasonsAtRank = {}, stuck = [];
let n = 0, summit = 0, totalSeasons = 0;
for (let i = 0; i < RUNS; i++) {
  const origin = origins[i % origins.length], seed = SEED0 * 1000 + i;
  if (TRACE) console.log('=== run origin=' + origin + ' seed=' + seed + ' policy=' + POLICY);
  const r = runGame(origin, seed); n++;
  if (r.crash) { crashes.push(origin + '#' + seed + ': ' + r.crash); continue; }
  const st = r.st;
  endings[st.ending || '(none)'] = (endings[st.ending || '(none)'] || 0) + 1;
  ranks[st.rank] = (ranks[st.rank] || 0) + 1;
  (byOrigin[origin] = byOrigin[origin] || { n: 0, summit: 0, ranks: 0 }).n++;
  byOrigin[origin].ranks += st.rank; if (st.rank >= 9) { byOrigin[origin].summit++; summit++; }
  totalSeasons += st.t;
  Object.keys(r.rankSeasons).forEach(k => { (seasonsAtRank[k] = seasonsAtRank[k] || []).push(r.rankSeasons[k]); });
  if (st.ending === 'end_twilight') { const g = QL.gate(st); stuck.push(origin + '#' + seed + ' rank ' + st.rank + ' unmet: ' + (g ? g.need.filter(x => !x.ok).map(x => x.k + ' ' + (x.have !== undefined ? x.have + '/' + x.want : '')).join(', ') : '-')); }
  if (TRACE) console.log('=== END ' + st.ending + ' rank ' + st.rank + ' t=' + st.t);
}
if (!TRACE) {
  console.log('\nRuns: ' + n + '  policy: ' + POLICY + '  summit (rank 9): ' + summit + ' (' + (100 * summit / Math.max(1, n)).toFixed(1) + '%)  avg seasons: ' + (totalSeasons / Math.max(1, n - crashes.length)).toFixed(1));
  console.log('\nFinal rank distribution:'); Object.keys(ranks).sort().forEach(k => console.log('  rank ' + k + ': ' + ranks[k]));
  console.log('\nBy origin:'); Object.keys(byOrigin).forEach(o => console.log('  ' + o + ': n=' + byOrigin[o].n + ' avg rank ' + (byOrigin[o].ranks / byOrigin[o].n).toFixed(2) + ' summit ' + byOrigin[o].summit));
  console.log('\nEndings:'); Object.keys(endings).sort((a, b) => endings[b] - endings[a]).forEach(k => console.log('  ' + String(endings[k]).padStart(4) + '  ' + k));
  console.log('\nMean seasons spent per rank:'); Object.keys(seasonsAtRank).sort().forEach(k => { const a = seasonsAtRank[k]; console.log('  rank ' + k + ': ' + (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) + ' (n=' + a.length + ')'); });
  const all = Q.events.filter(e => e.kind !== 'ending'), never = all.filter(e => !seenGlobal[e.id]);
  console.log('\nEvent coverage: ' + (all.length - never.length) + '/' + all.length + ' seen at least once');
  if (never.length) console.log('  never seen (' + never.length + '): ' + never.slice(0, 60).map(e => e.id).join(', ') + (never.length > 60 ? ' …' : ''));
  const unseenEnd = Q.events.filter(e => e.kind === 'ending' && !endings[e.id]);
  console.log('Endings never reached (' + unseenEnd.length + '): ' + unseenEnd.map(e => e.id).join(', '));
  if (stuck.length) { console.log('\nTwilight (timed-out) runs: ' + stuck.length); stuck.slice(0, 8).forEach(s => console.log('  ' + s)); }
  if (crashes.length) { console.log('\nCRASHES: ' + crashes.length); crashes.slice(0, 10).forEach(c => console.log('  ' + c)); process.exit(1); }
}
