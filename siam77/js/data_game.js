/* data_game.js — items, buildings, jobs, names, dialogue, issues and the
   Phase-2 political placeholders (fictional parties only). */
'use strict';

/* ---------------- items ----------------
   kind: food | drink | produce | good | tool | vehicle | med | book
   hunger/energy/mood/health = effect when used */
S77.ITEMS = {
  bento: { th: 'ข้าวกล่องเวฟ', kind: 'food', price: 39, hunger: 35, icon: '🍱' },
  sandwich: { th: 'แซนด์วิชทูน่า', kind: 'food', price: 29, hunger: 20, icon: '🥪' },
  noodle_cup: { th: 'บะหมี่ถ้วย', kind: 'food', price: 15, hunger: 18, icon: '🍜' },
  bread: { th: 'ขนมปังสังขยา', kind: 'food', price: 18, hunger: 12, mood: 1, icon: '🍞' },
  water: { th: 'น้ำดื่ม', kind: 'drink', price: 10, energy: 3, icon: '💧' },
  coffee: { th: 'กาแฟเย็น', kind: 'drink', price: 35, energy: 18, mood: 2, icon: '🧋' },
  thaitea: { th: 'ชาไทย', kind: 'drink', price: 30, energy: 8, mood: 4, icon: '🧋' },
  sticky_pork: { th: 'ข้าวเหนียวหมูปิ้ง', kind: 'food', price: 35, hunger: 30, mood: 2, icon: '🍢' },
  somtam: { th: 'ส้มตำ', kind: 'food', price: 45, hunger: 28, mood: 4, icon: '🥗' },
  chicken_rice: { th: 'ข้าวมันไก่', kind: 'food', price: 50, hunger: 45, icon: '🍛' },
  noodles: { th: 'ก๋วยเตี๋ยว', kind: 'food', price: 50, hunger: 40, mood: 2, icon: '🍜' },
  fried_rice: { th: 'ข้าวผัดกะเพรา', kind: 'food', price: 55, hunger: 48, mood: 2, icon: '🍛' },
  fruit: { th: 'ผลไม้รวม', kind: 'food', price: 30, hunger: 12, mood: 3, health: 2, icon: '🍉' },
  mango_sticky: { th: 'ข้าวเหนียวมะม่วง', kind: 'food', price: 80, hunger: 30, mood: 8, icon: '🥭' },
  // produce from jobs (sold at markets)
  rice: { th: 'ข้าวเปลือก (ถัง)', kind: 'produce', price: 30, icon: '🌾' },
  fish: { th: 'ปลาสด', kind: 'produce', price: 45, icon: '🐟' },
  rubber: { th: 'ยางแผ่นดิบ', kind: 'produce', price: 60, icon: '🟫' },
  fruit_crate: { th: 'ผลไม้ลังใหญ่', kind: 'produce', price: 80, icon: '📦' },
  // tools / vehicles / misc
  umbrella: { th: 'ร่ม', kind: 'tool', price: 150, icon: '☂️', desc: 'กันฝน: อารมณ์ไม่ลดเมื่อฝนตก' },
  camera: { th: 'กล้องถ่ายรูป', kind: 'tool', price: 3500, icon: '📷', desc: 'ถ่ายรูปแลนด์มาร์ก รับชื่อเสียงเพิ่ม' },
  bicycle: { th: 'จักรยาน', kind: 'vehicle', price: 2500, speed: 1.7, icon: '🚲', desc: 'เร็วขึ้น 1.7 เท่า (กด R เพื่อขี่/ลง)' },
  motorbike: { th: 'มอเตอร์ไซค์', kind: 'vehicle', price: 42000, speed: 3.0, icon: '🛵', desc: 'เร็วขึ้น 3 เท่า ใช้ทำงานไรเดอร์ได้' },
  medicine: { th: 'ยาสามัญประจำบ้าน', kind: 'med', price: 60, health: 25, icon: '💊' },
  book: { th: 'หนังสือความรู้รอบตัว', kind: 'book', price: 180, icon: '📘', desc: 'อ่านแล้วความรู้ +3 (ใช้เวลา 2 ชม.)' },
  flowers: { th: 'พวงมาลัย', kind: 'good', price: 20, icon: '💮', desc: 'ใช้ไหว้ศาล/ให้เป็นของขวัญ' },
};
// one regional dish + one OTOP good per province (generated from province data)
S77.PROVINCES.forEach((p) => {
  S77.ITEMS['dish_' + p.key] = { th: p.dish, kind: 'food', price: 60 + (p.tier === 1 ? 20 : 0), hunger: 50, mood: 8, prov: p.key, icon: '🍲', dish: true };
  S77.ITEMS['good_' + p.key] = { th: p.good, kind: 'good', price: p.goodPrice, prov: p.key, icon: '🎁', desc: 'ของดีจาก' + p.th + ' — ขายต่างจังหวัดได้ราคาดี' };
});

