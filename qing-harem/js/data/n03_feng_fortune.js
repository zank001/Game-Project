/* n03_feng_fortune.js — Q.NAMING.feng pool C: FORTUNE · AUSPICIOUS · HARMONY · WISDOM · STRENGTH · SEASONS (封號 fenghao, one traditional hanzi each).
   Docs: docs/DESIGN.md §12. Only assigns Q.NAMING.feng (no events). Reserved to NPCs and deliberately absent: 舒 怡 嘉 懿.
   tone 'grand'  = auspicious / dignified characters for the high ranks (令 慶 祥 康 和 慧 裕 壽 …)
   tone 'humble' = modest, tranquil or penitent characters for a re-bestowal after disgrace (安 常 如 秉 愨 晏)
   tone 'soft'   = bright, warm, joyful characters (春 樂 歡 煦 晴 禧 秋 愉 雪)
   ids carry the Mandarin tone digit (f_ling4, f_he2 …) because the other pools already use plain pinyin (n02 owns f_ling for 玲).
   Readings (Thai-subtitle style, one syllable, 4th tone marked with ่ or ้):
     壽 โซ่ว  — must equal the reading of 壽 in n04_extra (same hanzi in feng and extra share one reading)
     慧 ฮุ้ย  — vs 惠 ฮุ่ย (n01) and 暉 ฮุย (n02): same syllable told apart by the tone mark, as n01 does for 靜/敬
     蘊 อวิ่น vs 韻 อวิ้น (n02)      晏 เยี้ยน vs 嬿 เยี่ยน (n02)      裕 อวี่ vs 毓 อวี้ (n01) / 瑜 อวี๋ (n02)
     祺 ฉี๋  (not ฉี — maid clan 齊)   彤 ถง (tong2)  vs  通 ทง (tong1)   福 ฝู (not ฟู่ — stem of ฟู่ฉา)
     祥 เสียง (not เซียง — 襄/香 already use it)    禧 ซี่ (not ซี — 僖/熙 use it)    智 จื้อ (vs 直 จื๋อ, n01)
   Seeds deliberately NOT used (and why): 瑞 睿 reading รุ่ย = Prince Rui · 祿 reading ลู่ · 玫 reading เหมย (all lint-blocked NPC stems);
     榮 順 敏 全 (already in n01) · 熙 (n02) · 成 (homophone of 誠) · 毅 (homophone of 義) · 佳 (homophone of reserved 嘉) · 豫 (homophone of 裕)
     嵐 (reads หลาน = "grandchild" in Thai, and = 蘭 n02) · 勇 (not plausible for a consort) · 隆 (n04 extra; หลง+ผิน = "หลงผิน")
   Known shared readings (kept on purpose, historical consorts): 愉 (n02 瑜) · 忻 (n02 馨) · 宣 (n02 瑄) — same syllable, different hanzi;
     和 เหอ equals the maid clan 何 in Q.NAMING.maidClans.
   hist = only facts I am confident of (real Qing consorts / dowagers / princesses whose title carried that exact character). */
