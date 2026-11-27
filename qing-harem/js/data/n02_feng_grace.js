/* n02_feng_grace.js — ฉายาพระราชทาน (封號 fenghao) · กลุ่ม B : โฉมงาม · อ่อนโยน · สง่างาม · ศิลป์ · หยกและแสงเรืองรอง
   Pool of ONE-character fenghao for Q.NAMING.feng (schema: docs/DESIGN.md §12 · checker: node tools/namelint.js).
   Plain script: it only pushes data, no events. Hanzi are TRADITIONAL (as on Qing documents / the title card).
   Reserved to NPCs (never used here): 舒 怡 嘉 懿.
   Seeds deliberately NOT used, and why:
     儀 (อี๋) = same Thai reading as 怡 -> อี๋ผิน (NPC) · 琬 = homophone of 婉 · 姝 書 (ซู) = reading of ซูเฟย
     琪 琦 (ฉี) = reading of the maid clan ฉี in Q.NAMING.maidClans
     璐 (ลู่) = อี๋ผิน · 梅 (เหมย) = เหมยชิง · 琴 (ฉิน) = ป้าฉิน · 蕙 = homophone of 惠/慧 (ฮุ่ย) in the virtue pool
     婕 = a Han-dynasty rank word (婕妤), not a Qing fenghao · 瑞 left to unit n03 · 菊 畫 = unnatural as titles
   Readings: Thai-subtitle style, 4th tone marked (ลี่ ซิ่ว), 2nd tone marked only where the consonant needs it (อวี๋ อิ๋ง อวิ๋น),
   the game's existing spellings kept (เหยา หลาน เยวี่ยน เซวียน จิ่น). 琳 is written ลิน because หลิน is the clan Lin (blocked).
   Known shared reading (lint warning only): 珮 เพ่ย = 沛 (n03 f_pei4).
   hist = only what is solidly attested; deliberately left off the many characters that are merely plausible.
   w: 8-10 historically common · 5-7 well attested · 2-4 plausible but rare in Qing records · 1-2 poetic only. */
