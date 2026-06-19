// Player progress: the bits worth keeping across sessions/devices. Stored in
// localStorage (offline) and, when signed in, mirrored to Supabase auth
// user_metadata (no table/RLS needed). These helpers gather/scatter/merge it.

import type { Career } from "./discgolf/career";
import type { DailyReward } from "./discgolf/wallet";
import type { RankedState } from "./discgolf/ranked";

export const BEST_KEY = "discgolf.best.glendoveer18";
export const WBEST_KEY = "discgolf.best.winthrop18";
export const HOLEBEST_KEY = "discgolf.holebest.glendoveer18";
export const SETTINGS_KEY = "discgolf.settings.v1";
export const ACH_KEY = "discgolf.achievements.v1";
export const HIST_KEY = "discgolf.history.v1";
export const CAREER_KEY = "discgolf.career.v1";
export const COINS_KEY = "discgolf.coins.v1";
export const DAILY_KEY = "discgolf.dailyreward.v1";
export const OWNED_KEY = "discgolf.owned.v1"; // unlocked discs + cosmetics
export const PROFILE_KEY = "discgolf.profile.v1";
export const RANKED_KEY = "discgolf.ranked.v1";
export const BAG_KEY = "discgolf.bag.v1"; // the ≤5 disc keys carried into rounds
export const BAGSEEN_KEY = "discgolf.bagseen.v1"; // disc keys already auto-processed for the bag
export const LEVELREWARD_KEY = "discgolf.levelreward.v1"; // highest level whose disc draft was resolved

export type HistoryRow = { mode: string; total: number; date: number; scores?: number[]; pars?: number[] };
export type Progress = {
  best: number | null;
  winthropBest: number | null;
  holeBest: (number | null)[];
  achievements: string[];
  history: HistoryRow[];
  settings: Record<string, unknown> | null;
  career: Career | null;
  coins: number;
  daily: DailyReward | null;
  owned: string[];
  profile: Record<string, unknown> | null;
  ranked: RankedState | null;
  bag: string[];
  bagSeen: string[];
  levelRewarded: number | null;
};

