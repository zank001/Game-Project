/* =============================================================
   art.js — Hand-drawn SVG character portraits
   Anime-lite flat illustration style. Each character is a bust
   portrait generated from a small set of parameters plus an
   expression, so we get many faces from compact code and no
   external image assets (everything works offline).
   ============================================================= */

/* ---- Per-character visual identity -------------------------- */
const CHAR_ART = {
  phakin: {
    skin: '#f4d2b4', skinShade: '#e6b892',
    hair: '#2a2d3a', hairShade: '#1c1e29', hairLight: '#3d4152',
    brow: '#20222c',
    eye: '#3a5a8c', eyeDark: '#24406b',
    shirt: '#20304f', shirtShade: '#182741', collar: '#dfe6f2',
    accent: '#3f6cd0',
    blushCol: '#ef9a9a',
    // neat, side-swept clean hair
    hairBack: 'M60 150 Q52 60 150 44 Q248 60 240 150 L240 220 Q236 150 210 130 L90 130 Q64 150 60 220 Z',
    hairFront: 'M74 132 Q78 66 150 58 Q222 66 226 132 Q210 96 150 92 Q150 118 132 128 Q112 118 108 96 Q86 104 74 132 Z',
    accessory: 'camera',
  },
  tawan: {
    skin: '#e9b98d', skinShade: '#d69f72',
    hair: '#5a3a1e', hairShade: '#432a13', hairLight: '#7a5230',
    brow: '#432a13',
    eye: '#8a5122', eyeDark: '#5f360f',
    shirt: '#e8823a', shirtShade: '#cf6a26', collar: '#ffffff',
    accent: '#ff9f43',
    blushCol: '#f28b82',
    // spiky energetic hair
    hairBack: 'M62 148 Q54 62 150 46 Q246 62 238 148 L238 210 Q232 150 208 132 L92 132 Q68 150 62 210 Z',
    hairFront: 'M70 130 L86 84 L100 118 L112 74 L128 116 L150 70 L172 116 L188 74 L200 118 L214 84 L230 130 Q210 98 150 96 Q90 98 70 130 Z',
    accessory: 'headband',
  },
  nil: {
    skin: '#f2dcc6', skinShade: '#e2c3a6',
    hair: '#3a2f4d', hairShade: '#2a2138', hairLight: '#54456f',
    brow: '#2a2138',
    eye: '#7d5aa8', eyeDark: '#553a78',
    shirt: '#3b2f52', shirtShade: '#2c2340', collar: '#c9b8e0',
    accent: '#9b6bd6',
    blushCol: '#e79bbf',
    // soft wavy bangs, one side longer
    hairBack: 'M58 156 Q50 60 150 44 Q250 60 242 156 L242 240 Q236 160 214 138 L86 138 Q64 160 58 240 Z',
    hairFront: 'M72 150 Q70 74 150 60 Q230 74 228 140 Q216 100 176 100 Q170 128 150 138 Q120 130 116 100 Q86 110 72 150 Z',
    accessory: 'earring',
  },
  fern: {
    skin: '#f6d9c0', skinShade: '#e8bfa0',
    hair: '#6d4b6e', hairShade: '#523953', hairLight: '#8a6390',
    brow: '#523953',
    eye: '#b0587f', eyeDark: '#8a3e60',
    shirt: '#f4a6c0', shirtShade: '#e087a6', collar: '#ffffff',
    accent: '#ff8fb3',
    blushCol: '#f28b82',
    hairBack: 'M50 160 Q46 58 150 42 Q254 58 250 160 Q256 250 232 300 L228 210 Q232 150 206 132 L94 132 Q68 150 72 210 L68 300 Q44 250 50 160 Z',
    hairFront: 'M74 138 Q76 70 150 60 Q224 70 226 138 Q212 100 150 98 Q150 122 134 130 Q110 120 108 100 Q88 108 74 138 Z',
    accessory: 'clip',
  },
};

/* ---- Expression table: eyes, brows, mouth, blush ------------ */
/* returns descriptors consumed by the eye/brow/mouth builders   */
const EXPR = {
  neutral:  { eye: 'open',   brow: 'flat',  mouth: 'soft',   blush: 0 },
  smile:    { eye: 'open',   brow: 'up',    mouth: 'smile',  blush: 0 },
  happy:    { eye: 'open',   brow: 'up',    mouth: 'grin',   blush: 0.3 },
  laugh:    { eye: 'closed', brow: 'up',    mouth: 'grin',   blush: 0.2 },
  blush:    { eye: 'open',   brow: 'worry', mouth: 'small',  blush: 1 },
  shy:      { eye: 'half',   brow: 'worry', mouth: 'small',  blush: 1 },
  sad:      { eye: 'sad',    brow: 'sad',   mouth: 'frown',  blush: 0 },
  surprised:{ eye: 'wide',   brow: 'up',    mouth: 'o',      blush: 0.2 },
  serious:  { eye: 'sharp',  brow: 'down',  mouth: 'flat',   blush: 0 },
  sulk:     { eye: 'half',   brow: 'down',  mouth: 'pout',   blush: 0.2 },
  wink:     { eye: 'wink',   brow: 'up',    mouth: 'smirk',  blush: 0.2 },
};

