"use client";

import { useEffect, useRef, useState } from "react";
import { drawTree, drawBasket } from "../game/draw";
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
    const DW = 240, DH = 366;
    type Pt = { x: number; y: number };
    type Shape = "hyzer" | "flat" | "anny";
    type Stance = "BH" | "FH";
    const basket: Pt = { x: 120, y: 40 };
    const tee: Pt = { x: 120, y: 248 };
    const tree = { x: 118, y: 170, r: 12 };
    const pond = { x: 160, y: 104, rx: 20, ry: 13 };
    const DISCS = [
      { name: "Driver", color: "#e23b3b" },
      { name: "Mid", color: "#f5d24a" },
      { name: "Putter", color: "#36D7B7" },
    ];
    // Each shot pairs a curved flight with the disc / shape (release angle) /
    // stance (backhand vs forehand) that produced it, so the demo shows the effect
    // of every input the player sets before a throw.
    const SHOTS: { from: Pt; ctrl: Pt; to: Pt; di: number; shape: Shape; stance: Stance }[] = [
      { from: tee, ctrl: { x: 154, y: 196 }, to: { x: 133, y: 150 }, di: 0, shape: "anny", stance: "BH" },   // anny bends out to the right around the tree
      { from: { x: 133, y: 150 }, ctrl: { x: 100, y: 104 }, to: { x: 116, y: 76 }, di: 1, shape: "hyzer", stance: "BH" }, // hyzer carves back to the left
      { from: { x: 116, y: 76 }, ctrl: { x: 118, y: 56 }, to: basket, di: 2, shape: "flat", stance: "BH" },  // flat putt straight in
    ];
    const throwIdx = [5, 9, 12]; // BEATS index of each shot's throw
    type Beat = { dur: number; cap: string; kind: "intro" | "aim" | "throw" | "switch" | "select" | "celebrate"; shot: number; teach?: "disc" | "shape" | "throw" };
    const BEATS: Beat[] = [
      { dur: 1000, cap: "An imaginary player takes on a hole", kind: "intro", shot: 0 },
      { dur: 1500, cap: "Tap a disc to choose — drivers bomb, putters control", kind: "select", shot: 0, teach: "disc" },
      { dur: 1500, cap: "Pick your throw — backhand curves left, forehand right", kind: "select", shot: 0, teach: "throw" },
      { dur: 1600, cap: "Set the shot shape — an anny bends the flight right", kind: "select", shot: 0, teach: "shape" },
      { dur: 1500, cap: "Press and drag BACK from the disc to aim and load power", kind: "aim", shot: 0 },
      { dur: 1100, cap: "Release the other way to throw — pull farther = more power", kind: "throw", shot: 0 },
      { dur: 1200, cap: "Closer now — switch to a midrange for control", kind: "switch", shot: 1, teach: "disc" },
      { dur: 1500, cap: "Shape it back with a hyzer — it carves the other way", kind: "select", shot: 1, teach: "shape" },
      { dur: 1300, cap: "Aim and throw the approach", kind: "aim", shot: 1 },
      { dur: 1000, cap: "Lay it up by the basket", kind: "throw", shot: 1 },
      { dur: 1200, cap: "On the green — switch to the putter, flat", kind: "switch", shot: 2, teach: "disc" },
      { dur: 1200, cap: "A gentle pull for the putt…", kind: "aim", shot: 2 },
      { dur: 900, cap: "Sink it!", kind: "throw", shot: 2 },
      { dur: 1800, cap: "Hole complete! 🎉", kind: "celebrate", shot: 2 },
    ];
    const total = BEATS.reduce((s, b) => s + b.dur, 0);
    const qbez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    });
    const easeInOut = (p: number) => p * p * (3 - 2 * p);
    const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
    const norm = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
    // ── On-canvas control strip: the three inputs you set before each throw —
    // the DISC (bag), the ANGLE (shot shape: hyzer / flat / anny) and the STANCE
    // (backhand vs forehand). It mirrors the real in-game controls; the row the
    // current step is teaching gets a pulsing highlight.
    const CHIP_X0 = 42, CHIP_X1 = 232, CHIP_H = 17;
    const ROW_Y = [290, 315, 340];
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const emphasizeRow = (y: number, pulse: number) => {
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.5 * pulse})`;
      ctx.lineWidth = 2; roundRect(CHIP_X0 - 3, y - 3, CHIP_X1 - CHIP_X0 + 6, CHIP_H + 6, 6); ctx.stroke();
    };
    const rowLabel = (label: string, y: number) => {
      ctx.font = "bold 8px ui-monospace, monospace"; ctx.textBaseline = "middle";
      ctx.textAlign = "left"; ctx.fillStyle = "#6b7280"; ctx.fillText(label, 4, y + CHIP_H / 2 - 0.5);
    };
    const drawDiscRow = (y: number, activeDi: number, teach: boolean, pulse: number) => {
      rowLabel("DISC", y);
      const gap = 4, w = (CHIP_X1 - CHIP_X0 - gap * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const x = CHIP_X0 + i * (w + gap), active = i === activeDi;
        ctx.fillStyle = "#1a1d23"; roundRect(x, y, w, CHIP_H, 4); ctx.fill();
        ctx.strokeStyle = active ? DISCS[i].color : "rgba(255,255,255,0.15)"; ctx.lineWidth = active ? 2 : 1; roundRect(x, y, w, CHIP_H, 4); ctx.stroke();
        ctx.fillStyle = DISCS[i].color; ctx.beginPath(); ctx.arc(x + 9, y + CHIP_H / 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = active ? "#fff" : "#9aa4b2"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(DISCS[i].name, x + w / 2 + 5, y + CHIP_H / 2 + 0.5);
      }
      ctx.textAlign = "left";
      if (teach) emphasizeRow(y, pulse);
    };
    const drawSegRow = (y: number, label: string, items: string[], activeIdx: number, accent: string, accentText: string, teach: boolean, pulse: number) => {
      rowLabel(label, y);
      ctx.fillStyle = "#0f1117"; roundRect(CHIP_X0, y, CHIP_X1 - CHIP_X0, CHIP_H, 5); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; roundRect(CHIP_X0, y, CHIP_X1 - CHIP_X0, CHIP_H, 5); ctx.stroke();
      const pad = 2, innerW = CHIP_X1 - CHIP_X0 - pad * 2, gap = 2, w = (innerW - gap * (items.length - 1)) / items.length;
      ctx.font = "bold 8px ui-monospace, monospace"; ctx.textBaseline = "middle";
      for (let i = 0; i < items.length; i++) {
        const x = CHIP_X0 + pad + i * (w + gap), active = i === activeIdx;
        if (active) { ctx.fillStyle = accent; roundRect(x, y + pad, w, CHIP_H - pad * 2, 3.5); ctx.fill(); }
        ctx.fillStyle = active ? accentText : "#9aa4b2"; ctx.textAlign = "center"; ctx.fillText(items[i], x + w / 2, y + CHIP_H / 2 + 0.5);
      }
      ctx.textAlign = "left";
      if (teach) emphasizeRow(y, pulse);
    };

    let raf = 0;
    const startT = performance.now();
    const render = (now: number) => {
      const tt = (now - startT) % total;
      let acc = 0, bi = 0, p = 0;
      for (let i = 0; i < BEATS.length; i++) {
        if (tt < acc + BEATS[i].dur) { bi = i; p = (tt - acc) / BEATS[i].dur; break; }
        acc += BEATS[i].dur;
      }
      const beat = BEATS[bi];
      if (capRef.current !== beat.cap) { capRef.current = beat.cap; setCaption(beat.cap); }

      // Grass + a curved fairway ribbon.
      ctx.fillStyle = "#2f5a26"; ctx.fillRect(0, 0, DW, DH);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#4d9a39"; ctx.lineWidth = 50;
      ctx.beginPath(); ctx.moveTo(tee.x, tee.y); ctx.quadraticCurveTo(152, 196, 130, 148); ctx.quadraticCurveTo(100, 100, basket.x, basket.y); ctx.stroke();
      ctx.strokeStyle = "#56a541"; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
      // Pond + tree hazards.
      ctx.fillStyle = "#3a6ea5"; ctx.beginPath(); ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5b8fc4"; ctx.beginPath(); ctx.ellipse(pond.x, pond.y - 1.5, pond.rx - 3, pond.ry - 3, 0, 0, Math.PI * 2); ctx.fill();
      drawTree(ctx, { x: tree.x, y: tree.y, r: tree.r });
      // Faint paths of shots already thrown.
      for (let s = 0; s < SHOTS.length; s++) {
        if (bi <= throwIdx[s]) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.25; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(SHOTS[s].from.x, SHOTS[s].from.y);
        ctx.quadraticCurveTo(SHOTS[s].ctrl.x, SHOTS[s].ctrl.y, SHOTS[s].to.x, SHOTS[s].to.y); ctx.stroke(); ctx.setLineDash([]);
      }
      drawBasket(ctx, basket.x, basket.y);

      // Which inputs are set for this beat — disc in hand, shot shape, stance —
      // plus the disc's position. The control strip below mirrors these.
      const shot = SHOTS[beat.shot];
      let pos: Pt = tee, activeDi = 0, shape: Shape = "flat", stance: Stance = "BH";
      if (beat.kind === "aim") { pos = shot.from; activeDi = shot.di; shape = shot.shape; stance = shot.stance; }
      else if (beat.kind === "throw") { pos = qbez(shot.from, shot.ctrl, shot.to, easeInOut(p)); activeDi = shot.di; shape = shot.shape; stance = shot.stance; }
      else if (beat.kind === "select") { pos = shot.from; activeDi = shot.di; shape = shot.shape; stance = shot.stance; }
      else if (beat.kind === "switch") { pos = shot.from; activeDi = p < 0.5 ? SHOTS[beat.shot - 1].di : shot.di; shape = shot.shape; stance = shot.stance; }
      else if (beat.kind === "celebrate") { pos = basket; activeDi = 2; }

      // Live trail while the disc is in the air.
      if (beat.kind === "throw") {
        const tp = easeInOut(p);
        ctx.strokeStyle = DISCS[activeDi].color; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const pp = qbez(SHOTS[beat.shot].from, SHOTS[beat.shot].ctrl, SHOTS[beat.shot].to, tp * k / 16); if (k === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // Aim: predicted dots, pull-back slider, power knob + a fingertip ring.
      if (beat.kind === "aim") {
        const dir = norm({ x: SHOTS[beat.shot].to.x - pos.x, y: SHOTS[beat.shot].to.y - pos.y });
        const pw = easeOut(Math.min(1, p * 1.25));
        const kx = pos.x - dir.x * 30 * pw, ky = pos.y - dir.y * 30 * pw;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let k = 1; k <= 5; k++) { const pp = qbez(SHOTS[beat.shot].from, SHOTS[beat.shot].ctrl, SHOTS[beat.shot].to, k / 14); ctx.beginPath(); ctx.arc(pp.x, pp.y, 1.3, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(kx, ky); ctx.stroke();
        ctx.fillStyle = pw < 0.5 ? "#36D7B7" : pw < 0.85 ? "#f5d24a" : "#e23b3b"; ctx.beginPath(); ctx.arc(kx, ky, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(kx, ky, 8, 0, Math.PI * 2); ctx.stroke();
      }

      // The disc itself (shadow, white body, tier-color pip).
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = DISCS[activeDi].color; ctx.fillRect(Math.round(pos.x) - 1, Math.round(pos.y) - 1, 2, 2);

      // Celebration confetti on the made putt.
      if (beat.kind === "celebrate") {
        const cols = ["#36D7B7", "#f5d24a", "#ffffff", "#4B3DFF", "#e23b3b"];
        for (let k = 0; k < 18; k++) { const ang = (k / 18) * Math.PI * 2; const sp = 20 + (k % 4) * 8; const cx = basket.x + Math.cos(ang) * sp * p; const cy = basket.y + Math.sin(ang) * sp * p + p * p * 16; ctx.globalAlpha = Math.max(0, 1 - p); ctx.fillStyle = cols[k % 5]; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
        ctx.globalAlpha = 1;
      }

      const pulse = 0.5 + 0.5 * Math.sin(now / 170);
      drawDiscRow(ROW_Y[0], activeDi, beat.teach === "disc", pulse);
      drawSegRow(ROW_Y[1], "ANGLE", ["Hyzer", "Flat", "Anny"], shape === "hyzer" ? 0 : shape === "flat" ? 1 : 2, "#e0923b", "#0f1117", beat.teach === "shape", pulse);
      drawSegRow(ROW_Y[2], "STANCE", ["Backhand", "Forehand"], stance === "BH" ? 0 : 1, "#4B3DFF", "#ffffff", beat.teach === "throw", pulse);
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
        <canvas ref={canvasRef} width={240} height={366} className="w-full rounded-xl border border-white/10 bg-[#2f5a26]" style={{ imageRendering: "pixelated" }} />
        <p className="text-gray-200 text-sm font-medium min-h-[40px] leading-snug flex items-center justify-center">{caption}</p>
        <button type="button" onClick={onClose} className={`${btn} w-full`}>Got it ✓</button>
      </div>
    </div>
  );
}
