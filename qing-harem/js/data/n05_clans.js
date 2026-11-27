/* n05_clans.js — Q.NAMING.clans (the CLAN / family-name pool) + Q.NAMING.girlNames (extra given names for generated xiunü).
   Docs: docs/DESIGN.md §12. Only assigns those two pools (no events).

   WHY CLANS: below rank 4 (ผิน) a concubine is called by CLAN + rank ("เซิ่น ฉังไจ้", "กวาเอ่อร์เจีย กุ้ยเหริน").
   Every clan is a real Qing family-name (hala / surname); the game is fiction but the names are not.
   Fields as in §12: kind manchu|mongol|hanjun|han · side civil|military|neutral · power 1..3 (3 = great house, kept rare) · w commonness 1..10.
   banner = a plausible banner of that family in the Eight Banners (families were spread over several banners, so this is flavour, not a claim
            that the family sat in exactly one). Han civil families carry NO banner. Bordered (ขลิบ) = 镶 · plain = 正.
   for    = which player origin may use the clan as HER OWN clan: the defaults are กวาเอ่อร์เจีย (noble) · เซิ่น (scholar) · หลิว (maid) at w 10;
            a few lesser Manchu clans (noble) and Han scholar houses (scholar) carry the same tag as optional variety — their w also doubles as
            their commonness among generated girls. The engine currently uses Q.NAMING.defaultClan and Q.NAMING.maidClans, so the extra tags
            are harmless until a screen reads them.

   READINGS (Thai-subtitle style, same hand as the existing game data): 乌 → อู๋ (matches the game's อู๋ซูหลี่) · 鄂 → เอ๋อ (matches ตงเอ๋อ) ·
            尔 → เอ่อร์ (กวาเอ่อร์เจีย) · 赫 → เหอ (เหอเสอหลี่) · 那拉 → น่าลา · 觉罗 → เจวี๋ยหลัว · 佳 → เจีย · 沁 → ชิ่น (kept apart from ฉิน = Mama Qin).
   Only the four-tone marks that Thai readers expect are written (1st/2nd tone unmarked, except where unmarked would collide with a different clan).

   DELIBERATELY ABSENT (they are the surnames of named NPCs, a generated girl with the same clan would read as a relative or a clone):
            陆 ลู่ (Lu Pin) · 楚 ฉู่ (Chu Guiren) · 谢 เซี่ย (Dr Xie) · 秦 ฉิน (Mama Qin) · 梅 เหมย (Meixing) · 苏/舒 ซู (Shu Fei, ซูมู่ลู่ is Manchu and is kept) ·
            夏 เซี่ย · 章 จาง (= 张) · 易 อี้ · 文 เหวิน (Dowager's เหวินเซี่ยน) · 爱新觉罗 (the imperial house itself).
   NOTE zh: the lint/engine allow 1..4 hanzi, so Borjigit is written in its four-character Qing form 博尔济锦 (Borjigin) instead of 博尔济吉特.
   NOTE 阿鲁特: Qing registers put the Aluteh in the Mongol Plain Blue Banner, but the game already lists it as a Manchu clan (Q.XIUNU.manchu), so it stays 'manchu'.
   NOTE Han-banner (hanjun) surnames are kept distinct from the Han list (a Thai reading may appear only once), so e.g. 杨 范 洪 孟 孔 孙 曹 田 live in hanjun and not in han.
   NOTE collision rule (DESIGN §12): no clan reading equals a fenghao/extra reading of n01-n04. Surnames whose natural reading is already a fenghao were left out
        (郑=正 钱=謙 韩=涵 袁=元 钟=忠 方=芳 康=康 邱=秋 龙=隆 常=常 龚=恭 严=妍 叶=燁 程=誠 俞=瑜 薛 宁=寧 郎=朗 姚=瑤) or respelled (洪 ฮง, 佟 ท่ง, 田 เทียน).
        The single exception is the REQUIRED maid clan 何 เหอ, whose reading equals fenghao 和 เหอ (n03): a different hanzi with the same sound; a clan name is
        only used below ผิน (or before a fenghao is bestowed), so no woman wears both at once. Flagged for the integrator. */

