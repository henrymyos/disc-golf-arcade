// Flight trails: a cosmetic ribbon the disc leaves along its flight path. Free
// "None"/"Classic" for everyone; the rest are bought with coins and stored in
// the shared `owned` set under a "trail:<key>" prefix (like avatars), with the
// chosen one saved on the player profile. The `kind` drives how the renderer in
// the game canvas styles the ribbon; `colors` is its palette.

export type TrailKind =
  | "none"
  | "solid"
  | "gradient"
  | "rainbow"
  | "fire"
  | "ice"
  | "neon"
  | "sparkle"
  | "shadow";

export type Trail = {
  key: string;
  name: string;
  desc: string;
  price: number;
  kind: TrailKind;
  colors: string[]; // palette the renderer draws with (tail → head)
};

// Free starters first, then solid colors, then the flashy effects (roughly by
// price). `none` turns the trail off.
export const TRAILS: Trail[] = [
  { key: "none", name: "None", desc: "No trail", price: 0, kind: "none", colors: [] },
  { key: "classic", name: "Classic", desc: "A clean white streak", price: 0, kind: "solid", colors: ["#ffffff"] },
  // Solid colors
  { key: "teal", name: "Teal", desc: "Cool mint streak", price: 200, kind: "solid", colors: ["#36D7B7"] },
  { key: "gold", name: "Gold", desc: "Warm gold streak", price: 200, kind: "solid", colors: ["#f5d24a"] },
  { key: "crimson", name: "Crimson", desc: "Bold red streak", price: 200, kind: "solid", colors: ["#e23b3b"] },
  { key: "violet", name: "Violet", desc: "Rich purple streak", price: 250, kind: "solid", colors: ["#b85cd6"] },
  { key: "sky", name: "Sky", desc: "Bright blue streak", price: 250, kind: "solid", colors: ["#5fb0e8"] },
  // Effects
  { key: "aurora", name: "Aurora", desc: "Teal-to-violet gradient", price: 600, kind: "gradient", colors: ["#36D7B7", "#b85cd6"] },
  { key: "ice", name: "Ice", desc: "Frosty blue glow", price: 700, kind: "ice", colors: ["#bdecff", "#5fb0e8", "#ffffff"] },
  { key: "fire", name: "Fire", desc: "Flickering flames", price: 800, kind: "fire", colors: ["#e23b3b", "#e0923b", "#f5d24a"] },
  { key: "neon", name: "Neon", desc: "Glowing electric line", price: 900, kind: "neon", colors: ["#36ffe0"] },
  { key: "shadow", name: "Shadow", desc: "Dark smoky wake", price: 900, kind: "shadow", colors: ["#1a1d23", "#5b4b8a"] },
  { key: "sparkle", name: "Sparkle", desc: "Twinkling stardust", price: 1200, kind: "sparkle", colors: ["#fff7cf", "#f5d24a"] },
  { key: "rainbow", name: "Rainbow", desc: "Full-spectrum streak", price: 1500, kind: "rainbow", colors: [] },
];

export const DEFAULT_TRAIL = "classic";

export function trailOwnKey(key: string): string {
  return `trail:${key}`;
}

// A free trail is always available; a priced one needs its owned key.
export function trailUnlocked(t: Trail, owned: string[]): boolean {
  return t.price === 0 || owned.includes(trailOwnKey(t.key));
}

export function trailByKey(key: string | undefined | null): Trail | undefined {
  return TRAILS.find((t) => t.key === key);
}
