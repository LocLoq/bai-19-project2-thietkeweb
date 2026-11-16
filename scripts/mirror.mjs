// Refresh the public homepage's presentation assets. Run from project2.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'assets');
await fs.mkdir(assets, { recursive: true });
const mappings = new Map();
const failures = [];
const decode = value => value.replaceAll('&amp;', '&');
function register(value, base = 'https://jhfigure.com/') {
  value = decode(value.trim());
  if (!value || /^(data:|#|javascript:)/i.test(value)) return value;
  const url = new URL(value, base).href;
  if (!mappings.has(url)) {
    const parsed = new URL(url);
    const ext = parsed.hostname === 'fonts.googleapis.com' ? '.css' : path.extname(parsed.pathname) || '.bin';
    const stem = path.basename(parsed.pathname, ext).replace(/[^a-z0-9_-]/gi, '-').slice(0, 65);
    mappings.set(url, { file: `${stem}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}${ext}`, done: false });
  }
  return `assets/${mappings.get(url).file}`;
}
let html = await (await fetch('https://jhfigure.com/')).text();
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
  .replace(/<input\b[^>]*name=['"]__RequestVerificationToken['"][^>]*>/gi, '')
  .replace(/<link\b[^>]*rel=['"](?:preconnect|dns-prefetch|canonical|preload)['"][^>]*>/gi, '')
  .replace(/<meta\b[^>]*(?:google-site-verification|property="og:|name="twitter:)[^>]*>/gi, '')
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">');
// Use one local image per element instead of downloading every responsive size.
html = html.replace(/<(img|source)\b[^>]*>/gi, tag => {
  const lazy = tag.match(/\sdata-src="([^"]*)"/i);
  if (lazy) tag = tag.replace(/\ssrc="[^"]*"/i, '').replace(/\sdata-src="[^"]*"/i, ` src="${lazy[1]}"`);
  return tag.replace(/\s(?:data-)?srcset="[^"]*"/gi, '').replace(/\sdata-mobile="[^"]*"/gi, '');
});
html = html.replace(/<(img|link)\b[^>]*>/gi, tag => {
  const attr = tag.startsWith('<link') ? 'href' : 'src';
  if (attr === 'href' && !/stylesheet|icon/.test(tag)) return tag;
  return tag.replace(new RegExp(`(${attr}=")([^"]+)(")`, 'i'), (_, a, url, b) => a + register(url) + b)
    .replace(/media="print"/g, 'media="all"');
});
html = html.replace(/url\((['"]?)(https?:\/\/[^)'"\s]+|\/\/[^)'"\s]+)\1\)/gi, (_, q, url) => `url("${register(url)}")`);
html = html.replace(/href="\/(?!\/)([^"]*)"/gi, (_, url) => `href="https://jhfigure.com/${url}"`);
html = html.replace(/href="https:\/\/jhfigure.com\/"/g, 'href="index.html"');
html = html.replace(/action=['"][^'"]*['"]/gi, 'action="#"');
const fontStylesheet = register('https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;500;600;700;800&display=swap');
html = html.replace('</head>', `<link rel="stylesheet" href="${fontStylesheet}">\n<link rel="stylesheet" href="styles.css">\n<script src="app.js" defer></script>\n</head>`);
html = html.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
await fs.writeFile(path.join(root, 'index.html'), html);

async function download(url, item) {
  item.done = true;
  try {
    const destination = path.join(assets, item.file);
    try { await fs.access(destination); return; } catch {}
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    if (/\.css$/.test(item.file)) {
      let css = await response.text();
      css = css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (whole, q, source) => {
        if (/^(data:|#)/.test(source)) return whole;
        return `url("${register(source, url).replace('assets/', '')}")`;
      });
      await fs.writeFile(destination, css);
    } else await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  } catch (error) { failures.push({ url, message: error.message }); }
}
while ([...mappings.values()].some(item => !item.done)) {
  const pending = [...mappings].filter(([, item]) => !item.done);
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < pending.length) {
      const [url, item] = pending[cursor++];
      await download(url, item);
    }
  }));
  console.log(`Downloaded ${[...mappings.values()].filter(x => x.done).length}/${mappings.size} assets`);
}
await fs.writeFile(path.join(root, 'asset-sources.json'), JSON.stringify(Object.fromEntries([...mappings].map(([url, item]) => [item.file, url])), null, 2));
console.log(JSON.stringify({ assets: mappings.size, failures }, null, 2));
