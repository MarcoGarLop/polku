// Drives the Polku guided tour in headless Edge (GPU) and captures high-quality frames via the DevTools screencast.
// Writes frames/NNNNN.jpg + frames.json (timestamps) + timeline.json (when each scene started).
// Run: node record.mjs   (needs the web app on :5173 and the API on :8787)
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { SCENES } from './script.mjs';

const W = 1920;
const H = 1080;
const voiceLen = (id) => {
  try {
    return JSON.parse(readFileSync(`voice/${id}.json`, 'utf8')).character_end_times_seconds.at(-1);
  } catch {
    return 0;
  }
};

rmSync('frames', { recursive: true, force: true });
mkdirSync('frames', { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: false,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', `--window-size=${W},${H}`],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  window.__pulse = (x, y) => {
    const d = document.createElement('div');
    d.className = 'vpulse';
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  };
});

/* ---- screencast ---- */
const cdp = await page.context().newCDPSession(page);
const frames = [];
let n = 0;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `frames/${String(n++).padStart(5, '0')}.jpg`;
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

await page.goto('http://localhost:5173/?video', { waitUntil: 'domcontentloaded' });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
const T0 = Date.now() / 1000;

/* ---- helpers ---- */
const timeline = [];
const sleepUntil = async (abs) => {
  const ms = abs * 1000 - Date.now();
  if (ms > 0) await page.waitForTimeout(ms);
};
const click = async (loc) => {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox();
  if (box) await page.evaluate(([x, y]) => window.__pulse(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
  await page.waitForTimeout(220);
  await loc.click();
};
const next = () => click(page.getByRole('button', { name: /^Next:/ }));
const text = (t) => page.getByText(t, { exact: false }).first();

/* what happens in each scene: [fraction of the voice, action] */
const ACTIONS = {
  s2: [[0, () => click(text('Start the guided tour'))]],
  s3: [[0, next]],
  s4: [[0, next]],
  s5: [
    [0, next],
    [0.3, () => click(text('The fast lane of work health care'))],
    [0.7, () => click(text('Someone helps them through the system'))],
  ],
  s6: [
    [0, next],
    [0.1, () => click(text('Why the AI expects this effect'))],
    [0.58, () => click(text('Switch on all three'))],
  ],
  s7: [
    [0, next],
    [0.28, () => click(page.getByRole('button', { name: /Add to .* plan/ }))],
    [0.5, () => click(text('A mobile CT unit that visits northern Lapland'))],
    [0.62, () => page.locator('.design-result').scrollIntoViewIfNeeded().catch(() => {})],
  ],
  s8: [[0, next]],
  s9: [[0, () => page.evaluate(() => window.__polku.getState().set({ clean: true, selectedRegion: null, metric: 'days' }))]],
};

let cursor = T0;
for (const s of SCENES) {
  const v = voiceLen(s.id);
  const start = cursor;
  const voiceAt = start + s.pre;
  timeline.push({ id: s.id, start: start - T0, voiceAt: voiceAt - T0, voice: v });
  for (const [frac, fn] of ACTIONS[s.id] ?? []) {
    await sleepUntil(frac === 0 ? start : voiceAt + frac * v);
    try {
      await fn();
    } catch (e) {
      console.warn(`! ${s.id} action failed: ${String(e.message).split('\n')[0]}`);
    }
  }
  cursor = start + s.pre + v + s.post;
  await sleepUntil(cursor);
  console.log(`✓ ${s.id} ${(start - T0).toFixed(1)}s → ${(cursor - T0).toFixed(1)}s`);
}

await cdp.send('Page.stopScreencast');
await page.waitForTimeout(300);
writeFileSync('frames.json', JSON.stringify({ T0, end: cursor - T0, frames }));
writeFileSync('timeline.json', JSON.stringify(timeline, null, 2));
console.log(`frames: ${frames.length} · ${(frames.length / (cursor - T0)).toFixed(1)} fps captured · length ${(cursor - T0).toFixed(1)} s`);
await browser.close();
