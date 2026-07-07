/* =============================================================
   art.js — Hand-painted watercolour character portraits (SVG)
   Masses are built from soft gradient washes, then passed through
   a turbulence/displacement filter so edges bleed like wet pigment
   and a fine noise multiply adds granulation. Facial features sit
   on top, only lightly displaced, so they stay readable.
   Everything is generated — no external image assets.
   ============================================================= */

/* ---- tiny colour helpers ----------------------------------- */
function _hx(n){ n=Math.max(0,Math.min(255,Math.round(n))); return n.toString(16).padStart(2,'0'); }
function _rgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function lighten(h,a){ const[r,g,b]=_rgb(h); return '#'+_hx(r+(255-r)*a)+_hx(g+(255-g)*a)+_hx(b+(255-b)*a); }
function darken(h,a){ const[r,g,b]=_rgb(h); return '#'+_hx(r*(1-a))+_hx(g*(1-a))+_hx(b*(1-a)); }
function mixc(h1,h2,t){ const a=_rgb(h1),b=_rgb(h2); return '#'+_hx(a[0]+(b[0]-a[0])*t)+_hx(a[1]+(b[1]-a[1])*t)+_hx(a[2]+(b[2]-a[2])*t); }

/* ---- Per-character visual identity -------------------------- */
const CHAR_ART = {
  phakin: {
    skin: '#f0cdad', skinShade: '#d9a074',
    hair: '#2b2f3d', hairShade: '#171a26', hairLight: '#474d63',
    brow: '#20222c',
    eye: '#3a5a8c', eyeDark: '#20335a',
    shirt: '#21344f', shirtShade: '#152238', collar: '#e2e8f2',
    accent: '#3f6cd0', blushCol: '#e98f8f', seed: 11,
    hairBack: 'M60 150 Q52 60 150 44 Q248 60 240 150 L240 220 Q236 150 210 130 L90 130 Q64 150 60 220 Z',
    hairFront: 'M74 132 Q78 66 150 58 Q222 66 226 132 Q210 96 150 92 Q150 118 132 128 Q112 118 108 96 Q86 104 74 132 Z',
    accessory: 'camera',
  },
  tawan: {
    skin: '#e6b184', skinShade: '#c98b58',
    hair: '#5c3c20', hairShade: '#3c2712', hairLight: '#87582e',
    brow: '#3c2712',
    eye: '#8a5122', eyeDark: '#57310d',
    shirt: '#e8823a', shirtShade: '#c25f1f', collar: '#fff4e9',
    accent: '#ff9f43', blushCol: '#ef8072', seed: 27,
    hairBack: 'M62 148 Q54 62 150 46 Q246 62 238 148 L238 210 Q232 150 208 132 L92 132 Q68 150 62 210 Z',
    hairFront: 'M70 130 L86 84 L100 118 L112 74 L128 116 L150 70 L172 116 L188 74 L200 118 L214 84 L230 130 Q210 98 150 96 Q90 98 70 130 Z',
    accessory: 'headband',
  },
  nil: {
    skin: '#eed7bf', skinShade: '#d3b192',
    hair: '#3a2f4d', hairShade: '#241d33', hairLight: '#5f4f7d',
    brow: '#241d33',
    eye: '#7d5aa8', eyeDark: '#4c3570',
    shirt: '#3b2f52', shirtShade: '#271f3b', collar: '#cdbce4',
    accent: '#9b6bd6', blushCol: '#dd8fb6', seed: 43,
    hairBack: 'M58 156 Q50 60 150 44 Q250 60 242 156 L242 240 Q236 160 214 138 L86 138 Q64 160 58 240 Z',
    hairFront: 'M72 150 Q70 74 150 60 Q230 74 228 140 Q216 100 176 100 Q170 128 150 138 Q120 130 116 100 Q86 110 72 150 Z',
    accessory: 'earring',
  },
  fern: {
    skin: '#f2d3b6', skinShade: '#dcb08a',
    hair: '#6d4b6e', hairShade: '#4a3350', hairLight: '#946a97',
    brow: '#4a3350',
    eye: '#b0587f', eyeDark: '#853c5c',
    shirt: '#f2a0bc', shirtShade: '#d97fa0', collar: '#fff2f7',
    accent: '#ff8fb3', blushCol: '#ef8fa8', seed: 59,
    hairBack: 'M50 160 Q46 58 150 42 Q254 58 250 160 Q256 250 232 300 L228 210 Q232 150 206 132 L94 132 Q68 150 72 210 L68 300 Q44 250 50 160 Z',
    hairFront: 'M74 138 Q76 70 150 60 Q224 70 226 138 Q212 100 150 98 Q150 122 134 130 Q110 120 108 100 Q88 108 74 138 Z',
    accessory: 'clip',
  },
};

