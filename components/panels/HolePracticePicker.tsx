"use client";

import { useMemo, useState } from "react";
import { HOLEBEST_KEY, courseHoleBestKey, readCourseHoleBest } from "@/lib/progress";
import { courseHoles, type Mode } from "@/lib/discgolf/engine";
import { FIXED_COURSES, TOUR_COURSE_INFOS, type CourseInfo } from "../game/courses";
import { titleCardSm } from "./ui";


// Wind presets for reps in set conditions (mph; null = the course's own wind).
const PRACTICE_WINDS: [string, number | null][] = [["Course", null], ["Calm", 0], ["8", 8], ["15", 15], ["22", 22]];

// Pick any hole on either course and grind it — practice rounds don't count
// toward bests, history, achievements, or leaderboards.
// Hole Practice picker — an inline sub-page of the Practice hub (so the logo +
// profile stay above it, matching the other screens). Pick any hole on any premade
// course; the round runs as pure practice (no bests / history / boards).
export function HolePracticePicker({ onBack, onPick }: {
  onBack: () => void;
  onPick: (m: Mode, holeIdx: number, seed: number | undefined, windMph: number | null) => void;
}) {
  // Every premade course — the two championship layouts + every pro-tour venue.
  const allCourses = useMemo(() => [...FIXED_COURSES, ...TOUR_COURSE_INFOS], []);
  const [course, setCourse] = useState<CourseInfo>(allCourses[0]);
  const [wind, setWind] = useState<number | null>(null); // mph; null = the course's own wind
  // Per-hole bests (Glendoveer + every other premade course), read once when the page opens.
  const [holeBest] = useState<(number | null)[]>(() => {
    try {
      const hb = JSON.parse(localStorage.getItem(HOLEBEST_KEY) || "null");
      return Array.isArray(hb) ? hb : [];
    } catch { return []; }
  });
  const [courseBests] = useState(readCourseHoleBest);
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
      <div className="flex items-center gap-1.5" role="group" aria-label="Practice wind">
        <span className="text-gray-400 text-[11px] font-bold mr-0.5 whitespace-nowrap">Wind (mph)</span>
        {PRACTICE_WINDS.map(([label, mph]) => (
          <button key={label} type="button" aria-label={mph ? `${mph} mph` : undefined} aria-pressed={wind === mph} onClick={() => setWind(mph)}
            className={`min-h-[44px] sm:min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${wind === mph ? "bg-[#36D7B7] text-[#0f1117]" : "bg-[#1a1d23] border border-white/10 text-gray-300 hover:border-white/25"}`}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-gray-500 text-[11px]">{course.name} · pick a hole — practice doesn&apos;t count toward bests or boards.</p>
      <div className="grid grid-cols-3 gap-1.5">
        {holes.map((h, i) => {
          const ck = courseHoleBestKey(course.mode, course.seed);
          const best = course.mode === "course" ? holeBest[i] : ck ? courseBests[ck]?.[i] : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(course.mode, i, course.seed, wind)}
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
