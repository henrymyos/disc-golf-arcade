"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseStars, courseDifficultyOf, courseStarDifficulty, type Mode } from "@/lib/discgolf/engine";
import type { CourseInfo } from "../game/courses";
import { DiffStars } from "./ui";

export function CoursesPanel({ courses, tourCourses, bests, tourBests, onClose, onPlay }: {
  courses: CourseInfo[];
  tourCourses: CourseInfo[];
  bests: Record<string, number | null>;
  tourBests: Record<number, number>;
  onClose: () => void;
  onPlay: (m: Mode, seed?: number) => void;
}) {
  const [tab, setTab] = useState<"championship" | "tour">("championship");
  const scrollRef = useRef<HTMLDivElement>(null); // the tab list's scroll region
  // Both tabs share one scroll container, so without this a long Pro Tour scroll
  // would carry over to the short Championship list and leave it scrolled out of
  // view (blank). Jump back to the top whenever the tab changes.
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`;
  const bestFor = (c: CourseInfo) => (c.seed != null ? tourBests[c.seed] ?? null : bests[c.mode] ?? null);
  // Sort each tab easiest → hardest by intrinsic difficulty.
  const byDiff = (cs: CourseInfo[]) => cs.map((c) => ({ c, d: courseDifficultyOf(c.mode, c.seed) })).sort((a, b) => a.d - b.d);
  const champ = useMemo(() => byDiff(courses), [courses]);
  const tourL = useMemo(() => byDiff(tourCourses), [tourCourses]);
  const list = tab === "championship" ? champ : tourL;
  const card = ({ c }: { c: CourseInfo }) => {
    const best = bestFor(c);
    const stars = courseStars(best, c.par);
    const diff = courseStarDifficulty(c.mode, c.seed);
    return (
      <div key={c.seed != null ? `tour-${c.seed}` : c.mode} className="rounded-xl bg-[#1a1d23] border border-white/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-white font-bold text-sm truncate pt-0.5">{c.name}</span>
          <div className="shrink-0 text-right">
            <DiffStars n={diff} />
            <span className="block text-gray-500 text-[10px] mt-0.5">{c.holes} holes · par {c.par}</span>
          </div>
        </div>
        <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{c.blurb}</p>
        <div className="flex items-center justify-between mt-2.5">
          <div className="min-w-0">
            <div className="text-sm leading-none tracking-wide" aria-label={`${stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < stars ? "text-[#f5d24a]" : "text-white/15"}>★</span>
              ))}
            </div>
            <span className="block text-[10px] text-gray-500 mt-1">
              {best != null ? <>Best <span className="text-[#36D7B7] font-bold">{best}</span> ({over(best - c.par)})</> : "Not played yet"}
            </span>
          </div>
          <button type="button" onClick={() => onPlay(c.mode, c.seed)} className="shrink-0 rounded-lg bg-[#36D7B7] hover:bg-[#2ec2a6] text-[#0f1117] text-sm font-bold px-5 py-1.5 transition">Play</button>
        </div>
      </div>
    );
  };
  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">Challenge the Arcade</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1 mt-3 shrink-0">
          <button type="button" onClick={() => setTab("championship")} className={seg(tab === "championship")}>Championship</button>
          <button type="button" onClick={() => setTab("tour")} className={seg(tab === "tour")}>🏆 Tour Venues</button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto mt-2 space-y-2.5 pr-0.5 -mr-0.5">
          {list.map(({ c }) => card({ c }))}
        </div>
      </div>
    </div>
  );
}
