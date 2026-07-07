/* =============================================================
   backgrounds.js — Watercolour scene backgrounds (SVG)
   Loose colour washes with wet blooms, soft displaced silhouettes
   and a paper-grain overlay give each location a hand-painted feel.
   Layouts are seeded per-location so a scene looks identical every
   time it is shown (no reshuffle on re-render).
   ============================================================= */

/* seeded PRNG so decoration is stable per background */
function _rng(seed){ let a=seed>>>0; return ()=>{ a|=0;a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const BG = {
  campus_gate:  { arch:'day',    sky:['#bfe3f7','#e8f5fb','#fff3e2'], ground:'#c7b487', accent:'#8fb96a', tag:'หน้าประตูมหาวิทยาลัย' },
  courtyard:    { arch:'day',    sky:['#c3e6f7','#e9f8ef','#fcfbe6'], ground:'#b6cf94', accent:'#7fb862', tag:'ลานกิจกรรม' },
  classroom:    { arch:'indoor', sky:['#dbe7f2','#eef4f9'], ground:'#c6b593', wall:'#d8e2ee', accent:'#a8c0dc', tag:'ห้องเรียน' },
  library:      { arch:'indoor', sky:['#efe1cc','#f7efdf'], ground:'#a17c53', wall:'#e5d3b6', accent:'#b98f5e', tag:'ห้องสมุด', shelves:true },
  cafeteria:    { arch:'indoor', sky:['#ffe6c8','#fff5e6'], ground:'#d6b58a', wall:'#ffe9cf', accent:'#eaa96a', tag:'โรงอาหาร' },
  club_room:    { arch:'indoor', sky:['#e6dcf2','#f3edf9'], ground:'#b6a0cc', wall:'#e7ddf3', accent:'#b39ad6', tag:'ห้องชมรม' },
  photo_studio: { arch:'dark',   sky:['#2b303c','#3c4354'], ground:'#1e222c', accent:'#8fa4c8', tag:'สตูดิโอถ่ายภาพ', spotlight:true },
  rooftop:      { arch:'day',    sky:['#8fc6f2','#cfe9fb','#ffe8c6'], ground:'#9aa6b4', accent:'#c9d3df', tag:'ดาดฟ้า', railing:true },
  park:         { arch:'day',    sky:['#a9ddf7','#dff5e4','#f6fbdf'], ground:'#9fca79', accent:'#6faa52', tag:'สวนสาธารณะ', trees:5 },
  riverside:    { arch:'sunset', sky:['#ff9e63','#ffc98a','#ffe9c4'], ground:'#8090a0', accent:'#ff7e57', tag:'ริมน้ำยามเย็น', water:true },
  festival_night:{ arch:'night', sky:['#241a4a','#3d2a6b','#6a3f82'], ground:'#1c1636', accent:'#ff8a5c', tag:'งานเทศกาลกลางคืน', lanterns:true },
  art_room:     { arch:'indoor', sky:['#f0e6da','#f9f2ea'], ground:'#b39271', wall:'#f0e6da', accent:'#c99a6a', tag:'ห้องศิลปะ', easel:true },
  music_room:   { arch:'indoor', sky:['#e4dcef','#f0eaf8'], ground:'#9a86b8', wall:'#e6ddf2', accent:'#a98fd0', tag:'ห้องดนตรี', window:true },
  football_field:{ arch:'day',   sky:['#8fd0f5','#cdeefb','#eafbe6'], ground:'#63b358', accent:'#4f9a45', tag:'สนามฟุตบอล', field:true },
  rain_street:  { arch:'rain',   sky:['#5f6f7e','#828f9c','#9fadb8'], ground:'#4c5761', accent:'#b7c4cd', tag:'ถนนกลางสายฝน' },
  city_night:   { arch:'night',  sky:['#141833','#26203f','#42304e'], ground:'#0e1020', accent:'#ffd98a', tag:'เมืองยามค่ำ', city:true },
  hallway:      { arch:'indoor', sky:['#e2e8ee','#eef3f7'], ground:'#b7aa8a', wall:'#e4eaf0', accent:'#b8c4d0', tag:'ทางเดินตึกเรียน', pillars:true },
  coffee_shop:  { arch:'indoor', sky:['#e7d3ba','#f3e5d3'], ground:'#8a6a4a', wall:'#e7d3ba', accent:'#b98a5e', tag:'ร้านกาแฟ', window:true },
  beach:        { arch:'day',    sky:['#7fd0f0','#bfeefb','#fdf3d6'], ground:'#ecd9a8', accent:'#4fb8d8', tag:'ชายทะเล', sea:true },
  home_room:    { arch:'indoor', sky:['#f0dbe6','#f8e9f1'], ground:'#c9a6b8', wall:'#f2dde8', accent:'#e0a6c2', tag:'ห้องพัก' },
};

/* soft watercolour bloom */
function wash(cx, cy, rx, ry, col, op, uid, i) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${col}" opacity="${op}" filter="url(#bleed_${uid})"/>`;
}
/* loose hill / ground silhouette */
function hill(y, col, op, uid, rnd) {
  const p = `M0 ${y} Q240 ${y-20-rnd()*30} 480 ${y-6} T960 ${y-10} L960 540 L0 540 Z`;
  return `<path d="${p}" fill="${col}" opacity="${op}" filter="url(#bleed_${uid})"/>`;
}
/* loose tree */
function tree(x, y, s, col, uid) {
  return `<g filter="url(#bleed_${uid})">
    <rect x="${x-4*s}" y="${y}" width="${8*s}" height="${34*s}" fill="#7a5a3a" opacity="0.75"/>
    <ellipse cx="${x}" cy="${y-6*s}" rx="${34*s}" ry="${30*s}" fill="${col}" opacity="0.85"/>
    <ellipse cx="${x-18*s}" cy="${y+2*s}" rx="${22*s}" ry="${20*s}" fill="${darkenBg(col,0.12)}" opacity="0.8"/>
    <ellipse cx="${x+16*s}" cy="${y-2*s}" rx="${22*s}" ry="${20*s}" fill="${lightenBg(col,0.12)}" opacity="0.8"/>
  </g>`;
}
function lightenBg(h,a){ h=h.replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);const f=n=>Math.round(n+(255-n)*a).toString(16).padStart(2,'0');return '#'+f(r)+f(g)+f(b); }
function darkenBg(h,a){ h=h.replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);const f=n=>Math.round(n*(1-a)).toString(16).padStart(2,'0');return '#'+f(r)+f(g)+f(b); }

