"use client";

import { useState } from "react";
import { fmtCoins } from "@/lib/discgolf/wallet";
import {
  AVATARS, DEFAULT_AVATAR, avatarUnlocked, playerXp, levelFromXp, type PlayerProfile,
} from "@/lib/discgolf/profile";
import {
  TOTAL_PAR, WINTHROP_PAR, OLYMPUS_PAR, ACHIEVEMENTS, BAG_MAX, type Achievement,
} from "@/lib/discgolf/engine";
import { Coin } from "./ui";


// Player profile — pick an avatar, set a name, see your level and badges.
export function ProfilePanel({ profile, coins, owned, unlocked, roundsPlayed, bestScore, winthropBest, olympusBest, bagCount, onSave, onBuyAvatar, onBag, onShop, onStats, hasAuth, user, onAccount, onSignOut, onClose }: {
  profile: PlayerProfile;
  coins: number;
  owned: string[];
  unlocked: string[];
  roundsPlayed: number;
  bestScore: number | null;
  winthropBest: number | null;
  olympusBest: number | null;
  bagCount: number;
  onSave: (p: PlayerProfile) => void;
  onBuyAvatar: (key: string, price: number) => void;
  onBag: () => void;
  onShop: () => void;
  onStats: () => void;
  hasAuth: boolean;
  user: { email: string } | null;
  onAccount: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const discsOwned = owned.filter((k) => !k.includes(":")).length; // exclude avatar:/event: cosmetics
  const lvl = levelFromXp(playerXp(roundsPlayed, unlocked.length, discsOwned));
  const pct = lvl.need ? Math.round((lvl.into / lvl.need) * 100) : 100;
  const over = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const [badgeInfo, setBadgeInfo] = useState<Achievement | null>(null); // tapped badge → its how-to-earn card
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-3.5 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Profile</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Identity card */}
        <div className="flex items-center gap-3 bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
          <span className="text-4xl leading-none shrink-0">{profile.avatar || DEFAULT_AVATAR}</span>
          <div className="min-w-0 flex-1">
            <input
              value={profile.name}
              onChange={(e) => onSave({ ...profile, name: e.target.value.slice(0, 16) })}
              placeholder="Your name"
              maxLength={16}
              className="w-full bg-transparent text-white font-bold text-base outline-none border-b border-white/10 focus:border-[#36D7B7] pb-0.5"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[#36D7B7] font-bold text-xs">Level {lvl.level}</span>
              <span className="text-gray-500 font-mono text-[10px]">{lvl.into}/{lvl.need} XP</span>
            </div>
            <div className="mt-1 h-1.5 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-[#36D7B7] rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {[
            { v: roundsPlayed, l: "Rounds" },
            { v: bestScore != null ? over(bestScore - TOTAL_PAR) : "–", l: "GE Best" },
            { v: winthropBest != null ? over(winthropBest - WINTHROP_PAR) : "–", l: "WL Best" },
            { v: olympusBest != null ? over(olympusBest - OLYMPUS_PAR) : "–", l: "OLY Best" },
            { v: discsOwned, l: "Discs" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg bg-white/5 border border-white/10 px-1 py-1.5">
              <p className="text-white font-bold text-sm leading-none">{s.v}</p>
              <p className="text-gray-500 text-[8px] mt-1 uppercase tracking-wide">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Discs: edit the bag or buy more; detailed stats */}
        <div className="flex gap-2">
          <button type="button" onClick={onBag} className="flex-1 rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-white text-xs font-bold py-2">🎒 Bag · {bagCount}/{BAG_MAX}</button>
          <button type="button" onClick={onShop} className="flex-1 rounded-lg border border-[#f5d24a]/45 bg-[#1a1d23] hover:border-[#f5d24a] text-white text-xs font-bold py-2">🛒 Shop</button>
          <button type="button" onClick={onStats} className="flex-1 rounded-lg border border-white/15 bg-[#1a1d23] hover:border-white/35 text-white text-xs font-bold py-2">📊 Stats</button>
        </div>

        {/* Avatar picker */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-gray-400 text-xs font-semibold">Avatar</p>
            <span className="text-[#f5d24a] font-bold font-mono text-[11px]">{fmtCoins(coins)} <Coin /></span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {AVATARS.map((a) => {
              const have = avatarUnlocked(a, owned);
              const selected = (profile.avatar || DEFAULT_AVATAR) === a.emoji;
              const afford = coins >= a.price;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => (have ? onSave({ ...profile, avatar: a.emoji }) : afford ? onBuyAvatar(a.key, a.price) : undefined)}
                  disabled={!have && !afford}
                  title={have ? a.key : `${a.price} coins`}
                  className={`relative aspect-square rounded-lg flex items-center justify-center text-xl transition ${
                    selected ? "bg-[#36D7B7]/25 ring-2 ring-[#36D7B7]" : "bg-white/5 hover:bg-white/10"
                  } ${!have && !afford ? "opacity-40" : ""}`}
                >
                  <span className={have ? "" : "grayscale opacity-70"}>{a.emoji}</span>
                  {!have && (
                    <span className="absolute -bottom-0.5 inset-x-0 flex items-center justify-center gap-0.5 text-[7px] font-mono text-[#f5d24a] leading-none">{a.price}<Coin className="!w-1.5 !h-1.5" /></span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-gray-600 text-[10px] mt-1.5">Tap a locked avatar to buy it with coins, then tap again to wear it.</p>
        </div>

        {/* Badges — tap one to see how it's earned */}
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1.5">Badges ({unlocked.length}/{ACHIEVEMENTS.length}) <span className="text-gray-600 font-normal">· tap for details</span></p>
          <div className="grid grid-cols-3 gap-1.5">
            {ACHIEVEMENTS.map((a) => {
              const earned = unlocked.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setBadgeInfo(a)}
                  className={`rounded-lg px-1.5 py-2 text-center border transition hover:border-white/30 ${
                    earned ? "bg-[#f5d24a]/10 border-[#f5d24a]/30" : "bg-white/5 border-white/5"
                  }`}
                >
                  <div className={`text-lg leading-none ${earned ? "" : "grayscale opacity-40"}`}>{a.emoji}</div>
                  <div className={`text-[8px] mt-1 leading-tight ${earned ? "text-gray-300" : "text-gray-600"}`}>{a.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account — log in to sync, or sign out */}
        {hasAuth && (
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-1.5">Account</p>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-gray-300 text-xs">👤 {user.email}</span>
                <button type="button" onClick={onSignOut} className="shrink-0 rounded-lg border border-white/15 hover:border-white/35 text-gray-200 hover:text-white text-xs font-semibold px-3 py-1.5 transition">Log out</button>
              </div>
            ) : (
              <button type="button" onClick={onAccount} className="w-full rounded-lg border border-[#36D7B7]/45 bg-[#1a1d23] hover:border-[#36D7B7] text-white text-xs font-bold py-2 transition">👤 Log in / Sign up</button>
            )}
            <p className="text-gray-600 text-[10px] mt-1.5">Log in to sync your bag, coins and best scores across devices.</p>
          </div>
        )}

      </div>

      {/* Badge detail — how it's earned (and the coin bounty), tapped from the grid */}
      {badgeInfo && (() => {
        const earned = unlocked.includes(badgeInfo.id);
        return (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5" onClick={() => setBadgeInfo(null)}>
            <div className="w-full max-w-[280px] rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#0f1117] border border-white/10 p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className={`text-4xl leading-none ${earned ? "" : "grayscale opacity-50"}`}>{badgeInfo.emoji}</div>
              <h3 className="text-white font-black text-lg mt-2">{badgeInfo.name}</h3>
              <p className="text-gray-300 text-sm mt-1">{badgeInfo.desc}</p>
              <p className={`text-xs font-bold mt-3 inline-flex items-center gap-1 ${earned ? "text-[#36D7B7]" : "text-[#f5d24a]"}`}>
                {earned ? "✓ Earned" : <>Reward +{badgeInfo.coins} <Coin className="!w-3 !h-3" /></>}
              </p>
              <button type="button" onClick={() => setBadgeInfo(null)} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1.5 mt-3 transition">Close</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
