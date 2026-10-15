"use client";

import { useState } from "react";
import type { Mode } from "@/lib/discgolf/engine";
import { titleCardSm, titleCard, btn, StyledDropdown } from "./ui";
import type { LobbyPlayer } from "../game/online";
import { challengeKey, type CourseInfo } from "../game/courses";


// Challenge Friends entry point: choose hot-seat Pass & Play or an online
// Friendly Challenge, then Create a lobby or Join one with a code.
export function ChallengePanel({ online, onBack, onCreate, onJoin }: {
  online: boolean;
  onBack: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [step, setStep] = useState<"menu" | "join">("menu");
  const [code, setCode] = useState("");
  const input = "w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#36D7B7]";
  // Renders inline inside the title column (same hub styling as Single Player /
  // Online), so the logo and profile stay visible above and the screen is blank
  // below the buttons. ‹ Back steps out to the Online hub (or up a sub-step).
  return (
    <div className="w-full flex flex-col gap-2">
      <button type="button" onClick={step === "menu" ? onBack : () => setStep("menu")} className={`${titleCardSm} !flex-none self-start px-3`}>‹ Back</button>

      {step === "menu" && (online ? (
        <>
          <button type="button" onClick={onCreate} className={titleCard}>Create Game</button>
          <button type="button" onClick={() => setStep("join")} className={titleCard}>Join Game</button>
        </>
      ) : (
        <p className="text-gray-400 text-xs px-1">Online play isn&apos;t set up for this build, so Challenge Friends is unavailable.</p>
      ))}

      {step === "join" && (
        <div className="space-y-3 text-left mt-1">
          <p className="text-gray-400 text-xs">Enter the 4-character game code your friend shared.</p>
          <input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            placeholder="CODE" className={`${input} tracking-[0.3em] text-center font-mono uppercase`} />
          <button type="button" onClick={() => code.trim().length === 4 && onJoin(code)} disabled={code.trim().length !== 4} className={`${btn} w-full disabled:opacity-50`}>Join Game</button>
        </div>
      )}
    </div>
  );
}

export function LobbyPanel({ lobby, players, hostLeft, error, courses, onPickCourse, onStart, onLeave }: {
  lobby: { code: string; isHost: boolean; mode: Mode; courseKey: string; courseLabel: string };
  players: LobbyPlayer[];
  hostLeft: boolean;
  error: string | null;
  courses: CourseInfo[];
  onPickCourse: (c: CourseInfo) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const host = players.find((p) => p.host);
  // Host steers the course via the dropdown (lobby.courseLabel); joiners just read
  // whatever the host is currently broadcasting through presence.
  const courseLabel = lobby.isHost ? lobby.courseLabel : host?.courseLabel ?? lobby.courseLabel;
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-6 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Lobby</h2>
          <button type="button" onClick={onLeave} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="rounded-xl bg-[#1a1d23] border border-white/10 p-4 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em]">Join code</p>
          <p className="text-[#36D7B7] font-black text-4xl tracking-[0.25em] mt-1">{lobby.code}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Course</p>
          {lobby.isHost ? (
            <StyledDropdown
              icon="⛳"
              ariaLabel="Choose course"
              value={lobby.courseKey}
              onChange={(key) => { const c = courses.find((x) => challengeKey(x) === key); if (c) onPickCourse(c); }}
              options={courses.map((c) => ({ key: challengeKey(c), label: c.name, group: c.seed != null ? "Pro Tour" : undefined }))}
            />
          ) : (
            <div className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-semibold">{courseLabel}</div>
          )}
        </div>
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Players ({players.length})</p>
          <div className="space-y-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-white font-semibold truncate flex-1">{p.name}</span>
                {p.host && <span className="text-[#f5d24a] text-[10px] font-bold uppercase tracking-wide">Host</span>}
              </div>
            ))}
            {players.length === 0 && <p className="text-gray-500 text-xs">Connecting…</p>}
          </div>
        </div>
        {error ? (
          <div className="space-y-2 text-center py-1">
            <p className="text-[#e2843b] text-sm font-semibold">{error}</p>
            <button type="button" onClick={onLeave} className={`${btn} w-full`}>Back</button>
          </div>
        ) : lobby.isHost ? (
          <>
            <button type="button" onClick={onStart} className={`${btn} w-full`}>Start round</button>
            {players.length < 2 && <p className="text-gray-500 text-[11px] text-center">Waiting for friends to join — you can start anytime.</p>}
          </>
        ) : hostLeft ? (
          <div className="space-y-2 text-center py-1">
            <p className="text-[#e2843b] text-sm font-semibold">The host left the lobby.</p>
            <button type="button" onClick={onLeave} className={`${btn} w-full`}>Leave lobby</button>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

// Pass-and-play setup: pick a course, 2-4 players, optional names.
export function PartyPanel({ onClose, onStart }: { onClose: () => void; onStart: (m: Mode, names: string[]) => void }) {
  const [course, setCourse] = useState<Mode>("course");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Pass &amp; Play</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px]">Take turns on each hole, one phone. Doesn&apos;t count toward records.</p>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          <button type="button" onClick={() => setCourse("course")} className={seg(course === "course")}>Glendoveer</button>
          <button type="button" onClick={() => setCourse("winthrop")} className={seg(course === "winthrop")}>Winthrop</button>
          <button type="button" onClick={() => setCourse("olympus")} className={seg(course === "olympus")}>Olympus</button>
          <button type="button" onClick={() => setCourse("daily")} className={seg(course === "daily")}>Daily</button>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setCount(n)} className={seg(count === n)}>{n} players</button>
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              type="text"
              value={names[i]}
              maxLength={12}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`Player ${i + 1}`}
              className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#36D7B7]"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onStart(course, Array.from({ length: count }, (_, i) => names[i].trim() || `Player ${i + 1}`))}
          className={`${btn} w-full`}
        >
          Tee off
        </button>
      </div>
    </div>
  );
}
