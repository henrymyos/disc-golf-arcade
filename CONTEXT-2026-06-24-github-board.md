# Session handoff — GitHub Issues board setup (2026-06-24)

Point a fresh Claude Code session at this file to resume with full context.

## What this session did
Set up a Jira-style board for **disc-golf-arcade** using GitHub Issues + Projects (no Jira/Atlassian integration was available).

### Delivered & verified
- **Project board (#1):** https://github.com/users/henrymyos/projects/1 — title "Disc Golf Arcade", Status columns `Todo / In Progress / Done`. Repo is linked to it.
- **Auto-add:** ✅ working. The built-in "Auto-add to project" workflow is enabled with filter `is:issue is:open`. New issues land in Todo automatically (confirmed with a test issue #3, since closed).
- **Issue templates** (committed & pushed): `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `config.yml`. Available at https://github.com/henrymyos/disc-golf-arcade/issues/new/choose
- **Labels:** type (`bug`, `feature`, `polish`, `tech-debt`), priority (`P0`–`P3`), area (`area:gameplay`, `area:ui`, `area:auth`, `area:data`, `area:pwa`).
- **Open seed tickets in Todo:** #1 "[Tech-debt]: Add tests for scoring + disc flight logic", #2 "[Feature]: Example ticket — workflow walkthrough".

### Git fix along the way
Removed a corrupted stray ref `.git/refs/heads/main 2` (created by a file-sync tool) that was breaking `git pull`/`push`. Repo is clean now.

## The user's workflow (how to operate the board)
The user files bug/feature issues; Claude pulls a ticket and works it.
1. Read a ticket: `gh issue view <N> --repo henrymyos/disc-golf-arcade`
2. Implement it.
3. Move the board item Todo → In Progress → Done.

### IMPORTANT board gotcha
`gh project item-add` and other `gh project` item write commands **silently no-op** in this environment (exit 0, no effect). Use GraphQL instead:
- Project id: `PVT_kwHOBmWgLs4BbjmH`
- Status field id: `PVTSSF_lAHOBmWgLs4BbjmHzhWTT_k`
- Add item: `addProjectV2ItemById(input:{projectId, contentId})`
- Set status: `updateProjectV2ItemFieldValue(input:{projectId, itemId, fieldId, value:{singleSelectOptionId}})`
- Get a Status option id: query the project's `field(name:"Status")` options (Todo option was `f75ad846` — re-fetch to be safe).
- Reading the board works fine: `gh project item-list 1 --owner henrymyos --format json`

## Project facts
- Next.js 16.2.7 + React 19 + Supabase + Tailwind v4, PWA. Test runner: vitest (`npm test`).
- Game logic lives in `components/disc-golf-game.tsx` (one large component). No unit tests yet (that's ticket #1).
- **AGENTS.md says this Next.js has breaking changes vs training data — read `node_modules/next/dist/docs/` before writing Next.js code.**
- Auto-commit convention: after every change, commit + push to `main` (fast-forward) without being asked. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Suggested next step
Start ticket #1 (gameplay/scoring tests) or wait for the user to file the first real ticket.
