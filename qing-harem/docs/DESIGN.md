# DESIGN / TECHNICAL CONTRACT — ลิขิตหงส์ · วังหลังต้าชิง

Self-contained offline browser game: plain HTML + CSS + classic `<script>` files (no modules, no build step needed to play, no external assets
except an optional Google-Fonts `<link>`). Everything visual is generated SVG. Everything the player reads is Thai.
Read `docs/BIBLE.md` first (story + who owns what). This file is the *technical* contract.

## 0. Files & load order (all paths relative to `qing-harem/`)
```
index.html                     (engine agent)  loads scripts in this order; contains DATA markers (see §9)
css/style.css                  (engine agent)
js/core_data.js                (lead; READ-ONLY for everyone)  → global `Q` (tables, registries, Q.add)
js/logic.js                    (lead; READ-ONLY)               → global `QL` (pure logic; no DOM)
js/art_chars.js                (art-chars agent)               → global function portraitSVG(charId, expr, opts)
js/art_bg.js                   (art-bg agent)                  → global function backgroundSVG(key, opts)
js/sound.js                    (sound agent)                   → global `Sound`
js/data/*.js                   (content agents; any number of files per unit, named cNN_*.js)  → Q.add([...])
js/engine.js                   (engine agent)                  → global `Game` (UI controller over QL)
tools/validate.js              (lead)  node tools/validate.js <files…> | --all
tools/sync_index.js, build.js  (lead)  regenerate <script> list in index.html / build standalone.html
```
Do NOT edit files you do not own. If you need a change in a read-only file, say so in your final report.

## 1. State (`st`, plain JSON — also the save format)
```
st.name, st.origin ('noble'|'scholar'|'maid'), st.rank (0..9), st.t (season counter from 0; year=floor(t/4)+1, season=t%4: 0 spring 1 summer 2 autumn 3 winter)
st.sir  seasons spent in current rank          st.ap  action points left this season (2)
st.S    {favor, prestige, wit, charm, talent, virtue, health, silver, threat}   0..100 (silver ≥ 0, unbounded)
st.R    {empress, dowager, consort, friend, maid, eunuch, doctor, prince, chu, lu, shu}   −100..100   (Emperor's regard = S.favor)
st.F    flags (true / number / string)         st.seen {eventId: lastSeenSeason}      st.queue [{id,due}]   st.pending [eventIds]
st.cur  {ev,node} while an event is running    st.scene {bg,cast}   st.flash (stat deltas since last view)   st.promoted {from,to,title,zh}|null
st.phase 'events'|'hub'|'ended'   st.ending id   st.pendingEnding id   st.log [{t,text}]   st.seed (deterministic RNG)
```

## 2. Condition language (strings) — used by `cond`, `req`, `trigger`, `branch[].cond`, `check.mods[].cond`, `GATES.req`
CSP-safe mini-language (no eval). Variables: **`S`** (stats) **`F`** (flags) **`R`** (relations) `rank` `sir` `season`(0-3) `year` `t` `age` `origin`.
Operators: `! && || ?? ?: == != === !== < <= > >= + - * / %` , parentheses, `min() max() abs() floor()`, member access `S.favor`, `F.met_emperor`, `F['x']`.
Examples: `"S.favor >= 40 && !F.chu_down"`, `"rank >= 3 && (F.love_doctor || R.doctor >= 50)"`, `"origin == 'maid'"`, `"t == 0 && rank == 0"`.
Unset flags are `undefined` (falsy). Unknown identifiers are an ERROR (validator catches).
**Xiunü (秀女) new-concubine batches** (see `Q.XIUNU`): every 12 seasons 2–3 generated girls arrive; rank ≥ 5 the player decides each (investigate / sponsor / neutral / maid / reject). An event may feature one of them with the event field **`girl: 'ally_court'|'ally'|'sponsored'|'ambitious'|'rising'|'graduate'|'turning'|'rival_fav'|'rejected_noble'|'maid_girl'|'maid_spy'|'any'`** (event is only eligible when such a girl exists; she becomes the *focus*), cast `{c:'maiden'}` / `who:'maiden'`, placeholders `{{XN}} {{XNRANK}} {{XNCLAN}} {{XN1}}..{{XN3}}`, and `fx.xn` to edit her. Conditions can read **`X`**: `X.pending X.n X.allies X.rivals X.sponsored X.batches X.quota` and the focus girl `X.f.{status,ambition,loyalty,favor,rank,agent,turned,arch,power}`. Chapter `xn_batch_arrival` (trigger `F.xn_fresh`) announces each batch.

