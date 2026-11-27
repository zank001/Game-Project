#!/usr/bin/env node
/* confirmtest.js — choices that END the game are flagged (⚑ จบเรื่อง) and need a confirmation (the poet offer is the example).
   Usage: node tools/confirmtest.js [--out DIR] */
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
    await p.click('#btn-new'); await p.waitForSelector('.origin-card[data-origin="scholar"]');
    await p.click('.origin-card[data-origin="scholar"]'); await p.click('#btn-start');
    for (let i = 0; i < 300; i++) {
      if (await p.evaluate(() => Game.st.rank >= 1 && !!document.querySelector('#hub-screen.active') && !Game.st.cur)) break;
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 400 }); } catch (e) {} continue; }
      const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 300 }); } catch (e) {} }
      try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    // the offer must not appear to a young game
    const early = await p.evaluate(() => { const st = Game.st; st.rank = 3; st.sir = 5; st.t = 12; st.S.talent = 95; st.F.of_po_hint = true; st.F.met_emperor = true; return QL.eligible(st, QL.event('of_po_academy')); });
    ok(early === false, 'poet offer is NOT eligible for a young game (rank 3, year 4)');
    const late = await p.evaluate(() => { const st = Game.st; st.rank = 4; st.sir = 5; st.t = 31; st.S.talent = 95; st.F.of_po_hint = true; st.F.met_emperor = true; st.F.finale = false; return QL.eligible(st, QL.event('of_po_academy')); });
    ok(late === true, 'poet offer becomes eligible at rank 4 after year 6');
    // play it
    await p.evaluate(() => { Game.st.pending = []; Game.runEvent('of_po_academy'); });
    let ends = null;
    for (let i = 0; i < 200 && !ends; i++) {
      ends = await p.$('.choice-btn .chip.ends');
      if (ends) break;
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[1 % ch.length].click({ timeout: 400 }); } catch (e) {} continue; }
      try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    ok(!!ends, 'the choice that ends the game carries the ⚑ จบเรื่อง chip');
    const nEnds = await p.$$eval('.choice-btn', bs => bs.filter(x => x.querySelector('.chip.ends')).length);
    const nAll = await p.$$eval('.choice-btn', bs => bs.length);
    ok(nEnds >= 1 && nEnds < nAll, 'only the ending choice is flagged (' + nEnds + ' of ' + nAll + ')');
    await p.screenshot({ path: path.join(OUT, dev.n + '_confirm_00_choices.png') });
    await p.click('.choice-btn:has(.chip.ends)');
    await p.waitForSelector('.overlay.confirm.open', { timeout: 3000 });
    ok(true, 'a confirmation appears before the game ends');
    await p.screenshot({ path: path.join(OUT, dev.n + '_confirm_01_box.png') });
    await p.click('.overlay.confirm .c-no'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => Game.st.phase === 'ended')) && !!(await p.$('.choice-btn')), 'declining keeps the game going');
    await p.click('.choice-btn:has(.chip.ends)'); await p.waitForSelector('.overlay.confirm.open');
    await p.click('.overlay.confirm .c-yes');
    for (let i = 0; i < 120 && !(await p.evaluate(() => Game.st.phase === 'ended')); i++) {
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 400 }); } catch (e) {} continue; }
      try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    ok(await p.evaluate(() => Game.st.phase === 'ended' && Game.st.ending === 'end_x_poet'), 'confirming reaches the poet ending');
    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL CONFIRM CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
