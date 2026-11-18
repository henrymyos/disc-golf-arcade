// Dev-only smoke test: boots `next dev` on :4990, drives the real game headlessly at
// 390 and 1440 px through the dev-only window.__dga hooks, prints PASS/FAIL per check.
//   node scripts/verify/verify.mjs [--full] [group …]     (npm run verify [-- --full])
// --full runs tsc, eslint, vitest and `next build --webpack` first. Exit code = failures.
import path from "node:path";
import { BASE, OUT, log, closeLog, check, laneFails, lane, summary, step, startServer, stopServer, launch, closeBrowser, open, clickText, waitText, aborted, supabaseWrites } from "./lib.mjs";

const SIZES = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const CHALLENGE = "/?ch=course.1.60.Tester";
const T = 30_000; // per-wait ceiling; every wait is condition-based

// ── in-page helpers ─────────────────────────────────────────────────────
// Resolves with "done" | "card" | "aim" as soon as the game reaches one of them.
const nextState = (p, timeout = T) => p.waitForFunction(() => {
  const d = window.__dga;
  if (!d?.screen) return null;
  const s = d.screen();
  if (s === "gameComplete") return "done";
  if (s === "holeComplete") return "card";
  return s === "playing" && d.lie()?.phase === "aim" ? "aim" : null;
}, { timeout, polling: 50 }).then(h => h.jsonValue());
const lie = p => p.evaluate(() => window.__dga.lie());
const dialogOpen = (p, title) => p.evaluate(t => [...document.querySelectorAll('[role="dialog"]')].some(d => d.textContent.includes(t)), title);
const waitDialog = (p, title, open) => p.waitForFunction((t, o) =>
  [...document.querySelectorAll('[role="dialog"]')].some(d => d.textContent.includes(t)) === o, { timeout: 5000, polling: 50 }, title, open);

async function startChallenge(p) {
  await waitText(p, "challenged you");
  await clickText(p, "challenged you");
  return nextState(p);
}
// Plan + throw the current shot; resolves once the disc has left the aim phase.
async function planAndThrow(p) {
  return p.evaluate(() => {
    const d = window.__dga, before = d.lie();
    const shot = d.plan();
    const ok = shot && d.throw(shot.angle, shot.power);
    const after = d.lie();
    return { ok: !!ok, hole: before.hole, flew: after.phase !== "aim" || after.disc.x !== before.disc.x || after.disc.y !== before.disc.y };
  });
}
// After the first throw: true once the disc rests somewhere new (or the hole is over).
const discMoved = (p, from) => p.waitForFunction(f => {
  const d = window.__dga, l = d.lie(), s = d.screen();
  return s !== "playing" || (l.phase !== "fly" && (l.disc.x !== f.x || l.disc.y !== f.y));
}, { timeout: T, polling: 50 }, from).then(() => true, () => false);

// ── groups: each gets a fresh context at one size ───────────────────────
const groups = {};