/* ---------------- buildings ----------------
   fw/fd = footprint along x/y, h = wall height px, style = sprite recipe,
   acts = interactions offered at the door */
S77.BUILDINGS = {
  hall: { th: 'ศาลากลางจังหวัด', fw: 5, fd: 3, h: 30, style: 'hall', acts: ['info', 'gov_job', 'register', 'petition'] },
  pillar: { th: 'ศาลหลักเมือง', fw: 2, fd: 2, h: 14, style: 'pillar', acts: ['pray'] },
  temple: { th: 'วัด', fw: 4, fd: 3, h: 20, style: 'temple', acts: ['merit', 'volunteer'] },
  mosque: { th: 'มัสยิด', fw: 3, fd: 3, h: 22, style: 'mosque', acts: ['visit_mosque'] },
  cjshrine: { th: 'ศาลเจ้าจีน', fw: 3, fd: 2, h: 16, style: 'cjshrine', acts: ['pray'] },
  market: { th: 'ตลาดสด', fw: 4, fd: 4, h: 14, style: 'market', acts: ['shop_market', 'sell', 'job_vendor'] },
  store: { th: 'ร้านสะดวกซื้อ 24 ชม.', fw: 3, fd: 2, h: 18, style: 'store', acts: ['shop_store', 'job_clerk'] },
  restaurant: { th: 'ร้านอาหารพื้นเมือง', fw: 3, fd: 2, h: 18, style: 'restaurant', acts: ['shop_food', 'job_kitchen'] },
  lodge: { th: 'โรงแรม', fw: 3, fd: 3, h: 40, style: 'lodge', acts: ['sleep', 'job_hotel'] },
  bus: { th: 'สถานีขนส่งผู้โดยสาร', fw: 4, fd: 3, h: 16, style: 'bus', acts: ['travel_bus'] },
  train: { th: 'สถานีรถไฟ', fw: 5, fd: 2, h: 18, style: 'train', acts: ['travel_train'] },
  airport: { th: 'ท่าอากาศยาน', fw: 7, fd: 4, h: 26, style: 'airport', acts: ['travel_air'] },
  pier: { th: 'ท่าเรือ', fw: 2, fd: 2, h: 10, style: 'pier', acts: ['travel_ferry'] },
  hospital: { th: 'โรงพยาบาล', fw: 4, fd: 3, h: 36, style: 'hospital', acts: ['heal', 'job_hospital'] },
  school: { th: 'โรงเรียน', fw: 4, fd: 3, h: 28, style: 'school', acts: ['study', 'job_teacher'] },
  police: { th: 'สถานีตำรวจ', fw: 3, fd: 2, h: 22, style: 'police', acts: ['police_talk'] },
  jobcenter: { th: 'สำนักงานจัดหางาน', fw: 3, fd: 2, h: 24, style: 'office', acts: ['jobs'] },
  bank: { th: 'ธนาคาร', fw: 3, fd: 2, h: 22, style: 'bank', acts: ['bank'] },
  sala: { th: 'ศาลาประชาคม', fw: 3, fd: 3, h: 12, style: 'sala', acts: ['townhall'] },
  mall: { th: 'ห้างสรรพสินค้า', fw: 6, fd: 4, h: 44, style: 'mall', acts: ['shop_mall', 'job_clerk'] },
  factory: { th: 'โรงงานอุตสาหกรรม', fw: 5, fd: 4, h: 26, style: 'factory', acts: ['job_factory'] },
  office: { th: 'อาคารสำนักงาน', fw: 3, fd: 3, h: 60, style: 'tower', acts: ['job_office'] },
  tower: { th: 'ตึกระฟ้า', fw: 3, fd: 3, h: 110, style: 'tower', acts: [] },
  condo: { th: 'คอนโดมิเนียม', fw: 3, fd: 3, h: 80, style: 'condo', acts: [] },
  parliament: { th: 'อาคารรัฐสภา', fw: 7, fd: 5, h: 34, style: 'parliament', acts: ['parliament'] },
  govhouse: { th: 'ทำเนียบรัฐบาล', fw: 5, fd: 4, h: 28, style: 'govhouse', acts: ['parliament'] },
  shophouse: { th: 'ตึกแถว', fw: 2, fd: 2, h: 34, style: 'shophouse', acts: [] },
  house: { th: 'บ้าน', fw: 2, fd: 2, h: 16, style: 'house', acts: [] },
  forsale: { th: 'บ้านประกาศขาย', fw: 2, fd: 2, h: 16, style: 'house', acts: ['buy_house'] },
  home: { th: 'บ้านของฉัน', fw: 2, fd: 2, h: 16, style: 'house', acts: ['sleep_home'] },
  grocery: { th: 'ร้านโชห่วย', fw: 2, fd: 2, h: 16, style: 'grocery', acts: ['shop_grocery'] },
  vtemple: { th: 'วัดประจำหมู่บ้าน', fw: 3, fd: 3, h: 16, style: 'temple', acts: ['merit', 'volunteer'] },
  vsala: { th: 'ศาลาประจำหมู่บ้าน', fw: 3, fd: 2, h: 12, style: 'sala', acts: ['townhall'] },
  barn: { th: 'ยุ้งข้าว', fw: 1, fd: 1, h: 14, style: 'barn', acts: [] },
  landmark: { th: 'แลนด์มาร์ก', fw: 3, fd: 3, h: 0, style: 'landmark', acts: ['photo'] },
};

