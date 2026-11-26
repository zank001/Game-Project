/* art_chars.js — STUB placeholder (owner: art-chars agent replaces this whole file). */
function portraitSVG(charId, expr, opts) {
  var c = (Q.CHARS[charId] && Q.CHARS[charId].color) || '#999';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><ellipse cx="200" cy="560" rx="150" ry="40" fill="' + c + '" opacity=".35"/>' +
    '<rect x="110" y="300" width="180" height="280" rx="60" fill="' + c + '"/><circle cx="200" cy="200" r="90" fill="#f3d9c0"/>' +
    '<text x="200" y="215" text-anchor="middle" font-size="40" fill="#533">' + (expr || 'neutral') + '</text></svg>';
}
