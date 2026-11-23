"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getWeeklyLeaderboard } from "@/actions/arcade";
import { currentWeeklyStop } from "@/lib/discgolf/weekly";
import type { ArcadeScore } from "@/lib/arcade-types";

// Desktop home (>= 1024 px, Nova's UI audit 2026-11-21): two columns instead of
// the phone column. False during SSR and on phones, so the phone home is unchanged.
const WIDE = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
export function useWideMenu(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// Top 5 of this week's Tour Stop board, on the desktop home only (mounted only
// when wide, so phones never make this read).
export function WeeklyBoardPreview({ onOpenBoards }: { onOpenBoards: () => void }) {
  const [stop] = useState(() => currentWeeklyStop(Date.now()));
  const [rows, setRows] = useState<ArcadeScore[] | null>(null);
  useEffect(() => {
    let active = true;
    getWeeklyLeaderboard(stop.week, 5).then((r) => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [stop.week]);
  return (
    <section className="w-full rounded-2xl border border-white/10 bg-[#1a1d23] text-left overflow-hidden" aria-label="This week's leaderboard" data-testid="home-board">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2 border-b border-white/5">
        <h2 className="text-white font-bold text-base truncate">🏆 {stop.name} · top 5</h2>
        <span className="shrink-0 text-gray-400 text-xs font-semibold uppercase tracking-wide">This week</span>
      </div>
      {/* Fixed height for 5 rows so the column doesn't jump when scores arrive. */}
      <div className="min-h-[180px] flex flex-col">
        {rows === null ? (
          <p className="m-auto text-gray-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="m-auto text-gray-400 text-sm">No scores yet — be the first!</p>
        ) : (
          <ol>
            {rows.map((row, i) => (
              <li key={`${row.name}-${row.created_at}`} className={`flex items-center gap-3 px-4 h-9 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}>
                <span className={`font-mono w-5 text-right ${i === 0 ? "text-[#f5d24a]" : "text-gray-400"}`}>{i + 1}</span>
                <span className="text-white flex-1 truncate">{i === 0 ? "👑 " : ""}{row.name}</span>
                <span className="text-gray-400 font-mono">{over(row.strokes - stop.par)}</span>
                <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <button type="button" onClick={onOpenBoards} className="w-full min-h-11 border-t border-white/5 text-[#36D7B7] hover:text-white hover:bg-white/5 text-sm font-semibold transition">
        All leaderboards ›
      </button>
    </section>
  );
}
