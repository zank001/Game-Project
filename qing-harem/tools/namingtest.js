#!/usr/bin/env node
/* namingtest.js — drives the naming (พระนาม · ฉายา) UI: clan field on the create screen → clan-style title → bestowal at ผิน (ceremony) → naming modal → extra word at หวงกุ้ยเฟย → strip + re-grant. desktop + phone.
   Usage: node tools/namingtest.js [--out DIR]   (screenshots; default ./shots, git-ignored). Injects a tiny pool if the real pools are not loaded. */
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
    const injected = await p.evaluate(() => {
      if (Q.NAMING.feng.length >= 6) return false;
      const T = ['virtue', 'gentle', 'beauty', 'wisdom', 'art', 'harmony', 'fortune', 'loyal', 'strong'], th = ['ลิ่ง', 'ฮุ่ย', 'ซุ่น', 'หว่าน', 'เสียน', 'ชิ่ง', 'ฉุน', 'หรง', 'เจิน', 'เต๋อ', 'ตวน', 'จวง'], zh = '令惠順婉嫻慶純容貞德端莊';
      for (let i = 0; i < 12; i++) Q.NAMING.feng.push({ id: 'f_t' + i, zh: zh[i], th: th[i], mean: 'ความหมายทดสอบ', tags: [T[i % 9]], w: 5 });
      ['賢', '肅', '敏'].forEach((z, i) => Q.NAMING.extra.push({ id: 'x_t' + i, zh: z, th: ['เสียน', 'ซู่', 'หมิ่น'][i] + 'x', mean: 'ทดสอบ', tags: ['virtue'], pos: 'suf', w: 5 }));
      return true;
    });
    if (injected) console.log('  (note: real naming pools not loaded — using an injected test pool)');

    // ---- create screen: clan field
    await p.click('#btn-new'); await p.waitForSelector('.origin-card[data-origin="noble"]');
    await p.click('.origin-card[data-origin="noble"]');
    ok(await p.$eval('#clan-input', e => e.disabled && e.value === 'กวาเอ่อร์เจีย'), 'noble: clan fixed to กวาเอ่อร์เจีย');
    await p.click('.origin-card[data-origin="scholar"]');
    ok(await p.$eval('#clan-input', e => e.disabled && e.value === 'เซิ่น'), 'scholar: clan fixed to เซิ่น');
    await p.click('.origin-card[data-origin="maid"]');
    ok(await p.$eval('#clan-input', e => !e.disabled && e.value.length > 0), 'maid: clan editable');
    ok((await p.$$('#clan-chips .chip-btn')).length >= 6, 'maid: clan chips offered');
    await p.screenshot({ path: path.join(OUT, dev.n + '_nm_00_create.png') });
    await p.fill('#clan-input', 'หวัง');
    ok((await p.$eval('#preview-origin', e => e.textContent)).indexOf('หวัง') >= 0, 'preview shows the chosen clan');
    await p.click('#btn-start');

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
    ok(await advance(() => Game.st.rank >= 1 && !!document.querySelector('#hub-screen.active') && !Game.st.cur), 'reached the hub at rank 1');
    if (dev.n === 'phone') { const t = await p.$('#hub-tabs button[data-tab="actions"]'); if (t) await t.click(); }
    const sty = () => p.evaluate(() => QL.nmStyle(Game.st));
    let s = await sty();
    ok(s.th === 'หวัง ต้าอิ้ง' && s.mode === 'clan', 'rank 1 is called clan + rank: ' + s.th);
    ok(await p.$eval('.hero-rank', e => e.textContent.indexOf('หวัง') >= 0), 'hero card shows the clan-style title');
    ok(!!(await p.$('.btn-naming')), 'hub has the 🪪 naming button');

    // ---- naming modal before any fenghao
    await p.evaluate(() => Game.openNaming()); await p.waitForSelector('.modal-naming .nm-plate');
    ok((await p.$$eval('.modal-naming .nm-ladder li', e => e.length)) === 9, 'ladder lists 9 ranks');
    await p.screenshot({ path: path.join(OUT, dev.n + '_nm_01_modal_clan.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ---- promotion to ผิน → bestowal
    await p.evaluate(() => { const st = Game.st; st.rank = 3; st.S.favor = 20; QL.ensureN(st); st.pending = []; });
    await p.evaluate(() => { QL.promote(Game.st); });
    ok(await p.evaluate(() => Game.st.N.kind === 'pin' && Game.st.N.offer.length >= 1), 'promotion to ผิน queues the naming moment with offers');
    await advance(() => !!Game.st.nmCer || !!document.querySelector('#ceremony.nm.open'), 400);
    const cerOn = await p.$('#ceremony.nm');
    ok(!!cerOn || await p.evaluate(() => !!Game.st.N.feng), 'a naming ceremony / event resolved the bestowal');
    if (cerOn && await cerOn.isVisible()) { await p.screenshot({ path: path.join(OUT, dev.n + '_nm_02_ceremony.png') }); await p.click('#btn-ceremony-ok'); await p.waitForTimeout(500); }
    await advance(() => !!Game.st.N.feng && !Game.st.cur && !Game.st.nmCer && !!document.querySelector('#hub-screen.active'), 600);
    s = await sty();
    ok(s.mode === 'feng' && s.th.indexOf('หวัง') < 0, 'rank 4 is called fenghao + rank: ' + s.th);
    await p.evaluate(() => Game.openNaming()); await p.waitForSelector('.modal-naming .nm-plate:not(.plain)');
    ok((await p.$$eval('.modal-naming .nm-hanzi b', e => e.length)) >= 1, 'name plate shows the hanzi seal (' + s.zh + ')');
    await p.screenshot({ path: path.join(OUT, dev.n + '_nm_03_modal_feng.png') });
    await p.evaluate(() => Game.openNaming('hist')); await p.waitForSelector('.modal-naming .tb-hist li');
    ok(true, 'history tab lists the bestowal');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ---- extra word at หวงกุ้ยเฟย
    await p.evaluate(() => { const st = Game.st; st.rank = 6; st.pending = []; QL.ensureN(st); QL.promote(st); });
    await advance(() => Game.st.rank === 7 && !!Game.st.N.extra && !Game.st.cur && !Game.st.nmCer && !!document.querySelector('#hub-screen.active'), 600);
    s = await sty();
    ok(s.mode === 'feng' && !!(await p.evaluate(() => Game.st.N.extra)), 'rank 7 has the extra word: ' + s.th);
    await p.evaluate(() => Game.openNaming()); await p.waitForSelector('.modal-naming .nm-extra');
    await p.screenshot({ path: path.join(OUT, dev.n + '_nm_04_extra.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);

    // ---- strip and re-grant
    await p.evaluate(() => { QL.applyName(Game.st, { strip: true }); });
    s = await sty();
    ok(s.mode === 'clan' && /^หวัง /.test(s.th), 'after the strip she is called by clan again: ' + s.th);
    await advance(() => !Game.st.nmCer && !Game.st.cur && !!document.querySelector('#hub-screen.active'), 200);
    await p.evaluate(() => Game.openNaming()); await p.waitForSelector('.modal-naming .nm-block.warn');
    await p.screenshot({ path: path.join(OUT, dev.n + '_nm_05_stripped.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.evaluate(() => { const st = Game.st; st.S.favor = 60; QL.nmPrepare(st, 'regrant'); QL.nmDefault(st); });
    ok(await p.evaluate(() => !!Game.st.N.feng && !Game.st.N.stripped), 're-grant bestows a NEW fenghao');
    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nALL NAMING CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
