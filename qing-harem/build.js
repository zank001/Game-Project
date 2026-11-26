#!/usr/bin/env node
/* Bundles index.html + css + every <script src> into ONE self-contained standalone.html (offline-playable).
   Usage: node build.js [--exclude=00_sample.js]  (run tools/sync_index.js first) */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const ex = ((process.argv.find(a => a.startsWith('--exclude=')) || '').split('=')[1] || '').split(',').filter(Boolean);
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["'](css\/[^"']+)["'][^>]*>/g, (m, href) => '<style>\n' + fs.readFileSync(path.join(ROOT, href), 'utf8') + '\n</style>');
html = html.replace(/<script\s+src=["']([^"']+)["']\s*><\/script>/g, (m, src) => {
  if (ex.some(x => src.endsWith(x))) return '';
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8').replace(/<\/script>/gi, '<\\/script>');
  return '<script>\n/* ===== ' + src + ' ===== */\n' + code + '\n</script>';
});
fs.writeFileSync(path.join(ROOT, 'standalone.html'), html);
console.log('standalone.html: ' + (html.length / 1024).toFixed(0) + ' KB');
