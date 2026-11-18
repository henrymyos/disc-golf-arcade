"use client";

import type { Goal } from "@/lib/discgolf/goals";

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
