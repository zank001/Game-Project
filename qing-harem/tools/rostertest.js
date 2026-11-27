#!/usr/bin/env node
/* rostertest.js — the harem roster (ทำเนียบวังหลัง): everyone listed, every living person has an age, ages grow with the years. desktop + phone.
   Usage: node tools/rostertest.js [--out DIR] */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const oi = process.argv.indexOf('--out');
const OUT = oi >= 0 ? process.argv[oi + 1] : path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
});
let fails = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) fails++; };

(async () => {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port, b = await chromium.launch();
  for (const dev of [{ n: 'desktop', vp: { width: 1280, height: 720 } }, { n: 'phone', vp: { width: 390, height: 844 } }]) {
    console.log('=== ' + dev.n);
    const ctx = await b.newContext({ viewport: dev.vp }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await p.goto('http://127.0.0.1:' + port + '/index.html?fast=1');
    await p.waitForSelector('#btn-new');
    await p.click('#btn-new'); await p.waitForSelector('.origin-card[data-origin="noble"]');
    await p.click('.origin-card[data-origin="noble"]'); await p.click('#btn-start');
    for (let i = 0; i < 300; i++) {
      if (await p.evaluate(() => Game.st.rank >= 1 && !!document.querySelector('#hub-screen.active') && !Game.st.cur)) break;
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 400 }); } catch (e) {} continue; }
      const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 300 }); } catch (e) {} }
      try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    if (dev.n === 'phone') { const t = await p.$('#hub-tabs button[data-tab="actions"]'); if (t) await t.click(); }
    ok(!!(await p.$('.btn-roster')), 'hub has the 👥 roster button');
    await p.evaluate(() => { const st = Game.st; st.rank = 3; st.t = 9; st.F.has_heir = true; st.F.heir_t = 5; st.F.heir_name = 'หย่งหลิน'; });
    const t0 = Date.now();
    await p.evaluate(() => Game.openRoster()); await p.waitForSelector('.modal-roster .rs-row');
    console.log('  (roster opened in ' + (Date.now() - t0) + ' ms)');
    const rows = await p.$$eval('.modal-roster .rs-row', e => e.length);
    ok(rows >= 20, 'the harem tab lists ' + rows + ' people');
    const noAge = await p.$$eval('.modal-roster .rs-row:not(.gone) .rs-age', e => e.filter(x => !/อายุ \d+/.test(x.textContent)).length);
    ok(noAge === 0, 'every living person shows an age');
    ok(await p.$$eval('.modal-roster .rs-row.me', e => e.length) === 1, 'the player is listed once and highlighted');
    const groups = await p.$$eval('.modal-roster .rs-h', e => e.map(x => x.textContent));
    ok(groups.some(g => /ฮองเฮา/.test(g)) && groups.some(g => /ต้าอิ้ง/.test(g)) && groups.some(g => /ผิน/.test(g)), 'ranks from ฮองเฮา down to ต้าอิ้ง are all present: ' + groups.join(' | ').slice(0, 120));
    const names = await p.$$eval('.modal-roster .rs-main b', e => e.map(x => x.textContent));
    ok(['ฮองเฮาฟู่ฉา', 'เจียอี้หวงกุ้ยเฟย', 'ซูเฟย', 'อี๋ผิน', 'ฉู่กุ้ยเหริน'].every(n => names.indexOf(n) >= 0), 'all named consorts are listed');
    ok(names.some(n => /ฮ่องเต้/.test(n)) && names.some(n => /ไทเฮา/.test(n)), 'the Emperor and the Dowager are listed');
    await p.screenshot({ path: path.join(OUT, dev.n + '_roster_00.png') });
    // ages grow with the years
    const a0 = await p.evaluate(() => QL.roster(Game.st).consorts.flatMap(g => g.rows).filter(r => r.kind === 'bg').map(r => r.age));
    await p.evaluate(() => { Game.st.t += 8; });
    const a1 = await p.evaluate(() => QL.roster(Game.st).consorts.flatMap(g => g.rows).filter(r => r.kind === 'bg').map(r => r.age));
    ok(a0.length > 0 && a0.every((a, i) => a1[i] === a + 2), 'background consorts age two years after 8 seasons');
    // around tab
    await p.evaluate(() => Game.openRoster('around')); await p.waitForSelector('.modal-roster .rs-row');
    const around = await p.$$eval('.modal-roster .rs-main b', e => e.map(x => x.textContent));
    ok(around.indexOf('เหมยชิง') >= 0 && around.some(n => /ขันที/.test(n)) && around.indexOf('หย่งหลิน') >= 0, 'the around-you tab lists friend, eunuch and the heir');
    ok(await p.$$eval('.modal-roster .rs-age', e => e.every(x => /อายุ \d+|ยังไม่ครบขวบ/.test(x.textContent))), 'ages shown for everyone around you');
    await p.screenshot({ path: path.join(OUT, dev.n + '_roster_01_around.png') });
    // a dead character is greyed out
    await p.evaluate(() => { Game.st.F.chu_alive = false; Game.openRoster(); });
    await p.waitForSelector('.modal-roster .rs-row.gone');
    ok(true, 'a dead consort is shown greyed out');
    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL ROSTER CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
