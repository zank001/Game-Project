#!/usr/bin/env node
/* Rewrites the block between <!-- DATA:BEGIN --> and <!-- DATA:END --> in index.html
   with one <script> tag per js/data/*.js (sorted). Usage: node tools/sync_index.js [--exclude=00_sample.js,...] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ex = ((process.argv.find(a => a.startsWith('--exclude=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const files = fs.readdirSync(path.join(ROOT, 'js/data')).filter(f => f.endsWith('.js') && ex.indexOf(f) < 0).sort();
const p = path.join(ROOT, 'index.html');
let html = fs.readFileSync(p, 'utf8');
const b = html.indexOf('<!-- DATA:BEGIN -->'), e = html.indexOf('<!-- DATA:END -->');
if (b < 0 || e < 0) { console.error('DATA markers not found in index.html'); process.exit(1); }
const block = '<!-- DATA:BEGIN -->\n' + files.map(f => '<script src="js/data/' + f + '"></script>').join('\n') + '\n';
html = html.slice(0, b) + block + html.slice(e);
fs.writeFileSync(p, html);
console.log('index.html: ' + files.length + ' data files');
