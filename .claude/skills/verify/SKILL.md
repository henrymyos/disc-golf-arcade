---
name: verify
description: Smoke-test Disc Golf Arcade in a real headless browser before committing or merging. Boots next dev on :4990, plays a full round via window.__dga at 390 and 1440 px, checks keyboard, pause, Daily and Pro Tour, prints PASS/FAIL. Use after every change and before every merge to main.
---

# verify

Run from the repo root (a worktree is fine):

- `npm run verify`: smoke run, about 1.5 min. After each change.
- `npm run verify -- --full`: tsc, eslint, vitest and `next build --webpack` first, then the smoke run. Before every merge to main.
- `node scripts/verify/verify.mjs round pause`: only some groups (boot, round, keyboard, pause, modes, offline-safe).

It installs `scripts/verify/node_modules` (puppeteer-core, dev-only, git-ignored) on first use, uses system Chrome headless with a throwaway profile, dark mode, and never touches Henry's browser window. Every request that would leave this Mac is aborted and logged, and Supabase is pointed at a dead local address, so a run can never write to the live leaderboard. The dev server is killed on exit, on failure and on Ctrl-C.

## Reading the result

- Each line is `PASS` or `FAIL <what> (<detail>)`, grouped as `[390] round`, `[1440] pause` and so on, with seconds per group.
- Exit code = number of failures. The last line prints the folder (`/private/tmp/dga-verify/<timestamp>/`) with a screenshot per group (`<width>-<group>-FAIL.png` when it failed), `verify.log`, `next-dev.out` and, with `--full`, `tsc.out`/`eslint.out`/`vitest.out`/`build.out`.
- Look at the FAIL screenshot before changing code: a modal over the board or a wrong screen usually explains it.
- "port 4990 is already in use": a dev server from an earlier run is still up; `lsof -i :4990`, stop it, rerun.

## Rules

- Never skip, retry or add a sleep to a flaky check. Fix it (wait on a condition with `waitForFunction`), or delete it and say why in your report.
- Three rounds of fix + verify that still fail: stop and hand off. Report the failing lines, the screenshot path and what you tried.
- Report what verify covered and what it didn't (sign-in, online lobbies, leaderboards and anything that needs the network are not covered).
- New player-facing flow? Add a check to `scripts/verify/verify.mjs` in the same change.
