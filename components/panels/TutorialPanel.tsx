"use client";

import { useEffect, useRef, useState } from "react";
import { createDemoHole, DEMO_W, DEMO_H } from "../game/demoHole";
import { btn } from "./ui";

// How to Play: an auto-playing demo where an imaginary player takes on a hole
// start to finish — pulling back to aim, throwing, switching discs and sinking
// the putt. A small looping canvas animation; the caption tracks each step.
export function TutorialPanel({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [caption, setCaption] = useState("An imaginary player takes on a hole…");
  const capRef = useRef("");
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const demo = createDemoHole(ctx);
    let raf = 0;
    const startT = performance.now();
    const render = (now: number) => {
      const cap = demo.frame((now - startT) % demo.total, now, true);
      if (capRef.current !== cap) { capRef.current = cap; setCaption(cap); }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">How to Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <canvas ref={canvasRef} width={DEMO_W} height={DEMO_H} className="w-full rounded-xl border border-white/10 bg-[#2f5a26]" style={{ imageRendering: "pixelated" }} />
        <p className="text-gray-200 text-sm font-medium min-h-[40px] leading-snug flex items-center justify-center">{caption}</p>
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Got it ✓</button>
      </div>
    </div>
  );
}
