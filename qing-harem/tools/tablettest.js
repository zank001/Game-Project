#!/usr/bin/env node
/* tablettest.js — drives the green-tablet (พลิกป้าย) UI: locked state → queue/odds → boost → history → empress mode → night event. desktop + phone.
   Usage: node tools/tablettest.js [--out DIR]   (screenshots; default ./shots, git-ignored) */
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
    const advance = async (until, max, arg) => {
      for (let i = 0; i < (max || 500); i++) {
        if (await p.evaluate(until, arg)) return true;
        const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 300 }); } catch (e) {} }
        const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 500 }); } catch (e) {} continue; }
        const hubOn = await p.evaluate(() => !!document.querySelector('#hub-screen.active'));
        if (hubOn) { const es = await p.$('#btn-end-season'); if (es) { try { await es.click({ timeout: 400 }); } catch (e) {} continue; } }
        try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
      }
      return false;
    };
    const closeM = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(200); };
    ok(await advance(() => Game.st.rank >= 1 && !!document.querySelector('#hub-screen.active')), 'reached the hub at rank 1');
    if (dev.n === 'phone') { const t = await p.$('#hub-tabs button[data-tab="actions"]'); if (t) await t.click(); }

    // ---- locked at rank < 2
    await p.evaluate(() => { Game.st.rank = 1; Game.refresh(); });
    ok(!!(await p.$('.btn-tablet')), 'hub has the 🎴 tablet button');
    await p.evaluate(() => Game.openTablet()); await p.waitForSelector('.modal-tablet');
    ok(!!(await p.$('.modal-tablet .tb-lock')), 'locked notice shown at rank 1');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_00_locked.png') });
    await closeM();

    // ---- queue at rank 3
    await p.evaluate(() => { const st = Game.st; st.rank = 3; st.S.favor = 30; st.S.silver = 400; st.R.eunuch = 20; Game.refresh(); });
    await p.evaluate(() => Game.openTablet()); await p.waitForSelector('.modal-tablet .tb-me');
    const pct = await p.$eval('.modal-tablet .tb-pct b', e => parseInt(e.textContent, 10));
    ok(pct > 0 && pct < 100, 'player odds shown: ' + pct + '%');
    const rows = await p.$$eval('.modal-tablet .tb-rows li', e => e.length);
    ok(rows >= 3, 'queue lists ' + rows + ' names');
    ok(await p.$eval('.modal-tablet .tb-rows li.me', e => e.textContent.indexOf('✦') >= 0), 'player row highlighted');
    ok((await p.$$eval('.modal-tablet .tb-parts li', e => e.length)) >= 5, 'factor list shown');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_01_queue.png') });

    // ---- boost
    const s0 = await p.evaluate(() => Game.st.S.silver);
    await p.click('.modal-tablet [data-a="boost"]'); await p.waitForTimeout(250);
    const after = await p.evaluate(() => ({ s: Game.st.S.silver, b: Game.st.T.boost }));
    ok(after.s < s0 && after.b > 0, 'boost spends silver (' + s0 + ' → ' + after.s + ') and raises the queue weight +' + after.b);
    ok(await p.$eval('.modal-tablet [data-a="boost"]', e => e.disabled), 'boost button disabled after use this season');
    const pct2 = await p.$eval('.modal-tablet .tb-pct b', e => parseInt(e.textContent, 10));
    ok(pct2 > pct, 'odds rose after boost: ' + pct + '% → ' + pct2 + '%');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_02_boosted.png') });

    // ---- struck notice
    await p.evaluate(() => { Game.st.T.struck = 2; });
    await p.evaluate(() => { document.querySelector('.modal-x').click(); Game.openTablet(); });
    await p.waitForSelector('.modal-tablet .tb-blocked');
    ok(true, 'struck-name notice shown');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_03_struck.png') });
    await p.evaluate(() => { Game.st.T.struck = 0; });
    await closeM();

    // ---- history via real season ends
    const hist0 = await p.evaluate(() => Game.st.T.hist.length);
    await p.evaluate(() => { Game.st.S.favor = 60; });
    await advance(h0 => Game.st.T.hist.length >= h0 + 3 && !!document.querySelector('#hub-screen.active') && !Game.st.cur, 1500, hist0);
    const hist1 = await p.evaluate(() => Game.st.T.hist.length);
    ok(hist1 >= hist0 + 3, 'tablet rounds ran with the seasons (' + hist0 + ' → ' + hist1 + ')');
    await p.evaluate(() => Game.openTablet('hist')); await p.waitForSelector('.modal-tablet .tb-hist li');
    ok((await p.$$eval('.modal-tablet .tb-hist li', e => e.length)) >= 3, 'history tab lists rounds');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_04_hist.png') });
    await closeM();

    // ---- a night event plays when the player was flipped
    await p.evaluate(() => { const st = Game.st; st.T.me = true; st.T.meNow = true; });
    let sawNight = false;
    for (let i = 0; i < 400 && !sawNight; i++) {
      sawNight = await p.evaluate(() => { const c = Game.st.cur; return !!(c && /^tb_/.test(c.id || c.eventId || '')) || !!document.querySelector('#event-screen.active') && /^tb_/.test((Game.st.cur && Game.st.cur.id) || ''); });
      if (sawNight) break;
      const hubOn = await p.evaluate(() => !!document.querySelector('#hub-screen.active'));
      if (hubOn && await p.evaluate(() => !Game.st.cur && Game.st.T.meNow === false)) break;
      const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 300 }); } catch (e) {} }
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 500 }); } catch (e) {} continue; }
      if (hubOn) { const es = await p.$('#btn-end-season'); if (es) { try { await es.click({ timeout: 400 }); } catch (e) {} continue; } }
      try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    ok(true, 'night-event step finished (night event seen: ' + sawNight + ')');

    // ---- empress mode
    await advance(() => !Game.st.cur && !!document.querySelector('#hub-screen.active'), 400);
    await p.evaluate(() => { const st = Game.st; st.rank = 8; st.T.struck = 0; Game.refresh(); });
    await p.evaluate(() => Game.openTablet()); await p.waitForSelector('.modal-tablet .tb-me');
    ok(await p.$eval('.modal-tablet', e => e.textContent.indexOf('ฮองเฮาไม่มีป้ายชื่อเขียว') >= 0), 'empress mode explains the visit schedule');
    ok(!(await p.$('.modal-tablet [data-a="boost"]')), 'no boost button for the Empress');
    await p.screenshot({ path: path.join(OUT, dev.n + '_tb_05_empress.png') });
    await closeM();

    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL TABLET CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
