/* =============================================================
   characters.js — Cast metadata (names, theme colours, blurbs)
   ============================================================= */

const CHARACTERS = {
  phakin: {
    name: 'ภาคิน',
    en: 'Phakin',
    color: '#3f6cd0',
    colorSoft: '#e3ecfb',
    role: 'รุ่นพี่ปี 3 · ประธานชมรมถ่ายภาพ',
    tagline: '"ยืนตรงนั้นแหละ...แสงกำลังสวย"',
    blurb: 'รุ่นพี่สุขุมเย็นชาที่มองโลกผ่านเลนส์กล้อง ภายนอกดูห่างเหิน แต่ซ่อนความอ่อนโยนและใส่ใจไว้เบื้องหลัง',
  },
  tawan: {
    name: 'ตะวัน',
    en: 'Tawan',
    color: '#f2872f',
    colorSoft: '#fdead2',
    role: 'เพื่อนร่วมรุ่น · นักฟุตบอลทีมมหาลัย',
    tagline: '"เฮ้! วิ่งไปเป็นเพื่อนกันมั้ย?"',
    blurb: 'เพื่อนซี้สุดสดใสพลังล้น ยิ้มแล้วเหมือนแดดออก ตรงไปตรงมาและอบอุ่น...แต่แอบมีบางอย่างในใจ',
  },
  nil: {
    name: 'นิล',
    en: 'Nil',
    color: '#9b6bd6',
    colorSoft: '#ece0f8',
    role: 'รุ่นพี่ปี 2 · คณะศิลปกรรม',
    tagline: '"บางความรู้สึก...วาดออกมาง่ายกว่าพูด"',
    blurb: 'ศิลปินเงียบขรึมลึกลับที่สื่อสารผ่านสีและเสียงดนตรี อ่อนโยนและช่างสังเกตเกินกว่าที่ใครจะรู้',
  },
  fern: {
    name: 'ใบเฟิร์น',
    en: 'Fern',
    color: '#ff8fb3',
    colorSoft: '#ffe3ee',
    role: 'เพื่อนสาวคนสนิท',
    tagline: '"เอาน่า สู้ๆ! เดี๋ยวเฟิร์นเชียร์ให้เอง"',
    blurb: 'เพื่อนสาวจอมแซวที่คอยเป็นกองเชียร์เรื่องหัวใจให้เสมอ',
  },
  player: { name: '{{PLAYER}}', en: 'You', color: '#4a4a5a', colorSoft: '#eceef2' },
  narrator: { name: '', en: '', color: '#8a8a9a', colorSoft: '#f0f0f4' },
};

const ROMANCEABLE = ['phakin', 'tawan', 'nil'];

if (typeof module !== 'undefined') module.exports = { CHARACTERS, ROMANCEABLE };
