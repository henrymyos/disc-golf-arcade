"use client";

import { useEffect, useRef, useState } from "react";


export const btn =
  "mt-1 bg-[#36D7B7] hover:bg-[#2ec2a6] text-[#0f1117] font-bold px-6 py-3 rounded-lg transition";

// Uniform title-screen action cards: one dark fill, a green outline.
export const titleCard =
  "w-full rounded-xl border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] text-white font-bold py-3 transition";
export const titleCardSm =
  "flex-1 rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-gray-200 hover:text-white text-xs font-semibold py-2 transition";
// Big primary hub card — the three main actions, made large so they're clearly
// the buttons to press.
export const hubCard =
  "w-full flex items-center justify-center rounded-xl border border-[#36D7B7]/55 bg-[#1a1d23] hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] text-white py-6 transition";

// A Daily-Challenge goal star with the to-par score it takes printed inside —
// gold when earned, dim when still up for grabs. Drawn as an SVG rather than
// the ★ glyph: a fat body (inner radius 0.58 of outer, vs ~0.38 for a regular
// star) and stubby points leave real room for the number in the middle.
export const GOAL_STAR_POINTS =
  "50,2 66.5,27.4 95.7,35.2 76.6,58.7 78.2,88.8 50,78 21.8,88.8 23.4,58.7 4.3,35.2 33.5,27.4";
export function GoalStar({ lit, label, size }: { lit: boolean; label: string; size: number }) {
  // Gold throughout: bright gold once earned, a muted antique gold while still
  // up for grabs — each rimmed with a darker gold outline.
  const fill = lit ? "#f5d24a" : "#7a6318";
  const outline = lit ? "#b08d1e" : "#52430f";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label={`${label} goal ${lit ? "earned" : "not earned"}`}
      style={{ filter: lit ? "drop-shadow(0 0 6px rgba(245,210,74,0.55))" : undefined }}
    >
      {/* Darker-gold outline; round joins soften the points a touch. */}
      <polygon points={GOAL_STAR_POINTS} fill={fill} stroke={outline} strokeWidth="6" strokeLinejoin="round" />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="900"
        fontSize="26"
        fill={lit ? "#4a3800" : "#f0e3ae"}
      >
        {label}
      </text>
    </svg>
  );
}

// A small gold coin chip — used wherever a coin balance/amount is shown so the
// currency reads as clearly gold (rather than the dull 🪙 emoji).
export function Coin({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-3 h-3 rounded-full align-[-1px] shrink-0 ${className}`}
      style={{ background: "radial-gradient(circle at 35% 30%, #fff3ad, #f6c63a 58%, #c08812)", boxShadow: "inset 0 0 0 0.5px rgba(110,72,0,0.55)" }}
    />
  );
}

export function Overlay({ children, onTap }: { children: React.ReactNode; onTap?: () => void }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 rounded-lg text-center px-4${onTap ? " cursor-pointer" : ""}`}
      onClick={onTap}
    >
      {children}
    </div>
  );
}

// Lobby waiting room: shows the code, live roster (Realtime presence), and a
// Start button for the host. Friends join with the code from another device.
// A custom dropdown styled to match the app — shared by the Challenge-lobby
// course picker and the Leaderboards board picker so they look identical. An
// option may carry a `group` label that prints once above its first option.
export function StyledDropdown({ icon, options, value, onChange, ariaLabel }: {
  icon?: string;
  options: { key: string; label: string; group?: string }[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const current = options.find((o) => o.key === value);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center gap-2 bg-gradient-to-b from-[#22262e] to-[#16191f] border border-white/10 hover:border-[#36D7B7]/50 rounded-xl px-3 py-2.5 text-left transition-colors"
      >
        {icon && <span className="text-[#f5d24a] text-sm leading-none">{icon}</span>}
        <span className="flex-1 min-w-0 truncate text-white text-sm font-bold">{current?.label ?? ""}</span>
        <span className={`text-[#36D7B7] text-xs leading-none transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#13161c] py-1 shadow-xl shadow-black/50">
          {options.map((o, i) => {
            const active = o.key === value;
            const showGroup = o.group && o.group !== options[i - 1]?.group;
            return (
              <div key={o.key}>
                {showGroup && <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">{o.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(o.key); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${active ? "bg-[#36D7B7]/10 font-bold text-[#36D7B7]" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <span className="text-[#36D7B7] text-xs leading-none">✓</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tournaments: a roster of named events on the play-courses, each 2–3 rounds vs
// a seeded 35-strong AI field (3-round events cut to the top half after R2).
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// Every fixed course in the app on one page — keeps the title screen short and
// scales as new courses are added to FIXED_COURSES.
// A 1–5 star difficulty rating (orange stars), 5 = very difficult.
export function DiffStars({ n }: { n: number }) {
  return (
    <span className="leading-none tracking-tight whitespace-nowrap" aria-label={`Difficulty ${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`text-[11px] ${i < n ? "text-[#e0923b]" : "text-white/15"}`}>★</span>
      ))}
    </span>
  );
}

// The Disc Golf Arcade mark, reused on the auth panel.
export function DiscMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="drop-shadow">
      <g stroke="#2a7d70" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="12.5" x2="8" y2="12.5" /><line x1="1" y1="18" x2="7" y2="18" />
      </g>
      <ellipse cx="18.5" cy="16.5" rx="11" ry="5" fill="#1f9e8c" />
      <ellipse cx="18.5" cy="14.8" rx="11" ry="5" fill="#36D7B7" />
      <ellipse cx="18.5" cy="14" rx="6.5" ry="2.4" fill="#5fe6d2" />
    </svg>
  );
}
