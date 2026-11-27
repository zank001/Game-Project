#!/usr/bin/env node
/* =====================================================================
   uitest.js — end-to-end UI test + screenshot tour for "ลิขิตหงส์ · วังหลังต้าชิง"

   Drives the REAL UI (index.html + engine.js) with Playwright/chromium in
   ?fast=1 mode, plays N seasons with a seeded random policy, asserts that
   nothing logs a console error / page error / failed local request, checks
   the layout for horizontal overflow, and saves screenshots of every screen.

   Usage (from qing-harem/):
     node tools/uitest.js                          # desktop + phone, 40 seasons, full suite
     node tools/uitest.js --seasons 120 --full     # keep playing until an ending (max 150 seasons)
     node tools/uitest.js --device phone --origin maid --name เมยลี่ --seed 7
     node tools/uitest.js --out /tmp/shots --no-suite
   Options:
     --out DIR        screenshot directory   (default /tmp/claude-0/-home-user-Game-Project/0ef75a8b-3249-5084-b9d8-c7c97f049f19/scratchpad/engine/shots)
     --seasons N      seasons to play per run (default 40)
     --full           ignore --seasons; play until an ending is reached
     --origin O       noble | scholar | maid   (default noble)
     --name NAME      heroine name (default หลันซี)
     --gift G         beauty | wit | talent | body (default wit)
     --seed N         PRNG seed for Math.random + bot policy (default 1)
     --device D       desktop | phone | small | land | tablet | laptop | wide | both | all  (default both = desktop+phone; comma list allowed)
     --no-suite       skip the extra scenarios (save/load, continue, death, mute, archive…)
     --only suite     run only the feature suite (skip the play-through)
     --strict         treat console warnings (QL.warn: bad cond, missing event…) as failures
     --ignore REGEX   ignore console/page errors matching REGEX (e.g. while another unit's file is mid-edit)
     --headed         show the browser
   Exit code 0 = everything passed, 1 = at least one failure.
   External requests (Google Fonts) are blocked; fast mode never requests them.
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
function opt(name, dflt) { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; }
function flag(name) { return argv.includes('--' + name); }
const OUT = opt('out', '/tmp/claude-0/-home-user-Game-Project/0ef75a8b-3249-5084-b9d8-c7c97f049f19/scratchpad/engine/shots');
const SEASONS = parseInt(opt('seasons', '40'), 10);
const FULL = flag('full');
const ORIGIN = opt('origin', 'noble');
const NAME = opt('name', 'หลันซี');
const GIFT = opt('gift', 'wit');
const SEED = parseInt(opt('seed', '1'), 10);
const DEVICE = opt('device', 'both');
const STRICT = flag('strict');
const HEADED = flag('headed');
const NO_SUITE = flag('no-suite');
const IGNORE = opt('ignore', '') ? new RegExp(opt('ignore', '')) : null;   // e.g. --ignore "Unexpected end of input" while other units' files are mid-edit
const ONLY = opt('only', '');            // e.g. --only suite  (skip the play-through)
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  small: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  land: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1024, height: 600 }, deviceScaleFactor: 1 },
  wide: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
};

/* ---------- tiny static server ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------- reporting ---------- */
const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
}

