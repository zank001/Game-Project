/* n04_extra.js — Q.NAMING.extra (the ONE extra character a fenghao gains from rank 7 หวงกุ้ยเฟย up) + Q.NAMING.combos (showcase pairs).
   Docs: docs/DESIGN.md §12. Only assigns Q.NAMING.extra / Q.NAMING.combos (no events).
   Model: real Qing 皇貴妃 titles were the original fenghao + ONE added character, mostly AFTER it
          (純→純惠, 慧→慧賢 after; 嘉→淑嘉, 敏→敬敏, 令→令懿 with the extra IN FRONT or after; 端康 and 敦肅 are whole new two-character 皇貴妃 titles, and 溫僖 was a 貴妃), sometimes in FRONT (淑+嘉 → 淑嘉, 崇慶, 康慈, 隆恩-style honorifics).
   pos 'suf' = only after the fenghao · 'pre' = only before it · 'any' = either.
   Deliberately ABSENT from the player pool:
     - 嘉 懿 舒 怡          reserved to NPCs (เจียอี้หวงกุ้ยเฟย · ซูเฟย · อี๋ผิน) — so the real 令懿 / 淑嘉 pairs live only in `hist` text, never in combos
     - 憲                   its reading เซี่ยน would turn 溫+憲 into the Dowager's own name 溫憲 (ไทเฮาเหวินเซี่ยน)
     - 悼 愍 憫 哀           sad characters (real titles used some; the game does not hand them out in life)
     - 和 毅 成 禧 祥 福 宜 裕 儀 欽 睿 彰 章 平 永   readings would collide with a clan / NPC / reign name / another pool hanzi
                            (和=เหอ clan 何 · 毅 義 懿=อี้ · 成=เฉิง (誠 stays: it is a real fenghao, in both pools) · 禧 熙 僖=ซี · 宜 怡 儀=อี๋ · 欽 勤=ชิน · 睿=รุ่ย · 章 彰=จาง · 平=ผิง of เฉิงผิง · 永=หย่งโซ่ว)
   Every hanzi that also lives in the fenghao pool (n01/n02) copies that unit's Thai reading exactly (lint: same hanzi ⇒ same reading).
   Readings new to the project: 隆 หลง · 元 หยวน · 哲 เจ๋อ · 康 คัง · 安 อัน · 寧 หนิง · 壽 โซ่ว · 慶 ชิ่ง.
   hist = only facts I am confident of (a real Qing title that used that exact character). Left out whenever unsure.
   good = fenghao ids (from n01/n02) that form a natural Chinese word / real pairing with this extra, in the order the extra's pos implies. */