function eyePair(cfg, kind) {
  const { eye, eyeDark } = cfg;
  // draws left+right eye; centered around x=118 and x=182, y=176
  const one = (cx, flip) => {
    const s = flip ? -1 : 1;
    switch (kind) {
      case 'closed':
        return `<path d="M${cx-15} 178 Q${cx} 188 ${cx+15} 178" fill="none" stroke="#5a4636" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'wink':
        // one eye (right side, flip=true) closed, left open
        if (flip) return `<path d="M${cx-15} 178 Q${cx} 188 ${cx+15} 178" fill="none" stroke="#5a4636" stroke-width="3.2" stroke-linecap="round"/>`;
        return eyeOpen(cx, eye, eyeDark, 1);
      case 'half':
        return eyeOpen(cx, eye, eyeDark, 0.6);
      case 'sad':
        return eyeOpen(cx, eye, eyeDark, 0.85, 3*s);
      case 'wide':
        return eyeOpen(cx, eye, eyeDark, 1.25);
      case 'sharp':
        return eyeOpen(cx, eye, eyeDark, 0.75, 0, true);
      default:
        return eyeOpen(cx, eye, eyeDark, 1);
    }
  };
  return one(118, false) + one(182, true);
}

function eyeOpen(cx, eye, eyeDark, open, tilt = 0, sharp = false) {
  const cy = 176;
  const rx = 12, ry = 14 * open;
  const irisR = 8.5, pupilR = 4.2;
  const lidTop = sharp
    ? `M${cx-14} ${cy-2} L${cx+14} ${cy-6}`
    : `M${cx-14} ${cy-6} Q${cx} ${cy-16} ${cx+14} ${cy-6}`;
  return `
    <g>
      <ellipse cx="${cx}" cy="${cy+tilt}" rx="${rx}" ry="${ry}" fill="#ffffff"/>
      <clipPath id="c${cx}"><ellipse cx="${cx}" cy="${cy+tilt}" rx="${rx}" ry="${ry}"/></clipPath>
      <g clip-path="url(#c${cx})">
        <circle cx="${cx}" cy="${cy+tilt-1}" r="${irisR}" fill="${eye}"/>
        <circle cx="${cx}" cy="${cy+tilt-1}" r="${pupilR}" fill="${eyeDark}"/>
        <circle cx="${cx}" cy="${cy+tilt-1}" r="9" fill="none" stroke="${eyeDark}" stroke-width="1" opacity="0.5"/>
        <circle cx="${cx-3}" cy="${cy+tilt-5}" r="2.6" fill="#ffffff"/>
        <circle cx="${cx+3}" cy="${cy+tilt+3}" r="1.4" fill="#ffffff" opacity="0.8"/>
      </g>
      <path d="${lidTop}" fill="none" stroke="#4a3a2c" stroke-width="2.6" stroke-linecap="round"/>
    </g>`;
}

function brows(cfg, kind) {
  const c = cfg.brow;
  const w = 3.4;
  const L = (d) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  switch (kind) {
    case 'up':    return L('M104 150 Q118 144 132 149') + L('M168 149 Q182 144 196 150');
    case 'down':  return L('M104 146 Q118 152 132 152') + L('M168 152 Q182 152 196 146');
    case 'worry': return L('M104 152 Q118 146 132 150') + L('M168 150 Q182 146 196 152');
    case 'sad':   return L('M104 148 Q118 156 132 156') + L('M168 156 Q182 156 196 148');
    default:      return L('M104 149 Q118 146 132 149') + L('M168 149 Q182 146 196 149');
  }
}

function mouth(kind) {
  const s = '#b5654a';
  switch (kind) {
    case 'smile': return `<path d="M138 212 Q150 222 162 212" fill="none" stroke="${s}" stroke-width="3" stroke-linecap="round"/>`;
    case 'grin':  return `<path d="M134 210 Q150 228 166 210 Q150 216 134 210 Z" fill="#9c3d2f"/><path d="M136 212 Q150 218 164 212" fill="#ffffff" opacity="0.85"/>`;
    case 'small': return `<path d="M143 214 Q150 219 157 214" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'frown': return `<path d="M139 218 Q150 210 161 218" fill="none" stroke="${s}" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'flat':  return `<path d="M140 214 L160 214" fill="none" stroke="${s}" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'o':     return `<ellipse cx="150" cy="215" rx="6" ry="8" fill="#9c3d2f"/>`;
    case 'pout':  return `<path d="M142 216 Q150 210 158 216 Q150 220 142 216 Z" fill="${s}"/>`;
    case 'smirk': return `<path d="M138 213 Q150 220 164 210" fill="none" stroke="${s}" stroke-width="3" stroke-linecap="round"/>`;
    default:      return `<path d="M141 213 Q150 218 159 213" fill="none" stroke="${s}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
}

function blushMarks(cfg, amt) {
  if (!amt) return '';
  const o = amt;
  const m = (cx) => `<g opacity="${o}"><ellipse cx="${cx}" cy="196" rx="13" ry="7" fill="${cfg.blushCol}" opacity="0.55"/>
     <line x1="${cx-8}" y1="192" x2="${cx-8}" y2="202" stroke="${cfg.blushCol}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
     <line x1="${cx}" y1="190" x2="${cx}" y2="203" stroke="${cfg.blushCol}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
     <line x1="${cx+8}" y1="192" x2="${cx+8}" y2="202" stroke="${cfg.blushCol}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/></g>`;
  return m(104) + m(196);
}

function accessory(cfg) {
  switch (cfg.accessory) {
    case 'camera':
      return `<g>
        <path d="M96 300 Q150 330 204 300" fill="none" stroke="#101418" stroke-width="7"/>
        <rect x="176" y="300" width="70" height="46" rx="8" fill="#15181e"/>
        <circle cx="211" cy="323" r="16" fill="#2a2f38"/><circle cx="211" cy="323" r="9" fill="#4a5568"/>
        <circle cx="211" cy="323" r="4" fill="#8fa4c8"/><rect x="182" y="304" width="12" height="6" rx="2" fill="#3a4150"/>
      </g>`;
    case 'headband':
      return `<path d="M66 128 Q150 108 234 128 L232 140 Q150 122 68 140 Z" fill="${cfg.accent}"/>
        <path d="M66 132 L234 132" stroke="#ffffff" stroke-width="3" opacity="0.7"/>`;
    case 'earring':
      return `<circle cx="96" cy="214" r="3.4" fill="${cfg.accent}"/><circle cx="96" cy="222" r="4.6" fill="none" stroke="${cfg.accent}" stroke-width="2.2"/>`;
    case 'clip':
      return `<g><rect x="196" y="96" width="20" height="8" rx="4" fill="${cfg.accent}"/><circle cx="200" cy="100" r="3" fill="#fff"/><circle cx="212" cy="100" r="3" fill="#fff"/></g>`;
    default: return '';
  }
}

/**
 * Build an SVG bust portrait string for a character in a given expression.
 * @param {string} charKey  phakin | tawan | nil | fern
 * @param {string} exprKey  see EXPR keys
 */
function characterSVG(charKey, exprKey = 'neutral') {
  const cfg = CHAR_ART[charKey];
  if (!cfg) return '';
  const e = EXPR[exprKey] || EXPR.neutral;

  return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" class="char-svg" preserveAspectRatio="xMidYMax meet">
    <defs>
      <linearGradient id="sh_${charKey}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${cfg.shirt}"/><stop offset="1" stop-color="${cfg.shirtShade}"/>
      </linearGradient>
    </defs>

    <!-- shoulders / shirt -->
    <path d="M40 400 Q44 316 108 296 L108 292 Q150 312 192 292 L192 296 Q256 316 260 400 Z" fill="url(#sh_${charKey})"/>
    <path d="M108 296 Q150 322 192 296 L192 306 Q150 330 108 306 Z" fill="${cfg.collar}" opacity="0.9"/>
    ${accessory(cfg)}

    <!-- neck -->
    <path d="M126 268 Q126 300 150 306 Q174 300 174 268 L174 250 L126 250 Z" fill="${cfg.skinShade}"/>
    <path d="M126 268 Q126 292 150 298 Q174 292 174 268 L174 258 L126 258 Z" fill="${cfg.skin}"/>

    <!-- hair back -->
    <path d="${cfg.hairBack}" fill="${cfg.hairShade}"/>

    <!-- ears -->
    <ellipse cx="80" cy="192" rx="11" ry="16" fill="${cfg.skin}"/>
    <ellipse cx="220" cy="192" rx="11" ry="16" fill="${cfg.skin}"/>
    <path d="M78 186 Q84 192 80 200" fill="none" stroke="${cfg.skinShade}" stroke-width="2"/>
    <path d="M222 186 Q216 192 220 200" fill="none" stroke="${cfg.skinShade}" stroke-width="2"/>

    <!-- face -->
    <path d="M86 168 Q86 118 150 112 Q214 118 214 168 Q214 224 176 248 Q150 262 124 248 Q86 224 86 168 Z" fill="${cfg.skin}"/>
    <path d="M96 208 Q100 236 130 250 Q112 244 100 224 Z" fill="${cfg.skinShade}" opacity="0.5"/>

    <!-- blush -->
    ${blushMarks(cfg, e.blush)}

    <!-- brows -->
    ${brows(cfg, e.brow)}

    <!-- eyes -->
    ${eyePair(cfg, e.eye)}

    <!-- nose -->
    <path d="M150 192 Q147 200 151 202" fill="none" stroke="${cfg.skinShade}" stroke-width="2" stroke-linecap="round"/>

    <!-- mouth -->
    ${mouth(e.mouth)}

    <!-- hair front (over forehead) -->
    <path d="${cfg.hairFront}" fill="${cfg.hair}"/>
    <path d="${cfg.hairFront}" fill="none" stroke="${cfg.hairLight}" stroke-width="1.5" opacity="0.4"/>
  </svg>`;
}

if (typeof module !== 'undefined') module.exports = { characterSVG, CHAR_ART, EXPR };
