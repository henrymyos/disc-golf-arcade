"use client";

import { useEffect, useRef } from "react";
import { createDemoHole, DEMO_W, DEMO_H } from "../game/demoHole";

// The How to Play demo hole as the title screen's hero: a muted loop of a disc
// flying from the tee to the basket, so a first visit shows a course and a
// throw. The demo is portrait; here it's turned on its side (tee left, basket
// right) and trimmed to the fairway (the empty rough either side is dropped),
// so the whole hole reads in a short strip under the title instead of hiding
// behind the menu. It stops drawing while the tab is hidden, and under
// prefers-reduced-motion it paints a single still frame (mid-approach).
const STILL_AT_MS = 9_400;
// The part of the demo canvas that holds the hole: x 66..174 (fairway + trees +
// pond) by y 22..268 (basket to just behind the tee).
const SRC = { x0: 66, x1: 174, y0: 22, y1: 268 };
const STRIP_W = SRC.y1 - SRC.y0; // 246: the hole's length runs left → right
const STRIP_H = SRC.x1 - SRC.x0; // 108

export function AttractBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const off = document.createElement("canvas");
    off.width = DEMO_W;
    off.height = DEMO_H;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    const demo = createDemoHole(offCtx);
    ctx.imageSmoothingEnabled = false;
    // Demo (x, y) → strip (y1 − y, x − x0): the tee (bottom) lands on the left.
    const paint = (tt: number, now: number) => {
      demo.frame(tt, now, false);
      ctx.setTransform(0, 1, -1, 0, SRC.y1, -SRC.x0);
      ctx.drawImage(off, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      paint(STILL_AT_MS, 0);
      return;
    }
    let raf = 0;
    let offset = 0;      // ms of loop already played before the last pause
    let startT = 0;
    const render = (now: number) => {
      paint((offset + now - startT) % demo.total, now);
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
  const feather = "linear-gradient(to right, transparent, #000 9%, #000 91%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)";
  return (
    <canvas
      ref={canvasRef}
      width={STRIP_W}
      height={STRIP_H}
      data-attract
      aria-hidden
      className="pointer-events-none block w-full"
      style={{
        imageRendering: "pixelated",
        aspectRatio: `${STRIP_W} / ${STRIP_H}`,
        // Feather every edge so the strip melts into the menu background.
        maskImage: feather,
        WebkitMaskImage: feather,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    />
  );
}
