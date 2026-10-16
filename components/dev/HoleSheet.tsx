"use client";

// DEV ONLY (never in a production build): /?holesheet=<course-id> draws all 18
// holes of a Pro Tour course whole, side by side, at ONE scale, with a 100 ft
// grid from the tee — using the exact same drawing code as play (drawRough,
// drawHoleFeatures, drawBasket, drawTree). Nova screenshots it to compare each
// hole with its caddie-book page. Use ?holesheet=all for all 54 holes.
import { useEffect, useRef } from "react";
import { PROTOUR_COURSES, proTourCourseById, type Hole, type ProTourCourse } from "@/lib/discgolf/engine";
import { GROUND_THEMES, cosmeticByKey } from "@/lib/discgolf/cosmetics";
import { drawRough, drawHoleFeatures, drawBasket, drawTree, treeStyleFor } from "../game/draw";

const FT = 1.8; // world px → feet (FEET_PER_PX)
const SCALE = 0.42; // screen px per world px, the same for every hole on the sheet

function HoleCanvas({ hole }: { hole: Hole }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ww = hole.worldW ?? 320, wh = hole.worldH;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cv.width = Math.round(ww * SCALE * dpr);
    cv.height = Math.round(wh * SCALE * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
    const ground = cosmeticByKey(GROUND_THEMES, hole.theme ?? "classic") ?? GROUND_THEMES[0];
    drawRough(ctx, hole, ground, 0, ww, wh);
    drawHoleFeatures(ctx, hole, ground, 0);
    drawBasket(ctx, hole.basket.x, hole.basket.y);
    const style = treeStyleFor(hole.theme);
    for (const t of hole.trees) drawTree(ctx, t, style);
    // 100 ft grid, anchored on the tee.
    const step = 100 / FT;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1 / SCALE;
    ctx.beginPath();
    for (let x = hole.tee.x % step; x <= ww; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, wh); }
    for (let y = hole.tee.y; y >= 0; y -= step) { ctx.moveTo(0, y); ctx.lineTo(ww, y); }
    ctx.stroke();
    // Tee and basket markers on top of everything.
    ctx.fillStyle = "#f5d24a";
    ctx.font = `bold ${14 / SCALE / 1.6}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("T", hole.tee.x, hole.tee.y + 22);
    ctx.strokeStyle = "#f5d24a";
    ctx.lineWidth = 2 / SCALE;
    ctx.beginPath();
    ctx.arc(hole.basket.x, hole.basket.y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }, [hole, ww, wh]);
  return <canvas ref={ref} style={{ width: ww * SCALE, height: wh * SCALE }} className="block rounded" />;
}

function CourseSheet({ c }: { c: ProTourCourse }) {
  return (
    <section className="mb-8">
      <h2 className="text-white font-black text-lg">
        {c.course.name} <span className="text-gray-400 font-bold text-sm">· {c.course.layoutLabel} · par {c.par} · {c.lengthFt.toLocaleString("en-US")} ft · 100 ft grid · {SCALE} px per world px</span>
      </h2>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        {c.holes.map((h, i) => {
          const ph = c.course.holes[i];
          return (
            <figure key={i} className="bg-[#1a1d23] border border-white/10 rounded-lg p-1.5" data-hole={i + 1}>
              <figcaption className="text-[11px] text-gray-300 font-mono mb-1">
                <b className="text-white">{i + 1}</b> · par {ph.par} · {ph.lengthFt} ft{ph.layout ? ` · ${ph.layout}` : ""} · p.{ph.ref.page}
              </figcaption>
              <HoleCanvas hole={h} />
            </figure>
          );
        })}
      </div>
    </section>
  );
}

export default function HoleSheet({ courseId }: { courseId: string }) {
  const list = courseId === "all" ? PROTOUR_COURSES : [proTourCourseById(courseId)].filter((c): c is ProTourCourse => !!c);
  return (
    <main className="min-h-screen bg-[#0f1117] p-4 text-left">
      <p className="text-[#e08a3b] text-xs font-bold uppercase tracking-wide mb-3">Dev hole sheet (not in production builds)</p>
      {list.length === 0 && (
        <p className="text-gray-300 text-sm">Unknown course. Try {PROTOUR_COURSES.map((c) => c.course.id).join(", ")} or all.</p>
      )}
      {list.map((c) => <CourseSheet key={c.seed} c={c} />)}
    </main>
  );
}
