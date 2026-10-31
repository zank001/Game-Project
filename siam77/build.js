/* build.js — bundles Siam77 into ONE self-contained file (standalone.html)
   that works offline by double-clicking (no server, no external requests).

   Usage:  node build.js        (run inside the siam77/ folder)
*/
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');

// keep the exact script order declared in index.html
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((f) => '/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n\n');

let out = html
  .replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '\n</style>')
  .replace(/(<script src="[^"]+"><\/script>\s*)+/, () => '<script>\n' + js + '\n</script>\n');

fs.writeFileSync(path.join(dir, 'standalone.html'), out);
console.log('Built standalone.html (' + Math.round(out.length / 1024) + ' KB, ' + scripts.length + ' scripts inlined)');
