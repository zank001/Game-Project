#!/usr/bin/env node
/* namelint.js — checks the naming pools (Q.NAMING.feng / extra / combos / clans / girlNames) loaded from js/data/n*.js.
   Usage: node tools/namelint.js [--files=a.js,b.js] [--quiet]
   Exit 1 on errors. See docs/DESIGN.md §12 for the schema. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const QUIET = process.argv.includes('--quiet');
const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error } });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core_data.js'), 'utf8'), ctx, { filename: 'core_data.js' });
const dir = path.join(ROOT, 'js/data');
const files = arg('files') ? arg('files').split(',') : fs.readdirSync(dir).filter(f => /^n\d+.*\.js$/.test(f)).sort();
const errs = [], warns = [];
const E = m => errs.push(m), W = m => warns.push(m);
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.isAbsolute(f) ? f : path.join(dir, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { E('[' + f + '] load error: ' + e.message); }
}
const N = ctx.Q.NAMING || {};
const TAGS = ['virtue', 'gentle', 'beauty', 'wisdom', 'art', 'harmony', 'fortune', 'loyal', 'strong'];
const TONES = ['grand', 'soft', 'humble'];
const RESERVED_ZH = N.reservedZh || ['舒', '怡', '嘉', '懿'];
const BLOCK_TH = new Set(['ลู่', 'ซู', 'อี๋', 'เจีย', 'อี้', 'ฉู่', 'เหมย', 'จาง', 'เซี่ย', 'รุ่ย', 'ฟู่ฉา', 'เหวินเซี่ยน', 'หนิ่วฮู่ลู่', 'ซูมู่ลู่', 'เซิ่น', 'หลิน', 'หลี่', 'หวัง', 'เฉิน', 'โจว', 'เกา', 'ท่งเจีย', 'ชุนเถา', 'ฉิน']);
const thai = /^[฀-๿]+$/, han = /^[一-鿿]$/;
const arr = k => Array.isArray(N[k]) ? N[k] : [];
const feng = arr('feng'), extra = arr('extra'), clans = arr('clans'), combos = arr('combos'), girl = arr('girlNames');

function checkEntry(kind, e, i) {
  const at = kind + '[' + i + ']' + (e && e.id ? ' ' + e.id : '');
  if (!e || typeof e !== 'object') return E(at + ': not an object');
  if (!/^[a-z][a-z0-9_]*$/.test(e.id || '')) E(at + ': id must be ascii snake_case');
  if (!han.test(e.zh || '')) E(at + ': zh must be exactly ONE hanzi, got ' + JSON.stringify(e.zh));
  if (!thai.test(e.th || '')) E(at + ': th must be Thai letters only (no spaces), got ' + JSON.stringify(e.th));
  else if (e.th.length > 9) W(at + ': th long (' + e.th + ')');
  if (typeof e.mean !== 'string' || e.mean.length < 4) E(at + ': mean missing');
  else if (e.mean.length > 90) W(at + ': mean long');
  if (!Array.isArray(e.tags) || !e.tags.length || e.tags.length > 3) E(at + ': tags must be 1..3 of ' + TAGS.join('/'));
  else e.tags.forEach(t => { if (TAGS.indexOf(t) < 0) E(at + ': unknown tag ' + t); });
  if (!(e.w >= 1 && e.w <= 10)) E(at + ': w must be 1..10');
  if (e.tone !== undefined && TONES.indexOf(e.tone) < 0) E(at + ': tone must be ' + TONES.join('/'));
  if (kind === 'extra' && ['suf', 'pre', 'any'].indexOf(e.pos) < 0) E(at + ': pos must be suf|pre|any');
  if (e.hist !== undefined && (typeof e.hist !== 'string' || e.hist.length > 160)) E(at + ': hist must be a short string');
  if (kind === 'extra' && e.good !== undefined && !Array.isArray(e.good)) E(at + ': good must be an array of feng ids');
}
feng.forEach((e, i) => checkEntry('feng', e, i));
extra.forEach((e, i) => checkEntry('extra', e, i));

const seenId = {}, seenZh = {}, seenTh = {};
[['feng', feng], ['extra', extra]].forEach(([k, list]) => list.forEach(e => {
  if (!e) return;
  if (seenId[e.id]) E('duplicate id ' + e.id + ' (' + seenId[e.id] + ' / ' + k + ')'); else seenId[e.id] = k;
  const zk = (k === 'feng' ? 'feng:' : 'extra:') + e.zh; // a char may be in BOTH lists (different role) but not twice in one
  if (seenZh[zk]) E('duplicate hanzi ' + e.zh + ' within ' + k); else seenZh[zk] = 1;
  if (seenTh[e.th] && seenTh[e.th] !== k + ':' + e.zh && seenTh[e.th].split(':')[1] !== e.zh) W('homophone: Thai reading "' + e.th + '" shared by ' + seenTh[e.th] + ' and ' + k + ':' + e.zh + ' (the engine never lets two held names share a reading; prefer a distinct hanzi when you can)');
  else seenTh[e.th] = k + ':' + e.zh;
  if (BLOCK_TH.has(e.th)) E('Thai reading "' + e.th + '" collides with a clan/NPC name (' + k + ':' + e.zh + ')');
  if (k === 'feng' && RESERVED_ZH.indexOf(e.zh) >= 0 && !e.reserved) W('reserved-to-NPC hanzi ' + e.zh + ' in feng pool — engine will skip it (set reserved:true to silence)');
}));
// same hanzi in both lists must share the same reading
feng.forEach(f => { const x = extra.find(e => e.zh === f.zh); if (x && x.th !== f.th) E('hanzi ' + f.zh + ' has different readings in feng (' + f.th + ') and extra (' + x.th + ')'); });
extra.forEach(x => (x.good || []).forEach(id => { if (!feng.find(f => f.id === id)) W('extra ' + x.id + ': good id ' + id + ' not in feng pool'); }));

combos.forEach((c, i) => {
  const at = 'combos[' + i + ']';
  if (!c || !han.test(c.feng || '') || !han.test(c.extra || '')) E(at + ': feng/extra must be single hanzi');
  if (c && ['suf', 'pre'].indexOf(c.pos) < 0) E(at + ': pos must be suf|pre');
  if (c && !thai.test(c.th || '')) E(at + ': th must be Thai');
});
const seenClan = {};
clans.forEach((c, i) => {
  const at = 'clans[' + i + ']' + (c && c.id ? ' ' + c.id : '');
  if (!c || !/^[a-z][a-z0-9_]*$/.test(c.id || '')) E(at + ': bad id');
  if (!thai.test(c.th || '')) E(at + ': th must be Thai letters');
  if (!/^[一-鿿]{1,4}$/.test(c.zh || '')) E(at + ': zh must be 1..4 hanzi');
  if (['manchu', 'mongol', 'hanjun', 'han'].indexOf(c.kind) < 0) E(at + ': kind');
  if (['civil', 'military', 'neutral'].indexOf(c.side) < 0) E(at + ': side');
  if (!(c.power >= 1 && c.power <= 3)) E(at + ': power 1..3');
  if (!(c.w >= 1 && c.w <= 10)) E(at + ': w 1..10');
  if (c.kind !== 'han' && !/^ธง/.test(c.banner || '')) W(at + ': banner should start with ธง');
  if (seenClan[c.id]) E('duplicate clan id ' + c.id); seenClan[c.id] = 1;
  if (seenClan['th:' + c.th]) E('duplicate clan reading ' + c.th); seenClan['th:' + c.th] = 1;
});
const gs = new Set();
girl.forEach((n, i) => { if (!thai.test(n || '')) E('girlNames[' + i + '] must be Thai letters: ' + n); if (gs.has(n)) E('duplicate girl name ' + n); gs.add(n); });
const existing = (ctx.Q.XIUNU && ctx.Q.XIUNU.names) || [];
girl.forEach(n => { if (existing.indexOf(n) >= 0) W('girl name already in Q.XIUNU.names: ' + n); });

if (!QUIET) {
  const by = k => { const o = {}; arr(k).forEach(e => (e.tags || []).forEach(t => { o[t] = (o[t] || 0) + 1; })); return o; };
  console.log('feng ' + feng.length + ' · extra ' + extra.length + ' · combos ' + combos.length + ' · clans ' + clans.length + ' (' + ['manchu', 'mongol', 'hanjun', 'han'].map(k => k + ':' + clans.filter(c => c.kind === k).length).join(' ') + ') · girlNames ' + girl.length);
  console.log('feng tags', JSON.stringify(by('feng')), '| humble:', feng.filter(e => e.tone === 'humble').length, 'grand:', feng.filter(e => e.tone === 'grand').length, '| hist:', feng.filter(e => e.hist).length);
  console.log('extra pos', JSON.stringify(extra.reduce((o, e) => { o[e.pos] = (o[e.pos] || 0) + 1; return o; }, {})));
  warns.slice(0, 40).forEach(w => console.log('  warn: ' + w));
  if (warns.length > 40) console.log('  … ' + (warns.length - 40) + ' more warnings');
}
errs.slice(0, 80).forEach(e => console.log('  ERROR: ' + e));
if (errs.length > 80) console.log('  … ' + (errs.length - 80) + ' more errors');
console.log(errs.length ? '✗ ' + errs.length + ' error(s)' : '✓ naming pools OK (' + warns.length + ' warning(s))');
process.exit(errs.length ? 1 : 0);
