/* =============================================================
   backgrounds.js — Atmospheric SVG scene backgrounds
   Each location key maps to a layered gradient scene. Kept
   abstract/painterly so it reads as a mood, not clip-art.
   ============================================================= */

const BG = {
  campus_gate:  { sky: ['#aee1f9', '#e8f6ff', '#fff6e6'], ground: '#cdb98f', kind: 'day',   tag: 'หน้าประตูมหาวิทยาลัย' },
  courtyard:    { sky: ['#bfe6fb', '#eafaf0', '#fdfbe8'], ground: '#bcd39a', kind: 'day',   tag: 'ลานกิจกรรม' },
  classroom:    { sky: ['#dfeaf5', '#eef3f8'],            ground: '#c8b89a', kind: 'indoor',tag: 'ห้องเรียน' },
  library:      { sky: ['#efe3d0', '#f6eede'],            ground: '#a9855e', kind: 'indoor',tag: 'ห้องสมุด' },
  cafeteria:    { sky: ['#ffe9cf', '#fff5e6'],            ground: '#d8b98f', kind: 'indoor',tag: 'โรงอาหาร' },
  club_room:    { sky: ['#e6dcf2', '#f2ecf9'],            ground: '#b39ecb', kind: 'indoor',tag: 'ห้องชมรม' },
  photo_studio: { sky: ['#2a2f3a', '#3b4152'],            ground: '#20242e', kind: 'dark',  tag: 'สตูดิโอถ่ายภาพ' },
  rooftop:      { sky: ['#8fc7f2', '#cfe9fb', '#ffe9c9'], ground: '#9aa6b4', kind: 'day',   tag: 'ดาดฟ้า' },
  park:         { sky: ['#a9ddf7', '#dff5e4', '#f6fbdf'], ground: '#a7cf82', kind: 'day',   tag: 'สวนสาธารณะ' },
  riverside:    { sky: ['#ffb27a', '#ffd9a0', '#ffeccb'], ground: '#7a8fa0', kind: 'sunset',tag: 'ริมน้ำยามเย็น' },
  festival_night:{ sky:['#241a4a', '#3d2a6b', '#5a3a7a'], ground: '#1c1636', kind: 'night', tag: 'งานเทศกาลกลางคืน' },
  art_room:     { sky: ['#f0e6dc', '#f8f1e9'],            ground: '#b89a78', kind: 'indoor',tag: 'ห้องศิลปะ' },
  music_room:   { sky: ['#e3dcef', '#efeaf7'],            ground: '#9a86b8', kind: 'indoor',tag: 'ห้องดนตรี' },
  football_field:{ sky:['#8fd0f5', '#cdeefb', '#eafbe6'], ground: '#5fae54', kind: 'day',   tag: 'สนามฟุตบอล' },
  rain_street:  { sky: ['#5b6b7a', '#7d8b98', '#9aa8b4'], ground: '#4a5560', kind: 'rain',  tag: 'ถนนกลางสายฝน' },
  city_night:   { sky: ['#141833', '#26203f', '#3a2a4a'], ground: '#0e1020', kind: 'night', tag: 'เมืองยามค่ำ' },
  hallway:      { sky: ['#e2e8ee', '#eef2f6'],            ground: '#b6a988', kind: 'indoor',tag: 'ทางเดินตึกเรียน' },
  coffee_shop:  { sky: ['#e6d3bc', '#f2e4d2'],            ground: '#8a6a4a', kind: 'indoor',tag: 'ร้านกาแฟ' },
  beach:        { sky: ['#7fd0f0', '#bfeefb', '#fdf3d6'], ground: '#ecd9a8', kind: 'day',   tag: 'ชายทะเล' },
  home_room:    { sky: ['#f0dbe6', '#f7e8f0'],            ground: '#c9a6b8', kind: 'indoor',tag: 'ห้องพัก' },
};

