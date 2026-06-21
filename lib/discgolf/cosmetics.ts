// Cosmetics beyond flight trails: disc skins, basket skins, aim-line styles and
// ground/course themes. Each is a free default plus coin-bought extras, stored
// in the shared `owned` set under a per-category prefix, with the chosen one
// saved on the player profile. The styling fields are read by the game canvas.

export type DiscKind = "solid" | "glow" | "chrome" | "galaxy";
export type DiscSkin = { key: string; name: string; desc: string; price: number; body: string; kind: DiscKind };

export type BasketSkin = { key: string; name: string; desc: string; price: number; pole: string; base: string; band: string; chains: string };

export type AimStyle = { key: string; name: string; desc: string; price: number; color: string; dash?: [number, number]; glow?: boolean };

export type GroundTheme = { key: string; name: string; desc: string; price: number; rough: string; roughBand: string; fairway: string; stripe: string };

// ── Disc skins (the flying disc's body). The disc's tier color still shows as a
// center pip so you can tell which disc is in hand. ──
export const DISC_SKINS: DiscSkin[] = [
  { key: "white", name: "Classic", desc: "Clean white disc", price: 0, body: "#ffffff", kind: "solid" },
  { key: "gold", name: "Gold", desc: "Warm gold body", price: 200, body: "#f5d24a", kind: "solid" },
  { key: "sky", name: "Sky", desc: "Bright blue body", price: 200, body: "#7cc5f0", kind: "solid" },
  { key: "coral", name: "Coral", desc: "Sunset orange body", price: 200, body: "#f08a6b", kind: "solid" },
  { key: "mint", name: "Mint", desc: "Cool mint body", price: 250, body: "#7fe6c8", kind: "solid" },
  { key: "shadow", name: "Shadow", desc: "Stealthy dark body", price: 500, body: "#3a3f4a", kind: "solid" },
  { key: "neon", name: "Neon", desc: "Glowing electric disc", price: 700, body: "#36ffe0", kind: "glow" },
  { key: "ember", name: "Ember", desc: "Glowing molten disc", price: 700, body: "#ff7a3b", kind: "glow" },
  { key: "chrome", name: "Chrome", desc: "Shiny metallic finish", price: 800, body: "#d7dde6", kind: "chrome" },
  { key: "galaxy", name: "Galaxy", desc: "Deep-space swirl", price: 1000, body: "#6a4bd6", kind: "galaxy" },
];

// ── Basket skins (the target's metalwork). ──
export const BASKET_SKINS: BasketSkin[] = [
  { key: "steel", name: "Steel", desc: "Classic chrome basket", price: 0, pole: "#9aa0a8", base: "#7a808a", band: "#c2c8d0", chains: "#aeb4bd" },
  { key: "gold", name: "Gold", desc: "Gleaming gold basket", price: 300, pole: "#caa53a", base: "#a9871f", band: "#f0d873", chains: "#dcc05a" },
  { key: "crimson", name: "Crimson", desc: "Bold red basket", price: 300, pole: "#c14b4b", base: "#9a3434", band: "#f08a8a", chains: "#d76a6a" },
  { key: "emerald", name: "Emerald", desc: "Lush green basket", price: 350, pole: "#3ca06a", base: "#2a7d50", band: "#74d6a0", chains: "#5ac088" },
  { key: "onyx", name: "Onyx", desc: "Matte black basket", price: 400, pole: "#3a3f48", base: "#272b32", band: "#5a616c", chains: "#474d56" },
  { key: "neon", name: "Neon", desc: "Glowing cyber basket", price: 700, pole: "#2bd6c4", base: "#1f9e90", band: "#7cffff", chains: "#36ffe0" },
];

// ── Aim-line styles (the predicted-flight line shown while you pull back). ──
export const AIM_STYLES: AimStyle[] = [
  { key: "white", name: "Classic", desc: "Clean white line", price: 0, color: "#ffffff" },
  { key: "teal", name: "Teal", desc: "Mint aim line", price: 150, color: "#36D7B7" },
  { key: "gold", name: "Gold", desc: "Gold aim line", price: 150, color: "#f5d24a" },
  { key: "crimson", name: "Crimson", desc: "Red aim line", price: 150, color: "#e23b3b" },
  { key: "violet", name: "Violet", desc: "Purple aim line", price: 200, color: "#c07ce0" },
  { key: "dashed", name: "Dashed", desc: "Dotted white line", price: 300, color: "#ffffff", dash: [4, 4] },
  { key: "neon", name: "Neon", desc: "Glowing aim line", price: 500, color: "#36ffe0", glow: true },
];

// ── Ground / course themes (grass + fairway tint). Hazard-rough holes keep
// their warning colors; only the normal grass is re-tinted. ──
export const GROUND_THEMES: GroundTheme[] = [
  { key: "classic", name: "Classic", desc: "Lush green course", price: 0, rough: "#2f5a26", roughBand: "#2b5323", fairway: "#4d9a39", stripe: "#56a541" },
  { key: "desert", name: "Desert", desc: "Sun-baked sand course", price: 350, rough: "#7a6a45", roughBand: "#6a5b3a", fairway: "#b0975a", stripe: "#c2a868" },
  { key: "autumn", name: "Autumn", desc: "Golden fall foliage", price: 400, rough: "#5a4a26", roughBand: "#4e3f1f", fairway: "#a8893a", stripe: "#bd9a45" },
  { key: "sakura", name: "Sakura", desc: "Soft cherry-blossom tint", price: 500, rough: "#5a4350", roughBand: "#4d3a45", fairway: "#a06a88", stripe: "#b87f9e" },
  { key: "snow", name: "Snow", desc: "Frosted winter course", price: 500, rough: "#9fb0bd", roughBand: "#8da0ad", fairway: "#cdd9e1", stripe: "#dde7ee" },
  { key: "night", name: "Night", desc: "Moonlit night round", price: 600, rough: "#1c2433", roughBand: "#18202c", fairway: "#2a3b4a", stripe: "#34465a" },
];

export const DEFAULT_DISC_SKIN = "white";
export const DEFAULT_BASKET_SKIN = "steel";
export const DEFAULT_AIM_STYLE = "white";
export const DEFAULT_GROUND_THEME = "classic";

// Per-category owned-set prefixes.
export const COSMETIC_PREFIX = {
  discSkin: "discskin",
  basket: "basket",
  aim: "aim",
  ground: "ground",
} as const;

export function cosmeticOwnKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}
export function cosmeticUnlocked(prefix: string, item: { key: string; price: number }, owned: string[]): boolean {
  return item.price === 0 || owned.includes(cosmeticOwnKey(prefix, item.key));
}
export function cosmeticByKey<T extends { key: string }>(list: T[], key: string | undefined | null): T | undefined {
  return list.find((i) => i.key === key);
}