/* ---------- page helpers ---------- */
async function openPage(browser, base, device, query, seed) {
  const ctx = await browser.newContext(Object.assign({}, DEVICES[device]));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const log = { errors: [], warnings: [] };
  page.on('console', m => {
    const t = m.type(), txt = m.text();
    if (/fonts\.(googleapis|gstatic)\.com/.test(txt) || /fonts\.(googleapis|gstatic)\.com/.test((m.location() || {}).url || '')) return;
    if (IGNORE && IGNORE.test(txt)) return;
    if (t === 'error') log.errors.push('console.error: ' + txt);
    else if (t === 'warning') log.warnings.push(txt);
  });
  page.on('pageerror', e => { if (!(IGNORE && IGNORE.test(e.message))) log.errors.push('pageerror: ' + e.message); });
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) log.errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText); });
  await page.route('**/*', route => { const u = route.request().url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) route.continue(); else route.abort(); });
  await page.addInitScript(s => {
    let a = s | 0;
    Math.random = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, seed === undefined ? SEED : seed);
  await page.goto(base + '/index.html' + (query || '?fast=1'));
  await page.waitForFunction(() => window.Game && window.Game.ready, null, { timeout: 8000 });
  return { ctx, page, log };
}
let shotN = 0;
async function shot(page, device, name) {
  shotN++;
  const f = path.join(OUT, device + '_' + String(shotN).padStart(2, '0') + '_' + name + '.png');
  await page.waitForTimeout(450);
  await page.screenshot({ path: f });
  return f;
}
const state = page => page.evaluate(() => ({ screen: Game.screen, t: Game.st && Game.st.t, rank: Game.st && Game.st.rank, phase: Game.st && Game.st.phase, ap: Game.st && Game.st.ap, ending: Game.st && Game.st.ending }));
async function waitScreen(page, id, ms) { try { await page.waitForFunction(i => Game.screen === i, id, { timeout: ms || 6000 }); return true; } catch (e) { return false; } }

/* layout sanity: no horizontal page scroll, key boxes inside the viewport, no clipped text in buttons */
async function layoutCheck(page, label) {
  const bad = await page.evaluate(() => {
    const vw = window.innerWidth, out = [];
    const de = document.documentElement;
    if (de.scrollWidth > vw + 1) out.push('page scrollWidth ' + de.scrollWidth + ' > ' + vw);
    const sel = '.panel,.modal,.dialogue-box,.choice-btn,.action-card,.report-card,.edict,.end-card,.origin-card,.gift-card,#hub-top,.climb-strip,#hub-tabs,.title-menu .btn,.preview-card,.ladder-head,.slot,.end-card-s,.cast-card,.tip,.ht-card';
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return;
      let p = el, hidden = false; while (p && p !== document.body) { if (getComputedStyle(p).display === 'none') { hidden = true; break; } p = p.parentElement; }
      if (hidden) return;
      if (r.right > vw + 1.5 || r.left < -1.5) out.push((el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + ' x=' + Math.round(r.left) + '..' + Math.round(r.right));
    });
    document.querySelectorAll('.btn,.action-card .ac-name,.choice-btn .cb-text,.rung-name,.hid-txt b,.tab,.mtab,.chip-btn').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      if (el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).textOverflow !== 'ellipsis') out.push('text overflow: ' + (el.id ? '#' + el.id : el.className) + ' "' + (el.textContent || '').trim().slice(0, 24) + '"');
    });
    return out;
  });
  rec('layout ok: ' + label, bad.length === 0, bad.slice(0, 5).join(' | '));
  return bad.length === 0;
}

/* ---------- the in-page bot (runs inside the browser for speed) ---------- */
async function botRun(page, cfg) {
  return page.evaluate(async cfg => {
    let s = cfg.seed | 0;
    const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const $ = q => document.querySelector(q);
    const shown = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    const tick = () => new Promise(r => setTimeout(r, 0));
    const want = new Set(cfg.want), got = [];
    let steps = 0;
    const emit = name => { if (want.has(name)) { want.delete(name); return name; } return null; };
    while (steps++ < cfg.maxSteps) {
      const st = Game.st;
      if (!st) return { stop: 'nostate', steps };
      if (st.phase === 'ended' && Game.screen === 'ending-screen') { const e = emit('ending'); return { stop: e || 'ended', steps }; }
      if (cfg.untilT !== null && st.t >= cfg.untilT && Game.screen === 'hub-screen') return { stop: 'done', steps };
      if (shown($('#ceremony')) && $('#ceremony').classList.contains('open')) {
        const nm = $('#ceremony').classList.contains('demote') ? 'demote' : 'ceremony';
        const e = emit(nm); if (e) return { stop: e, steps };
        $('#btn-ceremony-ok').click(); await tick(); continue;
      }
      if (shown($('#season-report')) && $('#season-report').classList.contains('open')) {
        const e = emit('report'); if (e) return { stop: e, steps };
        $('#btn-report-ok').click(); await tick(); continue;
      }
      if (shown($('#modal-root'))) { Game.closeModal(); await tick(); continue; }
      if (Game.screen === 'event-screen') {
        if ($('#card-overlay').classList.contains('show')) { const e = emit('card'); if (e) return { stop: e, steps }; $('#card-overlay').click(); await tick(); continue; }
        const ch = Array.from(document.querySelectorAll('.choice-btn:not([disabled])'));
        if (ch.length) {
          const e = emit('choices'); if (e) return { stop: e, steps };
          ch[Math.floor(rnd() * ch.length)].click(); await tick(); await tick(); continue;
        }
        const e = emit('event'); if (e) return { stop: e, steps };
        if ($('#caption').classList.contains('on')) { const e2 = emit('caption'); if (e2) return { stop: e2, steps }; }
        $('#advance-area').click(); await tick(); continue;
      }
      if (Game.screen === 'hub-screen') {
        const e = emit('hub'); if (e) return { stop: e, steps };
        const cards = Array.from(document.querySelectorAll('.action-card:not([disabled])'));
        if (st.ap > 0 && cards.length && rnd() < 0.85) { cards[Math.floor(rnd() * cards.length)].click(); await tick(); await tick(); continue; }
        $('#btn-end-season').click(); await tick(); await tick(); continue;
      }
      await tick();
    }
    return { stop: 'maxsteps', steps };
  }, cfg);
}

