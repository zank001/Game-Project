/* =============================================================
   00_sample.js — REFERENCE EXAMPLES of the event format (ids start with zz_).
   They also let the engine run before real content lands.
   >>> This file is deleted at integration time. Do not copy ids from it. <<<
   See docs/DESIGN.md for the full schema.
   ============================================================= */
Q.add([

  /* ---------- 1. a general random event: choices, cost, silver gate, stat check ---------- */
  {
    id: 'zz_rain_corridor', kind: 'random', title: 'ฝนในระเบียงยาว',
    minRank: 1, maxRank: 3, weight: 10, cooldown: 8,
    bg: 'corridor_rain',
    cast: [{ c: 'eunuch', pos: 'center', x: 'smile' }],
    start: 'n1',
    nodes: {
      n1: { who: 'narrator', text: 'ฝนปลายฤดูโปรยลงบนกระเบื้องเคลือบสีเหลือง {{PLAYER}} ยืนหลบอยู่ใต้ชายคาระเบียงยาว ไร้ร่มและไร้คนรับใช้' , next: 'n2' },
      n2: { who: 'eunuch', x: 'smile', text: 'นั่นนายหญิง{{RANK}}ใช่หรือไม่ขอรับ? ข้าน้อยเห็นท่านยืนตากความชื้นอยู่นาน ร่มคันนี้ข้าน้อยพอมีเหลือ', next: 'n3' },
      n3: { who: 'narrator', text: 'ขันทีผู้นี้คือ "จางฝู" คนที่ได้ยินว่ารู้ใจฮ่องเต้ที่สุด แต่ก็ว่ากันว่าปากหวานก้นเปรี้ยวที่สุดเหมือนกัน',
        choices: [
          { text: 'รับร่มไว้ แล้วส่งเงินน้ำชาเล็กน้อยตอบแทน', cost: { silver: 10 }, fx: { rel: { eunuch: 8 }, prestige: 1 }, next: 'n4a' },
          { text: 'ปฏิเสธอย่างสุภาพ — "ข้าไม่อยากรบกวนท่าน"', fx: { virtue: 1, threat: -1 }, next: 'n4b' },
          { text: 'ชวนคุยเรื่องฮ่องเต้อย่างแนบเนียน', check: { stat: 'wit', dc: 40, mods: [{ cond: 'R.eunuch >= 10', add: 10 }] }, win: 'n4c', lose: 'n4d' },
        ] },
      n4a: { who: 'eunuch', x: 'smile', text: 'ท่านใจกว้างจริงๆ ขอรับ วันหลังหากมีอะไรให้ข้าน้อยช่วย เพียงฝากคนมาบอกเท่านั้น', fx: { set: ['zz_eunuch_known'] }, next: 'nEnd' },
      n4b: { who: 'eunuch', x: 'neutral', text: 'ท่านระวังตัวอย่างนี้ก็ดีแล้วขอรับ ในวังนี้ ของฟรีมักแพงที่สุด', next: 'nEnd' },
      n4c: { who: 'eunuch', x: 'smirk', text: 'ท่านสนใจพระทัยฝ่าบาทหรือขอรับ? ... เมื่อวานนี้ ฝ่าบาททรงชมบทกวีเรื่องดอกเหมยกลางหิมะ ถึงสามครั้ง', fx: { wit: 1, note: 'ได้ข่าวว่าฮ่องเต้โปรดบทกวีดอกเหมยกลางหิมะ', set: ['zz_knows_emperor_taste'] }, next: 'nEnd' },
      n4d: { who: 'eunuch', x: 'surprised', text: 'ฮะๆ... ข้าน้อยเป็นเพียงคนหาบน้ำ ไม่กล้าพูดถึงพระทัยของฝ่าบาทหรอกขอรับ', fx: { prestige: -1 }, next: 'nEnd' },
      nEnd: { who: 'narrator', text: 'ฝนซาลงเมื่อพลบค่ำ แต่เรื่องที่ท่านได้ยินวันนี้ จะยังก้องอยู่ในหูอีกนาน' },
    },
  },

  /* ---------- 2. an action-draw event (tag: garden) with silent branch + weighted outcome ---------- */
  {
    id: 'zz_garden_plum', kind: 'random', tags: ['garden'], title: 'เหมยบานท่ามกลางหิมะ',
    minRank: 1, maxRank: 3, weight: 10, cooldown: 10, season: [3],
    bg: 'snow_court', cast: [{ c: 'emperor', pos: 'center', x: 'neutral' }],
    start: 'n1',
    nodes: {
      n1: { who: 'narrator', text: 'หิมะแรกของปีโปรยลงบนสวนหลวง ดอกเหมยแดงสะดุดตาท่ามกลางความขาว {{PLAYER}} เดินมาจนถึงศาลาเล็ก แล้วต้องชะงัก — มีชายในเสื้อคลุมสีเหลืองนั่งอยู่ก่อนแล้ว', next: 'n2' },
      n2: { who: 'emperor', x: 'neutral', text: 'เจ้าเป็นสนมของวังไหน? ทำไมถึงมาอยู่ที่นี่ในวันหนาวเช่นนี้',
        choices: [
          { text: 'คุกเข่าถวายบังคมอย่างนอบน้อม ไม่กล้าเอ่ยอะไรมาก', fx: { favor: 2, virtue: 1 }, next: 'n3a' },
          { text: 'ทูลตอบอย่างสุขุมว่า "หม่อมฉันมาชมเหมยเพคะ"', check: { stat: ['charm', 'talent'], dc: 45, mods: [{ cond: 'F.zz_knows_emperor_taste', add: 12 }] }, win: 'n3b', lose: 'n3c' },
        ] },
      n3a: { who: 'emperor', x: 'neutral', text: 'ลุกขึ้นเถิด. ไม่ต้องกลัว... กฎระเบียบเหล่านั้น เรารู้ดีกว่าเจ้า', fx: { set: ['met_emperor'] }, next: 'nEnd' },
      n3b: { who: 'emperor', x: 'smile', text: 'ชมเหมยหรือ? ... เจ้าลองแต่งสักบทให้เราฟัง ไม่ต้องกลัวผิด', fx: { favor: [6, 9], prestige: 1, set: ['met_emperor'], note: 'ฮ่องเต้ทรงจดจำท่านได้แล้ว' }, next: 'nEnd' },
      n3c: { who: 'emperor', x: 'neutral', text: 'ถ้อยคำก็ธรรมดา ... แต่ท่าทีของเจ้าไม่เลวนัก ไปได้แล้ว', fx: { favor: 2, set: ['met_emperor'] }, next: 'nEnd' },
      nEnd: { who: 'narrator', text: 'ท่านโค้งคำนับก่อนถอยออกมา หัวใจเต้นรัวจนต้องกำชายแขนเสื้อไว้แน่น' },
    },
  },

  /* ---------- 3. an attack event (tag: attack) using 'branch' on a flag ---------- */
  {
    id: 'zz_attack_tea', kind: 'random', tags: ['attack'], title: 'ชาถ้วยหนึ่ง',
    minRank: 1, maxRank: 8, weight: 10, cooldown: 10,
    bg: 'small_court', cast: [{ c: 'maid', pos: 'center', x: 'sad' }],
    start: 'n1',
    nodes: {
      n1: { who: 'maid', x: 'surprised', text: 'นายหญิงเจ้าคะ! ชุดชาที่ส่งมาจากตำหนักข้างๆ... บ่าวดมแล้วกลิ่นแปลกๆ เจ้าค่ะ', next: 'n2' },
      n2: { who: 'narrator', text: 'ชาที่ส่งมาด้วย "น้ำใจ" ในเวลาที่ไม่มีใครเอ่ยถึงท่านเลยสักคน — ไม่ใช่เรื่องน่ายินดีเสมอไป',
        choices: [
          { text: 'ให้ชุนเถานำไปตรวจกับหมอหลวงอย่างเงียบๆ', cost: { silver: 20 }, fx: { wit: 1 }, next: 'n3a' },
          { text: 'ลองจิบเล็กน้อย — อาจเป็นแค่ความระแวง', check: { stat: 'luck', dc: 50 }, win: 'n3b', lose: 'n3c' },
          { text: 'เทชาทิ้ง แล้วทำเหมือนไม่เคยรับ', fx: { threat: 2 }, next: 'n3d' },
        ] },
      n3a: { branch: [{ cond: 'R.doctor >= 20', next: 'n4doc' }, { next: 'n4plain' }] },
      n4doc: { who: 'doctor', text: 'ชานี้ผสมใบชาปลอมและยาถ่ายอ่อนๆ พระสนม... ผู้ใดไม่หวังดีต่อท่านอยู่แน่นอน', fx: { rel: { doctor: 4 }, threat: -3, set: ['zz_knows_tea_plot'] }, cast: [{ c: 'doctor', pos: 'center', x: 'neutral' }], next: 'nEnd' },
      n4plain: { who: 'maid', x: 'neutral', text: 'ผลออกมาแล้วเจ้าค่ะ — มียาถ่ายผสมอยู่ ไม่ถึงตาย แต่คงตั้งใจจะให้นายหญิงป่วยต่อหน้าผู้คน', fx: { threat: -2, set: ['zz_knows_tea_plot'] }, next: 'nEnd' },
      n3b: { who: 'narrator', text: 'รสชาติเป็นชาธรรมดา ท่านถอนใจโล่งอก — วันนี้ความระแวงของท่านเกินเหตุเสียแล้ว', fx: { wit: -1 }, next: 'nEnd' },
      n3c: { who: 'narrator', text: 'ไม่กี่เค่อต่อมา ท้องไส้ปั่นป่วนจนต้องนอนซม ... ชานั้นมีพิษอ่อนๆ จริง', fx: { health: -12, set: ['poisoned'] }, next: 'nEnd' },
      n3d: { who: 'maid', x: 'sad', text: 'นายหญิงไม่สอบสวนหรือเจ้าคะ? บ่าวกลัวว่าคนที่ทำจะยิ่งได้ใจ', next: 'nEnd' },
      nEnd: { who: 'narrator', text: 'ท่านตระหนักว่า วังหลังไม่มีวันไหนที่ปลอดภัยจริงๆ' },
    },
  },

  /* ---------- 4. a prologue CHAPTER (auto-starts at t==0): card, branch by origin, promote ---------- */
  {
    id: 'zz_prologue', kind: 'chapter', title: 'ก้าวแรกสู่วังต้องห้าม', prio: -100,
    minRank: 0, maxRank: 0, trigger: 't == 0 && rank == 0',
    bg: 'selection_hall', cast: [{ c: 'mama', pos: 'center', x: 'neutral' }],
    start: 'n0',
    nodes: {
      n0: { card: 'เฉิงผิง ปีที่ 1 · ฤดูใบไม้ผลิ', next: 'n1' },
      n1: { branch: [{ cond: "origin == 'maid'", next: 'n1m' }, { cond: "origin == 'scholar'", next: 'n1s' }, { next: 'n1n' }] },
      n1n: { who: 'mama', x: 'neutral', text: 'ธิดาตระกูลกวาเอ่อร์เจียหรือ? ตระกูลดีย่อมมีสายตาจับจ้อง จำไว้ว่า "สง่า" ไม่ใช่ "เย่อหยิ่ง"', next: 'n2' },
      n1s: { who: 'mama', x: 'neutral', text: 'ธิดาแห่งสำนักฮั่นหลิน... ตำรามากมายไม่ช่วยให้รอดในวังนี้ แต่ถ้ารู้จักใช้ มันคือดาบเล่มหนึ่ง', next: 'n2' },
      n1m: { who: 'mama', x: 'smirk', text: 'เจ้าเด็กโรงซักผ้า... วันนี้เจ้าถูกเรียกมาเพราะฮ่องเต้ทอดพระเนตรชุดที่เจ้าซักเมื่อวาน ไม่ใช่เพราะเจ้าโชคดี', next: 'n2' },
      n2: { who: 'player', text: '(ตั้งแต่วันนี้ไป ชีวิตของข้าไม่ใช่ของข้าอีกต่อไป... แต่สักวัน ข้าจะทำให้มันเป็นของข้าอีกครั้ง)', next: 'n3' },
      n3: { who: 'mama', x: 'neutral', text: 'ราชโองการมาถึงแล้ว — {{PLAYER}} ได้รับพระราชทานตำแหน่ง "ต่าอิง" จงจดจำวันนี้ให้ดี', fx: { set: ['zz_prologue_done'] }, promote: true, next: 'n4' },
      n4: { who: 'narrator', text: 'เส้นทางไต่เต้าของท่าน เริ่มต้นขึ้นแล้ว' },
    },
  },

  /* ---------- 5. a promo-style chapter used to show the ceremony ---------- */
  {
    id: 'zz_promo_sample', kind: 'chapter', title: 'ราชโองการเลื่อนขั้น (ตัวอย่าง)', prio: -100,
    minRank: 1, maxRank: 1, trigger: 'rank == 1 && sir >= 2',
    bg: 'study', cast: [{ c: 'emperor', pos: 'center', x: 'smile' }],
    start: 'n1',
    nodes: {
      n1: { who: 'emperor', x: 'smile', text: 'เจ้าอดทนมาได้ถึงวันนี้ ... เราจะเลื่อนขั้นให้เจ้าเป็น "ฉังไจ้"', promote: true, next: 'n2' },
      n2: { who: 'player', text: 'หม่อมฉัน... ขอบพระทัยเพคะ', next: 'n3' },
      n3: { who: 'narrator', text: 'ในวังหลังมีคนหนึ่งใหม่ที่ถูกเขียนชื่อลงทะเบียนอีกครั้ง — และมีคนหลายคนที่ไม่ยินดีกับเรื่องนี้' },
    },
  },

]);
