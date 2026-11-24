// Ember Keys — Isle of Smoke: screenshot capture tool.
// Launches headless Chromium, serves the game locally, loads every scene
// listed in shots.json at 1280x800 and saves a JPEG per scene into
// screenshots/. Uses only Node's standard library: the DevTools protocol
// is driven over the built-in WebSocket. No npm dependencies.
//
// Run: node tools/capture.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = join(repoRoot, 'game');
const shotsPath = join(repoRoot, 'shots.json');
const outDir = join(repoRoot, 'screenshots');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const DEBUG_PORT = 9333;
const HTTP_PORT = 8901;
const MAX_BYTES = 262144;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serveGame() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        let p = decodeURIComponent(url.pathname);
        if (p === '/') p = '/index.html';
        const file = normalize(join(gameRoot, p));
        if (!file.startsWith(gameRoot)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chromium remote debugging did not come up');
}

// Minimal CDP client over the built-in WebSocket.
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  if (!existsSync(CHROME)) throw new Error('Chromium not found at ' + CHROME);
  const shots = JSON.parse(await readFile(shotsPath, 'utf8'));
  await mkdir(outDir, { recursive: true });
  const server = await serveGame();

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const version = await waitForDebugger();
    // Open a fresh page target.
    const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
    const target = await listRes.json();
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
    });

    const consoleErrors = [];
    cdp.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(JSON.stringify(msg.params.args?.map((a) => a.value || a.description || '')));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('exception: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || ''));
      }
    });
    await cdp.send('Log.enable').catch(() => {});

    for (const shot of shots) {
      const url = `http://127.0.0.1:${HTTP_PORT}/index.html${shot.query}&seed=20261124`;
      await cdp.send('Page.navigate', { url });
      // Wait for the game to compose the scene and flag readiness.
      let ready = false;
      for (let i = 0; i < 80 && !ready; i++) {
        await sleep(250);
        const r = await cdp.send('Runtime.evaluate', {
          expression: 'window.__emberReady === true',
          returnByValue: true,
        });
        ready = r?.result?.value === true;
      }
      if (!ready) throw new Error('scene never became ready: ' + shot.name);
      await sleep(650); // let a few frames render for motion/props

      // Capture, lowering JPEG quality until the file fits the cap.
      let quality = 82;
      let data = null;
      for (;;) {
        const shotRes = await cdp.send('Page.captureScreenshot', {
          format: 'jpeg', quality, captureBeyondViewport: false,
        });
        data = Buffer.from(shotRes.data, 'base64');
        if (data.length <= MAX_BYTES || quality <= 40) break;
        quality -= 14;
      }
      const path = join(outDir, shot.name);
      await writeFile(path, data);
      console.log(`${shot.name}: ${data.length} bytes (jpeg q=${quality})`);
      if (data.length > MAX_BYTES) throw new Error(shot.name + ' exceeds ' + MAX_BYTES + ' bytes');
    }
    if (consoleErrors.length) {
      console.log('CONSOLE ERRORS:\n' + consoleErrors.join('\n'));
    } else {
      console.log('no console errors');
    }
    cdp.ws.close();
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((err) => {
  console.error('capture failed:', err);
  process.exit(1);
});
