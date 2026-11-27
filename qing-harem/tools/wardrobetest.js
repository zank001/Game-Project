#!/usr/bin/env node
/* wardrobetest.js — drives the wardrobe UI (open, try-on, buy, equip, unequip, tabs) on desktop + phone.
   Usage: node tools/wardrobetest.js [--out DIR]   (screenshots; default: ./shots, which is git-ignored) */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const oi = process.argv.indexOf('--out');
const OUT = oi >= 0 ? process.argv[oi + 1] : path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  fs.readFile(f.endsWith('/') ? f + 'index.html' : f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
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
    for (let i = 0; i < 400; i++) {                       // play through the prologue to the first hub
      const st = await p.evaluate(() => ({ rank: Game.st.rank, hub: !!document.querySelector('#hub-screen.active') }));
      if (st.rank >= 1 && st.hub) break;
      const cer = await p.$('#ceremony'); if (cer && await cer.isVisible()) { try { await cer.click({ timeout: 400 }); } catch (e) {} }
      const ch = await p.$$('.choice-btn'); if (ch.length) { try { await ch[0].click({ timeout: 600 }); } catch (e) {} continue; }
      try { await p.click('#advance-area', { timeout: 400 }); } catch (e) { await p.keyboard.press('Space'); }
    }
    const rank = await p.evaluate(() => Game.st.rank);
    ok(rank >= 1, 'reached the hub at rank ' + rank);
    const eq0 = await p.evaluate(() => JSON.stringify(Game.st.W.eq));
    ok(/h_g1/.test(eq0) && /r_g1/.test(eq0), 'rank-1 royal gift robe + headdress auto-equipped: ' + eq0);

    await p.screenshot({ path: path.join(OUT, dev.n + '_wd_00_hub.png') });
    if (dev.n === 'phone') { const tab = await p.$('#hub-tabs button[data-tab="actions"]'); if (tab) await tab.click(); }
    const btn = await p.$('.btn-wardrobe'); ok(!!btn, 'wardrobe button present in hub');
    await p.evaluate(() => { document.querySelector('.btn-wardrobe').click(); });
    await p.waitForSelector('.modal-wardrobe .wd', { timeout: 4000 });
    ok(true, 'wardrobe modal opened');
    await p.screenshot({ path: path.join(OUT, dev.n + '_wd_01_robe.png') });

    // try-on a locked/unowned item, then buy a wearable one
    await p.evaluate(() => { Game.st.S.silver = 600; });
    await p.evaluate(() => { Game.openWardrobe('robe'); });
    await p.waitForSelector('.modal-wardrobe .wd');
    const tryBtn = await p.$('.wd-item [data-a="try"]');
    if (tryBtn) { await tryBtn.click(); await p.waitForSelector('.wd-try'); ok(true, 'try-on bar shown'); await p.screenshot({ path: path.join(OUT, dev.n + '_wd_02_try.png') }); }
    const before = await p.evaluate(() => Game.st.S.silver);
    const buyBtn = await p.$('.wd-item [data-a="buy"]');
    if (buyBtn) {
      const id = await buyBtn.getAttribute('data-id'); await buyBtn.click(); await p.waitForTimeout(150);
      const r = await p.evaluate(i => ({ own: !!Game.st.W.own[i], eq: Game.st.W.eq.robe, silver: Game.st.S.silver }), id);
      ok(r.own && r.eq === id && r.silver < before, 'bought + auto-equipped ' + id + ' (silver ' + before + '→' + r.silver + ')');
    } else ok(false, 'no buyable robe found');
    await p.screenshot({ path: path.join(OUT, dev.n + '_wd_03_bought.png') });

    // every tab renders; buy something in accessory tabs
    for (const slot of ['head', 'neck', 'ear', 'charm']) {
      await p.evaluate(s => { Game.st.S.silver = 900; Game.openWardrobe(s); }, slot);
      await p.waitForSelector('.modal-wardrobe .wd');
      const bb = await p.$('.wd-item [data-a="buy"]');
      if (bb) { await bb.click(); await p.waitForTimeout(100); }
      const worn = await p.evaluate(s => Game.st.W.eq[s], slot);
      ok(!!worn, slot + ' slot equipped: ' + worn);
      await p.screenshot({ path: path.join(OUT, dev.n + '_wd_04_' + slot + '.png') });
    }
    // unequip an accessory
    const un = await p.$('.wd-item [data-a="unequip"]');
    if (un) { await un.click(); const w2 = await p.evaluate(() => Game.st.W.eq.charm); ok(!w2, 'charm slot can be unequipped'); }
    // close and check the hero portrait reflects the change
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    const heroKey = await p.evaluate(() => (document.querySelector('#hero') || {}).getAttribute ? document.querySelector('#hero').getAttribute('data-key') : '');
    ok(/r_|h_/.test(heroKey || ''), 'hero portrait re-rendered with the outfit (key has item ids)');
    await p.screenshot({ path: path.join(OUT, dev.n + '_wd_05_hub_after.png') });
    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL WARDROBE CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
