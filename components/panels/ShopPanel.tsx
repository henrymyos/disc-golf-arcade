"use client";

import { useState } from "react";
import { fmtCoins } from "@/lib/discgolf/wallet";
import type { PlayerProfile } from "@/lib/discgolf/profile";
import { TRAILS, DEFAULT_TRAIL, type Trail } from "@/lib/discgolf/trails";
import {
  DISC_SKINS, BASKET_SKINS, AIM_STYLES, CELEBRATIONS, DEFAULT_DISC_SKIN, DEFAULT_BASKET_SKIN, DEFAULT_AIM_STYLE, DEFAULT_CELEBRATION, COSMETIC_PREFIX, cosmeticOwnKey, cosmeticUnlocked, type DiscSkin, type BasketSkin, type Celebration,
} from "@/lib/discgolf/cosmetics";
import { ADV_DISCS, DISC_PRICE, isDiscUnlocked } from "@/lib/discgolf/engine";
import { Coin } from "./ui";


// ── Shop swatch previews (CSS backgrounds for each cosmetic category). ──
export function trailSwatch(t: Trail): string {
  if (t.kind === "none") return "repeating-linear-gradient(45deg,#2a2f3a,#2a2f3a 3px,#1a1d23 3px,#1a1d23 6px)";
  if (t.kind === "rainbow") return "linear-gradient(90deg,#ff4d4d,#f5a623,#f5d24a,#36D7B7,#5fb0e8,#b85cd6)";
  if (t.colors.length === 1) return t.colors[0];
  return `linear-gradient(90deg,${t.colors.join(",")})`;
}
export function discSkinSwatch(s: DiscSkin): string {
  if (s.kind === "chrome") return "linear-gradient(90deg,#ffffff,#d7dde6,#878d97)";
  if (s.kind === "galaxy") return "linear-gradient(90deg,#b07cf0,#6a4bd6,#2a1d5a)";
  return s.body;
}
export function basketSwatch(b: BasketSkin): string {
  return `linear-gradient(90deg,${b.band},${b.pole},${b.base})`;
}
export function celebrationSwatch(c: Celebration): string {
  if (c.colors.length === 1) return c.colors[0];
  return `linear-gradient(90deg,${c.colors.join(",")})`;
}

// Cosmetic profile fields the shop can equip.
export type CosmeticField = "trail" | "discSkin" | "basketSkin" | "aimStyle" | "groundTheme" | "celebration";