/* ---------------- jobs ---------------- */
// base pay in THB before the province wage multiplier
S77.JOBS = {
  farm: { th: 'ทำนา', hours: 4, pay: 300, energy: 26, skill: 'labor', gain: 2, item: 'rice', items: [1, 3] },
  fishing: { th: 'ออกเรือหาปลา', hours: 4, pay: 150, energy: 24, skill: 'labor', gain: 2, item: 'fish', items: [2, 6] },
  rubber: { th: 'กรีดยาง', hours: 3, pay: 220, energy: 20, skill: 'labor', gain: 2, item: 'rubber', items: [1, 3] },
  orchard: { th: 'เก็บผลไม้ในสวน', hours: 4, pay: 280, energy: 22, skill: 'labor', gain: 2, item: 'fruit_crate', items: [0, 2] },
  vendor: { th: 'ช่วยขายของในตลาด', hours: 6, pay: 400, energy: 22, skill: 'trade', gain: 2 },
  clerk: { th: 'พนักงานร้านสะดวกซื้อ', hours: 8, pay: 480, energy: 26, skill: 'charisma', gain: 1 },
  kitchen: { th: 'ผู้ช่วยครัว', hours: 6, pay: 400, energy: 24, skill: 'labor', gain: 1 },
  hotel: { th: 'พนักงานโรงแรม', hours: 6, pay: 430, energy: 22, skill: 'charisma', gain: 1 },
  factory: { th: 'พนักงานโรงงาน', hours: 8, pay: 560, energy: 32, skill: 'labor', gain: 2 },
  office: { th: 'พนักงานออฟฟิศ', hours: 8, pay: 950, energy: 22, skill: 'knowledge', gain: 1, req: { knowledge: 25 } },
  teacher: { th: 'ผู้ช่วยครู', hours: 6, pay: 620, energy: 20, skill: 'charisma', gain: 2, req: { knowledge: 30 } },
  hospital: { th: 'ผู้ช่วยพยาบาล', hours: 8, pay: 680, energy: 28, skill: 'knowledge', gain: 1, req: { knowledge: 40 } },
  gov: { th: 'ลูกจ้างศาลากลาง', hours: 8, pay: 560, energy: 20, skill: 'knowledge', gain: 1, rep: 1, req: { knowledge: 15 } },
  guide: { th: 'ไกด์นำเที่ยว', hours: 6, pay: 780, energy: 22, skill: 'charisma', gain: 2, req: { charisma: 25 } },
  volunteer: { th: 'จิตอาสาที่วัด', hours: 3, pay: 0, energy: 12, skill: 'charisma', gain: 1, rep: 3, mood: 8 },
};

