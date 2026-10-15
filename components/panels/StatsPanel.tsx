"use client";

import { useState } from "react";
import { HIST_KEY } from "@/lib/progress";


export function StatsPanel({ onClose }: { onClose: () => void }) {
  const [hist] = useState<{ mode: string; total: number; date: number; scores?: number[]; pars?: number[] }[]>(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      return Array.isArray(h) ? h : [];
    } catch { return []; }
  });
  const byMode = (m: string) => hist.filter((r) => r.mode === m);
  const avg = (rows: { total: number }[]) => (rows.length ? (rows.reduce((s, r) => s + r.total, 0) / rows.length).toFixed(1) : "–");
  const best = (rows: { total: number }[]) => (rows.length ? Math.min(...rows.map((r) => r.total)) : null);
  // Score-type distribution over every recorded hole.
  const dist = { ace: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, worse: 0 };
  let holesCounted = 0;
  for (const r of hist) {
    if (!r.scores || !r.pars) continue;
    r.scores.forEach((sc, i) => {
      const pr = r.pars![i];
      if (typeof sc !== "number" || typeof pr !== "number") return;
      holesCounted++;
      if (sc === 1) dist.ace++;
      else if (sc - pr <= -2) dist.eagle++;
      else if (sc - pr === -1) dist.birdie++;
      else if (sc === pr) dist.par++;
      else if (sc - pr === 1) dist.bogey++;
      else dist.worse++;
    });
  }
  const rowsFor: { label: string; rows: { total: number }[] }[] = [
    { label: "Glendoveer East", rows: byMode("course") },
    { label: "Winthrop Lake", rows: byMode("winthrop") },
    { label: "Olympus", rows: byMode("olympus") },
    { label: "Daily Challenge", rows: byMode("daily") },
  ];
  const distRows = [
    { label: "Aces", n: dist.ace, color: "#f5d24a" },
    { label: "Eagles", n: dist.eagle, color: "#f5d24a" },
    { label: "Birdies", n: dist.birdie, color: "#36D7B7" },
    { label: "Pars", n: dist.par, color: "#cbd5e1" },
    { label: "Bogeys", n: dist.bogey, color: "#e0923b" },
    { label: "Double+", n: dist.worse, color: "#e23b3b" },
  ];
  const maxN = Math.max(1, ...distRows.map((d) => d.n));
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Stats</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {hist.length === 0 ? (
          <p className="text-gray-400 text-sm">No rounds yet — play one and come back!</p>
        ) : (
          <>
            <p className="text-gray-400 text-xs">{hist.length} round{hist.length === 1 ? "" : "s"} played</p>
            <div className="space-y-1.5">
              {rowsFor.map(({ label, rows }) => (
                <div key={label} className="flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <span className="text-white font-semibold">{label}</span>
                  <span className="text-gray-400 font-mono text-xs">
                    {rows.length} rds{best(rows) != null ? ` · best ${best(rows)}` : ""} · avg {avg(rows)}
                  </span>
                </div>
              ))}
            </div>
            {holesCounted > 0 && (
              <div>
                <p className="text-gray-400 text-xs font-semibold mb-1.5">Scoring ({holesCounted} holes)</p>
                <div className="space-y-1">
                  {distRows.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-gray-400">{d.label}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(d.n / maxN) * 100}%`, background: d.color }} />
                      </div>
                      <span className="w-8 text-right text-white font-mono">{d.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
