// What a shared replay looks like to whoever it's sent to: one summary used by
// the link preview (page metadata + /og image) and the landing card, so the
// unfurl and the page say the same specific thing ("Birdie on Hole 7 at
// Brighton Majestic, 3 under") instead of a generic "Disc Golf Arcade replay".
// Everything here is derived from a validated Replay, so only numbers and the
// already-clamped name/label reach the output.

import { buildRound, isProTourSeed, proTourCourseBySeed, tourVenue, W } from "./engine";
import { courseLabelFor, proTourStop } from "./challenge";
import type { Replay } from "./replay";

export type HoleResult = { hole: number; score: number; par: number; diff: number; label: string };

export type ReplayCard = {
  name: string;
  course: string;
  stop?: string;            // "Stop 14 · Ledgestone Open" for a real Pro Tour course
  total: number;
  par: number;
  toPar: string;            // "-3" | "E" | "+2" (ASCII so the OG font always has it)
  toParWords: string;       // "3 under" | "even par" | "2 over"
  holes: HoleResult[];
  highlight: HoleResult | null; // best hole (only when it beat par)
  under: number;            // holes under par
  headline: string;         // "Birdie on Hole 7" | "Bogey-free round" | "Round of 54"
  title: string;            // link-preview title
  description: string;      // link-preview description
  play?: { mode: Replay["mode"]; seed: number }; // a course the recipient can play as-is
};

export function holeLabel(score: number, par: number): string {
  if (score === 1) return "Ace";
  const d = score - par;
  return d <= -3 ? "Albatross" : d === -2 ? "Eagle" : d === -1 ? "Birdie" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double bogey" : `+${d}`;
}

const signed = (d: number) => (d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`);
const words = (d: number) => (d === 0 ? "even par" : d < 0 ? `${-d} under` : `${d} over`);

// firstHole numbers the card from a later hole (a one-hole practice round).
export function replayCard(r: Replay, firstHole = 1): ReplayCard {
  const holes: HoleResult[] = r.scores.map((score, i) => ({
    hole: i + firstHole, score, par: r.pars[i], diff: score - r.pars[i], label: holeLabel(score, r.pars[i]),
  }));
  const total = r.scores.reduce((a, b) => a + b, 0);
  const par = r.pars.reduce((a, b) => a + b, 0);
  const d = total - par;

  const pro = r.mode === "tour" ? proTourCourseBySeed(r.seed) : undefined;
  const venue = r.mode === "tour" ? tourVenue(r.seed)
    : r.mode === "ranked" ? "a Ranked course" : r.mode === "academy" ? "the Academy" : courseLabelFor(r.mode);
  const course = r.label ?? venue;
  const stop = pro ? proTourStop(r.seed) : undefined;

  // Best hole: an ace first, then the lowest score to par; earliest wins ties.
  let best: HoleResult | null = null;
  for (const h of holes) {
    const rank = (x: HoleResult) => (x.score === 1 ? -100 : x.diff);
    if (!best || rank(h) < rank(best)) best = h;
  }
  const highlight = best && (best.diff < 0 || best.score === 1) ? best : null;
  const under = holes.filter((h) => h.diff < 0).length;
  const headline = highlight ? `${highlight.label} on Hole ${highlight.hole}`
    : holes.every((h) => h.diff <= 0) ? "Bogey-free round" : `Round of ${total}`;

  const title = `${r.name}: ${headline} at ${course}, ${words(d)}`;
  const extras = [under > 1 ? `${under} holes under par` : "", stop ?? ""].filter(Boolean).join(" · ");
  // Fixed courses (and real Pro Tour courses at full length) can be played as-is.
  const fixed = r.mode === "course" || r.mode === "winthrop" || r.mode === "olympus" || (r.mode === "tour" && isProTourSeed(r.seed));
  const play = fixed && !r.scale ? { mode: r.mode, seed: r.seed } : undefined;
  const description = `Watch ${r.name}'s ${total} (${signed(d)}) shot by shot${extras ? ` · ${extras}` : ""}.${play ? " Then play the course yourself." : ""}`;

  return { name: r.name, course, stop, total, par, toPar: signed(d), toParWords: words(d), holes, highlight, under, headline, title, description, play };
}

// The hole to draw: the highlight if it has recorded throws, else the
// recorded hole with the best score to par, else none.
export function mapHoleIndex(r: Replay, card: ReplayCard): number | null {
  if (card.highlight && r.paths[card.highlight.hole - 1]?.some((p) => p.length > 1)) return card.highlight.hole - 1;
  let bi: number | null = null;
  r.paths.forEach((shots, i) => {
    if (!shots.some((p) => p.length > 1)) return;
    if (bi == null || card.holes[i].diff < card.holes[bi].diff) bi = i;
  });
  return bi;
}

const n1 = (v: number) => Math.round(v * 10) / 10;