// Disc shop — buy advanced discs + cosmetics with coins.
export function ShopPanel({ coins, unlocked, owned, level, profile, onBuy, onEquip, onClose }: {
  coins: number;
  unlocked: string[];
  owned: string[];
  level: number;
  profile: PlayerProfile;
  onBuy: (key: string, price: number) => void;
  onEquip: (field: CosmeticField, key: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"discs" | "trails" | "discskin" | "basket" | "aim" | "celebration">("discs");
  const seg = (active: boolean) =>
    `shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition ${active ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`;
  // The full catalog, cheapest first — the free starters (no price) lead the list.
  const items = [...ADV_DISCS].sort((a, b) => (DISC_PRICE[a.key] ?? 0) - (DISC_PRICE[b.key] ?? 0));
  // One buy/equip row, shared by every cosmetic category.
  const cosmeticRow = <T extends { key: string; name: string; desc: string; price: number }>(
    item: T, prefix: string, selected: string, field: CosmeticField, swatch: string,
  ) => {
    const have = cosmeticUnlocked(prefix, item, owned);
    const equipped = selected === item.key;
    const afford = coins >= item.price;
    return (
      <div key={item.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
        <span className="w-8 h-3 rounded-full shrink-0 border border-white/10" style={{ background: swatch }} />
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-bold truncate">{item.name}</p>
          <p className="text-[10px] text-gray-500">{item.desc}</p>
        </div>
        {have ? (
          <button type="button" onClick={() => onEquip(field, item.key)} disabled={equipped}
            className={`shrink-0 rounded-lg text-xs font-bold px-2.5 py-1.5 ${equipped ? "text-[#36D7B7]" : "bg-[#36D7B7] hover:bg-[#2bc4a6] text-[#0f1117]"}`}>
            {equipped ? "Equipped ✓" : "Equip"}
          </button>
        ) : (
          <button type="button" onClick={() => onBuy(cosmeticOwnKey(prefix, item.key), item.price)} disabled={!afford}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-[#f5d24a] hover:brightness-110 text-[#0f1117] text-xs font-bold px-2.5 py-1.5 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500">
            {item.price} <Coin />
          </button>
        )}
      </div>
    );
  };
  const TABS: { id: typeof tab; label: string }[] = [
    { id: "discs", label: "🥏 Discs" },
    { id: "trails", label: "✨ Trails" },
    { id: "discskin", label: "🎨 Disc" },
    { id: "basket", label: "🧺 Basket" },
    { id: "aim", label: "🎯 Aim" },
    { id: "celebration", label: "🎉 Win" },
  ];
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs space-y-2.5 my-auto text-left">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Shop</h2>
          <div className="flex items-center gap-2">
            <span className="text-[#f5d24a] font-bold font-mono text-sm">{fmtCoins(coins)} <Coin /></span>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="flex gap-1 bg-[#1a1d23] rounded-lg p-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={seg(tab === t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === "discs" && <>
          <p className="text-gray-500 text-[11px]">Every disc is buyable at any level — distance drivers are just pricey. Or draft one free each level-up. Discs work in every mode.</p>
          {items.map((d) => {
            const bought = owned.includes(d.key);
            const have = isDiscUnlocked(d, unlocked, owned, level); // owned or earned
            const price = DISC_PRICE[d.key];
            const afford = coins >= price;
            return (
              <div key={d.key} className="flex items-center gap-2.5 bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold truncate">{d.name} <span className="text-gray-500 font-normal text-[10px]">{d.brand}</span></p>
                  <p className="text-[10px] font-mono text-gray-500">{d.blurb.split("· ")[1] ?? d.blurb}</p>
                </div>
                {have ? (
                  <span className="shrink-0 text-[11px] font-bold text-[#36D7B7]">{price == null ? "Starter ✓" : bought ? "Owned ✓" : "Earned ✓"}</span>
                ) : (
                  <button type="button" onClick={() => onBuy(d.key, price)} disabled={!afford}
                    className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-[#f5d24a] hover:brightness-110 text-[#0f1117] text-xs font-bold px-2.5 py-1.5 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500">
                    {price} <Coin />
                  </button>
                )}
              </div>
            );
          })}
        </>}

        {tab === "trails" && <>
          <p className="text-gray-500 text-[11px]">A streak your disc leaves on every throw. Buy, then Equip — works in every mode.</p>
          {TRAILS.map((t) => cosmeticRow(t, "trail", profile.trail || DEFAULT_TRAIL, "trail", trailSwatch(t)))}
        </>}

        {tab === "discskin" && <>
          <p className="text-gray-500 text-[11px]">Recolor the flying disc. Its tier color stays as a center pip so you can tell which disc is in hand.</p>
          {DISC_SKINS.map((s) => cosmeticRow(s, COSMETIC_PREFIX.discSkin, profile.discSkin || DEFAULT_DISC_SKIN, "discSkin", discSkinSwatch(s)))}
        </>}

        {tab === "basket" && <>
          <p className="text-gray-500 text-[11px]">Restyle the basket you&apos;re aiming at — shown on every hole.</p>
          {BASKET_SKINS.map((b) => cosmeticRow(b, COSMETIC_PREFIX.basket, profile.basketSkin || DEFAULT_BASKET_SKIN, "basketSkin", basketSwatch(b)))}
        </>}

        {tab === "aim" && <>
          <p className="text-gray-500 text-[11px]">Restyle the predicted-flight aim line you see while pulling back.</p>
          {AIM_STYLES.map((a) => cosmeticRow(a, COSMETIC_PREFIX.aim, profile.aimStyle || DEFAULT_AIM_STYLE, "aimStyle", a.color))}
        </>}

        {tab === "celebration" && <>
          <p className="text-gray-500 text-[11px]">The burst that fires when you sink the disc — bigger when you beat par.</p>
          {CELEBRATIONS.map((c) => cosmeticRow(c, COSMETIC_PREFIX.celebration, profile.celebration || DEFAULT_CELEBRATION, "celebration", celebrationSwatch(c)))}
        </>}

      </div>
    </div>
  );
}
