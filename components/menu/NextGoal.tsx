"use client";

import type { Goal } from "@/lib/discgolf/goals";

// The menu's "Next goal" card: the closest thing to chase right now.
export function NextGoalCard({ goal }: { goal: Goal }) {
  const pct = Math.round(goal.progress * 100);
  return (
    <div className="w-full rounded-xl border border-[#f5d24a]/30 bg-[#f5d24a]/[0.06] px-3 py-2.5 text-left" aria-label="Next goal">
      <div className="flex items-center gap-2.5">
        <span className="text-xl leading-none shrink-0" aria-hidden>{goal.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#f5d24a]/80">Next goal</p>
          <p className="text-white text-sm font-bold leading-tight truncate">{goal.title}</p>
          <p className="text-gray-400 text-[11px] leading-tight truncate">{goal.detail}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded bg-[#f5d24a]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// A short toast when a goal is completed (shown over whatever screen is up).
export function GoalToast({ goal }: { goal: Goal }) {
  return (
    <div role="status" className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[70] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-[#f5d24a]/60 bg-[#1a1d23] px-4 py-2 shadow-lg">
        <span aria-hidden>{goal.emoji}</span>
        <span className="text-sm font-bold text-white">Goal complete: {goal.title}</span>
      </div>
    </div>
  );
}