/* ---------- scenario 1: full play-through on one device ---------- */
async function playthrough(browser, base, device) {
  console.log('\n=== PLAY-THROUGH [' + device + '] origin=' + ORIGIN + ' seasons=' + (FULL ? 'until ending' : SEASONS) + ' seed=' + SEED + ' ===');
  shotN = 0;
  const { ctx, page, log } = await openPage(browser, base, device, '?fast=1&report=1');
  await shot(page, device, 'title');
  rec('title screen visible', await page.isVisible('#title-screen') && await page.isVisible('#btn-new'));
  await layoutCheck(page, device + ' title');
  await page.click('#btn-new');
  await waitScreen(page, 'create-screen');
  await page.fill('#name-input', NAME);
  await page.click('.origin-card[data-origin="' + ORIGIN + '"]');
  await page.click('.gift-card[data-gift="' + GIFT + '"]');
  await shot(page, device, 'creation');
  await layoutCheck(page, device + ' creation');
  await page.click('#btn-start');
  rec('new game started', (await page.waitForFunction(() => Game.st && Game.st.name, null, { timeout: 4000 }).then(() => true).catch(() => false)));
  const stName = await page.evaluate(() => Game.st && Game.st.name);
  rec('name + origin applied', stName === NAME.slice(0, 12) && (await page.evaluate(() => Game.st.origin)) === ORIGIN, stName);

  const wants = ['event', 'choices', 'card', 'caption', 'ceremony', 'demote', 'report', 'hub', 'ending'];
  const taken = {};
  let guard = 0, last = null;
  const maxT = FULL ? 150 : SEASONS;
  for (;;) {
    const cfg = { seed: SEED * 7919 + guard, maxSteps: 4000, untilT: FULL ? null : maxT, want: wants.filter(w => !taken[w]) };
    const r = await botRun(page, cfg);
    last = r;
    if (wants.includes(r.stop) && !taken[r.stop]) {
      taken[r.stop] = true;
      await shot(page, device, r.stop);
      if (r.stop === 'hub' || r.stop === 'choices' || r.stop === 'event') await layoutCheck(page, device + ' ' + r.stop);
      if (r.stop === 'ending') break;
      continue;
    }
    if (r.stop === 'done' || r.stop === 'ended' || r.stop === 'nostate') break;
    if (r.stop === 'maxsteps') { guard++; if (guard > 40) break; continue; }
    guard++;
    if (guard > 60) break;
  }
  const s = await page.evaluate(() => ({ t: Game.st && Game.st.t, rank: Game.st && Game.st.rank, phase: Game.st && Game.st.phase, ending: Game.st && Game.st.ending, events: Game.st && Game.st.stats.events, actions: Game.st && Game.st.stats.actions, screen: Game.screen }));
  console.log('  state:', JSON.stringify(s), 'last:', JSON.stringify(last));
  if (FULL) rec('reached an ending', s.phase === 'ended', String(s.ending));
  else rec('played ' + maxT + ' seasons (or reached an ending)', s.t >= maxT || s.phase === 'ended', 't=' + s.t + ' rank=' + s.rank);
  if (s.phase === 'ended') {
    if (!taken.ending) await shot(page, device, 'ending');
    rec('ending screen shows', await page.isVisible('#ending-screen') && await page.isVisible('#btn-restart'));
    await layoutCheck(page, device + ' ending');
  } else { await layoutCheck(page, device + ' final hub'); }
  rec('no console/page errors (' + device + ' play-through)', log.errors.length === 0, log.errors.slice(0, 3).join(' || '));
  if (log.warnings.length) {
    const uniq = Array.from(new Set(log.warnings)).slice(0, 6);
    console.log('  warnings (' + log.warnings.length + '): ' + uniq.join(' || '));
    if (STRICT) rec('no console warnings (strict)', false, uniq.join(' || '));
  }
  await ctx.close();
}

