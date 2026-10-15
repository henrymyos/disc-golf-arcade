"use client";

import { useState } from "react";
import { fmtCoins } from "@/lib/discgolf/wallet";
import { weekSeed } from "@/lib/discgolf/ranked";
import {
  dailyChallenges, weeklyChallenges, roundsThisDay, roundsThisWeek, dailyClaimKey, eventClaimKey, type Challenge, type EventRound,
} from "@/lib/discgolf/events";
import { Coin } from "./ui";


// Recurring challenges that pay coins: easy DAILY objectives (reset each day)
// and harder WEEKLY ones (reset each week). Progress is read from saved round
// history; claims are marked in the owned set so they survive a refresh and
// can't be claimed twice.
export function ChallengesPanel({ history, owned, coins, today, onClaim, onClose }: {
  history: EventRound[];
  owned: string[];
  coins: number;
  today: number; // current day number
  onClaim: (claimKey: string, reward: number) => void;
  onClose: () => void;
}) {
  const [week] = useState(() => weekSeed(Date.now()));
  const dayRows = roundsThisDay(history, today);
  const weekRows = roundsThisWeek(history, week);
  const row = (c: Challenge, rows: EventRound[], claimKey: string) => {
    const have = Math.min(c.measure(rows), c.goal);
    const done = have >= c.goal;
    const claimed = owned.includes(claimKey);
    const pct = Math.round((have / c.goal) * 100);
    return (
      <div key={c.id} className="bg-[#1a1d23] border border-white/10 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none shrink-0">{c.emoji}</span>
          <span className="text-white font-semibold text-xs flex-1 truncate">{c.desc}</span>
          <span className="text-[#f5d24a] font-bold text-[10px] shrink-0 inline-flex items-center gap-0.5">+{c.reward} <Coin className="!w-2 !h-2" /></span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
            <div className="h-full rounded bg-[#36D7B7]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-gray-400 font-mono text-[9px] w-8 text-right">{have}/{c.goal}</span>
          {claimed ? (
            <span className="shrink-0 text-[10px] font-bold text-[#36D7B7] w-14 text-center">Claimed ✓</span>
          ) : (
            <button
              type="button"
              onClick={() => onClaim(claimKey, c.reward)}
              disabled={!done}
              className="shrink-0 w-14 rounded-md bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] text-[10px] font-bold py-1 disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500"
            >
              {done ? "Claim" : "Locked"}
            </button>
          )}
        </div>
      </div>
    );
  };
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-1.5 my-auto text-left">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-white font-black text-xl">Challenges</h2>
          <div className="flex items-center gap-2">
            <span className="text-[#f5d24a] font-bold font-mono text-sm inline-flex items-center gap-1">{fmtCoins(coins)} <Coin /></span>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Daily — light objectives, reset every day */}
        <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">Daily · resets at midnight</p>
        {dailyChallenges(today).map((c) => row(c, dayRows, dailyClaimKey(today, c.id)))}

        {/* Weekly — harder objectives, reset every week */}
        <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide pt-0.5">Weekly · resets Monday</p>
        {weeklyChallenges(week).map((c) => row(c, weekRows, eventClaimKey(week, c.id)))}

      </div>
    </div>
  );
}