/* ======================================================================= extra */
Q.NAMING.extra.push(
  // ---------------------------------------------------------------- pre (leading honorifics)
  { id: 'x_chong', zh: '崇', th: 'ฉง', mean: 'สูงส่งน่าเคารพบูชา ได้รับการยกย่องเหนือผู้อื่น', tags: ['virtue', 'strong'], pos: 'pre', w: 4, tone: 'grand',
    hist: '崇慶皇太后 คือพระสมัญญาของพระมารดาเฉียนหลง (ต่อมาคือ 孝聖憲皇后) ขณะยังทรงพระชนม์',
    good: ['f_de', 'f_ren', 'f_jing'] },
  { id: 'x_long', zh: '隆', th: 'หลง', mean: 'รุ่งเรืองยิ่งใหญ่ พระกรุณาธิคุณล้นเหลือ', tags: ['fortune', 'strong'], pos: 'pre', w: 4, tone: 'grand',
    hist: '隆裕皇太后 ฮองเฮาของกวงซวี่ ไทเฮาองค์สุดท้ายแห่งราชวงศ์ชิง',
    good: ['f_en', 'f_de', 'f_rong'] },
  { id: 'x_ci', zh: '慈', th: 'ฉือ', mean: 'เมตตากรุณาดุจมารดา', tags: ['virtue', 'gentle'], pos: 'pre', w: 8, tone: 'soft',
    hist: '慈安 และ 慈禧 สองไทเฮาผู้ทรงว่าราชการหลังม่านปลายราชวงศ์ชิง ใช้ 慈 นำหน้าพระนาม',
    good: ['f_hui', 'f_ren', 'f_xian', 'f_shu'] },
  { id: 'x_qing', zh: '慶', th: 'ชิ่ง', mean: 'มงคลน่ายินดี ความสุขที่ควรเฉลิมฉลอง', tags: ['fortune', 'harmony'], pos: 'pre', w: 6, tone: 'grand',
    good: ['f_hui', 'f_de', 'f_rong'] },
  { id: 'x_zhao', zh: '昭', th: 'เจา', mean: 'กระจ่างสว่าง คุณงามความดีเป็นที่ประจักษ์แก่ทุกคน', tags: ['wisdom', 'virtue'], pos: 'pre', w: 6, tone: 'grand',
    hist: '孝昭仁皇后 สกุลหนิ่วฮู่ลู่ ฮองเฮาองค์ที่สองของคังซี',
    good: ['f_de', 'f_xian', 'f_hui'] },
  { id: 'x_wen', zh: '溫', th: 'เวิน', mean: 'อบอุ่นสุภาพ นุ่มนวลน่าเข้าใกล้', tags: ['gentle', 'virtue'], pos: 'pre', w: 7, tone: 'soft',
    good: ['f_gong', 'f_liang', 'f_rou', 'f_ya', 'f_wan', 'f_hui'] },
  { id: 'x_yuan', zh: '元', th: 'หยวน', mean: 'ต้นกำเนิด อันดับหนึ่ง ผู้เป็นเอกในหมู่สตรี', tags: ['strong', 'fortune'], pos: 'pre', w: 3, tone: 'grand',
    good: ['f_de', 'f_hui', 'f_shu'] },

  // ---------------------------------------------------------------- any (before or after)
  { id: 'x_jing', zh: '敬', th: 'จิ้ง', mean: 'เคารพนอบน้อม และเป็นที่เคารพของผู้อื่น', tags: ['virtue', 'loyal'], pos: 'any', w: 8, tone: 'grand',
    hist: '孝敬憲皇后 สกุลอู๋ลาน่าลา ฮองเฮาของหย่งเจิ้ง',
    good: ['f_duan', 'f_gong', 'f_su', 'f_zhuang'] },
  { id: 'x_chun', zh: '純', th: 'ฉุน', mean: 'บริสุทธิ์ใสสะอาด ไร้มลทินในใจ', tags: ['virtue', 'gentle'], pos: 'any', w: 7, tone: 'soft',
    hist: '孝賢純皇后 ฮองเฮาองค์แรกของเฉียนหลง (สกุลฟู่ฉา) และ 純惠皇貴妃',
    good: ['f_xian', 'f_zhen', 'f_wen'] },
  { id: 'x_zhe', zh: '哲', th: 'เจ๋อ', mean: 'รอบรู้ฉลาดลึกซึ้ง มองการณ์ไกลอย่างผู้มีปัญญา', tags: ['wisdom', 'virtue'], pos: 'any', w: 5, tone: 'grand',
    hist: '孝哲毅皇后 สกุลอาลู่เทอ ฮองเฮาของถงจื้อ',
    good: ['f_xian', 'f_de', 'f_zhuang'] },
  { id: 'x_gong', zh: '恭', th: 'กง', mean: 'นอบน้อมสำรวม วางตนพอดีต่อผู้สูงกว่า', tags: ['virtue', 'loyal'], pos: 'any', w: 7, tone: 'soft',
    good: ['f_wen', 'f_qian', 'f_jing', 'f_zhuang'] },
  { id: 'x_jing2', zh: '靜', th: 'จิ่ง', mean: 'สงบนิ่งสุขุม ใจเยือกเย็นเหมือนน้ำนิ่ง', tags: ['harmony', 'gentle'], pos: 'any', w: 7, tone: 'soft',
    good: ['f_shu', 'f_zhen', 'f_hui'] },
  { id: 'x_de', zh: '德', th: 'เต๋อ', mean: 'คุณธรรมความดีงามที่ผู้คนยกย่อง', tags: ['virtue'], pos: 'any', w: 7, tone: 'grand',
    good: ['f_xian', 'f_ren', 'f_hui'] },
  { id: 'x_rong', zh: '榮', th: 'หรง', mean: 'เกียรติยศรุ่งเรือง ศักดิ์ศรีที่ผู้อื่นเทียบไม่ได้', tags: ['fortune', 'strong'], pos: 'any', w: 6, tone: 'grand',
    good: ['f_zhuang', 'f_de', 'f_hui'] },
  { id: 'x_ya', zh: '雅', th: 'หยา', mean: 'สง่างามละเมียดละไม มีรสนิยมแบบกวี', tags: ['art', 'beauty'], pos: 'any', w: 6, tone: 'soft',
    good: ['f_wen', 'f_xian', 'f_shu'] },
  { id: 'x_mu', zh: '穆', th: 'มู่', mean: 'สงบเงียบสง่างาม ลึกซึ้งและน่าเกรงขาม', tags: ['harmony', 'virtue'], pos: 'any', w: 6, tone: 'grand',
    hist: '孝穆成皇后 สกุลหนิ่วฮู่ลู่ ฮองเฮาองค์แรกของเต้ากวง',
    good: ['f_zhuang', 'f_jing', 'f_su'] },
  { id: 'x_kang', zh: '康', th: 'คัง', mean: 'สุขสบายปลอดภัย พระวรกายแข็งแรง', tags: ['fortune', 'harmony'], pos: 'any', w: 6, tone: 'soft',
    hist: '端康皇貴妃 (瑾妃) พระสนมของกวงซวี่ ได้รับยกเป็นหวงกุ้ยเฟยในสมัยปูยี',
    good: ['f_duan', 'f_ci', 'f_shu'] },
  { id: 'x_zhuang', zh: '莊', th: 'จวง', mean: 'สง่า สุขุม สมเกียรติ ควรแก่การเคารพ', tags: ['virtue', 'strong'], pos: 'any', w: 9, tone: 'grand',
    hist: '孝莊文皇后 ไทเฮาผู้ค้ำจุนราชวงศ์ชิงในช่วงต้นรัชกาล',
    good: ['f_jing', 'f_su', 'f_shu', 'f_zhen'] },
  { id: 'x_shu', zh: '淑', th: 'ชู', mean: 'อ่อนโยนมีคุณธรรม งามทั้งกิริยาและน้ำใจ', tags: ['virtue', 'gentle'], pos: 'any', w: 8, tone: 'soft',
    hist: '淑嘉皇貴妃 พระสนมเอกของเฉียนหลง ใช้ 淑 นำหน้าฉายาเดิม',
    good: ['f_hui', 'f_xian', 'f_zhen', 'f_duan', 'f_shen'] },
  { id: 'x_duan', zh: '端', th: 'ตวน', mean: 'ท่วงท่าเที่ยงตรงงดงาม ประพฤติตนเป็นแบบอย่าง', tags: ['virtue', 'strong'], pos: 'any', w: 8, tone: 'grand',
    hist: '孝獻端敬皇后 สกุลตงเอ๋อ สนมสุดที่รักของซุ่นจื้อ ภายหลังสถาปนาเป็นฮองเฮา',
    good: ['f_zhuang', 'f_jing', 'f_shu', 'f_hui'] },

  // ---------------------------------------------------------------- suf (after the fenghao): virtue / harmony / auspicious
  { id: 'x_xian', zh: '賢', th: 'เสียน', mean: 'ผู้ทรงคุณธรรมและปัญญา ภรรยาที่ดีเลิศ', tags: ['virtue', 'wisdom'], pos: 'suf', w: 9, tone: 'grand',
    hist: '慧賢皇貴妃 สกุลเกาเจีย รัชกาลเฉียนหลง และ 孝賢純皇后',
    good: ['f_hui4', 'f_shu'] },
  { id: 'x_hui', zh: '惠', th: 'ฮุ่ย', mean: 'เมตตาอ่อนโยน มีน้ำใจให้ผู้อื่น', tags: ['virtue', 'gentle'], pos: 'suf', w: 9, tone: 'soft',
    hist: '純惠皇貴妃 สกุลซู (蘇) พระสนมเอกของเฉียนหลง',
    good: ['f_chun', 'f_xian', 'f_shu', 'f_wan', 'f_rou'] },
  { id: 'x_shun', zh: '順', th: 'ซุ่น', mean: 'นอบน้อมว่านอนสอนง่าย ทุกอย่างราบรื่นสมหวัง', tags: ['gentle', 'harmony'], pos: 'suf', w: 7, tone: 'soft',
    good: ['f_hui', 'f_wan', 'f_shu', 'f_rou'] },
  { id: 'x_su', zh: '肅', th: 'ซู่', mean: 'เคร่งขรึมเป็นระเบียบ มีอำนาจอย่างสงบ', tags: ['virtue', 'strong'], pos: 'suf', w: 6, tone: 'grand',
    hist: '敦肅皇貴妃 สกุลเหนียน (年) พระสนมเอกของหย่งเจิ้ง',
    good: ['f_zhuang', 'f_duan', 'f_shu'] },
  { id: 'x_min', zh: '敏', th: 'หมิน', mean: 'ว่องไวฉลาดเฉลียว รู้กาลเทศะ', tags: ['wisdom', 'virtue'], pos: 'suf', w: 6, tone: 'grand',
    hist: '敬敏皇貴妃 พระสนมยศหวงกุ้ยเฟยแห่งราชวงศ์ชิง',
    good: ['f_jing', 'f_hui', 'f_shu'] },
  { id: 'x_shen', zh: '慎', th: 'เชิ่น', mean: 'รอบคอบระมัดระวัง ไม่ผลีผลามเสียมารยาท', tags: ['virtue', 'wisdom'], pos: 'suf', w: 5, tone: 'humble',
    good: ['f_jing', 'f_gong', 'f_jin'] },
  { id: 'x_xi', zh: '僖', th: 'ซี', mean: 'ร่าเริงเบิกบาน ความสุขสงบที่งดงาม', tags: ['harmony', 'fortune'], pos: 'suf', w: 4, tone: 'soft',
    hist: '溫僖貴妃 สกุลหนิ่วฮู่ลู่ พระสนมของคังซี',
    good: ['f_wen', 'f_hui', 'f_shu'] },
  { id: 'x_ke', zh: '恪', th: 'เค่อ', mean: 'ปฏิบัติหน้าที่อย่างเคร่งครัดและนอบน้อม', tags: ['virtue', 'loyal'], pos: 'suf', w: 4, tone: 'humble',
    good: ['f_gong', 'f_jing', 'f_jin'] },
  { id: 'x_zhen', zh: '貞', th: 'เจิน', mean: 'ซื่อตรงมั่นคง รักษาใจบริสุทธิ์ไม่หวั่นไหว', tags: ['virtue', 'loyal'], pos: 'suf', w: 7, tone: 'grand',
    good: ['f_shu', 'f_zhuang', 'f_hui'] },
  { id: 'x_ning', zh: '寧', th: 'หนิง', mean: 'สงบเรียบร้อย ปราศจากความวุ่นวาย', tags: ['harmony', 'gentle'], pos: 'suf', w: 6, tone: 'soft',
    good: ['f_jing2', 'f_shu', 'f_wan'] },
  { id: 'x_an', zh: '安', th: 'อัน', mean: 'ปลอดภัยมั่นคง ใจสงบสุข', tags: ['harmony', 'fortune'], pos: 'suf', w: 6, tone: 'soft',
    good: ['f_jing2', 'f_shu', 'f_hui'] },
  { id: 'x_shou', zh: '壽', th: 'โซ่ว', mean: 'อายุยืนยาว พรอันประเสริฐที่สุดของชาวจีน', tags: ['fortune'], pos: 'suf', w: 4, tone: 'grand',
    good: ['f_ren', 'f_ci', 'f_rong'] },
  { id: 'x_ren', zh: '仁', th: 'เหริน', mean: 'เมตตามีใจกว้างต่อผู้คน', tags: ['virtue', 'gentle'], pos: 'suf', w: 7, tone: 'soft',
    good: ['f_hui', 'f_ci', 'f_de'] },
  { id: 'x_cheng', zh: '誠', th: 'เฉิง', mean: 'จริงใจ ไม่มีเล่ห์เหลี่ยมในใจ', tags: ['loyal', 'virtue'], pos: 'suf', w: 6,
    good: ['f_zhong', 'f_jing', 'f_gong'] },
  { id: 'x_qian', zh: '謙', th: 'เฉียน', mean: 'ถ่อมตน ไม่โอ้อวดแม้ยศสูง', tags: ['virtue', 'gentle'], pos: 'suf', w: 4, tone: 'humble',
    good: ['f_gong', 'f_wen', 'f_jing'] },
  { id: 'x_li', zh: '禮', th: 'ลี่', mean: 'เคร่งครัดในจารีตและมารยาทอันงาม', tags: ['virtue', 'harmony'], pos: 'suf', w: 5, tone: 'grand',
    good: ['f_gong', 'f_jing', 'f_zhuang'] },
  { id: 'x_xin', zh: '信', th: 'ซิ่น', mean: 'รักษาสัจจะ เชื่อถือได้ตลอดกาล', tags: ['loyal', 'virtue'], pos: 'suf', w: 4,
    good: ['f_zhong', 'f_cheng', 'f_zhen'] },
  { id: 'x_zhong', zh: '忠', th: 'จง', mean: 'ภักดีไม่แปรผัน ซื่อตรงต่อผู้เป็นนาย', tags: ['loyal'], pos: 'suf', w: 5,
    good: ['f_cheng', 'f_jing', 'f_gong'] },
  { id: 'x_zheng', zh: '正', th: 'เจิ้ง', mean: 'เที่ยงธรรมตรงไปตรงมา', tags: ['virtue', 'strong'], pos: 'suf', w: 5,
    good: ['f_duan', 'f_zhong', 'f_zhi'] },
  { id: 'x_ding', zh: '定', th: 'ติ้ง', mean: 'มั่นคงแน่วแน่ ใจไม่หวั่นไหวตามลมปาก', tags: ['harmony', 'loyal'], pos: 'suf', w: 3,
    good: ['f_jing2', 'f_zhen', 'f_de'] },
  { id: 'x_jie', zh: '潔', th: 'เจี๋ย', mean: 'ผ่องใสสะอาดทั้งกายและใจ', tags: ['virtue', 'beauty'], pos: 'suf', w: 4, tone: 'soft',
    good: ['f_zhen', 'f_lian', 'f_shu'] },
  { id: 'x_jian', zh: '堅', th: 'เจียน', mean: 'แข็งแกร่งมั่นคง ไม่ยอมโอนอ่อนต่อแรงกดดัน', tags: ['strong', 'loyal'], pos: 'pre', w: 3,
    good: ['f_zhen', 'f_zhong'] },
  { id: 'x_en', zh: '恩', th: 'เอิน', mean: 'พระกรุณาธิคุณ ความเอื้ออารีที่ทำให้ผู้อื่นซาบซึ้ง', tags: ['fortune', 'gentle'], pos: 'suf', w: 5, tone: 'soft',
    good: ['f_ren', 'f_ci', 'f_de'] },
  { id: 'x_kuan', zh: '寬', th: 'ควน', mean: 'ใจกว้างให้อภัยง่าย', tags: ['gentle', 'virtue'], pos: 'pre', w: 5, tone: 'soft',
    good: ['f_ren', 'f_hui'] },
  { id: 'x_rou', zh: '柔', th: 'โหรว', mean: 'นุ่มนวลอ่อนโยนดั่งสายน้ำ', tags: ['gentle', 'beauty'], pos: 'suf', w: 6, tone: 'soft',
    good: ['f_wan', 'f_wen', 'f_shu', 'f_hui'] },
  { id: 'x_wan', zh: '婉', th: 'หว่าน', mean: 'อ่อนหวานละมุนละม่อม พูดจาไพเราะ', tags: ['gentle', 'beauty'], pos: 'suf', w: 6, tone: 'soft',
    good: ['f_rou', 'f_wen', 'f_shu'] },
  { id: 'x_yu', zh: '毓', th: 'อวี้', mean: 'บ่มเพาะเลี้ยงดู อุดมด้วยความเจริญงอกงาม', tags: ['gentle', 'fortune'], pos: 'pre', w: 4, tone: 'soft',
    good: ['f_xiu'] },
  { id: 'x_yun', zh: '允', th: 'หยุ่น', mean: 'ซื่อสัตย์เที่ยงธรรม ควรแก่ความไว้วางใจ', tags: ['loyal', 'virtue'], pos: 'pre', w: 3,
    good: ['f_gong', 'f_cheng'] },
  { id: 'x_heng', zh: '恆', th: 'เหิง', mean: 'ยืนยงมั่นคง ความภักดีที่ไม่เสื่อมคลาย', tags: ['loyal', 'harmony'], pos: 'suf', w: 4,
    good: ['f_zhen', 'f_cheng', 'f_zhong'] },
  { id: 'x_mao', zh: '懋', th: 'เม่า', mean: 'ขยันบำเพ็ญคุณธรรมอย่างต่อเนื่อง', tags: ['virtue', 'wisdom'], pos: 'pre', w: 3, tone: 'grand',
    good: ['f_de'] },
  { id: 'x_yong', zh: '雍', th: 'หยง', mean: 'สง่าผ่าเผยและปรองดอง', tags: ['harmony', 'virtue'], pos: 'pre', w: 5, tone: 'grand',
    good: ['f_mu'] },
  { id: 'x_quan', zh: '全', th: 'เฉวียน', mean: 'สมบูรณ์พร้อม ครบถ้วนทั้งคุณธรรมและโชค', tags: ['virtue', 'fortune'], pos: 'pre', w: 4,
    good: ['f_de', 'f_zhen'] },
  { id: 'x_hua', zh: '華', th: 'ฮวา', mean: 'เจิดจรัสงดงาม รุ่งโรจน์ดั่งดอกไม้เบ่งบาน', tags: ['beauty', 'fortune'], pos: 'suf', w: 5, tone: 'grand',
    good: ['f_rong', 'f_de', 'f_zhuang'] },
  { id: 'x_dun', zh: '惇', th: 'ตุน', mean: 'ซื่อสัตย์หนักแน่น เปี่ยมน้ำใจไม่แปรเปลี่ยน', tags: ['virtue', 'loyal'], pos: 'suf', w: 3,
    good: ['f_hui', 'f_ren', 'f_ci'] }
);

