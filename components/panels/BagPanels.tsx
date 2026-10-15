"use client";

import { ADV_DISCS, DISC_PRICE, isDiscUnlocked, BAG_MAX, discByKey } from "@/lib/discgolf/engine";
import { Coin } from "./ui";


// Level-up reward: choose 1 of 2 discs. Shown over everything; you must pick.
export function LevelUpPanel({ level, choices, bagHasRoom, onPick }: {
  level: number;
  choices: string[];
  bagHasRoom: boolean;
  onPick: (key: string) => void;
}) {
  const discs = choices.map((k) => discByKey(k)).filter((d): d is NonNullable<typeof d> => !!d);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm p-5">
      <div className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#0f1117] border border-[#36D7B7]/30 p-5 text-center shadow-2xl">
        <p className="text-[#f5d24a] font-black text-xs tracking-[0.2em]">⬆ LEVEL UP</p>
        <h2 className="text-white font-black text-3xl mt-0.5 leading-none">Level {level}</h2>
        <p className="text-gray-300 text-sm font-semibold mt-2">Pick a new disc for your bag</p>
        <p className="text-gray-500 text-[11px] mt-0.5">{bagHasRoom ? "It goes straight into your bag." : "Bag's full — it'll wait in your collection."}</p>
        <div className="flex flex-col gap-2.5 mt-4">
          {discs.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => onPick(d.key)}
              className="flex items-center gap-3 rounded-xl bg-[#1a1d23] border border-white/10 hover:border-[#36D7B7] hover:bg-[#20262f] active:scale-[0.99] px-3 py-3 text-left transition"
            >
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-sm truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                <p className="text-[10px] font-mono text-gray-400 truncate">{d.blurb.split("· ")[1]}</p>
              </div>
              <span className="text-[#36D7B7] text-xl shrink-0 leading-none">＋</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// The bag editor — carry up to BAG_MAX discs into a round. Unlocked discs sit in
// the collection; add/remove to curate the bag (swap = remove one, add another).
export function BagPanel({ bag, unlocked, owned, level, onAdd, onRemove, onMove, onShop, onClose }: {
  bag: string[];
  unlocked: string[];
  owned: string[];
  level: number;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onShop: () => void;
  onClose: () => void;
}) {
  const inBag = bag.map((k) => discByKey(k)).filter((d): d is NonNullable<typeof d> => !!d);
  const collection = ADV_DISCS.filter((d) => !bag.includes(d.key) && isDiscUnlocked(d, unlocked, owned, level));
  const locked = ADV_DISCS.filter((d) => !isDiscUnlocked(d, unlocked, owned, level));
  const full = bag.length >= BAG_MAX;
  const nums = (d: { blurb: string }) => `${d.blurb.split("· ")[1] ?? ""}`;
  const row = (d: NonNullable<ReturnType<typeof discByKey>>, action: React.ReactNode) => (
    <div key={d.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
        <p className="text-[10px] font-mono text-gray-500 truncate">{nums(d)}</p>
      </div>
      {action}
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 bg-[#0f1117]/95 backdrop-blur-sm rounded-lg flex flex-col">
      <div className="w-full max-w-xs mx-auto flex flex-col h-full px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-left">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-white font-black text-xl">Your Bag · {bag.length}/{BAG_MAX}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-[11px] mt-1 shrink-0">Carry up to {BAG_MAX} discs into a round — only these are usable. {full ? "Bag's full; remove one to swap." : "Add discs from your collection below."}</p>
        <div className="flex-1 overflow-y-auto mt-2.5 space-y-2 pr-0.5 -mr-0.5">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">In your bag <span className="text-gray-600 font-normal normal-case tracking-normal">· ▲▼ reorder (slots 1–{BAG_MAX})</span></p>
          {inBag.map((d, i) => (
            <div key={d.key} className="flex items-center gap-2 bg-[#1a1d23] border border-white/5 rounded-lg px-2.5 py-2">
              <span className="shrink-0 w-3.5 text-center text-[10px] font-mono text-gray-500">{i + 1}</span>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                <p className="text-[10px] font-mono text-gray-500 truncate">{nums(d)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => onMove(d.key, -1)} disabled={i === 0} aria-label="Move up" className="w-6 h-7 rounded bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] leading-none disabled:opacity-25">▲</button>
                <button type="button" onClick={() => onMove(d.key, 1)} disabled={i === inBag.length - 1} aria-label="Move down" className="w-6 h-7 rounded bg-white/10 hover:bg-white/15 text-gray-200 text-[11px] leading-none disabled:opacity-25">▼</button>
                <button type="button" onClick={() => onRemove(d.key)} disabled={bag.length <= 1} aria-label="Remove from bag" className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-base leading-none disabled:opacity-25">×</button>
              </div>
            </div>
          ))}
          {collection.length > 0 && <p className="text-gray-400 text-xs font-bold uppercase tracking-wide pt-1">Collection</p>}
          {collection.map((d) => row(d,
            <button type="button" onClick={() => onAdd(d.key)} disabled={full}
              className="shrink-0 rounded-lg bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117] text-xs font-bold px-3 py-1.5 disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500">Add</button>,
          ))}
          {locked.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-1">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Locked</p>
                <button type="button" onClick={onShop} className="text-[#f5d24a] text-[11px] font-bold hover:brightness-110">🛒 Shop ›</button>
              </div>
              {locked.map((d) => {
                const price = DISC_PRICE[d.key];
                return (
                  <div key={d.key} className="flex items-center gap-2.5 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 opacity-70">
                    <span className="w-3 h-3 rounded-full shrink-0 bg-[#444]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-300 text-sm font-bold truncate">🔒 {d.name} <span className="text-gray-600 font-normal text-[10px]">{d.brand}</span></p>
                      <p className="text-[10px] font-mono text-gray-600">{price != null ? <span className="inline-flex items-center gap-1">In the Shop · {price} <Coin className="!w-2.5 !h-2.5" /></span> : "Draft at level-up"}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
