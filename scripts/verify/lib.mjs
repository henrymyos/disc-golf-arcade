// Dev-only helpers for verify.mjs. Never imported by the app.
import puppeteer from "puppeteer-core";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const PORT = 4990; // throwaway port; never 4747
export const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Shell env beats .env.local, so the dev server (and the browser bundle) talk to a
// dead local Supabase instead of the live project. Same trick as the README.
const DEAD_SUPABASE = "http://127.0.0.1:9";
export const SAFE_ENV = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: DEAD_SUPABASE,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "dead",
  SUPABASE_SERVICE_ROLE_KEY: "dead",
  NEXT_TELEMETRY_DISABLED: "1",
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
export const OUT = path.join("/private/tmp/dga-verify", stamp);
fs.mkdirSync(OUT, { recursive: true });
const logFile = fs.createWriteStream(path.join(OUT, "verify.log"));
// Each width runs in its own lane (in parallel); its lines are buffered and printed in order at the end.
export const lane = new AsyncLocalStorage();
export function log(s = "") {
  const l = lane.getStore();
  if (l) l.lines.push(s); else { console.log(s); logFile.write(s + "\n"); }
}

// ── checks ─────────────────────────────────────────────────────────────
let passes = 0, failures = 0;
export function check(ok, msg) {
  if (ok) passes++; else { failures++; if (lane.getStore()) lane.getStore().fails++; }
  log(`  ${ok ? "PASS" : "FAIL"} ${msg}`);
  return ok;
}
export const laneFails = () => lane.getStore()?.fails ?? failures;
export function summary(seconds) {
  log(`\n${passes} passed, ${failures} failed in ${seconds.toFixed(0)} s`);
  log(`Screenshots + log: ${OUT}`);
  logFile.end();
  return failures;
}

// ── shell steps for --full ─────────────────────────────────────────────
export function step(name, cmd, args) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env: SAFE_ENV, encoding: "utf8", maxBuffer: 64 << 20 });
  const out = (r.stdout || "") + (r.stderr || "");
  fs.writeFileSync(path.join(OUT, `${name}.out`), out);
  const ok = r.status === 0;
  check(ok, `${name} (${((Date.now() - t) / 1000).toFixed(0)} s)${ok ? "" : "\n" + out.trim().split("\n").slice(-15).map(l => "       " + l).join("\n")}`);
  return ok;
}

// ── dev server ─────────────────────────────────────────────────────────
function portBusy() {
  const r = spawnSync("/usr/sbin/lsof", ["-ti", `tcp:${PORT}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  return r.stdout.trim() !== "";
}
let server = null;
export async function startServer() {
  if (portBusy()) throw new Error(`port ${PORT} is already in use; stop that process first (lsof -i :${PORT})`);
  spawnSync("node", ["scripts/dev-cache-guard.mjs"], { cwd: ROOT, stdio: "ignore" });
  const out = fs.openSync(path.join(OUT, "next-dev.out"), "w");
  // detached = its own process group, so stopServer() takes next's workers down too.
  server = spawn(path.join(ROOT, "node_modules", ".bin", "next"), ["dev", "-p", String(PORT), "-H", "127.0.0.1"],
    { cwd: ROOT, env: SAFE_ENV, detached: true, stdio: ["ignore", out, out] });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`next dev exited (${server.exitCode}); see ${OUT}/next-dev.out`);
    try { if ((await fetch(BASE + "/")).status === 200) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`next dev did not answer 200 on / within 90 s; see ${OUT}/next-dev.out`);
}
export function stopServer() {
  if (!server || server.exitCode != null) return;
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ }
  const until = Date.now() + 5000;
  while (portBusy() && Date.now() < until) spawnSync("sleep", ["0.2"]);
  if (portBusy()) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* gone */ } }
}

// ── browser ────────────────────────────────────────────────────────────
let browser = null, profile = null;
export async function launch() {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "dga-verify-profile-"));
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ["--mute-audio"] });
  return browser;
}
export async function closeBrowser() {
  try { await browser?.close(); } catch { /* ignore */ }
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
}

const LOCAL = /^(https?|wss?):\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//;
const SUPABASE = /supabase\.(co|in)\b|^https?:\/\/127\.0\.0\.1:9\//;
export const aborted = new Map(); // host -> count, across the whole run
export const supabaseWrites = []; // "METHOD url" of any write aimed at Supabase

// A fresh incognito-style context per group: clean localStorage, dark mode, the
// network locked to this machine, and an optional stubbed gamepad.
export async function open(urlPath, { width, height, pad = false }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: false });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).split("\n")[0]));
  // Blocked requests log "Failed to load resource"; local HTTP errors are caught below instead.
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().split("\n")[0]); });
  page.on("response", r => { if (r.status() >= 400 && LOCAL.test(r.url()) && !SUPABASE.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.setRequestInterception(true);
  page.on("request", r => {
    const url = r.url();
    if (SUPABASE.test(url) && !["GET", "HEAD", "OPTIONS"].includes(r.method())) supabaseWrites.push(`${r.method()} ${url}`);
    if (url.startsWith("data:") || url.startsWith("blob:") || (LOCAL.test(url) && !SUPABASE.test(url))) return r.continue();
    let host = url; try { host = new URL(url).host; } catch { /* keep raw */ }
    aborted.set(host, (aborted.get(host) || 0) + 1);
    r.abort();
  });
  // Headless Chrome paces requestAnimationFrame off the Mac's display: lid closed (night
  // sweeps) = ~13 fps and a round takes 5+ min. Timers stay at full speed, so drive rAF
  // from a 16 ms timer: same frame-stepped game, ~60 fps, lid open or shut.
  // shortcut: real vsync pacing isn't exercised; drop this if headless rAF stops depending on a display.
  await page.evaluateOnNewDocument(() => {
    window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = id => clearTimeout(id);
  });
  if (pad) {
    await page.evaluateOnNewDocument(() => {
      const pad = { id: "verify-pad", index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      navigator.getGamepads = () => [pad];
      window.__pad = (i, down) => { pad.buttons[i] = { pressed: down, touched: down, value: down ? 1 : 0 }; };
    });
  }
  await page.goto(BASE + urlPath, { waitUntil: "load", timeout: 120_000 });
  page.errors = errors;
  page.ctx = ctx;
  return page;
}

// Click the last button whose text matches (the innermost/topmost one).
export function clickText(page, src) {
  return page.evaluate(s => {
    const b = [...document.querySelectorAll("button")].reverse().find(e => new RegExp(s).test(e.textContent.replace(/\s+/g, " ").trim()));
    b?.click();
    return !!b;
  }, src);
}
export const waitText = (page, src, timeout = 20_000) =>
  page.waitForFunction(s => [...document.querySelectorAll("button,h1,h2,h3,p")].some(e => new RegExp(s).test(e.textContent.replace(/\s+/g, " ").trim())), { timeout, polling: 100 }, src);