/* ---- Expression table --------------------------------------- */
const EXPR = {
  neutral:  { eye:'open',   brow:'flat',  mouth:'soft',   blush:0 },
  smile:    { eye:'open',   brow:'up',    mouth:'smile',  blush:0.15 },
  happy:    { eye:'open',   brow:'up',    mouth:'grin',   blush:0.4 },
  laugh:    { eye:'closed', brow:'up',    mouth:'grin',   blush:0.3 },
  blush:    { eye:'open',   brow:'worry', mouth:'small',  blush:1 },
  shy:      { eye:'half',   brow:'worry', mouth:'small',  blush:1 },
  sad:      { eye:'sad',    brow:'sad',   mouth:'frown',  blush:0.1 },
  surprised:{ eye:'wide',   brow:'up',    mouth:'o',      blush:0.3 },
  serious:  { eye:'sharp',  brow:'down',  mouth:'flat',   blush:0 },
  sulk:     { eye:'half',   brow:'down',  mouth:'pout',   blush:0.25 },
  wink:     { eye:'wink',   brow:'up',    mouth:'smirk',  blush:0.3 },
};

let _artUID = 0;

/* ---- watercolour filter defs -------------------------------- */
function wcFilters(uid, seed) {
  return `
    <filter id="wc_${uid}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.02" numOctaves="4" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="disp"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="${seed+5}" result="grain"/>
      <feComponentTransfer in="grain" result="ga"><feFuncA type="linear" slope="0.16" intercept="0"/></feComponentTransfer>
      <feComposite in="ga" in2="disp" operator="in" result="gm"/>
      <feBlend in="disp" in2="gm" mode="multiply"/>
    </filter>
    <filter id="wcl_${uid}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="${seed+2}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="wb_${uid}" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="${seed+8}" result="n"/>
      <feDisplacementMap in="b" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
}

/* ---- eyes --------------------------------------------------- */
function eyePair(uid, cfg, kind) {
  const one = (cx, flip) => {
    switch (kind) {
      case 'closed': return `<path d="M${cx-15} 178 Q${cx} 188 ${cx+15} 178" fill="none" stroke="${darken(cfg.eyeDark,0.1)}" stroke-width="3" stroke-linecap="round"/>`;
      case 'wink':   return flip ? `<path d="M${cx-15} 178 Q${cx} 188 ${cx+15} 178" fill="none" stroke="${darken(cfg.eyeDark,0.1)}" stroke-width="3" stroke-linecap="round"/>` : eyeOpen(uid,cx,cfg,1);
      case 'half':   return eyeOpen(uid,cx,cfg,0.6);
      case 'sad':    return eyeOpen(uid,cx,cfg,0.85,3);
      case 'wide':   return eyeOpen(uid,cx,cfg,1.25);
      case 'sharp':  return eyeOpen(uid,cx,cfg,0.72,0,true);
      default:       return eyeOpen(uid,cx,cfg,1);
    }
  };
  return one(118,false)+one(182,true);
}
function eyeOpen(uid, cx, cfg, open, tilt=0, sharp=false) {
  const cy=176, rx=12.5, ry=14*open, irisR=8.6, pupilR=4.2;
  const lidTop = sharp ? `M${cx-14} ${cy-2} L${cx+14} ${cy-6}` : `M${cx-14} ${cy-6} Q${cx} ${cy-16} ${cx+14} ${cy-6}`;
  const irisTop = lighten(cfg.eye,0.25), irisBot = darken(cfg.eye,0.15);
  return `
    <g>
      <ellipse cx="${cx}" cy="${cy+tilt}" rx="${rx}" ry="${ry}" fill="#fdfaf6"/>
      <clipPath id="ec_${uid}_${cx}"><ellipse cx="${cx}" cy="${cy+tilt}" rx="${rx}" ry="${ry}"/></clipPath>
      <g clip-path="url(#ec_${uid}_${cx})">
        <ellipse cx="${cx}" cy="${cy+tilt+1}" rx="${irisR}" ry="${irisR+1}" fill="url(#iris_${uid})"/>
        <circle cx="${cx}" cy="${cy+tilt}" r="${pupilR}" fill="${cfg.eyeDark}"/>
        <path d="M${cx-8} ${cy+tilt-6} Q${cx} ${cy+tilt-9} ${cx+8} ${cy+tilt-6}" fill="none" stroke="${darken(cfg.eye,0.28)}" stroke-width="2" opacity="0.55"/>
        <circle cx="${cx-3}" cy="${cy+tilt-5}" r="2.8" fill="#ffffff"/>
        <circle cx="${cx+3.5}" cy="${cy+tilt+3}" r="1.5" fill="#ffffff" opacity="0.8"/>
      </g>
      <path d="${lidTop}" fill="none" stroke="${darken(cfg.eyeDark,0.05)}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M${cx-14} ${cy-6} Q${cx} ${cy-15} ${cx+14} ${cy-6}" fill="none" stroke="${cfg.eyeDark}" stroke-width="0.8" opacity="0.3"/>
    </g>`;
}
function brows(cfg, kind) {
  const c = cfg.brow, w = 3.2;
  const L = d => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="0.9"/>`;
  switch (kind) {
    case 'up':    return L('M104 150 Q118 144 132 149')+L('M168 149 Q182 144 196 150');
    case 'down':  return L('M104 146 Q118 152 132 152')+L('M168 152 Q182 152 196 146');
    case 'worry': return L('M104 152 Q118 146 132 150')+L('M168 150 Q182 146 196 152');
    case 'sad':   return L('M104 148 Q118 156 132 156')+L('M168 156 Q182 156 196 148');
    default:      return L('M104 149 Q118 146 132 149')+L('M168 149 Q182 146 196 149');
  }
}
function mouth(cfg, kind) {
  const s = darken(cfg.blushCol,0.28), lip = mixc(cfg.blushCol, cfg.skinShade, 0.3);
  switch (kind) {
    case 'smile': return `<path d="M138 212 Q150 222 162 212" fill="none" stroke="${s}" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'grin':  return `<path d="M134 210 Q150 228 166 210 Q150 215 134 210 Z" fill="${darken(cfg.blushCol,0.4)}"/><path d="M137 211 Q150 217 163 211" fill="#fffdf9" opacity="0.9"/>`;
    case 'small': return `<path d="M143 214 Q150 219 157 214" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'frown': return `<path d="M139 218 Q150 210 161 218" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'flat':  return `<path d="M140 214 L160 214" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'o':     return `<ellipse cx="150" cy="215" rx="6" ry="8" fill="${darken(cfg.blushCol,0.4)}"/><ellipse cx="150" cy="217" rx="4" ry="4.5" fill="${darken(cfg.blushCol,0.55)}"/>`;
    case 'pout':  return `<path d="M142 216 Q150 210 158 216 Q150 220 142 216 Z" fill="${lip}"/>`;
    case 'smirk': return `<path d="M138 213 Q150 220 164 210" fill="none" stroke="${s}" stroke-width="2.8" stroke-linecap="round"/>`;
    default:      return `<path d="M141 213 Q150 218 159 213" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

function accessory(cfg) {
  switch (cfg.accessory) {
    case 'camera':
      return `<g><path d="M96 300 Q150 330 204 300" fill="none" stroke="#0e1218" stroke-width="7"/>
        <rect x="176" y="300" width="70" height="46" rx="8" fill="url(#cam)"/>
        <circle cx="211" cy="323" r="16" fill="#2a2f38"/><circle cx="211" cy="323" r="9" fill="#4a5568"/>
        <circle cx="211" cy="323" r="4" fill="#9fb4d8"/><rect x="182" y="304" width="12" height="6" rx="2" fill="#3a4150"/></g>`;
    case 'headband':
      return `<path d="M66 128 Q150 106 234 128 L232 141 Q150 121 68 141 Z" fill="${cfg.accent}"/>
        <path d="M66 133 Q150 116 234 133" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.6"/>`;
    case 'earring':
      return `<circle cx="96" cy="214" r="3.4" fill="${cfg.accent}"/><circle cx="96" cy="223" r="4.6" fill="none" stroke="${cfg.accent}" stroke-width="2.4"/>`;
    case 'clip':
      return `<g><rect x="196" y="94" width="22" height="9" rx="4" fill="${cfg.accent}"/><circle cx="201" cy="98.5" r="3" fill="#fff"/><circle cx="213" cy="98.5" r="3" fill="#fff"/></g>`;
    default: return '';
  }
}

