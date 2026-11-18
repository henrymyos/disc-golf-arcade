"use client";

import { useSyncExternalStore } from "react";
import { currentWeeklyStop, timeLeftLabel } from "@/lib/discgolf/weekly";

// Wall clock rounded to the minute: null during SSR/hydration, then ticks every
// 30 s (a stable snapshot within a minute, so React doesn't re-render needlessly).
const subscribe = (cb: () => void) => { const id = setInterval(cb, 30_000); return () => clearInterval(id); };
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
export function useMinuteClock(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, () => null);
}

// Home menu: this week's Pro Tour course, the time left, and play. Sits beside
// the 2026 Pro Tour card so the home menu keeps its height.
export function WeeklyStopCard({ className, onPlay }: { className: string; onPlay: (seed: number) => void }) {
  const now = useMinuteClock();
  const stop = now == null ? null : currentWeeklyStop(now);
  return (
    <button
      type="button"
      disabled={!stop}
      onClick={() => stop && onPlay(stop.seed)}
      className={`${className} !flex-col gap-0.5 min-w-0 flex-1 !border-[#f5d24a]/45`}
      data-testid="hub-weekly"
      aria-label={stop ? `Weekly Tour Stop: ${stop.name}, ${timeLeftLabel(stop.end, now!)}. Play` : "Weekly Tour Stop"}
    >
      <span className="text-[#f5d24a] text-[11px] font-bold uppercase tracking-wide">Weekly Tour Stop</span>
      <span className="font-black text-lg leading-tight truncate max-w-full">{stop ? stop.name : "…"}</span>
      <span className="text-gray-400 text-[11px]">{stop ? `${timeLeftLabel(stop.end, now!)} · ▶ Play` : " "}</span>
    </button>
  );
}