function bgDecor(key, cfg) {
  const bits = [];
  if (cfg.kind === 'day' || cfg.kind === 'sunset') {
    // sun / clouds
    const sunY = cfg.kind === 'sunset' ? 300 : 150;
    const sunC = cfg.kind === 'sunset' ? '#ffdfa0' : '#fff6d8';
    bits.push(`<circle cx="740" cy="${sunY}" r="70" fill="${sunC}" opacity="0.75"/>`);
    bits.push(`<circle cx="740" cy="${sunY}" r="110" fill="${sunC}" opacity="0.25"/>`);
    bits.push(`<ellipse cx="220" cy="140" rx="90" ry="34" fill="#ffffff" opacity="0.55"/>`);
    bits.push(`<ellipse cx="320" cy="120" rx="70" ry="28" fill="#ffffff" opacity="0.45"/>`);
    bits.push(`<ellipse cx="560" cy="200" rx="80" ry="30" fill="#ffffff" opacity="0.4"/>`);
  }
  if (cfg.kind === 'night' || cfg.kind === 'dark' || cfg.kind === 'city_night') {
    for (let i = 0; i < 60; i++) {
      const x = (i * 137) % 960, y = (i * 71) % 360, r = (i % 3) * 0.6 + 0.6;
      bits.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.3 + (i % 4) * 0.15}"/>`);
    }
  }
  if (key === 'festival_night') {
    // paper lanterns
    ['#ff8a5c', '#ffd166', '#ff6b9d', '#c792ea'].forEach((c, i) => {
      const x = 140 + i * 210;
      bits.push(`<line x1="${x}" y1="0" x2="${x}" y2="120" stroke="#5a4a6a" stroke-width="2"/>`);
      bits.push(`<ellipse cx="${x}" cy="150" rx="26" ry="34" fill="${c}" opacity="0.9"/><ellipse cx="${x}" cy="150" rx="26" ry="34" fill="none" stroke="#00000030" stroke-width="1"/>`);
      bits.push(`<circle cx="${x}" cy="150" r="60" fill="${c}" opacity="0.18"/>`);
    });
  }
  if (key === 'city_night') {
    for (let i = 0; i < 7; i++) {
      const x = i * 140, h = 180 + ((i * 53) % 160), w = 110;
      bits.push(`<rect x="${x}" y="${540 - h}" width="${w}" height="${h}" fill="#1a1730" opacity="0.85"/>`);
      for (let wy = 0; wy < 6; wy++) for (let wx = 0; wx < 3; wx++) {
        if ((i + wx + wy) % 2 === 0) bits.push(`<rect x="${x + 14 + wx * 30}" y="${540 - h + 20 + wy * 26}" width="10" height="14" fill="#ffd98a" opacity="0.75"/>`);
      }
    }
  }
  if (key === 'library' || key === 'art_room' || key === 'club_room' || key === 'music_room' || key === 'coffee_shop') {
    // window light + shelf/frame hints
    bits.push(`<rect x="600" y="60" width="280" height="300" rx="10" fill="#ffffff" opacity="0.18"/>`);
    bits.push(`<line x1="740" y1="60" x2="740" y2="360" stroke="#ffffff" stroke-width="3" opacity="0.2"/>`);
    bits.push(`<line x1="600" y1="210" x2="880" y2="210" stroke="#ffffff" stroke-width="3" opacity="0.2"/>`);
  }
  if (key === 'photo_studio') {
    bits.push(`<circle cx="480" cy="120" r="180" fill="#ffffff" opacity="0.10"/>`);
    bits.push(`<polygon points="150,540 260,180 320,180 240,540" fill="#ffffff" opacity="0.06"/>`);
  }
  if (key === 'football_field') {
    bits.push(`<ellipse cx="480" cy="560" rx="520" ry="120" fill="#ffffff" opacity="0.12"/>`);
    bits.push(`<line x1="480" y1="380" x2="480" y2="560" stroke="#ffffff" stroke-width="3" opacity="0.5"/>`);
    bits.push(`<circle cx="480" cy="470" r="60" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>`);
  }
  if (key === 'beach') {
    bits.push(`<path d="M0 400 Q240 380 480 400 T960 400 L960 540 L0 540 Z" fill="#4fb8d8" opacity="0.55"/>`);
    bits.push(`<path d="M0 430 Q240 415 480 430 T960 430" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>`);
  }
  if (key === 'rain_street') {
    for (let i = 0; i < 70; i++) {
      const x = (i * 89) % 960, y = (i * 53) % 540;
      bits.push(`<line x1="${x}" y1="${y}" x2="${x - 8}" y2="${y + 26}" stroke="#cdd9e4" stroke-width="1.4" opacity="0.5"/>`);
    }
  }
  if (key === 'riverside') {
    bits.push(`<path d="M0 400 L960 400 L960 540 L0 540 Z" fill="#ffb27a" opacity="0.35"/>`);
    bits.push(`<ellipse cx="740" cy="440" rx="120" ry="16" fill="#fff2d0" opacity="0.5"/>`);
  }
  return bits.join('');
}

function backgroundSVG(key) {
  const cfg = BG[key] || BG.courtyard;
  const stops = cfg.sky.map((c, i) => `<stop offset="${i / (cfg.sky.length - 1)}" stop-color="${c}"/>`).join('');
  const groundY = 380;
  return `<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" class="bg-svg">
    <defs><linearGradient id="sky_${key}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>
    <rect width="960" height="540" fill="url(#sky_${key})"/>
    ${bgDecor(key, cfg)}
    <rect x="0" y="${groundY}" width="960" height="${540 - groundY}" fill="${cfg.ground}"/>
    <rect x="0" y="${groundY}" width="960" height="14" fill="#ffffff" opacity="0.12"/>
    <rect x="0" y="0" width="960" height="540" fill="url(#vig_${key})"/>
    <radialGradient id="vig_${key}" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.6" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
    </radialGradient>
  </svg>`;
}

function bgTag(key) { return (BG[key] || {}).tag || ''; }

if (typeof module !== 'undefined') module.exports = { backgroundSVG, bgTag, BG };