/* ===================================================================== combos
   Showcase pairs, th = the combined Thai reading in FINAL order (extra after feng for 'suf', before it for 'pre').
   Historical ones (who starts with "ตัวอย่างจริง") are titles I am confident existed; the rest are classical Chinese words ("ตัวอย่างที่สมเหตุสมผล").
   No pair uses 嘉 懿 舒 怡 (NPC-reserved) — 令懿 and 淑嘉 are mentioned only in hist text. 敦 / 慧 may be absent from the fenghao pool: such pairs are display-only. */
Q.NAMING.combos.push(
  // ---- real Qing titles (皇貴妃 unless stated)
  { feng: '純', extra: '惠', pos: 'suf', th: 'ฉุนฮุ่ย', who: 'ตัวอย่างจริง: 純惠皇貴妃 พระสนมเอกของเฉียนหลง' },
  { feng: '慧', extra: '賢', pos: 'suf', th: 'ฮุ้ยเสียน', who: 'ตัวอย่างจริง: 慧賢皇貴妃 สกุลเกาเจีย รัชกาลเฉียนหลง' },
  { feng: '敏', extra: '敬', pos: 'pre', th: 'จิ้งหมิน', who: 'ตัวอย่างจริง: 敬敏皇貴妃 (敏妃 สกุลจางเจีย สนมของคังซี ได้ 敬 นำหน้าฉายาเดิมเมื่อเลื่อนเป็นหวงกุ้ยเฟย)' },
  { feng: '敦', extra: '肅', pos: 'suf', th: 'ตุนซู่', who: 'ชื่อจริงสองอักษรที่ตั้งใหม่ทั้งคู่ (ไม่ได้เติมจากฉายาเดิม): 敦肅皇貴妃 สกุลเหนียน พระสนมเอกของหย่งเจิ้ง' },
  { feng: '端', extra: '康', pos: 'suf', th: 'ตวนคัง', who: 'ชื่อจริงสองอักษรที่ตั้งใหม่ทั้งคู่ (ไม่ได้เติมจากฉายาเดิม): 端康皇貴妃 (瑾妃) พระสนมของกวงซวี่' },
  { feng: '溫', extra: '僖', pos: 'suf', th: 'เวินซี', who: 'ชื่อจริงสองอักษรที่ตั้งใหม่ทั้งคู่ (ไม่ได้เติมจากฉายาเดิม): 溫僖貴妃 สกุลหนิ่วฮู่ลู่ พระสนมของคังซี' },
  { feng: '慈', extra: '安', pos: 'suf', th: 'ฉืออัน', who: 'ตัวอย่างจริง: 慈安皇太后 ไทเฮาองค์ตะวันออกปลายราชวงศ์ชิง' },
  { feng: '慶', extra: '崇', pos: 'pre', th: 'ฉงชิ่ง', who: 'ตัวอย่างจริง: 崇慶皇太后 พระมารดาของเฉียนหลง (อักษรนำหน้า)' },
  // ---- plausible: classical two-character words
  { feng: '賢', extra: '惠', pos: 'suf', th: 'เสียนฮุ่ย', who: 'ตัวอย่างที่สมเหตุสมผล: 賢惠 ภรรยาผู้ทรงคุณธรรมและเมตตา' },
  { feng: '賢', extra: '淑', pos: 'suf', th: 'เสียนชู', who: 'ตัวอย่างที่สมเหตุสมผล: 賢淑 ผู้ทรงคุณธรรมและอ่อนโยน' },
  { feng: '端', extra: '莊', pos: 'suf', th: 'ตวนจวง', who: 'ตัวอย่างที่สมเหตุสมผล: 端莊 สง่างามสมเกียรติ' },
  { feng: '莊', extra: '敬', pos: 'suf', th: 'จวงจิ้ง', who: 'ตัวอย่างที่สมเหตุสมผล: 莊敬 สุขุมและน่าเคารพ' },
  { feng: '溫', extra: '恭', pos: 'suf', th: 'เวินกง', who: 'ตัวอย่างที่สมเหตุสมผล: 溫恭 อ่อนโยนและนอบน้อม' },
  { feng: '恭', extra: '謙', pos: 'suf', th: 'กงเฉียน', who: 'ตัวอย่างที่สมเหตุสมผล: 恭謙 สุภาพถ่อมตน' },
  { feng: '婉', extra: '順', pos: 'suf', th: 'หว่านซุ่น', who: 'ตัวอย่างที่สมเหตุสมผล: 婉順 อ่อนหวานและว่านอนสอนง่าย' },
  { feng: '靜', extra: '安', pos: 'suf', th: 'จิ่งอัน', who: 'ตัวอย่างที่สมเหตุสมผล: 靜安 สงบและปลอดภัย' },
  { feng: '榮', extra: '華', pos: 'suf', th: 'หรงฮวา', who: 'ตัวอย่างที่สมเหตุสมผล: 榮華 เกียรติยศรุ่งเรือง' },
  { feng: '恩', extra: '隆', pos: 'pre', th: 'หลงเอิน', who: 'ตัวอย่างที่สมเหตุสมผล: 隆恩 พระกรุณาธิคุณล้นเหลือ (อักษรนำหน้า)' }
);
