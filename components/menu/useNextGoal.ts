"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { levelFromXp, playerXp } from "@/lib/discgolf/profile";
import { levelUpChoices } from "@/lib/discgolf/engine";
import type { EventRound } from "@/lib/discgolf/events";
import { nextGoal, goalComplete, dailyStreak, finishedDailyDays, type Goal, type GoalProgress } from "@/lib/discgolf/goals";

// The menu's Next goal, the Daily streak, and a toast when a finished round
// completes the goal. `roundSerial` goes up by one each time a full round is
// recorded; only then can a goal change count as "completed" (so loading a save
// or syncing from the cloud never fires a toast).
export function useNextGoal({ roundsPlayed, unlocked, owned, discsOwned, history, todayStars, today, dayBests, dayStars, roundSerial, onComplete }: {
  roundsPlayed: number;
  unlocked: string[];
  owned: string[];
  discsOwned: number;
  history: EventRound[];
  todayStars: number;
  today: number;
  dayBests: Record<string, number>;
  dayStars: Record<string, number>;
  roundSerial: number;
  onComplete: () => void;
}): { goal: Goal | null; streak: number; toast: Goal | null } {
  const progress = useMemo((): GoalProgress => {
    const level = levelFromXp(playerXp(roundsPlayed, unlocked.length, discsOwned));
    return {
      level,
      nextLevelHasDisc: levelUpChoices(level.level + 1, unlocked, owned).length > 0,
      achievements: unlocked,
      rounds: history,
      roundsPlayed,
      todayStars,
    };
  }, [roundsPlayed, unlocked, discsOwned, owned, history, todayStars]);
  const goal = useMemo(() => (today ? nextGoal(progress) : null), [progress, today]);
  const streak = useMemo(() => (today ? dailyStreak(finishedDailyDays(dayBests, dayStars), today) : 0), [dayBests, dayStars, today]);

  const [toast, setToast] = useState<Goal | null>(null);
  const prevGoal = useRef<Goal | null>(null);
  const handledSerial = useRef(roundSerial);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const prev = prevGoal.current;
    prevGoal.current = goal;
    if (roundSerial === handledSerial.current) return; // no new round since the last check
    if (!prev || prev.id === goal?.id) return;
    handledSerial.current = roundSerial;
    if (!goalComplete(prev, progress)) return;
    setToast(prev);
    completeRef.current();
  }, [goal, progress, roundSerial]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  return { goal, streak, toast };
}
