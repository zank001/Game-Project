# STORY BIBLE — ลิขิตหงส์ · วังหลังต้าชิง (Phoenix Ascent: The Qing Inner Court)

You are one writer/artist/engineer on a team building a Thai-language strategy + visual-novel game about
climbing the ranks of the Qing inner court (วังหลัง) from the very bottom to the very top.
**Everything the player reads is in Thai.** This bible is the shared truth. Do not contradict it.
Read `docs/DESIGN.md` (technical contract) too.

## 1. Premise & tone
- Player = a young woman (name typed by the player, default "หลันซี"), age 16 at start, entering the Forbidden City
  (วังต้องห้าม / จื่อจินเฉิง) during the 1st year of the fictional reign **เฉิงผิง (承平)** of the Great Qing (ต้าชิง).
- The ladder (rank index → title): `0 นางกำนัล/ผู้เข้าคัดเลือก → 1 ต้าอิ้ง → 2 ฉังไจ้ → 3 กุ้ยเหริน → 4 ผิน → 5 เฟย → 6 กุ้ยเฟย → 7 หวงกุ้ยเฟย → 8 ฮองเฮา → 9 ไทเฮา`.
  Rank 9 (Empress Dowager) is the summit and ends the game with a "true" ending.
- Time: 1 turn = 1 season (4 per year). A full climb ≈ 70–100 seasons (≈ 18–25 years). Player ages 16 → ~40.
- Tone: elegant, melancholic, quietly menacing — a *palace drama* (cf. Zhen Huan / Story of Yanxi Palace / Ruyi's Royal Love),
  not a comedy. Beautiful imagery (silk, plum blossom, incense, lanterns, snow), cutting dialogue with double meanings,
  small kindnesses that matter, choices that cost something. Moral grey: gentle paths and ruthless paths are both viable and both pay a price.
- Rating: PG-13. Romance is implied/tender; intimacy fades to black ("คืนนั้น…"). Violence is never gory. No slurs. No real historical persons —
  the reign, emperor and all clans are fictional (clan names are real Manchu clan names used generically).
- Theme: *power costs you the people who made you human; but a woman who keeps even one thing she refuses to sell can still wear the phoenix crown with her head high.*

## 2. World facts (use consistently)
- **วังหลัง (inner court)**: the Emperor's consorts live in palaces in the Forbidden City's rear. Daily order is kept by the Empress.
- Consorts are summoned when the Emperor "flips a green tablet" (พลิกป้ายชื่อเขียว). Low ranks rarely get summoned; gaining his notice is the first great obstacle.
- **Eunuchs** (ขันที) run errands, gossip and sell access. **Court ladies** (นางกำนัล) serve. **Imperial physicians** (หมอหลวง, สำนักแพทย์หลวง) hold life and death.
- **Interrogation Hall (ศาลสอบสวนวังหลัง, ฉินสิงซื่อ)** — where accused servants are beaten for confessions.
- **Cold Palace (ตำหนักเย็น)** — where fallen consorts rot.
- **Phoenix Seal (ตราหงส์)** — the Empress's seal of authority over the inner court; delegating it to a consort is a huge sign of trust.
- Currency: silver **ตำลึง**. Titles of address: ฮ่องเต้ (Emperor, address "ฝ่าบาท"), ฮองเฮา (Empress), ไทเฮา (Empress Dowager), หวงกุ้ยเฟย / กุ้ยเฟย / เฟย / ผิน / กุ้ยเหริน / ฉังไจ้ / ต้าอิ้ง.
- Buildings: ตำหนักหย่งโซ่ว (Yongshou — where low-rank consorts live; player's first home), ตำหนักขุนหนิง (Kunning — Empress), ตำหนักฉือหนิง (Cining — Dowager),
  ห้องทรงพระอักษรหยางซิน (Yangxin Study — Emperor's working room), สวนหลวง (Imperial Garden), สำนักแพทย์หลวง (Imperial Hospital), โรงซักผ้าหลวง (Laundry Bureau, where maids toil), พระที่นั่งไท่เหอ (Taihe Hall — throne hall).
- Seasons/festivals: spring flower-viewing banquet (ชมบุปผา), summer Dragon Boat (ตวนอู่), autumn Mid-Autumn (จงชิว), winter New Year (ตรุษ) & the Emperor's birthday. (Owned by unit c11.)

## 3. Politics at the start of the game (year 1)
- **Emperor เฉิงผิง** is 27. Mistrusts strong clans, craves sincerity, loves poetry and the guqin, suffers headaches, and is lonely.
- **Empress ฟู่ฉา** (clan Fuca — civil officials; father is a Grand Secretary) — age 30, composed and gracious in public, steel in private. Has a daughter but **no son** → deep anxiety.
- **Dowager เหวินเซี่ยน** (clan Niohuru) — Emperor's mother, ~52, devout, sharp. Tilts toward her own clan's niece, the Imperial Noble Consort.
- **Imperial Noble Consort หนิ่วฮู่ลู่ อวี้หลาน** (clan Niohuru — military; father is a Grand General commanding the western army) — age 28, rank 7. Mother of the eldest prince (age 8). Imperious, jealous of Empress. She is the *wall* between the player and the top.
- The Emperor balances **Fuca (civil)** vs **Niohuru (military)**. The player, rising from nowhere, is a pawn that becomes a queen — a third force.
- Gatekeepers per rank (who is "just above" the player): rank1–2 ⇒ **Chu Guiren**; rank3–4 ⇒ Chu & **Lu Pin**; rank5 ⇒ **Shu Fei** (neutral) & Lu; rank6 ⇒ **Imperial Noble Consort**; rank7 ⇒ **Empress**; rank8 ⇒ the succession itself.

## 4. Cast (ids = `Q.CHARS` keys). Voice samples are Thai.
| id | Name | Rank/Role | Age(y1) | Personality & voice |
|---|---|---|---|---|
| `player` | {{PLAYER}} | the heroine | 16 | clever, observant, restrained; inner monologue in parentheses `( … )`. Calls superiors "หม่อมฉัน" (ตัวข้าพเจ้า), equals "ข้า". |
| `emperor` | ฮ่องเต้เฉิงผิง | Emperor | 27 | terse, formal, melancholy, dry wit; self-reference **"เรา"**; calls player by name once favored ("{{PLAYER}}"), earlier "เจ้า". e.g. "ลุกขึ้นเถิด. ไม่ต้องกลัว… กฎระเบียบเหล่านั้น เรารู้ดีกว่าเจ้า" |
| `empress` | ฮองเฮาฟู่ฉา (ชิงเหยียน) | rank 8 | 30 | gentle voice, immaculate manners, calls concubines "น้องสาว", self "ข้า" / "ฮองเฮาผู้นี้". e.g. "น้องสาวเพิ่งเข้าวัง ย่อมไม่รู้ว่าความเมตตาในที่นี้ ต้องมีราคา" |
| `dowager` | ไทเฮาเหวินเซี่ยน | Empress Dowager | 52 | slow, proverb-laden, Buddhist; calls player "เด็กน้อย"/"{{PLAYER}}"; self "ข้า". e.g. "ดอกไม้ที่บานเร็ว ร่วงก่อนเสมอ เด็กน้อย" |
| `consort` | เจียอี้หวงกุ้ยเฟย (อวี้หลาน) | rank 7 | 28 | imperious, short sentences, cutting; self "ข้า"; "ตำแหน่งนี้ไม่ใช่ของเจ้า". |
| `chu` | ฉู่กุ้ยเหริน (ซือหรง) | rank 3 | 22 | shrill, sarcastic, vain; Niohuru's lackey; first villain. "นังเด็กใหม่" "สกุลต่ำ". |
| `lu` | อี๋ผิน (เสวี่ยหนิง) | rank 4 | 24 | honeyed, soft laugh, double meanings, calls player "น้องสาวที่รัก". **Secretly the Empress's spy**; the false friend. |
| `shu` | ซูเฟย (หวั่นหรง) | rank 5 | 26 | quiet, chess-playing, neutral; says little, every word measured. Quietly sympathetic; ally of convenience later. |
| `friend` | เหมยชิง | player's best friend | 15 | warm, teasing, loyal, a bit clumsy; Han girl of modest family who enters the palace in the same batch/at the same time. Calls player "พี่หญิง"; player calls her "เหมยชิง"/"น้องเหมย". |
| `maid` | ชุนเถา | player's personal maid | 16 | brave, practical, simple affectionate speech; "นายหญิง", self "บ่าว", ends sentences "เจ้าค่ะ". |
| `eunuch` | ขันทีจางฝู | Emperor's attendant | 40 | slick, nasal, flattering, knows everything, sells information; "ขอรับ", self "ข้าน้อย". Loyal only to the Emperor. |
| `doctor` | หมอหลวงเซี่ย จิ่งหราน | imperial physician | 26 | gentle, precise, formal, medicine metaphors; self "กระหม่อม" to royals, "ข้าพเจ้า" privately. Potential forbidden romance (`love_doctor`). |
| `prince` | อ๋องรุ่ย (อวี้เฉิน) | Emperor's half-brother | 25 | poetic, amused, dangerous eyes; controls a banner army; self "ข้า". Potential forbidden romance (`love_prince`) or kingmaker/usurper. |
| `mama` | ป้าฉิน (ฉินมามา) | senior court lady | 55 | stern, drilled, wry; teaches palace rules; "คุณหนู"/"เด็กน้อย". Tutor for noble/scholar; for maid-origin she is the laundry bureau's head matron who becomes a harsh-but-fair mentor. |
| `child` | องค์ชายน้อย (heir) | player's son (own or adopted) | — | child's voice, appears in rank 5+ scenes; name stored in `F.heir_name` (own son: "หย่งหลิน"; adopted: "หมิงเซวียน"). |

### Backstories per origin (used in prologue and as flavor)
- `noble` ธิดาขุนนางแมนจู สกุลกวาเอ่อร์เจีย (father a banner colonel). Starts proud and rich; arrogance and family enemies are her flaw. `F.family_backing` unlocks occasional silver gifts / political support events.
- `scholar` ธิดานักปราชญ์ฮั่น สกุลเซิ่น (father a Hanlin scholar). Poetry and wit are her weapons; money is thin; the Manchu ladies look down on her.
- `maid` นางกำนัลชั้นต่ำ — an orphan in the Laundry Bureau. She begins at rank 0 and plays a few seasons at the very bottom; the prologue ends when she is noticed and raised to ต้าอิ้ง. Her special reward: a unique epilogue line in true endings ("from the laundry to the phoenix throne").
- For ALL origins: เหมยชิง exists (friend) and ชุนเถา becomes the player's maid when she reaches rank 1 (for maid-origin, Chuntao is a younger girl from the laundry who attaches herself to the player).

### Naming conventions (พระนาม · ฉายา) — see DESIGN §12 and docs/NAMING.md
- Below ผิน a consort is "สกุล + ยศ" (เซิ่น ฉังไจ้ · กวาเอ่อร์เจีย กุ้ยเหริน · หนิ่วฮู่ลู่ …). From ผิน she wears a one-character **ฉายา** (封號) given by the Emperor: "อี๋ผิน" (怡), "ซูเฟย" (舒). From หวงกุ้ยเฟย the fenghao gains one extra character: the Niohuru consort is **เจียอี้หวงกุ้ยเฟย** (嘉懿皇貴妃, clan หนิ่วฮู่ลู่ — the clan name stays the name of her FACTION: "ตระกูล/ตำหนักหนิ่วฮู่ลู่").
- NPC names: Lu is **อี๋ผิน** (clan Lu, given name เสวี่ยหนิง); Chu is "ฉู่กุ้ยเหริน" (clan + rank, below ผิน); Empress "ฮองเฮาฟู่ฉา" and Dowager "ไทเฮาเหวินเซี่ยน" keep clan/posthumous style by court custom.
- The player: `{{TITLE}}` is her current styled address, `{{CLAN}}` her clan, `{{FENG}}` her fenghao. Servants address her by RANK ("ท่านต้าอิ้ง", "นายหญิง"), the Emperor by title or fenghao, rivals by clan + rank while she is below ผิน.

## 5. Arc outline by rank (what the story IS)
Each rank N (1–8) has an **arc** (2–3 chained chapters, ending by setting `F.arcN_done`) and a **promotion event** `promo_N_(N+1)` (the ceremony + a final twist) fired automatically once the gate is met.
Rank 0 → 1 is the **prologue** (unit c01). Authors may *show* flavor, but the **decisions** in an arc belong to the unit that owns it.

0. **Prologue (c01)** — Great Selection (noble/scholar) or laundry-yard drudgery (maid). Meet Mama Qin, Meixing, Chuntao, glimpse Chu Guiren's cruelty, learn the rules (tablets, bribes, seasons). Ends with promotion to ต้าอิ้ง (noble/scholar: same season; maid: after ~2 seasons when the Emperor notices her).
1. **ต้าอิ้ง (c02) — "ดอกเหมยใต้หิมะ"**: scarcity (coal, food), Chu Guiren's bullying, the first glimpses of the Emperor. Arc1: *the stolen coal / winter humiliation* → the night the Emperor hears her music or poem in the snow-garden → noticed. Sets `met_emperor`. Promo 1→2: ฉังไจ้; Empress sends a "test" gift; Chu seethes.
2. **ฉังไจ้ (c03) — "คนใกล้ตัว"**: Lu Pin befriends the player (`lu_trusted` set true here — she seems wonderful). Chu schemes; Chuntao is framed for theft → choices on how to defend her. Arc2 ends with the player's first real political win or loss. Promo 2→3: กุ้ยเหริน after nursing the Emperor's headache / embroidering a sutra for the Dowager.
3. **กุ้ยเหริน (c04) — "คดีผ้าพิษ"** (first big trial): Chu poisons the Dowager's robe/incense and frames the player through Chuntao; Interrogation Hall; **Chuntao's fate** (owner: c04 — `maid_alive` stays true or is cleared); **Dr. Xie introduced** (`met_doctor`); **Chu's downfall** (`chu_down`) or a bitter compromise. Promo 3→4: ผิน — first own hall, honorific title, Dowager's approval.
4. **ผิน (c05) — "ครรภ์มังกร"**: first meeting with Prince Rui at a poetry gathering (`met_prince`); pregnancy arc: attempts on the unborn child; **Lu Pin's betrayal exposed** (`lu_exposed`); outcome: son born (`heir_own`, `has_heir`, `heir_name:'หย่งหลิน'`), or loss (`lost_child`), or (rare, low health + bad luck) `end_childbirth_death`. Promo 4→5: เฟย.
5. **เฟย (c06) — "ศึกชายแดนและตระกูล"**: western war led by Niohuru's father; player's family fortunes (`family_safe` or `family_fallen`); **Meixing's fate** (owner: c06 — `friend_alive` may be cleared; Empress tries to turn her); if the player has no heir, the **adoption** chapter (`heir_adopted`, `has_heir`, `heir_name:'หมิงเซวียน'`) — the player may refuse. Promo 5→6: กุ้ยเฟย — the Emperor lets her share the Phoenix Seal while the Empress is ill.
6. **กุ้ยเฟย (c07) — "ตราหงส์"**: duel with the Imperial Noble Consort over the Phoenix Seal; Niohuru Sr.'s corruption evidence; Prince Rui's offers. Outcome: `niohuru_down` (ruthless/clever win; her father disgraced, she confined) or `niohuru_ally` (gentle accommodation). Promo 6→7: หวงกุ้ยเฟย.
7. **หวงกุ้ยเฟย (c08) — "ความลับของฮองเฮา"**: evidence that Empress Fuca caused earlier tragedies (a dead consort, the player's own harm, Lu Pin's orders). Choices: expose / blackmail / bargain. Outcome: `empress_down` (deposed → player is first in line) or `empress_controlled` (Empress remains but beholden). Promo 7→8: ฮองเฮา (grand coronation of the Empress; Dowager's blessing). If `empress_controlled`, the Empress "retires to the Buddha hall" so the throne is vacated peacefully.
8. **ฮองเฮา (c09) — "ลิขิตหงส์" (finale)**: sets `F.finale` at its first chapter (engine then suppresses all random/festival/attack events). The Emperor's health fails (cinnabar elixirs + a poison hidden in his tonic). A sealed will (遗诏). Prince Rui's ambition vs. the heir's claim vs. the Dowager's judgment. 4–6 chained chapters over several seasons (use `queue` with `in:0/1`). The ending depends on virtue/wit/prestige/allies/heir:
   - `end_taihou_gentle` (true; virtue-high, heir crowned, wise & beloved),
   - `end_taihou_regent` (true; ruthless/politically dominant, rules from behind the curtain),
   - `end_taihou_lonely` (true-but-bitter; won everything, lost all who loved you),
   - plus more (c09 may add `end_taihou_prince_*`, `end_taihou_maid` etc.). `end_prince_throne` (bad/neutral; Prince Rui takes the throne) is owned by c10 but triggered from c09.
   - Promo 8→9 (the new Emperor's accession & the title **ไทเฮา**) must call `promote:true` and then lead into the ending event.
- **Cross-cutting companion arcs (c12)** — Meixing, Chuntao, Dr. Xie, Prince Rui, Zhang Fu, the Dowager. They must read the *owner-decided* flags (`maid_alive`, `friend_alive`, `met_doctor`, `met_prince`, `love_doctor`, `love_prince`, `lu_exposed` …) and **never** decide those flags' final state themselves except where this bible says (see §6).

## 6. Global flag registry (owner = the only unit that SETS/CLEARS it; anyone may READ)
| flag | meaning | owner |
|---|---|---|
| `origin_noble/scholar/maid`, `family_backing` | origin | engine (auto) |
| `friend_alive` (init true) | Meixing lives | **c06** clears it (fate), c12 never clears |
| `maid_alive` (init true) | Chuntao lives | **c04** clears it (fate) |
| `chu_alive` (init true), `chu_down` | Chu Guiren is alive / defeated | **c04** |
| `lu_trusted` | Lu Pin seems a friend | **c03** sets; **c05** may clear |
| `lu_exposed` | Lu's betrayal revealed | **c05** |
| `met_emperor` | has spoken with the Emperor | c01, c02 (also ga_/vi_ may set) |
| `met_doctor` | knows Dr. Xie | **c04** |
| `met_prince` | knows Prince Rui | **c05** |
| `has_heir`, `heir_own`, `heir_adopted`, `heir_name` (string), `lost_child` | heir state | **c05** (own), **c06** (adopted) |
| `poisoned` | currently poisoned (drains health each season; may fade) | any unit may SET (attacks etc.), doctor events/antidotes CLEAR via `unset` |
| `love_doctor`, `love_prince` | romance locked in | **c12** |
| `family_safe` / `family_fallen` | player's family fate | **c06** |
| `niohuru_down` / `niohuru_ally` | outcome of arc6 | **c07** |
| `empress_down` / `empress_controlled` | outcome of arc7 | **c08** |
| `finale` | succession crisis running | **c09** |
| `emperor_dead`, `dowager_dead` | deaths | **c09** only |
| `arc1_done … arc8_done` | arc N finished (on **every** non-fatal path!) | unit of rank N |
| `arc1_win … arc8_win` | arc N went well | unit of rank N |
| `rank1 … rank9` | player has reached that rank | engine (auto) |

Unit-private flags: prefix with the unit prefix (see §8), e.g. `r3_chuntao_blamed`, `cp_friend_gift`. Never read another unit's private flag.
**Rule:** progress must never depend on a random event. Arc chapters trigger from `rank`, `sir` (seasons in rank), stats and *guaranteed* flags only. Random events may only add flavor or small side-bonuses.

## 7. Thai writing style guide
- Register: literary but readable Thai, period-drama flavor ("ราชาศัพท์" only where natural). No modern slang, no English words in dialogue.
- Address terms: servants say **"นายหญิง"** to the player (ranks 1–4), then **"องค์{{RANK}}"** / "ท่าน{{RANK}}" is allowed (e.g. "ท่านเฟย") at ranks 5+; to the Emperor say **"ฝ่าบาท"**, to the Empress **"ฮองเฮา"/"พระนาง"**, to the Dowager **"ไทเฮา"**.
  Player to Emperor: self "หม่อมฉัน", ends "เพคะ". Player to Empress/Dowager: "หม่อมฉัน … เพคะ". Player to equals: "ข้า". Maids: "บ่าว … เจ้าค่ะ". Eunuchs: "ข้าน้อย … ขอรับ". Emperor: "เรา". Doctor to royals: "กระหม่อม".
- Narration (who:'narrator') is second/third-person present-feel: refer to the player as **"ท่าน"** (e.g. "ท่านกำชายแขนเสื้อไว้แน่น") or by `{{PLAYER}}`. Be consistent inside one event. Inner thoughts: `who:'player'` with text in parentheses.
- Each dialogue node ≤ ~170 Thai characters (hard limit 320). Prefer 2–3 short beats over one wall of text. Use ellipsis "…" and dash "—" sparingly.
- Show, don't tell: sensory details (incense, silk rustle, cold tile, lantern glow) in 1 of every 3–4 nodes.
- Dialogue must carry subtext: nobody says "I hate you"; they offer tea.
- Choices: 2–4 per choice node, ≤ 60 chars each, written as the *player's action* ("ก้มศีรษะรับคำสั่งโดยไม่โต้แย้ง"). They must have genuinely different consequences. Mark risky ones with `check` and give strong ones `cost`.
- Placeholders: `{{PLAYER}}` (given name), `{{RANK}}` (current title, e.g. "กุ้ยเหริน"), `{{HEIR}}` (heir's name, default "องค์ชาย"), `{{YEAR}}`, `{{SEASON}}`.
- Avoid repeating the same opening image across events (plum blossom / tea / rain are overused — vary: embroidery silk, sutra paper, lanterns, jade bracelets, chess stones, ink stick, brazier charcoal, bird cage, carp pond, cold porcelain…).
- Cultural vocabulary: ตำหนัก, ขันที, นางกำนัล, ราชโองการ, ป้ายชื่อเขียว, ตราหงส์, หอกุศล, ธูป, กู่ฉิน, หมากล้อม, เครื่องประดับผม (ปิ่น/ปิ่นปักผมหงส์/ฉีโถว), ผ้าไหมเซวียน, ถ่านเงิน, น้ำแกงโสม, พระสูตร, ตำลึงเงิน.

## 8. Unit assignments (one agent each; one file-prefix each; own only your files)
| unit | files you own | id prefix | flag prefix | deliver |
|---|---|---|---|---|
| **c01 prologue** | `js/data/c01_*.js` | `p_` | `p_` | 3 origin prologues (each 2–3 chained chapters via `jump`; first chapter of each triggers on `t == 0 && rank == 0 && origin == '…'`; last promotes rank 0→1 at t=0 for noble/scholar); for **maid** origin: ≥4 rank-0 general random events (`minRank:0,maxRank:0`, cond `origin == 'maid'`) + ≥5 rank-0 `befriend`-tagged events (cond `origin == 'maid'`) + chapter `p_maid_noticed` (trigger `rank == 0 && origin == 'maid' && sir >= 2`, promotes to rank 1). Also ≥6 rank-1 *tutorial-flavor* events (`once`, rank 1) teaching tablets/bribes/seasons/AP via story. Total ≥ 26 events |
| **c02 rank1** | `js/data/c02_*.js` | `r1_` | `r1_` | arc1 (2–3 chapters; sets `arc1_done`) + `promo_1_2` + ≥ 12 general random rank-1 events (+ a few rank 1–2) |
| **c03 rank2** | `c03_*.js` | `r2_` | `r2_` | arc2 + `promo_2_3` + ≥ 12 general random rank-2 (sets `lu_trusted`) |
| **c04 rank3** | `c04_*.js` | `r3_` | `r3_` | arc3 (trial; 3 chapters) + `promo_3_4` + ≥ 12 general random rank-3 |
| **c05 rank4** | `c05_*.js` | `r4_` | `r4_` | arc4 (pregnancy; 3 chapters) + `promo_4_5` + ≥ 12 general random rank-4 |
| **c06 rank5** | `c06_*.js` | `r5_` | `r5_` | arc5 (war/family/Meixing/adoption; 3 chapters) + `promo_5_6` + ≥ 12 general random rank-5 |
| **c07 rank6** | `c07_*.js` | `r6_` | `r6_` | arc6 (Phoenix Seal; 3 chapters) + `promo_6_7` + ≥ 12 general random rank-6 |
| **c08 rank7** | `c08_*.js` | `r7_` | `r7_` | arc7 (Empress's secret; 3 chapters) + `promo_7_8` + ≥ 12 general random rank-7 |
| **c09 finale** | `c09_*.js` | `r8_` | `r8_` | ≥ 10 general random rank-8 events (before the finale) + arc8 finale (4–6 chapters, sets `finale`, `arc8_done`) + `promo_8_9` + endings `end_taihou_gentle`, `end_taihou_regent`, `end_taihou_lonely` + ≥ 2 more taihou variants. **Replace the stub file.** |
| **c10 endings** | `c10_*.js` | `end_` | `en_` | every ending in `Q.ENDINGS_REQUIRED` except `end_taihou_*` (system endings: `end_death_illness`, `end_death_poison`, `end_cold_palace`, `end_twilight` (branch on `rank` for variants), `end_executed`, `end_exile_nunnery`, `end_childbirth_death`, `end_suicide_honor`, `end_retire_peace`, `end_love_doctor`, `end_love_prince`, `end_prince_throne`, `end_maid_forgotten`) + ≥ 6 extra endings of your own design (prefix `end_x_`). Each ending is a short cinematic (5–12 nodes) with a moving last line. **Replace the stub file.** |
| **c11 festivals** | `c11_*.js` | `fs_` | `fs_` | **festival** events (kind `festival`, `season:[n]`): for each of the 4 seasons ≥ 4 variants for rank bands 1–2, 3–4, 5–6, 7–8 (16+). Plus ≥ 12 *seasonal-life* general random events spread over ranks 1–8 (weather, seasonal food, illness, gossip) |
| **c12 companions** | `c12_*.js` | `cp_` | `cp_` | general-pool events (`kind:'random'`, no tags unless needed) driven by relationship flags/values: Meixing ≥ 7, Chuntao ≥ 5, Dr. Xie ≥ 6 (incl. `love_doctor` path), Prince Rui ≥ 6 (incl. `love_prince` path), Zhang Fu ≥ 3, Dowager ≥ 4 — each guarded by the right `F.*` / `R.*` conds so they respect fates decided elsewhere. ≥ 31 events |
| **c13 garden+befriend** | `c13_*.js` | `ga_` | `ga_` | tag `garden` ≥ 12 (ranks 1–8, incl. chance meetings with the Emperor, Prince Rui, rivals) + tag `befriend` ≥ 12 (ranks 1–8) |
| **c14 emperor+dowager** | `c14_*.js` | `vi_` | `vi_` | tag `visit_emperor` ≥ 14 (ranks 2–8, tea/soup/music/poetry/chess/medicine; Emperor's moods; rejections and rewards) + tag `visit_dowager` ≥ 8 (ranks 2–8) — guard dowager events with `!F.dowager_dead` |
| **c15 empress+bribe+palace** | `c15_*.js` | `ev_` | `ev_` | tag `visit_empress` ≥ 10 (ranks 1–8) + tag `bribe` ≥ 8 (ranks 1–8) + tag `palace_affairs` ≥ 8 (ranks 5–8) |
| **c16 investigate+scheme+family** | `c16_*.js` | `in_` | `in_` | tag `investigate` ≥ 10 (ranks 1–8) + tag `scheme` ≥ 10 (ranks 2–8) + tag `family` ≥ 8 (ranks 3–8) |
| **c17 attacks** | `c17_*.js` | `at_` | `at_` | tag `attack` ≥ 18 across ranks 1–8 (poison, framing, slander, sabotage, accidents, threats to maid/friend/child, failed-search of the palace). Damage must scale with rank and be mitigable by wit, allies (`R.doctor`, `R.eunuch`, `R.maid`), silver, or foresight flags. At least 3 per rank band |

Rank-banded availability is defined by `minRank`/`maxRank`. Every tag pool needs **≥ 2 events at every rank in its range** (validate `--all` prints a coverage matrix) — a single event may span several ranks (`minRank:3,maxRank:5`) when its content works for all of them.

## 9. Content quality bar (what "good" looks like)
1. Every event is a *scene with a decision*, not a stat dump. Include at least one meaningful choice node (random events: 1–2 choice nodes; chapters/promos: 2–4).
2. Consequences read in the fiction: the next line must acknowledge what the player chose.
3. Every choice either changes something real (fx / flags / branch) or reveals character. No "dummy" choices that lead to identical text.
4. Reward variety: not everything is `favor`. Use `prestige`, `wit`, `virtue`, `rel`, `silver`, `threat`, flags, queued follow-ups (`queue`) to make events echo later.
5. Dangerous/failed outcomes exist but are *telegraphed* (hint text or a visible `check` chance) and rarely instantly fatal (only `health ≤ 0` or an explicit `ending` node).
6. Keep each random draw event to ~5–10 nodes; chapters 10–25 nodes. Short, vivid, re-readable.
7. Respect the Bible's voices. The Emperor never begs; Chu never apologizes sincerely; Lu never raises her voice; the Dowager never hurries.
