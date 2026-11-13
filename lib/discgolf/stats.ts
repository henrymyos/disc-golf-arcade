// Real disc golf stats for a round, derived from the recorded flight paths (one
// path per throw, per hole) plus each hole's basket and score:
//   C1X putting: throws from 10–33 ft (outside the 10 ft tap-in), made / tried
//   C2 putting:  throws from 33–66 ft, made / tried
//   Parked:      throws from outside 33 ft that leave a tap-in (≤ 10 ft)
//   Penalties:   OB + hazard strokes (a hole's score minus its throws)
// Each hole ends by holing out, so a hole's last path is the make and every
// earlier path is a miss.
import { distBetween, pxToFeet, type Vec } from "./engine";

export type RoundStats = { c1x: [number, number]; c2: [number, number]; parked: number; penalties: number };

export const C1_FT = 33;
export const C2_FT = 66;
export const TAP_IN_FT = 10;

export const emptyStats = (): RoundStats => ({ c1x: [0, 0], c2: [0, 0], parked: 0, penalties: 0 });

export function roundStats(paths: Vec[][][], holes: { basket: Vec }[], scores: number[]): RoundStats {
  const s = emptyStats();
  holes.forEach((hole, i) => {
    const shots = (paths[i] ?? []).filter((p) => p.length > 0);
    // A resumed round has no paths for the holes before the resume: skip them.
    if (!shots.length || typeof scores[i] !== "number") return;
    const ft = (p: Vec) => pxToFeet(distBetween(p, hole.basket));
    shots.forEach((path, k) => {
      const made = k === shots.length - 1;
      const from = ft(path[0]);
      if (from > TAP_IN_FT && from <= C1_FT) { s.c1x[1]++; if (made) s.c1x[0]++; }
      else if (from > C1_FT && from <= C2_FT) { s.c2[1]++; if (made) s.c2[0]++; }
      if (!made && from > C1_FT && ft(shots[k + 1][0]) <= TAP_IN_FT) s.parked++;
    });
    s.penalties += Math.max(0, scores[i] - shots.length);
  });
  return s;
}

// Career totals across history rows. Rows come from local storage and the cloud
// save, so anything malformed (or an old row with no stats) is skipped.
export function totalStats(rows: { stats?: unknown }[]): { stats: RoundStats; rounds: number } {
  const t = emptyStats();
  let rounds = 0;
  const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isFinite(n) && n >= 0);
  for (const r of rows) {
    const st = r?.stats as Partial<RoundStats> | undefined;
    if (!st || !pair(st.c1x) || !pair(st.c2) || !Number.isFinite(st.parked) || !Number.isFinite(st.penalties)) continue;
    t.c1x[0] += st.c1x[0]; t.c1x[1] += st.c1x[1];
    t.c2[0] += st.c2[0]; t.c2[1] += st.c2[1];
    t.parked += st.parked!; t.penalties += st.penalties!;
    rounds++;
  }
  return { stats: t, rounds };
}

// "7/9 · 78%", or "–" with no attempts.
export const pctLabel = ([made, tried]: [number, number]) => (tried ? `${made}/${tried} · ${Math.round((made / tried) * 100)}%` : "–");

// Rounds on courses whose par changes per round (Daily, tour, ranked): compare
// to par, not strokes. Rows without per-hole pars (very old saves) are skipped.
export function toParSummary(rows: { scores?: number[]; pars?: number[] }[]): { rounds: number; best: number | null; avg: number | null } {
  const overs = rows.flatMap((r) =>
    Array.isArray(r.scores) && Array.isArray(r.pars) && r.scores.length && r.scores.length === r.pars.length
      ? [r.scores.reduce((s, x) => s + x, 0) - r.pars.reduce((s, x) => s + x, 0)]
      : [],
  );
  if (!overs.length) return { rounds: 0, best: null, avg: null };
  return { rounds: overs.length, best: Math.min(...overs), avg: overs.reduce((s, x) => s + x, 0) / overs.length };
}

export const toParLabel = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