Q.NAMING.clans.push(
  /* ═══ MANCHU 满洲 (38) ═══ */
  { id: 'c_niohuru', th: 'หนิ่วฮู่ลู่', zh: '钮祜禄', kind: 'manchu', side: 'military', power: 3, banner: 'ธงเหลืองขลิบ', w: 7 },
  { id: 'c_gualgiya', th: 'กวาเอ่อร์เจีย', zh: '瓜尔佳', kind: 'manchu', side: 'military', power: 2, banner: 'ธงเหลืองขลิบ', w: 10, for: ['noble'] },
  { id: 'c_fuca', th: 'ฟู่ฉา', zh: '富察', kind: 'manchu', side: 'civil', power: 3, banner: 'ธงเหลืองขลิบ', w: 7 },
  { id: 'c_ulanara', th: 'อู๋ลาน่าลา', zh: '乌拉那拉', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงเหลืองขลิบ', w: 5 },
  { id: 'c_hesheri', th: 'เหอเสอหลี่', zh: '赫舍里', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงเหลือง', w: 6 },
  { id: 'c_tunggiya', th: 'ท่งเจีย', zh: '佟佳', kind: 'manchu', side: 'civil', power: 3, banner: 'ธงเหลืองขลิบ', w: 5 },
  { id: 'c_sumuru', th: 'ซูมู่ลู่', zh: '舒穆禄', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงขาว', w: 5 },
  { id: 'c_donggo', th: 'ตงเอ๋อ', zh: '董鄂', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงขาว', w: 5 },
  { id: 'c_wanyan', th: 'ว่านหยาน', zh: '完颜', kind: 'manchu', side: 'military', power: 3, banner: 'ธงขาวขลิบ', w: 5 },
  { id: 'c_hoifa_nara', th: 'ฮุยฟาน่าลา', zh: '辉发那拉', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงแดง', w: 3 },
  { id: 'c_yehe_nara', th: 'เย่เหอน่าลา', zh: '叶赫那拉', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงน้ำเงินขลิบ', w: 6 },
  { id: 'c_hada_nara', th: 'ฮาต๋าน่าลา', zh: '哈达那拉', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงขาวขลิบ', w: 3 },
  { id: 'c_tatara', th: 'ทาท่าล่า', zh: '他塔喇', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงแดงขลิบ', w: 4, for: ['noble'] },
  { id: 'c_gioro', th: 'เจวี๋ยหลัว', zh: '觉罗', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงน้ำเงิน', w: 3 },
  { id: 'c_xilin_gioro', th: 'ซีหลินเจวี๋ยหลัว', zh: '西林觉罗', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงน้ำเงิน', w: 3 },
  { id: 'c_magiya', th: 'หม่าเจีย', zh: '马佳', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงเหลืองขลิบ', w: 5, for: ['noble'] },
  { id: 'c_fimo', th: 'เฟ่ยโม่', zh: '费莫', kind: 'manchu', side: 'military', power: 1, banner: 'ธงแดง', w: 4, for: ['noble'] },
  { id: 'c_janggiya', th: 'จางเจีย', zh: '章佳', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงขาว', w: 5, for: ['noble'] },
  { id: 'c_sochoro', th: 'ซั่วฉั่วหลัว', zh: '索绰罗', kind: 'manchu', side: 'civil', power: 1, banner: 'ธงเหลือง', w: 4, for: ['noble'] },
  { id: 'c_dunggo', th: 'ต้งเอ๋อ', zh: '栋鄂', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงขาว', w: 3 },
  { id: 'c_usuri', th: 'อู๋ซูหลี่', zh: '乌苏里', kind: 'manchu', side: 'military', power: 2, banner: 'ธงแดง', w: 4 },
  { id: 'c_alute', th: 'อาลู่เทอ', zh: '阿鲁特', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงน้ำเงิน', w: 3 },
  { id: 'c_uya', th: 'อู๋หย่า', zh: '乌雅', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงเหลือง', w: 4, for: ['noble'] },
  { id: 'c_gorolo', th: 'กั๋วลั่วหลัว', zh: '郭络罗', kind: 'manchu', side: 'military', power: 2, banner: 'ธงเหลืองขลิบ', w: 4 },
  { id: 'c_hitara', th: 'ซี่ท่าล่า', zh: '喜塔腊', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงขาว', w: 3 },
  { id: 'c_daigiya', th: 'ไต้เจีย', zh: '戴佳', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงน้ำเงินขลิบ', w: 3 },
  { id: 'c_susu_gioro', th: 'ซูซูเจวี๋ยหลัว', zh: '舒舒觉罗', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงขาวขลิบ', w: 2 },
  { id: 'c_wanliuha', th: 'ว่านหลิวฮา', zh: '万琉哈', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงแดงขลิบ', w: 2 },
  { id: 'c_sakda', th: 'ซ่าเค่อต๋า', zh: '萨克达', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงขาวขลิบ', w: 3 },
  { id: 'c_gogiya', th: 'กั๋วเจีย', zh: '郭佳', kind: 'manchu', side: 'civil', power: 2, banner: 'ธงน้ำเงินขลิบ', w: 3 },
  { id: 'c_hougiya', th: 'โหวเจีย', zh: '侯佳', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงแดง', w: 2 },
  { id: 'c_gualca', th: 'กวาเอ่อร์ฉา', zh: '瓜尔察', kind: 'manchu', side: 'military', power: 1, banner: 'ธงเหลือง', w: 3 },
  { id: 'c_saji_fuca', th: 'ซาจี้ฟู่ฉา', zh: '沙济富察', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงเหลืองขลิบ', w: 2 },
  { id: 'c_neyen_fuca', th: 'เน่ออินฟู่ฉา', zh: '讷殷富察', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงขาว', w: 2 },
  { id: 'c_totoke', th: 'ทัวเท่อเค่อ', zh: '托忒克', kind: 'manchu', side: 'civil', power: 1, banner: 'ธงขาว', w: 2 },
  { id: 'c_baergesi', th: 'ไป้เอ่อร์เก๋อซือ', zh: '拜尔葛斯', kind: 'manchu', side: 'neutral', power: 1, banner: 'ธงเหลือง', w: 2 },
  { id: 'c_gobulo', th: 'กั๋วปู้หลัว', zh: '郭布罗', kind: 'manchu', side: 'neutral', power: 2, banner: 'ธงขาว', w: 3 },
  { id: 'c_yanja', th: 'เหยียนจา', zh: '颜扎', kind: 'manchu', side: 'civil', power: 1, banner: 'ธงเหลือง', w: 2 },

  /* ═══ MONGOL 蒙古 (10) ═══ */
  { id: 'c_borjigin', th: 'ป๋อเอ่อร์จี้จิ่น', zh: '博尔济锦', kind: 'mongol', side: 'neutral', power: 3, banner: 'ธงเหลืองขลิบ', w: 6 },
  { id: 'c_ucigeri', th: 'อู๋ฉีเก๋อหลี่', zh: '乌齐格里', kind: 'mongol', side: 'civil', power: 2, banner: 'ธงแดง', w: 2 },
  { id: 'c_badai', th: 'ปาไต้', zh: '巴岱', kind: 'mongol', side: 'military', power: 1, banner: 'ธงน้ำเงินขลิบ', w: 2 },
  { id: 'c_uriankhai', th: 'อู๋เหลียงไห่', zh: '乌梁海', kind: 'mongol', side: 'military', power: 1, banner: 'ธงขาว', w: 2 },
  { id: 'c_jarud', th: 'จาหลู่เท่อ', zh: '札鲁特', kind: 'mongol', side: 'military', power: 2, banner: 'ธงขาวขลิบ', w: 3 },
  { id: 'c_khorchin', th: 'เคอเอ่อร์ชิ่น', zh: '科尔沁', kind: 'mongol', side: 'neutral', power: 2, banner: 'ธงเหลือง', w: 4 },
  { id: 'c_kharachin', th: 'คาล่าชิ่น', zh: '喀喇沁', kind: 'mongol', side: 'military', power: 1, banner: 'ธงแดงขลิบ', w: 2 },
  { id: 'c_chahar', th: 'ฉาฮาเอ่อร์', zh: '察哈尔', kind: 'mongol', side: 'military', power: 2, banner: 'ธงขาว', w: 2 },
  { id: 'c_gorlos', th: 'กั๋วเอ่อร์หลัวซือ', zh: '郭尔罗斯', kind: 'mongol', side: 'neutral', power: 1, banner: 'ธงเหลือง', w: 2 },
  { id: 'c_bairin', th: 'ปาหลิน', zh: '巴林', kind: 'mongol', side: 'neutral', power: 1, banner: 'ธงน้ำเงิน', w: 2 },

  /* ═══ HANJUN 汉军 (Han bannermen, 14) ═══ */
  { id: 'c_hj_tong', th: 'ท่ง', zh: '佟', kind: 'hanjun', side: 'civil', power: 2, banner: 'ธงเหลืองขลิบ', w: 4 },
  { id: 'c_hj_zu', th: 'จู่', zh: '祖', kind: 'hanjun', side: 'military', power: 1, banner: 'ธงเหลือง', w: 3 },
  { id: 'c_hj_nian', th: 'เหนียน', zh: '年', kind: 'hanjun', side: 'military', power: 2, banner: 'ธงขาวขลิบ', w: 5 },
  { id: 'c_hj_geng', th: 'เกิ่ง', zh: '耿', kind: 'hanjun', side: 'military', power: 1, banner: 'ธงเหลือง', w: 3 },
  { id: 'c_hj_shang', th: 'ซ่าง', zh: '尚', kind: 'hanjun', side: 'military', power: 2, banner: 'ธงน้ำเงินขลิบ', w: 3 },
  { id: 'c_hj_hong', th: 'ฮง', zh: '洪', kind: 'hanjun', side: 'civil', power: 2, banner: 'ธงเหลืองขลิบ', w: 3 },
  { id: 'c_hj_fan', th: 'ฟ่าน', zh: '范', kind: 'hanjun', side: 'civil', power: 2, banner: 'ธงเหลืองขลิบ', w: 4 },
  { id: 'c_hj_cai', th: 'ไช่', zh: '蔡', kind: 'hanjun', side: 'civil', power: 1, banner: 'ธงน้ำเงิน', w: 3 },
  { id: 'c_hj_kong', th: 'ข่ง', zh: '孔', kind: 'hanjun', side: 'military', power: 1, banner: 'ธงแดง', w: 3 },
  { id: 'c_hj_yang', th: 'หยาง', zh: '杨', kind: 'hanjun', side: 'civil', power: 1, banner: 'ธงขาวขลิบ', w: 4 },
  { id: 'c_hj_meng', th: 'เมิ่ง', zh: '孟', kind: 'hanjun', side: 'civil', power: 1, banner: 'ธงขาว', w: 3 },
  { id: 'c_hj_cao', th: 'เฉา', zh: '曹', kind: 'hanjun', side: 'civil', power: 1, banner: 'ธงขาว', w: 3 },
  { id: 'c_hj_sun', th: 'ซุน', zh: '孙', kind: 'hanjun', side: 'military', power: 1, banner: 'ธงขาว', w: 3 },
  { id: 'c_hj_tian', th: 'เทียน', zh: '田', kind: 'hanjun', side: 'civil', power: 1, banner: 'ธงเหลือง', w: 3 },

  /* ═══ HAN 汉 — scholarly and common surnames (no banner) ═══ */
  /* the eight already used by Q.XIUNU.han, same sides/powers */
  { id: 'c_h_li3', th: 'หลี่', zh: '李', kind: 'han', side: 'civil', power: 1, w: 8 },
  { id: 'c_h_zhang1', th: 'จาง', zh: '张', kind: 'han', side: 'civil', power: 1, w: 8 },
  { id: 'c_h_wang2', th: 'หวัง', zh: '王', kind: 'han', side: 'neutral', power: 1, w: 8 },
  { id: 'c_h_chen2', th: 'เฉิน', zh: '陈', kind: 'han', side: 'civil', power: 2, w: 7 },
  { id: 'c_h_lin2', th: 'หลิน', zh: '林', kind: 'han', side: 'neutral', power: 1, w: 6 },
  { id: 'c_h_xu2', th: 'สวี', zh: '徐', kind: 'han', side: 'civil', power: 1, w: 6, for: ['scholar'] },
  { id: 'c_h_zhou1', th: 'โจว', zh: '周', kind: 'han', side: 'neutral', power: 1, w: 6, for: ['scholar'] },
  { id: 'c_h_gao1', th: 'เกา', zh: '高', kind: 'han', side: 'military', power: 1, w: 5 },
  /* scholar default */
  { id: 'c_h_shen3', th: 'เซิ่น', zh: '沈', kind: 'han', side: 'civil', power: 1, w: 10, for: ['scholar'] },
  /* maid (commoner) surnames, in the game's maidClans order */
  { id: 'c_h_liu2', th: 'หลิว', zh: '刘', kind: 'han', side: 'neutral', power: 1, w: 10, for: ['maid'] },
  { id: 'c_h_huang2', th: 'หวง', zh: '黄', kind: 'han', side: 'neutral', power: 1, w: 6, for: ['maid'] },
  { id: 'c_h_ma3', th: 'หม่า', zh: '马', kind: 'han', side: 'neutral', power: 1, w: 5, for: ['maid'] },
  { id: 'c_h_zhu1', th: 'จู', zh: '朱', kind: 'han', side: 'neutral', power: 1, w: 5, for: ['maid'] },
  { id: 'c_h_shi2', th: 'สือ', zh: '石', kind: 'han', side: 'neutral', power: 1, w: 4, for: ['maid'] },
  { id: 'c_h_feng2', th: 'เฝิง', zh: '冯', kind: 'han', side: 'neutral', power: 1, w: 4, for: ['maid'] },
  { id: 'c_h_he2', th: 'เหอ', zh: '何', kind: 'han', side: 'neutral', power: 1, w: 5, for: ['maid'] },
  { id: 'c_h_xiao1', th: 'เซียว', zh: '萧', kind: 'han', side: 'neutral', power: 1, w: 4, for: ['maid'] },
  { id: 'c_h_dong3', th: 'ต่ง', zh: '董', kind: 'han', side: 'neutral', power: 1, w: 5, for: ['maid'] },
  { id: 'c_h_tang2', th: 'ถัง', zh: '唐', kind: 'han', side: 'neutral', power: 1, w: 5, for: ['maid'] },
  { id: 'c_h_ding1', th: 'ติ่ง', zh: '丁', kind: 'han', side: 'neutral', power: 1, w: 4, for: ['maid'] },
  { id: 'c_h_qi2', th: 'ฉี', zh: '齐', kind: 'han', side: 'neutral', power: 1, w: 3, for: ['maid'] },
  /* Jiangnan scholarly houses and other common surnames */
  { id: 'c_h_wu2', th: 'อู๋', zh: '吴', kind: 'han', side: 'civil', power: 1, w: 5, for: ['scholar'] },
  { id: 'c_h_zhao4', th: 'จ้าว', zh: '赵', kind: 'han', side: 'neutral', power: 1, w: 5 },
  { id: 'c_h_xu3', th: 'สวี่', zh: '许', kind: 'han', side: 'civil', power: 1, w: 4 },
  { id: 'c_h_deng4', th: 'เติ้ง', zh: '邓', kind: 'han', side: 'military', power: 1, w: 3 },
  { id: 'c_h_fu4', th: 'ฟู่', zh: '傅', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_jiang3', th: 'เจี่ยง', zh: '蒋', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_wei4', th: 'เว่ย', zh: '魏', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_pan1', th: 'พาน', zh: '潘', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_dai4', th: 'ไต้', zh: '戴', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_wang1', th: 'วาง', zh: '汪', kind: 'han', side: 'civil', power: 1, w: 3, for: ['scholar'] },
  { id: 'c_h_ren4', th: 'เริ่น', zh: '任', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_jiang1', th: 'เจียง', zh: '姜', kind: 'han', side: 'neutral', power: 1, w: 3 },
  { id: 'c_h_tan2', th: 'ถาน', zh: '谭', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_liao4', th: 'เหลียว', zh: '廖', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_jin1', th: 'จิน', zh: '金', kind: 'han', side: 'neutral', power: 1, w: 3 },
  { id: 'c_h_hao3', th: 'ห่าว', zh: '郝', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_bai2', th: 'ไป๋', zh: '白', kind: 'han', side: 'neutral', power: 1, w: 3 },
  { id: 'c_h_mao2', th: 'เหมา', zh: '毛', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_hou2', th: 'โหว', zh: '侯', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_wan4', th: 'ว่าน', zh: '万', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_duan4', th: 'ต้วน', zh: '段', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_lei2', th: 'เหลย', zh: '雷', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_li2', th: 'หลี', zh: '黎', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_wu3', th: 'อู่', zh: '武', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_qiao2', th: 'เฉียว', zh: '乔', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_guo1', th: 'กั๋ว', zh: '郭', kind: 'han', side: 'military', power: 1, w: 4 },
  { id: 'c_h_song4', th: 'ซ่ง', zh: '宋', kind: 'han', side: 'civil', power: 1, w: 3 },
  { id: 'c_h_luo2', th: 'หลัว', zh: '罗', kind: 'han', side: 'neutral', power: 1, w: 3 },
  { id: 'c_h_peng2', th: 'เผิง', zh: '彭', kind: 'han', side: 'military', power: 1, w: 2 },
  { id: 'c_h_lv3', th: 'หลวี่', zh: '吕', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_zeng1', th: 'เจิง', zh: '曾', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_du4', th: 'ตู้', zh: '杜', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_weng1', th: 'เวิง', zh: '翁', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_guan3', th: 'กว่าน', zh: '管', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_ruan3', th: 'หร่วน', zh: '阮', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_xiang4', th: 'เซี่ยง', zh: '项', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_ji4', th: 'จี้', zh: '纪', kind: 'han', side: 'civil', power: 1, w: 2 },
  /* compound surnames of old scholarly houses + a few more common ones */
  { id: 'c_h_ouyang', th: 'โอวหยาง', zh: '欧阳', kind: 'han', side: 'civil', power: 1, w: 2, for: ['scholar'] },
  { id: 'c_h_zhuge', th: 'จูเก๋อ', zh: '诸葛', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_sima', th: 'ซือหม่า', zh: '司马', kind: 'han', side: 'civil', power: 1, w: 1 },
  { id: 'c_h_shangguan', th: 'ซ่างกวน', zh: '上官', kind: 'han', side: 'civil', power: 1, w: 1 },
  { id: 'c_h_shao4', th: 'เส้า', zh: '邵', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_yin3', th: 'อิ่น', zh: '尹', kind: 'han', side: 'civil', power: 1, w: 2 },
  { id: 'c_h_ge3', th: 'เก๋อ', zh: '葛', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_gan1', th: 'กาน', zh: '甘', kind: 'han', side: 'neutral', power: 1, w: 2 },
  { id: 'c_h_you2', th: 'โหยว', zh: '尤', kind: 'han', side: 'civil', power: 1, w: 2 }
);

/* ═══ girlNames — given names for generated xiunü (two Thai syllables, Mandarin readings; hanzi in the comment) ═══
   Feminine, 1700s-plausible (orchid · lotus · plum · snow · moon · cloud · jade · seasons). Nothing from Q.XIUNU.names, no NPC given name
   (หวั่นหรง · อวี้หลาน/อวี้หลัน · ซือหรง · เสวี่ยหนิง · ชิงเหยียน · จิ่งหราน · อวี้เฉิน · เหมยชิง · หลันซี · ชุนเถา), no NPC stem ลู่ ซู เจีย อี้ ฉู่ จาง เซี่ย รุ่ย ฉิน.
   Reading hand: yù = อวี้ · yǔ = อวี่ · yú = อวี๋ · xuě = เสวี่ย · wǎn = หวั่น · qīng = ชิง · qíng = ฉิง · yān = เยียน · yàn = เยี่ยน · huá = ฮวา. */
Q.NAMING.girlNames.push(
  /* 婉 · 宛 · 晚 */
  'หวั่นชิง',   // 婉清
  'หวั่นหรู',   // 婉如
  'หวั่นโหรว',  // 婉柔
  'หวั่นหนิง',  // 婉宁
  'หวั่นชิว',   // 宛秋
  'หวั่นฉิง',   // 晚晴
  /* 清 · 轻 */
  'ชิงอี',      // 清漪
  'ชิงเหลียน',  // 清莲
  'ชิงจื่อ',    // 清芷
  'ชิงอิ่ง',    // 清影
  'ชิงหย่า',    // 清雅
  'ชิงเกอ',     // 轻歌
  'ชิงอู่',     // 清舞
  'ชิงไต้',     // 青黛
  'ชิงเฟิน',    // 清芬
  /* 若 */
  'รั่วหลัน',   // 若兰
  'รั่วอิน',    // 若音
  'รั่วเซวียน', // 若萱
  'รั่วหลี',    // 若璃
  'รั่วเวย',    // 若薇
  'รั่วเยียน',  // 若嫣
  /* 玉 */
  'อวี้เจิน',   // 玉珍
  'อวี้โหรว',   // 玉柔
  'อวี้เจี๋ย',  // 玉洁
  'อวี้หรู',    // 玉茹
  'อวี้เหยา',   // 玉瑶
  'อวี้ผิง',    // 玉屏
  'อวี้จู',     // 玉珠
  /* 云 */
  'หยุนเหยา',   // 云瑶
  'หยุนจิ่น',   // 云锦
  'หยุนเยียน',  // 云烟
  'ปี้หยุน',    // 碧云
  'เซียงหยุน',  // 湘云
  'เจาหยุน',    // 朝云
  'ถงหยุน',     // 彤云
  'เซียนหยุน',  // 纤云
  'หยุนซี',     // 云溪
  /* 月 */
  'เยว่ฮวา',    // 月华
  'เยว่หรู',    // 月茹
  'เยว่อิ่ง',   // 月影
  'เยว่ฉาน',    // 月婵
  'หมิงเยว่',   // 明月
  'เสี่ยวเยว่', // 晓月
  'อิ้งเยว่',   // 映月
  'ซีเยว่',     // 惜月
  'หรูเยว่',    // 如月
  /* 梅 · 雪 */
  'เหมยเซียง',  // 梅香
  'เหมยเสวี่ย', // 梅雪
  'เสวี่ยฉิง',  // 雪晴
  'เสวี่ยอิง',  // 雪莹
  'เสวี่ยเวย',  // 雪薇
  'ชุนเสวี่ย',  // 春雪
  'มู่เสวี่ย',  // 暮雪
  'อิ้งเสวี่ย', // 映雪
  'ตงเสวี่ย',   // 冬雪
  'เมิ่งเสวี่ย', // 梦雪
  'ชิ่นเสวี่ย', // 沁雪
  /* 兰 · 芷 · 蕙 */
  'หลันจือ',    // 兰芝
  'หลันซิน',    // 兰馨
  'จื่อหลัน',   // 芷兰
  'ฮุ่ยหลัน',   // 蕙兰
  'โม่หลัน',    // 墨兰
  'โยวหลัน',    // 幽兰
  'ทิงหลัน',    // 汀兰
  'เพ่ยหลัน',   // 佩兰
  'หลันโจว',    // 兰舟
  'เมิ่งหลัน',  // 梦兰
  'เซียงหลัน',  // 湘兰
  'จื่อฉิง',    // 芷晴
  'หยวนจื่อ',   // 沅芷
  /* 莲 · 花 · 香 */
  'เหลียนซิน',  // 莲心
  'เหลียนอี',   // 莲衣
  'เหลียนโจว',  // 莲舟
  'โม่เหลียน',  // 墨莲
  'ไฉ่เหลียน',  // 采莲
  'ไฉ่เวย',     // 采薇
  'โม่ลี่',     // 茉莉
  'ฮุ่ยซิน',    // 蕙心
  'หนิงเซียง',  // 凝香
  'ชิ่นเซียง',  // 沁香
  'ชิ่นฟาง',    // 沁芳
  'ถานเซียง',   // 檀香
  /* 碧 · 秋 · 春 · 冬 · 惜 */
  'ปี้จู',      // 碧珠
  'ปี้หาน',     // 碧涵
  'ชิวซวง',     // 秋霜
  'ชิวถัง',     // 秋棠
  'ชิวฉือ',     // 秋词
  'ชุนเสี่ยว',  // 春晓
  'ชุนเยี่ยน',  // 春燕
  'ชุนซี',      // 春熙
  'ชุนฮุย',     // 春晖
  'ชุนอิง',     // 春盈
  'ตงชิง',      // 冬青
  'ซีชุน',      // 惜春
  /* 灵 · 瑶 · 婷 */
  'หลิงซี',     // 灵犀
  'หลิงซาน',    // 灵珊
  'หลิงซิ่ว',   // 灵秀
  'หลิงหลง',    // 玲珑
  'เหยากวง',    // 瑶光
  'เหยาอิง',    // 瑶英
  'ถิงหย่า',    // 婷雅
  'เซียงหลิง',  // 湘灵
  /* 静 · 宁 · 安 · 明 · 慧 · 雅 · 欣 */
  'จิ้งห่าว',   // 静好
  'จิ้งหาน',    // 静涵
  'หนิงซิน',    // 宁馨
  'หนิงจิ้ง',   // 宁静
  'อันเกอ',     // 安歌
  'อันหนิง',    // 安宁
  'หมิงฮุ่ย',   // 明慧
  'หมิงเวย',    // 明薇
  'หมิงเคอ',    // 明珂
  'หย่าซิน',    // 雅馨
  'หย่าจือ',    // 雅芝
  'ซินเหยียน',  // 欣妍
  /* gems · silk · ornaments */
  'เจินเหม่ย',  // 珍美
  'เหม่ยเจวียน', // 美娟
  'หงซิ่ว',     // 红袖
  'หงเย่',      // 红叶
  'หงหลิง',     // 红菱
  'จินจือ',     // 金枝
  'จินหลิง',    // 金铃
  'จิ่นผิง',    // 锦屏
  'ฮว่าผิง',    // 画屏
  'จิ่นเซวียน', // 瑾萱
  'ฉานเจวียน',  // 婵娟
  'อิงซิ่ว',    // 盈袖
  'อิงลั่ว',    // 璎珞
  'ฮวนเพ่ย',    // 环佩
  /* birds · music */
  'เยี่ยนหรู',  // 燕如
  'อิงเกอ',     // 莺歌
  'เซิงเกอ',    // 笙歌
  'หลิวอิง',    // 流萤
  /* smoke · mist · dusk */
  'เยียนหราน',  // 嫣然
  'ซีเหยียน',   // 夕颜
  'เจาเหยียน',  // 朝颜
  'หานเยียน',   // 含烟
  'มู่เยียน',   // 暮烟
  'เยียนหลัว',  // 烟萝
  'จื่อหลัว',   // 紫萝
  'หรูเยียน',   // 如烟
  'จื่อเยียน',   // 紫烟
  /* rain */
  'อวี่เวย',    // 雨薇
  'อวี่หาน',    // 雨涵
  'อวี่ถง',     // 雨桐
  'อวี่ฉิง',    // 雨晴
  'ทิงอวี่',    // 听雨
  'ทิงเหอ',     // 听荷
  /* soft · slender · dawn */
  'เซียนโหรว',  // 纤柔
  'เสี่ยวซี',   // 晓曦
  'เชี่ยนอิ่ง'  // 倩影
);
