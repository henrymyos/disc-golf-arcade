// Player progress: the bits worth keeping across sessions/devices. Stored in
// localStorage (offline) and, when signed in, mirrored to Supabase auth
// user_metadata (no table/RLS needed). These helpers gather/scatter/merge it.

export const BEST_KEY = "discgolf.best.glendoveer18";
export const WBEST_KEY = "discgolf.best.winthrop18";
export const HOLEBEST_KEY = "discgolf.holebest.glendoveer18";
export const SETTINGS_KEY = "discgolf.settings.v1";
export const ACH_KEY = "discgolf.achievements.v1";
export const HIST_KEY = "discgolf.history.v1";

export type HistoryRow = { mode: string; total: number; date: number; scores?: number[]; pars?: number[] };
export type Progress = {
  best: number | null;
  winthropBest: number | null;
  holeBest: (number | null)[];
  achievements: string[];
  history: HistoryRow[];
  settings: Record<string, unknown> | null;
};

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function readLocalProgress(): Progress {
  if (typeof localStorage === "undefined") {
    return { best: null, winthropBest: null, holeBest: [], achievements: [], history: [], settings: null };
  }
  const bestRaw = localStorage.getItem(BEST_KEY);
  const best = bestRaw != null && Number.isFinite(Number(bestRaw)) ? Number(bestRaw) : null;
  const wBestRaw = localStorage.getItem(WBEST_KEY);
  const winthropBest = wBestRaw != null && Number.isFinite(Number(wBestRaw)) ? Number(wBestRaw) : null;
  const holeBest = parse<(number | null)[]>(localStorage.getItem(HOLEBEST_KEY), []);
  const achievements = parse<string[]>(localStorage.getItem(ACH_KEY), []);
  const history = parse<HistoryRow[]>(localStorage.getItem(HIST_KEY), []);
  const settings = parse<Record<string, unknown> | null>(localStorage.getItem(SETTINGS_KEY), null);
  return { best, winthropBest, holeBest, achievements, history, settings };
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

  return {
    best: minDefined(a.best, b.best),
    winthropBest: minDefined(a.winthropBest, b.winthropBest),
    holeBest,
    achievements,
    history: history.slice(-100),
    settings: b.settings ?? a.settings, // prefer cloud settings on conflict
  };
}
