/* c10_endings.js — STUB (owner: unit c10 replaces this whole file). Minimal system endings so the engine always works. */
Q.add([
  { id: 'end_death_illness', kind: 'ending', ending: { type: 'bad', title: 'ดับสูญในสายลมหนาว', hint: 'ปล่อยให้สุขภาพทรุดโทรมจนสิ้นลม' },
    bg: 'bedchamber', start: 'a', nodes: { a: { who: 'narrator', text: '[stub] ร่างกายของท่านทนต่อไปไม่ไหว ท่านหลับตาลงเป็นครั้งสุดท้าย' } } },
  { id: 'end_death_poison', kind: 'ending', ending: { type: 'bad', title: 'พิษในถ้วยชา', hint: 'พิษร้ายคร่าชีวิตท่าน' },
    bg: 'bedchamber', start: 'a', nodes: { a: { who: 'narrator', text: '[stub] พิษที่สะสมในกายเอาชีวิตท่านไปในที่สุด' } } },
  { id: 'end_cold_palace', kind: 'ending', ending: { type: 'bad', title: 'ตำหนักเย็น', hint: 'ถูกลดขั้นจนสิ้นฐานะ' },
    bg: 'cold_palace', start: 'a', nodes: { a: { who: 'narrator', text: '[stub] ท่านถูกส่งไปตำหนักเย็น ไม่มีวันได้ก้าวออกมาอีก' } } },
  { id: 'end_twilight', kind: 'ending', ending: { type: 'neutral', title: 'ตะวันรอนในวังหลัง', hint: 'ใช้ชีวิตจนชราโดยไม่ไปถึงจุดสูงสุด' },
    bg: 'garden', start: 'a', nodes: { a: { who: 'narrator', text: '[stub] ปีเดือนผ่านไป ผมของท่านขาวโพลน — ท่านแก่ชราอยู่ในวังหลังที่เคยเป็นความฝัน' } } },
]);
