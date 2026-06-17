// Player profile: a display name, a chosen avatar, and a level derived from
// lifetime play. Avatars are cosmetics — a handful are free, the rest are bought
// with coins and stored in the shared `owned` set under an "avatar:" prefix.

export type PlayerProfile = { name: string; avatar: string };

export type Avatar = { key: string; emoji: string; price: number };

// Free starters first, then coin-locked unlocks (roughly by price/flashiness).
export const AVATARS: Avatar[] = [
  { key: "disc", emoji: "🥏", price: 0 },
  { key: "dart", emoji: "🎯", price: 0 },
  { key: "fire", emoji: "🔥", price: 0 },
  { key: "star", emoji: "⭐", price: 0 },
  { key: "eagle", emoji: "🦅", price: 200 },
  { key: "rocket", emoji: "🚀", price: 350 },
  { key: "trophy", emoji: "🏆", price: 400 },
  { key: "crown", emoji: "👑", price: 500 },
  { key: "alien", emoji: "👽", price: 600 },
  { key: "robot", emoji: "🤖", price: 600 },
  { key: "unicorn", emoji: "🦄", price: 800 },
  { key: "goat", emoji: "🐐", price: 1000 },
];

export const DEFAULT_AVATAR = "🥏";

// Storage key for an owned avatar, e.g. "avatar:crown". Keeps cosmetics from
// colliding with disc keys in the same `owned` array.
export function avatarOwnKey(key: string): string {
  return `avatar:${key}`;
}

// A free avatar is always available; a priced one needs its owned key.
export function avatarUnlocked(a: Avatar, owned: string[]): boolean {
  return a.price === 0 || owned.includes(avatarOwnKey(a.key));
}

export function avatarByKey(key: string): Avatar | undefined {
  return AVATARS.find((a) => a.key === key);
}

// ── Level / XP ───────────────────────────────────────────────────────────────
// XP is earned just by playing: rounds count most, achievements and a deeper
// bag add to it. Purely a function of progress already saved, so it never needs
// its own persisted counter.
export function playerXp(roundsPlayed: number, achievements: number, discsOwned: number): number {
  return Math.max(0, roundsPlayed) * 100 + Math.max(0, achievements) * 150 + Math.max(0, discsOwned) * 60;
}

// Cumulative XP required to *be* a given level (level 1 starts at 0). Each level
// costs a bit more than the last, so the curve eases upward.
export function xpForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return 200 * (L - 1) + 50 * (L - 1) * (L - 2);
}

// Resolve total XP into a level plus progress toward the next one.
export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  const x = Math.max(0, xp);
  let level = 1;
  while (xpForLevel(level + 1) <= x) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: x - cur, need: next - cur };
}
