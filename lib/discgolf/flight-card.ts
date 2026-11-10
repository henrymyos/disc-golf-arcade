// Flight-shape card data: each disc's full-power flight at hyzer, flat and
// anhyzer, thrown righty backhand in calm, flat open air. It uses the same
// launch maths as throwDisc and the same obstacle-blind preview stepping as the
// in-round aim line (stepFlight with preview: true), so the card shows exactly
// how the game flies the disc. Cached per disc: built once, then free.
import { stepFlight, releaseSpeedMul, STRAIGHT_SPEED_MUL, pxToFeet, type Disc, type Flight, type Hole, type Release, type Vec } from "./engine";

export const RELEASES: Release[] = ["hyzer", "flat", "anny"];
export const RHBH = -1; // fadeSign for a righty backhand (BH = -1, not left-handed)
const MAX_STEPS = 1500;

// No wind, no slope, nothing to hit: the preview ignores trees, OB and the basket.
export const OPEN_AIR: Hole = { par: 3, worldH: 1e5, worldW: 1e5, tee: { x: 0, y: 0 }, basket: { x: 0, y: -1e5 }, fairway: [{ x: 0, y: 0 }, { x: 0, y: -1e5 }], fwWidth: 1e5, trees: [], water: [] };

// Raw preview path in px from the origin, launched straight up the screen (-y).
export function previewPath(disc: Disc, release: Release, power = 1): Vec[] {
  const speed = disc.power * (1.2 + power * 3.35) * STRAIGHT_SPEED_MUL * releaseSpeedMul(release);
  const ang = -Math.PI / 2;
  const f: Flight = { x: 0, y: 0, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, h: 0, vh: power * disc.arc, fadeTurn: 0 };
  const out: Vec[] = [{ x: 0, y: 0 }];
  for (let i = 0; i < MAX_STEPS; i++) {
    const r = stepFlight(f, disc, RHBH, "straight", OPEN_AIR, release, { preview: true });
    out.push({ x: f.x, y: f.y });
    if (r.status !== "fly") break;
  }
  return out;
}

// In feet: x = sideways (+ right, as the thrower sees it), y = forward.
export type FlightShape = { release: Release; pts: Vec[]; carryFt: number; sideFt: number };
const cache = new Map<string, FlightShape[]>();

export function flightShapes(disc: Disc): FlightShape[] {
  const hit = cache.get(disc.key);
  if (hit) return hit;
  const shapes = RELEASES.map((release) => {
    const raw = previewPath(disc, release);
    const pts = raw.map((p) => ({ x: p.x * 1.8, y: -p.y * 1.8 })); // FEET_PER_PX
    const end = raw[raw.length - 1];
    return { release, pts, carryFt: pxToFeet(Math.hypot(end.x, end.y)), sideFt: pxToFeet(end.x) };
  });
  cache.set(disc.key, shapes);
  return shapes;
}
