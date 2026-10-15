"use client";

import { useEffect, useRef } from "react";
import { createDemoHole, DEMO_W, DEMO_H } from "../game/demoHole";

// The How to Play demo hole, looping silently behind the title so a first visit
// shows a course, a disc and a throw instead of a blank page. It never makes a
// sound, stops drawing while the tab is hidden, and under
// prefers-reduced-motion paints a single still frame (mid-approach) instead.
const STILL_AT_MS = 9_400; // a frame with the approach shot in the air

export function AttractBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const demo = createDemoHole(ctx);
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      demo.frame(STILL_AT_MS, 0, false);
      return;
    }
    let raf = 0;
    let offset = 0;      // ms of loop already played before the last pause
    let startT = 0;
    const render = (now: number) => {
      demo.frame((offset + now - startT) % demo.total, now, false);
      raf = requestAnimationFrame(render);
    };
    const start = () => {
      if (raf) return;
      startT = performance.now();
      raf = requestAnimationFrame(render);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      offset += performance.now() - startT;
    };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    if (!document.hidden) start();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        width={DEMO_W}
        height={DEMO_H}
        data-attract
        // Cover the menu column; only the hole area (top ~270px of the demo) matters.
        className="absolute left-1/2 top-0 h-[78%] max-h-[620px] -translate-x-1/2 opacity-70"
        style={{ imageRendering: "pixelated", aspectRatio: `${DEMO_W} / 270`, objectFit: "cover", objectPosition: "top" }}
      />
      {/* Fade the hole into the menu background so the buttons stay readable. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#141926]/25 from-10% via-[#141926]/70 via-45% to-[#0f1117] to-75%" />
    </div>
  );
}