Q.NAMING.feng.push(
  // ---- gentle · graceful · fair (soft) ----
  { id: 'f_wan', zh: '婉', th: 'หว่าน', mean: 'อ่อนโยนนุ่มนวล งามอย่างมีมารยาท', tags: ['gentle', 'beauty'], w: 9, tone: 'soft', hist: '婉貴妃 สนมชั้นกุ้ยเฟยสมัยจักรพรรดิเฉียนหลง' },
  { id: 'f_xian_g', zh: '嫻', th: 'เสียน', mean: 'สง่างามเรียบร้อย รู้ธรรมเนียมกิริยาดี', tags: ['gentle', 'virtue'], w: 8, tone: 'soft', hist: '嫻妃 ต่อมาเลื่อนเป็น 嫻貴妃 สกุลอู๋ลาน่าลา สมัยเฉียนหลง ภายหลังได้เป็นฮองเฮา' },
  { id: 'f_rou', zh: '柔', th: 'โหรว', mean: 'อ่อนหวานนุ่มนวล ไม่แข็งกร้าว', tags: ['gentle'], w: 3, tone: 'humble' },
  { id: 'f_ya', zh: '雅', th: 'หยา', mean: 'สง่างามละเมียดละไม มีรสนิยมสูง', tags: ['art', 'gentle'], w: 4, tone: 'soft' },
  { id: 'f_tian', zh: '恬', th: 'เถียน', mean: 'สงบเรียบง่าย พอใจในสิ่งที่มี', tags: ['harmony', 'gentle'], w: 4, tone: 'humble' },
  { id: 'f_ting', zh: '婷', th: 'ถิง', mean: 'ร่างระหงงามสง่า', tags: ['beauty', 'gentle'], w: 3, tone: 'soft' },
  { id: 'f_juan', zh: '娟', th: 'เจวียน', mean: 'งามละเมียดอ่อนช้อย', tags: ['beauty', 'gentle'], w: 3, tone: 'soft' },
  { id: 'f_chan', zh: '嬋', th: 'ฉาน', mean: 'งามอ่อนช้อย ดุจแสงจันทร์', tags: ['beauty', 'art'], w: 3, tone: 'soft' },
  { id: 'f_yan', zh: '妍', th: 'เหยียน', mean: 'งดงามสะสวย เปล่งปลั่ง', tags: ['beauty'], w: 4, tone: 'soft' },
  { id: 'f_yan2', zh: '嫣', th: 'เยียน', mean: 'ยิ้มงามละมุน มีเสน่ห์', tags: ['beauty'], w: 3, tone: 'soft' },
  { id: 'f_yan3', zh: '嬿', th: 'เยี่ยน', mean: 'งามสงบ อ่อนหวานละมุน', tags: ['beauty', 'gentle'], w: 2, tone: 'soft' },
  { id: 'f_li_g', zh: '麗', th: 'ลี่', mean: 'งดงามเลิศ เปล่งปลั่งสะดุดตา', tags: ['beauty'], w: 6, hist: '麗貴妃 สนมสมัยจักรพรรดิเสียนเฟิง' },
  { id: 'f_rong_g', zh: '容', th: 'หรง', mean: 'โฉมงามสงบ ใจกว้างอดกลั้น', tags: ['beauty', 'virtue'], w: 7, hist: '容妃 สนมชาวอุยกูร์ของจักรพรรดิเฉียนหลง ต้นเค้าตำนานเซียงเฟย' },
  { id: 'f_xiu', zh: '秀', th: 'ซิ่ว', mean: 'งามเด่นสะอาดตา ผุดผ่อง ปัญญาเฉียบคม พรสวรรค์เป็นที่ประจักษ์', tags: ['beauty', 'wisdom', 'art'], w: 3, tone: 'soft' },
  { id: 'f_qian_g', zh: '倩', th: 'เชี่ยน', mean: 'งามน่ารัก ยิ้มพราย', tags: ['beauty'], w: 3, tone: 'soft' },
  { id: 'f_fang', zh: '芳', th: 'ฟาง', mean: 'หอมกรุ่น ชื่อเสียงงามขจรไกล', tags: ['beauty', 'virtue'], w: 3, tone: 'soft' },
  // ---- jade (玉) ----
  { id: 'f_yao', zh: '瑤', th: 'เหยา', mean: 'หยกงามล้ำค่า ดุจวิมานเทพ', tags: ['beauty'], w: 4, tone: 'grand' },
  { id: 'f_qiong', zh: '瓊', th: 'ฉยง', mean: 'หยกวิเศษ งามเลิศเลอ', tags: ['beauty'], w: 4, tone: 'grand' },
  { id: 'f_lin', zh: '琳', th: 'ลิน', mean: 'หยกงาม เสียงกังวานใส', tags: ['beauty', 'art'], w: 4, tone: 'soft' },
  { id: 'f_yu_g', zh: '瑜', th: 'อวี๋', mean: 'หยกเปล่งประกาย บ่งถึงคุณงามความดี', tags: ['beauty', 'virtue'], w: 7, tone: 'grand', hist: '瑜妃 สนมของจักรพรรดิถงจื้อ' },
  { id: 'f_jin_g', zh: '瑾', th: 'จิ่น', mean: 'หยกล้ำค่า คุณธรรมอันงดงาม', tags: ['virtue', 'beauty'], w: 8, tone: 'grand', hist: '瑾妃 สนมของจักรพรรดิกวงซวี่ พี่สาวของ 珍妃' },
  { id: 'f_xun_g', zh: '珣', th: 'สวิน', mean: 'หยกงามล้ำค่า', tags: ['beauty'], w: 4, hist: '珣妃 สนมของจักรพรรดิถงจื้อ' },
  { id: 'f_jin2', zh: '瑨', th: 'จิ้น', mean: 'หยกงามใสสะอาด', tags: ['beauty'], w: 2 },
  { id: 'f_zhen_g', zh: '珍', th: 'เจิน', mean: 'ล้ำค่า เป็นที่รักหวงแหน', tags: ['beauty', 'fortune'], w: 7, tone: 'grand', hist: '珍妃 สนมคนโปรดของจักรพรรดิกวงซวี่ น้องสาวของ 瑾妃' },
  { id: 'f_ying', zh: '瑛', th: 'อิง', mean: 'ประกายหยกใส เจิดจรัส', tags: ['beauty'], w: 4, tone: 'soft' },
  { id: 'f_ying2', zh: '瑩', th: 'อิ๋ง', mean: 'ใสบริสุทธิ์ เปล่งประกายดั่งหยกขัดมัน', tags: ['beauty', 'wisdom'], w: 4, tone: 'soft' },
  { id: 'f_jing_g', zh: '璟', th: 'จิ่ง', mean: 'ประกายหยกเรืองรอง', tags: ['beauty'], w: 2 },
  { id: 'f_xuan', zh: '璇', th: 'เสวียน', mean: 'หยกงามประดุจดวงดาว', tags: ['beauty', 'wisdom'], w: 3 },
  { id: 'f_ling', zh: '玲', th: 'หลิง', mean: 'เสียงหยกกังวานใส เฉลียวฉลาดคล่องแคล่ว', tags: ['beauty', 'wisdom', 'art'], w: 3, tone: 'soft' },
  { id: 'f_jue', zh: '珏', th: 'เจวี๋ย', mean: 'หยกคู่ งามเสมอกันดุจแฝด', tags: ['beauty', 'harmony'], w: 2 },
  { id: 'f_jun', zh: '珺', th: 'จวิ้น', mean: 'หยกงามบริสุทธิ์', tags: ['beauty'], w: 2 },
  { id: 'f_shan', zh: '珊', th: 'ซาน', mean: 'ปะการังงาม ของล้ำค่าจากทะเล', tags: ['beauty'], w: 2, tone: 'soft' },
  { id: 'f_yue', zh: '玥', th: 'เยว่', mean: 'ไข่มุกวิเศษในตำนาน', tags: ['beauty', 'fortune'], w: 2, tone: 'soft' },
  { id: 'f_xuan2', zh: '瑄', th: 'เซวียน', mean: 'หยกพิธีทรงกลมอันสูงส่ง', tags: ['beauty', 'virtue'], w: 2, tone: 'grand' },
  { id: 'f_ke_g', zh: '珂', th: 'เคอ', mean: 'หยกขาวเนื้อละเอียด', tags: ['beauty'], w: 2 },
  { id: 'f_yuan', zh: '瑗', th: 'เยวี่ยน', mean: 'หยกวงแหวนใหญ่ ของพระราชทานจากฮ่องเต้', tags: ['beauty', 'virtue'], w: 2 },
  { id: 'f_heng_g', zh: '珩', th: 'เหิง', mean: 'หยกประดับเครื่องแต่งกาย สง่ามีระเบียบ', tags: ['virtue', 'beauty'], w: 2 },
  { id: 'f_wei', zh: '瑋', th: 'เหว่ย', mean: 'หยกวิเศษ ล้ำค่าโดดเด่น', tags: ['beauty'], w: 3, tone: 'grand' },
  { id: 'f_pei', zh: '珮', th: 'เพ่ย', mean: 'หยกห้อยเอว สง่าตามแบบแผน', tags: ['beauty', 'gentle'], w: 2, tone: 'soft' },
  // ---- radiance · splendour ----
  { id: 'f_xi_g', zh: '熙', th: 'ซี', mean: 'รุ่งโรจน์เจิดจ้า อบอุ่นสงบสุข', tags: ['harmony', 'fortune'], w: 4, tone: 'grand' },
  { id: 'f_hui_g', zh: '暉', th: 'ฮุย', mean: 'แสงตะวันเรืองรอง', tags: ['beauty', 'fortune'], w: 3, tone: 'grand' },
  { id: 'f_hua', zh: '華', th: 'ฮวา', mean: 'รุ่งเรืองงดงาม สง่าผ่าเผย', tags: ['beauty', 'art'], w: 4, tone: 'grand' },
  { id: 'f_cai', zh: '采', th: 'ไฉ่', mean: 'สง่างามมีสีสัน เปี่ยมศิลปะ', tags: ['beauty', 'art'], w: 3, tone: 'soft' },
  { id: 'f_jiao', zh: '皎', th: 'เจี่ยว', mean: 'ขาวสว่างนวลใส ดุจแสงจันทร์', tags: ['beauty'], w: 2, tone: 'soft' },
  { id: 'f_huan', zh: '煥', th: 'ฮ่วน', mean: 'เจิดจ้า เปล่งประกายสดใหม่', tags: ['beauty', 'fortune'], w: 2, tone: 'grand' },
  // ---- fragrance · arts ----
  { id: 'f_xin_g', zh: '馨', th: 'ซิน', mean: 'กลิ่นหอมไกล ดุจคุณงามความดีที่ขจรขจาย', tags: ['virtue', 'gentle'], w: 4, tone: 'soft' },
  { id: 'f_fen', zh: '芬', th: 'เฟิน', mean: 'หอมกรุ่น เกียรติคุณขจรไกล', tags: ['beauty', 'virtue'], w: 3, tone: 'soft' },
  { id: 'f_yun_g', zh: '韻', th: 'อวิ้น', mean: 'ท่วงทำนองไพเราะ ความงามละมุนละไม', tags: ['art', 'gentle'], w: 3, tone: 'soft' },
  { id: 'f_shi', zh: '詩', th: 'ซือ', mean: 'บทกวีงาม ความละเมียดทางปัญญา', tags: ['art', 'wisdom'], w: 2, tone: 'soft' },
  // ---- the few flowers / imagery (rare for Qing consorts: low w) ----
  { id: 'f_lan', zh: '蘭', th: 'หลาน', mean: 'กล้วยไม้ สง่าเรียบง่าย กลิ่นหอมสงบ ดอกไม้คู่บัณฑิตและกวี', tags: ['gentle', 'virtue', 'art'], w: 3, tone: 'humble', hist: '蘭貴人 ฉายาแรกเมื่อเข้าวังสมัยเสียนเฟิง ของสนมผู้ต่อมาเป็นไทเฮา' },
  { id: 'f_lian_g', zh: '蓮', th: 'เหลียน', mean: 'ดอกบัว บริสุทธิ์ไม่แปดเปื้อน ดอกไม้ที่กวีเอ่ยชมมาแต่โบราณ', tags: ['virtue', 'gentle', 'art'], w: 2, tone: 'humble' },
  { id: 'f_yun2', zh: '雲', th: 'อวิ๋น', mean: 'เมฆลอยเบาสงบ งามอ่อนช้อย', tags: ['beauty', 'art'], w: 2, tone: 'soft' }
);
