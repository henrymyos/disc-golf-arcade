"use client";

import { useMemo, useState } from "react";
import { HOLEBEST_KEY } from "@/lib/progress";
import { courseHoles, type Mode } from "@/lib/discgolf/engine";
import { FIXED_COURSES, TOUR_COURSE_INFOS, type CourseInfo } from "../game/courses";
import { titleCardSm } from "./ui";


// Pick any hole on either course and grind it — practice rounds don't count
// toward bests, history, achievements, or leaderboards.
// Hole Practice picker — an inline sub-page of the Practice hub (so the logo +
// profile stay above it, matching the other screens). Pick any hole on any premade
// course; the round runs as pure practice (no bests / history / boards).
export function HolePracticePicker({ onBack, onPick }: {
  onBack: () => void;
  onPick: (m: Mode, holeIdx: number, seed?: number) => void;
}) {
  // Every premade course — the two championship layouts + every pro-tour venue.
  const allCourses = useMemo(() => [...FIXED_COURSES, ...TOUR_COURSE_INFOS], []);
  const [course, setCourse] = useState<CourseInfo>(allCourses[0]);
  // Glendoveer per-hole bests, read once when the page opens.
  const [holeBest] = useState<(number | null)[]>(() => {
    try {
      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      return Array.isArray(hb) ? hb : [];
    } catch { return []; }
  });
  const key = (c: CourseInfo) => (c.seed != null ? `tour-${c.seed}` : c.mode);
  const holes = courseHoles(course.mode, course.seed);
  return (
    <div className="w-full flex flex-col gap-2 text-left">
      <button type="button" onClick={onBack} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>
      {/* Course picker — all premade courses */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
        {allCourses.map((c) => {
          const sel = key(c) === key(course);
          return (
            <button key={key(c)} type="button" onClick={() => setCourse(c)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${sel ? "bg-[#36D7B7] text-[#0f1117]" : "bg-[#1a1d23] border border-white/10 text-gray-300 hover:border-white/25"}`}>
              {c.name}
            </button>
          );
        })}
      </div>
      <p className="text-gray-500 text-[11px]">{course.name} · pick a hole — practice doesn&apos;t count toward bests or boards.</p>
      <div className="grid grid-cols-3 gap-1.5">
        {holes.map((h, i) => {
          const best = course.mode === "course" ? holeBest[i] : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(course.mode, i, course.seed)}
              className="rounded-lg bg-[#1a1d23] border border-white/10 hover:border-[#36D7B7]/60 px-2 py-2 text-left transition"
            >
              <span className="block text-white font-bold text-sm leading-none">{i + 1}</span>
              <span className="block text-gray-500 text-[10px] mt-1">
                par {h.par}{best != null ? ` · best ${best}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
