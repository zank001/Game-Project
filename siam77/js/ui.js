/* ui.js — DOM HUD, modal windows, dialogue, shops, travel, maps, passport,
   character creation and the full-resolution label overlay. */
'use strict';
(function () {
  const U = S77.U, E = S77.Events, $ = (id) => document.getElementById(id);
  const esc = U.esc;
  let G = null; // game
  const UI = (S77.UI = {});

  /* ---------------- toasts / banner / fade ---------------- */
  UI.toast = (msg, type) => {
    const box = $('toasts'); if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.textContent = msg;
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.classList.add('out'), 3400);
    setTimeout(() => d.remove(), 3900);
  };
  UI.banner = (title, sub) => {
    const b = $('banner'); if (!b) return;
    b.innerHTML = `<div class="bt">${esc(title)}</div><div class="bs">${esc(sub || '')}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  };
  UI.fade = (text, fn) => {
    const f = $('fade');
    f.innerHTML = `<div>${esc(text)}</div>`;
    f.classList.add('on');
    UI.busy = true;
    setTimeout(() => { try { fn && fn(); } finally { setTimeout(() => { f.classList.remove('on'); UI.busy = false; }, 350); } }, 900);
  };

  /* ---------------- modal ---------------- */
  let onCloseFn = null;
  UI.modalOpen = () => !$('modal').hidden || UI.busy;
  UI.open = (title, body, opts) => {
    opts = opts || {};
    const m = $('modal');
    m.querySelector('.ttl').innerHTML = (opts.icon ? opts.icon + ' ' : '') + esc(title);
    const b = m.querySelector('.win-b');
    b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    m.querySelector('.win').className = 'win' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '');
    m.hidden = false;
    onCloseFn = opts.onClose || null;
    S77.Input.clear();
    S77.Sound.play('open');
    return b;
  };
  UI.close = () => {
    const m = $('modal'); if (m.hidden) return;
    m.hidden = true;
    const f = onCloseFn; onCloseFn = null;
    if (G) G.talkingTo = null;
    if (f) f();
  };
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  // generic option list
  UI.menu = (title, options, opts) => {
    const box = el('div', 'opts');
    for (const o of options) {
      const btn = el('button', 'opt' + (o.disabled ? ' dis' : ''), `<span class="ol">${esc(o.label)}</span>${o.sub ? `<span class="os">${esc(o.sub)}</span>` : ''}`);
      btn.disabled = !!o.disabled;
      btn.onclick = () => { UI.close(); if (o.run) o.run(); };
      box.appendChild(btn);
    }
    UI.open(title, box, opts);
  };

  /* ---------------- shop / sell ---------------- */
  UI.shop = (g, name, ids, pi) => {
    const box = el('div', 'shop');
    const render = () => {
      box.innerHTML = `<div class="shop-top">เงิน <b>${U.fmtMoney(g.player.money)}</b> · กระเป๋า ${g.invCount()}/${g.invCap()}</div>`;
      for (const id of ids) {
        const it = S77.ITEMS[id]; if (!it) continue;
        const price = S77.Econ.buyPrice(g, id, pi);
        const owned = it.kind === 'vehicle' && g.player.vehicles[id];
        const row = el('div', 'row');
        const eff = [it.hunger && '🍚+' + it.hunger, it.energy && '⚡+' + it.energy, it.mood && '😊+' + it.mood, it.health && '❤️+' + it.health].filter(Boolean).join(' ');
        row.innerHTML = `<span class="ic">${it.icon}</span><span class="nm">${esc(it.th)}<small>${esc(it.desc || eff || '')}</small></span><span class="pr">${U.fmtMoney(price)}</span>`;
        const buy = el('button', 'btn', owned ? 'มีแล้ว' : 'ซื้อ');
        buy.disabled = !!owned;
        buy.onclick = () => {
          if (it.kind !== 'vehicle' && g.invCount() >= g.invCap()) return UI.toast('กระเป๋าเต็มแล้ว', 'bad');
          if (!g.spend(price, 'buy')) return;
          if (it.kind === 'vehicle') { g.player.vehicles[id] = true; UI.toast(it.icon + ' ได้' + it.th + 'แล้ว! กด R เพื่อขี่', 'good'); }
          else g.addItem(id, 1);
          E.emit('purchase', { id, price, prov: pi });
          render();
        };
        row.appendChild(buy);
        if (it.hunger || it.energy) {
          const eat = el('button', 'btn alt', 'กินเลย');
          eat.onclick = () => { if (!g.spend(price, 'buy')) return; g.addItem(id, 1); g.useItem(id); render(); };
          row.appendChild(eat);
        }
        box.appendChild(row);
      }
    };
    render();
    UI.open(name, box, { icon: '🛒' });
  };
  UI.sell = (g, pi) => {
    const box = el('div', 'shop');
    const render = () => {
      box.innerHTML = `<div class="shop-top">เงิน <b>${U.fmtMoney(g.player.money)}</b> · ราคารับซื้อที่${esc(S77.PROVINCES[pi].th)}</div>`;
      const ids = Object.keys(g.player.inv).filter((id) => { const it = g.itemDef(id); return it && it.kind !== 'quest' && it.kind !== 'vehicle'; });
      if (!ids.length) box.appendChild(el('div', 'empty', 'ไม่มีของที่ขายได้ — ลองทำงานเกษตร/ประมง หรือซื้อของดีจากต่างจังหวัดมาขาย'));
      for (const id of ids) {
        const it = g.itemDef(id), price = S77.Econ.sellPrice(g, id, pi), n = g.player.inv[id];
        const row = el('div', 'row');
        row.innerHTML = `<span class="ic">${it.icon}</span><span class="nm">${esc(it.th)} ×${n}<small>${it.prov ? 'จาก' + esc(S77.PROV_BY_KEY[it.prov].th) : ''}</small></span><span class="pr">${U.fmtMoney(price)}</span>`;
        const b1 = el('button', 'btn', 'ขาย 1'), ba = el('button', 'btn alt', 'ขายหมด');
        const doSell = (k) => { g.removeItem(id, k); g.earn(price * k, 'sell'); g.addSkill('trade', 0.3 * k); E.emit('sell', { id, n: k, price, prov: pi }); render(); };
        b1.onclick = () => doSell(1); ba.onclick = () => doSell(n);
        row.appendChild(b1); row.appendChild(ba);
        box.appendChild(row);
      }
    };
    render();
    UI.open('ขายของ', box, { icon: '💰' });
  };

  /* ---------------- dialogue ---------------- */
  UI.portrait = (look, scale, back) => {
    const spr = S77.Sprites.character(look), c = document.createElement('canvas');
    c.width = spr.fw * scale; c.height = spr.fh * scale; c.className = 'portrait';
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(spr, (back ? 4 : 0) * spr.fw, 0, spr.fw, spr.fh, 0, 0, spr.fw * scale, spr.fh * scale);
    return c;
  };
  UI.talk = (g, n) => {
    g.talkingTo = n;
    // face each other
    const p = g.player, sdx = (p.x - n.x) - (p.y - n.y);
    n.faceLeft = sdx < 0; n.faceBack = (p.x - n.x) + (p.y - n.y) < 0;
    const mem = n.mem;
    if (!mem.met) { mem.met = g.time.day + 1; mem.name = n.name; mem.prov = n.prov; mem.occ = n.occ; }
    const box = el('div', 'talk');
    const left = el('div', 'tl'); left.appendChild(UI.portrait(n.look, 5));
    const right = el('div', 'tr');
    box.appendChild(left); box.appendChild(right);
    const occ = S77.OCCUPATIONS[n.occ];
    const hearts = () => '❤'.repeat(Math.round(mem.f / 20)) + '♡'.repeat(5 - Math.round(mem.f / 20));
    const say = (text) => {
      right.querySelector('.say').textContent = '';
      let i = 0; const t = String(text);
      clearInterval(UI._tw);
      UI._tw = setInterval(() => { i += 2; right.querySelector('.say').textContent = t.slice(0, i); if (i % 6 === 0) S77.Sound.play('talk'); if (i >= t.length) clearInterval(UI._tw); }, 18);
    };
    const opts = el('div', 'topts');
    right.innerHTML = `<div class="tn">${esc(n.name)} <small>${esc(occ ? occ.th : '')} · อายุ ${n.age} · ${esc(S77.PROVINCES[n.prov].th)}</small></div><div class="th">${hearts()}</div><div class="say"></div>`;
    right.appendChild(opts);
    const bump = (k) => { mem.f = U.clamp(mem.f + k, 0, 100); right.querySelector('.th').textContent = hearts(); };
    const addOpt = (label, fn) => { const b = el('button', 'btn', label); b.onclick = fn; opts.appendChild(b); };
    const build = () => {
      opts.innerHTML = '';
      addOpt('💬 คุยเล่น', () => {
        say(S77.Talk.chat(g, n));
        if (mem.lastTalk !== g.time.day) { mem.lastTalk = g.time.day; bump(3 + Math.round(g.player.skills.charisma / 25)); g.addSkill('charisma', 0.3); g.player.counters.talks++; g.stat('mood', 1); E.emit('talk', { npc: n.id, prov: n.prov }); }
      });
      addOpt('🏞️ ถามเรื่องจังหวัด', () => say(S77.Talk.aboutProvince(g, n)));
      addOpt('🎁 ให้ของขวัญ', () => giftMenu());
      // quests
      const q = mem.quest ? g.quests.find((x) => x.id === mem.quest && !x.done) : null;
      if (q) {
        const can = (q.type === 'fetch' && g.player.inv[q.item]) || (q.type === 'visit' && q.seen);
        addOpt(can ? '✅ ส่งมอบภารกิจ' : '📝 เรื่องที่ฝากไว้', () => {
          if (!can) return say(q.type === 'deliver' ? 'ฝากเอาของไปส่งที่ตลาดใน' + S77.PROVINCES[q.target].th + 'ด้วยนะ' : 'ยังรออยู่นะ ' + q.text);
          if (q.type === 'fetch') g.removeItem(q.item, 1);
          S77.SYSTEMS.find((s) => s.id === 'quests').complete(g, q);
          say('ขอบใจมากเลยนะ! ช่วยได้เยอะจริงๆ'); build();
        });
      } else if (n.occ !== 'kid' && n.occ !== 'monk') {
        addOpt('🤝 มีอะไรให้ช่วยไหม', () => {
          if (mem.f < 8) return say('ขอบใจนะ แต่เรายังไม่ค่อยรู้จักกันเลย คุยกันบ่อยๆ ก่อนนะ');
          const qs = S77.SYSTEMS.find((s) => s.id === 'quests');
          const nq = qs.offer(g, n);
          if (nq === 'full') return say('ดูเหมือนคุณจะมีเรื่องต้องทำเยอะแล้วนะ ไว้ว่างค่อยมาใหม่');
          if (!nq) return say('ตอนนี้ยังไม่มีอะไรหรอก ขอบใจนะ');
          say(nq.text + ' (รางวัล ' + U.fmtMoney(nq.reward) + ')');
          opts.innerHTML = '';
          addOpt('👍 รับปาก', () => { qs.accept(g, nq, n); say('ขอบใจมาก! ไม่ต้องรีบนะ'); UI.toast('📝 รับภารกิจ: ' + nq.title, 'info'); build(); });
          addOpt('🙏 ไว้คราวหน้า', () => { if (nq.type === 'deliver') g.removeItem('parcel_' + nq.id, 1); say('ไม่เป็นไรจ้ะ'); build(); });
        });
      }
      addOpt('👋 ลาก่อน', () => UI.close());
    };
    const giftMenu = () => {
      opts.innerHTML = '';
      const ids = Object.keys(g.player.inv).filter((id) => { const it = g.itemDef(id); return it && (it.kind === 'food' || it.kind === 'good' || it.kind === 'drink'); });
      if (!ids.length) { say('(คุณไม่มีของที่จะให้)'); build(); return; }
      for (const id of ids.slice(0, 8)) {
        const it = g.itemDef(id);
        addOpt(it.icon + ' ' + it.th, () => {
          g.removeItem(id, 1);
          const foreign = it.prov && S77.PROV_BY_KEY[it.prov].idx !== n.prov;
          const k = Math.min(15, 3 + Math.round(it.price / 40) + (foreign ? 4 : 0));
          bump(k); g.addRep(n.prov, foreign ? 1 : 0);
          say(foreign ? 'ว้าว! ' + it.th + 'จาก' + S77.PROV_BY_KEY[it.prov].th + ' ไม่เคยกินเลย ขอบใจมากๆ!' : 'ขอบใจนะ น่ารักจัง');
          E.emit('gift', { npc: n.id, item: id });
          build();
        });
      }
      addOpt('↩️ กลับ', build);
    };
    UI.open(n.name, box, { cls: 'talkwin' });
    say(S77.Talk.greet(g, n));
    build();
  };

  /* ---------------- travel ---------------- */
  UI.travel = (g, mode, pi) => {
    const opts = S77.Travel.options(g, mode, pi);
    const box = el('div', 'travel');
    const search = el('input', 'search'); search.placeholder = '🔎 ค้นหาจังหวัด...';
    const list = el('div', 'tlist');
    box.appendChild(search); box.appendChild(list);
    const render = () => {
      const q = search.value.trim();
      list.innerHTML = '';
      for (const o of opts) {
        const p = S77.PROVINCES[o.to];
        if (q && p.th.indexOf(q) < 0 && p.en.toLowerCase().indexOf(q.toLowerCase()) < 0) continue;
        const row = el('button', 'trow');
        row.innerHTML = `<span class="dot" style="background:${S77.REGIONS[p.region].color}"></span><span class="nm">${esc(p.th)} ${g.player.visited.indexOf(p.idx) >= 0 ? '📮' : ''}<small>${esc(S77.REGIONS[p.region].th)} · ${o.km} กม. · ${o.hours} ชม.</small></span><span class="pr">${U.fmtMoney(o.price)}</span>`;
        row.onclick = () => go(o);
        list.appendChild(row);
      }
    };
    const go = (o) => {
      if (!g.spend(o.price, 'travel')) return;
      UI.close();
      const icon = mode === 'air' ? '✈️' : mode === 'rail' ? '🚆' : '🚌';
      UI.travelAnim(g, pi, o.to, icon, () => {
        g.advanceTime(Math.round(o.hours * 60), { energyK: mode === 'air' ? 0.3 : 0.5, hungerK: 0.7 });
        const [x, y] = S77.Travel.arrivalSpot(g, o.to, mode);
        const [wx, wy] = g.world.nearestWalkable(x, y, 6);
        g.teleport(wx + 0.5, wy + 0.5);
        g.checkLocation(false);
        E.emit('travel', { mode, from: pi, to: o.to, km: o.km });
      });
    };
    search.oninput = render;
    render();
    UI.open(mode === 'air' ? 'เที่ยวบินภายในประเทศ' : mode === 'rail' ? 'ขบวนรถไฟ' : 'รถโดยสารระหว่างจังหวัด', box, { icon: mode === 'air' ? '✈️' : mode === 'rail' ? '🚆' : '🚌' });
  };
  UI.travelAnim = (g, from, to, icon, done) => {
    const f = $('fade');
    f.innerHTML = '';
    const R = g.renderer, mc = R.mapCanvas, w = g.world;
    const A = w.towns[from], B = w.towns[to];
    const pad = 80, x0 = Math.max(0, Math.min(A.cx, B.cx) - pad), y0 = Math.max(0, Math.min(A.cy, B.cy) - pad);
    const x1 = Math.min(w.W, Math.max(A.cx, B.cx) + pad), y1 = Math.min(w.H, Math.max(A.cy, B.cy) + pad);
    const c = document.createElement('canvas'), s = Math.min(320 / (x1 - x0), 320 / (y1 - y0));
    c.width = (x1 - x0) * s; c.height = (y1 - y0) * s; c.className = 'tmap';
    const x = c.getContext('2d');
    const lab = el('div', 'tlab', `${icon} ${esc(S77.PROVINCES[from].th)} → ${esc(S77.PROVINCES[to].th)}`);
    f.appendChild(lab); f.appendChild(c);
    f.classList.add('on'); UI.busy = true;
    const t0 = performance.now(), dur = 2200;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      x.drawImage(mc, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
      const ax = (A.cx - x0) * s, ay = (A.cy - y0) * s, bx = (B.cx - x0) * s, by = (B.cy - y0) * s;
      x.strokeStyle = '#fff'; x.setLineDash([6, 5]); x.lineWidth = 2; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
      x.font = '20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(icon, ax + (bx - ax) * t, ay + (by - ay) * t);
      if (t < 1) requestAnimationFrame(step);
      else { try { done(); } finally { setTimeout(() => { f.classList.remove('on'); UI.busy = false; }, 300); } }
    };
    step();
  };

  /* ---------------- job board / bank ---------------- */
  UI.jobBoard = (g, pi) => {
    const p = S77.PROVINCES[pi], t = g.world.towns[pi], opts = [];
    const where = { vendor: 'ตลาดสด', clerk: 'ร้านสะดวกซื้อ/ห้าง', kitchen: 'ร้านอาหาร', hotel: 'โรงแรม', factory: 'โรงงาน', office: 'อาคารสำนักงาน', teacher: 'โรงเรียน', hospital: 'โรงพยาบาล', gov: 'ศาลากลางจังหวัด', volunteer: 'วัด', farm: 'ทุ่งนา (ยืนบนนาแล้วกด E)', fishing: 'ชายหาด/ท่าเรือ', rubber: 'สวนยาง (ภาคใต้)', orchard: 'สวนผลไม้' };
    const avail = ['vendor', 'clerk', 'kitchen', 'hotel', 'gov', 'volunteer', 'farm'];
    if (t.factory !== undefined) avail.push('factory');
    if (t.office !== undefined || p.tier <= 2) avail.push('office');
    if (t.school !== undefined) avail.push('teacher');
    if (t.hospital !== undefined) avail.push('hospital');
    if (p.econ.indexOf('F') >= 0) avail.push('fishing');
    if (p.region === 'south') avail.push('rubber');
    if (p.region === 'east') avail.push('orchard');
    if (p.econ.indexOf('T') >= 0) avail.push('guide');
    for (const j of avail) {
      const J = S77.JOBS[j];
      opts.push({ label: J.th + ' — ' + U.fmtMoney(S77.Econ.wage(g, j, pi)) + '/' + J.hours + ' ชม.', sub: (j === 'guide' ? 'รับงานได้ที่นี่ทันที' : 'ทำได้ที่: ' + (where[j] || '-')) + (J.req ? ' · ต้องมี' + Object.keys(J.req).map((k) => S77.SKILL_TH[k] + ' ' + J.req[k]).join(', ') : ''), run: j === 'guide' ? () => g.confirmJob('guide', pi) : null, disabled: j !== 'guide' });
    }
    const hasRide = g.player.vehicles.motorbike || g.player.vehicles.bicycle;
    opts.unshift({ label: '🛵 ไรเดอร์ส่งอาหาร (งานด่วน)', sub: hasRide ? 'รับออเดอร์ในเมือง แล้วขี่ไปส่งตามลูกศร' : 'ต้องมีจักรยานหรือมอเตอร์ไซค์', disabled: !hasRide || !!g.delivery, run: () => g.startDelivery(pi) });
    UI.menu('งานใน' + p.th, opts, { icon: '📋' });
  };
  UI.bank = (g) => {
    const box = el('div', 'shop');
    const render = () => {
      box.innerHTML = `<div class="shop-top">เงินสด <b>${U.fmtMoney(g.player.money)}</b> · เงินฝาก <b>${U.fmtMoney(g.player.bank)}</b></div><div class="empty">เงินฝากปลอดภัยแม้หมดสติ และจะเป็นทุนสำหรับกิจกรรมทางการเมืองใน Phase 2</div>`;
      const row = el('div', 'row wrap');
      for (const amt of [500, 1000, 5000, 'all']) {
        const b = el('button', 'btn', 'ฝาก ' + (amt === 'all' ? 'ทั้งหมด' : U.fmtMoney(amt)));
        b.onclick = () => { const a = amt === 'all' ? g.player.money : Math.min(amt, g.player.money); g.player.money -= a; g.player.bank += a; render(); };
        row.appendChild(b);
      }
      for (const amt of [500, 1000, 5000, 'all']) {
        const b = el('button', 'btn alt', 'ถอน ' + (amt === 'all' ? 'ทั้งหมด' : U.fmtMoney(amt)));
        b.onclick = () => { const a = amt === 'all' ? g.player.bank : Math.min(amt, g.player.bank); g.player.bank -= a; g.player.money += a; render(); };
        row.appendChild(b);
      }
      box.appendChild(row);
    };
    render();
    UI.open('ธนาคาร', box, { icon: '🏦' });
  };

  /* ---------------- province dashboard (Phase-2 ready) ---------------- */
  const bar = (v, max, color) => `<span class="bar"><i style="width:${U.clamp((v / (max || 100)) * 100, 0, 100)}%;background:${color || '#4caf50'}"></i></span>`;
  UI.provinceInfo = (g, pi) => {
    const p = S77.PROVINCES[pi], st = g.provState[pi], R = S77.REGIONS[p.region];
    const gov = S77.SYSTEMS.find((s) => s.id === 'npcs').populate(g, pi + 1).npcs[0];
    const sup = S77.partySupport(g, pi);
    const issues = st.issues.map((x) => `<div class="iss"><span>${esc(S77.ISSUES[x.id].th)}</span>${bar(x.sev * 100, 100, '#e0705a')}</div>`).join('') || '<div class="empty">ไม่มีปัญหาเร่งด่วน</div>';
    const html = `
      <div class="pinfo">
        <div class="ph" style="border-color:${R.color}"><div class="pn">${esc(p.th)} <small>${esc(p.en)}</small></div><div class="pt">${esc(R.th)} · "${esc(p.tagline)}"</div></div>
        <div class="grid2">
          <div>👥 ประชากร <b>${U.fmtNum(p.pop * 1000)}</b> คน</div><div>🗺️ พื้นที่ <b>${U.fmtNum(p.area)}</b> ตร.กม.</div>
          <div>🗳️ ส.ส. เขต <b>${st.seats}</b> ที่นั่ง</div><div>👔 ผู้ว่าฯ <b>${esc(gov.first + ' ' + gov.last)}</b></div>
          <div>💹 ดัชนีเศรษฐกิจ <b>${st.econ.toFixed(2)}</b></div><div>💼 ว่างงาน <b>${st.unemployment}%</b> · ค่าแรง ×${st.wageMul}</div>
        </div>
        <div class="stats">
          <div>😊 ความสุขของประชาชน ${bar(st.happiness, 100, '#f2c14e')} ${Math.round(st.happiness)}</div>
          <div>🏗️ การพัฒนา ${bar(st.development)} ${Math.round(st.development)}</div>
          <div>🌳 สิ่งแวดล้อม ${bar(st.environment, 100, '#3fb3a8')} ${Math.round(st.environment)}</div>
          <div>🎓 การศึกษา ${bar(st.education, 100, '#5d8fd0')} ${Math.round(st.education)}</div>
          <div>🏥 สาธารณสุข ${bar(st.health, 100, '#e0705a')} ${Math.round(st.health)}</div>
          <div>🛡️ ความปลอดภัย ${bar(st.safety, 100, '#b07ac9')} ${Math.round(st.safety)}</div>
        </div>
        <h4>ปัญหาที่ประชาชนเดือดร้อน</h4>${issues}
        <h4>ของดี & ที่เที่ยว</h4>
        <div class="grid2"><div>🍲 ${esc(p.dish)}</div><div>🎁 ${esc(p.good)}</div><div>📍 ${esc(p.landmark)}</div><div>⭐ ชื่อเสียงของคุณ <b>${Math.round(g.player.rep[pi] || 0)}</b></div></div>
        <h4>ความนิยมทางการเมือง <span class="tag">ตัวอย่างระบบ Phase 2</span></h4>
        ${sup.map((s) => `<div class="iss"><span><i class="sw" style="background:${s.party.color}"></i>${esc(s.party.th)}</span>${bar(s.share * 100, 60, s.party.color)} ${(s.share * 100).toFixed(0)}%</div>`).join('')}
        <div class="note">* พรรคการเมืองทั้งหมดเป็นพรรคสมมติ · ตัวเลขเป็นข้อมูลจำลองเพื่อการเล่นเกม</div>
      </div>`;
    UI.open('ข้อมูลจังหวัด', html, { icon: '📊', wide: true });
  };

  /* ---------------- world map ---------------- */
  UI.worldMap = (g) => {
    const w = g.world, R = g.renderer;
    const box = el('div', 'wmap');
    const side = el('div', 'wside');
    const wrap = el('div', 'wwrap');
    const cv = document.createElement('canvas'); cv.className = 'wcv';
    wrap.appendChild(cv); box.appendChild(wrap); box.appendChild(side);
    const modes = el('div', 'wmodes');
    const MODES = [['terrain', 'ภูมิประเทศ'], ['region', 'ภูมิภาค'], ['visited', 'ที่เคยไป'], ['happy', 'ความสุข']];
    let mode = 'terrain';
    for (const [k, l] of MODES) { const b = el('button', 'btn' + (k === mode ? ' on' : ''), l); b.onclick = () => { mode = k; [...modes.children].forEach((c) => c.classList.toggle('on', c === b)); draw(); }; modes.appendChild(b); }
    side.appendChild(modes);
    const info = el('div', 'winfo', '<div class="empty">แตะ/คลิกที่จังหวัดเพื่อดูข้อมูล · ลากเพื่อเลื่อน · ล้อเมาส์/ปุ่ม +/- เพื่อซูม</div>');
    side.appendChild(info);
    const zb = el('div', 'wzoom'); const zi = el('button', 'btn', '＋'), zo = el('button', 'btn', '－'), zc = el('button', 'btn', '📍 ตัวฉัน');
    zb.appendChild(zi); zb.appendChild(zo); zb.appendChild(zc); wrap.appendChild(zb);
    UI.open('แผนที่ประเทศ · 77 จังหวัด', box, { icon: '🗺️', wide: true, cls: 'mapwin' });
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(rect.width * dpr); cv.height = Math.floor(rect.height * dpr);
    cv.style.width = rect.width + 'px'; cv.style.height = rect.height + 'px';
    const fit = Math.min(cv.width / w.W, cv.height / w.H);
    let scale = fit, ox = (cv.width - w.W * scale) / 2, oy = (cv.height - w.H * scale) / 2;
    // overlay layers (half resolution)
    const overlay = (fn) => {
      const c = document.createElement('canvas'), W2 = w.W >> 1, H2 = w.H >> 1; c.width = W2; c.height = H2;
      const x = c.getContext('2d'), img = x.createImageData(W2, H2), d = new Uint32Array(img.data.buffer);
      const cache = {};
      for (let y = 0; y < H2; y++) for (let xx = 0; xx < W2; xx++) { const p = w.prov[(y * 2) * w.W + xx * 2]; if (!p) continue; const k = p - 1; d[y * W2 + xx] = cache[k] !== undefined ? cache[k] : (cache[k] = fn(k)); }
      x.putImageData(img, 0, 0); return c;
    };
    const PB = S77.PixelBuffer;
    const layers = {};
    const layer = (m) => {
      if (layers[m]) return layers[m];
      if (m === 'region') return (layers[m] = overlay((k) => PB.pack(S77.REGIONS[S77.PROVINCES[k].region].color, 150)));
      if (m === 'visited') return (layers[m] = overlay((k) => (g.player.visited.indexOf(k) >= 0 ? PB.pack('#4caf50', 70) : PB.pack('#1a1a24', 170))));
      if (m === 'happy') return (layers[m] = overlay((k) => { const h = g.provState[k].happiness / 100; return PB.pack(U.mix('#d64545', '#3fbf5f', U.clamp((h - 0.35) / 0.4, 0, 1)), 160); }));
      return null;
    };
    let sel = null;
    const x = cv.getContext('2d');
    const draw = () => {
      x.fillStyle = '#163f6e'; x.fillRect(0, 0, cv.width, cv.height);
      x.imageSmoothingEnabled = scale < 1;
      x.drawImage(R.mapCanvas, ox, oy, w.W * scale, w.H * scale);
      const L = layer(mode); if (L) { x.imageSmoothingEnabled = false; x.drawImage(L, ox, oy, w.W * scale, w.H * scale); }
      if (sel !== null) {
        const b = w.provBox[sel];
        x.strokeStyle = '#ffeb3b'; x.lineWidth = 2; x.strokeRect(ox + b[0] * scale, oy + b[1] * scale, (b[2] - b[0]) * scale, (b[3] - b[1]) * scale);
      }
      // capitals + labels
      x.textAlign = 'center'; x.textBaseline = 'bottom';
      const fs = Math.round(U.clamp(scale * 9, 9, 15) * dpr);
      x.font = `bold ${fs}px "Noto Sans Thai","Leelawadee UI",Tahoma,sans-serif`;
      for (const t of w.towns) {
        const px = ox + t.cx * scale, py = oy + t.cy * scale;
        x.fillStyle = g.player.visited.indexOf(t.idx) >= 0 ? '#ffeb3b' : '#fff'; x.fillRect(px - 2 * dpr, py - 2 * dpr, 4 * dpr, 4 * dpr);
        if (scale > fit * 1.6 || t.prov.tier <= 2 || sel === t.idx) { x.lineWidth = 3 * dpr; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(t.prov.th, px, py - 3 * dpr); x.fillStyle = '#fff'; x.fillText(t.prov.th, px, py - 3 * dpr); }
      }
      // quests
      for (const q of g.quests) if (!q.done) { const t = w.towns[q.target]; x.font = `${14 * dpr}px sans-serif`; x.fillText('❗', ox + t.cx * scale, oy + t.cy * scale - 4 * dpr); }
      if (g.waypoint) { x.font = `${16 * dpr}px sans-serif`; x.fillText('🚩', ox + g.waypoint.x * scale, oy + g.waypoint.y * scale); }
      // player
      const pp = g.player, blink = (performance.now() / 300) % 2 < 1;
      x.fillStyle = blink ? '#ff3b6b' : '#fff'; x.beginPath(); x.arc(ox + pp.x * scale, oy + pp.y * scale, 5 * dpr, 0, 7); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 1.5; x.stroke();
    };
    const showInfo = (k) => {
      sel = k; const p = S77.PROVINCES[k], st = g.provState[k];
      const visited = g.player.visited.indexOf(k) >= 0;
      info.innerHTML = `<div class="pn">${esc(p.th)} <small>${esc(p.en)}</small></div><div class="pt">${esc(S77.REGIONS[p.region].th)} · ${visited ? '📮 เคยไปแล้ว' : 'ยังไม่เคยไป'}</div>
        <div>👥 ${U.fmtNum(p.pop * 1000)} คน · 🗳️ ${st.seats} ที่นั่ง</div><div>📍 ${esc(p.landmark)}</div><div>🍲 ${esc(p.dish)} · 🎁 ${esc(p.good)}</div>
        <div>😊 ความสุข ${Math.round(st.happiness)} · ⚠️ ${st.issues.slice(0, 2).map((i) => esc(S77.ISSUES[i.id].th)).join(', ') || '-'}</div>
        <div>${p.airport ? '✈️ มีสนามบิน ' : ''}${p.rail ? '🚆 มีสถานีรถไฟ' : ''}</div>`;
      const b1 = el('button', 'btn', '🚩 ปักหมุดนำทาง'); b1.onclick = () => { const t = w.towns[k]; g.waypoint = { x: t.cx, y: t.cy, label: p.th }; UI.toast('🚩 ปักหมุดไป' + p.th + ' แล้ว ทำตามลูกศรบนจอได้เลย', 'info'); draw(); };
      const b2 = el('button', 'btn alt', '📊 รายละเอียด'); b2.onclick = () => UI.provinceInfo(g, k);
      info.appendChild(b1); info.appendChild(b2);
      draw();
    };
    // interactions
    let drag = null, moved = false;
    cv.onpointerdown = (e) => { drag = [e.clientX, e.clientY, ox, oy]; moved = false; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (drag) { const dx = (e.clientX - drag[0]) * dpr, dy = (e.clientY - drag[1]) * dpr; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; ox = drag[2] + dx; oy = drag[3] + dy; draw(); return; }
    };
    cv.onpointerup = (e) => {
      const was = drag; drag = null;
      if (!was || moved) return;
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
      const tx = Math.floor((mx - ox) / scale), ty = Math.floor((my - oy) / scale);
      if (!w.inb(tx, ty)) return;
      const pv = w.prov[ty * w.W + tx];
      if (pv) showInfo(pv - 1);
    };
    const zoomAt = (f, mx, my) => { const ns = U.clamp(scale * f, fit * 0.9, 6); ox = mx - ((mx - ox) * ns) / scale; oy = my - ((my - oy) * ns) / scale; scale = ns; draw(); };
    cv.onwheel = (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr); };
    zi.onclick = () => zoomAt(1.4, cv.width / 2, cv.height / 2);
    zo.onclick = () => zoomAt(0.7, cv.width / 2, cv.height / 2);
    zc.onclick = () => { scale = Math.max(scale, fit * 3); ox = cv.width / 2 - g.player.x * scale; oy = cv.height / 2 - g.player.y * scale; draw(); };
    draw();
    const cur = g.currentProv; if (cur) showInfo(cur.idx);
    UI._mapTimer = setInterval(() => { if ($('modal').hidden) clearInterval(UI._mapTimer); else draw(); }, 400);
  };

  /* ---------------- inventory / passport / quests / status ---------------- */
  UI.inventory = (g) => {
    const box = el('div', 'shop');
    const render = () => {
      box.innerHTML = `<div class="shop-top">เงิน <b>${U.fmtMoney(g.player.money)}</b> · ช่องเก็บของ ${g.invCount()}/${g.invCap()}</div>`;
      const vs = Object.keys(g.player.vehicles);
      for (const v of vs) {
        const it = S77.ITEMS[v], row = el('div', 'row');
        row.innerHTML = `<span class="ic">${it.icon}</span><span class="nm">${esc(it.th)}<small>${esc(it.desc)}</small></span>`;
        const b = el('button', 'btn', g.player.riding === v ? 'ลงรถ' : 'ขี่');
        b.onclick = () => { g.toggleRide(v); UI.close(); };
        row.appendChild(b); box.appendChild(row);
      }
      const ids = Object.keys(g.player.inv);
      if (!ids.length && !vs.length) box.appendChild(el('div', 'empty', 'กระเป๋าว่างเปล่า'));
      for (const id of ids) {
        const it = g.itemDef(id); if (!it) continue;
        const row = el('div', 'row');
        const eff = [it.hunger && '🍚+' + it.hunger, it.energy && '⚡+' + it.energy, it.mood && '😊+' + it.mood, it.health && '❤️+' + it.health].filter(Boolean).join(' ');
        row.innerHTML = `<span class="ic">${it.icon}</span><span class="nm">${esc(it.th)} ×${g.player.inv[id]}<small>${esc(eff || it.desc || (it.prov ? 'ของดีจาก' + S77.PROV_BY_KEY[it.prov].th : ''))}</small></span>`;
        if (it.hunger || it.energy || it.health || it.kind === 'book') { const b = el('button', 'btn', it.kind === 'book' ? 'อ่าน' : 'ใช้'); b.onclick = () => { g.useItem(id); if (it.kind === 'book') UI.close(); else render(); }; row.appendChild(b); }
        if (it.kind !== 'quest') { const d = el('button', 'btn alt', 'ทิ้ง'); d.onclick = () => { g.removeItem(id, 1); render(); }; row.appendChild(d); }
        box.appendChild(row);
      }
    };
    render();
    UI.open('กระเป๋า', box, { icon: '🎒' });
  };
  UI.passport = (g) => {
    const pl = g.player, box = el('div', 'passport');
    const lm = pl.landmarks.length, dishes = pl.dishes.length;
    box.innerHTML = `<div class="pp-sum">
      <div>📮 จังหวัดที่ไปแล้ว <b>${pl.visited.length}/77</b>${bar(pl.visited.length, 77, '#e0705a')}</div>
      <div>📸 แลนด์มาร์ก <b>${lm}/77</b>${bar(lm, 77, '#5d8fd0')}</div>
      <div>🍲 อาหารขึ้นชื่อ <b>${dishes}/77</b>${bar(dishes, 77, '#f2c14e')}</div></div>`;
    for (const rk of Object.keys(S77.REGIONS)) {
      const R = S77.REGIONS[rk];
      box.appendChild(el('h4', '', `<i class="sw" style="background:${R.color}"></i>${esc(R.th)}`));
      const grid = el('div', 'stamps');
      for (const p of S77.PROVINCES.filter((q) => q.region === rk)) {
        const v = pl.visited.indexOf(p.idx) >= 0;
        const t = g.world.towns[p.idx];
        const hasLm = t.landmark !== undefined && pl.landmarks.indexOf(t.landmark) >= 0, hasD = pl.dishes.indexOf('dish_' + p.key) >= 0;
        const s = el('div', 'stamp' + (v ? ' on' : ''), `<span class="sn">${esc(p.th)}</span><span class="si">${hasLm ? '📸' : ''}${hasD ? '🍲' : ''}</span>`);
        s.style.setProperty('--c', R.color);
        s.title = p.th + ' · ' + p.landmark;
        grid.appendChild(s);
      }
      box.appendChild(grid);
    }
    UI.open('พาสปอร์ตเที่ยวไทย', box, { icon: '📮', wide: true });
  };
  UI.quests = (g) => {
    const box = el('div', 'shop');
    const act = g.quests.filter((q) => !q.done), done = g.quests.filter((q) => q.done);
    if (g.delivery) box.appendChild(el('div', 'row', `<span class="ic">🛵</span><span class="nm">ส่งอาหาร<small>ไปตามลูกศรให้ทันเวลา · ค่าจ้าง ${U.fmtMoney(g.delivery.reward)}</small></span>`));
    if (!act.length && !g.delivery) box.appendChild(el('div', 'empty', 'ยังไม่มีภารกิจ — ลองคุยกับชาวบ้านจนสนิท แล้วถาม "มีอะไรให้ช่วยไหม"'));
    for (const q of act) {
      const p = S77.PROVINCES[q.target];
      const row = el('div', 'row');
      const status = q.type === 'deliver' ? 'นำของไปส่งที่ตลาด' + p.th : q.type === 'fetch' ? (g.player.inv[q.item] ? 'มีของแล้ว กลับไปหา ' + q.giverName : 'ซื้อ' + S77.ITEMS[q.item].th + 'ที่' + p.th) : q.seen ? 'ถ่ายรูปแล้ว กลับไปหา ' + q.giverName : 'ไปถ่ายรูป' + p.landmark;
      row.innerHTML = `<span class="ic">📝</span><span class="nm">${esc(q.title)} <small>จาก ${esc(q.giverName)} (${esc(S77.PROVINCES[q.giverProv].th)}) · ${esc(status)}</small></span><span class="pr">${U.fmtMoney(q.reward)}</span>`;
      const b = el('button', 'btn', '🚩');
      b.title = 'ปักหมุด';
      b.onclick = () => { const back = (q.type !== 'deliver' && ((q.type === 'fetch' && g.player.inv[q.item]) || q.seen)); const t = g.world.towns[back ? q.giverProv : q.target]; g.waypoint = { x: t.cx, y: t.cy, label: S77.PROVINCES[back ? q.giverProv : q.target].th }; UI.toast('🚩 ปักหมุดแล้ว', 'info'); };
      row.appendChild(b); box.appendChild(row);
    }
    if (done.length) box.appendChild(el('h4', '', 'สำเร็จแล้ว (' + done.length + ')'));
    for (const q of done.slice(-8).reverse()) box.appendChild(el('div', 'row done', `<span class="ic">✅</span><span class="nm">${esc(q.title)}<small>${esc(q.giverName)}</small></span>`));
    UI.open('ภารกิจ', box, { icon: '📝' });
  };
  UI.status = (g) => {
    const pl = g.player, box = el('div', 'status');
    const left = el('div', 'sl'); left.appendChild(UI.portrait(pl.look, 6)); left.appendChild(UI.portrait(pl.look, 6, true));
    const reps = pl.rep.map((v, i) => [v, i]).filter((r) => r[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 6);
    const friends = Object.values(g.npcMem).filter((m) => m.name && m.f > 0).sort((a, b) => b.f - a.f).slice(0, 8);
    const sk = pl.skills;
    const right = el('div', 'sr', `
      <div class="pn">${esc(pl.name)}</div>
      <div>🏡 บ้านเกิด ${esc(S77.PROVINCES[pl.hometown].th)} · 🪪 ทะเบียนบ้าน <b>${esc(S77.PROVINCES[pl.regProv].th)}</b></div>
      <div>💰 เงินสด ${U.fmtMoney(pl.money)} · 🏦 เงินฝาก ${U.fmtMoney(pl.bank)} · 🏠 บ้าน ${pl.homes.length} หลัง</div>
      <h4>ทักษะ</h4>
      <div class="stats">${Object.keys(S77.SKILL_TH).map((k) => `<div>${esc(S77.SKILL_TH[k])} ${bar(sk[k])} ${Math.floor(sk[k])}</div>`).join('')}</div>
      <h4>ชื่อเสียงสูงสุด</h4>
      <div class="stats">${reps.map(([v, i]) => `<div>${esc(S77.PROVINCES[i].th)} ${bar(v, 100, '#9fe0ff')} ${Math.round(v)}</div>`).join('') || '<div class="empty">ยังไม่มีใครรู้จักคุณ</div>'}</div>
      <h4>เพื่อน</h4>
      <div class="friends">${friends.map((m) => `<span>${esc(m.name)} <small>${esc(S77.PROVINCES[m.prov].th)}</small> ${'❤'.repeat(Math.max(1, Math.round(m.f / 20)))}</span>`).join('') || '<div class="empty">ไปทำความรู้จักชาวบ้านกันเถอะ</div>'}</div>
      <h4>บันทึกการใช้ชีวิต</h4>
      <div class="grid2"><div>📅 ใช้ชีวิตมา ${pl.counters.days} วัน</div><div>👣 เดินทาง ${U.fmtNum(pl.counters.km)} กม.</div><div>💼 ทำงาน ${pl.counters.jobs} ครั้ง</div><div>💵 รายได้รวม ${U.fmtMoney(pl.counters.earned)}</div><div>💬 พูดคุย ${pl.counters.talks} ครั้ง</div><div>✅ ภารกิจ ${pl.counters.quests || 0}</div></div>`);
    box.appendChild(left); box.appendChild(right);
    UI.open('ตัวละคร', box, { icon: '👤', wide: true });
  };

  /* ---------------- system menu / settings / save-load / help ---------------- */
  UI.help = () => UI.open('วิธีเล่น', `<div class="help">
    <p><b>เป้าหมาย:</b> ใช้ชีวิตในประเทศจำลอง 77 จังหวัด ทำงานหาเงิน กินของอร่อย เดินทางเก็บตราประทับให้ครบทุกจังหวัด สร้างมิตรภาพและชื่อเสียง — ซึ่งจะกลายเป็นฐานเสียงของคุณเมื่อระบบการเมืองเปิดใน <b>Phase 2</b></p>
    <table>
      <tr><td>WASD / ลูกศร</td><td>เดิน (กด Shift ค้างเพื่อวิ่ง)</td></tr>
      <tr><td>E / Enter / Space</td><td>พูดคุย · เข้าอาคาร · ทำกิจกรรม</td></tr>
      <tr><td>M</td><td>แผนที่ประเทศ</td></tr><tr><td>I</td><td>กระเป๋า</td></tr><tr><td>P</td><td>พาสปอร์ต</td></tr>
      <tr><td>J</td><td>ภารกิจ</td></tr><tr><td>C</td><td>ข้อมูลตัวละคร</td></tr><tr><td>R</td><td>ขี่/ลงจากยานพาหนะ</td></tr>
      <tr><td>+ / −</td><td>ซูมเข้า/ออก</td></tr><tr><td>Esc</td><td>เมนู / บันทึกเกม</td></tr>
    </table>
    <p>📱 บนมือถือ: แตะซีกซ้ายของจอแล้วลากเพื่อเดิน ใช้ปุ่มด้านขวาล่างเพื่อโต้ตอบ</p>
    <p>💡 เคล็ดลับ: ความอิ่มและพลังงานลดลงตามเวลา — กินที่ตลาด/ร้านค้า และนอนที่โรงแรม · ของดีประจำจังหวัดขายต่างถิ่นได้กำไร · ไปสถานีขนส่งเพื่อเดินทางเร็ว</p></div>`, { icon: '❓', wide: true });
  UI.systemMenu = (g) => {
    const o = [
      { label: '▶️ เล่นต่อ', run: () => {} },
      { label: '💾 บันทึกเกม', run: () => UI.saveLoad(g, 'save') },
      { label: '📂 โหลดเกม', run: () => UI.saveLoad(g, 'load') },
      { label: '⚙️ ตั้งค่า', run: () => UI.settings(g) },
      { label: '❓ วิธีเล่น', run: () => UI.help() },
      { label: '🏠 กลับหน้าหลัก', sub: 'บันทึกอัตโนมัติก่อนออก', run: () => { g.save('auto', true); location.reload(); } },
    ];
    UI.menu('เมนู', o, { icon: '☰' });
  };
  UI.saveLoad = (g, mode) => {
    const box = el('div', 'opts');
    for (const slot of ['auto', '1', '2', '3']) {
      const d = S77.Game.readSave(slot);
      const label = (slot === 'auto' ? '🔄 อัตโนมัติ' : '💾 ช่อง ' + slot) + (d ? ' — ' + d.player.name : ' — ว่าง');
      const sub = d ? new Date(d.savedAt).toLocaleString('th-TH') + ' · ' + U.fmtMoney(d.player.money) + ' · ' + d.player.visited.length + '/77 จังหวัด' : '';
      const b = el('button', 'opt' + ((mode === 'load' && !d) || (mode === 'save' && slot === 'auto') ? ' dis' : ''), `<span class="ol">${esc(label)}</span><span class="os">${esc(sub)}</span>`);
      b.disabled = (mode === 'load' && !d) || (mode === 'save' && slot === 'auto');
      b.onclick = () => { UI.close(); if (mode === 'save') g.save(slot); else { g.load(d); UI.toast('📂 โหลดเกมแล้ว', 'info'); } };
      box.appendChild(b);
    }
    if (!S77.Store.available) box.appendChild(el('div', 'note', '⚠️ เบราว์เซอร์นี้ไม่อนุญาตให้เก็บข้อมูลถาวร เซฟจะหายเมื่อปิดหน้า'));
    UI.open(mode === 'save' ? 'บันทึกเกม' : 'โหลดเกม', box, { icon: mode === 'save' ? '💾' : '📂' });
  };
  UI.settings = (g) => {
    const s = g.settings, box = el('div', 'settings');
    const row = (label, choices, cur, fn) => {
      const r = el('div', 'srow', `<span>${esc(label)}</span>`), bx = el('div', 'sch');
      for (const [v, l] of choices) { const b = el('button', 'btn' + (v === cur ? ' on' : ''), l); b.onclick = () => { fn(v); [...bx.children].forEach((c) => c.classList.toggle('on', c === b)); persist(); }; bx.appendChild(b); }
      r.appendChild(bx); box.appendChild(r);
    };
    const persist = () => S77.Store.set('s77_settings', JSON.stringify(s));
    row('ความเร็วเวลา (นาทีเกม/วินาที)', [[0.5, '0.5×'], [1, '1×'], [2, '2×'], [4, '4×']], s.timeRate, (v) => { s.timeRate = v; g.time.rate = v; });
    row('มุมกล้อง', [[420, 'ใกล้'], [600, 'ปกติ'], [820, 'ไกล']], s.viewW, (v) => { s.viewW = v; g.renderer.setTargetWidth(v); });
    row('ป้ายชื่อ', [[true, 'แสดง'], [false, 'ซ่อน']], s.labels, (v) => (s.labels = v));
    row('เสียง', [[true, 'เปิด'], [false, 'ปิด']], s.sound, (v) => { s.sound = v; S77.soundOn = v; });
    UI.open('ตั้งค่า', box, { icon: '⚙️' });
  };

  /* ---------------- HUD ---------------- */
  UI.init = (g) => {
    G = g;
    S77.soundOn = g.settings.sound;
    $('modal').querySelector('.x').onclick = UI.close;
    $('modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') UI.close(); });
    const btn = (id, fn) => { const b = $(id); if (b) b.onclick = (e) => { e.stopPropagation(); if (!g.player || UI.busy) return; S77.Sound.play('click'); fn(); }; };
    btn('bMap', () => UI.worldMap(g)); btn('bInv', () => UI.inventory(g)); btn('bPass', () => UI.passport(g)); btn('bQuest', () => UI.quests(g)); btn('bStat', () => UI.status(g)); btn('bMenu', () => UI.systemMenu(g));
    btn('bAct', () => g.interact()); btn('bRide', () => g.toggleRide()); btn('prompt', () => g.interact());
    btn('bZoomIn', () => zoom(-1)); btn('bZoomOut', () => zoom(1));
    const zoom = (d) => { const steps = [420, 600, 820], i = U.clamp(steps.indexOf(g.settings.viewW) + d, 0, 2); g.settings.viewW = steps[i]; g.renderer.setTargetWidth(steps[i]); S77.Store.set('s77_settings', JSON.stringify(g.settings)); };
    UI.zoom = zoom;
    const I = S77.Input;
    I.on('act', () => { if (!UI.modalOpen()) g.interact(); });
    I.on('map', () => (UI.modalOpen() ? UI.close() : g.player && UI.worldMap(g)));
    I.on('inv', () => (UI.modalOpen() ? UI.close() : g.player && UI.inventory(g)));
    I.on('passport', () => (UI.modalOpen() ? UI.close() : g.player && UI.passport(g)));
    I.on('quests', () => (UI.modalOpen() ? UI.close() : g.player && UI.quests(g)));
    I.on('status', () => (UI.modalOpen() ? UI.close() : g.player && UI.status(g)));
    I.on('ride', () => !UI.modalOpen() && g.player && g.toggleRide());
    I.on('esc', () => (UI.modalOpen() ? UI.close() : g.player && UI.systemMenu(g)));
    I.on('help', () => (UI.modalOpen() ? UI.close() : UI.help()));
    I.on('zoomIn', () => zoom(-1)); I.on('zoomOut', () => zoom(1));
  };
  let hudT = 0, miniT = 0;
  UI.updateHud = (g, dt) => {
    if (!g.player) return;
    hudT -= dt; miniT -= dt;
    // prompt every frame
    const pr = $('prompt');
    const t = g.target;
    if (t && !UI.modalOpen()) { pr.hidden = false; pr.innerHTML = `<kbd>E</kbd> ${esc(t.label)}`; } else pr.hidden = true;
    $('bAct').classList.toggle('ready', !!t);
    if (hudT > 0) return;
    hudT = 0.25;
    const p = g.player, s = p.stats, tm = g.time;
    const L = tm.lighting(), wx = g.weather;
    const icon = wx.rain > 0.3 ? '🌧️' : wx.haze > 0.4 ? '🌫️' : tm.isNight() ? '🌙' : L.tint ? '🌅' : '☀️';
    $('hClock').textContent = icon + ' ' + tm.clock();
    $('hDate').textContent = tm.dateStr() + ' · ' + tm.seasonTh();
    const cp = g.currentProv;
    $('hProv').textContent = cp ? cp.th : 'นอกเขตจังหวัด';
    $('hArea').textContent = (cp ? S77.REGIONS[cp.region].th : '') + (g.areaName ? ' · ' + g.areaName : '');
    $('hMoney').textContent = U.fmtMoney(p.money);
    const setBar = (id, v) => { const e = $(id); e.style.width = v + '%'; e.parentNode.classList.toggle('low', v < 20); };
    setBar('nHunger', s.hunger); setBar('nEnergy', s.energy); setBar('nMood', s.mood); setBar('nHealth', s.health);
    $('hRide').textContent = p.riding ? (p.riding === 'motorbike' ? '🛵' : '🚲') : '';
    if (miniT <= 0) { miniT = 0.2; UI.drawMinimap(g); }
  };
  UI.drawMinimap = (g) => {
    const c = $('minimap'), R = g.renderer;
    if (!c || !R.mapCanvas) return;
    const x = c.getContext('2d'), W = c.width, H = c.height, p = g.player, k = 2.2;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#1f5f9a'; x.fillRect(0, 0, W, H);
    x.imageSmoothingEnabled = false;
    x.setTransform(k, k / 2, -k, k / 2, W / 2 - (p.x - p.y) * k, H / 2 - (p.x + p.y) * (k / 2));
    const r = 40, sx = Math.max(0, Math.floor(p.x - r)), sy = Math.max(0, Math.floor(p.y - r));
    x.drawImage(R.mapCanvas, sx, sy, r * 2, r * 2, sx, sy, r * 2, r * 2);
    // npcs
    x.fillStyle = '#fff';
    for (const n of g.npcs || []) if (!n.hidden) x.fillRect(n.x - 0.5, n.y - 0.5, 1, 1);
    x.setTransform(1, 0, 0, 1, 0, 0);
    // waypoint direction
    const tgt = g.delivery || g.waypoint;
    if (tgt) {
      const dx = tgt.x - p.x, dy = tgt.y - p.y, sx2 = (dx - dy) * k, sy2 = (dx + dy) * (k / 2), d = Math.hypot(sx2, sy2);
      const rr = Math.min(d, W / 2 - 8), ax = W / 2 + (sx2 / (d || 1)) * rr, ay = H / 2 + (sy2 / (d || 1)) * rr * 0.5;
      x.font = '14px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(g.delivery ? '🛵' : '🚩', ax, ay);
    }
    x.fillStyle = '#ff3b6b'; x.strokeStyle = '#fff'; x.lineWidth = 2;
    x.beginPath(); x.arc(W / 2, H / 2, 4, 0, 7); x.fill(); x.stroke();
  };

  /* ---------------- full-res overlay: labels, floaters, guide arrow ---------------- */
  UI.drawOverlay = (ctx, g) => {
    if (!g.player) return;
    const R = g.renderer, dpr = R.dpr, w = g.world, p = g.player;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const label = (text, x, y, size, color, bg) => {
      ctx.font = `bold ${Math.round(size * dpr)}px "Noto Sans Thai","Leelawadee UI","Thonburi",Tahoma,sans-serif`;
      if (bg) { const m = ctx.measureText(text).width; ctx.fillStyle = bg; ctx.fillRect(x - m / 2 - 5 * dpr, y - size * dpr * 1.25, m + 10 * dpr, size * dpr * 1.35); }
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(20,20,30,0.85)'; ctx.strokeText(text, x, y);
      ctx.fillStyle = color || '#fff'; ctx.fillText(text, x, y);
    };
    if (g.settings.labels) {
      const night = g.time.isNight(), cx = Math.floor(p.x / 16), cy = Math.floor(p.y / 16);
      for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
        const list = w.buildingsNearChunk(xx, yy); if (!list) continue;
        for (const b of list) {
          const def = S77.BUILDINGS[b.type];
          if (!def.acts.length || !b.door) continue;
          const d = Math.hypot(b.door.x - p.x, b.door.y - p.y);
          if (d > 7) continue;
          const spr = S77.Sprites.building(b, night);
          const [sx, sy] = R.toScreen(b.x + b.fw / 2, b.y + b.fd / 2, spr.ay - 6 - (b.fw + b.fd) * 4);
          ctx.globalAlpha = U.clamp((7 - d) / 3, 0, 1);
          label((b.type === 'landmark' ? '📍 ' : '') + b.name, sx, sy, 12, b.type === 'landmark' ? '#ffe680' : '#fff', 'rgba(0,0,0,0.35)');
          ctx.globalAlpha = 1;
        }
      }
      for (const n of g.npcs || []) {
        if (n.hidden) continue;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d > 3.5) continue;
        const [sx, sy] = R.toScreen(n.x, n.y, n.look.kind === 'kid' ? 25 : 30);
        ctx.globalAlpha = U.clamp((3.5 - d) / 1.5, 0, 1);
        label(n.name, sx, sy, 11, n.mem && n.mem.f >= 20 ? '#ffd1e0' : '#fff');
        ctx.globalAlpha = 1;
      }
    }
    for (const f of g.floaters) {
      const [sx, sy] = R.toScreen(f.x, f.y, 34 + f.t * 22);
      ctx.globalAlpha = U.clamp(1.6 - f.t, 0, 1);
      label(f.text, sx, sy, 13, f.color);
      ctx.globalAlpha = 1;
    }
    // guide arrow toward waypoint / delivery
    const tgt = g.delivery || g.waypoint;
    if (tgt) {
      const dist = Math.hypot(tgt.x - p.x, tgt.y - p.y);
      if (!g.delivery && dist < 3) { g.waypoint = null; UI.toast('🚩 ถึงจุดหมายแล้ว', 'good'); return; }
      const [px, py] = R.toScreen(p.x, p.y, 16), [tx, ty] = R.toScreen(tgt.x + 0.5, tgt.y + 0.5, 0);
      const a = Math.atan2(ty - py, tx - px), rr = 46 * dpr;
      const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = g.delivery ? '#ff9f1c' : '#ff3b6b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(12 * dpr, 0); ctx.lineTo(-7 * dpr, -8 * dpr); ctx.lineTo(-3 * dpr, 0); ctx.lineTo(-7 * dpr, 8 * dpr); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      label((g.delivery ? '🛵 ' : '🚩 ' + (tgt.label || '') + ' ') + (dist * 0.92 < 1 ? Math.round(dist * 920) + ' ม.' : (dist * 0.92).toFixed(1) + ' กม.'), ax, ay - 12 * dpr, 11, '#fff');
    }
  };

  /* ---------------- title screen & character creation ---------------- */
  UI.title = (g, hasSave, onNew, onContinue) => {
    const t = $('title');
    t.hidden = false;
    const cont = $('tContinue');
    cont.hidden = !hasSave;
    if (hasSave) { const d = S77.Game.readSave('auto'); $('tSaveInfo').textContent = d ? d.player.name + ' · ' + U.fmtMoney(d.player.money) + ' · ' + d.player.visited.length + '/77 จังหวัด' : ''; }
    $('tNew').onclick = () => { S77.Sound.play('click'); onNew(); };
    cont.onclick = () => { S77.Sound.play('click'); onContinue(); };
    $('tHelp').onclick = () => UI.help();
  };
  UI.charCreate = (g, onDone) => {
    $('title').hidden = true;
    const A = S77.APPEAR;
    const look = { skin: 1, hair: 'short', hairC: 0, top: 'tee', topC: 1, bottom: 'pants', bottomC: 7, hat: 'none', hatC: 0 };
    const box = el('div', 'cc');
    const prev = el('div', 'ccp'), form = el('div', 'ccf');
    box.appendChild(prev); box.appendChild(form);
    const pc = document.createElement('canvas'); pc.width = 200; pc.height = 170; prev.appendChild(pc);
    let frame = 0;
    const drawPrev = () => {
      const x = pc.getContext('2d'), spr = S77.Sprites.character(look);
      x.clearRect(0, 0, 200, 170); x.imageSmoothingEnabled = false;
      const f = Math.floor(frame / 8) % 4;
      x.drawImage(spr, f * spr.fw, 0, spr.fw, spr.fh, 10, 4, spr.fw * 5.5, spr.fh * 5.5);
      x.drawImage(spr, (4 + f) * spr.fw, spr.fh, spr.fw, spr.fh, 104, 4, spr.fw * 5.5, spr.fh * 5.5);
    };
    const anim = setInterval(() => { frame++; drawPrev(); }, 60);
    const field = (label, node) => { const r = el('div', 'ccr', `<label>${esc(label)}</label>`); r.appendChild(node); form.appendChild(r); return node; };
    const name = field('ชื่อของคุณ', el('input', 'cin')); name.value = U.pick(['ต้นข้าว', 'ฟ้าใส', 'ภูผา', 'ดาวเหนือ', 'สายน้ำ', 'ลมหนาว']); name.maxLength = 16;
    const choices = (label, list, key, render) => {
      const bx = el('div', 'chips');
      list.forEach((v, i) => { const b = el('button', 'chip' + (look[key] === v ? ' on' : ''), render ? render(v, i) : v); b.onclick = () => { look[key] = v; [...bx.children].forEach((c) => c.classList.toggle('on', c === b)); drawPrev(); }; bx.appendChild(b); });
      field(label, bx);
    };
    const sw = (c) => `<i class="sw big" style="background:${U.css(c)}"></i>`;
    choices('สีผิว', [0, 1, 2, 3], 'skin', (v) => sw(S77.PAL.skinTones[v]));
    choices('ทรงผม', ['short', 'spiky', 'long', 'bob', 'pony', 'bun', 'bald'], 'hair', (v) => ({ short: 'สั้น', spiky: 'ตั้ง', long: 'ยาว', bob: 'บ๊อบ', pony: 'หางม้า', bun: 'มวย', bald: 'โกน' }[v]));
    choices('สีผม', [0, 1, 2, 3, 4, 7, 8], 'hairC', (v) => sw(A.HAIRC[v]));
    choices('เสื้อ', ['tee', 'collar', 'tank', 'dress'], 'top', (v) => ({ tee: 'ยืด', collar: 'เชิ้ต', tank: 'กล้าม', dress: 'ชุดเดรส' }[v]));
    choices('สีเสื้อ', [0, 1, 2, 3, 4, 5, 6, 7, 10, 11], 'topC', (v) => sw(A.CLOTH[v]));
    choices('ท่อนล่าง', ['pants', 'shorts', 'skirt', 'sarong'], 'bottom', (v) => ({ pants: 'กางเกงขายาว', shorts: 'ขาสั้น', skirt: 'กระโปรง', sarong: 'ผ้าถุง/โสร่ง' }[v]));
    choices('สีท่อนล่าง', [7, 8, 9, 13, 6, 0], 'bottomC', (v) => sw(A.CLOTH[v]));
    choices('หมวก', ['none', 'cap', 'ngob', 'sunhat', 'hijab', 'kopiah'], 'hat', (v) => ({ none: 'ไม่ใส่', cap: 'แก๊ป', ngob: 'งอบ', sunhat: 'ปีกกว้าง', hijab: 'ฮิญาบ', kopiah: 'กะปิเยาะ' }[v]));
    const sel = el('select', 'cin');
    for (const rk of Object.keys(S77.REGIONS)) {
      const og = document.createElement('optgroup'); og.label = S77.REGIONS[rk].th;
      for (const p of S77.PROVINCES.filter((q) => q.region === rk)) { const o = document.createElement('option'); o.value = p.idx; o.textContent = p.th; og.appendChild(o); }
      sel.appendChild(og);
    }
    sel.value = S77.PROV_BY_KEY[U.pick(['chiangmai', 'khonkaen', 'bangkok', 'phuket', 'ayutthaya', 'nakhonphanom', 'songkhla', 'kanchanaburi'])].idx;
    field('บ้านเกิด (จุดเริ่มต้น)', sel);
    const hint = el('div', 'note', '');
    form.appendChild(hint);
    const upd = () => { const p = S77.PROVINCES[+sel.value]; hint.textContent = '📍 ' + p.th + ' — "' + p.tagline + '" · ของดี: ' + p.good; };
    sel.onchange = upd; upd();
    const go = el('button', 'btn big', '▶ เริ่มใช้ชีวิต');
    let started = false;
    go.onclick = () => { started = true; clearInterval(anim); UI.close(); onDone({ name: name.value.trim() || 'ผู้เล่น', look: Object.assign({}, look), home: +sel.value }); };
    form.appendChild(go);
    drawPrev();
    UI.open('สร้างตัวละคร', box, { icon: '🧑', wide: true, cls: 'ccwin', onClose: () => { clearInterval(anim); if (!started) $('title').hidden = false; } });
  };
})();
