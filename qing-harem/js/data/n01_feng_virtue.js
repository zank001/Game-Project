/* n01_feng_virtue.js — Q.NAMING.feng pool A: VIRTUE · DIGNITY · LOYALTY · PRUDENCE (封號 fenghao, one traditional hanzi each).
   Docs: docs/DESIGN.md §12. Only assigns Q.NAMING.feng (no events). Reserved to NPCs and deliberately absent: 舒 怡 嘉 懿.
   tone 'grand'  = dignified characters that suit the high ranks (莊 端 貞 德 賢 淑 …)
   tone 'humble' = modest / prudent / penitent characters suited to a re-bestowal after disgrace (謹 慎 恪 謙 讓 儉 …)
   tone 'soft'   = warm, gentle characters.
   Readings (Thai subtitle style, one syllable). Deliberate deviations to dodge the lint blocklist / homophones:
     淑 ชู   (not ซู — that is Shu Fei's stem)      慎 เชิ่น (not เซิ่น — clan 沈)      勤 ชิน (not ฉิน — Mama Qin)
     禮 ลี่   (not หลี่ — clan Li)                    靜 จิ่ง vs 敬 จิ้ง (both jing4, told apart by the tone mark ่/้)
     儉 เจี่ยน vs 堅 เจียน (jian3 vs jian1)           肅 ซู่ (4th tone, kept distinct from ซู)
   hist = only facts I am confident of (real Qing consorts whose title carried that exact character). */
