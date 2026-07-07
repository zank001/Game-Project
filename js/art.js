/* =============================================================
   art.js — Bishounen anime character portraits (SVG)
   Semi-realistic anime style: slender V-line faces, large detailed
   eyes (gradient iris + highlights + lash lines), layered pointed
   hair with glossy highlight bands, soft cel shading. Clean line
   art on the eyes/hair sits over lineless painted skin so the cast
   reads as polished anime over the watercolour backgrounds.
   All generated — no external image assets.
   ============================================================= */

/* ---- colour helpers ---------------------------------------- */
function _hx(n){ n=Math.max(0,Math.min(255,Math.round(n))); return n.toString(16).padStart(2,'0'); }
function _rgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function lighten(h,a){ const[r,g,b]=_rgb(h); return '#'+_hx(r+(255-r)*a)+_hx(g+(255-g)*a)+_hx(b+(255-b)*a); }
function darken(h,a){ const[r,g,b]=_rgb(h); return '#'+_hx(r*(1-a))+_hx(g*(1-a))+_hx(b*(1-a)); }
function mixc(h1,h2,t){ const a=_rgb(h1),b=_rgb(h2); return '#'+_hx(a[0]+(b[0]-a[0])*t)+_hx(a[1]+(b[1]-a[1])*t)+_hx(a[2]+(b[2]-a[2])*t); }

const LINE = '#3f3038';   // soft near-black line art colour

/* ---- Per-character identity --------------------------------- */
const CHAR_ART = {
  phakin: {
    skin:'#f6d8bd', skinSh:'#e6b592', skinDeep:'#d49a72',
    hair:'#2c3040', hairSh:'#181b28', hairHi:'#565d78',
    brow:'#20222e', lash:'#20222c',
    eye:'#4f7fc4', eyeDeep:'#2a4d86', eyeHi:'#bcd8ff',
    shirt:'#22354f', shirtSh:'#16233a', collar:'#e6ecf5',
    accent:'#3f6cd0', blush:'#ef9a9a', style:'phakin',
  },
  tawan: {
    skin:'#f0c298', skinSh:'#dda06f', skinDeep:'#c8895a',
    hair:'#5e3d20', hairSh:'#3d2712', hairHi:'#9a6a38',
    brow:'#3d2712', lash:'#3a2611',
    eye:'#a86a2c', eyeDeep:'#6f4013', eyeHi:'#ffe0a8',
    shirt:'#eb8637', shirtSh:'#c8631d', collar:'#fff5ea',
    accent:'#ff9f43', blush:'#f28b72', style:'tawan',
  },
  nil: {
    skin:'#f3ddc6', skinSh:'#dcb896', skinDeep:'#c9a179',
    hair:'#3c3050', hairSh:'#241b32', hairHi:'#6a5690',
    brow:'#241b32', lash:'#241b30',
    eye:'#9067c4', eyeDeep:'#5c3f8c', eyeHi:'#e6d4ff',
    shirt:'#3d3155', shirtSh:'#28203c', collar:'#d2c2e6',
    accent:'#9b6bd6', blush:'#dd93b6', style:'nil',
  },
  fern: {
    skin:'#f7d9bf', skinSh:'#e6b596', skinDeep:'#d29e7c',
    hair:'#7a4f78', hairSh:'#553556', hairHi:'#a878a6',
    brow:'#553556', lash:'#4a2e4c',
    eye:'#c65d84', eyeDeep:'#973f60', eyeHi:'#ffd6e6',
    shirt:'#f2a0bc', shirtSh:'#d97fa0', collar:'#fff2f7',
    accent:'#ff8fb3', blush:'#ef8fa8', style:'fern',
  },
};

