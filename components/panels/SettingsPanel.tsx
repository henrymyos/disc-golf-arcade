"use client";

import type { Release } from "@/lib/discgolf/engine";


export function SettingsPanel(props: {
  onClose: () => void;
  throwStyle: "BH" | "FH";
  setThrowStyle: (s: "BH" | "FH") => void;
  release: Release;
  setRelease: (r: Release) => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  leftHanded: boolean;
  setLeftHanded: (b: boolean) => void;
  showGhost: boolean;
  setShowGhost: (b: boolean) => void;
  muted: boolean;
  onToggleSound: () => void;
}) {
  const { onClose, throwStyle, setThrowStyle, release, setRelease, musicVolume, setMusicVolume, leftHanded, setLeftHanded, showGhost, setShowGhost, muted, onToggleSound } = props;
  const seg = (active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-xs font-bold transition ${active ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-4 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Settings</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Default stance</p>
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
            <button type="button" onClick={() => setThrowStyle("BH")} className={seg(throwStyle === "BH")}>Backhand</button>
            <button type="button" onClick={() => setThrowStyle("FH")} className={seg(throwStyle === "FH")}>Forehand</button>
          </div>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Default shot shape</p>
          <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
            <button type="button" onClick={() => setRelease("hyzer")} className={seg(release === "hyzer")}>Hyzer</button>
            <button type="button" onClick={() => setRelease("flat")} className={seg(release === "flat")}>Flat</button>
            <button type="button" onClick={() => setRelease("anny")} className={seg(release === "anny")}>Anny</button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLeftHanded(!leftHanded)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-white text-sm font-semibold">Left-handed</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${leftHanded ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {leftHanded ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowGhost(!showGhost)}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-left">
            <span className="block text-white text-sm font-semibold">Best-round ghost</span>
            <span className="block text-gray-500 text-[11px]">Show your record round&apos;s flight lines while you play</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${showGhost ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {showGhost ? "ON" : "OFF"}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleSound}
          className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
        >
          <span className="text-white text-sm font-semibold">Sound</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${!muted ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
            {!muted ? "ON" : "OFF"}
          </span>
        </button>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">Music volume</p>
          <input
            type="range" min={0} max={1} step={0.05} value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            className="w-full accent-[#36D7B7]"
          />
        </div>

      </div>
    </div>
  );
}