**Tablet flipping (พลิกป้าย · `Q.TABLET`)**: from rank 2 the player has a green tablet. Every season-end the Emperor's mood (`T.mood`, 5..95: <30 irritable · 30-44 weary · 45-64 calm · 65-79 good · >=80 delighted) drifts and he flips 1-3 tablets by a weighted lottery (player: favor, rank, charm, talent, eunuch goodwill, wardrobe, boost; rivals: Niohuru consort, Lu, Shu, Chu, Meixing and the generated xiunü girls). If the player's tablet is flipped, ONE event with **`tags:['tablet']`** (kind `random`) plays at the start of the next season ("the night"); at rank 8 (Empress) there is no tablet: the Emperor visits on set days (35%/season) and the same tag is used (guard with `rank == 8` / `rank < 8`). Conditions can read **`T`**: `T.mood T.me T.miss T.struck T.boost T.nights` (`T.miss` = rounds in a row not flipped; `T.struck` > 0 while the Empress/Dowager has struck her name; `F.tb_nights` counts nights). Effects: **`fx.tablet: { mood: n|[a,b], boost: n, strike: n }`** (boost = weight bonus for the next round; strike = seasons the name is struck, negative clears). Night events must be PG-13 (fade to black), must not set pregnancy/heir flags, and should give favor +3..+9 with a skill check, jealousy `threat` +1..+3 and a small mood shift.

