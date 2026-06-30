// Player progress: the bits worth keeping across sessions/devices. Stored in
// localStorage (offline) and, when signed in, mirrored to the Supabase
// `arcade_progress` table (RLS: own row). These helpers gather/scatter/merge it.

import type { Career } from "./discgolf/career";
import type { DailyReward } from "./discgolf/wallet";
import { SEASON_HISTORY_MAX, type RankedState, type SeasonRecord } from "./discgolf/ranked";

export const BEST_KEY = "discgolf.best.glendoveer18";
export const WBEST_KEY = "discgolf.best.winthrop18";
export const HOLEBEST_KEY = "discgolf.holebest.glendoveer18";
export const SETTINGS_KEY = "discgolf.settings.v1";
export const ACH_KEY = "discgolf.achievements.v1";
export const HIST_KEY = "discgolf.history.v1";
export const CAREER_KEY = "discgolf.career.v1"; // legacy single career — mirrored to slot 0
export const CAREERS_KEY = "discgolf.careers.v1"; // up to 3 career save slots
export const CAREER_SLOTS = 3;
export const COINS_KEY = "discgolf.coins.v1";
export const DAILY_KEY = "discgolf.dailyreward.v1";
export const OWNED_KEY = "discgolf.owned.v1"; // unlocked discs + cosmetics
export const PROFILE_KEY = "discgolf.profile.v1";
export const RANKED_KEY = "discgolf.ranked.v1";
export const BAG_KEY = "discgolf.bag.v1"; // the ≤5 disc keys carried into rounds
export const BAGSEEN_KEY = "discgolf.bagseen.v1"; // disc keys already auto-processed for the bag
export const LEVELREWARD_KEY = "discgolf.levelreward.v1"; // highest level whose disc draft was resolved
export const COINSEARNED_KEY = "discgolf.coinsEarned.v1"; // lifetime coins earned (monotonic, for loss-free merge)
export const COINSSPENT_KEY = "discgolf.coinsSpent.v1"; // lifetime coins spent (monotonic, for loss-free merge)
export const UPDATEDAT_KEY = "discgolf.updatedAt.v1"; // last local change time, for newer-wins preference merge

export type HistoryRow = { mode: string; total: number; date: number; scores?: number[]; pars?: number[] };
export type Progress = {
  best: number | null;
  winthropBest: number | null;
  holeBest: (number | null)[];
  achievements: string[];
  history: HistoryRow[];
  settings: Record<string, unknown> | null;
  career: Career | null;             // legacy: mirrors slot 0 (kept for back-compat)
  careers?: (Career | null)[];       // up to CAREER_SLOTS career save slots
  coins: number;
  daily: DailyReward | null;
  owned: string[];
  profile: Record<string, unknown> | null;
  ranked: RankedState | null;
  bag: string[];
  bagSeen: string[];
  levelRewarded: number | null;
  coinsEarned?: number; // monotonic lifetime earned (balance = earned − spent)
  coinsSpent?: number;  // monotonic lifetime spent
  updatedAt?: number;   // last local change time (ms), for newer-wins merges
};

// Normalize any progress to a fixed-length array of career slots. Older progress
// (local or cloud) only has the single `career` field — treat it as slot 0 so a
// pre-slots save is never lost when migrating to the 3-slot model.
export function careersOf(p: Pick<Progress, "career" | "careers">): (Career | null)[] {
  const arr = p.careers ?? (p.career ? [p.career] : []);
  return Array.from({ length: CAREER_SLOTS }, (_, i) => arr[i] ?? null);
}

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
  // Career slots: prefer the 3-slot array; fall back to (and migrate) the legacy
  // single career into slot 0 so older saves carry over without loss.
  const careersRaw = parse<(Career | null)[] | null>(localStorage.getItem(CAREERS_KEY), null);
  const legacyCareer = parse<Career | null>(localStorage.getItem(CAREER_KEY), null);
  const careers = careersOf({ careers: careersRaw ?? undefined, career: legacyCareer });
  const career = careers[0];
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
  const ceRaw = localStorage.getItem(COINSEARNED_KEY);
  const coinsEarned = ceRaw != null && Number.isFinite(Number(ceRaw)) ? Number(ceRaw) : undefined;
  const csRaw = localStorage.getItem(COINSSPENT_KEY);
  const coinsSpent = csRaw != null && Number.isFinite(Number(csRaw)) ? Number(csRaw) : undefined;
  const uaRaw = localStorage.getItem(UPDATEDAT_KEY);
  const updatedAt = uaRaw != null && Number.isFinite(Number(uaRaw)) ? Number(uaRaw) : undefined;
  return { best, winthropBest, holeBest, achievements, history, settings, career, careers, coins, daily, owned, profile, ranked, bag, bagSeen, levelRewarded, coinsEarned, coinsSpent, updatedAt };
}