/**
 * Build a watercolour bust portrait for a character + expression.
 */
function characterSVG(charKey, exprKey='neutral') {
  const cfg = CHAR_ART[charKey];
  if (!cfg) return '';
  const e = EXPR[exprKey] || EXPR.neutral;
  const uid = charKey + (++_artUID);
  const seed = cfg.seed;

  const skinLo = lighten(cfg.skin,0.16), skinHi = cfg.skin, skinSh = cfg.skinShade;
  const hairLo = cfg.hairLight, hairMid = cfg.hair, hairHi = cfg.hairShade;
  const cheek = cfg.blushCol;

  return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" class="char-svg" preserveAspectRatio="xMidYMax meet">
    <defs>
      ${wcFilters(uid, seed)}
      <radialGradient id="skin_${uid}" cx="0.5" cy="0.4" r="0.62">
        <stop offset="0" stop-color="${skinLo}"/><stop offset="0.62" stop-color="${skinHi}"/><stop offset="1" stop-color="${skinSh}"/>
      </radialGradient>
      <linearGradient id="hair_${uid}" x1="0.15" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="${hairLo}"/><stop offset="0.45" stop-color="${hairMid}"/><stop offset="1" stop-color="${hairHi}"/>
      </linearGradient>
      <linearGradient id="hairb_${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${hairMid}"/><stop offset="1" stop-color="${hairHi}"/>
      </linearGradient>
      <linearGradient id="shirt_${uid}" x1="0.2" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="${lighten(cfg.shirt,0.12)}"/><stop offset="0.5" stop-color="${cfg.shirt}"/><stop offset="1" stop-color="${cfg.shirtShade}"/>
      </linearGradient>
      <radialGradient id="iris_${uid}" cx="0.5" cy="0.35" r="0.7">
        <stop offset="0" stop-color="${lighten(cfg.eye,0.3)}"/><stop offset="0.6" stop-color="${cfg.eye}"/><stop offset="1" stop-color="${darken(cfg.eye,0.2)}"/>
      </radialGradient>
      <radialGradient id="cheek_${uid}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${cheek}" stop-opacity="0.9"/><stop offset="1" stop-color="${cheek}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20242e"/><stop offset="1" stop-color="#0e1116"/></linearGradient>
    </defs>

    <!-- ===== painted masses (heavy watercolour filter) ===== -->
    <g filter="url(#wc_${uid})">
      <!-- shoulders / shirt -->
      <path d="M40 400 Q44 314 108 296 L108 292 Q150 312 192 292 L192 296 Q256 314 260 400 Z" fill="url(#shirt_${uid})"/>
      <path d="M108 296 Q150 322 192 296 L192 306 Q150 330 108 306 Z" fill="${cfg.collar}" opacity="0.92"/>
      <path d="M92 330 Q120 316 120 400 L96 400 Z" fill="${cfg.shirtShade}" opacity="0.4"/>
      <path d="M208 330 Q180 316 180 400 L204 400 Z" fill="${cfg.shirtShade}" opacity="0.4"/>

      <!-- hair back -->
      <path d="${cfg.hairBack}" fill="url(#hairb_${uid})"/>

      <!-- neck + shadow -->
      <path d="M126 264 Q126 300 150 306 Q174 300 174 264 L174 250 L126 250 Z" fill="${skinSh}"/>
      <path d="M126 268 Q150 288 174 268 L174 258 L126 258 Z" fill="${darken(skinSh,0.18)}" opacity="0.55"/>

      <!-- ears -->
      <ellipse cx="80" cy="192" rx="11" ry="16" fill="${skinHi}"/>
      <ellipse cx="220" cy="192" rx="11" ry="16" fill="${skinHi}"/>

      <!-- face -->
      <path d="M86 166 Q86 116 150 110 Q214 116 214 166 Q214 224 176 248 Q150 262 124 248 Q86 224 86 166 Z" fill="url(#skin_${uid})"/>
      <!-- form shadows -->
      <path d="M196 150 Q214 176 200 214 Q192 232 176 244 Q206 210 196 150 Z" fill="${skinSh}" opacity="0.45"/>
      <path d="M104 210 Q112 236 132 250 Q114 244 100 222 Z" fill="${skinSh}" opacity="0.4"/>
      <path d="M96 138 Q150 120 204 138 Q150 132 96 138 Z" fill="${darken(skinSh,0.1)}" opacity="0.3"/>
      <!-- nose shadow -->
      <path d="M150 190 Q145 202 152 205 Q149 199 150 190 Z" fill="${skinSh}" opacity="0.5"/>

      <!-- cheek blush washes -->
      <ellipse cx="112" cy="200" rx="17" ry="10" fill="url(#cheek_${uid})" opacity="${0.35+e.blush*0.55}"/>
      <ellipse cx="188" cy="200" rx="17" ry="10" fill="url(#cheek_${uid})" opacity="${0.35+e.blush*0.55}"/>

      <!-- hair front -->
      ${accessory(cfg).includes('headband') ? '' : ''}
      <path d="${cfg.hairFront}" fill="url(#hair_${uid})"/>
      <!-- hair highlights -->
      <path d="M96 118 Q120 82 150 80 Q140 92 120 116 Z" fill="${lighten(hairLo,0.15)}" opacity="0.5"/>
      <path d="M180 116 Q200 88 220 118 Q206 100 180 116 Z" fill="${lighten(hairLo,0.1)}" opacity="0.35"/>
    </g>

    <!-- accessory -->
    ${cfg.accessory==='headband' ? accessory(cfg) : ''}

    <!-- ===== features (light filter, stay readable) ===== -->
    <g filter="url(#wcl_${uid})">
      ${brows(cfg, e.brow)}
      ${eyePair(uid, cfg, e.eye)}
      <path d="M150 190 Q146 200 151 203" fill="none" stroke="${skinSh}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      ${mouth(cfg, e.mouth)}
    </g>

    <!-- earring / clip over hair -->
    ${(cfg.accessory==='earring'||cfg.accessory==='clip'||cfg.accessory==='camera') ? accessory(cfg) : ''}
  </svg>`;
}

if (typeof module !== 'undefined') module.exports = { characterSVG, CHAR_ART, EXPR };
