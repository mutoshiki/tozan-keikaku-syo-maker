const fs = require('node:fs');
const path = require('node:path');

const dist = path.resolve(process.argv[2] || 'dist');
const assetsDir = path.join(dist, 'assets');
const cssFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.css'));
if (cssFiles.length === 0) throw new Error(`No built CSS files found in ${assetsDir}`);

const unresolved = [];
const missing = [];
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  for (const [, rawUrl] of css.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)) {
    const url = rawUrl.trim();
    if (!/plex/i.test(url)) continue;
    if (url.includes('~@ibm/plex') || url.startsWith('@ibm/plex')) unresolved.push(`${file}: ${url}`);
    if (/^(?:https?:|data:|\/)/.test(url)) continue;
    const assetPath = path.resolve(assetsDir, decodeURIComponent(url.split(/[?#]/, 1)[0]));
    if (!assetPath.startsWith(`${path.resolve(dist)}${path.sep}`) || !fs.existsSync(assetPath)) missing.push(`${file}: ${url}`);
  }
}

if (unresolved.length || missing.length) {
  throw new Error([
    ...unresolved.map(item => `Unresolved Carbon font URL: ${item}`),
    ...missing.map(item => `Missing built font asset: ${item}`),
  ].join('\n'));
}
console.log(`Verified IBM Plex font URLs in ${cssFiles.length} built CSS file(s).`);