/* ---------------- names ---------------- */
S77.NAMES = {
  male: ['สมชาย', 'สมศักดิ์', 'ประยูร', 'วิชัย', 'สุริยา', 'ธนากร', 'กิตติพงษ์', 'อนุชา', 'ณัฐพล', 'ภานุวัฒน์', 'ชัยวัฒน์', 'บุญมี', 'สมบัติ', 'ทองดี', 'ประเสริฐ', 'วีระ', 'อำนาจ', 'ศักดิ์ชัย', 'พีรพงศ์', 'ธีรเดช', 'เอกชัย', 'จักรพันธ์', 'ปิยะ', 'สุเมธ'],
  female: ['สมหญิง', 'มาลี', 'บุญเรือน', 'สุนีย์', 'วันเพ็ญ', 'อรุณี', 'กาญจนา', 'ปราณี', 'พิมพ์ชนก', 'ณัฐธิดา', 'ศิริพร', 'จันทร์เพ็ญ', 'ลำดวน', 'บัวผัน', 'สายสุนีย์', 'รัชนี', 'อัมพร', 'กนกวรรณ', 'ธิดารัตน์', 'วิไลวรรณ', 'ปวีณา', 'สุดารัตน์', 'มยุรี', 'เพ็ญศรี'],
  nick: ['ต้น', 'บอย', 'ปุ้ย', 'นก', 'แดง', 'เล็ก', 'หนิง', 'ป๊อป', 'ฝน', 'ปลา', 'แบงค์', 'ตาล', 'น้ำ', 'มด', 'ส้ม', 'จอย', 'เอ', 'กอล์ฟ', 'เบียร์', 'ไผ่', 'ภู', 'ต่าย', 'หมิว', 'แป้ง', 'ตูน', 'โอ๊ต', 'นุ่น', 'พลอย', 'แจ็ค', 'เมย์', 'ก้อย', 'อ้อ', 'หมู', 'ไก่', 'กุ้ง', 'เอ๋', 'ติ๊ก', 'ดำ', 'หนุ่ม', 'จุ๋ม'],
  surA: ['ศรี', 'บุญ', 'ทอง', 'แก้ว', 'สุข', 'ใจ', 'พร', 'จันทร์', 'เพชร', 'รุ่ง', 'ชัย', 'มณี', 'สาย', 'นาค', 'คำ', 'อินทร์', 'เรือง', 'ศักดิ์'],
  surB: ['สุข', 'มา', 'ดี', 'เจริญ', 'วงศ์', 'ทอง', 'ศรี', 'ใส', 'งาม', 'ประเสริฐ', 'รัตน์', 'กุล', 'พันธ์', 'ภักดี', 'สวัสดิ์', 'ไพศาล'],
  mMale: ['อับดุลเลาะ', 'มูฮัมหมัด', 'อิสมาแอ', 'ยูโซะ', 'อาหมัด', 'ซุลกิฟลี', 'รอมลี', 'ฮาซัน', 'อิบรอเฮม', 'มะรอนิง'],
  mFemale: ['ฟาตีมะห์', 'ซารีนา', 'นูรีดา', 'อามีเนาะ', 'รอฮานี', 'ซูไฮลา', 'ไซนับ', 'มารีแย', 'ซาฟียะห์', 'นูรีซัน'],
  mSur: ['เจ๊ะเลาะ', 'สาและ', 'ดอเลาะ', 'มะแซ', 'ยูโซะ', 'หะยีสาและ', 'บินอาลี', 'อาแว', 'สะมะแอ', 'ลาเตะ'],
};

