// Dev-only: record the README clip (docs/hole.webp) of one hole being played.
//
// It opens a LOCAL dev server, starts Hole Practice on a Glendoveer East hole
// (default hole 2, a par 3; practice never posts scores), and lets a simple bot
// aim each throw at the basket using the dev-only window.__dga probe,
// screenshotting the board as it goes. It keeps the best of a few attempts
// (fewest throws). Frames are stitched with img2webp (libwebp: `brew install webp`).
//
// Not a project dependency: point PUPPETEER_CORE at any puppeteer-core install.
//
//   # terminal 1 — keep Supabase pointed at a dead address so nothing reaches prod
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=dead \
//     SUPABASE_SERVICE_ROLE_KEY=dead npm run dev
//   # terminal 2
//   PUPPETEER_CORE=/path/to/node_modules/puppeteer-core node scripts/capture-hole.mjs
//
// Options (env): URL (default http://localhost:3000/), CHROME_PATH, OUT (default
// docs/hole.webp), HOLE (default 2), ATTEMPTS (default 3).
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const URL_ = process.env.URL || "http://localhost:3000/";
const host = new URL(URL_).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  console.error(`Refusing to run against ${host}: this script is for a local dev server only.`);
  process.exit(1);
}
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_CORE || "puppeteer-core");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.OUT || "docs/hole.webp";
const FRAME_MS = 90;
const HOLE = Number(process.env.HOLE || 2);
const ATTEMPTS = Number(process.env.ATTEMPTS || 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--mute-audio"] });
let best = null; // { dir, throws }
try {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const dir = mkdtempSync(path.join(tmpdir(), "dga-frames-"));
    const throws = await playHole(dir);
    console.log(`attempt ${attempt}: ${throws} throws`);
    if (!best || throws < best.throws) { if (best) rmSync(best.dir, { recursive: true, force: true }); best = { dir, throws }; }
    else rmSync(dir, { recursive: true, force: true });
    if (best.throws <= 2) break; // a birdie on a par 3 is good enough
  }
} finally {
  await browser.close();
}

async function playHole(frames) {
  const page = await browser.newPage();
  // 320px wide = the board's native width, so the pixel art stays crisp.
  await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: false });
  await page.goto(URL_, { waitUntil: "networkidle2", timeout: 120_000 });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: "networkidle2" });
  const click = (re) => page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((e) => new RegExp(src).test(e.textContent.trim().replace(/\s+/g, " ")));
    b?.click();
    return !!b;
  }, re);
  for (const step of ["^Practice$", "^Hole Practice$", `^${HOLE}par`]) {
    if (!(await click(step))) throw new Error(`Couldn't find the "${step}" button`);
    await sleep(900);
  }
  const board = await page.evaluate(() => {
    const c = [...document.querySelectorAll("canvas")].filter((x) => !x.hasAttribute("data-attract")).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  let n = 0, throws = 0;
  const shoot = async () => { await page.screenshot({ path: path.join(frames, `f${String(n++).padStart(4, "0")}.png`), clip: board }); };
  const film = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { const t = Date.now(); await shoot(); await sleep(Math.max(0, FRAME_MS - (Date.now() - t))); } };

  await film(1500); // the fly-over intro
  for (let t = 0; t < 12; t++) {
    const lie = await page.evaluate(() => window.__dga?.lie?.());
    if (!lie) throw new Error("window.__dga is missing — is this a dev build?");
    if (lie.phase !== "aim") break;
    const k = board.width / lie.W;
    const dx = lie.basket.x - lie.disc.x, dy = lie.basket.y - lie.disc.y, d = Math.hypot(dx, dy) || 1;
    const power = Math.max(0.16, Math.min(1, lie.feet / 330 + 0.06));
    const len = power * lie.maxDrag * k;
    const sx = board.x + board.width / 2, sy = board.y + board.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(sx - (dx / d) * len * (i / 8), sy - (dy / d) * len * (i / 8)); await shoot(); await sleep(60); }
    await film(500); // hold the aim for a moment
    await page.mouse.up();
    throws++;
    // Film until the disc settles (or the hole is done).
    for (let w = 0; w < 60; w++) {
      await film(FRAME_MS);
      const now = await page.evaluate(() => window.__dga?.lie?.());
      if (!now || now.phase !== "fly") break;
    }
    await film(400);
  }
  await film(1500); // the celebration
  await page.close();
  return throws;
}

const frames = best.dir;
const files = readdirSync(frames).sort().map((f) => path.join(frames, f));
execFileSync("img2webp", ["-loop", "0", "-lossy", "-q", "70", "-d", String(FRAME_MS), ...files, "-o", OUT], { stdio: "inherit" });
rmSync(frames, { recursive: true, force: true });
console.log(`Wrote ${OUT} (${best.throws} throws, ${files.length} frames)`);