function bgLayers(key, cfg, uid, rnd) {
  const L = [];
  const groundY = cfg.arch==='indoor' ? 372 : 384;

  /* ---- sky washes / wet blooms ---- */
  if (cfg.arch==='day') {
    L.push(`<circle cx="${720+rnd()*80}" cy="${120+rnd()*40}" r="70" fill="#fff6d8" opacity="0.75" filter="url(#soft_${uid})"/>`);
    L.push(`<circle cx="740" cy="130" r="120" fill="#fff2c8" opacity="0.3" filter="url(#soft_${uid})"/>`);
    L.push(wash(220,150,120,50,'#ffffff',0.5,uid));
    L.push(wash(430,110,90,36,'#ffffff',0.4,uid));
    L.push(wash(590,180,110,40,'#eaf6ff',0.4,uid));
    L.push(wash(120,250,150,70,cfg.sky[0],0.4,uid));
  }
  if (cfg.arch==='sunset') {
    L.push(`<circle cx="720" cy="300" r="66" fill="#fff0c4" opacity="0.9" filter="url(#soft_${uid})"/>`);
    L.push(`<circle cx="720" cy="300" r="130" fill="#ffca82" opacity="0.35" filter="url(#soft_${uid})"/>`);
    L.push(wash(400,180,260,80,'#ff9f6b',0.35,uid));
    L.push(wash(200,260,200,70,'#ffb27a',0.4,uid));
    L.push(wash(760,120,180,60,'#ffd9a0',0.4,uid));
  }
  if (cfg.arch==='night') {
    for (let i=0;i<70;i++){ const x=rnd()*960,y=rnd()*350,r=rnd()*1.4+0.5; L.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.2+rnd()*0.6}"/>`); }
    L.push(wash(760,120,150,120,'#6a4f9a',0.4,uid));
    L.push(wash(180,180,200,140,'#3a2a6a',0.5,uid));
    L.push(`<circle cx="150" cy="110" r="42" fill="#fdf6d8" opacity="0.85" filter="url(#soft_${uid})"/><circle cx="150" cy="110" r="80" fill="#fdf6d8" opacity="0.2" filter="url(#soft_${uid})"/>`);
  }
  if (cfg.arch==='rain') {
    L.push(wash(300,140,260,90,'#8f9daa',0.5,uid));
    L.push(wash(680,180,240,90,'#7d8b98',0.5,uid));
  }
  if (cfg.arch==='dark') {
    L.push(wash(480,120,300,200,'#3a4256',0.6,uid));
    if (cfg.spotlight) L.push(`<polygon points="480,40 300,540 660,540" fill="#ffffff" opacity="0.10" filter="url(#soft_${uid})"/><circle cx="480" cy="120" r="150" fill="#ffffff" opacity="0.12" filter="url(#soft_${uid})"/>`);
  }
  if (cfg.arch==='indoor') {
    L.push(`<rect x="0" y="0" width="960" height="540" fill="${cfg.wall||cfg.sky[0]}"/>`);
    L.push(wash(200,150,260,150,lightenBg(cfg.wall||cfg.sky[0],0.15),0.6,uid));
    L.push(wash(720,120,220,160,darkenBg(cfg.wall||cfg.sky[0],0.06),0.4,uid));
    // window light
    L.push(`<rect x="600" y="54" width="300" height="300" rx="8" fill="#ffffff" opacity="0.22" filter="url(#soft_${uid})"/>`);
    L.push(`<rect x="618" y="70" width="120" height="270" fill="#ffffff" opacity="0.16"/><rect x="756" y="70" width="120" height="270" fill="#ffffff" opacity="0.12"/>`);
  }

  /* ---- distant scenery ---- */
  if (cfg.arch==='day' || cfg.arch==='sunset') {
    L.push(hill(groundY-30, lightenBg(cfg.ground,0.2), 0.6, uid, rnd));
    if (!cfg.field && !cfg.sea && !cfg.water) { for (let i=0;i<(cfg.trees||3);i++){ const x=60+i*(880/((cfg.trees||3)))+rnd()*40; L.push(tree(x, groundY-6, 0.8+rnd()*0.5, mixTree(cfg.accent), uid)); } }
  }

  /* ---- ground wash ---- */
  L.push(`<path d="M0 ${groundY} Q240 ${groundY-8} 480 ${groundY} T960 ${groundY} L960 540 L0 540 Z" fill="${cfg.ground}" filter="url(#bleed_${uid})"/>`);
  L.push(`<path d="M0 ${groundY} Q240 ${groundY-8} 480 ${groundY} T960 ${groundY}" fill="none" stroke="${lightenBg(cfg.ground,0.25)}" stroke-width="5" opacity="0.4" filter="url(#bleed_${uid})"/>`);

  /* ---- location accents ---- */
  if (cfg.field) {
    L.push(`<ellipse cx="480" cy="560" rx="560" ry="130" fill="${lightenBg(cfg.ground,0.12)}" opacity="0.5"/>`);
    L.push(`<line x1="480" y1="${groundY}" x2="480" y2="540" stroke="#ffffff" stroke-width="4" opacity="0.4" filter="url(#bleed_${uid})"/>`);
    L.push(`<ellipse cx="480" cy="480" rx="70" ry="26" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.4" filter="url(#bleed_${uid})"/>`);
  }
  if (cfg.water || cfg.sea) {
    const wc = cfg.sea ? '#4fb8d8' : '#c98a5a';
    L.push(`<path d="M0 ${groundY} L960 ${groundY} L960 540 L0 540 Z" fill="${wc}" opacity="0.55" filter="url(#bleed_${uid})"/>`);
    for (let i=0;i<5;i++){ const y=groundY+18+i*22; L.push(`<path d="M${60+rnd()*80} ${y} Q480 ${y-6} ${900-rnd()*80} ${y}" fill="none" stroke="#ffffff" stroke-width="3" opacity="${0.5-i*0.07}" filter="url(#soft_${uid})"/>`); }
    L.push(`<ellipse cx="${cfg.water?720:180}" cy="${groundY+40}" rx="120" ry="16" fill="#fff4d6" opacity="0.5" filter="url(#soft_${uid})"/>`);
  }
  if (cfg.railing) {
    L.push(`<line x1="0" y1="${groundY-4}" x2="960" y2="${groundY-4}" stroke="#e8eef4" stroke-width="8" opacity="0.7" filter="url(#bleed_${uid})"/>`);
    for (let x=40;x<960;x+=90) L.push(`<line x1="${x}" y1="${groundY-4}" x2="${x}" y2="${groundY+70}" stroke="#d6dee8" stroke-width="7" opacity="0.6" filter="url(#bleed_${uid})"/>`);
  }
  if (cfg.lanterns) {
    ['#ff8a5c','#ffd166','#ff6b9d','#c792ea','#7ad0c0'].forEach((c,i)=>{ const x=110+i*185; L.push(`<line x1="${x}" y1="0" x2="${x}" y2="110" stroke="#5a4a6a" stroke-width="2" opacity="0.6"/>`); L.push(`<circle cx="${x}" cy="150" r="60" fill="${c}" opacity="0.2" filter="url(#soft_${uid})"/>`); L.push(`<ellipse cx="${x}" cy="150" rx="26" ry="34" fill="${c}" opacity="0.92" filter="url(#bleed_${uid})"/>`); }); }
  if (cfg.city) {
    for (let i=0;i<7;i++){ const x=i*140,h=170+rnd()*170,w=112; L.push(`<rect x="${x}" y="${groundY-h}" width="${w}" height="${h}" fill="${lightenBg(cfg.ground,0.08+rnd()*0.06)}" opacity="0.9" filter="url(#bleed_${uid})"/>`); for(let wy=0;wy<7;wy++)for(let wx=0;wx<3;wx++){ if(rnd()>0.45) L.push(`<rect x="${x+14+wx*30}" y="${groundY-h+18+wy*24}" width="9" height="12" fill="#ffd98a" opacity="${0.5+rnd()*0.4}"/>`);} }
  }
  if (cfg.rain) {}
  if (cfg.arch==='rain') {
    for (let i=0;i<90;i++){ const x=rnd()*980,y=rnd()*540; L.push(`<line x1="${x}" y1="${y}" x2="${x-9}" y2="${y+28}" stroke="#d4dde5" stroke-width="1.4" opacity="${0.25+rnd()*0.35}"/>`); }
    L.push(`<ellipse cx="480" cy="520" rx="520" ry="40" fill="#ffffff" opacity="0.12" filter="url(#soft_${uid})"/>`);
  }
  if (cfg.shelves) { for (let i=0;i<3;i++){ const x=40+i*150; L.push(`<rect x="${x}" y="120" width="120" height="250" fill="${darkenBg(cfg.ground,0.15)}" opacity="0.5" filter="url(#bleed_${uid})"/>`); for(let s=0;s<5;s++) L.push(`<rect x="${x+8}" y="${140+s*46}" width="104" height="30" fill="${mixTree(cfg.accent)}" opacity="0.4"/>`);} }
  if (cfg.easel) { L.push(`<g filter="url(#bleed_${uid})"><polygon points="150,${groundY} 120,540 180,540" fill="#8a6a48" opacity="0.7"/><rect x="96" y="150" width="150" height="180" fill="#fbf6ee" opacity="0.85"/><rect x="96" y="150" width="150" height="180" fill="none" stroke="#8a6a48" stroke-width="4" opacity="0.6"/><ellipse cx="150" cy="220" rx="40" ry="34" fill="${cfg.accent}" opacity="0.4"/><ellipse cx="180" cy="260" rx="30" ry="24" fill="#7fb0e0" opacity="0.4"/></g>`); }
  if (cfg.easel || cfg.window) {}
  if (cfg.pillars) { for (let x=120;x<960;x+=260) L.push(`<rect x="${x}" y="60" width="46" height="${groundY-60}" fill="${darkenBg(cfg.wall||'#ccc',0.08)}" opacity="0.4" filter="url(#bleed_${uid})"/>`); }
  if (cfg.spotlight) { L.push(`<ellipse cx="480" cy="${groundY+20}" rx="200" ry="46" fill="#ffffff" opacity="0.12" filter="url(#soft_${uid})"/>`); }

  return L.join('');
}
function mixTree(accent){ // greens/foliage from accent hue but pushed toward green
  return accent;
}