S77.VILLAGE_NAMES = {
  pre: {
    central: ['บ้าน', 'บางขุน', 'คลอง', 'หนอง', 'ดอน', 'ท่า', 'บ้านโพธิ์'], bangkok: ['คลอง', 'บาง', 'ซอย'],
    north: ['บ้านป่า', 'บ้านแม่', 'บ้านห้วย', 'บ้านดอย', 'บ้านปง', 'บ้านสัน'],
    isan: ['บ้านโนน', 'บ้านหนอง', 'บ้านโคก', 'บ้านนา', 'บ้านดง', 'บ้านกุด'],
    south: ['บ้านควน', 'บ้านทุ่ง', 'บ้านบาง', 'บ้านท่า', 'บ้านเขา', 'บ้านหาด'],
    deepsouth: ['บ้านกำปง', 'บ้านบาโง', 'บ้านลูโบะ', 'บ้านตันหยง', 'บ้านปูโละ'],
  },
  suf: ['ใหญ่', 'น้อย', 'ทอง', 'บัว', 'แก้ว', 'สูง', 'ใต้', 'เหนือ', 'ดี', 'งาม', 'ยาง', 'ตะเคียน', 'มะม่วง', 'ขาม', 'ไผ่', 'ช้าง', 'ม่วง', 'ทราย', 'หิน', 'กลาง', 'ใหม่', 'เก่า', 'โพธิ์', 'ไทร', 'แดง', 'คำ', 'สว่าง', 'เจริญ'],
};

/* ---------------- occupations (drive NPC outfit + dialogue) ---------------- */
S77.OCCUPATIONS = {
  farmer: { th: 'ชาวนา', outfit: 'farmer' }, vendor: { th: 'แม่ค้า', outfit: 'vendor' }, student: { th: 'นักเรียน', outfit: 'student' },
  office: { th: 'พนักงานบริษัท', outfit: 'office' }, official: { th: 'ข้าราชการ', outfit: 'official' }, monk: { th: 'พระสงฆ์', outfit: 'monk' },
  fisher: { th: 'ชาวประมง', outfit: 'fisher' }, driver: { th: 'วินมอเตอร์ไซค์', outfit: 'driver' }, elder: { th: 'ผู้สูงอายุ', outfit: 'elder' },
  teacher: { th: 'ครู', outfit: 'official' }, nurse: { th: 'พยาบาล', outfit: 'nurse' }, police: { th: 'ตำรวจ', outfit: 'police' },
  tourist: { th: 'นักท่องเที่ยว', outfit: 'tourist' }, worker: { th: 'พนักงานโรงงาน', outfit: 'worker' }, tapper: { th: 'ชาวสวนยาง', outfit: 'farmer' },
  cook: { th: 'แม่ครัว', outfit: 'vendor' }, kid: { th: 'เด็ก', outfit: 'kid' }, headman: { th: 'ผู้ใหญ่บ้าน', outfit: 'official' },
  governor: { th: 'ผู้ว่าราชการจังหวัด', outfit: 'official' }, imam: { th: 'โต๊ะอิหม่าม', outfit: 'imam' },
};

/* ---------------- province issues (dynamic; Phase-2 campaign topics) ---------------- */
S77.ISSUES = {
  flood: { th: 'น้ำท่วม', months: [8, 9, 10], line: 'น้ำท่วมนาอีกแล้ว ปีนี้หนักกว่าทุกปี' },
  drought: { th: 'ภัยแล้ง', months: [3, 4, 5], line: 'ฝนไม่ตกเลย น้ำในบ่อแห้งหมดแล้ว' },
  haze: { th: 'ฝุ่นควัน PM2.5', months: [1, 2, 3, 4], line: 'ฝุ่นควันหนักมาก ออกไปข้างนอกแสบตาไปหมด' },
  cropprice: { th: 'ราคาพืชผลตกต่ำ', line: 'ขายผลผลิตได้ราคาต่ำมาก แทบไม่คุ้มทุน' },
  traffic: { th: 'รถติด', line: 'รถติดหนักทุกวัน กว่าจะถึงที่ทำงานก็เหนื่อยแล้ว' },
  costliving: { th: 'ค่าครองชีพสูง', line: 'ของแพงขึ้นทุกอย่าง แต่ค่าแรงเท่าเดิม' },
  jobs: { th: 'งานหายาก', line: 'คนหนุ่มสาวต้องย้ายไปหางานทำที่อื่นกันหมด' },
  tourism_down: { th: 'นักท่องเที่ยวลดลง', months: [6, 7, 8, 9], line: 'ช่วงนี้นักท่องเที่ยวน้อย ร้านค้าเงียบเหงา' },
  tourism_up: { th: 'นักท่องเที่ยวล้นเมือง', months: [11, 12, 1, 2], line: 'นักท่องเที่ยวเยอะมาก ขายของดีแต่ขยะก็เยอะ' },
  roads: { th: 'ถนนชำรุด', line: 'ถนนเข้าหมู่บ้านเป็นหลุมเป็นบ่อ ฝนตกทีลำบากมาก' },
  health: { th: 'โรงพยาบาลคนล้น', line: 'ไปหาหมอทีต้องรอทั้งวัน' },
  education: { th: 'คุณภาพการศึกษา', line: 'อยากให้ลูกได้เรียนโรงเรียนดีๆ ใกล้บ้าน' },
  environment: { th: 'ขยะและน้ำเสีย', line: 'น้ำในคลองเหม็นมาก ขยะก็ไม่มีใครเก็บ' },
  border: { th: 'การค้าชายแดนซบเซา', line: 'ด่านชายแดนเงียบ การค้าไม่คึกคักเหมือนก่อน' },
  fishery: { th: 'ปลาทะเลลดลง', line: 'ออกเรือแต่ละครั้งได้ปลาน้อยลงเรื่อยๆ' },
};