The variable **`W`** (wardrobe) is also available: `W.tier` (avg tier of robe+head), `W.dress` (tier − rank; ≥0 = dressed for the rank), `W.style` (robe style: plain|graceful|bright|grand|sacred), `W.set` (matching set id or null), `W.flash` (# of bright/grand pieces), `W.robe/head/neck/ear/charm` (equipped ids), `W.own.<item_id>` (owned). Example: `"W.style == 'plain' && rank >= 3"`, `check.mods: [{cond:'W.set', add:8}]`.

## 3. Effects (`fx`) — on nodes, choices (`fx`, `winFx`, `loseFx`), actions, rank-up
```js
fx: {
  favor: 5, prestige: [2,4], wit:1, charm:0, talent:2, virtue:-3, health:-10, silver:-40, threat:3,   // number or [min,max] (random int)
  rel: { empress: 5, friend: [-8,-4] },                          // keys: empress dowager consort friend maid eunuch doctor prince chu lu shu
  set: ['flag_a','flag_b']   OR   set: { heir_name: 'หมิงเซวียน', some_count: 2 },
  unset: ['poisoned'],   inc: { r3_strikes: 1 },
  queue: [{ id: 'r3_arc_trial_b', in: 1 }],      // run that event at the START of the season (1+in) seasons from now (in:0 = next season)
  ap: 1,                                         // extra action points this season
  give: ['h_gift_jade'],                          // grant wardrobe item(s) (ids in Q.WARDROBE.items; auto-equipped if better than the current piece)
  xn: { loyalty: 5, ambition: [-8,-3], favor: 3, rank: 1, status: 'gone', turned: false, expose: true, graduated: true },   // edit the CURRENT xiunü girl ({{XN}}); status: gone|rejected|maid|sponsored|kept
  log: 'ข้อความสั้นๆ บันทึกลงสมุดเหตุการณ์',      // shown in the diary
  note: 'ข้อความเด่นที่แสดงเป็นแถบสั้นๆ',          // a highlighted toast with the node
}
```
Stats clamp to 0..100 (silver ≥ 0). Stat deltas are auto-displayed by the UI as floating chips.

## 4. Event schema (one object in `Q.add([...])`)
```js
{
  id: 'r3_trial_a',            // unique, /^[a-z0-9_]+$/, MUST start with your unit prefix (BIBLE §8). Promo ids are exactly promo_<from>_<to>.
  kind: 'random'|'chapter'|'chain'|'festival'|'promo'|'ending',
  title: 'ชื่อเหตุการณ์ (ไทย, สั้น)',
  minRank: 1, maxRank: 8,      // inclusive. DEFAULT 1..8 (!). rank-0 events must set minRank:0.
  tags: ['garden'],            // random only. Allowed: garden visit_empress visit_dowager visit_emperor befriend bribe investigate scheme palace_affairs family attack general
  season: [0,1,2,3],           // optional: only in those seasons (festival REQUIRES it)
  weight: 10,                  // default 10 (random/festival pools only)
  cond: "string",              // extra eligibility condition (evaluated when the pool is built)
  trigger: "string",           // chapter only: auto-starts at a season start when true (and rank in range, not yet seen)
  prio: 0,                     // chapter only: higher first (one chapter per season)
  once: true|false,            // defaults: chapter/chain/ending = true; random/festival/promo = false (random/festival use cooldown)
  cooldown: 6,                 // seasons before a random/festival can repeat (default 6, festival 8)
  bg: 'garden',                // starting background (Q.BGS). Always set it.
  cast: [{ c:'emperor', pos:'center', x:'neutral' }],   // starting sprites (pos left|center|right; x expression). Omit/[] = nobody
  start: 'n1',
  nodes: { n1: {...}, n2: {...} },
  ending: { type:'good'|'neutral'|'bad'|'true', title:'ชื่อตอนจบ', hint:'คำใบ้ปลดล็อกในจดหมายเหตุ' },   // kind:'ending' only
}
```
### How events get played (the season loop — see `QL`)
1. **Season start** (`beginSeason`): builds `st.pending` (max 3): promotion event if the gate is met → one triggered *chapter* → due `queue` items → an *attack* roll (probability ∝ `S.threat`) → a *festival* (45%) or one *general random* event.
2. **Hub**: the player spends `ap` (2) on **actions** (Q.ACTIONS). An action with `draw:'tag'` plays one eligible random event carrying that tag; otherwise it shows a flavor line.
3. **Season end** (`endSeason`): stipend, favor decay, threat/health drift, poison, time passes, promotion check, system endings, then the next `beginSeason`.
- A **chapter** is a scripted story beat (arc). A **chain** event is only reached via `queue` or `jump`. A **promo** (`promo_a_b`) is fired automatically when `QL.gate(st).ok`. **It MUST contain a `promote:true` node reachable on at least one path** (other paths may end without promoting; the engine retries after 4 seasons).
- **Random pool eligibility** = rank in [minRank,maxRank], season matches, not on cooldown, `cond` true. General pool = `kind:'random'` with no tags (or tag `general`). Tagged events are ONLY reachable through the matching action / attack roll.
- While `F.finale` is true, `random` and `festival` events are suppressed (only chapters/queue run).
- **Progress must never depend on a random event.** Arc chapters trigger on `rank`, `sir`, stats and guaranteed flags; `arcN_done` must be set on EVERY non-fatal path of the arc.

## 5. Node schema
```js
nodeId: {
  who: 'narrator'|'player'|<char id>,   // speaker (default narrator). Names/colours come from Q.CHARS.
  x: 'smile',                           // speaker's expression this line (must be on stage). Q.EXPRS: neutral smile sad angry shy surprised smirk cry
  text: '…',                            // dialogue / narration. Placeholders {{PLAYER}} {{RANK}} {{HEIR}} {{YEAR}} {{SEASON}}. ≤ 170 chars ideal.
  card: 'ผ่านไปสามเดือน…',              // text-only: a full-screen title card. (card + text together = caption over the line)
  bg: 'study',  cast: [...],            // scene change from this node on (cast REPLACES the stage)
  fx: {…},                              // applied once when the node is entered
  next: 'nodeId',                       // linear continue
  jump: 'other_event_id',               // continue into another event (instead of next)
  choices: [ <choice>, … ],             // 2–4 (prompt in `text`)
  branch: [ {cond:'…', next:'a'}, {next:'b'} ],   // SILENT router (no text). Last entry should be unconditional.
  promote: true,                        // rank +1 (triggers the edict ceremony in the UI)
  demote: 1,                            // rank −n (rank<1 ⇒ cold palace ending)
  ending: 'end_executed',               // after this node, run that ending event (game over)
}
```
A node with no `next`/`jump`/`choices` **ends the event**.
```js
choice: {
  text: 'ก้มศีรษะรับคำสั่ง',            // ≤ 60 chars, the player's action
  cond: '…',                            // hide unless true        req: '…' + why: 'ต้องมีคนช่วยก่อน'   // show disabled unless true
  cost: { silver: 40 },                 // paid on pick; disabled if too poor
  hint: 'เสี่ยงแต่ได้ผลสูง',              // optional small caption
  fx: {…},
  next: 'nodeId'  |  jump: 'event_id'   // plain choice
  check: { stat: 'wit' | ['wit','charm'] | 'luck', dc: 45, mods: [{cond:'F.x', add:10}] },   // skill check:
  win: 'nodeIdA', lose: 'nodeIdB', winFx: {…}, loseFx: {…},                                 //   chance = clamp(0.5 + (avg(stat)+mods−dc)/80, 5%, 95%)  (shown to the player)
}
```
Difficulty guide for `dc`: easy 30 · normal 45 · hard 60 · very hard 75. Stats typically range 30–60 early, 60–90 late.

## 6. Balance guide (apply to `fx`)
- Size of one stat change: small 1–3 · medium 4–8 · large 9–15 · huge (arc climax only) 16–25. Never exceed ±30.
- `favor`: decays 3/season. Typical good meeting +4…+9. A promotion gate needs 18→52. `prestige` is permanent: +1…+4 per event; gates need 10→90 across the whole game (rank-up itself grants +4…+10).
- `virtue` moves rarely (±1…±4); it shapes the ending. `threat` +2…+8 when you provoke, −3…−9 when you hide/guard.
- `health`: −3…−10 for hardship, −12…−25 for severe harm; ±8–12 for rest/tonic. `poisoned` is a *flag* that drains 5/season.
- `rel.*`: ±3…±10 typical; ±15 big.
- Silver by rank (stipend per season ≈ 12 / 20 / 32 / 52 / 80 / 120 / 180 / 260 for ranks 1…8): choice costs ≈ 0.5–2× the stipend of the rank at which the event happens; windfalls ≈ 1–3×.
- Do not give free big bonuses: pair gains with a cost, risk or later consequence.

## 7. Validation workflow (authors MUST do this before finishing)
```
cd qing-harem
node tools/validate.js js/data/c0X_yourfile.js      # per-file: schema, graph, expression syntax, 40 random walks per event
node tools/validate.js --all --quiet                # whole game (cross-file refs; other units may still be missing — ignore their errors)
```
Fix every ERROR in your own files. Fix warnings that you agree with (unreachable nodes, long lines, missing bg, unknown speaker in cast…).
Write your file(s) in several chunks if large (create with Write, then extend with `cat >> file <<'EOF'` or edit) — never produce one giant tool call.
Use only ids that exist: characters (Q.CHARS), expressions (Q.EXPRS), backgrounds (Q.BGS), tags (Q.TAGS), rel keys (Q.REL_KEYS), stat keys (Q.STAT_KEYS).

## 8. UI/engine contract (engine.js + index.html + css/style.css)
**Look & feel**: lavish Qing-palace aesthetic — imperial red & gold, jade, ink-black, warm silk cream; gold filigree borders, cloud (xiangyun) motifs, lattice windows (冰裂纹), seal-stamp (印章) rank badges, calligraphic headings (fallback font stack: "Noto Serif Thai","Sarabun","TH Sarabun New",serif; optional Google-Fonts `<link>`; must degrade offline).
Responsive: works on a 360×740 phone *and* desktop; touch-friendly (≥44px targets); no horizontal scroll.
**Screens**: Title (animated night palace + moon + falling plum petals; buttons: เริ่มบันทึกประวัติ / เล่นต่อ / จดหมายเหตุ (archive: endings + cast gallery) / วิธีเล่น & เครดิต) · Character creation (name input w/ suggestions; 3 origin cards from `Q.ORIGINS` incl. difficulty stars; 4 gifts from `Q.GIFTS`) · **Game screen** with two modes:
 - **Hub** (between events): date banner (`QL.dateInfo`), big player portrait whose outfit follows rank, **the Ladder** (vertical list of the 9 ranks: reached = gold seal, current = glowing, locked = grey; shows the next-rank progress bars from `QL.gate(st).need` with ✓/✗), stat bars (`Q.STAT_META`), relationship hearts for notable people (empress/dowager/consort/friend/maid/eunuch/doctor/prince), AP pips, and the **action grid** (`QL.actions(st)` grouped by `grp`: self/court/intrigue; show icon, name, desc, cost; disabled with reason) + "สิ้นสุดฤดูกาล" button. Tapping an action → `QL.doAction`: shows result (flash chips + flavor line) or runs the drawn event.
 - **Event/VN mode**: background (`backgroundSVG(bg,{season})`), up to 3 sprites (`portraitSVG(c, x, {rank,origin})`; dim non-speakers; speaker expression from `view.x`), dialogue box with name tab (name/colour from `Q.CHARS`, `{{PLAYER}}` filled), typewriter text, click/Space/Enter to advance, choice buttons (show cost, check chance %, disabled reason), full-screen `card` display, stat-change chips (`view.flash`), diary/backlog, auto/skip.
 - **Rank-up ceremony** when `view.promoted` is set: full-screen imperial edict scroll ("奉天承运" style), shows old → new title (Thai + Chinese), seal animation + gong; then `QL.ackPromotion`.
 - **Season report** after `QL.endSeason` (stipend, favor decay, notes) then run pending events.
 - **Ending screen** from `QL.summary(st)`: type badge (true/good/neutral/bad), title, epilogue stats (rank, years, age, heir), unlocked-ending bookkeeping (`Q.SEEN_KEY`), buttons: จดหมายเหตุ / เริ่มใหม่.
 - Menu overlay: save (4 manual slots + auto), load, diary (`st.log`), settings (text speed, mute, erase data), cast gallery. Auto-save at every hub entry (store the whole `st` JSON in `localStorage` through a safe wrapper that falls back to memory — see ../js/engine.js of the old game for the `LS` pattern; never crash if storage is blocked).
**Main loop** (the ONLY way the UI drives the game — do not re-implement rules):
```js
st = QL.newGame({name, origin, gift});
loop:
  while ((id = QL.nextPending(st))) { QL.startEvent(st,id); while ((v = QL.view(st))) { show(v); /* user input → */ v.kind==='choice' ? QL.choose(st,i) : QL.advance(st); if (v.promoted) ceremony; } }
  if (st.phase === 'ended') showEnding(QL.summary(st)); else showHub(QL.hub(st));   // actions → QL.doAction(st,id) → (st.pending may contain a drawn event) ; end of season → QL.endSeason(st)
```
**Test hooks (required)**: `window.Game = Game`; `Game.st` current state; stable DOM ids/classes: `#title-screen #btn-new #btn-continue #name-input #btn-start .origin-card[data-origin] .gift-card[data-gift] #hub-screen .action-card[data-action] #btn-end-season #event-screen #dialogue-box #dialogue-text .choice-btn #advance-area #ending-screen #btn-restart #ceremony`; URL param `?fast=1` ⇒ instant text, no animation delays (for bots/screenshots); `Game.settings.speed`.
Sound: call `Sound.*` defensively (`if (window.Sound)`), muted setting persisted.

## 9. index.html script list & DATA markers
```html
<script src="js/core_data.js"></script>
<script src="js/logic.js"></script>   <!-- must come AFTER all data? NO: logic.js indexes events lazily via QL.reindex(); engine calls QL.reindex() once on boot -->
<!-- DATA:BEGIN -->
<script src="js/data/00_sample.js"></script>
<!-- DATA:END -->
<script src="js/art_chars.js"></script><script src="js/art_bg.js"></script><script src="js/sound.js"></script><script src="js/engine.js"></script>
```
`tools/sync_index.js` rewrites everything between `<!-- DATA:BEGIN -->` and `<!-- DATA:END -->` from `js/data/*.js` (sorted). **Engine agent: keep the markers exactly; call `QL.reindex()` at boot (after all scripts loaded).**

## 10. Art contract
**art_chars.js**: `portraitSVG(charId, expr, opts) → string` (an `<svg>` element string). `charId` ∈ Q.CHARS keys except narrator; `expr` ∈ Q.EXPRS (fallback neutral); `opts: {rank, origin, bust}`.
Full-body-ish bust portrait, `viewBox="0 0 400 600"`, transparent background (no background rect), subject centered, feet/lower robe fade out via the viewBox; `opts.bust:true` → tight head-and-shoulders crop (`viewBox="40 10 320 320"`) for avatars. Deterministic (no Math.random at render time).
Style: refined Chinese-illustration/anime hybrid (guofeng) — soft cel shading, delicate lines, expressive eyes, rich costume detail; watercolor-like gradients are welcome. Must look clearly different per character (see table) and every expression readable (brows+eyes+mouth+blush/tears).
Characters (age y1): player 16 (outfit/headdress evolve with `opts.rank` 0..9; `opts.origin` tints palette; rank 0 maid: plain blue-grey cotton tunic, simple braid; 1–2 pastel silk, small flower pins; 3 small *qitou* (旗头 Manchu headdress); 4–5 bigger qitou, jade & pearl, tassels; 6–7 gold phoenix ornaments, embroidered robe; 8 phoenix crown 凤冠 + imperial yellow-red robe; 9 older (silvering hair, composed), grand phoenix crown, deep purple-gold robe) · emperor 27 (yellow dragon robe, mandarin court hat or topknot crown, slender, tired eyes) · empress 30 (red/gold, high qitou, serene) · dowager 52 (dark purple, silver hair, Buddhist beads) · consort 28 (orange-red, huge gold qitou, sharp brows) · chu 22 (pink-magenta, flashy ornaments, pouty) · lu 24 (soft blue, willowy, gentle smile) · shu 26 (teal-green, minimal ornaments, calm) · friend 15 (peach pink, simple Han hair buns, cheerful) · maid 16 (orange-brown servant tunic, twin buns) · eunuch 40 (grey-blue official robe, black cap, narrow eyes) · doctor 26 (white-teal scholar robe, medicine box strap, kind eyes) · prince 25 (indigo-silver robe, hair crown with jade, smirk) · mama 55 (dark brown, grey bun, stern) · child 5 (small boy, yellow silk, shaved forehead with queue).
**art_bg.js**: `backgroundSVG(key, opts) → string` — `viewBox="0 0 1600 900"` `preserveAspectRatio="xMidYMid slice"`, no external refs. Implement EVERY key in `Q.BGS`. `opts.season` (0–3) tints/decorates (spring blossoms, summer green/lotus, autumn red leaves, winter snow where outdoors). Day/night per key. Painterly, atmospheric (gradients, soft light, silhouettes, depth layers, subtle ornamentation); readable behind white dialogue box (keep bottom 30% calmer). Keep each SVG < 60 KB.
Both files: pure functions, no DOM access, no globals except the exported function(s) (prefix helpers with `_art`/`_bg`).

## 11. Sound contract (sound.js)
Global `Sound` with: `muted`, `ensure()`, `blip()` (typewriter tick), `pick()`, `pop()` (gain), `fail()`, `chime()`, `gong()` (rank-up), `page()` (soft paper), `startAmbient(mood)`/`stopAmbient()` (mood: 'palace'|'tense'|'sad'|'joy'|'night' — generative pentatonic guzheng-like plucks + soft drone; very quiet; auto-pauses when `muted`; never throws if AudioContext is unavailable). All synthesized with Web Audio (no files).

## 12. Naming — พระนาม · ฉายาพระราชทาน (封号 fenghao) — `Q.NAMING`, `st.N`
**Realism rules (user-specified, Qing custom):**
1. Rank 0 (maid / xiunü hopeful): called by personal name (`st.name`).
2. Ranks 1–3 (ต้าอิ้ง · ฉังไจ้ · กุ้ยเหริน) and any rank with NO fenghao: **clan + space + rank** — "เซิ่น ฉังไจ้", "กวาเอ่อร์เจีย กุ้ยเหริน".
3. From rank 4 (ผิน) up the Emperor bestows a **fenghao** (ฉายา · one Chinese character, e.g. 令 ลิ่ง): **fenghao + rank, no space** — "ลิ่งผิน", "ลิ่งเฟย", "ลิ่งกุ้ยเฟย".
4. A **much-favoured** concubine may get the fenghao EARLY, at ranks 1–3 (favor high) — she is then "ลิ่งกุ้ยเหริน".
5. From rank 7 (หวงกุ้ยเฟย) up the fenghao receives **one extra character** (ADDED after the original, or BEFORE it): 令 + 懿 → "ลิ่งอี้หวงกุ้ยเฟย" (令懿皇貴妃), or 嘉 + 令 → "เจียลิ่งหวงกุ้ยเฟย". Ranks 8 and 9 keep it ("ลิ่งอี้ฮองเฮา").
6. The Emperor may **strip** the fenghao (ริบฉายาคืน — automatic on demotion below rank 4, and after long disfavour) and later **re-bestow** a NEW one (ตั้งใหม่ — a different character, often humbler: 謹 慎 恪 誠 …).
7. Fenghao are unique among living concubines (NPCs + generated girls + the player). Reserved to NPCs: 舒 (Shu Fei), 怡 (Lu → "อี๋ผิน"), 嘉+懿 (the Niohuru Imperial Noble Consort → "เจียอี้หวงกุ้ยเฟย").

**Data (`Q.NAMING`, pools live in `js/data/n0*_*.js`, loaded as plain scripts — they only assign `Q.NAMING.*`, no events):**
```js
Q.NAMING.feng  = [ { id:'f_ling', zh:'令', th:'ลิ่ง', mean:'ประเสริฐ งดงาม เป็นแบบอย่างที่ดี', tags:['virtue','beauty'], w:8, hist:'令妃 เว่ยเจียสื่อ…', tone:'grand' }, … ];   // single characters
Q.NAMING.extra = [ { id:'x_yi', zh:'懿', th:'อี้', mean:'…', tags:['virtue'], pos:'suf'|'pre'|'any', w:8, hist:'令懿皇貴妃', good:['f_ling',…] }, … ];       // the one added character for rank ≥ 7
Q.NAMING.combos = [ { feng:'令', extra:'懿', pos:'suf', th:'ลิ่งอี้', who:'(historical or plausible holder)' }, … ];                               // optional showcase pairs (hist)
Q.NAMING.clans = [ { id:'c_niohuru', th:'หนิ่วฮู่ลู่', zh:'钮祜禄', kind:'manchu'|'mongol'|'hanjun'|'han', side:'civil'|'military'|'neutral', power:1..3, banner:'ธงขาวขลิบ', w:5, for:['noble'] }, … ];
Q.NAMING.girlNames = [ 'เหยาหรง', … ];     // extra given names for generated xiunü (Thai only)
```
Tag vocabulary (exactly): `virtue gentle beauty wisdom art harmony fortune loyal strong`. `tone` (optional): `grand` (suits high rank) · `soft` · `humble` (re-bestowal after disgrace). `w` = commonness 1..10. `th` readings MUST be unique across `feng` ∪ `extra` and must not equal a clan reading or an NPC name stem (ลู่ ซู ฉู่ เหมย จาง เซี่ย รุ่ย ฟู่ฉา เหวินเซี่ยน หนิ่วฮู่ลู่ ซูมู่ลู่ เซิ่น หลิน หลี่ หวัง เฉิน โจว เกา ท่งเจีย). Run `node tools/namelint.js` to check.

**State `st.N`**: `{ clan, clanZh, feng:id|null, extra:{id,pos}|null, stripped:bool, strippedAt, ever:n, changes:n, kind:''|'pin'|'early'|'extra'|'regrant'|'strip_demote'|'strip_cold', offer:[{id,pos?}], choose:bool, old:{th,zh}|null, lastT, hist:[{t,kind,th,zh,rank}], cold:n }`.
**Style API** `QL.nmStyle(st, rank?)` → `{ th, zh, clan, feng, mode:'name'|'clan'|'feng', rankTh, rankZh }`. UI shows `th` as the title and `zh` as the hanzi line.

**Placeholders in text** (`fill()`): `{{TITLE}}` current full style · `{{CLAN}}` · `{{FENG}}` current fenghao Thai (incl. extra) · `{{FENGZH}}` · `{{FENGMEAN}}` · `{{NMOLD}}` / `{{NMOLDZH}}` previous (stripped/replaced) fenghao · offers `{{NMH1..3}}` Thai reading of the NEW character · `{{NMZ1..3}}` hanzi · `{{NMM1..3}}` meaning · `{{NMT1..3}}` the full title it would produce (e.g. "ลิ่งอี้หวงกุ้ยเฟย") · `{{NMW1..3}}` a short Thai reason it suits the player (e.g. "เพราะท่านเปี่ยมคุณธรรม"). **Legacy auto-upgrade:** a rank word immediately before `{{PLAYER}}` ("กุ้ยเฟย{{PLAYER}}", "ฉังไจ้ {{PLAYER}}") is rendered as the proper style for THAT rank.
**Cond variable `N`**: `N.has` (fenghao held) · `N.kind` (the pending moment, see above) · `N.choose` (the Emperor lets the player choose among the offers) · `N.offers` (number of offers) · `N.stripped` · `N.ever` (bestowals so far) · `N.extra` (has the extra char) · `N.changes`.
**fx.name** (one object): `{ pick: 1..3 }` bestow offer n (default best) · `{ auto: true }` bestow offer 1 · `{ strip: true }` take the fenghao back (sets `N.old`) · `{ spare: true }` cancel a pending strip (strip_cold only) · plus optional `rep`/`note`. Bestowing triggers the engine's naming ceremony (big hanzi overlay) and tiny tag-based boons (prestige +2, a +2..3 to the stat the character stands for).
**Naming events**: `kind:'random'` (or 'chain'), `tags:['naming']`, `cond:` on `N.kind` (e.g. `"N.kind == 'pin'"`), `weight` 10, no cooldown needed (the engine fires one per moment). Season loop: `nmOnPromote` (rank 4 → kind 'pin'; rank 7 → 'extra'), `demote` below 4 → immediate strip + 'strip_demote' narration, season-end checks (`early` 1–3 at high favour, `strip_cold` at long disfavour, `regrant` after a strip) set `N.kind` + offers; `beginSeason` plays ONE `naming` event whose cond matches (no event → engine applies the default automatically). The event MUST apply `fx.name` on every path (or the engine applies the default when the event ends).
