"use client";

import { useState } from "react";
import {
  tierFromRP, PLACEMENT_ROUNDS, TIERS, seasonRewardCoins, earnedDivisions, type RankedState, type PlacementResult,
} from "@/lib/discgolf/ranked";
import { centralMonthLabel } from "@/lib/discgolf/time";
import { btn } from "./ui";
import { readPlaceMarks } from "../game/storage";


// The placement progress tracker: one dot per calibration round, colored by where
// you finished — green ✓ for top 2, red ✕ for bottom 2, gray – for the middle 3rd.
// Dots past your progress read as empty/pending. `animate` pops them in one by one
// for the completion reveal.
export function placeDotStyle(played: boolean, mark: number | null) {
  if (!played) return { bg: "#161a20", border: "rgba(255,255,255,0.12)", glyph: "", color: "#4b5563", glow: false };
  if (mark == null) return { bg: "#22262e", border: "rgba(255,255,255,0.30)", glyph: "•", color: "#9aa0aa", glow: false };
  if (mark <= 2) return { bg: "rgba(54,215,183,0.12)", border: "#36D7B7", glyph: "✓", color: "#36D7B7", glow: true };
  if (mark >= 4) return { bg: "rgba(226,69,59,0.14)", border: "#e2453b", glyph: "✕", color: "#ff6b63", glow: true };
  return { bg: "rgba(255,255,255,0.05)", border: "#7c828c", glyph: "–", color: "#c0c5cc", glow: false };
}
export function PlacementDots({ marks, done, total, animate = false }: { marks: (number | null)[]; done: number; total: number; animate?: boolean }) {
  return (
    <div className="flex items-center justify-center">
      {Array.from({ length: total }, (_, i) => {
        const s = placeDotStyle(i < done, marks[i] ?? null);
        return (
          <div key={i} className="flex items-center">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center border-2 text-base font-black"
              style={{
                background: s.bg, borderColor: s.border, color: s.color,
                boxShadow: s.glow ? `0 0 10px ${s.border}55` : "none",
                animation: animate ? "place-pop 0.4s ease-out both" : undefined,
                animationDelay: animate ? `${i * 0.35}s` : undefined,
              }}
            >
              {s.glyph}
            </div>
            {i < total - 1 && (
              <div className="w-5 h-[3px] rounded" style={{ background: i + 1 <= done ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Shown once the third placement round lands: the dots fill in, then the division
// you've been placed in scales up beneath them.
export function PlacementReveal({ result, marks, onClose }: { result: PlacementResult; marks: (number | null)[]; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-[#13161c] border border-white/10 p-6 text-center shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.2em]">Placement complete</p>
        <div className="my-5"><PlacementDots marks={marks} done={result.rounds} total={result.rounds} animate /></div>
        <div style={{ animation: "place-reveal 0.5s ease-out both", animationDelay: "1.25s" }}>
          <p className="text-7xl leading-none my-1">{result.tier.emoji}</p>
          <p className="text-gray-300 text-sm mt-2">You've been placed in</p>
          <p className="font-black text-3xl" style={{ color: result.tier.color }}>{result.tier.name}</p>
          <p className="text-gray-500 text-[11px] mt-1">{result.projectedRp} RP · ranked rounds move you from here</p>
          <button type="button" onClick={onClose} className={`${btn} w-full mt-5`}>Continue</button>
        </div>
      </div>
    </div>
  );
}

// Ranked ladder. Every round is a FRESH course against a tier-scaled AI field;
// finishing position drives RP, podium streaks pay a bonus, and lifetime RP climbs
// a tier. Play as many rounds as you like.
export function RankedPanel({ ranked, onPlay, onClose }: {
  ranked: RankedState | null;
  onPlay: () => void;
  onClose: () => void;
}) {
  const [showRanks, setShowRanks] = useState(false); // toggles the full rank ladder
  const rp = ranked?.rp ?? 0;
  const t = tierFromRP(rp);
  const pct = t.need ? Math.round((t.into / t.need) * 100) : 100;
  const placed = ranked?.placed ?? false;
  const placeDone = ranked?.placeEstimates?.length ?? 0; // placement rounds banked so far
  const placeMarks = readPlaceMarks(); // dot colors for the current placement run
  const season = ranked?.season ?? 0;
  const lastSeasonRp = ranked?.lastSeasonRp ?? null;
  const lastTier = lastSeasonRp != null ? tierFromRP(lastSeasonRp).tier : null; // last season's finish
  const history = ranked?.history ?? []; // finished seasons, newest first
  const earned = earnedDivisions(history); // division keys you hold a badge in
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      {/* Top-pinned (no my-auto): opening the Division Info dropdown grows the
          panel downward only, instead of re-centering and shifting everything up. */}
      <div className="w-full max-w-xs space-y-3 text-left">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-black text-xl leading-none">Ranked</h2>
            {season > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-gray-200">
                  📅 {centralMonthLabel(season)} season
                </span>
                {lastTier && (
                  <span className="text-gray-500 text-[11px]">last <span style={{ color: lastTier.color }}>{lastTier.emoji} {lastTier.name}</span></span>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Division Info — a clear open/close dropdown (arrow flips when open) */}
        <div>
          <button
            type="button"
            onClick={() => setShowRanks((v) => !v)}
            aria-expanded={showRanks}
            className="w-full flex items-center gap-2 bg-[#1a1d23] border border-white/10 hover:border-white/25 rounded-xl px-3 py-2.5 text-left transition-colors"
          >
            <span className="flex-1 text-white text-sm font-semibold">Division Info</span>
            <span className={`text-gray-400 text-xs leading-none transition-transform ${showRanks ? "rotate-180" : ""}`}>▾</span>
          </button>
          {showRanks && (
            <div className="mt-1.5 bg-[#1a1d23] border border-white/10 rounded-xl overflow-hidden">
              {TIERS.map((tier, i) => {
                const current = placed && tier.key === t.tier.key;
                return (
                  <div key={tier.key} className={`flex items-center gap-2.5 px-3 py-2 ${i ? "border-t border-white/5" : ""} ${current ? "bg-white/5" : ""}`}>
                    <span className="text-xl leading-none shrink-0">{tier.emoji}</span>
                    <span className="font-bold text-sm flex-1" style={{ color: tier.color }}>{tier.name}{earned.has(tier.key) ? " 🏅" : ""}</span>
                    <span className="text-gray-500 font-mono text-[10px]">{tier.min === 0 ? "0 RP" : `${tier.min.toLocaleString()}+ RP`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tier card — placed shows your RP bar; during placement it's a centered
            "predicted rank" card with the three-round dot tracker underneath. */}
        {placed ? (
          <div className="flex items-center gap-3 bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
            <span className="text-4xl leading-none shrink-0">{t.tier.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-base" style={{ color: t.tier.color }}>{t.tier.name}</span>
                <span className="text-gray-400 font-mono text-[11px] shrink-0">{rp} RP</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-white/10 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${pct}%`, background: t.tier.color }} />
              </div>
              <p className="text-gray-500 text-[10px] mt-1">{t.next ? `${t.need - t.into} RP to ${t.next.name}` : "Top tier reached 👑"}</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1d23] border border-white/10 rounded-xl px-4 py-4 text-center">
            <span className="text-5xl leading-none block">{placeDone > 0 ? t.tier.emoji : "❔"}</span>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2.5">Predicted rank</p>
            <p className="font-black text-2xl mt-0.5" style={{ color: placeDone > 0 ? t.tier.color : "#9aa0aa" }}>
              {placeDone > 0 ? t.tier.name : "Unranked"}
            </p>
            <p className="text-gray-500 text-[10px] mt-1">
              {placeDone > 0 ? "Calculated from your placement finishes" : "Play your placement rounds to reveal a rank"}
            </p>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.15em] mt-4">Placement progress · {placeDone}/{PLACEMENT_ROUNDS}</p>
            <div className="mt-2.5"><PlacementDots marks={placeMarks} done={placeDone} total={PLACEMENT_ROUNDS} /></div>
          </div>
        )}

        {/* Season-end reward preview — the gold + badge your division pays out */}
        {(placed || placeDone > 0) && (
          <div className="bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-gray-400 text-[11px] font-semibold">🏆 Season-end reward</p>
            <p className="text-[13px] leading-snug">
              <span className="text-gray-300">Finish </span>
              <span className="font-bold" style={{ color: t.tier.color }}>{t.tier.emoji} {t.tier.name}</span>
              <span className="text-gray-300"> → </span>
              <span className="text-[#f5d24a] font-bold">+{seasonRewardCoins(t.tier.key)} gold</span>
              <span className="text-gray-300"> &amp; its badge</span>
            </p>
            {t.next && (
              <p className="text-[11px] text-gray-500 leading-snug">
                Reach <span style={{ color: t.next.color }}>{t.next.emoji} {t.next.name}</span> → <span className="text-[#f5d24a]">+{seasonRewardCoins(t.next.key)} gold</span>
              </p>
            )}
          </div>
        )}

        {/* Division badges — only the ones you've earned by finishing a season there */}
        {earned.size > 0 && (
          <div className="bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-2.5">
            <p className="text-gray-400 text-[11px] font-semibold mb-2">🏅 Division badges</p>
            <div className="flex items-center flex-wrap gap-2">
              {TIERS.filter((tier) => earned.has(tier.key)).map((tier) => (
                <span
                  key={tier.key}
                  title={`${tier.name} — earned`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[12px] font-bold"
                  style={{ color: tier.color }}
                >
                  <span className="text-base leading-none">{tier.emoji}</span> {tier.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Past seasons — a trophy log of where you finished and what it paid */}
        {history.length > 0 && (
          <div className="bg-[#1a1d23] border border-white/10 rounded-xl overflow-hidden">
            <p className="text-gray-400 text-[11px] font-semibold px-3 py-2 border-b border-white/5">📜 Past seasons</p>
            {history.map((h, i) => {
              const ht = TIERS.find((x) => x.key === h.tierKey) ?? TIERS[0];
              return (
                <div key={h.season} className={`flex items-center gap-2.5 px-3 py-2 ${i ? "border-t border-white/5" : ""}`}>
                  <span className="text-lg leading-none shrink-0">{ht.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold leading-tight" style={{ color: ht.color }}>{ht.name}</p>
                    <p className="text-gray-500 text-[10px] leading-tight">{centralMonthLabel(h.season)} · {h.rp} RP</p>
                  </div>
                  <span className="text-[#f5d24a] font-mono text-[10px] shrink-0">+{h.coins}</span>
                </div>
              );
            })}
          </div>
        )}

        {(ranked?.streak ?? 0) >= 2 && (
          <p className="text-[#f5d24a] text-[11px] font-bold text-center">🔥 On a {ranked!.streak}-podium streak — keep it going for bonus RP!</p>
        )}

        <p className="text-gray-400 text-[11px] leading-snug">
          A fresh 18-hole course every round, on a card of 5 — you and four pros that get tougher as you climb. Finish top&nbsp;2 to gain RP (1st gains the most), 3rd holds steady, bottom&nbsp;2 lose RP. Play as many rounds as you like.
        </p>

        <button type="button" onClick={onPlay} className={`${btn} w-full`}>
          {placed ? "Play a ranked round" : `Play placement round ${placeDone + 1} of ${PLACEMENT_ROUNDS}`}
        </button>

      </div>
    </div>
  );
}
