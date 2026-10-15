"use client";

import { GoalStar } from "../panels/ui";

const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// The menu's primary action: today's Daily Challenge, with the stars already
// banked today, today's best, and the Daily streak (days in a row with a
// finished Daily). One tap starts the round.
export function DailyButton({ stars, best, streak, onPlay }: {
  stars: number;
  best: number | null;
  streak: number;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="w-full rounded-2xl bg-[#36D7B7] hover:bg-[#2ec2a6] active:scale-[0.99] text-[#0f1117] px-4 py-3.5 shadow-[0_8px_24px_rgba(54,215,183,0.25)] transition text-left"
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
  );
}