/* ---- Expression table --------------------------------------- */
const EXPR = {
  neutral:  { eye:'open',  brow:'flat',  mouth:'soft',  blush:0 },
  smile:    { eye:'open',  brow:'up',    mouth:'smile', blush:0.12 },
  happy:    { eye:'arc',   brow:'up',    mouth:'grin',  blush:0.35 },
  laugh:    { eye:'arc',   brow:'up',    mouth:'grin',  blush:0.25 },
  blush:    { eye:'open',  brow:'worry', mouth:'small', blush:1 },
  shy:      { eye:'half',  brow:'worry', mouth:'small', blush:1 },
  sad:      { eye:'sad',   brow:'sad',   mouth:'frown', blush:0.1 },
  surprised:{ eye:'wide',  brow:'up',    mouth:'o',     blush:0.25 },
  serious:  { eye:'sharp', brow:'down',  mouth:'flat',  blush:0 },
  sulk:     { eye:'half',  brow:'down',  mouth:'pout',  blush:0.2 },
  wink:     { eye:'wink',  brow:'up',    mouth:'smirk', blush:0.25 },
};

let _artUID = 0;

/* ============================================================
   EYES — the centrepiece. cx = centre, dir = +1 right / -1 left
   ============================================================ */
function animeEye(uid, cx, cfg, dir, kind) {
  const cy = 199;
  const S = '#fcf8f3';

  // closed / smiling-arc eyes
  if (kind === 'arc' || kind === 'closed') {
    return `<path d="M${cx-15} ${cy+2} Q${cx+dir*2} ${cy-12} ${cx+15} ${cy}" fill="none" stroke="${cfg.lash}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M${cx+dir*4} ${cy-3} q${dir*7} -1 ${dir*10} -5" fill="none" stroke="${cfg.lash}" stroke-width="2.4" stroke-linecap="round"/>`;
  }

  // openness / shape params per kind
  let topR=17, botD=13, irisR=14, irisY=cy, flat=false, droop=0;
  if (kind==='half'){ topR=9;  botD=9;  irisY=cy+2; }
  if (kind==='wide'){ topR=19; botD=15; irisR=15; }
  if (kind==='sharp'){ topR=12; botD=10; flat=true; }
  if (kind==='sad'){  topR=15; botD=11; irisY=cy+3; droop=5; }

  const inX=cx-dir*14, inY=cy+5;            // inner corner
  const outX=cx+dir*16, outY=cy-4+droop;    // outer corner (cat-eye lift)
  const pkX=cx+dir*1, pkY=cy-topR;
  const boX=cx-dir*1, boY=cy+botD;
  const sclera = `M${inX} ${inY} Q${pkX} ${pkY} ${outX} ${outY} Q${boX} ${boY} ${inX} ${inY} Z`;
  const clip = `ec_${uid}_${dir>0?'r':'l'}`;
  const lidTop = flat ? `M${inX} ${inY-1} L${outX} ${outY}` : `M${inX} ${inY} Q${pkX} ${pkY-2} ${outX} ${outY}`;

  return `
    <g>
      <path d="${sclera}" fill="${S}"/>
      <clipPath id="${clip}"><path d="${sclera}"/></clipPath>
      <g clip-path="url(#${clip})">
        <circle cx="${cx}" cy="${irisY}" r="${irisR}" fill="url(#iris_${uid})"/>
        <ellipse cx="${cx}" cy="${irisY-irisR+3}" rx="${irisR}" ry="6" fill="${cfg.eyeDeep}" opacity="0.5"/>
        <circle cx="${cx}" cy="${irisY}" r="${irisR}" fill="none" stroke="${cfg.eyeDeep}" stroke-width="2.2" opacity="0.6"/>
        <ellipse cx="${cx}" cy="${irisY+1}" rx="4.4" ry="5.4" fill="#161019"/>
        <path d="M${cx-irisR+2} ${irisY+2} Q${cx} ${irisY+irisR} ${cx+irisR-2} ${irisY+2}" fill="${lighten(cfg.eye,0.45)}" opacity="0.55"/>
        <circle cx="${cx-dir*4}" cy="${irisY-5}" r="5" fill="#ffffff"/>
        <circle cx="${cx+dir*5}" cy="${irisY+6}" r="2.4" fill="#ffffff" opacity="0.92"/>
        <circle cx="${cx-dir*7}" cy="${irisY-1}" r="1.4" fill="${cfg.eyeHi}" opacity="0.85"/>
      </g>
      <!-- lower lid -->
      <path d="M${outX} ${outY+3} Q${boX} ${boY} ${inX} ${inY+1}" fill="none" stroke="${cfg.skinDeep}" stroke-width="1.5" opacity="0.45"/>
      <!-- upper lash: base + thicker outer + flick -->
      <path d="${lidTop}" fill="none" stroke="${cfg.lash}" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M${cx+dir*5} ${cy-topR+2} Q${pkX+dir*8} ${pkY} ${outX} ${outY}" fill="none" stroke="${cfg.lash}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M${outX} ${outY} q${dir*7} -2 ${dir*11} -6" fill="none" stroke="${cfg.lash}" stroke-width="2.6" stroke-linecap="round"/>
      <!-- double-lid crease -->
      <path d="M${inX+dir*1} ${inY-5} Q${pkX} ${pkY-5} ${outX-dir*3} ${outY-4}" fill="none" stroke="${cfg.lash}" stroke-width="1" opacity="0.28"/>
    </g>`;
}

