// The image behind the results screen's Share button: the same 1200×630 card a
// shared replay link unfurls as (app/og/replay-image.tsx), drawn client-side so
// it works offline and needs no upload. Headline, score, hole strip, and the
// "shot of the round" map (the best hole with its flight paths).

import { replayHoleSvg, mapHoleIndex, resultColor, svgDataUri, type ReplayCard } from "@/lib/discgolf/replayCard";
import type { Replay } from "@/lib/discgolf/replay";

const BG = "#0f1117", TEAL = "#36D7B7", GOLD = "#f5d24a", MUTED = "#9aa4b2";
const FONT = "ui-monospace, Menlo, monospace";

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

// Largest font size (down to `min`) at which `text` fits in `maxW`.
function fit(c: CanvasRenderingContext2D, text: string, weight: string, size: number, min: number, maxW: number): number {
  for (; size > min; size -= 2) {
    c.font = `${weight} ${size}px ${FONT}`;
    if (c.measureText(text).width <= maxW) return size;
  }
  c.font = `${weight} ${min}px ${FONT}`;
  return min;
}

function ellipsize(c: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try { await img.decode(); return img; } catch { return null; }
}

export async function renderShareCard(r: Replay, card: ReplayCard, kicker: string): Promise<Blob | null> {
  const cv = document.createElement("canvas");
  cv.width = 1200;
  cv.height = 630;
  const c = cv.getContext("2d");
  if (!c) return null;

  const g = c.createLinearGradient(0, 0, 1200, 630);
  g.addColorStop(0, "#1c2233");
  g.addColorStop(0.7, BG);
  c.fillStyle = g;
  c.fillRect(0, 0, 1200, 630);

  // Shot of the round: the best recorded hole, drawn on the right.
  const mi = mapHoleIndex(r, card);
  const svg = mi == null ? null : replayHoleSvg(r, mi);
  const img = svg ? await loadImage(svgDataUri(svg)) : null;
  const leftW = img ? 694 : 1072;
  if (img && mi != null) {
    const x = 806, y = 56, w = 330;
    c.save();
    roundRect(c, x, y, w, 518, 18);
    c.clip();
    c.fillStyle = "#14251a";
    c.fillRect(x, y, w, 518);
    c.drawImage(img, x, y, w, 470);
    c.fillStyle = "#13161b";
    c.fillRect(x, y + 470, w, 48);
    const h = card.holes[mi];
    c.font = `bold 20px ${FONT}`;
    c.textBaseline = "middle";
    c.fillStyle = "#fff";
    c.textAlign = "left";
    c.fillText(`Hole ${h.hole} · par ${h.par}`, x + 16, y + 494);
    const rc = resultColor(h);
    c.fillStyle = rc === "#3a4150" ? MUTED : rc;
    c.textAlign = "right";
    c.fillText(h.label, x + w - 16, y + 494);
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.14)";
    c.lineWidth = 2;
    roundRect(c, x, y, w, 518, 18);
    c.stroke();
  }

  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  // Logo
  c.fillStyle = TEAL;
  roundRect(c, 64, 62, 34, 20, 10);
  c.fill();
  c.font = `800 30px ${FONT}`;
  c.fillStyle = "#fff";
  c.fillText("Disc Golf", 112, 83);
  c.fillStyle = TEAL;
  c.fillText("Arcade", 112 + c.measureText("Disc Golf ").width, 83);

  // Kicker, headline, who/where
  c.font = `bold 24px ${FONT}`;
  c.fillStyle = TEAL;
  c.fillText(ellipsize(c, kicker.toUpperCase(), leftW), 64, 196);
  const hi = card.highlight ? (card.highlight.diff <= -2 || card.highlight.score === 1 ? GOLD : TEAL) : "#fff";
  fit(c, card.headline, "800", 64, 36, leftW);
  c.fillStyle = hi;
  c.fillText(card.headline, 64, 262);
  c.font = `bold 30px ${FONT}`;
  c.fillStyle = "#fff";
  c.fillText(ellipsize(c, `${card.name} at ${card.course}`, leftW), 64, 310);

  // Score
  const d = card.total - card.par;
  c.font = `800 96px ${FONT}`;
  c.fillStyle = "#fff";
  c.fillText(`${card.total}`, 64, 418);
  let x = 64 + c.measureText(`${card.total}`).width + 20;
  c.font = `800 48px ${FONT}`;
  c.fillStyle = d < 0 ? TEAL : d === 0 ? "#fff" : "#e08a3b";
  c.fillText(card.toPar, x, 410);
  x += c.measureText(card.toPar).width + 20;
  c.font = `26px ${FONT}`;
  c.fillStyle = MUTED;
  c.fillText(`par ${card.par} · ${card.holes.length} holes`, x, 404);

  // Hole-by-hole strip
  const n = card.holes.length;
  const cell = Math.max(14, Math.min(36, Math.floor(leftW / n) - 4));
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `800 ${Math.round(cell * 0.5)}px ${FONT}`;
  card.holes.forEach((h, i) => {
    const cx = 64 + i * (cell + 4);
    c.fillStyle = resultColor(h);
    roundRect(c, cx, 446, cell, cell, 6);
    c.fill();
    c.fillStyle = h.diff === 0 ? "#cfd6e0" : BG;
    c.fillText(`${h.score}`, cx + cell / 2, 446 + cell / 2 + 1);
  });

  // Call to action
  c.textAlign = "left";
  c.font = `800 28px ${FONT}`;
  const cta = "Play it free";
  const bw = c.measureText(cta).width + 56;
  c.fillStyle = TEAL;
  roundRect(c, 64, 516, bw, 58, 14);
  c.fill();
  c.fillStyle = BG;
  c.textBaseline = "middle";
  c.fillText(cta, 92, 546);
  c.font = `24px ${FONT}`;
  c.fillStyle = MUTED;
  c.fillText("discgolfarcade.com", 64 + bw + 22, 546);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}
