/* =============================================================
   engine.js — Visual-novel runtime
   Handles state, scene rendering, typewriter text, branching
   choices, an affection system, save/load, backlog and endings.
   Story data lives in story.js (SCENES, RESOLVE).
   ============================================================= */

const SAVE_KEY = 'blvn_saves_v1';
const SET_KEY = 'blvn_settings_v1';
const SEEN_KEY = 'blvn_seen_v1';

/* Safe storage wrapper: uses localStorage when available, otherwise
   falls back to an in-memory store (sandboxed iframes / private mode
   may block localStorage — the game must still run and save within a
   session even then). */
const LS = (() => {
  const mem = {};
  let ok = false;
  try { const k = '__blvn_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
  return {
    available: ok,
    get(k) { try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
    remove(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } },
  };
})();

const Game = {
  scenes: {},
  resolve: {},
  state: null,
  settings: { speed: 30, autoDelay: 1600, mute: false },
  typing: false,
  typeTimer: null,
  autoTimer: null,
  _typedCount: 0,
  auto: false,
  skipping: false,
  history: [],

  /* ---------- boot ---------- */
  init() {
    // index scenes
    STORY_SCENES.forEach(s => { this.scenes[s.id] = s; });
    this.resolve = STORY_RESOLVE || {};
    this.loadSettings();
    this.bindUI();
    this.showTitle();
  },

  loadSettings() {
    try {
      const s = JSON.parse(LS.get(SET_KEY));
      if (s) this.settings = Object.assign(this.settings, s);
    } catch (e) {}
    const sp = document.getElementById('set-speed');
    if (sp) sp.value = this.settings.speed;
    Sound.muted = !!this.settings.mute;
    const mb = document.getElementById('set-mute');
    if (mb) mb.textContent = this.settings.mute ? '🔇 ปิดเสียง' : '🔊 เปิดเสียง';
  },
  saveSettings() { LS.set(SET_KEY, JSON.stringify(this.settings)); },

  seen() { try { return JSON.parse(LS.get(SEEN_KEY)) || {}; } catch (e) { return {}; } },
  markSeen(key) { const s = this.seen(); s[key] = true; LS.set(SEEN_KEY, JSON.stringify(s)); },

  /* ---------- screens ---------- */
  show(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },
  showTitle() {
    this.stopAuto();
    this.show('title-screen');
    const cont = document.getElementById('btn-continue');
    cont.classList.toggle('disabled', !this.hasSaves());
  },

  /* ---------- new game ---------- */
  newGame() {
    this.show('name-screen');
    const inp = document.getElementById('name-input');
    inp.value = '';
    setTimeout(() => inp.focus(), 100);
  },
  confirmName() {
    const inp = document.getElementById('name-input');
    let name = (inp.value || '').trim();
    if (!name) name = 'คุณ';
    if (name.length > 12) name = name.slice(0, 12);
    this.state = {
      player: name,
      scene: 'start',
      affection: { phakin: 0, tawan: 0, nil: 0 },
      flags: {},
      time: 0,
    };
    this.history = [];
    this.show('game-screen');
    this.goTo('start');
  },

  /* ---------- text helpers ---------- */
  fill(t) { return (t || '').replace(/\{\{PLAYER\}\}/g, this.state ? this.state.player : 'คุณ'); },

  /* ---------- navigation ---------- */
  goTo(id) {
    if (!id) return;
    // affection-resolved endings
    if (id.endsWith('_resolve')) {
      const char = id.replace('_resolve', '');
      return this.resolveEnding(char);
    }
    const scene = this.scenes[id];
    if (!scene) { console.warn('Missing scene:', id); return this.showTitle(); }
    this.state.scene = id;
    this.state.time++;
    this.renderScene(scene);
  },

  resolveEnding(char) {
    const cfg = this.resolve[char];
    const val = this.state.affection[char] || 0;
    let target;
    if (cfg) {
      if (val >= cfg.goodMin) target = cfg.goodScene;
      else if (val >= cfg.normalMin) target = cfg.normalScene;
      else target = cfg.badScene;
    }
    if (target && this.scenes[target]) this.goTo(target);
    else this.showTitle();
  },

  /* ---------- rendering ---------- */
  renderScene(scene) {
    // background
    if (scene.bg) {
      const bgLayer = document.getElementById('bg-layer');
      if (bgLayer.dataset.bg !== scene.bg) {
        bgLayer.dataset.bg = scene.bg;
        bgLayer.innerHTML = backgroundSVG(scene.bg);
        bgLayer.classList.remove('bg-fade'); void bgLayer.offsetWidth; bgLayer.classList.add('bg-fade');
      }
      const loc = document.getElementById('loc-tag');
      const tag = scene.location || bgTag(scene.bg);
      loc.textContent = tag; loc.style.opacity = tag ? 1 : 0;
    }

    // sprites
    this.renderSprites(scene);

    // ending?
    if (scene.endType) { this.renderEnding(scene); return; }

    // dialogue
    const who = scene.who || 'narrator';
    const box = document.getElementById('dialogue-box');
    const nameTab = document.getElementById('name-tab');
    const meta = CHARACTERS[who] || CHARACTERS.narrator;
    if (who === 'narrator' || !meta.name) {
      nameTab.style.display = 'none';
      box.classList.add('narration');
    } else {
      nameTab.style.display = 'inline-flex';
      nameTab.textContent = this.fill(meta.name);
      nameTab.style.background = meta.color;
      box.classList.remove('narration');
    }

    // choices vs text
    const choiceLayer = document.getElementById('choice-layer');
    choiceLayer.innerHTML = '';
    choiceLayer.classList.remove('active');

    this.history.push({ who: this.fill(meta.name), text: this.fill(scene.text) });
    if (this.history.length > 200) this.history.shift();

    this.typeText(this.fill(scene.text), () => {
      if (scene.choices && scene.choices.length) {
        this.renderChoices(scene.choices);
      }
    });
  },

  renderSprites(scene) {
    const slots = { left: document.getElementById('sprite-left'), center: document.getElementById('sprite-center'), right: document.getElementById('sprite-right') };
    const active = { left: null, center: null, right: null };
    (scene.sprites || []).forEach(sp => { if (slots[sp.pos]) active[sp.pos] = sp; });
    const speaker = scene.who;
    Object.keys(slots).forEach(pos => {
      const el = slots[pos]; const sp = active[pos];
      if (!sp) {
        if (el.dataset.char) { el.classList.remove('shown'); el.dataset.char = ''; setTimeout(() => { if (!el.dataset.char) el.innerHTML = ''; }, 300); }
        return;
      }
      const sig = sp.char + ':' + sp.expr;
      if (el.dataset.sig !== sig) { el.innerHTML = characterSVG(sp.char, sp.expr); el.dataset.sig = sig; }
      el.dataset.char = sp.char;
      el.classList.add('shown');
      el.classList.toggle('dim', speaker && speaker !== sp.char && speaker !== 'narrator' && speaker !== 'player');
    });
  },

  typeText(text, done) {
    clearTimeout(this.typeTimer);
    const el = document.getElementById('dialogue-text');
    el.textContent = '';
    this.typing = true;
    document.getElementById('next-hint').style.opacity = 0;
    const speed = this.skipping ? 2 : Math.max(4, 60 - this.settings.speed);
    let i = 0;
    const step = () => {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        if (!this.skipping && i % 2 === 0) Sound.blip();
        i++;
        this.typeTimer = setTimeout(step, speed);
      } else {
        this.finishType(done);
      }
    };
    step();
    this._pendingDone = done;
    this._pendingText = text;
  },
  finishType(done) {
    clearTimeout(this.typeTimer);
    const el = document.getElementById('dialogue-text');
    if (this._pendingText != null) el.textContent = this._pendingText;
    this.typing = false;
    document.getElementById('next-hint').style.opacity = 0.7;
    if (done) done();
    if (this.auto && !this._hasChoices()) {
      this.autoTimer = setTimeout(() => this.advance(), this.settings.autoDelay);
    }
    if (this.skipping && !this._hasChoices()) {
      this.autoTimer = setTimeout(() => this.advance(), 120);
    }
  },
  _hasChoices() { return document.getElementById('choice-layer').classList.contains('active'); },

  renderChoices(choices) {
    const layer = document.getElementById('choice-layer');
    layer.innerHTML = '';
    choices.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.style.animationDelay = (idx * 70) + 'ms';
      btn.textContent = this.fill(c.text);
      btn.onclick = () => this.choose(c);
      layer.appendChild(btn);
    });
    layer.classList.add('active');
  },

  choose(c) {
    this.stopAuto();
    Sound.pick();
    const eff = { phakin: c.p || 0, tawan: c.t || 0, nil: c.n || 0 };
    this.applyEffects(eff);
    if (c.flag) this.state.flags[c.flag] = true;
    document.getElementById('choice-layer').classList.remove('active');
    document.getElementById('choice-layer').innerHTML = '';
    this.goTo(c.next);
  },

  applyEffects(eff) {
    let popped = false;
    Object.keys(eff).forEach(k => {
      if (eff[k]) {
        this.state.affection[k] = Math.max(0, (this.state.affection[k] || 0) + eff[k]);
        if (eff[k] > 0 && !popped) { this.heartPop(k, eff[k]); Sound.pop(); popped = true; }
      }
    });
  },

  heartPop(char, amt) {
    const meta = CHARACTERS[char];
    const p = document.createElement('div');
    p.className = 'heart-pop';
    p.innerHTML = `♥ ${this.fill(meta.name)} +${amt}`;
    p.style.color = meta.color;
    document.getElementById('game-screen').appendChild(p);
    setTimeout(() => p.remove(), 1600);
  },

  /* ---------- advance / input ---------- */
  advance() {
    if (this._hasChoices()) return;
    if (this.typing) { this.finishType(this._pendingDone); return; }
    const scene = this.scenes[this.state.scene];
    if (!scene) return;
    if (scene.endType) return; // ending waits for button
    if (scene.choices && scene.choices.length) return;
    if (scene.next) this.goTo(scene.next);
  },

  toggleAuto() {
    this.auto = !this.auto;
    document.getElementById('btn-auto').classList.toggle('on', this.auto);
    if (this.auto && !this.typing && !this._hasChoices()) this.advance();
    else if (!this.auto) clearTimeout(this.autoTimer);
  },
  toggleSkip() {
    this.skipping = !this.skipping;
    document.getElementById('btn-skip').classList.toggle('on', this.skipping);
    if (this.skipping) { if (this.typing) this.finishType(this._pendingDone); else if (!this._hasChoices()) this.advance(); }
    else clearTimeout(this.autoTimer);
  },
  stopAuto() { this.auto = false; this.skipping = false; clearTimeout(this.autoTimer); const a = document.getElementById('btn-auto'); const s = document.getElementById('btn-skip'); if (a) a.classList.remove('on'); if (s) s.classList.remove('on'); },

  /* ---------- endings ---------- */
  renderEnding(scene) {
    this.stopAuto();
    const ov = document.getElementById('ending-overlay');
    const kind = scene.endType;
    const char = (scene.who && CHARACTERS[scene.who]) ? scene.who : (this.state ? this._routeChar() : null);
    this.markSeen('end_' + scene.id);
    const badge = { good: '♥ END', normal: '☆ END', bad: '… END', friend: '☺ END' }[kind] || 'END';
    document.getElementById('ending-badge').textContent = badge;
    document.getElementById('ending-badge').className = 'ending-badge ' + kind;
    document.getElementById('ending-title').textContent = this.fill(scene.endTitle || 'จบตอน');
    document.getElementById('ending-text').textContent = this.fill(scene.text);
    document.getElementById('dialogue-box').style.opacity = 0;
    ov.classList.add('active');
    Sound.chime();
  },
  _routeChar() {
    const id = this.state.scene || '';
    return ROMANCEABLE.find(c => id.startsWith(c)) || null;
  },
  closeEnding() {
    document.getElementById('ending-overlay').classList.remove('active');
    document.getElementById('dialogue-box').style.opacity = 1;
    this.showTitle();
  },

  /* ---------- save / load ---------- */
  getSaves() { try { return JSON.parse(LS.get(SAVE_KEY)) || {}; } catch (e) { return {}; } },
  hasSaves() { return Object.keys(this.getSaves()).length > 0; },
  saveTo(slot, silent) {
    if (!this.state) return;
    const saves = this.getSaves();
    const scene = this.scenes[this.state.scene];
    saves[slot] = {
      state: JSON.parse(JSON.stringify(this.state)),
      label: this.fill((scene && scene.location) || bgTag(scene && scene.bg) || 'บันทึก'),
      preview: this.fill((scene && scene.text) || '').slice(0, 46),
      stamp: this.state.time,
    };
    LS.set(SAVE_KEY, JSON.stringify(saves));
    if (!silent) { this.renderSaveSlots(); this.toast('บันทึกแล้ว 💾'); }
  },
  loadFrom(slot) {
    const saves = this.getSaves();
    const s = saves[slot];
    if (!s) return;
    this.state = JSON.parse(JSON.stringify(s.state));
    this.history = [];
    this.closeMenu();
    this.show('game-screen');
    document.getElementById('bg-layer').dataset.bg = '';
    ['sprite-left', 'sprite-center', 'sprite-right'].forEach(id => { const e = document.getElementById(id); e.innerHTML = ''; e.dataset.sig = ''; e.dataset.char = ''; });
    this.goTo(this.state.scene);
  },
  continueGame() {
    if (!this.hasSaves()) return;
    const saves = this.getSaves();
    // load most recent (auto slot preferred)
    const key = saves['auto'] ? 'auto' : Object.keys(saves)[0];
    this.loadFrom(key);
  },
  autosave() { if (this.state) this.saveTo('auto', true); },

  /* ---------- menus ---------- */
  openMenu(tab) {
    document.getElementById('menu-overlay').classList.add('active');
    this.switchTab(tab || 'save');
  },
  closeMenu() { document.getElementById('menu-overlay').classList.remove('active'); },
  switchTab(tab) {
    document.querySelectorAll('.menu-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.menu-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
    if (tab === 'save' || tab === 'load') this.renderSaveSlots();
    if (tab === 'status') this.renderStatus();
  },
  renderSaveSlots() {
    const saves = this.getSaves();
    ['save', 'load'].forEach(mode => {
      const wrap = document.getElementById(mode + '-slots');
      if (!wrap) return;
      wrap.innerHTML = '';
      const slots = ['auto', 'slot1', 'slot2', 'slot3', 'slot4'];
      slots.forEach(slot => {
        const s = saves[slot];
        const div = document.createElement('div');
        div.className = 'save-slot' + (s ? ' filled' : ' empty') + (slot === 'auto' ? ' auto' : '');
        const title = slot === 'auto' ? 'ออโต้เซฟ' : 'ช่อง ' + slot.replace('slot', '');
        div.innerHTML = `<div class="slot-title">${title}</div>` +
          (s ? `<div class="slot-loc">${s.label}</div><div class="slot-prev">${s.preview}…</div>`
             : `<div class="slot-empty">— ว่าง —</div>`);
        if (mode === 'save') {
          if (slot !== 'auto') div.onclick = () => this.saveTo(slot);
          else div.classList.add('locked');
        } else {
          if (s) div.onclick = () => this.loadFrom(slot);
        }
        wrap.appendChild(div);
      });
    });
  },
  renderStatus() {
    const wrap = document.getElementById('status-body');
    if (!this.state) { wrap.innerHTML = '<p style="text-align:center;opacity:.6">ยังไม่ได้เริ่มเกม</p>'; return; }
    wrap.innerHTML = ROMANCEABLE.map(c => {
      const meta = CHARACTERS[c];
      const val = this.state.affection[c] || 0;
      const max = 12;
      const hearts = Array.from({ length: 6 }, (_, i) => {
        const filled = val >= (i + 1) * 2;
        const half = !filled && val >= i * 2 + 1;
        return `<span class="mini-heart ${filled ? 'on' : half ? 'half' : ''}" style="color:${meta.color}">♥</span>`;
      }).join('');
      return `<div class="status-row">
        <div class="status-face">${characterSVG(c, val >= 8 ? 'happy' : val >= 4 ? 'smile' : 'neutral')}</div>
        <div class="status-info">
          <div class="status-name" style="color:${meta.color}">${meta.name}</div>
          <div class="status-role">${meta.role}</div>
          <div class="status-hearts">${hearts}</div>
        </div></div>`;
    }).join('');
  },

  /* ---------- cast gallery ---------- */
  renderCast() {
    const wrap = document.getElementById('cast-body');
    const seen = this.seen();
    wrap.innerHTML = ROMANCEABLE.map(c => {
      const meta = CHARACTERS[c];
      const got = ['good', 'normal', 'bad'].filter(k => seen['end_' + c + '_' + k]);
      const badges = ['good', 'normal', 'bad'].map(k => {
        const on = seen['end_' + c + '_' + k];
        const sym = { good: '♥', normal: '☆', bad: '…' }[k];
        return `<span class="end-badge-mini ${on ? 'on' : ''}" title="${k}">${on ? sym : '?'}</span>`;
      }).join('');
      return `<div class="cast-card" style="--c:${meta.color};--cs:${meta.colorSoft}">
        <div class="cast-face">${characterSVG(c, 'smile')}</div>
        <div class="cast-name">${meta.name} <span class="cast-en">${meta.en}</span></div>
        <div class="cast-role">${meta.role}</div>
        <div class="cast-tag">${meta.tagline}</div>
        <div class="cast-blurb">${meta.blurb}</div>
        <div class="cast-ends">ตอนจบที่ปลดล็อก: ${badges}</div>
      </div>`;
    }).join('');
  },

  /* ---------- backlog ---------- */
  openLog() {
    const wrap = document.getElementById('log-body');
    wrap.innerHTML = this.history.slice(-80).map(h =>
      `<div class="log-line">${h.who ? `<b>${h.who}</b> ` : ''}${h.text}</div>`).join('');
    document.getElementById('log-overlay').classList.add('active');
    wrap.scrollTop = wrap.scrollHeight;
  },
  closeLog() { document.getElementById('log-overlay').classList.remove('active'); },

  /* ---------- toast ---------- */
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 1400);
  },

  /* ---------- UI binding ---------- */
  bindUI() {
    document.getElementById('btn-new').onclick = () => { if (this.hasSaves()) { if (confirm('เริ่มเกมใหม่? เกมที่เล่นค้างจะยังอยู่ในช่องเซฟ')) this.newGame(); } else this.newGame(); };
    document.getElementById('btn-continue').onclick = () => this.continueGame();
    document.getElementById('btn-cast').onclick = () => { this.renderCast(); this.show('cast-screen'); };
    document.getElementById('btn-about').onclick = () => this.show('about-screen');
    document.querySelectorAll('.to-title').forEach(b => b.onclick = () => this.showTitle());
    document.getElementById('name-confirm').onclick = () => this.confirmName();
    document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.confirmName(); });
    document.querySelectorAll('.name-suggest').forEach(b => b.onclick = () => { document.getElementById('name-input').value = b.textContent; });

    // in-game controls
    document.getElementById('advance-area').onclick = () => this.advance();
    document.getElementById('btn-menu').onclick = () => this.openMenu('save');
    document.getElementById('btn-log').onclick = () => this.openLog();
    document.getElementById('btn-auto').onclick = () => this.toggleAuto();
    document.getElementById('btn-skip').onclick = () => this.toggleSkip();
    document.getElementById('btn-status').onclick = () => this.openMenu('status');

    // menu
    document.querySelectorAll('.menu-tab').forEach(t => t.onclick = () => this.switchTab(t.dataset.tab));
    document.getElementById('menu-close').onclick = () => this.closeMenu();
    document.getElementById('menu-title').onclick = () => { if (confirm('กลับหน้าหลัก? อย่าลืมเซฟก่อนนะ')) { this.autosave(); this.closeMenu(); this.showTitle(); } };
    document.getElementById('log-close').onclick = () => this.closeLog();
    document.getElementById('ending-continue').onclick = () => this.closeEnding();

    // settings
    const sp = document.getElementById('set-speed');
    sp.oninput = () => { this.settings.speed = +sp.value; this.saveSettings(); };
    const mute = document.getElementById('set-mute');
    if (mute) mute.onclick = () => { this.settings.mute = !this.settings.mute; Sound.muted = this.settings.mute; mute.textContent = this.settings.mute ? '🔇 ปิดเสียง' : '🔊 เปิดเสียง'; this.saveSettings(); if (!this.settings.mute) Sound.pick(); };
    document.getElementById('set-clear').onclick = () => { if (confirm('ลบข้อมูลเซฟและตอนจบที่ปลดล็อกทั้งหมด?')) { LS.remove(SAVE_KEY); LS.remove(SEEN_KEY); this.toast('ล้างข้อมูลแล้ว'); this.renderSaveSlots(); } };

    // keyboard
    document.addEventListener('keydown', e => {
      if (!document.getElementById('game-screen').classList.contains('active')) return;
      if (document.getElementById('menu-overlay').classList.contains('active')) { if (e.key === 'Escape') this.closeMenu(); return; }
      if (document.getElementById('log-overlay').classList.contains('active')) { if (e.key === 'Escape') this.closeLog(); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.advance(); }
      else if (e.key === 'Escape') this.openMenu('save');
      else if (e.key === 'a' || e.key === 'A') this.toggleAuto();
      else if (e.key === 'l' || e.key === 'L') this.openLog();
    });

    // autosave every scene advance
    const origGoTo = this.goTo.bind(this);
    this.goTo = (id) => { origGoTo(id); if (this.state && document.getElementById('game-screen').classList.contains('active')) this.autosave(); };
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
