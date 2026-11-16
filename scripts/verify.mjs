import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'jhfigure-qa-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket;
try {
  let pages;
  for (let i = 0; i < 60; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9224/json')).json(); if (pages.length) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  if (!pages?.length) throw Error('Chrome debugging endpoint unavailable');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let id = 0; const requests = new Map(); const errors = [];
  socket.addEventListener('message', event => { const result = JSON.parse(event.data); if (result.id) { const { resolve, reject } = requests.get(result.id); requests.delete(result.id); result.error ? reject(Error(result.error.message)) : resolve(result.result); } else if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.text); });
  function call(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; requests.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); }); }
  async function evaluate(expression) { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:3002' });
  for (let i = 0; i < 50; i++) { if (await evaluate('document.readyState === "complete" && !!document.querySelector(".local-modal")')) break; await new Promise(r => setTimeout(r, 100)); }
  await evaluate('document.fonts.ready');
  const results = await evaluate(`(() => {
    const check = (condition, label) => { if (!condition) throw Error(label); return label; };
    const checks = [];
    checks.push(check(document.querySelectorAll('.product-block').length > 40, 'Product cards loaded'));
    document.querySelector('.product-block .pro-name a').click();
    checks.push(check(document.querySelector('dialog').open, 'Product preview opens'));
    document.querySelector('dialog .local-primary').click();
    checks.push(check(document.querySelector('#header-cart-count').textContent === '1', 'Add to cart updates count'));
    document.querySelector('dialog').close();
    document.querySelector('.header-cart button').click();
    checks.push(check(document.querySelectorAll('.local-cart-row').length === 1, 'Cart displays added item'));
    document.querySelector('.local-cart-row button:last-child').click();
    checks.push(check(document.querySelector('#header-cart-count').textContent === '0', 'Remove from cart updates count'));
    document.querySelector('dialog').close();
    document.querySelector('.search-input').value = 'Miku';
    document.querySelector('.wanda-mxm-search').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    checks.push(check(document.querySelectorAll('dialog .product-block').length > 0, 'Search returns matching products'));
    document.querySelector('dialog').close();
    document.querySelectorAll('.local-dots button')[1].click();
    checks.push(check(document.querySelectorAll('#slick-slider-home .item')[1].classList.contains('local-active'), 'Hero navigation changes slide'));
    document.querySelectorAll('.local-dots button')[0].click();
    checks.push(check(document.documentElement.scrollWidth <= innerWidth, 'Desktop has no horizontal overflow'));
    return checks;
  })()`);
  await evaluate(`document.querySelector('.search-input').value = ''; document.querySelector('.local-toast')?.remove()`);
  const imageCheck = await evaluate(`Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => null); })).then(() => [...document.images].filter(image => image.getAttribute('src')?.startsWith('assets/') && !image.naturalWidth).map(image => image.getAttribute('src')))`);
  if (imageCheck.length) throw Error('Broken local images: ' + JSON.stringify(imageCheck));
  results.push('All local images decode successfully');
  await fs.mkdir(path.join(root, 'previews'), { recursive: true });
  let screenshot = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(root, 'previews/desktop.png'), Buffer.from(screenshot.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 300));
  results.push(await evaluate('document.documentElement.scrollWidth <= innerWidth ? "Mobile has no horizontal overflow" : (()=>{throw Error("Mobile overflow: "+document.documentElement.scrollWidth)})()'));
  screenshot = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(root, 'previews/mobile.png'), Buffer.from(screenshot.data, 'base64'));
  results.push(await evaluate(`(() => { document.querySelector('.navigation-event button').click(); if (!document.querySelector('dialog.local-menu-dialog[open]')) throw Error('Mobile menu failed'); document.querySelector('dialog').close(); return 'Mobile category menu opens'; })()`));
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate('window.scrollTo(0, 1050)');
  await new Promise(r => setTimeout(r, 150));
  screenshot = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(root, 'previews/products.png'), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ checks: results, runtimeErrors: errors }, null, 2));
  await call('Browser.close');
} finally { socket?.close(); browser.kill(); }