// A small top-down map of one hole with the round's flight paths, as an SVG
// string (numbers only, no user text). Drawn in the hole's own world units.
export function replayHoleSvg(r: Replay, holeIdx: number): string | null {
  let hole;
  try { hole = buildRound(r.seed, r.mode, r.scale ?? 1)[holeIdx]; } catch { return null; }
  const shots = (r.paths[holeIdx] ?? []).filter((p) => p.length > 1);
  if (!hole || !shots.length) return null;

  const pts = [hole.tee, hole.basket, ...shots.flat()];
  let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const pad = 40;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  // Keep the panel's tall shape (about 2:3) so short holes don't zoom in absurdly.
  const minW = Math.max(hole.worldW ?? W, (y1 - y0) * 0.66);
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  const minH = (x1 - x0) * 1.5;
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  const vw = x1 - x0, vh = y1 - y0, u = vh / 140; // u ≈ 3–4 px in the rendered panel

  const poly = (ps: { x: number; y: number }[]) => ps.map((p) => `${n1(p.x)},${n1(p.y)}`).join(" ");
  const fairways = (hole.fairways ?? [hole.fairway]).filter((f) => f.length > 1);
  const parts: string[] = [
    `<rect x="${n1(x0)}" y="${n1(y0)}" width="${n1(vw)}" height="${n1(vh)}" fill="#14251a"/>`,
    ...fairways.map((f) => `<polyline points="${poly(f)}" fill="none" stroke="#24452c" stroke-width="${n1(hole.fwWidth)}" stroke-linecap="round" stroke-linejoin="round"/>`),
    ...hole.water.map((w) => `<rect x="${n1(w.x)}" y="${n1(w.y)}" width="${n1(w.w)}" height="${n1(w.h)}" rx="${n1(u * 1.5)}" fill="#1d4f78"/>`),
    ...(hole.obZones ?? []).map((w) => `<rect x="${n1(w.x)}" y="${n1(w.y)}" width="${n1(w.w)}" height="${n1(w.h)}" fill="#3a1d22" opacity="0.7"/>`),
    ...hole.trees
      .filter((t) => t.x > x0 - t.r && t.x < x1 + t.r && t.y > y0 - t.r && t.y < y1 + t.r)
      .map((t) => `<circle cx="${n1(t.x)}" cy="${n1(t.y)}" r="${n1(t.r)}" fill="#0c1a10" stroke="#2f5a37" stroke-width="${n1(u * 0.6)}"/>`),
    `<rect x="${n1(hole.tee.x - u * 2.5)}" y="${n1(hole.tee.y - u * 1.2)}" width="${n1(u * 5)}" height="${n1(u * 2.4)}" fill="#e8ecf2"/>`,
  ];
  shots.forEach((p, i) => {
    const last = i === shots.length - 1;
    const color = last ? "#f5d24a" : "#36D7B7";
    parts.push(`<polyline points="${poly(p)}" fill="none" stroke="${color}" stroke-width="${n1(u * 1.4)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${last ? "none" : `${n1(u * 3)} ${n1(u * 1.6)}`}"/>`);
    const end = p[p.length - 1];
    parts.push(`<circle cx="${n1(end.x)}" cy="${n1(end.y)}" r="${n1(u * 1.5)}" fill="${color}"/>`);
  });
  parts.push(`<circle cx="${n1(hole.basket.x)}" cy="${n1(hole.basket.y)}" r="${n1(u * 4.5)}" fill="none" stroke="#f5d24a" stroke-width="${n1(u * 0.9)}"/>`);
  parts.push(`<circle cx="${n1(hole.basket.x)}" cy="${n1(hole.basket.y)}" r="${n1(u * 2)}" fill="#f5d24a"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(x0)} ${n1(y0)} ${n1(vw)} ${n1(vh)}" preserveAspectRatio="xMidYMid slice">${parts.join("")}</svg>`;
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Colour per hole result, shared by the OG scorecard strip and the landing card.
export function resultColor(h: HoleResult): string {
  return h.score === 1 || h.diff <= -2 ? "#f5d24a" : h.diff === -1 ? "#36D7B7" : h.diff === 0 ? "#3a4150" : h.diff === 1 ? "#e08a3b" : "#d9534f";
}

// One emoji per hole (dark-mode friendly: par is a dark square), rows of 9,
// the same colour steps as resultColor so the text card matches the image.
export function emojiCard(holes: HoleResult[]): string {
  const e = (h: HoleResult) => (h.score === 1 || h.diff <= -2 ? "🟨" : h.diff === -1 ? "🟩" : h.diff === 0 ? "⬛" : h.diff === 1 ? "🟧" : "🟥");
  const rows: string[] = [];
  for (let i = 0; i < holes.length; i += 9) rows.push(holes.slice(i, i + 9).map(e).join(""));
  return rows.join("\n");
}

// The text that rides along with a shared scorecard: what happened, the emoji
// card, and a link that drops the recipient straight onto the same course.
export function shareText(card: ReplayCard, o: { link: string; daily?: { date: string; stars: number } }): string {
  const grid = emojiCard(card.holes);
  if (o.daily) {
    const stars = "★".repeat(o.daily.stars) + "☆".repeat(Math.max(0, 3 - o.daily.stars));
    return `Disc Golf Arcade Daily · ${o.daily.date} ${stars}\n${card.total} (${card.toPar})${card.highlight ? ` · ${card.headline}` : ""}\n${grid}\n${o.link}`;
  }
  return `${card.headline} at ${card.course}: ${card.total} (${card.toPar}) on Disc Golf Arcade\n${grid}\nBeat it: ${o.link}`;
}

// "Nov 12" for a Daily seed (the seed is the Central-time day index).
export function dailyDateLabel(seed: number): string {
  return new Date(seed * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