/* ---------------- Phase 2: fictional parties (data only in Phase 1) ----------------
   ideology axes in [-1,1]: econ (state <-> market), social (traditional <-> progressive),
   local (centralised <-> decentralised). All names are invented. */
S77.PARTIES = [
  { id: 'ruangkhao', th: 'พรรครวงข้าว', color: '#e2b33c', econ: -0.45, social: -0.1, local: 0.5, base: 'เกษตรกรและชนบท' },
  { id: 'daonuea', th: 'พรรคดาวเหนือ', color: '#3d6fd6', econ: 0.55, social: 0.1, local: -0.3, base: 'ภาคธุรกิจและคนเมือง' },
  { id: 'sainam', th: 'พรรคสายน้ำ', color: '#2fae9a', econ: -0.1, social: 0.65, local: 0.6, base: 'คนรุ่นใหม่และสิ่งแวดล้อม' },
  { id: 'ruabai', th: 'พรรคเรือใบ', color: '#d4574b', econ: 0.2, social: -0.55, local: -0.5, base: 'ประเพณีและความมั่นคง' },
];
S77.TOTAL_SEATS = 400; // constituency seats split by population (Phase 2)

/* ---------------- dialogue ----------------
   placeholders: {prov} {dish} {good} {lm} {nick} {player} {issue} {occ} {season} {village} */