// Of two career saves, keep the one further along (more seasons, then events).
function moreAdvancedCareer(a: Career | null, b: Career | null): Career | null {
  if (!a) return b;
  if (!b) return a;
  if (a.season !== b.season) return a.season > b.season ? a : b;
  const ra = a.results?.length ?? 0, rb = b.results?.length ?? 0;
  if (ra !== rb) return ra > rb ? a : b;
  return (a.careerPoints ?? 0) >= (b.careerPoints ?? 0) ? a : b;
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function readLocalProgress(): Progress {
  if (typeof localStorage === "undefined") {
    return { best: null, winthropBest: null, holeBest: [], achievements: [], history: [], settings: null, career: null, coins: 0, daily: null, owned: [], profile: null, ranked: null, bag: [], bagSeen: [], levelRewarded: null };
  }
  const bestRaw = localStorage.getItem(BEST_KEY);
  const best = bestRaw != null && Number.isFinite(Number(bestRaw)) ? Number(bestRaw) : null;
  const wBestRaw = localStorage.getItem(WBEST_KEY);
  const winthropBest = wBestRaw != null && Number.isFinite(Number(wBestRaw)) ? Number(wBestRaw) : null;
  const holeBest = parse<(number | null)[]>(localStorage.getItem(HOLEBEST_KEY), []);
  const achievements = parse<string[]>(localStorage.getItem(ACH_KEY), []);
  const history = parse<HistoryRow[]>(localStorage.getItem(HIST_KEY), []);
  const settings = parse<Record<string, unknown> | null>(localStorage.getItem(SETTINGS_KEY), null);
  const career = parse<Career | null>(localStorage.getItem(CAREER_KEY), null);
  const coinsRaw = localStorage.getItem(COINS_KEY);
  const coins = coinsRaw != null && Number.isFinite(Number(coinsRaw)) ? Number(coinsRaw) : 0;
  const daily = parse<DailyReward | null>(localStorage.getItem(DAILY_KEY), null);
  const owned = parse<string[]>(localStorage.getItem(OWNED_KEY), []);
  const profile = parse<Record<string, unknown> | null>(localStorage.getItem(PROFILE_KEY), null);
  const ranked = parse<RankedState | null>(localStorage.getItem(RANKED_KEY), null);
  const bag = parse<string[]>(localStorage.getItem(BAG_KEY), []);
  const bagSeen = parse<string[]>(localStorage.getItem(BAGSEEN_KEY), []);
  const lrRaw = localStorage.getItem(LEVELREWARD_KEY);
  const levelRewarded = lrRaw != null && Number.isFinite(Number(lrRaw)) ? Number(lrRaw) : null;
  return { best, winthropBest, holeBest, achievements, history, settings, career, coins, daily, owned, profile, ranked, bag, bagSeen, levelRewarded };
}

export function applyProgress(p: Progress) {
  if (typeof localStorage === "undefined") return;
  try {
    if (p.best != null) localStorage.setItem(BEST_KEY, String(p.best));
    if (p.winthropBest != null) localStorage.setItem(WBEST_KEY, String(p.winthropBest));
    if (p.holeBest?.length) localStorage.setItem(HOLEBEST_KEY, JSON.stringify(p.holeBest));
    localStorage.setItem(ACH_KEY, JSON.stringify(p.achievements ?? []));
    localStorage.setItem(HIST_KEY, JSON.stringify((p.history ?? []).slice(-100)));
    if (p.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(p.settings));
    if (p.career) localStorage.setItem(CAREER_KEY, JSON.stringify(p.career));
    localStorage.setItem(COINS_KEY, String(Math.max(0, Math.round(p.coins ?? 0))));
    if (p.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(p.daily));
    localStorage.setItem(OWNED_KEY, JSON.stringify(p.owned ?? []));
    if (p.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(p.profile));
    if (p.ranked) localStorage.setItem(RANKED_KEY, JSON.stringify(p.ranked));
    if (p.bag?.length) localStorage.setItem(BAG_KEY, JSON.stringify(p.bag));
    if (p.bagSeen?.length) localStorage.setItem(BAGSEEN_KEY, JSON.stringify(p.bagSeen));
    if (p.levelRewarded != null) localStorage.setItem(LEVELREWARD_KEY, String(p.levelRewarded));
  } catch { /* ignore */ }
}

// Combine local + cloud progress, always keeping the *better* result so nothing
// is lost: lower scores win, achievements union, history merges.
export function mergeProgress(a: Progress, b: Progress): Progress {
  const minDefined = (x: number | null, y: number | null) =>
    x == null ? y : y == null ? x : Math.min(x, y);

  const len = Math.max(a.holeBest?.length ?? 0, b.holeBest?.length ?? 0, 18);
  const holeBest: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    const x = a.holeBest?.[i] ?? null;
    const y = b.holeBest?.[i] ?? null;
    holeBest[i] = minDefined(x, y);
  }

  const achievements = Array.from(new Set([...(a.achievements ?? []), ...(b.achievements ?? [])]));

  const seen = new Set<string>();
  const history: HistoryRow[] = [];
  for (const r of [...(a.history ?? []), ...(b.history ?? [])]) {
    const k = `${r.date}|${r.mode}|${r.total}`;
    if (seen.has(k)) continue;
    seen.add(k);
    history.push(r);
  }
  history.sort((x, y) => x.date - y.date);

  // Most-recent daily-reward state (higher day; break ties by longer streak).
  const da = a.daily ?? null, db = b.daily ?? null;
  const daily = !da ? db : !db ? da : da.day !== db.day ? (da.day > db.day ? da : db) : (da.streak >= db.streak ? da : db);

  // Ranked ladder: keep the most progress — highest lifetime RP, best (lowest)
  // to-par, and most rounds — so nothing is lost across devices.
  const ra = a.ranked ?? null, rb = b.ranked ?? null;
  const ranked: RankedState | null = !ra ? rb : !rb ? ra : {
    rp: Math.max(ra.rp ?? 0, rb.rp ?? 0),
    bestToPar: ra.bestToPar == null ? rb.bestToPar : rb.bestToPar == null ? ra.bestToPar : Math.min(ra.bestToPar, rb.bestToPar),
    rounds: Math.max(ra.rounds ?? 0, rb.rounds ?? 0),
  };

  return {
    best: minDefined(a.best, b.best),
    winthropBest: minDefined(a.winthropBest, b.winthropBest),
    holeBest,
    achievements,
    history: history.slice(-100),
    settings: b.settings ?? a.settings, // prefer cloud settings on conflict
    career: moreAdvancedCareer(a.career ?? null, b.career ?? null),
    coins: Math.max(a.coins ?? 0, b.coins ?? 0), // keep the higher balance so coins aren't lost
    daily,
    owned: Array.from(new Set([...(a.owned ?? []), ...(b.owned ?? [])])),
    profile: b.profile ?? a.profile, // prefer cloud profile on conflict
    ranked,
    // Bag is a curated choice — prefer the cloud's (non-empty) layout; the
    // component re-reconciles against unlocks after merge. Seen-set unions so a
    // disc already processed on one device isn't re-auto-added on another.
    bag: (b.bag?.length ? b.bag : a.bag) ?? [],
    bagSeen: Array.from(new Set([...(a.bagSeen ?? []), ...(b.bagSeen ?? [])])),
    // Highest resolved level-up draft — keep the further-along device's.
    levelRewarded: a.levelRewarded == null ? b.levelRewarded : b.levelRewarded == null ? a.levelRewarded : Math.max(a.levelRewarded, b.levelRewarded),
  };
}
