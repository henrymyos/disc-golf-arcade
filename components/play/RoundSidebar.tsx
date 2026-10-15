"use client";

import type { HudInfo } from "../game/state";

const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// Desktop left column during a round (three-column layout only): the live scorecard and
// the wind, so the wide screen isn't empty space either side of the board.
export function RoundSidebar({ hud, width }: { hud: HudInfo; width: number }) {
  const played = hud.scores.filter((s): s is number => s != null).length;
  const toPar = hud.scores.reduce<number>((sum, s, i) => (s == null ? sum : sum + s - (hud.pars[i] ?? 0)), 0);
  const rows = hud.pars.length > 9 ? [[0, 9], [9, hud.pars.length]] : [[0, hud.pars.length]];
  return (
    <aside style={{ width }} className="flex shrink-0 flex-col justify-center gap-3 overflow-y-auto border-r border-white/10 bg-[#13161b] px-4 py-4 text-left" aria-label="Round scorecard">
      <div className="rounded-xl border border-white/10 bg-[#0f1117] px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{hud.player ? `${hud.player} · ` : ""}Hole {hud.hole} of {hud.holes}</p>
        <p className="mt-1 text-white text-2xl font-black leading-none">
          Par {hud.par}
          {hud.holeFt != null && <span className="ml-2 text-base font-bold text-gray-400">{hud.holeFt} ft</span>}
        </p>
        <div className="mt-2 flex gap-4 text-xs">
          <span className="text-gray-400">Throws <b className="text-white font-mono">{hud.throws}</b></span>
          {hud.pinFt != null && <span className="text-gray-400">To pin <b className="text-[#9cc4e8] font-mono">{hud.pinFt} ft</b></span>}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f1117] px-3 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Scorecard</p>
          <p className="text-xs text-gray-400">
            {played} played · <b className={`font-mono ${toPar < 0 ? "text-[#36D7B7]" : toPar > 0 ? "text-[#e08a3b]" : "text-white"}`}>{fmtToPar(toPar)}</b>
          </p>
        </div>
        <div className="mt-2 space-y-2">
          {rows.map(([from, to]) => (
            <div key={from} className="grid gap-x-0.5 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${to - from}, minmax(0, 1fr))` }}>
              {hud.pars.slice(from, to).map((p, k) => {
                const i = from + k;
                const s = hud.scores[i];
                const d = s == null ? null : s - p;
                const color = d == null ? "#5b6270" : d < 0 ? "#36D7B7" : d === 0 ? "#e5e7eb" : "#e23b3b";
                return (
                  <div key={i} className={`flex flex-col items-center rounded py-0.5 ${i === hud.hole - 1 ? "bg-white/10" : ""}`}>
                    <span className="text-[9px] text-gray-500 leading-none">{i + 1}</span>
                    <span className="text-[11px] font-mono font-bold leading-tight" style={{ color }}>{s ?? "·"}</span>
                    <span className="text-[8px] text-gray-600 leading-none">{p}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hud.windMph != null && (
        <div className="rounded-xl border border-white/10 bg-[#0f1117] px-3 py-3 flex items-center gap-3">
          <svg width="36" height="36" viewBox="-18 -18 36 36" aria-hidden>
            <circle r="16" fill="none" stroke="rgba(255,255,255,0.15)" />
            {hud.windMph > 0 && (
              <g transform={`rotate(${((hud.windAng ?? 0) * 180) / Math.PI})`}>
                <line x1="-10" y1="0" x2="9" y2="0" stroke="currentColor" strokeWidth="2.5" className={hud.windMph >= 10 ? "text-[#e08a3b]" : hud.windMph >= 5 ? "text-[#f5d24a]" : "text-[#9fd4e8]"} />
                <polygon points="12,0 5,-5 5,5" className={hud.windMph >= 10 ? "fill-[#e08a3b]" : hud.windMph >= 5 ? "fill-[#f5d24a]" : "fill-[#9fd4e8]"} />
              </g>
            )}
          </svg>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Wind</p>
            <p className="text-white font-bold">{hud.windMph === 0 ? "Calm" : `${hud.windMph} mph`}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
