/* build.js — bundles the modular source into a single self-contained file.
   Inlines css/style.css and all js/*.js into standalone.html, which works
   fully offline by double-clicking (no server, no external requests).

   Usage:  node build.js
*/
const fs = require('fs');

const css = fs.readFileSync('css/style.css', 'utf8');
const js = ['art', 'backgrounds', 'characters', 'sound', 'story', 'engine']
  .map(f => '/* ===== ' + f + '.js ===== */\n' + fs.readFileSync('js/' + f + '.js', 'utf8'))
  .join('\n\n');

const html = fs.readFileSync('index.html', 'utf8');
const bodyContent = html.slice(
  html.indexOf('<body>') + '<body>'.length,
  html.indexOf('<script src="js/art.js">')
).trim();
const petals = (html.match(/<script>\s*\n?\/\* floating petals[\s\S]*?<\/script>/) || [''])[0];

const TITLE = 'รักแรกผลิบาน · Blooming Hearts';
const standalone = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#e14e7f">
<title>${TITLE}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%92%97%3C/text%3E%3C/svg%3E">
<style>
${css}
</style>
</head>
<body>
${bodyContent}
<script>
${js}
</script>
${petals}
</body>
</html>
`;

fs.writeFileSync('standalone.html', standalone);
console.log('Built standalone.html (' + standalone.length + ' bytes)');
