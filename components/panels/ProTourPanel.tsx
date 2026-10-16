"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseStars, proTourCourseById, type ProTourCourse } from "@/lib/discgolf/engine";
import { SEASON_2026, type ProStop, type ProTier } from "@/lib/discgolf/protour/season2026";
import type { ProHole } from "@/lib/discgolf/protour/types";
import { roundLayout } from "@/lib/discgolf/layout";

// "2026 Pro Tour": the real season, stop by stop, with the built courses playable
// hole by hole (facts from each event's public caddie book, drawn in our style).

export const FAN_NOTE = "Fan-made. Not affiliated with the DGPT, PDGA or the courses.";

const fmtFt = (n: number) => n.toLocaleString("en-US");
const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
// The course a stop opens on: the first built one (multi-course events list the
// final-round course last, but only built courses can be opened).
const builtCourses = (s: ProStop): ProTourCourse[] =>
  s.courses.filter((c) => c.built).map((c) => proTourCourseById(c.id)).filter((c): c is ProTourCourse => !!c);
export const PRO_STOPS_BUILT = SEASON_2026.filter((s) => builtCourses(s).length > 0).length;

function TierBadge({ tier }: { tier: ProTier }) {
  if (tier === "Major") return <span className="rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wide bg-[#f5d24a] text-[#0f1117]">Major</span>;
  if (tier === "Playoffs") return <span className="rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wide bg-[#e08a3b] text-[#0f1117]">Playoffs</span>;
  if (tier === "Elite+") return <span className="rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wide border border-[#36D7B7] text-[#36D7B7]">Elite+</span>;
  return <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-gray-500 border border-white/10">Elite</span>;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-sm leading-none tracking-wide" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? "text-[#f5d24a]" : "text-white/15"}>★</span>)}
    </span>
  );
}

