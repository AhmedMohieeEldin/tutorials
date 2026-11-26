// node render-stills.mjs 1 2 3   -> stills/shot<N>.jpg
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const srv = await new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
    rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp);
  }).listen(0, () => res(s));
});
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto(`http://localhost:${srv.address().port}/index.html?render=1`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
fs.mkdirSync(path.join(ROOT, 'stills'), { recursive: true });
for (const n of process.argv.slice(2)) {
  const t0 = Date.now();
  const data = await page.evaluate((k) => window.renderShot(k), Number(n));
  fs.writeFileSync(path.join(ROOT, 'stills', `shot${n}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('shot', n, Date.now() - t0, 'ms');
}
await browser.close(); srv.close();
