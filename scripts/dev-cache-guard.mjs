// Runs before `npm run dev` (the "predev" script).
//
// Why: Turbopack keeps a persistent dev cache in .next/dev/cache/turbopack, and
// that cache stores absolute paths. When this project moved from
// ~/Desktop/Projects/disc-golf-arcade to ~/Developer/active/disc-golf-arcade,
// the cache kept pointing at the old folder, so the first HMR request panicked
// with "Next.js package not found" and the page reloaded forever. `next dev
// --webpack` worked only because webpack doesn't read that cache.
//
// Fix: remember which folder built the cache, and throw the dev cache away when
// the project is run from somewhere else. Only .next/dev is touched; it is
// regenerated on the next start.
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const devDir = path.join(root, ".next", "dev");
const marker = path.join(root, ".next", "dev-cache-root.txt");

const recorded = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
if (existsSync(devDir) && recorded !== root) {
  console.log(`[dev-cache-guard] .next/dev was built ${recorded ? `in ${recorded}` : "from an unknown folder"}; clearing it.`);
  rmSync(devDir, { recursive: true, force: true });
}
mkdirSync(path.dirname(marker), { recursive: true });
writeFileSync(marker, root + "\n");