// A tiny top-down drawing of one hole, straight from its data: the corridor,
// any water, the island green, tee and basket. Never an image from the book.
export function HoleGlyph({ h, w = 24, hgt = 36 }: { h: ProHole; w?: number; hgt?: number }) {
  const half = h.widthFt / 2;
  const xs = h.line.map((p) => p.x), ys = h.line.map((p) => p.y);
  const x0 = Math.min(...xs) - half, x1 = Math.max(...xs) + half;
  const y0 = -half * 0.6, y1 = Math.max(...ys) + half * 0.6;
  const k = Math.min(w / (x1 - x0), hgt / (y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2, oy = (hgt - (y1 - y0) * k) / 2;
  const X = (x: number) => ox + (x - x0) * k;
  const Y = (y: number) => hgt - oy - (y - y0) * k;
  const path = h.line.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(" ");
  const b = h.line[h.line.length - 1];
  return (
    <svg width={w} height={hgt} viewBox={`0 0 ${w} ${hgt}`} aria-hidden className="shrink-0">
      <rect width={w} height={hgt} rx={3} fill="#2b5323" />
      <defs><clipPath id={`gl-${h.n}-${h.lengthFt}`}><rect width={w} height={hgt} rx={3} /></clipPath></defs>
      <g clipPath={`url(#gl-${h.n}-${h.lengthFt})`}>
        <path d={path} stroke="#eef1e6" strokeWidth={h.widthFt * k} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={path} stroke="#4d9a39" strokeWidth={Math.max(1, h.widthFt * k - 1)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {(h.water ?? []).map((r, i) => <rect key={i} x={X(r.x)} y={Y(r.y + r.h)} width={r.w * k} height={r.h * k} fill="#3a6ea5" />)}
        {(h.obZones ?? []).map((r, i) => <rect key={`o${i}`} x={X(r.x)} y={Y(r.y + r.h)} width={r.w * k} height={r.h * k} fill="#2b5323" />)}
        {h.islandGreen && <circle cx={X(b.x)} cy={Y(b.y)} r={2.6} fill="#4d9a39" stroke="#eef1e6" strokeWidth={0.6} />}
        <circle cx={X(0)} cy={Y(0)} r={1.4} fill="#caa46a" />
        <circle cx={X(b.x)} cy={Y(b.y)} r={1.3} fill="#f5d24a" />
      </g>
    </svg>
  );
}

function StopCard({ s, bests, active, onOpen }: { s: ProStop; bests: Record<number, number>; active: boolean; onOpen: (s: ProStop) => void }) {
  const built = builtCourses(s);
  const c = built[0];
  const best = c ? bests[c.seed] ?? null : null;
  const where = s.courses.map((x) => x.name).join(" + ");
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wide">Stop {s.stop} · {s.dates}</span>
          <TierBadge tier={s.tier} />
        </span>
        {c ? <span className="shrink-0 text-gray-400 text-[10px] font-mono">par {c.par} · {fmtFt(c.lengthFt)} ft</span> : <span className="shrink-0 text-gray-500 text-[10px] font-semibold">Coming later</span>}
      </div>
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <div className="min-w-0">
          <span className="block text-white font-bold text-sm truncate">{s.event}</span>
          <span className="block text-gray-400 text-[11px] truncate">{where} · {s.city}</span>
        </div>
        {c && (
          <div className="shrink-0 text-right">
            <Stars n={courseStars(best, c.par)} />
            <span className="block text-[10px] text-gray-500 mt-0.5">{best != null ? <>Best <b className="text-[#36D7B7]">{best}</b> ({over(best - c.par)})</> : "Not played"}</span>
          </div>
        )}
      </div>
    </>
  );
  if (!c) {
    return <div className="rounded-xl bg-[#1a1d23] border border-white/5 p-3 opacity-45" aria-disabled="true" data-stop={s.stop}>{body}</div>;
  }
  return (
    <button type="button" onClick={() => onOpen(s)} data-stop={s.stop}
      className={`w-full text-left rounded-xl bg-[#1a1d23] border p-3 transition ${active ? "border-[#36D7B7]" : "border-[#36D7B7]/40 hover:border-[#36D7B7]"}`}>
      {body}
    </button>
  );
}

function CourseDetail({ s, courseId, setCourseId, bests, onBack, onPlay, onPractice, wide }: {
  s: ProStop; courseId: string; setCourseId: (id: string) => void; bests: Record<number, number>;
  onBack?: () => void; onPlay: (seed: number) => void; onPractice: (seed: number, hole: number) => void; wide: boolean;
}) {
  const c = proTourCourseById(courseId) ?? builtCourses(s)[0];
  const listRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);
  if (!c) return null;
  const holes = c.course.holes;
  const waterHoles = holes.filter((h) => (h.water ?? []).length > 0).length;
  const islands = holes.filter((h) => h.islandGreen).length;
  const best = bests[c.seed] ?? null;
  const chip = "rounded-md bg-[#0f1117] border border-white/10 px-2 py-1 text-[11px] text-gray-300";
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        {onBack && <button type="button" onClick={onBack} className="text-[#36D7B7] text-sm font-bold hover:underline">‹ Season</button>}
        <p className={`text-gray-400 text-[10px] font-bold uppercase tracking-wide ${onBack ? "mt-2" : ""}`}>Stop {s.stop} · {s.dates} · {s.event}</p>
        <h3 className="text-white font-black text-xl leading-tight">{c.course.name}</h3>
        <p className="text-gray-400 text-[11px]">{c.course.city} · {c.course.layoutLabel}</p>
        {s.courses.length > 1 && (
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1 mt-2" role="tablist" aria-label="Course">
            {s.courses.map((x) => (
              <button key={x.id} type="button" disabled={!x.built} onClick={() => x.built && setCourseId(x.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition ${x.id === c.course.id ? "bg-[#36D7B7] text-[#0f1117]" : x.built ? "text-gray-300 hover:text-white" : "text-gray-600 cursor-not-allowed"}`}>
                {x.name}{x.built ? "" : " · later"}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={chip}>Par <b className="text-white">{c.par}</b></span>
          <span className={chip}><b className="text-white">{fmtFt(c.lengthFt)}</b> ft</span>
          <span className={chip}><b className="text-white">{waterHoles}</b> water holes</span>
          <span className={chip}><b className="text-white">{islands}</b> island green{islands === 1 ? "" : "s"}</span>
          <span className={chip}>{best != null ? <>Best <b className="text-[#36D7B7]">{best}</b> ({over(best - c.par)})</> : "Not played"} <Stars n={courseStars(best, c.par)} /></span>
        </div>
        {hint && <p className="text-[#36D7B7] text-[11px] mt-2">Tap a hole to practice it.</p>}
      </div>
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-1 pr-0.5" data-testid="pt-holes">
        {holes.map((h, i) => (
          <button key={h.n} type="button" onClick={() => onPractice(c.seed, i)} data-hole={h.n}
            className="w-full flex items-center gap-2.5 rounded-lg bg-[#1a1d23] border border-white/5 hover:border-[#36D7B7]/60 px-2 py-1.5 text-left transition">
            <span className="w-5 text-right text-white font-black text-sm">{h.n}</span>
            <HoleGlyph h={h} />
            <span className="w-16 shrink-0 text-[11px] text-gray-300 font-mono leading-tight">par {h.par}<br />{h.lengthFt} ft</span>
            <span className="min-w-0 text-[11px] text-gray-400 leading-snug">{h.note}{h.layout ? <span className="text-gray-600"> · {h.layout} pin</span> : null}</span>
          </button>
        ))}
        <p className="text-gray-600 text-[10px] pt-2 pb-1 leading-snug">
          Pars and lengths from the {s.event} caddie book; holes hand-drawn in the game&apos;s style. Mandatory routes aren&apos;t enforced yet.
        </p>
      </div>
      <div className={`shrink-0 flex gap-2 pt-2 ${wide ? "" : "sticky bottom-0 bg-[#0f1117]"}`}>
        <button type="button" onClick={() => onPlay(c.seed)} className="flex-1 rounded-lg bg-[#36D7B7] hover:bg-[#2ec2a6] text-[#0f1117] font-black py-2.5 transition">Play 18</button>
        <button type="button" onClick={() => { setHint(true); listRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="rounded-lg border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] text-white text-sm font-bold px-4 py-2.5 transition">Practice a hole</button>
      </div>
    </div>
  );
}

export function ProTourPanel({ bests, onClose, onPlay, onPractice }: {
  bests: Record<number, number>;
  onClose: () => void;
  onPlay: (seed: number) => void;
  onPractice: (seed: number, holeIdx: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | "playable" | "majors">("all");
  const [open, setOpen] = useState<{ stop: number; courseId: string } | null>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const update = () => setWide(roundLayout(window.innerWidth, window.innerHeight).sides);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const stops = useMemo(() => SEASON_2026.filter((s) => (filter === "playable" ? builtCourses(s).length > 0 : filter === "majors" ? s.tier === "Major" : true)), [filter]);
  const openStop = (s: ProStop) => setOpen({ stop: s.stop, courseId: builtCourses(s)[0].course.id });
  // Desktop opens the first playable stop on the right so the pane is never empty.
  const firstBuilt = SEASON_2026.find((s) => builtCourses(s).length > 0)!;
  const shown = open ?? (wide ? { stop: firstBuilt.stop, courseId: builtCourses(firstBuilt)[0].course.id } : null);
  const shownStop = shown ? SEASON_2026.find((s) => s.stop === shown.stop) : undefined;
  const seg = (on: boolean) => `flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${on ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`;

  const list = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-white font-black text-xl">2026 Pro Tour</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
      </div>
      <p className="text-gray-400 text-[11px] shrink-0">The real 2026 season, hole by hole. MPO layouts.</p>
      <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1 mt-2.5 shrink-0" role="tablist" aria-label="Filter">
        <button type="button" onClick={() => setFilter("all")} className={seg(filter === "all")}>All</button>
        <button type="button" onClick={() => setFilter("playable")} className={seg(filter === "playable")}>Playable</button>
        <button type="button" onClick={() => setFilter("majors")} className={seg(filter === "majors")}>Majors</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-2 pr-0.5" data-testid="pt-stops">
        {stops.map((s) => <StopCard key={s.stop} s={s} bests={bests} active={!!shown && shown.stop === s.stop} onOpen={openStop} />)}
        <p className="text-gray-500 text-[10px] text-center pt-2 pb-1">{FAN_NOTE}</p>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col" data-testid="protour-panel">
      <div className={`w-full mx-auto flex h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left ${wide ? "max-w-4xl gap-5" : "max-w-sm"}`}>
        {wide ? (
          <>
            <div className="w-[22rem] shrink-0 min-h-0">{list}</div>
            <div className="flex-1 min-w-0 min-h-0 border-l border-white/10 pl-5">
              {shownStop && shown && (
                <CourseDetail key={shown.courseId} s={shownStop} courseId={shown.courseId} setCourseId={(id) => setOpen({ stop: shown.stop, courseId: id })}
                  bests={bests} onPlay={onPlay} onPractice={onPractice} wide />
              )}
            </div>
          </>
        ) : shownStop && shown ? (
          <div className="w-full min-h-0">
            <CourseDetail key={shown.courseId} s={shownStop} courseId={shown.courseId} setCourseId={(id) => setOpen({ stop: shown.stop, courseId: id })}
              bests={bests} onBack={() => setOpen(null)} onPlay={onPlay} onPractice={onPractice} wide={false} />
          </div>
        ) : (
          <div className="w-full min-h-0">{list}</div>
        )}
      </div>
    </div>
  );
}
