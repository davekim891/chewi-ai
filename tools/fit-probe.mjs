// Headless-Chrome probe for the hero fit (js/fit.js + js/holo.js).
// Drives its OWN Chrome over the DevTools protocol — never the user's browser — and reports,
// per window size: the engine's fitRadius, the opening-pose bbox, and the worst margin over
// 36 azimuths x {elMin, el0, elMax} via window.__chewiHero.fitCheck().
//
// Windows: node tools/fit-probe.mjs [baseUrl]
// Expects a static server already serving the repo (default http://localhost:8732/).
// Writes screenshots next to itself in the directory given by PROBE_OUT (default: os.tmpdir()/chewi-fit-probe).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = process.argv[2] || 'http://localhost:8732/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.PROBE_PORT || 9333);
const OUT = process.env.PROBE_OUT || join(tmpdir(), 'chewi-fit-probe');
const PROFILE = join(OUT, 'profile');

const SIZES = [[1512, 808], [1920, 1080], [1280, 720], [1024, 1366], [390, 844]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1512,808', 'about:blank',
], { stdio: 'ignore' });
console.log('chrome pid', chrome.pid, '| profile', PROFILE);

let ws = null, nextId = 1;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
}

async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      return v.webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('chrome devtools endpoint never came up');
}

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let h = null;
  for (let i = 0; i < 400; i++) {
    h = window.__chewiHero;
    if (h && h.status().ready) break;
    await sleep(100);
  }
  if (!h) return { error: 'no __chewiHero after 40 s' };
  const st = h.status();
  if (st.mode === 'fallback') return { mode: st.mode, error: st.error, dpr: window.devicePixelRatio };
  h.setTime(0);                                  // opening pose: az0, el0 exactly
  const f = h.fit();
  const { w, h: sh } = f.stage;
  const AZ0 = -2.5416, ELS = [0.08, 0.23, 0.62]; // cam.elMin, cam.el0, cam.elMax
  const open = h.fitCheck(AZ0, 0.23);
  let worst = Infinity, worstAt = null;
  for (let i = 0; i < 36; i++) {
    const az = (2 * Math.PI * i) / 36;
    for (const el of ELS) {
      const b = h.fitCheck(az, el);
      const m = Math.min(b.min[0] / w, b.min[1] / sh, 1 - b.max[0] / w, 1 - b.max[1] / sh);
      if (m < worst) { worst = m; worstAt = { az: +az.toFixed(4), el, radius: +b.radius.toFixed(4), bbox: [b.min[0], b.min[1], b.max[0], b.max[1]].map((v) => +v.toFixed(1)) }; }
    }
  }
  return {
    mode: st.mode, dpr: window.devicePixelRatio, win: [innerWidth, innerHeight],
    stage: f.stage, radius: f.radius, fitRadius: +f.fitRadius.toFixed(4),
    rLive: +f.rLive.toFixed(4), rNeed: +f.rNeed.toFixed(4), pose: f.pose, envelopeEls: f.envelopeEls,
    fitAt: { '1792/1008': +h.fitAt(1792 / 1008).toFixed(4), '1.2': +h.fitAt(1.2).toFixed(4), '1.0': +h.fitAt(1.0).toFixed(4), '0.6': +h.fitAt(0.6).toFixed(4) },
    openBbox: [open.min[0], open.min[1], open.max[0], open.max[1]].map((v) => +v.toFixed(1)),
    openFillW: +((open.max[0] - open.min[0]) / w).toFixed(4),
    openFillH: +((open.max[1] - open.min[1]) / sh).toFixed(4),
    worstMargin: +worst.toFixed(4), worstAt,
  };
})()`;

async function main() {
  ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  const results = {};
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }, sessionId);
    await send('Page.navigate', { url: `${BASE}?reduced=1` }, sessionId);
    await sleep(1500);
    const r = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true }, sessionId);
    results[tag] = r.result.value;
    console.log(tag, JSON.stringify(r.result.value));
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(OUT, `hero-${tag}.png`), Buffer.from(shot.data, 'base64'));
  }

  // One non-reduced pass at 1512x808 so the live (animated) path is exercised too.
  await send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 808, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: BASE }, sessionId);
  await sleep(4000);
  const live = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true }, sessionId);
  results.live = live.result.value;
  console.log('live(non-reduced)', JSON.stringify(live.result.value));
  const liveShot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(OUT, 'hero-live-1512x808.png'), Buffer.from(liveShot.data, 'base64'));

  writeFileSync(join(OUT, 'fit-probe.json'), JSON.stringify(results, null, 2));
  console.log('\nwrote', join(OUT, 'fit-probe.json'));
}

main().then(() => { try { ws.close(); } catch {} chrome.kill(); process.exit(0); },
  (e) => { console.error('probe failed:', e.message); try { ws && ws.close(); } catch {} chrome.kill(); process.exit(1); });
