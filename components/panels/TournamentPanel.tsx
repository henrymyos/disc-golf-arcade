"use client";

import { useMemo } from "react";
import {
  TOURN_FIELD, tournDef, tournStandings, tournDifficulty, tournStarDifficulty, type Tournament, type TournDef,
} from "@/lib/discgolf/engine";
import { DiffStars, ordinal, btn } from "./ui";

export function TournamentPanel({ tournaments, active, bests, onStart, onAbandon, onPlayRound, onClose }: {
  tournaments: TournDef[];
  active: Tournament | null;
  bests: Record<string, number>;
  onStart: (def: TournDef) => void;
  onAbandon: () => void;
  onPlayRound: (t: Tournament) => void;
  onClose: () => void;
}) {
  const def = active ? tournDef(active.id) : null;
  // Roster sorted easiest → hardest (hook must run before the early return).
  const roster = useMemo(() => tournaments.map((d) => ({ d, diff: tournDifficulty(d) })).sort((a, b) => a.diff - b.diff), [tournaments]);

  // ── Active tournament: standings + play/continue ──
  if (active && def) {
    const standings = active.myTotals.length > 0 ? tournStandings(active, def) : null;
    const place = standings ? standings.findIndex((r) => r.you) + 1 : 0;
    const champion = active.finished && place === 1;
    const cols = def.rounds.map((_, r) => r);
    const hasCut = def.cut && def.rounds.length >= 3;
    return (
      <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
        <div className="w-full max-w-sm mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-white font-black text-lg truncate">{def.name}</h2>
            <div className="flex items-center gap-2 shrink-0">
              <DiffStars n={tournStarDifficulty(def)} />
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>
          <p className="text-gray-500 text-[11px] shrink-0">{def.venues} · {def.rounds.length} rounds{hasCut ? " · cut after R2" : ""}</p>

          {champion && (
            <div className="bg-[#f5d24a]/10 border border-[#f5d24a]/40 rounded-xl p-2.5 text-center mt-2 shrink-0">
              <p className="text-[#f5d24a] font-black text-lg">🏆 CHAMPION!</p>
            </div>
          )}
          {active.finished && hasCut && !active.madeCut && (
            <p className="text-[#e08a3b] text-sm font-semibold text-center mt-2 shrink-0">Missed the cut — finished {ordinal(place)}.</p>
          )}
          {active.finished && place > 1 && !(hasCut && !active.madeCut) && (
            <p className="text-gray-300 text-sm text-center mt-2 shrink-0">Finished <span className="text-white font-bold">{ordinal(place)}</span> of {TOURN_FIELD}.</p>
          )}

          <div className="flex-1 overflow-y-auto mt-2 bg-[#1a1d23] border border-white/5 rounded-xl">
            {standings ? (
              <table className="w-full text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-[#1a1d23]">
                  <tr className="text-gray-500 border-b border-white/5">
                    <th className="text-left pl-3 py-1.5 w-8">#</th>
                    <th className="text-left">Player</th>
                    {cols.map((r) => <th key={r} className="text-right pr-1">R{r + 1}</th>)}
                    <th className="text-right pr-3">Tot</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.name} className={`${row.you ? "bg-[#36D7B7]/10 text-[#36D7B7] font-bold" : "text-gray-300"} ${i ? "border-t border-white/5" : ""} ${row.cut ? "opacity-50" : ""}`}>
                      <td className="pl-3 py-1">{row.cut ? "—" : i + 1}</td>
                      <td className="truncate max-w-[110px]">{row.name}{row.cut ? " (cut)" : ""}</td>
                      {cols.map((r) => <td key={r} className="text-right pr-1 font-mono">{row.rounds[r] ?? ""}</td>)}
                      <td className="text-right pr-3 font-mono font-bold">{row.total || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-300 text-sm p-4 text-center">Round 1 awaits — the field is warming up.</p>
            )}
          </div>

          {!active.finished ? (
            <>
              <button type="button" onClick={() => onPlayRound(active)} className={`${btn} w-full shrink-0 mt-3`}>
                Play round {active.myTotals.length + 1} of {def.rounds.length}
              </button>
              <button type="button" onClick={onAbandon} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1.5 transition shrink-0">Abandon tournament</button>
            </>
          ) : (
            <button type="button" onClick={onAbandon} className={`${btn} w-full shrink-0 mt-3`}>↩ Back to tournaments</button>
          )}
        </div>
      </div>
    );
  }

  // ── Tournament roster ──
  return (
    <div className="absolute inset-0 z-20 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">Tournaments</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto mt-2.5 space-y-2.5 pr-0.5 -mr-0.5">
          {roster.map(({ d }) => {
            const best = bests[d.id];
            // Top-3 best finish medals the card: gold / silver / bronze outline + medal.
            const medal = best === 1 ? { emoji: "🥇", color: "#f5d24a" }
              : best === 2 ? { emoji: "🥈", color: "#cbd5e1" }
              : best === 3 ? { emoji: "🥉", color: "#cd7f32" }
              : null;
            return (
              <div
                key={d.id}
                className={`rounded-xl bg-[#1a1d23] p-3 ${medal ? "border-2" : "border border-white/10"}`}
                style={medal ? { borderColor: medal.color, boxShadow: `0 0 12px -4px ${medal.color}` } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white font-bold text-sm truncate pt-0.5">{d.name}</span>
                  <div className="shrink-0 text-right">
                    <DiffStars n={tournStarDifficulty(d)} />
                    <span className="block text-gray-500 text-[10px] mt-0.5">{d.rounds.length} rounds</span>
                  </div>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5 truncate">{d.venues}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[11px] text-gray-400">
                    {best
                      ? <>{medal ? medal.emoji : "🏅"} Best <span className="font-bold" style={{ color: medal?.color ?? "#f5d24a" }}>{ordinal(best)}</span> <span className="text-gray-500">of {TOURN_FIELD}</span></>
                      : "Not played yet"}
                  </span>
                  <button type="button" onClick={() => onStart(d)} className="shrink-0 rounded-lg bg-[#36D7B7] hover:bg-[#2ec2a6] text-[#0f1117] text-sm font-bold px-5 py-1.5 transition">Play</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
