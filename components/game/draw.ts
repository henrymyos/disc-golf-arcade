import type { Trail } from "@/lib/discgolf/trails";
import { BASKET_SKINS, type BasketSkin } from "@/lib/discgolf/cosmetics";
import { W, H, CATCH_R, type Vec, type Tree } from "@/lib/discgolf/engine";


// Falling-weather overlay (screen space): light rain streaks or drifting snow,
// animated from the timestamp alone so it needs no persistent particle state.
// Drawn over the world but under the HUD; `t` is performance.now() in ms.
export function drawWeather(ctx: CanvasRenderingContext2D, weather: "rain" | "snow" | undefined, t: number) {
  if (!weather) return;
  ctx.save();
  if (weather === "rain") {
    ctx.strokeStyle = "rgba(182,206,230,0.34)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 90; i++) {
      const speed = 620 + (i % 5) * 130;
      const len = 10 + (i % 4) * 4;
      const x = (i * 47) % W;
      const y = ((t * speed) / 1000 + i * 113) % (H + len);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + len);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 80; i++) {
      const speed = 32 + (i % 6) * 12;
      const base = (i * 79) % W;
      const y = ((t * speed) / 1000 + i * 61) % (H + 6);
      const x = (((base + Math.sin((t / 900) * (0.5 + (i % 5) * 0.15) + i) * 9) % W) + W) % W;
      ctx.globalAlpha = 0.45 + (i % 4) * 0.13;
      ctx.beginPath();
      ctx.arc(x, y, 1.3 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Flight trail rendering ────────────────────────────────────────────────
export function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// A color sampled from a palette at t∈[0,1] (tail→head), linearly interpolated.
export function paletteAt(cols: string[], t: number): [number, number, number] {
  if (cols.length === 0) return [255, 255, 255];
  if (cols.length === 1) return hexRGB(cols[0]);
  const seg = t * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = hexRGB(cols[i]);
  const b = hexRGB(cols[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
// Draw the cosmetic flight trail along the disc's path (world coords; `cam` is
// the vertical camera offset). Fades and tapers toward the tail; `kind` styles
// it. Only the most-recent points are drawn (older ones scroll off-screen).
export function drawTrail(ctx: CanvasRenderingContext2D, pts: Vec[], cam: number, trail: Trail | undefined, now: number) {
  if (!trail || trail.kind === "none" || pts.length < 2) return;
  // Keep this cheap: a short tail and no per-segment shadowBlur (which tanks the
  // frame rate on mobile, slowing the whole fixed-step sim). Glow kinds get a
  // SINGLE blurred underlay stroke instead of one per segment.
  const start = Math.max(1, pts.length - 56);
  const n = pts.length;
  const span = Math.max(1, n - 1 - (start - 1));
  const widen = trail.kind === "shadow" ? 1.8 : 1;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // One blurred halo pass for glow trails (cheap: a single stroke, not N).
  if (trail.kind === "neon" || trail.kind === "fire" || trail.kind === "ice") {
    ctx.shadowBlur = 6;
    ctx.shadowColor = trail.colors[trail.colors.length - 1] || "#ffffff";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2.4 * widen;
    ctx.beginPath();
    ctx.moveTo(pts[start - 1].x, pts[start - 1].y - cam);
    for (let i = start; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y - cam);
    ctx.stroke();
    ctx.shadowBlur = 0; // colored segments below draw without the costly shadow
  }
  for (let i = start; i < n; i++) {
    const t = (i - start) / span; // 0 tail → 1 head
    const alpha = 0.1 + 0.78 * t;
    ctx.lineWidth = (0.5 + 2.3 * t) * widen;
    if (trail.kind === "rainbow") {
      const hue = (t * 280 + now * 0.05) % 360;
      ctx.strokeStyle = `hsla(${hue}, 90%, 62%, ${alpha})`;
    } else {
      const rgb = paletteAt(trail.colors, t);
      const mul = trail.kind === "fire" ? 0.8 + 0.2 * Math.sin(now * 0.025 + i * 0.6) : 1;
      ctx.strokeStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha * mul})`;
    }
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y - cam);
    ctx.lineTo(pts[i].x, pts[i].y - cam);
    ctx.stroke();
  }
  // Sparkle: a few cheap twinkling motes (no shadow).
  if (trail.kind === "sparkle") {
    for (let i = start + 2; i < n; i += 4) {
      const t = (i - start) / span;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(now * 0.01 + i * 1.7));
      const rgb = paletteAt(trail.colors, t);
      ctx.fillStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${tw * (0.25 + 0.75 * t)})`;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y - cam, 0.6 + 1.0 * tw * t, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Per-course tree palettes so foliage matches the biome — autumn golds, a snowy
// flocked evergreen (winter trees), dry desert scrub, etc. Keyed by GROUND_THEMES.
export type TreeStyle = { trunk: string; base: string; mid: string; hi: string; cap?: string };
export const TREE_STYLES: Record<string, TreeStyle> = {
  classic: { trunk: "#5a3a1a", base: "#225e1f", mid: "#2f6b2a", hi: "#3f8a37" },
  autumn:  { trunk: "#4e3116", base: "#8a4a1c", mid: "#c47122", hi: "#e6a83c" },
  sakura:  { trunk: "#5a3a2a", base: "#a05578", mid: "#d98fb5", hi: "#f4c7dd" },
  desert:  { trunk: "#6a5330", base: "#566b2c", mid: "#74893a", hi: "#9aad55" },
  snow:    { trunk: "#4a3a2a", base: "#35594b", mid: "#46705d", hi: "#cfe0e8", cap: "#f2f7fb" },
  night:   { trunk: "#2e2416", base: "#163a1c", mid: "#1f4a27", hi: "#2c6033" },
};
export function treeStyleFor(theme: string | undefined): TreeStyle {
  return TREE_STYLES[theme ?? "classic"] ?? TREE_STYLES.classic;
}
export function drawTree(ctx: CanvasRenderingContext2D, tr: Tree, style: TreeStyle = TREE_STYLES.classic) {
  // Trunk (taller, to read as a full-height tree you can't throw over).
  ctx.fillStyle = style.trunk;
  ctx.fillRect(Math.round(tr.x) - 1, Math.round(tr.y), 3, tr.r + 7);
  // Dark base ring + a canopy lifted slightly for a touch of height.
  ctx.fillStyle = style.base;
  ctx.beginPath();
  ctx.arc(tr.x, tr.y + 1, tr.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = style.mid;
  ctx.beginPath();
  ctx.arc(tr.x, tr.y - 2, tr.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = style.hi;
  ctx.beginPath();
  ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.45, tr.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // A snow-capped canopy for winter courses.
  if (style.cap) {
    ctx.fillStyle = style.cap;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y - tr.r * 0.55, tr.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// WCAG contrast ratio (1–21) between two hex colors — used to decide whether a
// chosen color reads well enough on a background before overriding it.
// A high-contrast "ink" for overlays (the basket ring, the aim line), chosen from
// the course's fairway color so they stay legible on light courses (snow, sand)
// and dark ones (night) alike.
export function themeInk(bgHex: string): { line: string; ring: string; onLight: boolean } {
  const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bgHex);
  const r = m ? parseInt(m[1], 16) : 90, g = m ? parseInt(m[2], 16) : 90, b = m ? parseInt(m[3], 16) : 90;
  const onLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5; // is the course background light?
  return onLight
    ? { line: "rgba(15,17,23,0.95)", ring: "rgba(15,17,23,0.55)", onLight }        // light course → dark ink
    : { line: "rgba(255,255,255,0.95)", ring: "rgba(255,255,255,0.5)", onLight };  // dark course  → light ink
}
export function drawBasket(ctx: CanvasRenderingContext2D, x: number, y: number, catchR = CATCH_R, skin?: BasketSkin, ring = "rgba(255,255,255,0.15)") {
  const s = skin ?? BASKET_SKINS[0];
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, catchR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = s.pole;
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 12);
  ctx.fillStyle = s.base;
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 10, 8, 2);
  ctx.fillStyle = s.band;
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 8, 10, 3);
  ctx.fillStyle = s.chains;
  for (let i = -3; i <= 3; i += 3) ctx.fillRect(Math.round(x) + i, Math.round(y) - 5, 1, 5);
}

// Throw-power ring around the disc while dragging: a thin track plus an arc that
// sweeps clockwise from 12 o'clock to `power` (0–1) of a full turn, going
// teal → yellow → red like the How to Play demo. It only shows how hard you're
// pulling, never where the throw will land.
export function drawPowerRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, power: number) {
  const p = Math.max(0, Math.min(1, power));
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = p < 0.5 ? "#36D7B7" : p < 0.85 ? "#f5d24a" : "#e23b3b";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