function backgroundSVG(key) {
  const cfg = BG[key] || BG.courtyard;
  const uid = key.replace(/[^a-z]/g,'');
  const seedMap = { }; let sc=0; for (const k in BG){ seedMap[k]=++sc*1234567; }
  const rnd = _rng((seedMap[key]||99999));
  const stops = cfg.sky.map((c,i)=>`<stop offset="${i/(cfg.sky.length-1)}" stop-color="${c}"/>`).join('');

  return `<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" class="bg-svg">
    <defs>
      <linearGradient id="sky_${uid}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
      <filter id="bleed_${uid}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.011 0.014" numOctaves="3" seed="${(seedMap[key]||3)%97}" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feGaussianBlur in="d" stdDeviation="2.2"/>
      </filter>
      <filter id="soft_${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
      <filter id="paper_${uid}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.34 0.4" numOctaves="4" seed="7" result="p"/>
        <feColorMatrix in="p" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0.7 0"/>
      </filter>
      <radialGradient id="vig_${uid}" cx="0.5" cy="0.46" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/>
      </radialGradient>
    </defs>
    <rect width="960" height="540" fill="url(#sky_${uid})"/>
    ${bgLayers(key, cfg, uid, rnd)}
    <!-- paper grain -->
    <rect width="960" height="540" filter="url(#paper_${uid})" opacity="0.34" style="mix-blend-mode:multiply"/>
    <rect width="960" height="540" fill="url(#vig_${uid})"/>
  </svg>`;
}

function bgTag(key){ return (BG[key]||{}).tag||''; }

if (typeof module !== 'undefined') module.exports = { backgroundSVG, bgTag, BG };
