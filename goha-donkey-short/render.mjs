// Renders the short frame-by-frame in headless Chromium and encodes with ffmpeg.
//   node render.mjs stills 0 11 20        -> stills/t_<time>.jpg
//   node render.mjs video [workers]       -> out/goha-donkey.mp4
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FPS = 24;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return page;
}
const launch = () => playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const toBuf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

async function stills(times) {
  const srv = await serve(); const browser = await launch();
  const page = await openPage(browser, srv.address().port);
  fs.mkdirSync(path.join(ROOT, 'stills'), { recursive: true });
  for (const t of times) {
    const t0 = Date.now();
    const data = await page.evaluate((tt) => window.renderFrame(tt, 0.9), t);
    fs.writeFileSync(path.join(ROOT, 'stills', `t_${String(t).padStart(5, '0')}.jpg`), toBuf(data));
    console.log('still', t, (Date.now() - t0) + 'ms');
  }
  await browser.close(); srv.close();
}

async function segment(browser, port, f0, f1, file) {
  const page = await openPage(browser, port);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  for (let f = f0; f < f1; f++) {
    const data = await page.evaluate((tt) => window.renderFrame(tt, 0.95), f / FPS);
    if (!ff.stdin.write(toBuf(data))) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 48 === 0) console.log(`${path.basename(file)}: frame ${f}/${f1}`);
  }
  ff.stdin.end(); await done; await page.close();
}

async function video(workers = 4) {
  const srv = await serve(); const port = srv.address().port;
  const outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const probe = await launch();
  const dur = await (await openPage(probe, port)).evaluate(() => window.DURATION);
  await probe.close();
  const total = Math.round(dur * FPS);
  const per = Math.ceil(total / workers);
  const files = [];
  await Promise.all(Array.from({ length: workers }, async (_, i) => {
    const f0 = i * per, f1 = Math.min(total, f0 + per);
    const file = path.join(outDir, `seg${i}.mp4`); files[i] = file;
    const b = await launch(); await segment(b, port, f0, f1, file); await b.close();
  }));
  fs.writeFileSync(path.join(outDir, 'list.txt'), files.map((f) => `file '${f}'`).join('\n'));
  await new Promise((r) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(outDir, 'list.txt'),
    '-c', 'copy', path.join(outDir, 'video_only.mp4')], { stdio: 'inherit' }).on('close', r));
  srv.close();
  console.log('done', total, 'frames');
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'stills') await stills(rest.map(Number));
else await video(Number(rest[0]) || 4);