S77.DIALOGUE = {
  greet: {
    central: ['สวัสดีจ้ะ ไปไหนมาจ๊ะ', 'อ้าว สวัสดี กินข้าวหรือยัง', 'สวัสดีจ้า วันนี้อากาศดีนะ'],
    bangkok: ['สวัสดีครับ รีบไปไหนหรือเปล่า', 'หวัดดี! กรุงเทพฯ วุ่นวายหน่อยนะ', 'สวัสดีค่ะ หลงทางหรือเปล่าคะ'],
    north: ['สวัสดีเจ้า ไปไหนมาเจ้า', 'กิ๋นข้าวแล้วกา', 'สวัสดีเจ้า ม่วนใจ๋เน้อ'],
    isan: ['สบายดีบ่', 'ไปไสมาจ้า กินข้าวแล้วบ้อ', 'สวัสดีเด้อ มาเที่ยวบ้านเฮาบ้อ'],
    south: ['หวัดดีหลาว ไปไหนมา', 'กินข้าวแล้วม้าย', 'อ้าว หวัดดี มาแต่ไหนหละ'],
    deepsouth: ['อัสสลามุอาลัยกุม สบายดีไหม', 'อาปา กาบา? สบายดีไหม', 'สวัสดี ยินดีต้อนรับนะ'],
  },
  prov: [
    'มาถึง{prov}แล้วต้องลอง{dish}นะ อร่อยที่สุดแล้ว',
    'ถ้ามีเวลาไปดู{lm}สิ สวยมาก',
    '{good}ของที่นี่ขึ้นชื่อมาก ซื้อไปฝากใครก็ชอบ',
    'คนต่างถิ่นชอบมาเที่ยว{prov}นะ บรรยากาศดี',
    'ฉันอยู่{prov}มาทั้งชีวิตแล้ว รักที่นี่มาก',
  ],
  provDialect: {
    north: ['{dish}ร้านแถวนี้ลำแต้ๆ เน้อ', 'ไปแอ่ว{lm}กันก่อ งามขนาด'],
    isan: ['{dish}แซบหลายเด้อ ลองเบิ่งแหน่', '{lm}งามหลาย ไปเบิ่งแน'],
    south: ['{dish}ที่นี่หรอยจังฮู้', 'ไปแลกัน{lm}ม้าย สวยนักนิ'],
    deepsouth: ['{dish}ที่นี่อร่อยมาก ต้องลองนะ', '{lm}คือความภูมิใจของคนที่นี่'],
  },
  occ: {
    farmer: ['ปีนี้หวังว่าข้าวจะได้ราคาดีนะ', 'ทำนามาตั้งแต่รุ่นพ่อ เหนื่อยแต่ภูมิใจ', 'ถ้าว่างมาช่วยดำนาก็ได้นะ ได้ค่าแรงด้วย'],
    vendor: ['ของสดๆ วันนี้ ซื้อไปสักหน่อยไหมจ๊ะ', 'ขายดีก็ยิ้ม ขายไม่ดีก็สู้ต่อ', 'ตลาดเช้าคนเยอะที่สุดเลยนะ'],
    student: ['เรียนหนักจัง แต่อยากสอบติดมหาลัย', 'โตขึ้นอยากเป็นหมอ', 'เลิกเรียนแล้วจะไปกินหมูกระทะกับเพื่อน'],
    office: ['ทำงานจนดึกทุกวันเลย', 'เงินเดือนออกเมื่อไหร่จะไปเที่ยวทะเล', 'ประชุมเยอะมาก ปวดหัว'],
    official: ['ราชการก็งานบริการประชาชนนะ', 'มีเรื่องเดือดร้อนอะไรไปยื่นเรื่องที่ศาลากลางได้นะ'],
    monk: ['เจริญพร โยม ทำจิตใจให้สบายนะ', 'ทำดีได้ดี โยมอย่าลืมทำบุญบ้างนะ'],
    fisher: ['คลื่นลมดีออกเรือได้ ถ้าลมแรงก็พัก', 'ปลาทะเลน้อยลงทุกปี', 'อยากออกเรือด้วยกันไหม ไปที่ชายหาดสิ'],
    driver: ['จะไปไหนครับ วินพร้อม', 'ขับมาสิบปี รู้จักทุกซอยในเมืองนี้'],
    elder: ['สมัยก่อนตรงนี้เป็นทุ่งนาหมดเลยนะหลาน', 'ลูกหลานไปทำงานในเมืองกันหมด เหงาเหมือนกัน'],
    teacher: ['เด็กๆ ที่นี่ตั้งใจเรียนมาก', 'ความรู้เป็นสิ่งที่ไม่มีใครขโมยไปได้นะ'],
    nurse: ['พักผ่อนให้เพียงพอนะ สุขภาพสำคัญที่สุด', 'ช่วงนี้คนไข้เยอะมาก'],
    police: ['ขับขี่ปลอดภัยนะครับ', 'มีอะไรแจ้งตำรวจได้ตลอด 24 ชั่วโมง'],
    tourist: ['ที่นี่สวยกว่าในรูปอีก!', 'อาหารไทยอร่อยมาก ลองมาหลายจังหวัดแล้ว'],
    worker: ['กะดึกเหนื่อยมาก แต่ก็ต้องสู้', 'โอทีเยอะเดือนนี้ได้เงินเพิ่มหน่อย'],
    tapper: ['กรีดยางต้องตื่นตีสอง', 'ราคายางขึ้นๆ ลงๆ ใจหายเลย'],
    cook: ['สูตรนี้ตกทอดมาจากยาย', 'อยากลองทำอาหารไหม มาช่วยในครัวได้นะ'],
    kid: ['พี่ๆ เล่นด้วยกันไหม!', 'หมาตัวนั้นชื่อเจ้าด่าง ดุนะ'],
    headman: ['ผู้ใหญ่บ้านอย่างผมดูแลลูกบ้านทุกคน', 'หมู่บ้าน{village}ของเราสามัคคีกันมาก', 'มีปัญหาอะไรในหมู่บ้าน มาคุยกับผมได้'],
    governor: ['ยินดีต้อนรับสู่{prov} ผมดูแลจังหวัดนี้อยู่', 'งบประมาณมีจำกัด แต่ปัญหามีเยอะ', 'ชาว{prov}กำลังเดือดร้อนเรื่อง{issue} ผมกำลังหาทางแก้'],
    imam: ['ขอความสันติจงมีแด่ท่าน', 'ที่นี่ทุกคนอยู่ร่วมกันด้วยความเคารพ'],
  },
  issue: ['ช่วงนี้ที่{prov}เดือดร้อนเรื่อง{issue}กันมาก', '{issueLine}', 'อยากให้มีคนมาแก้ปัญหา{issue}จริงจังสักที'],
  weather: {
    rain: ['ฝนตกอีกแล้ว อย่าลืมกางร่มนะ', 'ฝนตกแบบนี้ขายของไม่ค่อยดีเลย'],
    hot: ['ร้อนมากเลยวันนี้ ดื่มน้ำเยอะๆ นะ', 'ร้อนจนแทบละลาย'],
    cool: ['ลมหนาวมาแล้ว อากาศดีจัง', 'เช้าๆ หนาวนิดๆ สบายดี'],
    night: ['ดึกแล้วนะ รีบกลับบ้านเถอะ', 'กลางคืนเงียบดีนะ'],
  },
  friend: ['ดีใจที่ได้เจออีกนะ {player}', '{player} มาอีกแล้ว คิดถึงพอดี', 'เราเป็นเพื่อนกันแล้วนะ {player}', 'ถ้ามีอะไรให้ช่วยบอกได้เลยนะ {player}'],
  phase2: [
    'ได้ข่าวว่าจะมีการเลือกตั้งเร็วๆ นี้ อยากได้ผู้แทนที่เข้าใจคนท้องถิ่นจริงๆ',
    'ถ้ามีใครมาแก้ปัญหา{issue}ได้ ฉันเลือกคนนั้นแน่นอน',
    'นักการเมืองชอบมาตอนหาเสียง แล้วก็หายไป',
    'เห็นที่ศาลาประชาคมเขาประชุมหมู่บ้านกันบ่อยๆ นะ',
  ],
};

