/* =============================================================
   ui.js — หน้าจอ เมนู โมดัล และการเชื่อมทุกระบบเข้าด้วยกัน
   ============================================================= */
'use strict';

const UI = {
  tab: 'home',
  titleRaf: 0,

  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  $(id) { return document.getElementById(id); },

  /* กันดับเบิลคลิกซื้อ/เซ็นซ้ำโดยไม่ตั้งใจ */
  guardClick() {
    const now = Date.now();
    if (this._busyUntil && now < this._busyUntil) return false;
    this._busyUntil = now + 350;
    return true;
  },

  /* ================= เริ่มต้น ================= */

  init() {
    /* หน้าไตเติล */
    this.$('btnContinue').hidden = !Game.hasSave();
    this.$('btnNewGame').addEventListener('click', () => { Sound.open(); this.askNewGame(); });
    this.$('btnContinue').addEventListener('click', () => {
      Sound.open();
      if (Game.load()) this.showGame();
      else { this.toast('เซฟเสียหาย เริ่มเกมใหม่นะ'); this.askNewGame(); }
    });
    this.startTitleAnim();

    /* แท็บ */
    document.querySelectorAll('#tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.click();
        this.tab = btn.dataset.tab;
        document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('on', b === btn));
        this.renderTab();
      });
    });
  },

  startTitleAnim() {
    const cv = this.$('titleCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let f = 0;
    const loop = () => {
      f++;
      Sprites.drawTitle(ctx, f);
      this.titleRaf = requestAnimationFrame(loop);
    };
    loop();
  },

  askNewGame() {
    this.modal(`
      <h3>🏐 ก่อตั้งสโมสรใหม่</h3>
      <p>ตั้งชื่อสโมสรวอลเลย์บอลของคุณ</p>
      <input id="clubNameInput" class="txt" maxlength="18" value="วอลเลย์คลับ" autocomplete="off">
      <p class="hint">เริ่มจากทีมเล็กๆ ในชุมชน ฝึกซ้อม เก็บแชมป์ แล้วก้าวสู่เวทีโลก!</p>
      <div class="modal-btns">
        <button class="btn alt" data-act="go">เริ่มต้นตำนาน!</button>
        <button class="btn ghost" data-act="close">ยกเลิก</button>
      </div>
    `, box => {
      const input = box.querySelector('#clubNameInput');
      input.focus(); input.select();
      box.querySelector('[data-act=go]').addEventListener('click', () => {
        const name = input.value.trim() || 'วอลเลย์คลับ';
        Game.newGame(name);
        this.closeModal();
        this.showGame();
        Sound.whistle();
      });
    });
  },

  showGame() {
    cancelAnimationFrame(this.titleRaf);
    this.$('titleScreen').hidden = true;
    this.$('gameRoot').hidden = false;
    this.tab = 'home';
    document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === 'home'));
    this.renderAll();
    /* มีทัวร์นาเมนต์ค้างจากเซสชันก่อน (ปิดหน้ากลางแข่ง) → ชวนแข่งต่อทันที */
    if (Game.state.tour) this.promptResumeTournament();
  },

  backToTitle() {
    this.$('gameRoot').hidden = true;
    this.$('titleScreen').hidden = false;
    this.$('btnContinue').hidden = !Game.hasSave();
    this.startTitleAnim();
  },

  /* ================= เรนเดอร์หลัก ================= */

  renderAll() { this.renderTop(); this.renderTab(); },

  renderTop() {
    const s = Game.state;
    this.$('tbClub').textContent = '🏐 ' + s.club;
    this.$('tbDate').textContent = `📅 ปี ${s.year} ด.${s.month} สป.${s.week}`;
    this.$('tbMoney').textContent = '💰 ' + Game.fmtMoney(s.money);
    this.$('tbFans').textContent = '💛 ' + Game.fmtNum(s.fans);
  },

  renderTab() {
    const map = { home: 'renderHome', team: 'renderTeam', club: 'renderClub', honor: 'renderHonor', system: 'renderSystem' };
    this[map[this.tab] || 'renderHome']();
  },

  bar(val, max, cls = '') {
    const pct = Math.max(0, Math.min(100, (val / max) * 100));
    return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
  },

  /* ---------- หน้าหลัก ---------- */
  renderHome() {
    const s = Game.state;
    const mt = Game.monthTournament();
    const nt = Game.nextTournament();
    const cands = s.pendingCandidates;
    const avgCond = Math.round(s.players.reduce((a, p) => a + p.cond, 0) / s.players.length);

    let tourBanner = '';
    if (s.tour) {
      const ti = Game.tourInfo();
      tourBanner = `
        <div class="banner hot">
          <div>${ti.t.icon} <b>ศึก "${this.esc(ti.t.name)}" ยังไม่จบ!</b><br>
          <small>ค้างอยู่ที่${ti.roundName} — ลุยต่อเลย</small></div>
          <button class="btn alt" id="btnResumeTour">🏐 แข่งต่อ</button>
        </div>`;
    } else if (mt) {
      tourBanner = `
        <div class="banner hot">
          <div>${mt.icon} <b>เดือนนี้มีศึก "${this.esc(mt.name)}"!</b><br>
          <small>รางวัลชนะเลิศ ${Game.fmtMoney(mt.reward)} · แฟนคลับ +${Game.fmtNum(mt.fans)}</small></div>
          <button class="btn alt" id="btnEnterTour">🔥 เข้าร่วม</button>
        </div>`;
    } else if (nt) {
      tourBanner = `
        <div class="banner">
          <div>${nt.t.icon} ศึกถัดไป: <b>${this.esc(nt.t.name)}</b><br>
          <small>อีก ${nt.off} เดือน (เดือน ${nt.t.month})</small></div>
        </div>`;
    }

    this.$('screen').innerHTML = `
      ${tourBanner}
      <div class="panel">
        <div class="row3">
          <div class="stat-tile"><small>พลังทีม</small><b>${Game.teamPower()}</b></div>
          <div class="stat-tile"><small>ความเข้าขา</small><b>${s.chem}</b>${this.bar(s.chem, 100, 'chem')}</div>
          <div class="stat-tile"><small>กำลังใจ</small><b>${s.morale}</b>${this.bar(s.morale, 100, 'mor')}</div>
        </div>
        <div class="row3">
          <div class="stat-tile"><small>ความสดชื่นเฉลี่ย</small><b>${avgCond}%</b>${this.bar(avgCond, 100, avgCond < 35 ? 'bad' : '')}</div>
          <div class="stat-tile"><small>สถิติ ชนะ-แพ้</small><b>${s.record.w}-${s.record.l}</b></div>
          <div class="stat-tile"><small>รายรับ/สัปดาห์</small><b>${Game.fmtMoney(Game.sponsorIncome() + Game.shopIncome() - Game.totalSalary())}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>📆 สัปดาห์นี้ทำอะไรดี?</h3>
        <div class="actions">
          <button class="action-card" data-act="train">🏐<b>ฝึกซ้อม</b><small>เพิ่มสเตตัสทีม</small></button>
          <button class="action-card" data-act="rest">😴<b>พักผ่อน</b><small>ฟื้นความสดชื่น</small></button>
          <button class="action-card" data-act="practice">🤝<b>นัดอุ่นเครื่อง</b><small>หาประสบการณ์</small></button>
          <button class="action-card" data-act="scout">🕵️<b>แมวมอง</b><small>${Game.fmtMoney(Game.scoutCost())} · หานักกีฬา${s.scoutDiscount ? ' <em>ลดราคา!</em>' : ''}</small></button>
        </div>
        ${cands ? `<button class="btn wide" id="btnViewCands">📋 ดูนักกีฬาที่แมวมองพบ (${cands.length})</button>` : ''}
      </div>

      <div class="panel">
        <h3>📜 ข่าวสโมสร</h3>
        <ul class="log">${s.log.slice(0, 12).map(l => `<li>${this.esc(l)}</li>`).join('')}</ul>
      </div>
    `;

    const sc = this.$('screen');
    sc.querySelector('[data-act=train]').addEventListener('click', () => this.openTrainingMenu());
    sc.querySelector('[data-act=rest]').addEventListener('click', () => this.doRest());
    sc.querySelector('[data-act=practice]').addEventListener('click', () => this.openPractice());
    sc.querySelector('[data-act=scout]').addEventListener('click', () => this.doScout());
    const bt = sc.querySelector('#btnEnterTour');
    if (bt) bt.addEventListener('click', () => this.confirmTournament(mt));
    const br = sc.querySelector('#btnResumeTour');
    if (br) br.addEventListener('click', () => { Sound.open(); this.tournamentLoop(); });
    const bc = sc.querySelector('#btnViewCands');
    if (bc) bc.addEventListener('click', () => this.showCandidates());
  },

  promptResumeTournament() {
    const ti = Game.tourInfo();
    if (!ti) { Game.state.tour = null; Game.save(); return; }
    this.modal(`
      <h3>${ti.t.icon} ศึกยังไม่จบ!</h3>
      <p>"${this.esc(ti.t.name)}" ค้างอยู่ที่<b>${ti.roundName}</b><br>คู่แข่ง: <b>${this.esc(ti.opponent.name)}</b> (พลัง ${ti.opponent.power})</p>
      <div class="modal-btns">
        <button class="btn alt" data-act="resume">🏐 แข่งต่อเลย!</button>
        <button class="btn ghost" data-act="close">เดี๋ยวก่อน (แข่งต่อได้จากหน้าหลัก)</button>
      </div>
    `, box => {
      box.querySelector('[data-act=resume]').addEventListener('click', () => {
        Sound.open();
        this.closeModal();
        this.tournamentLoop();
      });
    });
  },

  /* ---------- ฝึกซ้อม ---------- */
  openTrainingMenu() {
    Sound.open();
    const s = Game.state;
    const rows = DATA.trainings.map((t, i) => {
      const fac = DATA.facilities.find(f => f.id === t.fac);
      const lvl = Game.facilityLevel(t.fac);
      const afford = s.money >= t.cost;
      return `
        <button class="list-row ${afford ? '' : 'off'}" data-tid="${t.id}" ${afford ? '' : 'disabled'}>
          <span class="lr-icon">${t.icon}</span>
          <span class="lr-main"><b>${t.name}</b><small>${t.desc}${lvl ? ` · ${fac.icon} โบนัส +${lvl * 25}%` : ''}</small></span>
          <span class="lr-side">${Game.fmtMoney(t.cost)}</span>
        </button>`;
    }).join('');
    this.modal(`
      <h3>🏐 เลือกเมนูฝึกซ้อม</h3>
      <div class="list">${rows}</div>
      <div class="modal-btns"><button class="btn ghost" data-act="close">ยกเลิก</button></div>
    `, box => {
      box.querySelectorAll('[data-tid]').forEach(b => b.addEventListener('click', () => {
        this.closeModal();
        this.doTraining(b.dataset.tid);
      }));
    });
  },

  doTraining(tid) {
    const res = Game.actTraining(tid);
    if (!res) { this.toast('เงินไม่พอ!'); Sound.error(); return; }
    Sound.train();
    const t = res.training;
    const statList = Object.keys(t.stats).map(k => `${DATA.statIcons[k]} ${DATA.statNames[k]}`).join(' · ');
    const rows = res.results.map(r => {
      const gainTxt = Object.entries(r.gains).filter(([, v]) => v > 0).map(([k, v]) => `${DATA.statNames[k]}+${v}`).join(' ');
      const lvTxt = r.lvls.length ? ` <em class="lvup">LV UP! → ${r.p.lv}</em>` : '';
      return `<li><b>${this.esc(r.p.name)}</b> ${gainTxt || '—'}${r.tired ? ' <em class="warn">(เหนื่อยล้า ผลลด)</em>' : ''}${lvTxt}</li>`;
    }).join('');
    if (res.results.some(r => r.lvls.length)) Sound.levelup();
    this.resultModal(`${t.icon} ${t.name}สำเร็จ!`, `
      <p class="hint">${statList}${t.chem ? ' · ความเข้าขา +' + t.chem : ''}</p>
      <ul class="result-list">${rows}</ul>
    `, res.weekly);
  },

  doRest() {
    const res = Game.actRest();
    Sound.open();
    this.resultModal('😴 พักผ่อนทั้งทีม', `
      <p>ทุกคนได้พักเต็มที่ ความสดชื่น <b>+${res.condUp}</b> · กำลังใจ <b>+${res.morUp}</b></p>
    `, res.weekly);
  },

  /* ---------- แมวมอง ---------- */
  doScout() {
    const res = Game.actScout();
    if (!res) { this.toast('เงินไม่พอ!'); Sound.error(); return; }
    Sound.cash();
    this.renderAll();
    this.showCandidates(res.weekly);
  },

  showCandidates(weekly) {
    const s = Game.state;
    const cands = s.pendingCandidates;
    if (!cands || !cands.length) { this.toast('ไม่มีนักกีฬาให้ดู'); return; }
    const full = s.players.length >= 10;
    const rows = cands.map((c, i) => {
      const pow = Game.playerPower(c);
      const stars = '★'.repeat(c.pot) + '☆'.repeat(5 - c.pot);
      const afford = s.money >= c.fee;
      return `
        <div class="cand">
          <div class="cand-head">
            <b>${this.esc(c.name)}</b>
            <span class="pos-badge" style="background:${DATA.positions[c.pos].color}">${DATA.positions[c.pos].name}</span>
          </div>
          <div class="cand-body">
            <span>พลัง <b>${pow}</b></span>
            <span class="stars">${stars}</span>
            <span>${Game.fmtMoney(c.fee)}</span>
          </div>
          <button class="btn small alt" data-sign="${i}" ${(!afford || full) ? 'disabled' : ''}>
            ${full ? 'ทีมเต็ม' : afford ? '✍️ เซ็นสัญญา' : 'เงินไม่พอ'}
          </button>
        </div>`;
    }).join('');
    this.modal(`
      <h3>🕵️ นักกีฬาที่แมวมองพบ</h3>
      ${weekly ? this.weeklyHtml(weekly) : ''}
      <div class="cands">${rows}</div>
      <p class="hint">ผู้เล่นในทีม ${s.players.length}/10 · เงิน ${Game.fmtMoney(s.money)}</p>
      <div class="modal-btns">
        <button class="btn ghost" data-act="dismiss">ไม่เซ็นใคร ปิดรายชื่อ</button>
        <button class="btn" data-act="close">เก็บไว้ดูก่อน</button>
      </div>
    `, box => {
      box.querySelectorAll('[data-sign]').forEach(b => b.addEventListener('click', () => {
        if (!this.guardClick()) return;
        const r = Game.signCandidate(+b.dataset.sign);
        if (r.ok) { Sound.cash(); this.toast(`เซ็น "${r.p.name}" เข้าทีมแล้ว!`); this.closeModal(); this.renderAll(); if (Game.state.pendingCandidates) this.showCandidates(); }
        else { Sound.error(); this.toast(r.why); }
      }));
      box.querySelector('[data-act=dismiss]').addEventListener('click', () => {
        Game.dismissCandidates(); this.closeModal(); this.renderAll();
      });
    });
  },

  /* ---------- นัดอุ่นเครื่อง ---------- */
  openPractice() {
    Sound.open();
    const rival = Game.buildPracticeRival();
    const tp = Game.teamPower();
    const diff = rival.power - tp;
    const hint = diff > 4 ? '⚠️ คู่แข่งดูแข็งแกร่งกว่าเรา' : diff < -4 ? '✅ เราดูเป็นต่อ' : '⚖️ สูสีน่าดู';
    this.modal(`
      <h3>🤝 นัดอุ่นเครื่อง</h3>
      <div class="vs">
        <div><b>${this.esc(Game.state.club)}</b><small>พลัง ${tp}</small></div>
        <em>VS</em>
        <div><b>${this.esc(rival.name)}</b><small>พลัง ${rival.power}</small></div>
      </div>
      <p class="hint">${hint} · ผู้ชนะได้เงินรางวัล ประสบการณ์ และแฟนคลับ</p>
      <div class="modal-btns">
        <button class="btn alt" data-act="go">🏐 เริ่มแข่ง!</button>
        <button class="btn ghost" data-act="close">ไว้ก่อน</button>
      </div>
    `, box => {
      box.querySelector('[data-act=go]').addEventListener('click', () => {
        this.closeModal();
        this.runPractice(rival);
      });
    });
  },

  async runPractice(rival) {
    const result = await Match.play({
      home: Game.homeTeam(), away: rival,
      pointsTo: 15, label: 'นัดอุ่นเครื่อง',
    });
    const summary = Game.afterMatch(result, { kind: 'practice', opponent: rival });
    const weekly = Game.advanceWeek();
    this.matchSummaryModal(result, summary, rival, weekly);
    this.renderAll();
  },

  /* ---------- ทัวร์นาเมนต์ ---------- */
  confirmTournament(t) {
    Sound.open();
    const tp = Game.teamPower();
    const [lo, hi] = Game.tourPowerRange(t);
    this.modal(`
      <h3>${t.icon} ${this.esc(t.name)}</h3>
      <p>ทัวร์นาเมนต์ ${t.teams} ทีม แพ้คัดออก · แข่ง ${Math.log2(t.teams)} รอบรวด</p>
      <p class="hint">ระดับคู่แข่งราวๆ ${lo}–${hi} · พลังทีมเรา ${tp}</p>
      <p class="hint">🏆 ชนะเลิศ: ${Game.fmtMoney(t.reward)} + แฟนคลับ ${Game.fmtNum(t.fans)}</p>
      <div class="modal-btns">
        <button class="btn alt" data-act="go">🔥 ลงแข่ง!</button>
        <button class="btn ghost" data-act="close">ยังก่อน</button>
      </div>
    `, box => {
      box.querySelector('[data-act=go]').addEventListener('click', () => {
        this.closeModal();
        this.runTournament(t.id);
      });
    });
  },

  async runTournament(tid) {
    Game.startTournament(tid);
    return this.tournamentLoop();
  },

  /* ลูปแข่งตาม state.tour ปัจจุบัน — ใช้ทั้งตอนเข้าใหม่และตอนกลับมาแข่งต่อ */
  async tournamentLoop() {
    this.renderAll();
    let info = Game.tourInfo();
    while (info) {
      await this.modalWait(`
        <h3>${info.t.icon} ${this.esc(info.t.name)}</h3>
        <p class="round-name">— ${info.roundName} —</p>
        <div class="vs">
          <div><b>${this.esc(Game.state.club)}</b><small>พลัง ${Game.teamPower()}</small></div>
          <em>VS</em>
          <div><b>${this.esc(info.opponent.name)}</b><small>พลัง ${info.opponent.power}</small></div>
        </div>
      `, [{ id: 'go', label: '🏐 เริ่มแมตช์!', cls: 'btn alt' }]);

      const roundName = info.roundName;
      const opponent = info.opponent;
      const result = await Match.play({
        home: Game.homeTeam(), away: opponent,
        pointsTo: info.t.pointsTo, label: `${info.t.name} · ${roundName}`,
      });
      const summary = Game.afterMatch(result, { kind: 'tour', opponent, roundName });
      const outcome = Game.tourMatchDone(result.win);
      this.renderTop();

      if (outcome.status === 'next') {
        await this.modalWait(`
          <h3>✅ ผ่านเข้ารอบ!</h3>
          <p>ชนะ ${this.esc(opponent.name)} <b>${result.homeScore}-${result.awayScore}</b></p>
          ${this.expHtml(summary)}
        `, [{ id: 'ok', label: 'ไปรอบต่อไป ➜', cls: 'btn alt' }]);
        info = Game.tourInfo();
      } else if (outcome.status === 'champion') {
        Sound.trophy();
        await this.modalWait(`
          <h3>🏆 ชนะเลิศ ${this.esc(outcome.t.name)}!</h3>
          <p class="trophy-big">${outcome.t.icon}</p>
          <p>สุดยอด! "${this.esc(Game.state.club)}" คว้าแชมป์มาครอง!</p>
          <p class="hint">+${Game.fmtMoney(outcome.t.reward)} · แฟนคลับ +${Game.fmtNum(outcome.t.fans)}</p>
          ${this.expHtml(summary)}
          ${this.weeklyHtml(outcome.weekly)}
        `, [{ id: 'ok', label: '🎉 เย้!', cls: 'btn alt' }]);
        if (outcome.t.id === 'world') this.worldChampionModal();
        info = null;
      } else {
        await this.modalWait(`
          <h3>😢 ตกรอบ...</h3>
          <p>แพ้ ${this.esc(opponent.name)} <b>${result.homeScore}-${result.awayScore}</b> (${roundName})</p>
          <p class="hint">เงินปลอบใจ ${Game.fmtMoney(outcome.consolation)} · เก็บประสบการณ์ไว้ปีหน้า!</p>
          ${this.expHtml(summary)}
          ${this.weeklyHtml(outcome.weekly)}
        `, [{ id: 'ok', label: 'สู้ต่อไป!', cls: 'btn' }]);
        info = null;
      }
    }
    this.renderAll();
  },

  worldChampionModal() {
    this.modal(`
      <h3>🌏 แชมป์โลก!!</h3>
      <p class="trophy-big">🏆🎊🏐</p>
      <p><b>"${this.esc(Game.state.club)}"</b> ก้าวขึ้นเป็นสโมสรวอลเลย์บอล<br><b>อันดับ 1 ของโลก</b> อย่างเป็นทางการ!</p>
      <p class="hint">จากทีมเล็กๆ ในชุมชน สู่จุดสูงสุดของวงการ...<br>ขอบคุณที่พาทีมมาถึงฝัน! (เล่นต่อได้เรื่อยๆ นะ)</p>
      <div class="modal-btns"><button class="btn alt" data-act="close">ภูมิใจสุดๆ!</button></div>
    `);
  },

  /* ---------- สรุปผลแมตช์/สัปดาห์ ---------- */
  expHtml(summary) {
    if (!summary || !summary.exp) return '';
    const rows = summary.exp.map(e => {
      const lv = e.ups.length ? ` <em class="lvup">LV ${e.p.lv}!</em>` : '';
      return `<li>${e.isMvp ? '⭐' : ''}<b>${this.esc(e.p.name)}</b> +${e.exp} EXP${lv}</li>`;
    }).join('');
    if (summary.exp.some(e => e.ups.length)) Sound.levelup();
    return `<ul class="result-list">${rows}</ul>`;
  },

  weeklyHtml(weekly) {
    if (!weekly) return '';
    return `<div class="weekly"><h4>📆 ระหว่างสัปดาห์</h4><ul>${weekly.msgs.map(m => `<li>${this.esc(m)}</li>`).join('')}</ul></div>`;
  },

  matchSummaryModal(result, summary, rival, weekly) {
    this.modal(`
      <h3>${result.win ? '🎉 ชนะ!' : '😢 แพ้...'} ${result.homeScore} - ${result.awayScore}</h3>
      <p>${result.win ? 'เอาชนะ' : 'พ่ายให้'} <b>${this.esc(rival.name)}</b></p>
      ${result.mvpName ? `<p class="hint">⭐ MVP: <b>${this.esc(result.mvpName)}</b> ทำ ${result.mvpPts} แต้ม</p>` : ''}
      ${summary.money ? `<p class="hint">รางวัล ${Game.fmtMoney(summary.money)} · แฟนคลับ +${Game.fmtNum(summary.fans)}</p>` : ''}
      ${this.expHtml(summary)}
      ${this.weeklyHtml(weekly)}
      <div class="modal-btns"><button class="btn" data-act="close">ตกลง</button></div>
    `);
  },

  resultModal(title, bodyHtml, weekly) {
    this.modal(`
      <h3>${title}</h3>
      ${bodyHtml}
      ${this.weeklyHtml(weekly)}
      <div class="modal-btns"><button class="btn" data-act="close">ตกลง</button></div>
    `);
    this.renderAll();
  },

  /* ---------- หน้าทีม ---------- */
  renderTeam() {
    const starters = Game.starters();
    const bench = Game.bench();
    const card = (p, isStarter) => {
      const pow = Game.playerPower(p);
      const pos = DATA.positions[p.pos];
      return `
        <button class="pcard" data-pid="${p.id}">
          <canvas class="face" width="20" height="22" data-face="${p.id}"></canvas>
          <span class="pc-name"><b>${this.esc(p.name)}</b><span class="pos-badge" style="background:${pos.color}">${pos.short}</span></span>
          <span class="pc-info">LV${p.lv} · พลัง ${pow}</span>
          ${this.bar(p.cond, 100, p.cond < 35 ? 'bad' : 'cond')}
          ${isStarter ? '' : '<span class="sub-tag">สำรอง</span>'}
        </button>`;
    };
    this.$('screen').innerHTML = `
      <div class="panel">
        <h3>🏐 ตัวจริง (6 คน)</h3>
        <div class="pgrid">${starters.map(p => card(p, true)).join('')}</div>
      </div>
      <div class="panel">
        <h3>🪑 ตัวสำรอง (${bench.length})</h3>
        ${bench.length ? `<div class="pgrid">${bench.map(p => card(p, false)).join('')}</div>` : '<p class="hint">ยังไม่มีตัวสำรอง — ใช้แมวมองหานักกีฬาเพิ่มได้</p>'}
      </div>
      <p class="hint center">แตะที่นักกีฬาเพื่อดูรายละเอียด / เปลี่ยนตัวจริง</p>
    `;
    this.$('screen').querySelectorAll('[data-pid]').forEach(b =>
      b.addEventListener('click', () => this.playerModal(+b.dataset.pid)));
    this.$('screen').querySelectorAll('[data-face]').forEach(cv => {
      const p = Game.playerById(+cv.dataset.face);
      if (p) Sprites.drawFace(cv.getContext('2d'), p.skin, p.hair, '#e8862e');
    });
  },

  playerModal(pid) {
    const p = Game.playerById(pid);
    if (!p) return;
    Sound.open();
    const isStarter = Game.state.starterIds.includes(pid);
    const pos = DATA.positions[p.pos];
    const statRow = k => `
      <div class="stat-row">
        <span>${DATA.statIcons[k]} ${DATA.statNames[k]}</span>
        ${this.bar(p.stats[k], 99)}
        <b>${p.stats[k]}</b>
      </div>`;
    const need = Game.expNeed(p.lv);
    this.modal(`
      <div class="pm-head">
        <canvas class="face big" width="20" height="22" id="pmFace"></canvas>
        <div>
          <h3>${this.esc(p.name)} <span class="pos-badge" style="background:${pos.color}">${pos.name}</span></h3>
          <p class="hint">LV${p.lv} · พรสวรรค์ ${'★'.repeat(p.pot)}${'☆'.repeat(5 - p.pot)} · ค่าเหนื่อย ${Game.fmtMoney(Game.salaryOf(p))}/สป.</p>
        </div>
      </div>
      ${['srv', 'atk', 'blk', 'rcv', 'set', 'sta'].map(statRow).join('')}
      <div class="stat-row"><span>💚 สดชื่น</span>${this.bar(p.cond, 100, p.cond < 35 ? 'bad' : 'cond')}<b>${p.cond}</b></div>
      <div class="stat-row"><span>📈 EXP</span>${this.bar(p.exp, need)}<b>${p.exp}/${need}</b></div>
      <div class="modal-btns">
        <button class="btn" data-act="swap">${isStarter ? '🔄 สลับกับตัวสำรอง' : '⬆️ ดันขึ้นตัวจริง'}</button>
        <button class="btn ghost" data-act="release">👋 ปล่อยตัว</button>
        <button class="btn ghost" data-act="close">ปิด</button>
      </div>
    `, box => {
      const cv = box.querySelector('#pmFace');
      Sprites.drawFace(cv.getContext('2d'), p.skin, p.hair, '#e8862e');
      box.querySelector('[data-act=swap]').addEventListener('click', () => {
        this.closeModal(); this.swapFlow(p, isStarter);
      });
      box.querySelector('[data-act=release]').addEventListener('click', () => {
        this.closeModal();
        this.confirm(`ปล่อยตัว "${this.esc(p.name)}" ออกจากทีม?`, () => {
          const r = Game.releasePlayer(pid);
          if (r.ok) { this.toast(`"${p.name}" ออกจากทีมแล้ว`); this.renderAll(); }
          else { Sound.error(); this.toast(r.why); }
        });
      });
    });
  },

  swapFlow(p, isStarter) {
    const others = isStarter ? Game.bench() : Game.starters();
    if (!others.length) { Sound.error(); this.toast('ไม่มีตัวสำรองให้สลับ — หานักกีฬาเพิ่มก่อน'); return; }
    const rows = others.map(o => `
      <button class="list-row" data-oid="${o.id}">
        <span class="lr-icon"><span class="pos-badge" style="background:${DATA.positions[o.pos].color}">${DATA.positions[o.pos].short}</span></span>
        <span class="lr-main"><b>${this.esc(o.name)}</b><small>LV${o.lv} · พลัง ${Game.playerPower(o)} · สดชื่น ${o.cond}%</small></span>
      </button>`).join('');
    this.modal(`
      <h3>🔄 ${isStarter ? `เลือกตัวสำรองมาแทน "${this.esc(p.name)}"` : `"${this.esc(p.name)}" จะแทนใครในตัวจริง?`}</h3>
      <div class="list">${rows}</div>
      <div class="modal-btns"><button class="btn ghost" data-act="close">ยกเลิก</button></div>
    `, box => {
      box.querySelectorAll('[data-oid]').forEach(b => b.addEventListener('click', () => {
        const oid = +b.dataset.oid;
        const ok = isStarter ? Game.swapStarter(p.id, oid) : Game.swapStarter(oid, p.id);
        this.closeModal();
        if (ok) { Sound.click(); this.toast('สลับตัวเรียบร้อย'); this.renderAll(); }
        else { Sound.error(); this.toast('สลับไม่สำเร็จ'); }
      }));
    });
  },

  /* ---------- หน้าสโมสร ---------- */
  renderClub() {
    const s = Game.state;
    const facRows = DATA.facilities.map(f => {
      const lvl = Game.facilityLevel(f.id);
      const max = lvl >= f.costs.length;
      const cost = max ? null : f.costs[lvl];
      const pips = Array.from({ length: f.costs.length }, (_, i) => `<i class="pip ${i < lvl ? 'on' : ''}"></i>`).join('');
      return `
        <div class="fac">
          <span class="lr-icon">${f.icon}</span>
          <span class="lr-main"><b>${f.name}</b> <span class="pips">${pips}</span><small>${f.desc}</small></span>
          <button class="btn small ${max ? 'ghost' : 'alt'}" data-fid="${f.id}" ${max || s.money < cost ? 'disabled' : ''}>
            ${max ? 'สูงสุด' : Game.fmtMoney(cost)}
          </button>
        </div>`;
    }).join('');
    const spRows = DATA.sponsors.map(sp => {
      const on = s.fans >= sp.fans;
      return `
        <div class="fac ${on ? '' : 'locked'}">
          <span class="lr-icon">${sp.icon}</span>
          <span class="lr-main"><b>${sp.name}</b><small>${on ? `สนับสนุน ${Game.fmtMoney(sp.weekly)}/สัปดาห์` : `ปลดล็อกเมื่อแฟนคลับถึง ${Game.fmtNum(sp.fans)}`}</small></span>
          <span class="lr-side">${on ? '✅' : '🔒'}</span>
        </div>`;
    }).join('');
    this.$('screen').innerHTML = `
      <div class="panel">
        <h3>💰 การเงินรายสัปดาห์</h3>
        <div class="row3">
          <div class="stat-tile"><small>สปอนเซอร์</small><b>+${Game.fmtMoney(Game.sponsorIncome())}</b></div>
          <div class="stat-tile"><small>ร้านของที่ระลึก</small><b>+${Game.fmtMoney(Game.shopIncome())}</b></div>
          <div class="stat-tile"><small>ค่าเหนื่อยนักกีฬา</small><b>−${Game.fmtMoney(Game.totalSalary())}</b></div>
        </div>
      </div>
      <div class="panel"><h3>🏗️ สิ่งอำนวยความสะดวก</h3>${facRows}</div>
      <div class="panel"><h3>🤝 สปอนเซอร์ (แฟนคลับ ${Game.fmtNum(s.fans)})</h3>${spRows}</div>
    `;
    this.$('screen').querySelectorAll('[data-fid]').forEach(b => b.addEventListener('click', () => {
      if (!this.guardClick()) return;
      const r = Game.upgradeFacility(b.dataset.fid);
      if (r.ok) { Sound.cash(); this.toast(`อัปเกรดเป็นระดับ ${r.lvl} แล้ว!`); this.renderAll(); }
      else { Sound.error(); this.toast(r.why); }
    }));
  },

  /* ---------- หน้าเกียรติยศ ---------- */
  renderHonor() {
    const s = Game.state;
    const rows = DATA.tournaments.map(t => {
      const wins = s.trophies.filter(x => x.tid === t.id);
      const best = s.bestFinish[t.id];
      const locked = !Game.tournamentUnlocked(t);
      return `
        <div class="fac ${locked ? 'locked' : ''}">
          <span class="lr-icon">${t.icon}</span>
          <span class="lr-main"><b>${t.name}</b><small>
            ${locked ? `ปลดล็อกโดยคว้าแชมป์รายการก่อนหน้า` :
              (wins.length ? `แชมป์ ${wins.length} สมัย (${wins.map(w => 'ปี' + w.year).join(', ')})` :
                best ? `ผลงานดีสุด: ${best}` : 'ยังไม่เคยเข้าร่วม')}
          </small></span>
          <span class="lr-side">${wins.length ? '🏆'.repeat(Math.min(3, wins.length)) : ''}</span>
        </div>`;
    }).join('');
    this.$('screen').innerHTML = `
      ${s.worldChampion ? '<div class="banner hot"><div>🌏 <b>สโมสรแชมป์โลก!</b><br><small>ตำนานที่ยังเขียนต่อได้เรื่อยๆ</small></div></div>' : ''}
      <div class="panel">
        <h3>📊 สถิติสโมสร</h3>
        <div class="row3">
          <div class="stat-tile"><small>ชนะ</small><b>${s.record.w}</b></div>
          <div class="stat-tile"><small>แพ้</small><b>${s.record.l}</b></div>
          <div class="stat-tile"><small>ถ้วยแชมป์</small><b>${s.trophies.length}</b></div>
        </div>
      </div>
      <div class="panel"><h3>🏆 ทำเนียบทัวร์นาเมนต์</h3>${rows}</div>
    `;
  },

  /* ---------- หน้าระบบ ---------- */
  renderSystem() {
    this.$('screen').innerHTML = `
      <div class="panel">
        <h3>💾 บันทึกเกม</h3>
        <p class="hint">${Store.persistent ? 'เซฟอัตโนมัติทุกสัปดาห์ลงเบราว์เซอร์นี้' : '⚠️ เบราว์เซอร์บล็อกการเซฟถาวร — ความคืบหน้าจะหายเมื่อปิดหน้า'}</p>
        <div class="modal-btns">
          <button class="btn" id="btnSaveNow">💾 เซฟตอนนี้</button>
          <button class="btn ghost" id="btnHelp">📖 วิธีเล่น</button>
        </div>
      </div>
      <div class="panel">
        <h3>🔊 เสียง</h3>
        <button class="btn" id="btnMute">${Sound.muted ? '🔇 เปิดเสียง' : '🔊 ปิดเสียง'}</button>
      </div>
      <div class="panel">
        <h3>⚠️ เริ่มใหม่</h3>
        <p class="hint">ลบเซฟและเริ่มก่อตั้งสโมสรใหม่ตั้งแต่ต้น</p>
        <button class="btn ghost" id="btnReset">🗑️ ลบเซฟ & เริ่มใหม่</button>
      </div>
      <p class="hint center">วอลเลย์คลับ สตอรี่ · เกมจำลองบริหารสโมสรวอลเลย์บอล<br>สร้างด้วย HTML/CSS/JS ล้วนๆ เล่นออฟไลน์ได้ 100%</p>
    `;
    this.$('btnSaveNow').addEventListener('click', () => { Game.save(); Sound.cash(); this.toast('เซฟแล้ว!'); });
    this.$('btnHelp').addEventListener('click', () => this.helpModal());
    this.$('btnMute').addEventListener('click', () => {
      Sound.muted = !Sound.muted;
      this.renderSystem();
      if (!Sound.muted) Sound.open();
    });
    this.$('btnReset').addEventListener('click', () => {
      this.confirm('ลบเซฟทั้งหมดและเริ่มใหม่จริงๆ นะ?', () => {
        Game.reset();
        this.backToTitle();
      });
    });
  },

  helpModal() {
    Sound.open();
    this.modal(`
      <h3>📖 วิธีเล่น</h3>
      <div class="help">
        <p><b>🗓️ ทุกสัปดาห์เลือกทำ 1 อย่าง</b> — ฝึกซ้อม, พักผ่อน, อุ่นเครื่อง หรือส่งแมวมอง เวลาจะเดินไปเรื่อยๆ</p>
        <p><b>🏐 ฝึกซ้อม</b> เพิ่มสเตตัส แต่กินความสดชื่น ถ้าเหนื่อยเกิน (ต่ำกว่า 25%) ผลซ้อมจะแย่ลง อย่าลืมพัก!</p>
        <p><b>🏆 ทัวร์นาเมนต์</b> มาตามเดือนที่กำหนด ชนะแชมป์รายการเล็กเพื่อปลดล็อกรายการที่ใหญ่ขึ้น ไต่ไปจนถึงแชมป์โลก</p>
        <p><b>👥 นักกีฬา</b> เก็บ EXP จากซ้อม/แข่งเพื่อเลเวลอัป โตตามตำแหน่ง ดาว ★ ยิ่งมากยิ่งโตไว</p>
        <p><b>🏗️ สิ่งอำนวยความสะดวก</b> เพิ่มผลซ้อม/ฟื้นตัว <b>🤝 สปอนเซอร์</b> ปลดล็อกตามแฟนคลับ ให้เงินทุกสัปดาห์</p>
        <p><b>💛 แฟนคลับ</b> ได้จากการชนะและอีเวนต์ ยิ่งเยอะยิ่งรวย</p>
      </div>
      <div class="modal-btns"><button class="btn" data-act="close">เข้าใจแล้ว!</button></div>
    `);
  },

  /* ================= โมดัล & โทสต์ ================= */

  modal(html, setup) {
    const wrap = this.$('modalWrap');
    const box = this.$('modalBox');
    box.innerHTML = html;
    wrap.hidden = false;
    box.querySelectorAll('[data-act=close]').forEach(b => b.addEventListener('click', () => { Sound.click(); this.closeModal(); }));
    if (setup) setup(box);
    return box;
  },

  modalWait(html, buttons) {
    return new Promise(res => {
      const btnHtml = buttons.map(b => `<button class="${b.cls || 'btn'}" data-wait="${b.id}">${b.label}</button>`).join('');
      this.modal(html + `<div class="modal-btns">${btnHtml}</div>`, box => {
        box.querySelectorAll('[data-wait]').forEach(b => b.addEventListener('click', () => {
          Sound.click();
          this.closeModal();
          res(b.dataset.wait);
        }));
      });
    });
  },

  closeModal() { this.$('modalWrap').hidden = true; this.$('modalBox').innerHTML = ''; },

  confirm(text, onYes) {
    this.modal(`
      <h3>❓ ยืนยัน</h3>
      <p>${text}</p>
      <div class="modal-btns">
        <button class="btn alt" data-act="yes">ยืนยัน</button>
        <button class="btn ghost" data-act="close">ยกเลิก</button>
      </div>
    `, box => {
      box.querySelector('[data-act=yes]').addEventListener('click', () => { this.closeModal(); onYes(); });
    });
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.$('toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
