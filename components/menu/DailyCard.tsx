"use client";

import type { Goal } from "@/lib/discgolf/goals";
import { GoalStar } from "../panels/ui";

const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// The menu's one Daily card: play today's Daily (stars banked today, today's
// best, the Daily streak), plus a strip with the daily coin reward and the Next
// goal. One card so Pro Tour and the utility row stay above the fold at 390 px.
export function DailyCard({ stars, best, streak, onPlay, reward, goal }: {
  stars: number;
  best: number | null;
  streak: number;
  onPlay: () => void;
  // available: the claim button shows; otherwise "Claimed" with the reward streak.
  reward: { available: boolean; streak: number; onClaim: () => void };
  goal: Goal | null;
}) {
  const pct = goal ? Math.round(goal.progress * 100) : 0;
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-[#36D7B7]/55 bg-[#1a1d23] shadow-[0_8px_24px_rgba(54,215,183,0.18)]">
      <button
        type="button"
        onClick={onPlay}
        className="w-full bg-[#36D7B7] hover:bg-[#2ec2a6] active:bg-[#2bc4a6] text-[#0f1117] px-4 py-3 transition text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-black text-lg leading-tight">▶ Play today&apos;s Daily</span>
          {streak > 0 && (
            <span className="shrink-0 rounded-full bg-[#0f1117]/15 px-2 py-0.5 text-xs font-black" aria-label={`Daily streak ${streak} days`}>
              🔥 {streak}
            </span>
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="flex items-center gap-0.5" aria-label={`${stars} of 3 stars today`}>
            {[0, 1, 2].map((i) => <GoalStar key={i} lit={stars > i} label="" size={20} />)}
          </span>
          <span className="text-xs font-bold text-[#0f1117]/75">
            {best == null ? "9 holes · not played yet today" : `Best today ${fmtToPar(best)}`}
          </span>
        </span>
      </button>
      <div className="flex items-stretch gap-2 p-2">
        {reward.available ? (
          <button type="button" onClick={reward.onClaim}
            className="shrink-0 min-h-11 rounded-lg bg-[#f5d24a] hover:bg-[#ecc63a] text-[#1a1d23] font-bold text-xs px-3 transition motion-safe:animate-pulse">
            🎁 Daily reward
          </button>
        ) : (
          <span className="shrink-0 min-h-11 flex items-center rounded-lg border border-white/10 text-gray-400 text-[11px] font-semibold px-2.5">
            🎁 Claimed · 🔥 {reward.streak}d
          </span>
        )}
        {goal && (
          <div className="min-w-0 flex-1 flex flex-col justify-center text-left" aria-label="Next goal">
            <p className="text-white text-xs font-bold leading-tight truncate" title={`Next goal: ${goal.title}`}>
              <span aria-hidden>{goal.emoji} </span>{goal.title}
            </p>
            <div className="mt-1 h-1.5 rounded bg-white/10 overflow-hidden" role="progressbar" aria-label={`${goal.title}: progress`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded bg-[#f5d24a]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