/* ---------------- quest templates ---------------- */
S77.QUEST_TEMPLATES = [
  { type: 'deliver', th: 'ฝากของไปให้ญาติ', text: 'ช่วยเอาของฝากไปให้ญาติฉันที่{target}หน่อยได้ไหม? เขาอยู่แถวตัวเมือง', reward: [300, 900], rep: 3 },
  { type: 'fetch', th: 'อยากได้ของดีต่างถิ่น', text: 'อยากลอง{item}จาก{target}มานานแล้ว ช่วยซื้อมาให้หน่อยได้ไหม จะให้ค่าเหนื่อยอย่างงาม', reward: [250, 700], rep: 3 },
  { type: 'visit', th: 'ไปเที่ยวแทนหน่อย', text: 'อยากเห็น{lm}ที่{target}มาก แต่ไปไม่ไหวแล้ว ช่วยไปดูแล้วกลับมาเล่าให้ฟังหน่อย', reward: [200, 600], rep: 4 },
];

/* ---------------- tips on the loading screen ---------------- */
S77.TIPS = [
  'เดินด้วย WASD หรือปุ่มลูกศร · กด E เพื่อพูดคุย/โต้ตอบ · กด M เปิดแผนที่',
  'ไปสถานีขนส่งเพื่อเดินทางข้ามจังหวัดอย่างรวดเร็ว',
  'ของดีประจำจังหวัดซื้อถูกที่ต้นทาง แต่ขายต่างจังหวัดได้ราคาดี',
  'นอนที่โรงแรมหรือบ้านของตัวเองเพื่อฟื้นพลังและบันทึกเกม',
  'ไปให้ครบ 77 จังหวัดเพื่อเก็บตราประทับในพาสปอร์ตให้ครบ!',
  'ชื่อเสียงในแต่ละจังหวัดจะสำคัญมากเมื่อระบบการเมืองเปิดใน Phase 2',
  'ทำบุญที่วัดหรือเป็นจิตอาสา ช่วยเพิ่มชื่อเสียงในจังหวัดนั้น',
];