groups.boot = async size => {
  const p = await open("/", size);
  const menu = await waitText(p, "^Single Player$").then(() => true, () => false);
  check(menu, "home menu renders (Single Player button)");
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(ov.sw <= ov.iw, `no horizontal overflow (scrollWidth ${ov.sw} <= ${ov.iw})`);
  // Front door (Nova 2026-11-18): one Daily card, Pro Tour on home, distinct names, utilities above the fold.
  const home = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].map(b => ({ t: b.textContent.replace(/\s+/g, " ").trim(), r: b.getBoundingClientRect() }));
    const find = re => btns.find(b => re.test(b.t));
    const utils = ["^Bag$", "^Shop$", "^Goals", "^Leaderboards$"].map(s => find(new RegExp(s)));
    return {
      daily: btns.filter(b => /Daily/.test(b.t) && !/Daily reward/.test(b.t)).length,
      proTour: !!find(/^2026 Pro Tour/),
      weekly: !!find(/^Weekly Tour Stop[A-Z]/),
      oldNames: btns.filter(b => /^Challenges|Challenge the Arcade/.test(b.t)).map(b => b.t),
      utilsBottom: utils.every(Boolean) ? Math.max(...utils.map(u => u.r.bottom)) : null,
      vh: innerHeight,
    };
  });
  check(home.daily === 1, `one Daily entry on home (found ${home.daily})`);
  check(home.proTour, "2026 Pro Tour card on home");
  check(home.weekly, "Weekly Tour Stop card on home");
  check(home.oldNames.length === 0, `no "Challenges"/"Challenge the Arcade" buttons${home.oldNames.length ? ": " + home.oldNames.join(", ") : ""}`);
  if (await clickText(p, "^🎁 Daily reward$")) // the reward claim moved into the Daily card
    check(await waitText(p, "^Daily reward · ", 5000).then(() => true, () => false), "Daily reward claim opens the reward popup");
  else check(false, "Daily reward button on the Daily card");
  await p.reload(); await waitText(p, "^Single Player$").catch(() => {}); // screenshot the home, not the popup
  check(home.utilsBottom != null && home.utilsBottom <= home.vh, `Bag/Shop/Goals/Leaderboards above the fold (bottom ${home.utilsBottom == null ? "missing" : Math.round(home.utilsBottom)} <= ${home.vh})`);
  check(p.errors.length === 0, `0 console errors${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
  return p;
};

groups.round = async size => {
  const p = await open(CHALLENGE, size);
  let state = await startChallenge(p);
  const holes = new Set();
  let throws = 0, stuck = null;
  for (let i = 0; i < 300 && state !== "done"; i++) {
    if (state === "card") await p.keyboard.press("Space"); // hole card -> next hole
    else {
      const r = await planAndThrow(p);
      if (!r.ok || !r.flew) { stuck = `hole ${r.hole + 1}: __dga.throw ${r.ok ? "returned true but the disc never left the aim phase" : "was refused"}`; break; }
      holes.add(r.hole); throws++;
      await p.keyboard.press("Space"); // fast-forward the flight
    }
    state = await nextState(p).catch(() => "timeout");
    if (state === "timeout") { stuck = `no aim/hole card/results within ${T / 1000} s after throw ${throws}`; break; }
  }
  if (!check(!stuck && state === "done", `round reaches the results screen${stuck ? ` (stuck: ${stuck})` : ""}`)) return p;
  const res = await p.evaluate(() => {
    const t = document.body.innerText;
    return { title: /Round complete!/.test(t), holes: Number(/· (\d+) holes ·/i.exec(t)?.[1]), total: Number(/(\d+) throws ·/.exec(t)?.[1]) };
  });
  check(res.title, "results say \"Round complete!\"");
  check(res.holes === holes.size, `hole count matches the course (results ${res.holes}, played ${holes.size})`);
  check(Number.isFinite(res.total) && res.total >= throws && res.total < 6 * res.holes, `total strokes ${res.total} finite, >= ${throws} throws, < ${6 * res.holes}`);
  // A first round can queue several level-ups (pick a disc each); then the leaderboard
  // name prompt shows. Press Skip, which posts nothing.
  let skip = false;
  for (let i = 0; i < 10 && !skip; i++) {
    const up = await p.waitForFunction(() => {
      if ([...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Skip")) return "skip";
      const h = [...document.querySelectorAll("p,h2,h3")].find(e => /Pick a new disc/.test(e.textContent));
      let box = h; while (box && !box.querySelector("button")) box = box.parentElement;
      if (!box) return null;
      box.querySelector("button").click();
      return "level";
    }, { timeout: 10_000, polling: 100 }).then(h => h.jsonValue(), () => "none");
    if (up === "none") break;
    skip = up === "skip";
  }
  if (check(skip, "leaderboard name prompt offers Skip")) {
    await clickText(p, "^Skip$");
    check(await p.waitForFunction(() => /Not posted \(you chose Skip\)/.test(document.body.innerText), { timeout: 5000, polling: 50 }).then(() => true, () => false),
      "Skip -> \"Not posted (you chose Skip)\"");
  }
  // Share-first results: the share action sits above the fold, achievements fold into one line.
  const res2 = await p.evaluate(() => {
    const share = [...document.querySelectorAll("button")].find(b => /^⚔ Send it back to Tester$|^Share$/.test(b.textContent.replace(/\s+/g, " ").trim()));
    let box = share; while (box && getComputedStyle(box).overflowY !== "auto") box = box.parentElement;
    if (box) box.scrollTop = 0;
    const ach = document.querySelector("details summary");
    return { bottom: share ? share.getBoundingClientRect().bottom : null, vh: innerHeight, ach: ach ? { open: ach.parentElement.open, t: ach.textContent.trim(), h: ach.getBoundingClientRect().height } : null };
  });
  check(res2.bottom != null && res2.bottom <= res2.vh, `results Share above the fold (bottom ${res2.bottom == null ? "missing" : Math.round(res2.bottom)} <= ${res2.vh})`);
  check(res2.ach && !res2.ach.open && /^🏅 \d+ achievements? unlocked/.test(res2.ach.t) && res2.ach.h >= 44, `achievements collapsed into one 44 px line${res2.ach ? ` ("${res2.ach.t.slice(0, 40)}", ${Math.round(res2.ach.h)} px)` : " (missing)"}`);
  if (res2.ach) {
    const tap = () => p.evaluate(() => { document.querySelector("details summary").click(); return document.querySelector("details").open; });
    const opened = await tap(), closed = !(await tap()); // leave it folded for the screenshot
    check(opened && closed, "tapping the achievements line expands it, tapping again folds it");
  }
  check(p.errors.length === 0, `0 console errors over the round${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
  return p;
};

groups.keyboard = async size => {
  const p = await open(CHALLENGE, size);
  await startChallenge(p);
  const a = await lie(p);
  await p.keyboard.press("ArrowUp"); await p.keyboard.press("Space");
  const flew = await p.evaluate(() => window.__dga.lie().phase !== "aim");
  check(flew, "ArrowUp + Space throws");
  const st = flew ? await nextState(p).catch(() => "timeout") : "aim";
  const b = st === "aim" ? await lie(p) : null;
  check(st === "card" || (b && b.feet < a.feet), `the throw gets closer to the pin (${a.feet} -> ${st === "card" ? "holed" : b?.feet} ft)`);
  if (st === "aim") {
    await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Escape"); await p.keyboard.press("Space");
    const c = await lie(p);
    check(c.phase === "aim" && c.disc.x === b.disc.x && c.disc.y === b.disc.y, "Arrow + Esc + Space = no throw");
  }
  check(p.errors.length === 0, `0 console errors${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
  return p;
};

groups.pause = async size => {
  const p = await open(CHALLENGE, { ...size, pad: true });
  await startChallenge(p);
  await p.keyboard.press("p");
  check(await waitDialog(p, "Paused", true).then(() => true, () => false), "P opens the Paused dialog");
  await p.keyboard.press("Escape");
  check(await waitDialog(p, "Paused", false).then(() => true, () => false), "Esc closes it");
  // Stubbed pad: Start (9) opens, B (1) closes. The game polls the pad every frame.
  const tap = async btn => {
    await p.evaluate(b => window.__pad(b, true), btn);
    await p.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    await p.evaluate(b => window.__pad(b, false), btn);
  };
  await tap(9);
  check(await waitDialog(p, "Paused", true).then(() => true, () => false), "pad Start opens the Paused dialog");
  await tap(1);
  check(await waitDialog(p, "Paused", false).then(() => true, () => false), "pad B closes it");
  check(!(await dialogOpen(p, "Paused")) && (await lie(p)).phase === "aim", "back in the round, still aiming");
  check(p.errors.length === 0, `0 console errors${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
  return p;
};

groups.modes = async size => {
  const shots = [];
  let dailyFailed = false;
  for (const [name, route] of [["Daily", ["^▶ Play today's Daily"]], ["Pro Tour", ["^2026 Pro Tour", "STOP", "^Play 18$"]], ["Weekly Tour Stop", ["^Weekly Tour Stop[A-Z]"]]]) {
    const p = await open("/", size), before = laneFails();
    await waitText(p, "^Single Player$").catch(() => {});
    let ok = true; // both start from the home screen
    for (const s of route) {
      if (!ok) break;
      if (s === "STOP") ok = await p.waitForSelector("button[data-stop]", { timeout: 15_000 }).then(b => b.click()).then(() => true, () => false);
      else ok = await waitText(p, s, 15_000).then(() => clickText(p, s), () => false);
    }
    const st = ok ? await nextState(p).catch(() => "timeout") : "menu";
    if (check(st === "aim", `${name} loads to the first tee${st === "aim" ? "" : ` (got ${st})`}`)) {
      const from = (await lie(p)).disc;
      const r = await planAndThrow(p);
      check(r.ok && r.flew && (await discMoved(p, from)), `${name}: first __dga.throw moves the disc`);
    }
    check(p.errors.length === 0, `${name}: 0 console errors${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
    if (name === "Daily") dailyFailed = laneFails() > before;
    shots.push(p);
  }
  await shots[0].screenshot({ path: path.join(OUT, `${size.width}-modes-daily${dailyFailed ? "-FAIL" : ""}.png`) }).catch(() => {});
  await shots[0].ctx.close().catch(() => {});
  return shots[1];
};

// Weekly Tour Stop: the home card plays this week's course; its results show the
// weekly board (top 10 + time left); Leaderboards opens on it. Supabase is dead
// here, so the board is empty and nothing posts (Skip at the name prompt).
groups.weekly = async size => {
  const p = await open("/", size);
  const ok = await waitText(p, "^Weekly Tour Stop[A-Z]").then(() => clickText(p, "^Weekly Tour Stop[A-Z]"), () => false);
  const st = ok ? await nextState(p).catch(() => "timeout") : "menu";
  if (!check(st === "aim", `weekly card loads to the first tee${st === "aim" ? "" : ` (got ${st})`}`)) return p;
  await p.evaluate(() => window.__dga.finish(-1));
  check(await waitText(p, "^🏆 Weekly Tour Stop · .+Top 10 · \\d+[dhm]", 10_000).then(() => true, () => false), "results show the weekly board with time left");
  for (let i = 0; i < 10; i++) { // level-up picks, then the name prompt: Skip posts nothing
    const r = await p.evaluate(() => {
      if ([...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Skip")) return "skip";
      const h = [...document.querySelectorAll("p,h2,h3")].find(e => /Pick a new disc/.test(e.textContent));
      let box = h; while (box && !box.querySelector("button")) box = box.parentElement;
      box?.querySelector("button").click();
      return box ? "level" : "none";
    });
    if (r === "skip") { await clickText(p, "^Skip$"); break; }
    if (r === "none") await new Promise(r => setTimeout(r, 150));
  }
  check(await waitText(p, "^Share$", 5000).then(() => true, () => false), "weekly results offer Share");
  await p.screenshot({ path: path.join(OUT, `${size.width}-weekly-results.png`) }).catch(() => {});
  await p.goto(`${BASE}/`); await waitText(p, "^Leaderboards$").then(() => clickText(p, "^Leaderboards$"), () => {});
  check(await waitText(p, "^This week · top 10 · \\d+[dhm]", 10_000).then(() => true, () => false), "Leaderboards opens on the weekly board with time left");
  check(p.errors.length === 0, `0 console errors${p.errors.length ? ": " + p.errors.slice(0, 3).join(" | ") : ""}`);
  return p;
};

// ── main ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const full = argv.includes("--full");
const unknown = argv.filter(a => a !== "--full" && !groups[a] && a !== "offline-safe");
if (unknown.length) { console.error(`Unknown group(s): ${unknown.join(", ")}. Groups: ${Object.keys(groups).join(", ")}, offline-safe`); process.exit(64); }
const picked = argv.filter(a => groups[a]);
const run = picked.length ? picked : Object.keys(groups);
const t0 = Date.now();
let interrupted = false;
const halt = () => new Promise(() => {}); // after Ctrl-C, bail() alone writes the log and exits
const stores = SIZES.map(() => ({ lines: [], fails: 0 })); // per-width lines, buffered until the end
const bail = async sig => {
  if (interrupted) return;
  interrupted = true;
  for (const l of stores) l.lines.splice(0).forEach(s => log(s)); // keep what the lanes got through
  log(`\n${sig}: stopping the dev server and Chrome`);
  stopServer();
  await closeBrowser();
  log(`${sig}: stopped (partial run). Screenshots + log: ${OUT}`);
  closeLog();
  process.exit(130);
};
process.on("SIGINT", () => bail("SIGINT"));
process.on("SIGTERM", () => bail("SIGTERM"));

try {
  if (full) {
    log("[full] static checks");
    step("tsc", "npx", ["tsc", "--noEmit"]);
    step("eslint", "npx", ["eslint"]);
    step("vitest", "npx", ["vitest", "run"]);
    step("build", "npx", ["next", "build", "--webpack"]);
  }
  log(`\n[server] next dev on :4990`);
  const ts = Date.now();
  await startServer();
  log(`  up in ${((Date.now() - ts) / 1000).toFixed(0)} s`);
  await launch();
  const lanes = await Promise.all(SIZES.map((size, i) => lane.run(stores[i], async () => {
    for (const g of run) {
      log(`\n[${size.width}] ${g}`);
      const before = laneFails(), tg = Date.now();
      let p = null;
      try { p = await groups[g](size); } catch (e) { check(false, `${g} threw: ${String(e.message || e).split("\n")[0]}`); }
      if (p) {
        const file = `${size.width}-${g}${laneFails() > before ? "-FAIL" : ""}.png`;
        await p.screenshot({ path: path.join(OUT, file) }).catch(() => {});
        await p.ctx.close().catch(() => {});
      }
      log(`  (${((Date.now() - tg) / 1000).toFixed(0)} s)`);
    }
    return lane.getStore();
  })));
  if (interrupted) await halt();
  for (const l of lanes) l.lines.forEach(s => log(s));
  if (!picked.length || argv.includes("offline-safe")) {
    log("\n[all] offline-safe");
    log("  (browser requests only; the Next server and build may still GET Google Fonts)");
    log(`  blocked hosts: ${aborted.size ? [...aborted].map(([h, n]) => `${h} x${n}`).join(", ") : "none"}`);
    check(supabaseWrites.length === 0, `no POST/PATCH aimed at Supabase${supabaseWrites.length ? ": " + supabaseWrites.slice(0, 3).join(" | ") : ""}`);
  }
} catch (e) {
  if (interrupted) await halt();
  check(false, `verify crashed: ${String(e.message || e).split("\n")[0]}`);
} finally {
  if (interrupted) await halt();
  await closeBrowser();
  stopServer();
}
if (!interrupted) process.exit(Math.min(summary((Date.now() - t0) / 1000), 125));