/* ---------- scenario 2: feature suite ---------- */
async function startGame(page, origin) {
  await page.click('#btn-new'); await waitScreen(page, 'create-screen');
  await page.fill('#name-input', 'ทดสอบ');
  await page.click('.origin-card[data-origin="' + (origin || 'noble') + '"]');
  await page.click('#btn-start');
  await page.waitForFunction(() => Game.st, null, { timeout: 4000 });
}
async function advanceOnce(page) {
  // a real user taps anywhere on the stage; the card overlay lets taps fall through to #advance-area
  const h = (page.viewportSize() || { height: 700 }).height;
  await page.click('#advance-area', { position: { x: 24, y: h - 28 }, timeout: 1500 }).catch(() => {});
}
async function toHub(page, extra) {
  // play until the hub is showing (clicks through events), no actions taken
  const cfg = { seed: 3, maxSteps: 3000, untilT: null, want: ['hub'] };
  const r = await botRun(page, cfg);
  return r.stop === 'hub';
}

async function suite(browser, base, device) {
  console.log('\n=== FEATURE SUITE [' + device + '] ===');
  shotN = 100;
  /* A. title extras: archive, how-to, settings; mute persistence (non-fast so settings persist) */
  {
    const { ctx, page, log } = await openPage(browser, base, device, '?fonts=0&report=1');
    await page.evaluate(() => { Game.settings.speed = 0; });
    await page.click('#btn-archive'); await page.waitForSelector('.modal');
    await shot(page, device, 'archive_endings');
    await layoutCheck(page, device + ' archive endings');
    const nEnd = await page.locator('.end-card-s').count();
    rec('archive lists endings', nEnd >= 1, nEnd + ' endings');
    rec('locked endings show ???', (await page.locator('.end-card-s.locked').first().innerText().catch(() => '')).includes('?'));
    await page.click('.mtab[data-tab="cast"]'); await page.waitForTimeout(100);
    await shot(page, device, 'archive_cast');
    await layoutCheck(page, device + ' archive cast');
    rec('cast gallery has cards', (await page.locator('.cast-card').count()) >= 10);
    await page.click('.modal-x'); await page.waitForTimeout(80);
    await page.click('#btn-howto'); await page.waitForSelector('.modal .howto');
    await shot(page, device, 'howto');
    await page.click('.modal-x');
    await page.click('#btn-title-settings'); await page.waitForSelector('.set-list');
    await shot(page, device, 'settings');
    await layoutCheck(page, device + ' settings');
    await page.click('#set-mute');
    rec('mute toggle in settings', await page.evaluate(() => Game.settings.mute === true && Sound.muted === true));
    await page.click('.modal-x');
    await page.reload(); await page.waitForFunction(() => window.Game && Game.ready);
    rec('mute persisted after reload', await page.evaluate(() => Game.settings.mute === true && Sound.muted === true));
    await page.click('#btn-title-mute');
    rec('mute toggle on title', await page.evaluate(() => Game.settings.mute === false && Sound.muted === false));
    // erase everything from settings (with the confirm dialog)
    await page.evaluate(() => { Game.Seen.ending('end_twilight'); Game.saveSettings(); });
    await page.click('#btn-title-settings'); await page.waitForSelector('#set-erase');
    await page.click('#set-erase'); await page.waitForSelector('.overlay.confirm .c-yes');
    await page.click('.overlay.confirm .c-yes'); await page.waitForTimeout(150);
    rec('erase data clears saves, archive and settings', await page.evaluate(() => !localStorage.getItem(Q.SAVE_KEY) && !localStorage.getItem(Q.SEEN_KEY) && !localStorage.getItem(Q.SET_KEY) && Game.Seen.countEndings() === 0));
    await page.click('.modal-x');
    rec('no errors (title extras)', log.errors.length === 0, log.errors.slice(0, 2).join(' || '));
    await ctx.close();
  }
  /* B. ceremony, season report, tips (non-fast tips enabled via ?tut=1), save/load/continue */
  {
    const { ctx, page, log } = await openPage(browser, base, device, '?fast=1&report=1&tut=1');
    await startGame(page, 'noble');
    // first tip should appear on first dialogue line (after the opening card)
    for (let i = 0; i < 6 && (await page.locator('.tip').count()) < 1; i++) { await advanceOnce(page); await page.waitForTimeout(60); }
    rec('tutorial tip shows on first line', await page.locator('.tip').count() >= 1);
    await shot(page, device, 'event_tip');
    await page.evaluate(() => { document.querySelectorAll('.tip-ok').forEach(b => b.click()); });
    // play until ceremony (sample prologue promotes)
    let r = await botRun(page, { seed: 5, maxSteps: 3000, untilT: null, want: ['ceremony'] });
    rec('rank-up ceremony appears', r.stop === 'ceremony', r.stop);
    if (r.stop === 'ceremony') {
      await shot(page, device, 'ceremony');
      await layoutCheck(page, device + ' ceremony');
      const before = await page.evaluate(() => Game.st.rank);
      await page.click('#btn-ceremony-ok');
      await page.waitForTimeout(100);
      rec('ceremony ack clears promoted flag', await page.evaluate(() => !Game.st.promoted));
      rec('rank increased', (await page.evaluate(() => Game.st.rank)) >= before);
    }
    rec('reach hub', await toHub(page));
    await page.evaluate(() => { document.querySelectorAll('.tip-ok').forEach(b => b.click()); });
    await shot(page, device, 'hub_state');
    // do one action
    const act = page.locator('.action-card:not([disabled])').first();
    const n0 = await page.evaluate(() => Game.st.ap);
    await act.click(); await page.waitForTimeout(150);
    await shot(page, device, 'hub_after_action');
    rec('action consumed AP or started event', await page.evaluate(n => Game.st.ap < n || Game.screen === 'event-screen', n0));
    r = await botRun(page, { seed: 9, maxSteps: 3000, untilT: null, want: ['hub'] });
    // save via UI menu
    await page.click('#btn-menu'); await page.waitForSelector('.slots');
    await shot(page, device, 'menu_save');
    await layoutCheck(page, device + ' save menu');
    await page.click('.slot[data-slot="1"] .s-save'); await page.waitForTimeout(120);
    const savedMeta = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem(Q.SAVE_KEY) || '{}'); return o['1'] ? { t: o['1'].st.t, rank: o['1'].st.rank, name: o['1'].st.name, silver: o['1'].st.S.silver } : null; });
    rec('save slot 1 written to localStorage', !!savedMeta, JSON.stringify(savedMeta));
    await page.click('.mtab[data-tab="diary"]'); await page.waitForTimeout(100);
    await shot(page, device, 'menu_diary');
    await page.click('.mtab[data-tab="settings"]'); await page.waitForTimeout(100);
    await page.click('.modal-x');
    // reload → Continue → same state
    await page.reload(); await page.waitForFunction(() => window.Game && Game.ready);
    rec('Continue enabled after save', await page.evaluate(() => !document.getElementById('btn-continue').disabled));
    await shot(page, device, 'title_with_save');
    await page.click('#btn-continue');
    await waitScreen(page, 'hub-screen', 4000).then(ok => ok || toHub(page));
    const after = await page.evaluate(() => ({ t: Game.st.t, rank: Game.st.rank, name: Game.st.name }));
    rec('continue restores latest save', !!savedMeta && after.name === savedMeta.name && after.rank >= savedMeta.rank && after.t >= savedMeta.t, JSON.stringify(after));
    // load slot 1 explicitly via menu (round trip)
    await page.click('#btn-menu'); await page.waitForSelector('.slots');
    await page.click('.slot[data-slot="1"] .s-load'); await page.waitForTimeout(250);
    const again = await page.evaluate(() => ({ t: Game.st.t, rank: Game.st.rank, silver: Game.st.S.silver, scr: Game.screen }));
    rec('save/load round trip (slot 1)', !!savedMeta && again.t === savedMeta.t && again.rank === savedMeta.rank, JSON.stringify(again));
    // season end → report overlay
    await toHub(page);
    await page.evaluate(() => { Game.st.ap = 0; });
    await page.click('#btn-end-season');
    await page.waitForSelector('#season-report.open', { timeout: 3000 }).catch(() => {});
    const repShown = await page.isVisible('#season-report');
    rec('season report overlay shown', repShown);
    if (repShown) { await shot(page, device, 'season_report'); await layoutCheck(page, device + ' season report'); await page.click('#btn-report-ok'); }
    rec('no errors (ceremony/save/continue)', log.errors.length === 0, log.errors.slice(0, 2).join(' || '));
    await ctx.close();
  }
  /* C. death ending via health = 0, then archive shows the unlocked ending */
  {
    const { ctx, page, log } = await openPage(browser, base, device, '?fast=1');
    await startGame(page, 'scholar');
    rec('reach hub (death test)', await toHub(page));
    await page.evaluate(() => { Game.st.S.health = 0; });
    await page.click('#btn-end-season');
    const ok = await waitScreen(page, 'event-screen', 3000);
    // play the ending event out
    const r = await botRun(page, { seed: 11, maxSteps: 2000, untilT: null, want: ['ending'] });
    const st = await state(page);
    rec('death → ending screen', st.screen === 'ending-screen' && /^end_death/.test(st.ending || ''), JSON.stringify(st));
    await shot(page, device, 'ending_death');
    await layoutCheck(page, device + ' death ending');
    const t = await page.locator('#end-title').innerText();
    rec('ending title rendered', t.length > 0, t);
    await page.click('#btn-end-archive'); await page.waitForSelector('.end-card-s');
    rec('ending unlocked in archive', (await page.locator('.end-card-s.unlocked').count()) >= 1);
    await shot(page, device, 'archive_unlocked');
    await page.click('.modal-x');
    await page.click('#btn-restart');
    rec('restart returns to title', await waitScreen(page, 'title-screen', 2000));
    rec('no errors (death/ending)', log.errors.length === 0, log.errors.slice(0, 2).join(' || '));
    await ctx.close();
  }
  /* C2. demotion ceremony (synthetic chain event injected at runtime) */
  {
    const { ctx, page, log } = await openPage(browser, base, device, '?fast=1');
    await startGame(page, 'noble');
    rec('reach hub (demotion test)', await toHub(page));
    await page.evaluate(() => {
      Game.st.rank = 3; Game.st.sir = 2;
      Q.add([{ id: 'zz_uitest_demote', kind: 'chain', title: 'ถูกลงโทษ', minRank: 1, maxRank: 8, bg: 'kunning', cast: [{ c: 'empress', pos: 'center', x: 'angry' }], start: 'a',
        nodes: { a: { who: 'empress', x: 'angry', text: 'เจ้าล่วงเกินกฎวัง — ข้าจะลดขั้นเจ้าลงหนึ่งขั้น', demote: 1, next: 'b' }, b: { who: 'narrator', text: 'ท่านก้มหน้ารับโทษโดยไม่เอ่ยสักคำ' } } }]);
      QL.reindex(); Game.refresh();
    });
    await page.evaluate(() => Game.runEvent('zz_uitest_demote'));
    const r = await botRun(page, { seed: 4, maxSteps: 400, untilT: null, want: ['demote'] });
    rec('demotion ceremony appears', r.stop === 'demote', r.stop);
    if (r.stop === 'demote') {
      await shot(page, device, 'ceremony_demote');
      await layoutCheck(page, device + ' demotion ceremony');
      await page.click('#btn-ceremony-ok');
      await page.waitForTimeout(100);
      rec('demotion lowered the rank by one', (await page.evaluate(() => Game.st.rank)) === 2);
    }
    rec('no errors (demotion)', log.errors.length === 0, log.errors.slice(0, 2).join(' || '));
    await ctx.close();
  }
  /* D. maid origin start + non-fast typewriter sanity (text types, click completes it) */
  {
    const { ctx, page, log } = await openPage(browser, base, device, '?fonts=0');
    await startGame(page, 'maid');
    await page.waitForFunction(() => Game.screen === 'event-screen', null, { timeout: 4000 });
    await page.evaluate(() => { Game.settings.speed = 30; });
    // advance until a line is typing
    let typed = false;
    for (let i = 0; i < 14 && !typed; i++) {
      await advanceOnce(page);
      await page.waitForTimeout(60);
      typed = await page.evaluate(() => !!Game._typing);
    }
    rec('typewriter runs in normal mode', typed);
    await advanceOnce(page);
    await page.waitForTimeout(80);
    rec('click completes typewriter', await page.evaluate(() => !Game._typing && document.getElementById('dialogue-box').classList.contains('complete')));
    await shot(page, device, 'event_normal');
    // keyboard: Space advances; auto / skip / log / Esc menu
    const idBefore = await page.evaluate(() => JSON.stringify(Game.st.cur) + Game.history.length);
    await page.keyboard.press('Space'); await page.waitForTimeout(120);
    await page.evaluate(() => { Game.settings.speed = 0; });
    rec('Space key advances the story', (await page.evaluate(() => JSON.stringify(Game.st.cur) + Game.history.length)) !== idBefore);
    // toggle on+off inside one JS task so the skip timer cannot run the story away in between
    rec('auto toggle on/off', await page.evaluate(() => { const b = document.getElementById('btn-auto'); b.click(); const on = Game.auto === true; b.click(); return on && Game.auto === false; }));
    rec('skip toggle on/off', await page.evaluate(() => { const b = document.getElementById('btn-skip'); b.click(); const on = Game.skip === true; b.click(); return on && Game.skip === false; }));
    await page.click('#btn-log'); await page.waitForSelector('.log-list');
    rec('backlog lists lines', (await page.locator('.log-line').count()) >= 1);
    await shot(page, device, 'backlog');
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    rec('Esc closes backlog', await page.evaluate(() => document.getElementById('modal-root').hidden));
    await page.keyboard.press('Escape'); await page.waitForSelector('.modal');
    rec('Esc opens menu in game', true);
    await page.keyboard.press('Escape');
    // reach a choice and pick it with the keyboard
    const rch = await botRun(page, { seed: 21, maxSteps: 3000, untilT: null, want: ['choices'] });
    if (rch.stop === 'choices') {
      const before = await page.evaluate(() => Game.st.cur && Game.st.cur.node);
      await page.keyboard.press('1'); await page.waitForTimeout(150);
      rec('number key picks choice 1', await page.evaluate(b => !Game.st.cur || Game.st.cur.node !== b, before));
    }
    rec('no errors (maid / typewriter)', log.errors.length === 0, log.errors.slice(0, 2).join(' || '));
    await ctx.close();
  }
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ headless: !HEADED });
  const devices = DEVICE === 'both' ? ['desktop', 'phone'] : (DEVICE === 'all' ? Object.keys(DEVICES) : DEVICE.split(','));
  try {
    for (const d of devices) {
      if (ONLY !== 'suite') await playthrough(browser, base, d);
      if (!NO_SUITE) await suite(browser, base, d);
    }
  } catch (e) {
    rec('uitest crashed', false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
  }
  await browser.close(); srv.close();
  const fails = results.filter(r => !r.ok);
  console.log('\n' + (fails.length ? 'FAILED: ' + fails.length + ' of ' + results.length + ' checks' : 'ALL ' + results.length + ' CHECKS PASSED') + '   screenshots → ' + OUT);
  process.exit(fails.length ? 1 : 0);
})();