function eyesGroup(uid, cfg, kind) {
  const Lc = 126, Rc = 174;
  if (kind === 'wink')
    return animeEye(uid, Lc, cfg, -1, 'open') + animeEye(uid, Rc, cfg, +1, 'arc');
  return animeEye(uid, Lc, cfg, -1, kind) + animeEye(uid, Rc, cfg, +1, kind);
}

function browsGroup(cfg, kind) {
  const c = cfg.brow, w = 4;
  const L = d => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  // left brow (100-140), right brow (160-200)
  switch (kind) {
    case 'up':    return L('M102 168 Q120 160 140 166')+L('M160 166 Q180 160 198 168');
    case 'down':  return L('M104 166 Q120 174 140 173')+L('M160 173 Q180 174 196 166');
    case 'worry': return L('M102 172 Q120 164 140 169')+L('M160 169 Q180 164 198 172');
    case 'sad':   return L('M104 166 Q120 178 140 178')+L('M160 178 Q180 178 196 166');
    default:      return L('M102 170 Q120 164 140 169')+L('M160 169 Q180 164 198 170');
  }
}

function mouthGroup(cfg, kind) {
  const s = darken(cfg.blush,0.3), lip = mixc(cfg.blush, cfg.skinSh, 0.35);
  switch (kind) {
    case 'smile': return `<path d="M138 250 Q150 260 162 250" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'grin':  return `<path d="M135 249 Q150 266 165 249 Q150 254 135 249 Z" fill="${darken(cfg.blush,0.42)}"/><path d="M139 250 Q150 256 161 250" fill="#fffdf9"/><path d="M135 249 Q150 253 165 249" fill="none" stroke="${s}" stroke-width="1.4"/>`;
    case 'small': return `<path d="M144 251 Q150 255 156 251" fill="none" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'frown': return `<path d="M141 255 Q150 248 159 255" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'flat':  return `<path d="M141 251 L159 251" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'o':     return `<ellipse cx="150" cy="252" rx="5.5" ry="7.5" fill="${darken(cfg.blush,0.45)}"/><ellipse cx="150" cy="254" rx="3.5" ry="4" fill="${darken(cfg.blush,0.6)}"/>`;
    case 'pout':  return `<path d="M143 253 Q150 247 157 253 Q150 257 143 253 Z" fill="${lip}"/>`;
    case 'smirk': return `<path d="M137 251 Q150 258 163 247" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
    default:      return `<path d="M142 250 Q150 255 158 250" fill="none" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

/* ============================================================
   HAIR — layered pointed clumps per character
   returns { back, front } SVG strings
   ============================================================ */
function hairFor(uid, cfg) {
  const base = `url(#hair_${uid})`, sh = cfg.hairSh, hi = `url(#hairhi_${uid})`;
  const style = cfg.style;
  const strand = (d,c,w,o)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;

  if (style === 'phakin') { // cool, side-swept, neat
    const back = `<path d="M98 130 Q92 62 150 56 Q208 62 202 130 L206 184 Q208 142 188 124 L112 124 Q92 142 94 184 Z" fill="${sh}"/>`;
    // one continuous front mass; bottom edge = pointed fringe (parted right of centre)
    const front = `<path d="M96 160 Q90 66 150 58 Q210 66 204 160
      L198 182 Q193 160 187 162 L174 186 Q166 160 160 164 L168 160 Q162 178 150 172
      Q150 154 158 140 Q150 162 138 168 L128 188 Q120 160 114 162 L104 182 Q96 164 96 160 Z" fill="${base}"/>`;
    const sweep = `<path d="M150 70 C 122 76 106 104 102 156 C 112 108 134 88 160 86 C 158 78 154 70 150 70 Z" fill="${sh}" opacity="0.4"/>`;
    const shine = `<path d="M112 96 Q150 74 190 100 Q150 86 118 104 Q114 100 112 96 Z" fill="${hi}" opacity="0.8"/>`;
    const det = strand('M118 104 Q142 84 178 92',cfg.hairHi,1.3,0.4)+strand('M150 70 Q128 88 114 126',cfg.hairSh,1.6,0.5);
    return { back, front: front+sweep+shine+det };
  }

  if (style === 'tawan') { // energetic short athletic cut, spikes define the silhouette
    const back = `<path d="M104 150 Q98 92 150 86 Q202 92 196 150 L200 176 Q202 148 184 130 L116 130 Q98 148 100 176 Z" fill="${sh}"/>`;
    // many small varied spikes = tousled; shallow notches so the back cap shows between
    const front = `<path d="M100 152 L106 118 L115 90 L123 108 L132 82 L140 102 L148 84 L156 74 L164 96 L172 80 L181 104 L190 88 L196 118 L200 152
      L194 176 L186 156 L176 182 L168 156 L158 176 L150 154 L144 178 L136 156 L126 180 L118 156 L108 176 L100 152 Z" fill="${base}"/>`;
    const shade = `<path d="M123 108 L128 154 L118 156 Z M172 104 L168 154 L178 156 Z" fill="${sh}" opacity="0.35"/>`;
    const shine = `<path d="M112 104 Q150 86 188 104 Q150 94 116 110 Q112 108 112 104 Z" fill="${hi}" opacity="0.65"/>`;
    const det = strand('M115 92 L122 116 M148 86 L150 112 M181 106 L176 116',cfg.hairSh,1.4,0.4)
      + strand('M110 106 Q150 88 190 106',cfg.hairHi,1.2,0.4);
    // sporty headband across the forehead, over the fringe
    const band = `<path d="M100 160 Q150 152 200 160 L198 174 Q150 164 102 174 Z" fill="${cfg.accent}"/>
      <path d="M100 164 Q150 156 200 164" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.6"/>`;
    return { back, front: front+shade+shine+det, over: band };
  }

  if (style === 'nil') { // soft, longer, side-swept over one eye
    const back = `<path d="M92 134 Q86 60 150 54 Q214 60 208 136 L214 218 Q212 158 190 128 L110 128 Q88 158 86 218 Z" fill="${sh}"/>`;
    const sideL = `<path d="M92 138 Q86 194 100 236 Q94 190 104 150 Z" fill="${base}"/>`;
    const sideR = `<path d="M208 138 Q214 196 200 238 Q206 190 196 150 Z" fill="${base}"/>`;
    const front = `<path d="M92 162 Q86 62 150 54 Q214 62 208 162
      L200 186 Q194 162 187 164 L176 192 Q168 162 160 166
      Q168 154 156 134 Q150 162 134 172 L124 194 Q116 162 110 164 L100 186 Q92 166 92 162 Z" fill="${base}"/>`;
    const swoop = `<path d="M156 70 C 128 82 110 110 104 172 C 116 114 140 92 164 90 C 162 80 160 70 156 70 Z" fill="${sh}" opacity="0.5"/>`;
    const shine = `<path d="M108 102 Q150 72 192 104 Q150 86 116 110 Q110 106 108 102 Z" fill="${hi}" opacity="0.8"/>`;
    const det = strand('M156 70 Q128 92 110 156',cfg.hairSh,1.6,0.5)+strand('M116 108 Q150 84 188 100',cfg.hairHi,1.3,0.4);
    return { back, front: front+sideL+sideR+swoop+shine+det };
  }

  // fern — soft with long side locks
  const back = `<path d="M82 138 Q78 50 150 42 Q222 50 218 138 Q224 244 204 298 L198 202 Q204 150 184 118 L116 118 Q96 150 102 202 L96 298 Q76 244 82 138 Z" fill="${sh}"/>`;
  const front = `<path d="M96 150 Q88 54 150 46 Q212 54 204 150
    L196 176 Q190 156 184 160 L172 180 Q164 156 158 162 L150 176 Q143 156 136 162 L126 180 Q118 156 112 160 L104 176 Q98 158 96 150 Z" fill="${base}"/>`;
  const shine = `<path d="M108 90 Q150 66 192 94 Q150 80 114 98 Q110 94 108 90 Z" fill="${hi}" opacity="0.75"/>`;
  return { back, front: front+shine };
}

function accessory(cfg) {
  switch (cfg.style) {
    case 'phakin':
      return `<g><path d="M100 322 Q150 350 200 322" fill="none" stroke="#12161c" stroke-width="6"/>
        <rect x="176" y="318" width="66" height="44" rx="7" fill="url(#cam)"/>
        <circle cx="209" cy="340" r="15" fill="#2a2f38"/><circle cx="209" cy="340" r="8.5" fill="#4a5568"/>
        <circle cx="209" cy="340" r="3.5" fill="#9fb4d8"/></g>`;
    case 'tawan':
      return `<path d="M98 118 Q150 98 202 118 L200 130 Q150 110 100 130 Z" fill="${cfg.accent}"/>
        <path d="M98 122 Q150 104 202 122" fill="none" stroke="#fff" stroke-width="2.6" opacity="0.6"/>`;
    case 'nil':
      return `<circle cx="94" cy="238" r="3.2" fill="${cfg.accent}"/><circle cx="94" cy="247" r="4.4" fill="none" stroke="${cfg.accent}" stroke-width="2.2"/>`;
    case 'fern':
      return `<g><ellipse cx="204" cy="104" rx="12" ry="9" fill="${cfg.accent}"/><ellipse cx="204" cy="104" rx="12" ry="9" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.7"/><circle cx="204" cy="104" r="3" fill="#fff"/></g>`;
    default: return '';
  }
}

/**
 * Build a bishounen anime portrait for a character + expression.
 */
function characterSVG(charKey, exprKey='neutral') {
  const cfg = CHAR_ART[charKey];
  if (!cfg) return '';
  const e = EXPR[exprKey] || EXPR.neutral;
  const uid = charKey + (++_artUID);
  const hair = hairFor(uid, cfg);
  const blush = e.blush;

  return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" class="char-svg" preserveAspectRatio="xMidYMax meet">
    <defs>
      <radialGradient id="skin_${uid}" cx="0.5" cy="0.42" r="0.66">
        <stop offset="0" stop-color="${lighten(cfg.skin,0.12)}"/><stop offset="0.62" stop-color="${cfg.skin}"/><stop offset="1" stop-color="${cfg.skinSh}"/>
      </radialGradient>
      <linearGradient id="hair_${uid}" x1="0.2" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${lighten(cfg.hair,0.12)}"/><stop offset="0.5" stop-color="${cfg.hair}"/><stop offset="1" stop-color="${cfg.hairSh}"/>
      </linearGradient>
      <linearGradient id="hairhi_${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${cfg.hairHi}"/><stop offset="1" stop-color="${cfg.hairHi}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="shirt_${uid}" x1="0.2" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="${lighten(cfg.shirt,0.1)}"/><stop offset="0.5" stop-color="${cfg.shirt}"/><stop offset="1" stop-color="${cfg.shirtSh}"/>
      </linearGradient>
      <radialGradient id="iris_${uid}" cx="0.5" cy="0.28" r="0.75">
        <stop offset="0" stop-color="${lighten(cfg.eye,0.28)}"/><stop offset="0.5" stop-color="${cfg.eye}"/><stop offset="1" stop-color="${cfg.eyeDeep}"/>
      </radialGradient>
      <radialGradient id="cheek_${uid}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${cfg.blush}" stop-opacity="0.85"/><stop offset="1" stop-color="${cfg.blush}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20242e"/><stop offset="1" stop-color="#0e1116"/></linearGradient>
      <filter id="soft_${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.4"/></filter>
    </defs>

    <!-- shoulders / shirt -->
    <path d="M44 400 Q48 320 112 300 L116 292 Q150 308 184 292 L188 300 Q252 320 256 400 Z" fill="url(#shirt_${uid})"/>
    <path d="M116 296 Q150 320 184 296 L182 306 Q150 326 118 306 Z" fill="${cfg.collar}"/>
    <path d="M112 300 Q126 310 128 400 L112 400 Z" fill="${cfg.shirtSh}" opacity="0.45"/>
    <path d="M188 300 Q174 310 172 400 L188 400 Z" fill="${cfg.shirtSh}" opacity="0.45"/>

    <!-- back hair -->
    ${hair.back}

    <!-- neck + shadow -->
    <path d="M130 274 Q130 306 150 312 Q170 306 170 274 L170 256 L130 256 Z" fill="${cfg.skinSh}"/>
    <path d="M130 278 Q150 296 170 278 L170 268 L130 268 Z" fill="${cfg.skinDeep}" opacity="0.5"/>

    <!-- ears -->
    <path d="M104 196 Q92 194 92 208 Q94 222 108 220 Z" fill="${cfg.skin}"/>
    <path d="M196 196 Q208 194 208 208 Q206 222 192 220 Z" fill="${cfg.skin}"/>
    <path d="M100 200 Q96 206 102 214" fill="none" stroke="${cfg.skinDeep}" stroke-width="1.6" opacity="0.5"/>
    <path d="M200 200 Q204 206 198 214" fill="none" stroke="${cfg.skinDeep}" stroke-width="1.6" opacity="0.5"/>

    <!-- face (slender V-line) -->
    <path d="M104 168 Q104 118 150 112 Q196 118 196 168
             Q194 206 178 232 Q164 258 150 270 Q136 258 122 232 Q106 206 104 168 Z" fill="url(#skin_${uid})"/>

    <!-- cel shadows for form -->
    <g filter="url(#soft_${uid})">
      <path d="M108 130 Q150 116 192 130 Q170 138 150 136 Q130 138 108 130 Z" fill="${cfg.skinSh}" opacity="0.55"/>
      <path d="M184 168 Q192 200 172 230 Q164 244 152 254 Q178 220 182 168 Z" fill="${cfg.skinSh}" opacity="0.4"/>
      <path d="M116 168 Q108 200 128 230 Q118 210 116 168 Z" fill="${cfg.skinSh}" opacity="0.3"/>
      <path d="M150 232 Q140 250 150 262 Q160 250 150 232 Z" fill="${cfg.skinSh}" opacity="0.35"/>
    </g>

    <!-- nose -->
    <path d="M150 226 Q145 236 152 240" fill="none" stroke="${cfg.skinDeep}" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>
    <ellipse cx="150" cy="228" rx="3" ry="4" fill="${lighten(cfg.skin,0.14)}" opacity="0.5"/>

    <!-- cheek blush -->
    <ellipse cx="120" cy="224" rx="16" ry="9" fill="url(#cheek_${uid})" opacity="${0.25+blush*0.6}"/>
    <ellipse cx="180" cy="224" rx="16" ry="9" fill="url(#cheek_${uid})" opacity="${0.25+blush*0.6}"/>
    ${blush>0.6?`<g opacity="${(blush-0.6)*1.6}"><path d="M110 220 l0 8 M120 219 l0 9 M130 220 l0 8" stroke="${cfg.blush}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/><path d="M170 220 l0 8 M180 219 l0 9 M190 220 l0 8" stroke="${cfg.blush}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></g>`:''}

    <!-- brows -->
    ${browsGroup(cfg, e.brow)}

    <!-- eyes -->
    ${eyesGroup(uid, cfg, e.eye)}

    <!-- mouth -->
    ${mouthGroup(cfg, e.mouth)}

    <!-- front hair -->
    ${hair.front}
    ${hair.over||''}

    <!-- accessories over hair -->
    ${cfg.style!=='tawan'?accessory(cfg):''}
  </svg>`;
}

if (typeof module !== 'undefined') module.exports = { characterSVG, CHAR_ART, EXPR };