Q.NAMING.feng.push(
  // ---- grand: dignity & high virtue ----
  { id: 'f_shu', zh: '淑', th: 'ชู', mean: 'อ่อนโยนงดงามด้วยคุณธรรม สตรีผู้ประเสริฐ', tags: ['virtue', 'gentle'], w: 9, tone: 'grand', hist: '淑嘉皇貴妃 สนมเอกในรัชกาลเฉียนหลง (ยศที่ได้รับภายหลัง)' },
  { id: 'f_de', zh: '德', th: 'เต๋อ', mean: 'คุณธรรมอันสูงส่ง เป็นที่ยกย่องของผู้คน', tags: ['virtue'], w: 9, tone: 'grand', hist: '德妃 สกุลอูย่า พระมารดาของหย่งเจิ้ง ภายหลังได้เป็นไทเฮา' },
  { id: 'f_xian', zh: '賢', th: 'เสียน', mean: 'ผู้ทรงคุณธรรมและปัญญา ภรรยาที่ดีเลิศ', tags: ['virtue', 'wisdom'], w: 9, tone: 'grand', hist: '慧賢皇貴妃 สนมเอกสกุลเกาเจีย รัชกาลเฉียนหลง' },
  { id: 'f_zhen', zh: '貞', th: 'เจิน', mean: 'ซื่อตรงมั่นคง รักษาใจบริสุทธิ์ไม่หวั่นไหว', tags: ['virtue', 'loyal'], w: 8, tone: 'grand', hist: '貞嬪 สมัยเสียนเฟิง ภายหลังเลื่อนเป็นฮองเฮา คือไทเฮาฉืออัน (孝貞顯皇后)' },
  { id: 'f_duan', zh: '端', th: 'ตวน', mean: 'ท่วงท่าเที่ยงตรงสง่างาม ประพฤติตนตรงดี', tags: ['virtue', 'strong'], w: 8, tone: 'grand' },
  { id: 'f_zhuang', zh: '莊', th: 'จวง', mean: 'สง่า สุขุม สมเกียรติ ควรแก่การเคารพ', tags: ['virtue', 'strong'], w: 9, tone: 'grand', hist: '莊妃 พระสนมของหวงไถจี๋ ต่อมาคือไทเฮาเสี้ยวจวง (孝莊文皇后)' },
  { id: 'f_su', zh: '肅', th: 'ซู่', mean: 'เคร่งขรึมเป็นระเบียบ ทรงอำนาจอย่างสงบ', tags: ['virtue', 'strong'], w: 6, tone: 'grand', hist: '敦肅皇貴妃 สนมเอกสกุลเหนียน รัชกาลหย่งเจิ้ง' },
  { id: 'f_liang', zh: '良', th: 'เหลียง', mean: 'ดีงามมีน้ำใจ เป็นคนดีโดยกำเนิด', tags: ['virtue', 'gentle'], w: 8, tone: 'grand', hist: '良妃 สกุลเว่ย สนมของคังซี พระมารดาองค์ชายแปด' },
  { id: 'f_chun', zh: '純', th: 'ฉุน', mean: 'บริสุทธิ์ไร้มลทิน ใจสะอาดไม่ปรุงแต่ง', tags: ['virtue', 'gentle'], w: 8, tone: 'grand', hist: '純惠皇貴妃 สนมเอกสกุลซู รัชกาลเฉียนหลง' },
  { id: 'f_hui', zh: '惠', th: 'ฮุ่ย', mean: 'เมตตากรุณา อ่อนโยนและใจกว้าง', tags: ['virtue', 'gentle'], w: 9, tone: 'grand', hist: '惠妃 สกุลนาลา สนมของคังซี พระมารดาองค์ชายใหญ่' },
  { id: 'f_ren', zh: '仁', th: 'เหริน', mean: 'เมตตาปรานีต่อผู้อื่น รากแห่งความดีทั้งปวง', tags: ['virtue', 'gentle'], w: 5, tone: 'grand' },
  { id: 'f_mu', zh: '穆', th: 'มู่', mean: 'สงบสง่า เคร่งขรึมและงดงามอย่างมีเกียรติ', tags: ['virtue', 'harmony', 'strong'], w: 7, tone: 'grand' },
  { id: 'f_ci', zh: '慈', th: 'ฉือ', mean: 'เมตตาดั่งมารดา อ่อนโยนต่อผู้ต่ำต้อยกว่า', tags: ['gentle', 'virtue'], w: 5, tone: 'grand' },
  { id: 'f_mao', zh: '懋', th: 'เม่า', mean: 'ขยันสร้างคุณงามความดีให้เจริญยิ่งขึ้น', tags: ['virtue', 'strong'], w: 3, tone: 'grand' },
  { id: 'f_quan', zh: '全', th: 'เฉวียน', mean: 'ครบถ้วนสมบูรณ์พร้อม ไร้ที่ติ', tags: ['virtue', 'fortune'], w: 5, tone: 'grand', hist: '全貴妃 พระสนมของเต้ากวง ภายหลังเป็นฮองเฮา (孝全成皇后)' },
  { id: 'f_zhao', zh: '昭', th: 'เจา', mean: 'ความดีงามที่เปล่งประกายให้ผู้อื่นเห็น', tags: ['virtue', 'wisdom'], w: 4, tone: 'grand' },
  { id: 'f_chong', zh: '崇', th: 'ฉง', mean: 'สูงส่งเป็นที่เทิดทูน ควรแก่การยกย่อง', tags: ['virtue', 'strong'], w: 3, tone: 'grand' },
  { id: 'f_yong', zh: '雍', th: 'หยง', mean: 'สง่างามสุขุม ท่าทีสงบกลมกลืน', tags: ['harmony', 'virtue'], w: 4, tone: 'grand' },
  { id: 'f_rong', zh: '榮', th: 'หรง', mean: 'เกียรติยศและความรุ่งเรือง', tags: ['fortune', 'virtue'], w: 5, tone: 'grand', hist: '榮妃 สกุลหม่าเจีย สนมของคังซี มีพระโอรสธิดาหลายพระองค์' },

  // ---- humble: prudence, modesty, penitence (re-bestowal after disgrace) ----
  { id: 'f_jin', zh: '謹', th: 'จิ่น', mean: 'ระมัดระวังรอบคอบ ไม่ล่วงเกินผู้ใด', tags: ['virtue', 'loyal'], w: 6, tone: 'humble' },
  { id: 'f_shen', zh: '慎', th: 'เชิ่น', mean: 'ไตร่ตรองก่อนทำ ระวังคำพูดและการกระทำ', tags: ['virtue', 'wisdom'], w: 6, tone: 'humble' },
  { id: 'f_gong', zh: '恭', th: 'กง', mean: 'นอบน้อมเคารพต่อผู้เหนือกว่า', tags: ['virtue', 'harmony'], w: 7, tone: 'humble' },
  { id: 'f_jing', zh: '敬', th: 'จิ้ง', mean: 'เคารพยำเกรงด้วยใจจริง ทำหน้าที่อย่างเอาใจใส่', tags: ['virtue', 'loyal'], w: 7, tone: 'humble', hist: '敬敏皇貴妃 ยศที่ยกให้ภายหลังแก่สนมสกุลจางเจีย สมัยคังซี' },
  { id: 'f_cheng', zh: '誠', th: 'เฉิง', mean: 'จริงใจไม่เสแสร้ง ใจตรงกับวาจา', tags: ['loyal', 'virtue'], w: 6, tone: 'humble' },
  { id: 'f_ke', zh: '恪', th: 'เค่อ', mean: 'ปฏิบัติหน้าที่อย่างระมัดระวังและนอบน้อม', tags: ['loyal', 'virtue'], w: 4, tone: 'humble' },
  { id: 'f_jing2', zh: '靜', th: 'จิ่ง', mean: 'สงบนิ่งไม่ก่อเรื่อง ใจเย็นดั่งผืนน้ำนิ่ง', tags: ['harmony', 'gentle'], w: 6, tone: 'humble', hist: '靜貴妃 พระสนมของเต้ากวง พระมารดาของอ๋องกง และผู้เลี้ยงดูเสียนเฟิง (孝靜成皇后)' },
  { id: 'f_rang', zh: '讓', th: 'ร่าง', mean: 'ถ่อมตนยอมให้ ไม่แย่งชิงความดีความชอบ', tags: ['virtue', 'harmony'], w: 3, tone: 'humble' },
  { id: 'f_qian', zh: '謙', th: 'เฉียน', mean: 'อ่อนน้อมถ่อมตน ไม่โอ้อวดความสามารถ', tags: ['virtue', 'harmony'], w: 6, tone: 'humble' },
  { id: 'f_jian', zh: '儉', th: 'เจี่ยน', mean: 'เรียบง่ายประหยัด ไม่ฟุ้งเฟ้อ', tags: ['virtue'], w: 3, tone: 'humble' },
  { id: 'f_lian', zh: '廉', th: 'เหลียน', mean: 'ซื่อสัตย์สะอาด ไม่โลภ', tags: ['virtue', 'loyal'], w: 4, tone: 'humble' },
  { id: 'f_qin', zh: '勤', th: 'ชิน', mean: 'ขยันหมั่นเพียร ทำหน้าที่ไม่บกพร่อง', tags: ['virtue', 'strong'], w: 5, tone: 'humble' },
  { id: 'f_shun', zh: '順', th: 'ซุ่น', mean: 'นอบน้อมว่าง่าย กลมกลืนกับผู้คนรอบตัว', tags: ['harmony', 'virtue'], w: 7, tone: 'humble' },
  { id: 'f_min', zh: '敏', th: 'หมิน', mean: 'ว่องไวรู้ทัน ทำงานคล่องแคล่ว', tags: ['wisdom', 'virtue'], w: 6, tone: 'humble', hist: '敏妃 สกุลจางเจีย สนมของคังซี ภายหลังได้ยศ 敬敏皇貴妃' },
  { id: 'f_mi', zh: '密', th: 'มี่', mean: 'รอบคอบรัดกุม ละเอียดถี่ถ้วน เก็บงำมิดชิดไม่มีช่องโหว่', tags: ['wisdom', 'virtue'], w: 3, tone: 'humble', hist: '密妃 สนมของคังซี' },
  { id: 'f_xun', zh: '循', th: 'ซวิน', mean: 'ทำตามกฎระเบียบอย่างเคร่งครัด ว่าง่ายมีวินัย', tags: ['virtue', 'harmony'], w: 3, tone: 'humble' },
  { id: 'f_xi', zh: '僖', th: 'ซี', mean: 'ระมัดระวังตัว เกรงใจไม่ล้ำเส้น', tags: ['virtue', 'gentle'], w: 3, tone: 'humble' },
  { id: 'f_xiang', zh: '襄', th: 'เซียง', mean: 'ช่วยเหลือเกื้อกูลด้วยใจภักดี', tags: ['loyal', 'virtue'], w: 3, tone: 'humble' },
  { id: 'f_du', zh: '篤', th: 'ตู่', mean: 'จริงจังมั่นคง ซื่อสัตย์หนักแน่น', tags: ['loyal', 'virtue'], w: 3, tone: 'humble' },
  { id: 'f_mian', zh: '勉', th: 'เหมี่ยน', mean: 'พากเพียรตั้งใจ ขยันขันแข็งและพยายามทำให้ดียิ่งขึ้น', tags: ['virtue', 'strong'], w: 2, tone: 'humble' },
  { id: 'f_pu', zh: '樸', th: 'พู่', mean: 'เรียบง่ายไม่ตกแต่ง จริงใจดั้งเดิม', tags: ['virtue', 'harmony'], w: 2, tone: 'humble' },

  // ---- soft: warm, gentle virtue ----
  { id: 'f_wen', zh: '溫', th: 'เวิน', mean: 'อบอุ่นอ่อนโยน พูดจาละมุน', tags: ['gentle', 'virtue'], w: 6, tone: 'soft', hist: '溫僖貴妃 สกุลหนิ่วฮู่ลู่ สนมของคังซี' },
  { id: 'f_dun', zh: '惇', th: 'ตุน', mean: 'ซื่อสัตย์ใจกว้าง จริงใจหนักแน่น', tags: ['virtue', 'loyal'], w: 4, tone: 'soft', hist: '惇妃 สนมของเฉียนหลง เคยถูกลดเป็นผินเพราะลงโทษสาวใช้เกินเหตุ' },
  { id: 'f_kuan', zh: '寬', th: 'ควน', mean: 'ใจกว้าง ไม่ถือโทษโกรธง่าย', tags: ['virtue', 'gentle'], w: 3, tone: 'soft' },
  { id: 'f_en', zh: '恩', th: 'เอิน', mean: 'บุญคุณและความเมตตาที่มอบแก่ผู้อื่น', tags: ['virtue', 'fortune'], w: 3, tone: 'soft' },

  // ---- plain: loyalty, rectitude, constancy ----
  { id: 'f_zhong', zh: '忠', th: 'จง', mean: 'ภักดีสุดใจ ไม่แปรเปลี่ยนต่อผู้ที่ตนยึดมั่น', tags: ['loyal'], w: 4 },
  { id: 'f_li', zh: '禮', th: 'ลี่', mean: 'รู้มารยาทและขนบ ประพฤติเหมาะสมแก่ฐานะ', tags: ['virtue', 'harmony'], w: 4 },
  { id: 'f_zhi', zh: '直', th: 'จื๋อ', mean: 'ซื่อตรง กล้าพูดความจริง', tags: ['loyal', 'virtue'], w: 2 },
  { id: 'f_xin', zh: '信', th: 'ซิ่น', mean: 'รักษาคำพูด น่าไว้วางใจ', tags: ['loyal', 'virtue'], w: 5 },
  { id: 'f_ding', zh: '定', th: 'ติ้ง', mean: 'มั่นคงสงบ ใจไม่หวั่นไหวต่อลมแรง', tags: ['harmony', 'loyal'], w: 5 },
  { id: 'f_jie', zh: '潔', th: 'เจี๋ย', mean: 'สะอาดบริสุทธิ์ ประพฤติเรียบร้อยเป็นเลิศ', tags: ['virtue', 'beauty'], w: 4 },
  { id: 'f_heng', zh: '恆', th: 'เหิง', mean: 'ใจคงเส้นคงวา ไม่แปรเปลี่ยนตามกาลเวลา', tags: ['loyal', 'harmony'], w: 3 },
  { id: 'f_jian2', zh: '堅', th: 'เจียน', mean: 'หนักแน่นไม่เปลี่ยนใจ แม้ต้องฝ่าลมพายุ', tags: ['loyal', 'strong'], w: 2 },
  { id: 'f_yu', zh: '毓', th: 'อวี้', mean: 'บ่มเพาะความดีงามให้งอกงาม', tags: ['virtue', 'fortune'], w: 3 },
  { id: 'f_yun', zh: '允', th: 'หยุ่น', mean: 'ซื่อสัตย์เที่ยงธรรม รักษาสัจจะอย่างจริงใจ', tags: ['loyal', 'virtue'], w: 2 }
);