// Wipe this device's saved progress (device SETTINGS are kept). Used on sign-out
// so the next "Play offline" / sign-up is a fresh account; the signed-out
// account's data lives in the cloud, which logging back in restores.
export function clearLocalProgress() {
  if (typeof localStorage === "undefined") return;
  for (const k of [BEST_KEY, WBEST_KEY, HOLEBEST_KEY, ACH_KEY, HIST_KEY, CAREER_KEY, CAREERS_KEY, COINS_KEY, DAILY_KEY, OWNED_KEY, PROFILE_KEY, RANKED_KEY, BAG_KEY, BAGSEEN_KEY, LEVELREWARD_KEY, COINSEARNED_KEY, COINSSPENT_KEY, UPDATEDAT_KEY]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
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
    const careers = careersOf(p);
    localStorage.setItem(CAREERS_KEY, JSON.stringify(careers));
    if (careers[0]) localStorage.setItem(CAREER_KEY, JSON.stringify(careers[0])); // legacy mirror
    else localStorage.removeItem(CAREER_KEY);
    localStorage.setItem(COINS_KEY, String(Math.max(0, Math.round(p.coins ?? 0))));
    if (p.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(p.daily));
    localStorage.setItem(OWNED_KEY, JSON.stringify(p.owned ?? []));
    if (p.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(p.profile));
    if (p.ranked) localStorage.setItem(RANKED_KEY, JSON.stringify(p.ranked));
    if (p.bag?.length) localStorage.setItem(BAG_KEY, JSON.stringify(p.bag));
    if (p.bagSeen?.length) localStorage.setItem(BAGSEEN_KEY, JSON.stringify(p.bagSeen));
    if (p.levelRewarded != null) localStorage.setItem(LEVELREWARD_KEY, String(p.levelRewarded));
    if (p.coinsEarned != null) localStorage.setItem(COINSEARNED_KEY, String(Math.max(0, Math.round(p.coinsEarned))));
    if (p.coinsSpent != null) localStorage.setItem(COINSSPENT_KEY, String(Math.max(0, Math.round(p.coinsSpent))));
    if (p.updatedAt != null) localStorage.setItem(UPDATEDAT_KEY, String(p.updatedAt));
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
  // to-par, and most rounds — so nothing is lost across devices. Ranked runs in
  // monthly seasons, so a NEWER season wins the live ladder outright (last season's
  // data is stale); within the same season we field-wise merge as before. Past-
  // season history is always UNIONED so no device ever loses an earned badge.
  const ra = a.ranked ?? null, rb = b.ranked ?? null;
  let ranked: RankedState | null;
  if (!ra) ranked = rb;
  else if (!rb) ranked = ra;
  else {
    // Union finished-season records, deduped by month, newest first.
    const histMap = new Map<number, SeasonRecord>();
    for (const h of [...(rb.history ?? []), ...(ra.history ?? [])]) if (h && typeof h.season === "number") histMap.set(h.season, h);
    const history = [...histMap.values()].sort((x, y) => y.season - x.season).slice(0, SEASON_HISTORY_MAX);
    const sa = ra.season ?? 0, sb = rb.season ?? 0;
    ranked = sa !== sb
      ? { ...(sa > sb ? ra : rb), history } // newer live ladder wins, but keep all history
      : {
          rp: Math.max(ra.rp ?? 0, rb.rp ?? 0),
          bestToPar: ra.bestToPar == null ? rb.bestToPar : rb.bestToPar == null ? ra.bestToPar : Math.min(ra.bestToPar, rb.bestToPar),
          rounds: Math.max(ra.rounds ?? 0, rb.rounds ?? 0),
          streak: Math.max(ra.streak ?? 0, rb.streak ?? 0),
          bestStreak: Math.max(ra.bestStreak ?? 0, rb.bestStreak ?? 0),
          wins: Math.max(ra.wins ?? 0, rb.wins ?? 0),
          podiums: Math.max(ra.podiums ?? 0, rb.podiums ?? 0),
          // Placement: once placed on either device, stay placed; otherwise keep the
          // further-along placement progress (more calibration rounds banked).
          placed: !!(ra.placed || rb.placed),
          placeEstimates: (ra.placeEstimates?.length ?? 0) >= (rb.placeEstimates?.length ?? 0) ? (ra.placeEstimates ?? []) : (rb.placeEstimates ?? []),
          season: sa,
          lastSeasonRp: ra.lastSeasonRp ?? rb.lastSeasonRp ?? null,
          history,
        };
  }

  // Coins as a loss-free CRDT: reconcile monotonic earned + spent totals (each
  // max-merged) and derive balance = earned − spent. This neither restores spent
  // coins (the old `Math.max(coins)` exploit: spend on one device, re-sync, get
  // them back) nor drops coins earned offline on another device. Legacy rows
  // without the totals fall back to treating the stored balance as "earned".
  const coinsEarned = Math.max(a.coinsEarned ?? a.coins ?? 0, b.coinsEarned ?? b.coins ?? 0);
  const coinsSpent = Math.max(a.coinsSpent ?? 0, b.coinsSpent ?? 0);
  const coins = Math.max(0, coinsEarned - coinsSpent);

  // Newer device wins for single-value preferences (settings/profile/bag), by
  // last-change time — so an offline edit isn't silently clobbered by a stale
  // cloud row (the old "cloud always wins" rule lost local edits). Ties prefer
  // cloud (b) for back-compat with rows that predate the timestamp.
  const ua = a.updatedAt ?? 0, ub = b.updatedAt ?? 0;
  const newer = ua > ub ? a : b; // strictly-newer local wins; tie → cloud (b)
  const older = newer === a ? b : a;
  const updatedAt = Math.max(ua, ub);

  // Career slots merged per-slot (each keeps the further-along of the two saves).
  const ca = careersOf(a), cb = careersOf(b);
  const careers = ca.map((_, i) => moreAdvancedCareer(ca[i], cb[i]));

  return {
    best: minDefined(a.best, b.best),
    winthropBest: minDefined(a.winthropBest, b.winthropBest),
    holeBest,
    achievements,
    history: history.slice(-100),
    settings: newer.settings ?? older.settings,
    // Merge each career slot independently (keeping the further-along save per
    // slot), so two devices each holding different slots both survive.
    career: careers[0],
    careers,
    coins,
    coinsEarned,
    coinsSpent,
    updatedAt,
    daily,
    owned: Array.from(new Set([...(a.owned ?? []), ...(b.owned ?? [])])),
    profile: newer.profile ?? older.profile,
    ranked,
    // Bag is a curated choice — keep the newer device's (non-empty) layout; the
    // component re-reconciles against unlocks after merge. Seen-set unions so a
    // disc already processed on one device isn't re-auto-added on another.
    bag: (newer.bag?.length ? newer.bag : older.bag) ?? [],
    bagSeen: Array.from(new Set([...(a.bagSeen ?? []), ...(b.bagSeen ?? [])])),
    // Highest resolved level-up draft — keep the further-along device's.
    levelRewarded: a.levelRewarded == null ? b.levelRewarded : b.levelRewarded == null ? a.levelRewarded : Math.max(a.levelRewarded, b.levelRewarded),
  };
}
