"use client";

import { flightShapes } from "@/lib/discgolf/flight-card";
import type { Disc } from "@/lib/discgolf/engine";

const LINE = { hyzer: { color: "#e0923b", label: "Hyzer" }, flat: { color: "#36D7B7", label: "Flat" }, anny: { color: "#e23b7b", label: "Anhyzer" } } as const;

// A disc's flight at hyzer, flat and anhyzer (full power, righty backhand, calm
// air), drawn to true scale from the game's own physics — see lib/discgolf/flight-card.
export function FlightShapeCard({ disc }: { disc: Disc }) {
  const shapes = flightShapes(disc);
  const all = shapes.flatMap((s) => s.pts);
  const top = Math.max(...all.map((p) => p.y)) * 1.06;
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const half = Math.max(top * 0.28, Math.abs(minX), Math.abs(maxX)) * 1.12; // centred on the tee
  const pad = top * 0.04;
  const stroke = top / 90;
  return (
    <figure className="bg-white/5 rounded-lg p-2" aria-label={`${disc.name} flight shapes: ${shapes.map((s) => `${LINE[s.release].label} about ${s.carryFt} feet, ending ${Math.abs(s.sideFt)} feet ${s.sideFt < 0 ? "left" : "right"}`).join("; ")}`}>
      <svg viewBox={`${-half} ${-top} ${half * 2} ${top + pad}`} className="w-full h-[150px]" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line x1={0} y1={0} x2={0} y2={-top} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke * 0.6} strokeDasharray={`${stroke * 3} ${stroke * 3}`} />
        {shapes.map((s) => (
          <polyline key={s.release} points={s.pts.map((p) => `${p.x.toFixed(1)},${(-p.y).toFixed(1)}`).join(" ")}
            fill="none" stroke={LINE[s.release].color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <circle cx={0} cy={0} r={stroke * 2} fill="#fff" />
      </svg>
      <figcaption className="mt-1.5 grid grid-cols-3 gap-1 text-center">
        {shapes.map((s) => (
          <span key={s.release} className="text-[10px] leading-tight">
            <span className="font-bold" style={{ color: LINE[s.release].color }}>{LINE[s.release].label}</span>
            <span className="block text-gray-300 font-mono">{s.carryFt} ft</span>
          </span>
        ))}
        <span className="col-span-3 text-gray-500 text-[9px] mt-0.5">Full power · righty backhand · no wind</span>
      </figcaption>
    </figure>
  );
}
