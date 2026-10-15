"use client";

import { useEffect, useState } from "react";
import { getArcadeLeaderboard } from "@/actions/arcade";
import type { ArcadeScore } from "@/lib/arcade-types";
import { TOTAL_PAR, WINTHROP_PAR, OLYMPUS_PAR, dailySeed, buildRound } from "@/lib/discgolf/engine";
import { TOUR_COURSE_INFOS } from "../game/courses";
import { StyledDropdown } from "./ui";


// Browse the global (Supabase) leaderboard for any course from the title
// screen. Daily uses today's seed; the fixed courses are all-time.
export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  // Daily first, then the two fixed venues, then every pro-tour course on the app.
  type Board = { label: string; courseKey: string; par: number; daily?: boolean };
  const [boards] = useState<Board[]>(() => {
    const dSeed = dailySeed();
    const dPar = buildRound(dSeed, "daily").reduce((s, h) => s + h.par, 0);
    return [
      { label: "Daily Challenge", courseKey: `daily-${dSeed}`, par: dPar, daily: true },
      { label: "Glendoveer East", courseKey: "glendoveer", par: TOTAL_PAR },
      { label: "Winthrop Lake", courseKey: "winthrop", par: WINTHROP_PAR },
      { label: "Olympus", courseKey: "olympus", par: OLYMPUS_PAR },
      ...TOUR_COURSE_INFOS.map((c) => ({ label: c.name, courseKey: `tour-${c.seed}`, par: c.par })),
    ];
  });
  const [pick, setPick] = useState<Board>(boards[0]);
  const [rows, setRows] = useState<ArcadeScore[] | null>(null);
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    setRows(null);
    getArcadeLeaderboard(pick.courseKey, 25).then((r) => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [pick]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Leaderboards</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <StyledDropdown
          icon="🏆"
          ariaLabel="Choose a leaderboard"
          value={pick.courseKey}
          onChange={(key) => { const b = boards.find((x) => x.courseKey === key); if (b) setPick(b); }}
          options={boards.map((b) => ({ key: b.courseKey, label: b.label, group: b.courseKey.startsWith("tour-") ? "Pro Tour" : undefined }))}
        />
        <p className="text-gray-500 text-[11px]">
          {pick.daily ? "Today's course · par " : "All-time · par "}{pick.par}
        </p>
        <div className="bg-[#1a1d23] border border-white/5 rounded-2xl overflow-hidden">
          {rows === null ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No scores yet — be the first!</p>
          ) : (
            <ol>
              {rows.map((row, i) => (
                <li
                  key={`${row.name}-${row.created_at}`}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${i !== 0 ? "border-t border-white/5" : ""}`}
                >
                  <span className={`font-mono w-6 text-right ${i === 0 ? "text-[#f5d24a]" : "text-gray-400"}`}>{i + 1}</span>
                  <span className="text-white flex-1 truncate">{i === 0 ? "👑 " : ""}{row.name}</span>
                  <span className="text-gray-400 font-mono">{over(row.strokes - pick.par)}</span>
                  <span className="text-white font-mono font-bold w-8 text-right">{row.strokes}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