Q.NAMING.feng.push(
  // ---- grand: auspicious, dignified, high-rank titles ----
  { id: 'f_ling4', zh: '令', th: 'ลิ่ง', mean: 'ประเสริฐ งดงาม เป็นแบบอย่างที่ดี', tags: ['virtue', 'fortune'], w: 9, tone: 'grand', hist: '令妃 เว่ยเจียสื่อ สนมสุดโปรดของเฉียนหลง ภายหลังเลื่อนเป็น令懿皇貴妃' },
  { id: 'f_qing4', zh: '慶', th: 'ชิ่ง', mean: 'ความยินดีมงคล บุญสมหวังที่ควรเฉลิมฉลอง', tags: ['fortune', 'harmony'], w: 8, tone: 'grand', hist: '慶貴妃 สนมเอกในรัชกาลเฉียนหลง (ภายหลังได้พระสมัญญา慶恭皇貴妃)' },
  { id: 'f_xiang2', zh: '祥', th: 'เสียง', mean: 'มงคลสิริ ลางดีที่นำโชคมาให้', tags: ['fortune'], w: 8, tone: 'grand', hist: '祥貴妃 สนมของเต้ากวง' },
  { id: 'f_kang1', zh: '康', th: 'คัง', mean: 'สุขภาพดี สงบสุข ร่มเย็นปราศจากภัย', tags: ['harmony', 'fortune'], w: 8, tone: 'grand', hist: '康慈皇太后 (孝靜成皇后) พระมารดาของอ๋องกง ผู้เลี้ยงดูเสียนเฟิง' },
  { id: 'f_he2', zh: '和', th: 'เหอ', mean: 'ปรองดองกลมเกลียว อ่อนโยนสงบ', tags: ['harmony'], w: 8, tone: 'grand', hist: '孝和睿皇后 ฮองเฮาของเจียชิ่ง ใช้อักษร 和 ในพระสมัญญานาม' },
  { id: 'f_ning2', zh: '寧', th: 'หนิง', mean: 'สงบมั่นคง ร่มเย็นปลอดภัย', tags: ['harmony'], w: 7, tone: 'grand', hist: '寧妃 สนมของหย่งเจิ้ง' },
  { id: 'f_hui4', zh: '慧', th: 'ฮุ้ย', mean: 'ฉลาดเฉลียว หยั่งรู้ใจคนและกาลเทศะ', tags: ['wisdom', 'virtue'], w: 8, tone: 'grand', hist: '慧賢皇貴妃 สนมเอกสกุลเกาเจีย รัชกาลเฉียนหลง ใช้อักษร 慧 นำหน้า' },
  { id: 'f_zhe2', zh: '哲', th: 'เจ๋อ', mean: 'ปราดเปรื่อง รู้แจ้งเห็นการณ์ไกล', tags: ['wisdom', 'virtue'], w: 5, tone: 'grand', hist: '哲憫皇貴妃 สนมของเฉียนหลง · 孝哲毅皇后 ฮองเฮาของถงจื้อ' },
  { id: 'f_tai4', zh: '泰', th: 'ไท่', mean: 'เจริญสงบสุข ราบรื่นมั่นคง', tags: ['fortune', 'harmony'], w: 5, tone: 'grand' },
  { id: 'f_yu4', zh: '裕', th: 'อวี่', mean: 'มั่งคั่งเหลือเฟือ ใจกว้างผาสุก', tags: ['fortune', 'virtue'], w: 7, tone: 'grand', hist: '裕妃 สนมของหย่งเจิ้ง · 隆裕 พระสมัญญาของฮองเฮากวงซวี่ (ภายหลังไทเฮา)' },
  { id: 'f_fu2', zh: '福', th: 'ฝู', mean: 'วาสนาและโชคลาภ ความสุขสมบูรณ์', tags: ['fortune'], w: 6, tone: 'grand' },
  { id: 'f_shou4', zh: '壽', th: 'โซ่ว', mean: 'อายุยืนยาว สุขภาพแข็งแรงตลอดกาล', tags: ['fortune'], w: 4, tone: 'grand', hist: '固倫榮壽公主 ธิดาบุญธรรมของไทเฮาฉือสี่' },
  { id: 'f_chang1', zh: '昌', th: 'ชาง', mean: 'รุ่งเรืองเจริญ ก้าวหน้าไม่หยุด', tags: ['fortune', 'strong'], w: 4, tone: 'grand' },
  { id: 'f_qi2', zh: '祺', th: 'ฉี๋', mean: 'สิริมงคล สุขสวัสดีตลอดกาล', tags: ['fortune'], w: 6, tone: 'grand' },

  // ---- humble: tranquil, constant, sincere (re-bestowal after disgrace) ----
  { id: 'f_an1', zh: '安', th: 'อัน', mean: 'สงบเย็น สบายใจ ไม่หวั่นไหว', tags: ['harmony'], w: 7, tone: 'humble', hist: '慈安 ไทเฮาตะวันออก (孝貞顯皇后) ใช้อักษร 安 ในพระสมัญญา' },
  { id: 'f_chang2', zh: '常', th: 'ฉาง', mean: 'คงเส้นคงวา สม่ำเสมอเป็นนิจ ไม่แปรเปลี่ยน', tags: ['loyal', 'harmony'], w: 5, tone: 'humble' },
  { id: 'f_ru2', zh: '如', th: 'หรู', mean: 'นอบน้อมคล้อยตามพระประสงค์ ว่านอนสอนง่าย', tags: ['harmony', 'virtue'], w: 4, tone: 'humble' },
  { id: 'f_bing3', zh: '秉', th: 'ปิ่ง', mean: 'ยึดมั่นหลักการ ถือความดีไว้ในใจ', tags: ['loyal', 'virtue'], w: 2, tone: 'humble' },
  { id: 'f_que4', zh: '愨', th: 'เชวี่ย', mean: 'ซื่อสัตย์จริงใจ ไม่เสแสร้ง', tags: ['loyal', 'virtue'], w: 2, tone: 'humble' },
  { id: 'f_yan4', zh: '晏', th: 'เยี้ยน', mean: 'สงบเงียบ ราบเรียบไร้คลื่นลม', tags: ['harmony'], w: 3, tone: 'humble' },

  // ---- soft: bright, warm, joyful, seasonal ----
  { id: 'f_chun1', zh: '春', th: 'ชุน', mean: 'ฤดูใบไม้ผลิ ชีวิตใหม่ที่เบ่งบาน', tags: ['fortune', 'gentle'], w: 5, tone: 'soft' },
  { id: 'f_le4', zh: '樂', th: 'เล่อ', mean: 'ความสุขรื่นเริง ชื่นบานใจ', tags: ['harmony', 'fortune'], w: 4, tone: 'soft' },
  { id: 'f_huan1', zh: '歡', th: 'ฮวน', mean: 'สุขสำราญ ร่าเริงใจ', tags: ['harmony'], w: 2, tone: 'soft' },
  { id: 'f_xu4', zh: '煦', th: 'ซวี่', mean: 'อบอุ่นดั่งแสงตะวันต้นฤดู', tags: ['gentle', 'harmony'], w: 3, tone: 'soft' },
  { id: 'f_qing2', zh: '晴', th: 'ฉิง', mean: 'ฟ้าแจ่มใส ใจแจ่มใสเบิกบาน', tags: ['harmony'], w: 3, tone: 'soft' },
  { id: 'f_xi3', zh: '禧', th: 'ซี่', mean: 'สิริมงคลและความสุขที่ฟ้าประทาน', tags: ['fortune'], w: 6, tone: 'soft', hist: '慈禧 พระสมัญญาของไทเฮาฉือสี่ มีอักษร 禧' },
  { id: 'f_qiu1', zh: '秋', th: 'ชิว', mean: 'ฤดูเก็บเกี่ยว ผลบุญสุกงอม สงบนิ่ง', tags: ['harmony', 'fortune'], w: 2, tone: 'soft' },
  { id: 'f_yu2', zh: '愉', th: 'อวี๋', mean: 'เบิกบานสุขใจ ยิ้มแย้มอ่อนโยน', tags: ['harmony', 'gentle'], w: 7, tone: 'soft', hist: '愉貴妃 สนมของเฉียนหลง พระมารดาองค์ชายห้า (永琪)' },
  { id: 'f_xue3', zh: '雪', th: 'เซวี่ย', mean: 'ขาวบริสุทธิ์ดั่งหิมะ ใจใสไร้มลทิน', tags: ['gentle', 'virtue'], w: 2, tone: 'soft' },

  // ---- plain: fortune, wisdom, strength, loyalty ----
  { id: 'f_ji2', zh: '吉', th: 'จี๋', mean: 'มงคลโชคดี ปลอดภัยทุกประการ', tags: ['fortune'], w: 5 },
  { id: 'f_xin1', zh: '忻', th: 'ซิน', mean: 'ปีติยินดี ใจเบิกบาน', tags: ['harmony', 'fortune'], w: 5, hist: '忻貴妃 สนมของเฉียนหลง' },
  { id: 'f_tong2', zh: '彤', th: 'ถง', mean: 'สีแดงชาดมงคล ความสว่างไสว', tags: ['fortune', 'beauty'], w: 4, hist: '彤貴妃 สนมของเต้ากวง' },
  { id: 'f_you4', zh: '佑', th: 'โย่ว', mean: 'ฟ้าคุ้มครองอวยพรให้ปลอดภัย', tags: ['fortune'], w: 3, hist: '慈禧端佑康頤… พระสมัญญาของไทเฮาฉือสี่ มีอักษร 佑' },
  { id: 'f_ying3', zh: '穎', th: 'อิ่ง', mean: 'เฉลียวฉลาดเป็นเลิศ หลักแหลมเหนือผู้อื่น', tags: ['wisdom'], w: 5 },
  { id: 'f_lang3', zh: '朗', th: 'หลาง', mean: 'แจ่มใสเปิดเผย ใจสว่างไม่ขุ่นมัว', tags: ['wisdom', 'harmony'], w: 3 },
  { id: 'f_zhi4', zh: '智', th: 'จื้อ', mean: 'ปัญญาลึกซึ้ง รอบรู้และเฉียบคม', tags: ['wisdom'], w: 3 },
  { id: 'f_bao3', zh: '寶', th: 'เป่า', mean: 'ล้ำค่าดั่งแก้ววิเศษ เป็นที่รักหวงแหน', tags: ['fortune', 'beauty'], w: 2 },
  { id: 'f_pei4', zh: '沛', th: 'เพ่ย', mean: 'บริบูรณ์ล้นเหลือ โชคและพลังไหลมาไม่ขาดสาย', tags: ['fortune', 'strong'], w: 2 },
  { id: 'f_yao4', zh: '曜', th: 'เย่า', mean: 'ส่องประกายเจิดจ้า เกียรติรุ่งโรจน์', tags: ['fortune', 'strong'], w: 3 },
  { id: 'f_you1', zh: '悠', th: 'โย', mean: 'ยืนยาวสงบ ใจเย็นไม่รีบร้อน', tags: ['harmony'], w: 2 },
  { id: 'f_ming2', zh: '明', th: 'หมิง', mean: 'สว่างแจ้ง ฉลาดรู้แจ้งเห็นจริง', tags: ['wisdom'], w: 3 },
  { id: 'f_han2', zh: '涵', th: 'หาน', mean: 'ใจกว้างหยั่งลึก บ่มเพาะปัญญาอย่างสงบ', tags: ['wisdom', 'harmony'], w: 2 },
  { id: 'f_ping2', zh: '平', th: 'ผิง', mean: 'ราบรื่นสงบเสมอกัน ไร้ความขัดแย้ง', tags: ['harmony'], w: 3, hist: '平妃 สนมของคังซี' },
  { id: 'f_tong1', zh: '通', th: 'ทง', mean: 'รู้แจ้งทะลุปรุโปร่ง เข้าใจทุกสิ่ง', tags: ['wisdom', 'harmony'], w: 2 },
  { id: 'f_sheng1', zh: '昇', th: 'เซิง', mean: 'ก้าวสูงขึ้นดั่งอาทิตย์อุทัย', tags: ['fortune', 'strong'], w: 2 },
  { id: 'f_yong3', zh: '永', th: 'หย่ง', mean: 'ยืนยาวไม่สิ้นสุด มั่นคงตราบนิรันดร์', tags: ['harmony', 'loyal'], w: 2 },
  { id: 'f_xuan1', zh: '宣', th: 'เซวียน', mean: 'เผยแผ่ความดี ประกาศเกียรติคุณ', tags: ['virtue', 'wisdom'], w: 3, hist: '宣妃 สนมของคังซี' },
  { id: 'f_yun4', zh: '蘊', th: 'อวิ่น', mean: 'ปัญญาและความดีสะสมลึกซึ้งในใจ', tags: ['wisdom', 'virtue'], w: 2 },
  { id: 'f_dan1', zh: '丹', th: 'ตาน', mean: 'สีแดงชาดมงคล ใจซื่อภักดีดั่งดวงใจสีแดง', tags: ['loyal', 'fortune'], w: 2 },
  { id: 'f_zhuo2', zh: '卓', th: 'จั๋ว', mean: 'โดดเด่นเป็นเลิศ สูงส่งเหนือสามัญ', tags: ['wisdom', 'strong'], w: 2 },
  { id: 'f_shan4', zh: '善', th: 'ซั่น', mean: 'ดีงามมีเมตตา ทำแต่สิ่งอันเป็นกุศล', tags: ['virtue', 'gentle'], w: 3 },
  { id: 'f_man4', zh: '曼', th: 'ม่าน', mean: 'งามอ่อนช้อยนุ่มนวล ทอดยาวไม่สิ้นสุด', tags: ['beauty', 'gentle'], w: 2 },
  { id: 'f_zhan4', zh: '湛', th: 'จั้น', mean: 'ลึกซึ้งใสสงบ ปัญญาใสดั่งน้ำนิ่ง', tags: ['wisdom', 'harmony'], w: 2 },
  { id: 'f_hong2', zh: '宏', th: 'หง', mean: 'กว้างขวางยิ่งใหญ่ ใจและปัญญากว้างไกล', tags: ['strong', 'wisdom'], w: 2 },
  { id: 'f_he4', zh: '賀', th: 'เฮ่อ', mean: 'อวยพรและยินดี เป็นนิมิตแห่งความชื่นชม', tags: ['fortune'], w: 2 },
  { id: 'f_guang1', zh: '光', th: 'กวง', mean: 'รัศมีและเกียรติศักดิ์ที่เจิดจ้า', tags: ['fortune', 'strong'], w: 2 }
);
