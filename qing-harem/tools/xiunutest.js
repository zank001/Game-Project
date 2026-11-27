#!/usr/bin/env node
/* xiunutest.js — drives the xiunü (秀女) UI: batch arrival → banner → selection modal → decisions → tabs. desktop + phone.
   Usage: node tools/xiunutest.js [--out DIR]   (screenshots; default ./shots, git-ignored) */
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
    const advance = async (until, max) => {
      for (let i = 0; i < (max || 500); i++) {
        if (await p.evaluate(until)) return true;
        const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 300 }); } catch (e) {} }
        const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 500 }); } catch (e) {} continue; }
        const hubOn = await p.evaluate(() => !!document.querySelector('#hub-screen.active'));
        if (hubOn) { const es = await p.$('#btn-end-season'); if (es) { try { await es.click({ timeout: 400 }); } catch (e) {} continue; } }
        try { await p.click('#advance-area', { timeout: 300 }); } catch (e) { await p.keyboard.press('Space'); }
      }
      return false;
    };
    ok(await advance(() => Game.st.rank >= 1 && !!document.querySelector('#hub-screen.active')), 'reached the hub at rank 1');
    // force a participating rank and an imminent batch
    await p.evaluate(() => { const st = Game.st; st.rank = 5; st.sir = 3; st.S.silver = 1500; st.S.wit = 70; QL.ensureX(st).next = st.t + 1; });
    await advance(() => !!(Game.st.X.pending) && !!document.querySelector('#hub-screen.active') && !Game.st.cur, 800);
    const pend = await p.evaluate(() => Game.st.X.pending ? Game.st.X.pending.ids.length : 0);
    ok(pend >= 2, 'a batch arrived with ' + pend + ' candidates');
    await p.evaluate(() => { if (Game.refresh) Game.refresh(); });
    const banner = await p.$('#xn-banner:not([hidden])');
    ok(!!banner, 'hub banner shown for the pending batch');
    if (dev.n === 'phone') { const t = await p.$('#hub-tabs button[data-tab="actions"]'); if (t) await t.click(); }
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_00_hub.png') });
    await p.evaluate(() => Game.openXiunu());
    await p.waitForSelector('.modal-xiunu .xn-card', { timeout: 4000 });
    ok(true, 'selection modal opened');
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_01_pending.png') });

    const ids = await p.evaluate(() => Game.st.X.pending.ids.slice());
    const s0 = await p.evaluate(() => Game.st.S.silver);
    await p.click('.xn-card [data-a="inv"]'); await p.waitForTimeout(120);
    const known = await p.evaluate(id => Game.st.X.girls[id].known.done, ids[0]);
    ok(known === true, 'investigate reveals info (silver ' + s0 + ' -> ' + (await p.evaluate(() => Game.st.S.silver)) + ')');
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_02_investigated.png') });
    const actions = ['sponsor', 'maid', 'reject', 'neutral'];
    for (let i = 0; i < ids.length; i++) {
      if (!(await p.$('.modal-xiunu'))) break;
      const act = actions[i % actions.length];
      const btn = await p.$('.xn-card [data-a="' + act + '"]'); if (!btn) continue;
      await btn.click();
      if (act === 'reject') { const y = await p.$('.overlay.confirm .c-yes'); if (y) await y.click(); }
      await p.waitForTimeout(150);
    }
    const sts = await p.evaluate(ids => ids.map(i => Game.st.X.girls[i].status), ids);
    ok(sts.every(s => s !== 'pending'), 'all candidates decided: ' + sts.join(','));
    ok(await p.evaluate(() => !Game.st.X.pending), 'pending batch cleared');
    await p.evaluate(() => Game.openXiunu('mine')); await p.waitForSelector('.modal-xiunu');
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_03_mine.png') });
    const mineN = await p.$$eval('.modal-xiunu .xn-card', e => e.length);
    ok(mineN >= 1, 'tab mine lists ' + mineN + ' girl(s)');
    const gift = await p.$('.xn-card [data-a="gift"]');
    if (gift) { await gift.click(); await p.waitForTimeout(100); ok(true, 'gift button works'); }
    await p.evaluate(() => Game.openXiunu('gone')); await p.waitForSelector('.modal-xiunu');
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_04_gone.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // play one xiunü story event with the generated girl on stage
    await p.evaluate(() => { QL.xnProbe(Game.st); });
    const played = await p.evaluate(() => { try { Game.runEvent('xn_ally_tea'); return true; } catch (e) { return String(e); } });
    await p.waitForTimeout(500);
    const stageOk = await p.evaluate(() => !!document.querySelector('#event-screen.active'));
    ok(played === true && stageOk, 'an xiunü story event runs in the VN screen');
    await p.screenshot({ path: path.join(OUT, dev.n + '_xn_05_event.png') });
    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL XIUNÜ CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
