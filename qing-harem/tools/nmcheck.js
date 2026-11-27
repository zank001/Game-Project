#!/usr/bin/env node
/* nmcheck.js — headless invariants for the naming system (docs/DESIGN.md §12).
   Usage: node tools/nmcheck.js [--runs=60] [--fake]    --fake injects a tiny pool when the real pools are missing */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const RUNS = +arg('runs', 60);
const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error } });
const load = f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('js/core_data.js'); load('js/logic.js');
fs.readdirSync(path.join(ROOT, 'js/data')).filter(f => f.endsWith('.js') && f !== '00_sample.js').sort().forEach(f => load('js/data/' + f));
const { Q, QL } = ctx; QL.reindex();
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } };
if (Q.NAMING.feng.length < 6 || Q.NAMING.extra.length < 3) {
  if (process.argv.includes('--fake')) {
    const T = ['virtue', 'gentle', 'beauty', 'wisdom', 'art', 'harmony', 'fortune', 'loyal', 'strong'], th = ['ลิ่ง', 'ฮุ่ย', 'ซุ่น', 'หว่าน', 'เสียน', 'เจีย', 'ชิ่ง', 'ฉุน', 'หรง', 'อี้หลิน', 'เจิน', 'เต๋อ', 'ตวน', 'จวง', 'จิ้ง', 'จิ่น'], zh = '令惠順婉嫻慶純容儀貞德端莊敬謹';
    if (Q.NAMING.feng.length < 6) for (let i = 0; i < 16; i++) Q.NAMING.feng.push({ id: 'f_t' + i, zh: zh[i], th: th[i], mean: 'ทดสอบ', tags: [T[i % 9]], w: 5, tone: i % 3 === 0 ? 'humble' : (i % 3 === 1 ? 'grand' : undefined) });
    if (Q.NAMING.extra.length < 3) ['賢', '肅', '敏', '慎', '恭', '淑'].forEach((z, i) => Q.NAMING.extra.push({ id: 'x_t' + i, zh: z, th: ['เสียน', 'ซู่', 'หมิ่น', 'เซิ่น', 'กง', 'ซู'][i] + 'x', mean: 'ทดสอบ', tags: ['virtue'], pos: ['suf', 'pre', 'any'][i % 3], w: 5 }));
    QL.nmIdx();
  } else { console.log('no naming pools loaded yet (use --fake to test the logic with a tiny pool)'); process.exit(0); }
}
const NMn = Q.NAMING;
function newSt(origin, seed) { const st = QL.newGame({ name: 'หลันซี', origin, seed }); return st; }
// 1) style rules at every rank
['noble', 'scholar', 'maid'].forEach(o => {
  const st = newSt(o, 5), N = QL.ensureN(st);
  ok(QL.nmStyle(st, 0).th === 'หลันซี', o + ': rank 0 = given name');
  [1, 2, 3].forEach(r => { const s = QL.nmStyle(st, r); ok(s.th === N.clan + ' ' + Q.RANKS[r].th && s.mode === 'clan', o + ': rank ' + r + ' = clan + rank, got ' + s.th); });
  st.rank = 4; N.feng = NMn.feng[0].id; QL.ensureN(st);
  [4, 5, 6].forEach(r => { const s = QL.nmStyle(st, r); ok(s.th === NMn.feng[0].th + Q.RANKS[r].th && s.mode === 'feng', o + ': rank ' + r + ' = fenghao + rank, got ' + s.th); });
  N.extra = { id: NMn.extra[0].id, pos: 'suf' };
  const s7 = QL.nmStyle(st, 7); ok(s7.th === NMn.feng[0].th + NMn.extra[0].th + Q.RANKS[7].th, o + ': rank 7 has the extra word, got ' + s7.th);
  ok(QL.nmStyle(st, 6).th === NMn.feng[0].th + Q.RANKS[6].th, o + ': rank 6 has no extra word');
  N.extra.pos = 'pre'; const s8 = QL.nmStyle(st, 8); ok(s8.th === NMn.extra[0].th + NMn.feng[0].th + Q.RANKS[8].th, o + ': prefix extra at rank 8, got ' + s8.th);
});
// 2) legacy text upgrade
{
  const st = newSt('scholar', 9); st.rank = 2;
  ok(QL.fill(st, 'ฉางไจ้{{PLAYER}} อุปนิสัย') === 'เซิ่น ฉางไจ้ อุปนิสัย', 'legacy "ฉางไจ้{{PLAYER}}" → clan style, got ' + QL.fill(st, 'ฉางไจ้{{PLAYER}} อุปนิสัย'));
  ok(QL.fill(st, 'ท่าน{{RANK}} {{TITLE}} {{CLAN}}') === 'ท่านฉางไจ้ เซิ่น ฉางไจ้ เซิ่น', 'title/clan placeholders: ' + QL.fill(st, 'ท่าน{{RANK}} {{TITLE}} {{CLAN}}'));
}
// 3) full-run simulation: promotion → bestow, demotion → strip, uniqueness, early, regrant
let early = 0, grants = 0, extras = 0, strips = 0, regrants = 0, dupBad = 0, maxKindAge = 0;
for (let run = 0; run < RUNS; run++) {
  const st = newSt(['noble', 'scholar', 'maid'][run % 3], 100 + run);
  QL.ensureN(st);
  for (let step = 0; step < 220 && st.phase !== 'ended'; step++) {
    // drive events
    let g = 0, id;
    while ((id = QL.nextPending(st)) && g++ < 30) {
      QL.startEvent(st, id);
      let h = 0, v;
      while ((v = QL.view(st)) && h++ < 400) { if (v.kind === 'choice') QL.choose(st, v.choices.findIndex(c => !c.disabled)); else QL.advance(st); }
      if (st.promoted || st.demoted || st.nmCer) { st.promoted = null; st.demoted = null; st.nmCer = null; }
    }
    if (st.phase === 'ended') break;
    // push the state to make things happen
    if (step % 3 === 0 && st.rank < 8) { st.S.favor = 70; st.S.prestige = Math.max(st.S.prestige, 60); st.sir = 9; }
    if (step % 29 === 28 && st.rank >= 3) { QL.demote(st, 2); }
    if (step % 13 === 5 && st.rank >= 4) st.S.favor = 2;
    const N = st.N;
    const rep = QL.endSeason(st);
    // invariants
    const s = QL.nmStyle(st);
    if (st.rank >= 1 && st.rank < NMn.fengRank && !N.feng) ok(s.mode === 'clan', 'low rank without fenghao must be clan style');
    if (st.rank >= NMn.fengRank && N.feng && !N.stripped) ok(s.mode === 'feng', 'rank>=4 with fenghao uses it');
    if (N.feng && st.rank < NMn.fengRank && !N.ever) ok(false, 'fenghao without bestowal at low rank');
    // zh uniqueness vs girls
    const X = st.X, seen = {}; if (N.feng) seen[NMn.feng.find(f => f.id === N.feng).zh] = 1;
    X.order.forEach(id => { const gl = X.girls[id]; if (gl.feng && gl.status !== 'rejected' && gl.status !== 'gone') { const z = NMn.feng.find(f => f.id === gl.feng).zh; if (seen[z]) dupBad++; seen[z] = 1; } });
    if (N.kind) maxKindAge++; else maxKindAge = 0;
    ok(maxKindAge < 12, 'a naming moment must resolve within a few seasons (kind=' + N.kind + ')');
  }
  const H = st.N.hist; H.forEach(h => { if (h.kind === 'early') early++; if (h.kind === 'grant') grants++; if (h.kind === 'extra') extras++; if (h.kind === 'strip') strips++; if (h.kind === 'regrant') regrants++; });
}
ok(dupBad === 0, 'no two living concubines share a fenghao hanzi (' + dupBad + ' violations)');
console.log('runs ' + RUNS + ' | grant ' + grants + ' early ' + early + ' extra ' + extras + ' strip ' + strips + ' regrant ' + regrants);
console.log(fails ? fails + ' FAILED' : 'naming invariants OK');
process.exit(fails ? 1 : 0);
