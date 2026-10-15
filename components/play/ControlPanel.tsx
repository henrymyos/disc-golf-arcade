"use client";

import { ADV_DISCS, BAG_MAX, discByKey, discIndexByKey, type Release } from "@/lib/discgolf/engine";

// The in-round control panel: the disc rack (your bag), release angle, stance
// and the round menu. Phones and tablets get it as a bar under the board; at
// 1024px+ it becomes the right-hand column, with a legend of the keyboard
// shortcuts the game really supports.
export function ControlPanel({ activeBag, discIndex, onSelectDisc, release, onRelease, throwStyle, onThrowStyle, onMenu }: {
  activeBag: string[];
  discIndex: number;
  onSelectDisc: (i: number) => void;
  release: Release;
  onRelease: (r: Release) => void;
  throwStyle: "BH" | "FH";
  onThrowStyle: (s: "BH" | "FH") => void;
  onMenu: () => void;
}) {
  const selectDisc = onSelectDisc, setRelease = onRelease, setThrowStyle = onThrowStyle;
  return (
    <div className="shrink-0 w-full border-t border-white/10 bg-[#13161b] lg:w-[330px] lg:border-t-0 lg:border-l lg:flex lg:flex-col lg:justify-center lg:overflow-y-auto">
      <div className="mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(calc(env(safe-area-inset-bottom)+0.4rem),1.25rem)] flex flex-col gap-2">
        {/* Disc selector — only the discs in your bag (no bag-editing or
            shopping mid-round; both live on the home screen between rounds). */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Bag · {activeBag.length}/{BAG_MAX}</span>
          <span className="text-[10px] text-gray-400 font-medium truncate ml-2 min-w-0">
            {`${ADV_DISCS[discIndex]?.brand ?? ""} ${ADV_DISCS[discIndex]?.name ?? ""}`}
          </span>
        </div>
        <div className="flex gap-1.5 -mx-1 px-1">
          {activeBag.map((key) => {
            const d = discByKey(key);
            if (!d) return null;
            const i = discIndexByKey(key);
            return (
            <button
              key={key}
              type="button"
              onClick={() => selectDisc(i)}
              title={`${d.brand} ${d.name}`}
              className={`flex-1 min-w-0 rounded-lg border px-1.5 py-2 flex items-center justify-center gap-1 transition ${
                i === discIndex ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : "border-white/10 hover:border-white/25 bg-white/[0.02]"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className={`min-w-0 truncate text-[11px] font-bold ${i === discIndex ? "text-white" : "text-gray-300"}`}>{d.name}</span>
            </button>
            );
          })}
        </div>

        {/* Release angle */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Angle</span>
          <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
            {([
              { key: "hyzer", label: "Hyzer ⤸" },
              { key: "flat", label: "Flat" },
              { key: "anny", label: "⤹ Anny" },
            ] as const).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRelease(r.key)}
                aria-pressed={release === r.key}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                  release === r.key ? "bg-[#e0923b] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stance + mute */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Stance</span>
          <div className="flex-1 flex gap-1 bg-[#0f1117] border border-white/10 rounded-lg p-1">
            {([
              { key: "BH", label: "Backhand ◄" },
              { key: "FH", label: "► Forehand" },
            ] as const).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setThrowStyle(s.key)}
                aria-pressed={throwStyle === s.key}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${
                  throwStyle === s.key ? "bg-[#36D7B7] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onMenu}
            aria-label="Menu"
            className="shrink-0 w-10 h-[34px] flex items-center justify-center bg-[#0f1117] border border-white/10 hover:border-white/25 text-white rounded-lg active:bg-white/10 transition"
          >
            ☰
          </button>
        </div>

        {/* Keyboard shortcuts (desktop only). Only keys the game handles. */}
        <div className="hidden lg:block mt-3 rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 mb-1.5">Keyboard</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt><Kbd>1</Kbd>–<Kbd>{Math.max(1, Math.min(9, activeBag.length))}</Kbd></dt><dd className="text-gray-300">Pick a disc from your bag</dd>
            <dt><Kbd>B</Kbd> <Kbd>F</Kbd></dt><dd className="text-gray-300">Backhand / forehand</dd>
            <dt><Kbd>Space</Kbd> <Kbd>Enter</Kbd></dt><dd className="text-gray-300">Next hole (after you hole out)</dd>
            <dt className="text-gray-500">Mouse</dt><dd className="text-gray-300">Drag back from anywhere to aim and throw</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block min-w-[1.4rem] rounded border border-white/20 bg-white/5 px-1 py-px text-center font-mono text-[11px] text-white">{children}</kbd>;
}
